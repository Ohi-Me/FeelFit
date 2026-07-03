"""
FeelFit v4 — Utils: In-memory cache + rate limiter + structured logging
"""
from __future__ import annotations
import hashlib
import logging
import time
from collections import defaultdict
from typing import Any, Optional

logger = logging.getLogger("feelfit.utils")


# ── In-Memory LRU Cache (LLM response caching) ────────────────────────────────

class TTLCache:
    """
    Thread-safe in-memory cache with TTL expiry.
    Used to cache LLM analysis results for identical file+profile combos.
    """
    def __init__(self, max_size: int = 100, ttl_seconds: int = 3600):
        self._store: dict[str, tuple[Any, float]] = {}
        self._max_size = max_size
        self._ttl = ttl_seconds

    def _evict_expired(self):
        now = time.time()
        expired = [k for k, (_, ts) in self._store.items() if now - ts > self._ttl]
        for k in expired:
            del self._store[k]

    def get(self, key: str) -> Optional[Any]:
        self._evict_expired()
        entry = self._store.get(key)
        if entry is None:
            return None
        value, ts = entry
        if time.time() - ts > self._ttl:
            del self._store[key]
            return None
        return value

    def set(self, key: str, value: Any):
        self._evict_expired()
        if len(self._store) >= self._max_size:
            # Evict oldest
            oldest = min(self._store.items(), key=lambda x: x[1][1])
            del self._store[oldest[0]]
        self._store[key] = (value, time.time())

    def make_key(self, file_bytes: bytes, profile_dict: dict) -> str:
        """Generate a stable cache key from file content hash + profile."""
        file_hash = hashlib.sha256(file_bytes).hexdigest()[:16]
        profile_str = str(sorted(profile_dict.items()))
        profile_hash = hashlib.md5(profile_str.encode()).hexdigest()[:8]
        return f"{file_hash}:{profile_hash}"

    @property
    def size(self) -> int:
        self._evict_expired()
        return len(self._store)


# ── Rate Limiter ──────────────────────────────────────────────────────────────

class RateLimiter:
    """
    Simple sliding window rate limiter per IP.
    Prevents abuse of the expensive LLM endpoint.
    """
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._max = max_requests
        self._window = window_seconds

    def is_allowed(self, identifier: str) -> tuple[bool, int]:
        """
        Returns (allowed: bool, remaining: int)
        """
        now = time.time()
        window_start = now - self._window
        # Clean old requests
        self._requests[identifier] = [
            ts for ts in self._requests[identifier] if ts > window_start
        ]
        count = len(self._requests[identifier])
        if count >= self._max:
            return False, 0
        self._requests[identifier].append(now)
        return True, self._max - count - 1

    def reset(self, identifier: str):
        self._requests.pop(identifier, None)


# ── Singletons ────────────────────────────────────────────────────────────────

analysis_cache = TTLCache(max_size=200, ttl_seconds=7200)   # 2-hour cache
rate_limiter = RateLimiter(max_requests=15, window_seconds=60)  # 15 req/min per IP


# ── File Validation ───────────────────────────────────────────────────────────

ALLOWED_MAGIC_BYTES = {
    b"%PDF": "application/pdf",
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"II*\x00": "image/tiff",
    b"MM\x00*": "image/tiff",
    b"RIFF": "image/webp",
}

def validate_file_magic(file_bytes: bytes) -> Optional[str]:
    """
    Validate file by magic bytes (not just MIME type).
    Returns detected MIME type or None if invalid.
    """
    for magic, mime in ALLOWED_MAGIC_BYTES.items():
        if file_bytes[:len(magic)] == magic:
            return mime
    return None


# ── Text Quality Check ────────────────────────────────────────────────────────

def assess_extraction_quality(text: str) -> dict:
    """
    Assess quality of extracted text to warn if extraction was poor.
    Returns quality metrics dict.
    """
    if not text:
        return {"quality": "empty", "score": 0, "warning": "No text extracted from file"}

    words = text.split()
    word_count = len(words)
    line_count = text.count("\n")
    # Ratio of alphanumeric chars
    alnum = sum(1 for c in text if c.isalnum())
    alnum_ratio = alnum / max(len(text), 1)
    # Check for number presence (medical reports have lots of numbers)
    number_count = sum(1 for w in words if any(c.isdigit() for c in w))
    number_ratio = number_count / max(word_count, 1)

    score = 0
    if word_count > 50: score += 30
    elif word_count > 20: score += 15
    if alnum_ratio > 0.6: score += 25
    elif alnum_ratio > 0.4: score += 12
    if number_ratio > 0.1: score += 25
    elif number_ratio > 0.05: score += 12
    if line_count > 10: score += 20

    if score >= 70:
        quality = "good"
        warning = None
    elif score >= 40:
        quality = "fair"
        warning = "Text extraction quality is moderate — some values may be missed"
    else:
        quality = "poor"
        warning = "Text extraction quality is low — consider uploading a clearer scan"

    return {
        "quality": quality,
        "score": score,
        "word_count": word_count,
        "number_ratio": round(number_ratio, 3),
        "warning": warning
    }
