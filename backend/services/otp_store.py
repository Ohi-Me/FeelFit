"""
FeelFit — Short-lived email OTP codes for signup verification.

Proving the signer actually controls the inbox is what stops "just fill fake
data and sign up" — a disposable-domain blocklist alone doesn't catch someone
typing a real-looking but not-their-own address. In-memory only: codes are
short-lived (10 min) and losing them on a server restart is fine — the user
just requests a new one.
"""
from __future__ import annotations

import secrets
import time
from threading import Lock

_TTL_SECONDS = 10 * 60
_RESEND_COOLDOWN = 30
_MAX_ATTEMPTS = 5

_lock = Lock()
_codes: dict[str, dict] = {}  # email -> {code, expires, attempts, last_sent}


def issue(email: str) -> tuple[str | None, str | None]:
    """Generate+store a new 6-digit code for this email. Returns (code, error).
    Enforces a short resend cooldown so a spam-click can't hammer the mailer."""
    email = email.lower().strip()
    with _lock:
        existing = _codes.get(email)
        now = time.time()
        if existing and now - existing.get("last_sent", 0) < _RESEND_COOLDOWN:
            wait = int(_RESEND_COOLDOWN - (now - existing["last_sent"]))
            return None, f"Please wait {wait}s before requesting another code."
        code = f"{secrets.randbelow(1_000_000):06d}"
        _codes[email] = {"code": code, "expires": now + _TTL_SECONDS, "attempts": 0, "last_sent": now}
        return code, None


def verify(email: str, code: str) -> str | None:
    """Returns an error message if invalid, else None (and consumes the code)."""
    email = email.lower().strip()
    code = (code or "").strip()
    with _lock:
        entry = _codes.get(email)
        if not entry:
            return "Please request a new code."
        if time.time() > entry["expires"]:
            del _codes[email]
            return "That code expired — please request a new one."
        if entry["attempts"] >= _MAX_ATTEMPTS:
            del _codes[email]
            return "Too many incorrect attempts — please request a new code."
        if not code or code != entry["code"]:
            entry["attempts"] += 1
            return "That code doesn't match — check and try again."
        del _codes[email]  # one-time use
        return None
