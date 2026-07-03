"""
FeelFit v7 — Medicine Service
Provides: drug info, dosage guidance, side effects, warnings, interaction checks
Safety: General health education only — never prescribes, never replaces a pharmacist
"""
from __future__ import annotations
import json
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger("feelfit.medicine")

# ── System Prompt ──────────────────────────────────────────────────────────────
MEDICINE_SYSTEM = """You are FeelFit Medicine AI — a general health education assistant.

STRICT SAFETY RULES:
1. Provide EDUCATIONAL information only — never prescribe, never recommend starting/stopping medicines
2. BANNED phrases: "you should take", "prescribe", "stop taking", "increase dose", "i recommend taking"
3. REQUIRED language: "generally used for", "commonly associated with", "worth discussing with your pharmacist/doctor"
4. Output ONLY valid JSON — no markdown, no preamble
5. Always recommend consulting a healthcare professional for any medicine questions"""

MEDICINE_PROMPT = """Provide educational information about this medicine: "{medicine_name}"
{context_note}

Return ONLY this JSON (no markdown, no extra text):
{{
  "name": "canonical medicine name",
  "generic_name": "generic/INN name if different",
  "drug_class": "e.g. SSRI, Beta-blocker, Statin",
  "commonly_used_for": ["condition 1", "condition 2"],
  "how_it_works": "brief plain-language mechanism (1-2 sentences, educational only)",
  "typical_dosage_info": "general educational info about dosage forms only — NOT a prescription",
  "common_side_effects": ["side effect 1", "side effect 2", "up to 6"],
  "serious_side_effects": ["serious effect 1", "serious effect 2 — seek medical attention"],
  "general_warnings": ["warning 1", "warning 2"],
  "food_interactions": ["avoid grapefruit", "take with food", etc — educational],
  "storage": "general storage info",
  "otc_or_prescription": "OTC | Prescription | Both",
  "drug_category": "Antibiotic | Antihypertensive | Antidiabetic | Cardiovascular | Thyroid | Pain | Supplement | Other",
  "typical_price_inr": "approximate India retail price range for a standard strip/bottle, e.g. '₹20 - ₹45 for a strip of 10 tablets' — your best general estimate, clearly a ballpark not a quote",
  "confidence": 0.0-1.0
}}"""

INTERACTION_SYSTEM = """You are FeelFit Drug Interaction AI. Provide educational information about potential drug interactions.
RULES: Educational only. Never advise stopping medicines. Always recommend consulting pharmacist/doctor. Return only JSON."""

INTERACTION_PROMPT = """Provide educational information about potential interactions between these medicines: {medicine_list}

Return ONLY this JSON:
{{
  "medicines_checked": ["med1", "med2"],
  "interactions": [
    {{
      "medicine_a": "name",
      "medicine_b": "name",
      "severity": "minor | moderate | major | unknown",
      "description": "plain-language educational description",
      "general_advice": "e.g. worth discussing with your pharmacist"
    }}
  ],
  "overall_note": "general educational note about this combination",
  "disclaimer": "This is general educational information only. Always consult your doctor or pharmacist about your specific medications."
}}"""


def _looks_thin(result: dict) -> bool:
    """True when the result doesn't really tell the user anything useful —
    triggers the Gemini second-opinion pass below."""
    return not (result.get("how_it_works") or result.get("commonly_used_for"))


async def get_medicine_info(
    medicine_name: str,
    user_conditions: Optional[list] = None,
    prefer_grounded: bool = False,
) -> dict:
    """
    Fetch educational medicine information via LLM.
    Returns structured dict with drug info, side effects, warnings.

    prefer_grounded=True is the important branch: it's set by the caller when
    RxNorm/OpenFDA found NOTHING for this name — meaning it's not a
    US-regulated drug we have authoritative data for, so it's genuinely
    unfamiliar (a new/obscure supplement, an India-only brand, etc). That's
    exactly the case where a plain Groq call is most likely to confidently
    hallucinate a wrong category/purpose instead of admitting it doesn't know
    (structurally "complete" answers pass the thin-result check even when
    factually wrong, so that check alone can't catch this). So for unfamiliar
    names we try Gemini WITH Google Search grounding FIRST — it checks real
    current search results instead of guessing from model memory — falling
    back to Groq, then plain Gemini, then a generic stub.

    For the common case (prefer_grounded=False — live data already found
    something, we're just filling gaps), Groq first is faster and just as
    accurate, so grounding is only reached as a fallback when Groq is thin.
    """
    context = ""
    if user_conditions:
        context = f"\nPatient has these conditions (for context only): {', '.join(user_conditions)}"

    prompt = MEDICINE_PROMPT.format(medicine_name=medicine_name.strip(), context_note=context)

    async def try_groq() -> Optional[dict]:
        try:
            from llm.pipeline import call_groq, parse_llm_json
            raw = await call_groq(f"{MEDICINE_SYSTEM}\n\n{prompt}")
            result = parse_llm_json(raw)
            result["query"] = medicine_name
            return result
        except json.JSONDecodeError as e:
            logger.error(f"Medicine JSON parse error: {e}")
        except Exception as e:
            logger.error(f"Medicine info error: {e}")
        return None

    async def try_grounded() -> Optional[dict]:
        # Two search-grounded routes, tried in order, so this doesn't depend
        # on the Gemini key alone. Note Groq's compound-mini shares Groq's
        # daily token quota with the plain call above, so on a day that quota
        # is exhausted, both Groq routes fail together and only Gemini (a
        # separate account/quota) can still answer.
        try:
            from llm.pipeline import call_groq_search
            result = await call_groq_search(f"{MEDICINE_SYSTEM}\n\n{prompt}", max_tokens=900)
            if result and not _looks_thin(result):
                result["query"] = medicine_name
                result["ai_source"] = "groq_search"
                return result
        except Exception as e:
            logger.warning(f"Groq compound-search medicine lookup failed: {e}")

        try:
            from llm.pipeline import gemini_generate_json_grounded
            result = await gemini_generate_json_grounded(MEDICINE_SYSTEM, prompt, max_tokens=900)
            if result:
                result["query"] = medicine_name
                result["ai_source"] = "gemini_search"
            return result
        except Exception as e:
            logger.warning(f"Gemini grounded-search medicine lookup failed: {e}")
            return None

    groq_result: Optional[dict] = None
    grounded_result: Optional[dict] = None

    if prefer_grounded:
        grounded_result = await try_grounded()
        if grounded_result is not None and not _looks_thin(grounded_result):
            return grounded_result
        groq_result = await try_groq()
        if groq_result is not None and not _looks_thin(groq_result):
            return groq_result
    else:
        groq_result = await try_groq()
        if groq_result is not None and not _looks_thin(groq_result):
            return groq_result
        grounded_result = await try_grounded()
        if grounded_result is not None and not _looks_thin(grounded_result):
            return grounded_result

    gemini_result: Optional[dict] = None
    try:
        from llm.pipeline import gemini_generate_json
        gemini_result = await gemini_generate_json(MEDICINE_SYSTEM, prompt, max_tokens=900)
        if gemini_result and not _looks_thin(gemini_result):
            gemini_result["query"] = medicine_name
            gemini_result["ai_source"] = "gemini"
            return gemini_result
    except Exception as e:
        logger.warning(f"Gemini medicine backup failed: {e}")
        gemini_result = None

    # Every provider either errored or came back thin. Rather than a bare
    # error the user can't act on, return the richest partial result we have —
    # or, if ALL providers failed outright (no dict at all, e.g. every API is
    # down/rate-limited), a generic educational stub so the UI always has
    # something to show and can point the user to a pharmacist instead.
    for candidate, source in ((groq_result, None), (grounded_result, "gemini_search"), (gemini_result, "gemini")):
        if candidate is not None:
            candidate["query"] = medicine_name
            if source:
                candidate["ai_source"] = source
            return candidate

    return {
        "query": medicine_name,
        "name": medicine_name,
        "generic_name": "",
        "drug_class": "",
        "commonly_used_for": [],
        "how_it_works": "",
        "typical_dosage_info": "",
        "common_side_effects": [],
        "serious_side_effects": [],
        "general_warnings": ["We couldn't look this one up right now — our AI lookup is temporarily unavailable."],
        "food_interactions": [],
        "storage": "",
        "otc_or_prescription": "Unknown",
        "drug_category": "Other",
        "typical_price_inr": "",
        "confidence": 0.0,
        "ai_source": "unavailable",
    }


async def check_drug_interactions(medicines: list[str]) -> dict:
    """
    Educational drug interaction checker for a list of medicines.
    Returns interaction pairs with severity and plain-language notes.
    """
    if len(medicines) < 2:
        return {
            "medicines_checked": medicines,
            "interactions": [],
            "overall_note": "Please provide at least 2 medicines to check interactions.",
            "disclaimer": "Always consult your pharmacist or doctor about your medications."
        }

    prompt = INTERACTION_PROMPT.format(medicine_list=", ".join(medicines))

    try:
        from llm.pipeline import call_groq, parse_llm_json
        raw = await call_groq(f"{INTERACTION_SYSTEM}\n\n{prompt}")
        return parse_llm_json(raw)

    except Exception as e:
        logger.error(f"Interaction check error: {e}")
        return {
            "medicines_checked": medicines,
            "interactions": [],
            "overall_note": "Could not check interactions at this time.",
            "disclaimer": "Always consult your pharmacist or doctor about your medications.",
            "error": str(e)
        }
