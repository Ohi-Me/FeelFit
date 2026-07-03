"""
FeelFit — Google Places doctor discovery (optional, with OSM fallback).

When GOOGLE_MAPS_API_KEY is set, this returns real nearby doctors WITH Google
ratings + review counts. If the key is missing, a call fails, or it returns
nothing, the caller transparently falls back to the free OpenStreetMap finder —
so results never break, with or without a paid key.

Same response shape as osm_places_service so the frontend is unchanged.
"""
from __future__ import annotations

import logging
import math
import os
from typing import Optional

import httpx

logger = logging.getLogger("feelfit.gplaces")

_GEOCODE = "https://maps.googleapis.com/maps/api/geocode/json"
_NEARBY = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
_TEXT = "https://maps.googleapis.com/maps/api/place/textsearch/json"


def enabled() -> bool:
    return bool(os.environ.get("GOOGLE_MAPS_API_KEY"))


def _haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


async def _geocode(client: httpx.AsyncClient, location: str, key: str):
    r = await client.get(_GEOCODE, params={"address": location, "key": key})
    j = r.json()
    if j.get("status") == "OK" and j.get("results"):
        loc = j["results"][0]["geometry"]["location"]
        return loc["lat"], loc["lng"]
    return None


def _spec_keyword(spec: str) -> str:
    return (spec or "doctor").strip() or "doctor"


def _normalize(p: dict, ulat: float, ulng: float, spec: str) -> dict:
    loc = p.get("geometry", {}).get("location", {})
    plat, plng = loc.get("lat", ulat), loc.get("lng", ulng)
    dist = _haversine(ulat, ulng, plat, plng)
    rating = float(p.get("rating") or 0.0)
    reviews = int(p.get("user_ratings_total") or 0)
    # FeelFit score blends Google rating, review volume and proximity.
    dist_norm = max(0.0, 1.0 - dist / 20.0)
    rating_norm = rating / 5.0 if rating else 0.0
    review_norm = min(1.0, math.log10(reviews + 1) / 3.0) if reviews else 0.0
    score = round(0.45 * rating_norm + 0.2 * review_norm + 0.35 * dist_norm, 4)
    open_now = p.get("opening_hours", {}).get("open_now")
    return {
        "name": p.get("name", "Healthcare Provider"),
        "specialization": spec or "General Physician",
        "clinic": p.get("name", ""),
        "rating": round(rating, 1),
        "review_count": reviews,
        "experience_years": 0,
        "address": p.get("vicinity") or p.get("formatted_address") or "",
        "phone": "Call via Maps",
        "distance_km": dist,
        "lat": plat,
        "lng": plng,
        "availability": "Open now" if open_now else ("Hours on Maps" if open_now is False else ""),
        "fees_inr": "",
        "languages": [],
        "score": score,
        "maps_url": f"https://www.google.com/maps/place/?q=place_id:{p.get('place_id')}" if p.get("place_id") else None,
        "source": "google",
    }


async def find_doctors_google(
    location: str,
    specialization: str = "",
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    radius_km: int = 5,
    max_results: int = 20,
) -> Optional[dict]:
    """Return doctors with real Google ratings, or None to signal 'use the fallback'."""
    key = os.environ.get("GOOGLE_MAPS_API_KEY")
    if not key:
        return None
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            if user_lat is None or user_lng is None:
                coords = await _geocode(client, location, key)
                if not coords:
                    return None
                user_lat, user_lng = coords

            kw = _spec_keyword(specialization)
            results: list[dict] = []
            for r_m in sorted({radius_km * 1000, max(radius_km, 10) * 1000}):
                resp = await client.get(_NEARBY, params={
                    "location": f"{user_lat},{user_lng}", "radius": r_m,
                    "keyword": kw, "type": "doctor", "key": key,
                })
                j = resp.json()
                if j.get("status") in ("OK", "ZERO_RESULTS"):
                    results = j.get("results", [])
                    if results:
                        break
                else:
                    logger.warning(f"Google Places status={j.get('status')}: {j.get('error_message','')}")
                    return None  # quota/key error → fall back to OSM
            if not results:
                return None

            docs = [_normalize(p, user_lat, user_lng, specialization) for p in results]
            docs.sort(key=lambda d: d["score"], reverse=True)
            docs = docs[:max_results]
            specs: dict[str, int] = {}
            for d in docs:
                specs[d["specialization"]] = specs.get(d["specialization"], 0) + 1
            return {
                "doctors": docs, "total": len(docs), "location_resolved": location,
                "coordinates": {"lat": user_lat, "lng": user_lng},
                "source": "google",
                "insights": {"total_found": len(docs), "specializations": specs,
                             "has_ratings": True},
            }
    except Exception as e:
        logger.warning(f"Google Places failed, falling back to OSM: {e}")
        return None
