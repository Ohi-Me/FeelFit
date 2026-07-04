"""
FeelFit — AI Model Router
════════════════════════════════════════════════════════════════════════════
One entry point for EVERY LLM call in the product (report analysis, AskFit,
medicine info, interactions, and future features). The router picks the best
provider/model for the job and degrades gracefully:

  • Task profiles   — each call declares WHAT it is ("analysis", "chat",
                      "vision", "utility"); the router owns WHICH model runs it.
  • Tier awareness  — premium users get the deeper-reasoning chain (Gemini Pro
                      first); free users get the fast free chain (Groq first).
  • Fallback chains — if a provider is down / rate-limited / errors, the call
                      falls through to the next candidate instead of failing.
  • Circuit breaker — a provider that just failed is skipped for a cooldown
                      window (respecting Retry-After on 429s), so one outage
                      doesn't add latency to every request.
  • Observability   — every routed call logs provider, model, latency;
                      get_router_status() exposes health for /api/admin/metrics.

Providers today: Groq (fast, free) + Gemini (vision, reasoning). Adding a new
provider = one adapter function + entries in the chains. No SDKs — plain httpx,
same as the rest of the backend.
"""
from __future__ import annotations

import base64
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx

logger = logging.getLogger("feelfit.router")

# ── Models (env-overridable, sensible free-tier defaults) ────────────────────
GROQ_FAST = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_VISION = os.environ.get("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
GEMINI_FLASH = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_PRO = os.environ.get("GEMINI_PRO_MODEL", "gemini-2.5-pro")


@dataclass(frozen=True)
class Candidate:
    provider: str            # "groq" | "gemini"
    model: str
    vision: bool = False     # can accept images
    pdf: bool = False        # can accept raw PDFs (Gemini can, Groq can't)


# Candidate shorthands
_GROQ_FAST = Candidate("groq", GROQ_FAST)
_GROQ_VISION = Candidate("groq", GROQ_VISION, vision=True)
_FLASH = Candidate("gemini", GEMINI_FLASH, vision=True, pdf=True)
_PRO = Candidate("gemini", GEMINI_PRO, vision=True, pdf=True)

# ── Task → tier → ordered fallback chain ────────────────────────────────────
# The FIRST healthy, capable candidate wins. Free chains lead with Groq
# (fastest tokens/sec at zero cost); premium chains lead with Gemini Pro
# (deepest reasoning), still falling back to fast models rather than failing.
CHAINS: dict[str, dict[str, list[Candidate]]] = {
    # Report narration — strict JSON, medical care in wording
    "analysis": {
        "free":    [_GROQ_FAST, _FLASH],
        "premium": [_PRO, _GROQ_FAST, _FLASH],
    },
    # AskFit conversational answers
    "chat": {
        "free":    [_GROQ_FAST, _FLASH],
        "premium": [_PRO, _GROQ_FAST, _FLASH],
    },
    # Reading images / PDFs of reports
    "vision": {
        "free":    [_FLASH, _GROQ_VISION],
        "premium": [_PRO, _FLASH, _GROQ_VISION],
    },
    # Cheap, fast lookups (medicine info, interactions, classifications)
    "utility": {
        "free":    [_GROQ_FAST, _FLASH],
        "premium": [_GROQ_FAST, _FLASH],
    },
}

# ── Circuit breaker — skip providers that just failed ────────────────────────
_COOLDOWN_DEFAULT = 30.0    # seconds after a 5xx/timeout
_COOLDOWN_RATELIMIT = 60.0  # seconds after a 429 (unless Retry-After says more)
_cooldowns: dict[tuple[str, str], float] = {}
_stats: dict[tuple[str, str], dict] = {}


def _cooling(c: Candidate) -> bool:
    return _cooldowns.get((c.provider, c.model), 0) > time.time()


def _trip(c: Candidate, seconds: float) -> None:
    _cooldowns[(c.provider, c.model)] = time.time() + seconds
    logger.warning(f"Router: cooling {c.provider}/{c.model} for {seconds:.0f}s")


def _record(c: Candidate, ok: bool, ms: int) -> None:
    s = _stats.setdefault((c.provider, c.model), {"ok": 0, "fail": 0, "last_ms": 0})
    s["ok" if ok else "fail"] += 1
    s["last_ms"] = ms


def get_router_status() -> dict:
    """Health snapshot for admin metrics."""
    now = time.time()
    return {
        f"{p}/{m}": {
            **stats,
            "cooling_for_s": max(0, round(_cooldowns.get((p, m), 0) - now)),
        }
        for (p, m), stats in _stats.items()
    }


class AllProvidersFailed(RuntimeError):
    pass


# ── Provider adapters ────────────────────────────────────────────────────────

async def _call_groq_model(
    c: Candidate, prompt: str, system: Optional[str], json_mode: bool,
    file_bytes: Optional[bytes], mime_type: Optional[str],
    max_tokens: int, temperature: float,
) -> str:
    api_key = os.environ["GROQ_API_KEY"]
    content: list = []
    if file_bytes and mime_type and mime_type.startswith("image/"):
        b64 = base64.b64encode(file_bytes).decode()
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64}"}})
    content.append({"type": "text", "text": prompt})

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": content})

    body: dict = {"model": c.model, "messages": messages, "temperature": temperature, "max_tokens": max_tokens}
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            json=body,
        )
    if r.status_code == 429:
        retry_after = float(r.headers.get("retry-after", 0) or 0)
        raise _RateLimited(max(retry_after, _COOLDOWN_RATELIMIT))
    if r.status_code != 200:
        raise RuntimeError(f"Groq {r.status_code}: {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"].strip()


async def _call_gemini_model(
    c: Candidate, prompt: str, system: Optional[str], json_mode: bool,
    file_bytes: Optional[bytes], mime_type: Optional[str],
    max_tokens: int, temperature: float,
) -> str:
    api_key = os.environ["GEMINI_API_KEY"]
    parts: list = [{"text": prompt}]
    if file_bytes and mime_type:
        # Gemini accepts images AND raw PDFs inline — a real capability
        # upgrade over the OpenAI-style image_url path.
        parts.append({"inline_data": {"mime_type": mime_type, "data": base64.b64encode(file_bytes).decode()}})

    body: dict = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    if system:
        body["systemInstruction"] = {"parts": [{"text": system}]}
    if json_mode:
        body["generationConfig"]["responseMimeType"] = "application/json"

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{c.model}:generateContent?key={api_key}"
    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(url, json=body)
    if r.status_code == 429:
        raise _RateLimited(_COOLDOWN_RATELIMIT)
    if r.status_code != 200:
        raise RuntimeError(f"Gemini {r.status_code}: {r.text[:200]}")
    data = r.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError) as e:
        raise RuntimeError(f"Gemini malformed response: {e}")


class _RateLimited(RuntimeError):
    def __init__(self, cooldown: float):
        super().__init__("rate limited")
        self.cooldown = cooldown


_ADAPTERS = {"groq": _call_groq_model, "gemini": _call_gemini_model}
_KEY_ENVS = {"groq": "GROQ_API_KEY", "gemini": "GEMINI_API_KEY"}


def _configured(c: Candidate) -> bool:
    return bool(os.environ.get(_KEY_ENVS[c.provider]))


# ── The routing call ─────────────────────────────────────────────────────────

async def complete(
    prompt: str,
    *,
    task: str = "utility",
    tier: str = "free",
    system: Optional[str] = None,
    json_mode: bool = False,
    file_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    max_tokens: int = 4096,
    temperature: float = 0.1,
) -> str:
    """Route a completion to the best available provider for this task+tier.

    Tries each candidate in the chain: skips unconfigured providers, providers
    in cooldown, and candidates that can't handle the attachment type. Raises
    AllProvidersFailed only when every candidate is exhausted — callers keep
    their existing deterministic fallbacks for that case.
    """
    chain = CHAINS.get(task, CHAINS["utility"]).get(tier if tier in ("free", "premium") else "free")
    needs_vision = bool(file_bytes and mime_type and mime_type.startswith("image/"))
    needs_pdf = bool(file_bytes and mime_type == "application/pdf")

    errors: list[str] = []
    for c in chain:
        if not _configured(c):
            continue
        if needs_vision and not c.vision:
            continue
        if needs_pdf and not c.pdf:
            # Groq can't read raw PDFs — pass text-only to it rather than skip,
            # UNLESS a capable candidate exists later in the chain.
            if any(_configured(x) and x.pdf and not _cooling(x) for x in chain):
                continue
        if _cooling(c):
            continue

        t0 = time.time()
        try:
            fb, mt = (file_bytes, mime_type) if (c.vision or c.pdf) else (None, None)
            text = await _ADAPTERS[c.provider](c, prompt, system, json_mode, fb, mt, max_tokens, temperature)
            ms = int((time.time() - t0) * 1000)
            _record(c, True, ms)
            logger.info(f"Router: {task}/{tier} → {c.provider}/{c.model} ok in {ms}ms")
            return text
        except _RateLimited as e:
            _record(c, False, int((time.time() - t0) * 1000))
            _trip(c, e.cooldown)
            errors.append(f"{c.provider}/{c.model}: rate-limited")
        except Exception as e:
            _record(c, False, int((time.time() - t0) * 1000))
            _trip(c, _COOLDOWN_DEFAULT)
            errors.append(f"{c.provider}/{c.model}: {e}")
            logger.warning(f"Router: {c.provider}/{c.model} failed: {e}")

    raise AllProvidersFailed("All providers failed for task "
                             f"'{task}' (tier {tier}): {' | '.join(errors) or 'no provider configured'}")
