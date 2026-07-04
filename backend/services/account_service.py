"""
FeelFit — Accounts, usage limits & day passes (freemium)

Lightweight, file-backed store (no external DB) for:
  • accounts (email + salted password hash)
  • auth tokens
  • per-identity usage counts (free tier)
  • day passes (₹9/day unlimited)

Identity = the logged-in email if present, else the client IP. Free users get a
small number of report checks, then must log in + buy a day pass. Paid users get
unlimited checks and the premium (Gemini) extraction path.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import secrets
import time
from pathlib import Path
from threading import Lock

from utils.email_validation import is_disposable_domain

_DATA = Path(__file__).parent.parent / "data"
_DATA.mkdir(exist_ok=True)
_STORE = _DATA / "accounts.json"
_lock = Lock()

FREE_LIMIT = int(os.environ.get("FREE_REPORT_LIMIT", "2"))
# Extra free analyses unlocked by creating an account (2 anonymous + 1 = 3).
SIGNUP_BONUS = int(os.environ.get("SIGNUP_BONUS_ANALYSES", "1"))
PASS_SECONDS = 24 * 3600
PRICE_INR = int(os.environ.get("DAY_PASS_PRICE_INR", "9"))

_DAY = 24 * 3600
# Subscription plans (INR). `original` = pre-discount anchor price shown
# struck-through in the plan picker; the save-% badge is computed from it
# client-side so the numbers can never drift apart. Charged amount is `price`.
PLANS: dict[str, dict] = {
    "day":    {"id": "day",    "label": "Day Pass", "price": 19,                     "seconds": _DAY,       "period": "for 24 hours"},
    "week":   {"id": "week",   "label": "Weekly",   "price": 89,   "original": 99,   "seconds": 7 * _DAY,   "period": "per week"},
    "month":  {"id": "month",  "label": "Monthly",  "price": 349,  "original": 449,  "seconds": 30 * _DAY,  "period": "per month"},
    "yearly": {"id": "yearly", "label": "Yearly",   "price": 1999, "original": 2999, "seconds": 365 * _DAY, "period": "per year"},
}


def plan(plan_id: str | None) -> dict:
    """Return a plan definition, defaulting to the day pass for unknown ids."""
    return PLANS.get((plan_id or "day").lower(), PLANS["day"])


def _load() -> dict:
    if _STORE.exists():
        try:
            return json.loads(_STORE.read_text())
        except Exception:
            pass
    return {"accounts": {}, "tokens": {}, "usage": {}, "passes": {}}


def _save(d: dict) -> None:
    _STORE.write_text(json.dumps(d))


def _hash(pw: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()


# ── Auth ────────────────────────────────────────────────────────────────────────

def email_taken(email: str) -> bool:
    return (email or "").lower().strip() in _load()["accounts"]


def password_error(password: str) -> str | None:
    """Standard strength rule: 8+ chars, upper, lower, digit, special char.
    Returns the first unmet requirement, or None if the password is strong enough."""
    password = password or ""
    if len(password) < 8:
        return "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", password):
        return "Password must include at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return "Password must include at least one lowercase letter."
    if not re.search(r"[0-9]", password):
        return "Password must include at least one number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Password must include at least one special character (e.g. !@#$%)."
    return None


def signup(email: str, password: str) -> tuple[str | None, str | None]:
    email = (email or "").lower().strip()
    if "@" not in email:
        return None, "Enter a valid email address."
    pw_err = password_error(password)
    if pw_err:
        return None, pw_err
    if is_disposable_domain(email):
        return None, "Please sign up with a permanent email address — temporary/disposable emails aren't accepted."
    with _lock:
        d = _load()
        if email in d["accounts"]:
            return None, "An account with this email already exists — please log in."
        salt = secrets.token_hex(8)
        d["accounts"][email] = {"salt": salt, "hash": _hash(password, salt), "created": time.time()}
        token = secrets.token_urlsafe(24)
        d["tokens"][token] = email
        _save(d)
        return token, None


def login(email: str, password: str) -> tuple[str | None, str | None]:
    email = (email or "").lower().strip()
    with _lock:
        d = _load()
        acc = d["accounts"].get(email)
        if not acc or acc["hash"] != _hash(password, acc["salt"]):
            return None, "Invalid email or password."
        token = secrets.token_urlsafe(24)
        d["tokens"][token] = email
        _save(d)
        return token, None


def email_for_token(token: str | None) -> str | None:
    if not token:
        return None
    return _load()["tokens"].get(token)


def oauth_login(email: str, name: str | None = None) -> tuple[str, bool]:
    """Create-or-login a passwordless account (Google/OAuth/phone). Returns
    (token, is_new_account) so callers can prompt first-time users for a
    quick profile (age/gender) right after signup."""
    email = (email or "").lower().strip()
    with _lock:
        d = _load()
        is_new = email not in d["accounts"]
        if is_new:
            d["accounts"][email] = {"oauth": True, "name": name, "created": time.time()}
        token = secrets.token_urlsafe(24)
        d["tokens"][token] = email
        _save(d)
        return token, is_new


# ── Usage + passes ───────────────────────────────────────────────────────────────

def is_paid(identity: str) -> bool:
    return _load()["passes"].get(identity, 0) > time.time()


def grant_pass(identity: str, seconds: int = PASS_SECONDS) -> float:
    with _lock:
        d = _load()
        base = max(d["passes"].get(identity, 0), time.time())
        d["passes"][identity] = base + seconds
        _save(d)
        return d["passes"][identity]


def usage_count(identity: str) -> int:
    return _load()["usage"].get(identity, 0)


def incr_usage(identity: str) -> int:
    with _lock:
        d = _load()
        d["usage"][identity] = d["usage"].get(identity, 0) + 1
        _save(d)
        return d["usage"][identity]


def free_limit_for(email: str | None) -> int:
    """Anonymous visitors get FREE_LIMIT analyses; having an account unlocks
    SIGNUP_BONUS more. Pair with adopt_anonymous_usage() at sign-in so the
    bonus is literally +1 — not a fresh allowance on top of anonymous use."""
    return FREE_LIMIT + (SIGNUP_BONUS if email else 0)


def remaining_free(identity: str, email: str | None = None) -> int:
    return max(0, free_limit_for(email) - usage_count(identity))


def adopt_anonymous_usage(email: str, anon_identity: str) -> None:
    """Carry this device's anonymous usage into the account at sign-in/up.
    Without this, 'sign up for 1 more free analysis' would silently grant a
    fresh 3 (anonymous count lives under ip:<addr>, account count under the
    email) — with it, 2 used anonymously → the account starts at 2/3 used."""
    email = (email or "").lower().strip()
    if not email or not anon_identity or anon_identity == email:
        return
    with _lock:
        d = _load()
        used_anon = d["usage"].get(anon_identity, 0)
        if used_anon > d["usage"].get(email, 0):
            d["usage"][email] = used_anon
            _save(d)


def status(identity: str, email: str | None = None) -> dict:
    d = _load()
    exp = d["passes"].get(identity, 0)
    limit = free_limit_for(email)
    return {
        "email": email,
        "free_used": d["usage"].get(identity, 0),
        "free_limit": limit,
        "remaining_free": max(0, limit - d["usage"].get(identity, 0)),
        "is_paid": exp > time.time(),
        "pass_expires": exp if exp > time.time() else None,
        "price_inr": PRICE_INR,
        "plans": list(PLANS.values()),
    }
