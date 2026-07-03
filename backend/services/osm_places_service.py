"""
FeelFit — OpenStreetMap Doctor Discovery Service (free, no API key, no billing)

Real-time doctor/clinic/hospital search using two free, open services:
  • Nominatim  → geocode any city / area / PIN / landmark in India → lat,lng
  • Overpass   → query OSM for nearby healthcare POIs around those coords

No credit card, no billing, no quota purchase. Public servers have a fair-use
rate limit (~1 req/sec for Nominatim) and require a descriptive User-Agent,
both of which are honoured below. Drop-in replacement for the Google Places
service: exposes the same `find_doctors_for_location(...)` signature + response
shape, so the API route and frontend are unchanged.
"""
from __future__ import annotations

import asyncio
import logging
import math
from typing import Optional

import httpx

logger = logging.getLogger("feelfit.osm")

# Identify the app per the Nominatim usage policy (required).
USER_AGENT = "FeelFit/1.0 (medical health platform; contact: support@feelfit.app)"

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
# A few public Overpass mirrors — we try them in order until one answers.
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# ── Specialization mapping ──────────────────────────────────────────────────────
# OSM uses healthcare:speciality with values like "cardiology;dermatology".
SPECIALITY_TAG_MAP: dict[str, str] = {
    "cardiology": "Cardiologist",
    "neurology": "Neurologist",
    "dermatology": "Dermatologist",
    "venereology": "Dermatologist",
    "orthopaedics": "Orthopedist",
    "orthopedics": "Orthopedist",
    "gynaecology": "Gynecologist",
    "gynecology": "Gynecologist",
    "obstetrics": "Gynecologist",
    "paediatrics": "Pediatrician",
    "pediatrics": "Pediatrician",
    "endocrinology": "Endocrinologist",
    "diabetology": "Diabetologist",
    "nephrology": "Nephrologist",
    "gastroenterology": "Gastroenterologist",
    "pulmonology": "Pulmonologist",
    "psychiatry": "Psychiatrist",
    "rheumatology": "Rheumatologist",
    "urology": "Urologist",
    "haematology": "Hematologist",
    "hematology": "Hematologist",
    "oncology": "Oncologist",
    "ophthalmology": "Ophthalmologist",
    "otolaryngology": "ENT Specialist",
    "general": "General Physician",
}

# Fallback keyword detection from the place name.
SPEC_KEYWORDS: dict[str, list[str]] = {
    "Cardiologist":       ["heart", "cardiac", "cardio"],
    "Neurologist":        ["neuro", "brain", "nerve", "spine"],
    "Dermatologist":      ["skin", "derma", "cosmet", "glow"],
    "Orthopedist":        ["ortho", "bone", "joint", "fracture"],
    "Gynecologist":       ["gynae", "gyno", "women", "maternity", "obstet"],
    "Pediatrician":       ["child", "pedia", "kids", "baby", "infant"],
    "Endocrinologist":    ["endocrin", "thyroid", "hormone"],
    "Diabetologist":      ["diabet", "sugar", "insulin"],
    "Nephrologist":       ["kidney", "nephro", "renal", "dialysis"],
    "Gastroenterologist": ["gastro", "digestive", "liver", "stomach"],
    "Pulmonologist":      ["lung", "pulmo", "chest", "respirat"],
    "Psychiatrist":       ["psych", "mental", "mind"],
    "Rheumatologist":     ["rheumat", "arthrit"],
    "Urologist":          ["urol", "bladder", "prostat"],
    "Hematologist":       ["hemato", "blood"],
    "Ophthalmologist":    ["eye", "ophthal", "vision", "retina"],
    "ENT Specialist":     ["ent ", "ear nose", "throat"],
    "Oncologist":         ["cancer", "oncol", "tumor"],
    "Dentist":            ["dental", "dentist", "teeth"],
}


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return round(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)


async def geocode_location(location: str) -> tuple[float, float] | None:
    """Resolve a location string to (lat, lng) via Nominatim. Free, no key."""
    query = location if "india" in location.lower() else f"{location}, India"
    try:
        async with httpx.AsyncClient(timeout=12.0, headers={"User-Agent": USER_AGENT}) as client:
            r = await client.get(NOMINATIM_URL, params={
                "q": query, "format": "json", "limit": 1, "countrycodes": "in",
            })
        data = r.json()
        if data:
            return float(data[0]["lat"]), float(data[0]["lon"])
    except Exception as e:
        logger.error(f"Nominatim geocode error: {e}")
    return None


async def overpass_query(lat: float, lng: float, radius_m: int) -> list[dict]:
    """Fetch healthcare POIs around a point from OSM via Overpass. Free, no key."""
    q = f"""
[out:json][timeout:25];
(
  nwr["amenity"="doctors"](around:{radius_m},{lat},{lng});
  nwr["amenity"="clinic"](around:{radius_m},{lat},{lng});
  nwr["amenity"="hospital"](around:{radius_m},{lat},{lng});
  nwr["healthcare"](around:{radius_m},{lat},{lng});
);
out center tags 120;
""".strip()

    for endpoint in OVERPASS_ENDPOINTS:
        try:
            async with httpx.AsyncClient(timeout=30.0, headers={"User-Agent": USER_AGENT}) as client:
                r = await client.post(endpoint, data={"data": q})
            if r.status_code == 200:
                return r.json().get("elements", [])
            logger.warning(f"Overpass {endpoint} returned {r.status_code}")
        except Exception as e:
            logger.warning(f"Overpass {endpoint} failed: {e}")
            continue
    logger.error("All Overpass endpoints failed")
    return []


def _build_address(tags: dict, fallback_location: str) -> str:
    parts = [
        tags.get("addr:housenumber"),
        tags.get("addr:street"),
        tags.get("addr:suburb") or tags.get("addr:neighbourhood"),
        tags.get("addr:city") or tags.get("addr:town") or tags.get("addr:village"),
        tags.get("addr:postcode"),
    ]
    addr = ", ".join(p for p in parts if p)
    return addr or f"Near {fallback_location} (see map)"


def _detect_specialization(tags: dict, name: str) -> str:
    """Best-effort specialization from OSM speciality tag, else name keywords, else type."""
    speciality = (tags.get("healthcare:speciality") or tags.get("speciality") or "").lower()
    for token in speciality.replace(",", ";").split(";"):
        token = token.strip()
        if token in SPECIALITY_TAG_MAP:
            return SPECIALITY_TAG_MAP[token]

    text = name.lower()
    for spec, kws in SPEC_KEYWORDS.items():
        if any(kw in text for kw in kws):
            return spec

    amenity = tags.get("amenity", "")
    if amenity == "hospital" or tags.get("healthcare") == "hospital":
        return "Hospital (Multispeciality)"
    return "General Physician"


def _normalize(element: dict, user_lat: float, user_lng: float, target_spec: str) -> dict | None:
    tags = element.get("tags", {})
    name = tags.get("name") or tags.get("name:en") or tags.get("operator")
    if not name:
        return None  # skip unnamed POIs — not useful to a patient

    # coordinates (nodes have lat/lon; ways/relations have center)
    if "lat" in element and "lon" in element:
        plat, plng = element["lat"], element["lon"]
    else:
        center = element.get("center", {})
        plat, plng = center.get("lat", user_lat), center.get("lon", user_lng)

    distance_km = haversine(user_lat, user_lng, plat, plng)
    detected = _detect_specialization(tags, name)

    # If the user picked a specialization, surface hospitals/multispeciality
    # clinics under that label (they realistically host those departments).
    specialization = detected
    if target_spec:
        if target_spec.lower() in detected.lower():
            specialization = target_spec
        elif "hospital" in detected.lower() or tags.get("amenity") in ("hospital", "clinic"):
            specialization = target_spec

    phone = tags.get("phone") or tags.get("contact:phone") or ""
    website = tags.get("website") or tags.get("contact:website") or ""
    opening = tags.get("opening_hours", "")
    osm_id = element.get("id", "")
    osm_type = element.get("type", "node")

    # Score: OSM has no ratings, so rank by proximity + how complete the listing
    # is (phone/website/hours/address present = more trustworthy entry).
    completeness = sum(bool(x) for x in [phone, website, opening, tags.get("addr:street")]) / 4.0
    dist_norm = max(0.0, 1.0 - distance_km / 20.0)
    spec_relevance = 1.0 if (target_spec and target_spec.lower() in specialization.lower()) else 0.7
    score = round(0.55 * dist_norm + 0.25 * completeness + 0.20 * spec_relevance, 4)

    return {
        "place_id": f"osm:{osm_type}:{osm_id}",
        "name": name,
        "specialization": specialization,
        "clinic": name,
        "address": _build_address(tags, "this area"),
        "phone": phone or "Not listed — check map",
        "website": website,
        "rating": 0.0,            # OSM has no ratings → hidden in UI
        "review_count": 0,
        "distance_km": distance_km,
        "lat": plat,
        "lng": plng,
        "availability": opening or "Call to confirm hours",
        "is_open": None,
        "maps_url": f"https://www.openstreetmap.org/{osm_type}/{osm_id}",
        "photo_url": "",
        "review_snippets": [],
        "review_summary": "",
        "business_status": "OPERATIONAL",
        "types": [tags.get("amenity") or tags.get("healthcare") or "healthcare"],
        "score": score,
        "fees_inr": "",
        "languages": ["Hindi", "English"],
        "verified": False,
        "source": "openstreetmap",
    }


async def find_doctors_for_location(
    location: str,
    specialization: str = "",
    user_lat: Optional[float] = None,
    user_lng: Optional[float] = None,
    radius_km: int = 5,
    max_results: int = 20,
) -> dict:
    """
    Real doctor discovery for any location in India via OpenStreetMap.
    Free — no API key, no billing. Same response shape as the Google service.
    """
    # Step 1: resolve coordinates
    if user_lat is None or user_lng is None:
        coords = await geocode_location(location)
        if not coords:
            return {
                "error": f"Could not resolve location: {location}",
                "doctors": [], "total": 0, "location_resolved": location, "insights": None,
            }
        user_lat, user_lng = coords

    # Step 2: expand the radius progressively until we find something
    elements: list[dict] = []
    for r_km in sorted({radius_km, max(radius_km, 10), 25}):
        elements = await overpass_query(user_lat, user_lng, r_km * 1000)
        if elements:
            radius_km = r_km
            break

    if not elements:
        return {
            "doctors": [], "total": 0, "location_resolved": location,
            "coordinates": {"lat": user_lat, "lng": user_lng},
            "insights": None, "source": "openstreetmap",
            "note": "No mapped healthcare facilities found nearby on OpenStreetMap. "
                    "Try a larger radius or a bigger city.",
        }

    # Step 3: normalize, dedupe, rank
    seen: set[str] = set()
    normalized: list[dict] = []
    for el in elements:
        doc = _normalize(el, user_lat, user_lng, specialization)
        if not doc:
            continue
        key = (doc["name"].lower(), round(doc["lat"], 4), round(doc["lng"], 4))
        if key in seen:
            continue
        seen.add(key)
        normalized.append(doc)

    ranked = sorted(normalized, key=lambda d: d["score"], reverse=True)[:max_results]

    # Step 4: insights panel
    spec_counts: dict[str, int] = {}
    for d in ranked:
        spec_counts[d["specialization"]] = spec_counts.get(d["specialization"], 0) + 1
    insights = {
        "total_found": len(ranked),
        "location": location,
        "avg_rating": 0,
        "top_specializations": [s for s, _ in sorted(spec_counts.items(), key=lambda x: -x[1])[:4]],
        "open_now_count": 0,
        "verified_count": 0,
        "radius_km": radius_km,
        "source": "openstreetmap",
    }

    return {
        "doctors": ranked,
        "total": len(ranked),
        "location_resolved": location,
        "coordinates": {"lat": user_lat, "lng": user_lng},
        "insights": insights,
        "source": "openstreetmap",
    }
