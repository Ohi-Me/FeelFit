"""
FeelFit v4 — LLM Pipeline
Schema-guided generation + context enrichment + constrained output + retry + validation
"""
from __future__ import annotations
import asyncio
import base64
import json
import logging
import re
from typing import List, Optional

import httpx

from schemas.analysis import (
    AnalysisOutput, AbnormalTest, TestStatus, RiskLevel,
    TestTrend, Alert, ExtractedTest, UserProfile
)

logger = logging.getLogger("feelfit.llm")

# ── System Prompt (safety-first) ──────────────────────────────────────────────

SYSTEM_PROMPT = """You are FeelFit Health AI — a medical report interpretation assistant using LOINC-standardized data.

MANDATORY SAFETY RULES (never violate under any circumstance):
1. Provide HEALTH INSIGHTS only — never diagnoses, prescriptions, or clinical judgments
2. BANNED phrases: "you have [disease]", "diagnosed with", "prescribe", "take medication", "disease confirmed", "i diagnose", "treatment is", "you are suffering from"
3. REQUIRED language: "values may suggest", "often associated with", "worth discussing with your doctor", "may indicate"
4. Output ONLY valid JSON matching the schema — no markdown, no preamble, no explanation
5. confidence: 0.85+ if all/most tests extracted cleanly; 0.65 if partial; 0.45 if poor extraction
6. risk_level: LOW = all normal | MODERATE = some mildly abnormal | HIGH = critically abnormal/multiple abnormal
7. urgency: routine | soon | urgent (urgent only if critical values present)
8. Never mention specific drug names or treatment protocols"""

# ── Output Schema Template ─────────────────────────────────────────────────────

OUTPUT_SCHEMA = """{
  "report_type": "string — e.g. Complete Blood Count, Lipid Panel, Thyroid Function Test",
  "summary": "string — 80-200 words, non-diagnostic health insights using safe language",
  "risk_level": "low | moderate | high",
  "confidence": 0.0-1.0,
  "key_findings": ["finding 1", "finding 2", "...max 8"],
  "abnormal_tests": [
    {
      "loinc_code": "string or null",
      "test_name": "string",
      "value": 0.0,
      "unit": "string",
      "normal_range": "min-max unit",
      "status": "low | normal | high | critical",
      "clinical_note": "non-diagnostic context using safe language",
      "specialty": "string"
    }
  ],
  "all_tests": [
    {
      "test_name": "string — exact test name as printed",
      "value": 0.0,
      "unit": "string",
      "normal_min": 0.0,
      "normal_max": 0.0,
      "status": "low | normal | high | critical",
      "category": "panel e.g. CBC, Liver, Kidney, Thyroid, Lipid, Diabetes, Vitamins",
      "specialty": "string"
    }
  ],
  "recommendations": ["general wellness rec 1", "...max 8"],
  "lifestyle_suggestions": ["diet/exercise/sleep suggestion", "...max 6"],
  "diet_tips": ["specific food/diet guidance tied to these findings — max 5, never a medicine or supplement brand/dose"],
  "exercise_tips": ["specific activity guidance tied to these findings — max 5"],
  "habit_tips": ["daily habit/routine guidance — sleep, hydration, stress, screen time — max 5"],
  "follow_up": "string — timeframe and type of follow-up suggested",
  "required_specialization": "string — e.g. Endocrinologist, General Physician",
  "urgency": "routine | soon | urgent",
  "trends": null,
  "alerts": null
}"""


def build_context_prompt(
    text: str,
    tests: List[ExtractedTest],
    profile: Optional[UserProfile],
    trends: Optional[List[TestTrend]],
    evidence_block: Optional[str] = None,
) -> str:
    """
    Context Enrichment: combines extracted data + user profile + trend history.
    Schema-guided: injects exact output schema.
    Grounded: restricts LLM to provided data only.
    """
    tests_data = [t.model_dump() for t in tests[:30]]
    abnormal = [t for t in tests_data if t.get("status") in ("low", "high", "critical")]

    # Build profile context
    profile_ctx = "Not provided"
    if profile:
        parts = []
        if profile.age:
            parts.append(f"Age: {profile.age} years")
        if profile.gender:
            parts.append(f"Gender: {profile.gender}")
        if profile.known_conditions:
            parts.append(f"Known conditions: {', '.join(profile.known_conditions)}")
        if profile.current_medications:
            parts.append(f"Current medications: {', '.join(profile.current_medications)}")
        profile_ctx = " | ".join(parts) or "Not provided"

    # Build trend context
    trend_ctx = "No previous report data available"
    if trends:
        trend_lines = [f"- {t.summary}" for t in trends]
        trend_ctx = "\n".join(trend_lines)

    loinc_count = sum(1 for t in tests_data if t.get("loinc_code"))

    evidence_section = f"\n{evidence_block}\n" if evidence_block else ""

    return f"""You are reading a medical laboratory report. A scan/photo or the text of the
report is provided. Return ONLY the JSON object. No markdown. No explanation. No preamble.
{evidence_section}
═══ HOW TO READ THE REPORT (CRITICAL — COMPLETENESS MATTERS MOST):
- If an image/document is attached, READ THE ENTIRE REPORT YOURSELF, top to bottom, and BOTH the
  LEFT and RIGHT columns. Many reports have two side-by-side columns — read both fully.
- Extract EVERY SINGLE ROW from EVERY panel — do NOT stop after the first few. A typical report has
  30–45 rows. If you output fewer than ~25 tests from a full-page report, you have MISSED some — re-scan.
- Panels and rows you MUST include when present (and their individual rows, even if normal):
  • Hematology/CBC: Hemoglobin, RBC, WBC, Platelets, Hematocrit/PCV, MCV, MCH, MCHC, RDW
  • Diabetes: Fasting/Postprandial/Random sugar, HbA1c, eAG
  • Lipid: Total/LDL/HDL/VLDL cholesterol, Triglycerides, Chol/HDL ratio
  • Liver (LFT): ALT/SGPT, AST/SGOT, ALP, Bilirubin (total & direct), Total Protein, Albumin, Globulin
  • Kidney (KFT): Creatinine, Blood Urea, Uric Acid, eGFR
  • Thyroid: TSH, T3, T4 (and Free T3/T4 if present)
  • Vitamins & Minerals: Vitamin D, Vitamin B12, Ferritin, Iron, Calcium — DO NOT skip this section
- The OCR text and auto-extracted list below are NOISY and INCOMPLETE. Use them only as hints.
  DO NOT limit yourself to them — the actual report image is the source of truth.
- For EACH test, compare its value to the printed reference range and set status:
  low / high / critical / normal. "critical" only for dangerously abnormal values.

═══ OCR TEXT HINT (may be garbled, first 6000 chars):
{text[:6000]}

═══ AUTO-EXTRACTED HINTS ({len(tests_data)} found, {loinc_count} LOINC-matched — likely incomplete):
{json.dumps(tests_data, indent=2)}

═══ PATIENT PROFILE (use for context-aware insights):
{profile_ctx}

═══ TREND ANALYSIS (vs previous report):
{trend_ctx}

═══ INSTRUCTIONS:
- Put EVERY test you can read into "all_tests" (normal ones too), with value, unit, reference range, status.
- Put EVERY out-of-range test into "abnormal_tests" with safe, non-diagnostic clinical_note.
- Do not invent tests or values that are not in the report. Read carefully; do not miss panels.
- Apply the safe-language rules from the system prompt. Fill all required fields.

═══ REQUIRED OUTPUT SCHEMA (return ONLY this JSON, nothing else):
{OUTPUT_SCHEMA}"""


import os

async def call_groq(
    prompt: str,
    file_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    max_tokens: int = 4096,
) -> str:
    """Call Groq API with optional file attachment (PDF/image)."""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY environment variable is not set")

    content = []
    model = "llama-3.3-70b-versatile"

    # Attach file if provided (vision/document grounding)
    if file_bytes and mime_type:
        model = "meta-llama/llama-4-scout-17b-16e-instruct"
        b64 = base64.b64encode(file_bytes).decode()
        if mime_type == "application/pdf":
            # For PDF, if Groq vision doesn't natively support PDF, it's better to pass text
            # But according to spec we try to pass it as an image if it was converted, or as data URI.
            # Assuming the backend converts it to image or we send PDF data URI if Groq supports it.
            # For safety, let's format it as an image URL if it's an image, or drop if it's PDF and rely on text extraction.
            # Actually, standard OpenAI vision takes image_url.
            content.append({
                "type": "text", "text": "Please note this is a PDF report data."
            })
        elif mime_type.startswith("image/"):
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type};base64,{b64}"}
            })

    content.append({"type": "text", "text": prompt})

    async with httpx.AsyncClient(timeout=90.0) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": content}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
                "max_tokens": max_tokens,
            }
        )

    if r.status_code != 200:
        logger.error(f"Groq API Error: {r.text}")
        raise RuntimeError(f"Groq API {r.status_code}: {r.text[:300]}")

    data = r.json()
    try:
        return data["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError) as e:
        logger.error(f"Unexpected Groq response format: {data}")
        raise RuntimeError(f"Invalid Groq response format: {e}")


async def call_groq_search(prompt: str, max_tokens: int = 1024) -> Optional[dict]:
    """
    Groq's own web-search-grounded model (`groq/compound-mini`) — it runs real
    web searches as a tool call and answers from the results, the same idea as
    Gemini's Google Search grounding but on Groq's infrastructure, and doesn't
    depend on the Gemini key at all. Note: it's a wrapper AROUND
    llama-3.3-70b-versatile, so it draws from that model's SAME daily token
    quota, not a separate one — if the account has hit its daily Groq cap, this
    will fail too, same as the plain call. Returns None on any failure (unknown
    model on this account, rate limit, bad JSON) so callers fall back cleanly.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        return None
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                json={
                    "model": "groq/compound-mini",
                    "messages": [{"role": "user", "content": (
                        f"{prompt}\n\nSearch the web to check current, real-world facts before answering — "
                        "especially the product's real name, category and purpose. Respond with ONLY the "
                        "JSON object, no markdown fences, no text before or after it."
                    )}],
                    "temperature": 0.2,
                    "max_tokens": max_tokens,
                },
            )
        if r.status_code != 200:
            logger.warning(f"Groq compound-search {r.status_code}: {r.text[:200]}")
            return None
        data = r.json()
        text = data["choices"][0]["message"]["content"].strip()
        return parse_llm_json(text)
    except Exception as e:
        logger.warning(f"Groq compound-search failed: {e}")
        return None


COPILOT_SYSTEM_PROMPT = """You are AskFit — a warm, knowledgeable health companion. You explain health
clearly and helpfully, like a friendly, well-read doctor friend (not a clinician giving orders).

HOW TO ANSWER:
- Answer the question directly and helpfully in plain, warm language. Lead with the most useful point.
- Use the reference notes when relevant, AND your broad health knowledge to give accurate, practical
  context. This is general health EDUCATION, so it's fine to share well-established facts.
- NEVER say "the retrieved evidence doesn't cover this" or refuse — always give a genuinely useful answer.
- For "what can I do / what foods help / is it serious" questions, give concrete, friendly, practical
  guidance: diet, lifestyle, simple habits, and when it's worth seeing a doctor.
- Personalize to the person's age, gender, conditions, medications, and their own recent results when given.
- In a follow-up, use the conversation so far to understand what "it" / "this" refers to.
- Keep it focused and skimmable: 3-6 short sentences, or 3-5 tight bullet points. You may use simple
  "- " bullets. No markdown headers, no tables, no JSON.

SAFETY (always): health education, never diagnosis or prescription. Use gentle language ("may suggest",
"often helps", "worth discussing with your doctor"). Don't give specific prescription doses. Don't add an
AI disclaimer (one is shown separately). Stay calm, encouraging and kind."""


async def generate_rag_answer(
    query: str,
    evidence_block: str,
    age: Optional[int] = None,
    gender: Optional[str] = None,
    conditions: Optional[List[str]] = None,
    medications: Optional[List[str]] = None,
    history: Optional[List[dict]] = None,
    attachment: Optional[str] = None,
) -> str:
    """
    Generate a warm, helpful health answer. Uses retrieved evidence as reference notes
    plus the model's general health knowledge, grounded in the person's context and the
    ongoing conversation. Plain-text output.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY environment variable is not set")

    ctx_bits: List[str] = []
    if age:
        ctx_bits.append(f"age {age}")
    if gender:
        ctx_bits.append(gender)
    if conditions:
        ctx_bits.append("conditions: " + ", ".join(conditions))
    if medications:
        ctx_bits.append("medications: " + ", ".join(medications))
    patient_ctx = ("\nAbout this person: " + "; ".join(ctx_bits)) if ctx_bits else ""

    # Recent conversation so follow-ups ("what can I do about it?") have context.
    convo = ""
    if history:
        turns = []
        for h in history[-6:]:
            role = "Them" if h.get("role") == "user" else "You"
            turns.append(f"{role}: {h.get('text', '')}")
        if turns:
            convo = "═══ CONVERSATION SO FAR:\n" + "\n".join(turns) + "\n\n"

    attach_block = ""
    if attachment:
        attach_block = (
            "═══ DOCUMENT THE PERSON ATTACHED (a report / prescription / note they uploaded — "
            "read it and answer their question about it):\n" + attachment[:6000] + "\n\n"
        )

    user_content = (
        f"═══ REFERENCE NOTES (use if helpful, plus your own health knowledge):\n{evidence_block}\n\n"
        f"{attach_block}"
        f"{convo}"
        f"═══ THEIR QUESTION:\n{query}{patient_ctx}\n\n"
        f"Give a warm, clear, genuinely helpful answer."
    )

    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": COPILOT_SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                "temperature": 0.4,
                "max_tokens": 650,
            },
        )

    if r.status_code != 200:
        logger.error(f"Groq Copilot error: {r.text[:300]}")
        raise RuntimeError(f"Groq API {r.status_code}")

    data = r.json()
    return data["choices"][0]["message"]["content"].strip()


def parse_llm_json(raw: str) -> dict:
    """Parse JSON from LLM output, handling markdown fences."""
    raw = raw.strip()

    # Strip markdown code fences
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        raw = raw.strip()

    # Extract JSON object
    m = re.search(r"\{.*\}", raw, re.DOTALL)
    if m:
        raw = m.group()

    return json.loads(raw)


def _make_fallback(tests: List[ExtractedTest]) -> AnalysisOutput:
    """
    Graceful fallback when all LLM attempts fail.
    Uses NLP-extracted data to build a basic response.
    """
    abnormal = [t for t in tests if t.status in (TestStatus.LOW, TestStatus.HIGH, TestStatus.CRITICAL)]
    critical = [t for t in abnormal if t.status == TestStatus.CRITICAL]

    risk = RiskLevel.HIGH if critical else RiskLevel.MODERATE if abnormal else RiskLevel.LOW
    specialties = list({t.specialty for t in tests if t.specialty})

    findings = [
        f"{t.test_name}: {t.value} {t.unit} ({t.status.value.upper()})"
        for t in abnormal[:6]
    ]
    if not findings:
        findings = ["Report extracted — consult your healthcare provider for full interpretation"]

    abnormal_models = [
        AbnormalTest(
            loinc_code=t.loinc_code,
            test_name=t.test_name,
            value=t.value,
            unit=t.unit,
            normal_range=f"{t.normal_min}–{t.normal_max} {t.unit}" if t.normal_min is not None else None,
            status=t.status,
            clinical_note=t.clinical_note or "Value outside normal reference range — worth discussing with your doctor.",
            specialty=t.specialty,
        )
        for t in abnormal
    ]

    return AnalysisOutput(
        report_type="Medical Lab Report",
        summary=(
            "Automated extraction completed. Some test values may fall outside reference ranges "
            "as indicated in the table below. These values may warrant attention, though only a "
            "qualified healthcare professional can provide proper interpretation and guidance. "
            "Please consult your doctor to review these results."
        ),
        risk_level=risk,
        confidence=0.40,
        key_findings=findings,
        abnormal_tests=abnormal_models,
        recommendations=["Please consult a qualified healthcare professional for proper interpretation of these results."],
        lifestyle_suggestions=["Maintain a balanced diet, stay hydrated, exercise regularly, and get adequate sleep."],
        follow_up="Schedule an appointment with your doctor to review these results at your earliest convenience.",
        required_specialization=specialties[0] if specialties else "General Physician",
        urgency="soon" if abnormal else "routine",
    )


async def build_rag_evidence(
    tests: List[ExtractedTest],
    profile: Optional[UserProfile],
) -> Optional[str]:
    """
    Build a retrieved-evidence grounding block via Medical RAG 2.0.

    Gated behind ENABLE_RAG so the default flow is byte-for-byte unchanged.
    Any failure (import, retrieval) is swallowed and returns None.
    """
    if os.environ.get("ENABLE_RAG", "").lower() not in ("1", "true", "yes", "on"):
        return None
    try:
        from rag import get_rag

        # Query = abnormal tests first (most informative), else all test names
        focus = [t for t in tests if t.status in (TestStatus.LOW, TestStatus.HIGH, TestStatus.CRITICAL)] or tests
        query = ", ".join(
            f"{t.test_name} {t.value} {t.unit}".strip() for t in focus[:8]
        ) or "general lab report"

        bundle = await get_rag().aretrieve(
            query,
            age=profile.age if profile else None,
            gender=profile.gender if profile else None,
            conditions=list(profile.known_conditions) if profile else None,
            medications=list(profile.current_medications) if profile else None,
        )
        logger.info(
            f"RAG grounding: conf={bundle.confidence():.2f} "
            f"status={bundle.validation_status()} citations={len(bundle.citations())}"
        )
        return bundle.to_prompt_block()
    except Exception as e:
        logger.warning(f"RAG grounding skipped: {e}")
        return None


GEMINI_EXTRACT_PROMPT = """You are reading a medical laboratory report image. Extract EVERY test
from EVERY panel and BOTH columns (Hematology/CBC, Diabetes, Lipid, Liver/LFT, Kidney/KFT,
Thyroid, Vitamins, etc.), including normal ones. A full report has 30-45 rows — do not miss any.

Return ONLY a JSON object: {"all_tests": [
  {"test_name": "...", "value": 0.0, "unit": "...", "normal_min": 0.0, "normal_max": 0.0,
   "status": "low|high|normal", "category": "panel name"}
]}
For each row read the exact value (keep thousands, e.g. 13500 not 13.5), the unit, and the printed
reference range. Set normal_min/normal_max from the range ("<200" -> min 0 max 200; ">40" -> min 40).
Do not invent rows. Return JSON only."""


_NARRATE_SCHEMA = """{
  "report_type": "short label e.g. Comprehensive Health Check, Lipid Panel",
  "summary": "100-180 words, plain-language, non-diagnostic, safe language",
  "recommendations": ["general wellness rec", "...max 5"],
  "lifestyle_suggestions": ["diet/exercise/sleep", "...max 5"],
  "diet_tips": ["specific food/diet guidance tied to THESE findings, e.g. 'Increase iron-rich foods like spinach and lentils' — max 5"],
  "exercise_tips": ["specific activity guidance tied to THESE findings, e.g. 'Add 20 minutes of brisk walking daily' — max 5"],
  "habit_tips": ["daily habit/routine guidance, e.g. sleep, hydration, stress, screen time — max 5"],
  "follow_up": "timeframe + type of follow-up",
  "required_specialization": "e.g. Endocrinologist, Cardiologist",
  "urgency": "routine | soon | urgent"
}"""


async def summarize_from_tests(
    tests: List[ExtractedTest],
    profile: Optional[UserProfile],
    trends: Optional[List["TestTrend"]] = None,
    prev_meta: Optional[dict] = None,
    report_date: Optional[str] = None,
) -> dict:
    """
    Small, reliable LLM call: given an already-extracted test list, write only the
    narrative (summary/recommendations/etc.). No re-extraction, so the JSON stays
    small and valid — used when Gemini/the parser already produced the tests.

    Now context-rich: combines THIS report's findings + the full patient profile +
    previous-report results + a dated timeline, so the verdict is personalised and
    aware of how values are changing over time.
    """
    abn = [t for t in tests if t.status in (TestStatus.LOW, TestStatus.HIGH, TestStatus.CRITICAL)]
    lines = [
        f"- {t.test_name}: {t.value} {t.unit} [{t.status.value.upper()}] (ref {t.normal_min}-{t.normal_max})"
        for t in abn[:40]
    ]

    # ── Full patient profile ──────────────────────────────────────────────────────
    ctx = []
    if profile and profile.age: ctx.append(f"age {profile.age}")
    if profile and profile.gender: ctx.append(profile.gender)
    if profile and profile.known_conditions: ctx.append("conditions: " + ", ".join(profile.known_conditions))
    if profile and profile.current_medications: ctx.append("medications: " + ", ".join(profile.current_medications))
    profile_line = ", ".join(ctx) or "not provided"

    # ── Timeline + previous report ────────────────────────────────────────────────
    timeline = []
    if report_date:
        timeline.append(f"This report is dated {report_date}.")
    if prev_meta:
        pd = prev_meta.get("date")
        bits = []
        if pd: bits.append(f"dated {pd}")
        if prev_meta.get("report_type"): bits.append(prev_meta["report_type"])
        if prev_meta.get("abnormal_count") is not None:
            bits.append(f"{prev_meta['abnormal_count']} value(s) out of range")
        timeline.append("Previous report: " + (", ".join(bits) or "on record") + ".")
        if prev_meta.get("key_findings"):
            timeline.append("Previously notable: " + "; ".join(prev_meta["key_findings"]) + ".")
    timeline_block = "\n".join(timeline) or "No earlier report on record."

    # ── Trend movement (this vs previous) ─────────────────────────────────────────
    trend_block = "No comparable previous values."
    if trends:
        tl = [f"- {getattr(t, 'summary', str(t))}" for t in trends[:12]]
        if tl:
            trend_block = "\n".join(tl)

    prompt = (
        f"You are writing a calm, encouraging, NON-diagnostic health summary for a person reading "
        f"their own lab report.\n\n"
        f"PATIENT: {profile_line}.\n\n"
        f"TIMELINE:\n{timeline_block}\n\n"
        f"HOW VALUES ARE CHANGING (vs previous report):\n{trend_block}\n\n"
        f"THIS REPORT — abnormal findings ({len(abn)}):\n"
        + ("\n".join(lines) or "None — all values are within range.") +
        f"\n\nUsing ALL of the context above (profile, medications, the timeline, and how values "
        f"have moved since the last report), write a warm, plain, educational summary and guidance. "
        f"When a previous report exists, explicitly mention whether things look better, stable, or "
        f"worth watching, and reference the dates. Be supportive and specific, never alarming. "
        f"Use safe language ('may suggest', 'worth discussing with your doctor'). "
        f"For diet_tips/exercise_tips/habit_tips: be concrete and specific to THESE findings (name "
        f"actual foods, activities, durations), but NEVER name a medicine, supplement brand, dosage, "
        f"or anything requiring a prescription — that always stays with 'worth discussing with your doctor'. "
        f"Return ONLY this JSON:\n{_NARRATE_SCHEMA}"
    )
    try:
        raw = await call_groq(prompt, max_tokens=1600)
        return parse_llm_json(raw)
    except Exception as e:
        logger.warning(f"Narration failed, using basic summary: {e}")
        return {
            "report_type": "Comprehensive Health Check",
            "summary": (
                f"The report shows {len(abn)} value(s) outside the typical reference range. "
                "These may warrant attention, but only a qualified healthcare professional can "
                "provide proper interpretation. Please consult your doctor to review these results."
            ),
            "recommendations": ["Discuss these results with a qualified doctor."],
            "lifestyle_suggestions": ["Maintain a balanced diet, regular activity, and adequate sleep."],
            "diet_tips": ["Eat a balanced diet rich in fruits, vegetables, and whole grains."],
            "exercise_tips": ["Aim for at least 150 minutes of moderate activity per week."],
            "habit_tips": ["Prioritise 7-8 hours of sleep and stay well hydrated."],
            "follow_up": "Schedule a follow-up with your doctor to review these results.",
            "required_specialization": "General Physician",
            "urgency": "soon" if abn else "routine",
        }


async def gemini_extract_tests(file_bytes: bytes, mime_type: str) -> Optional[List[dict]]:
    """
    Extract the full test list from a report image/PDF using Google Gemini vision.
    Gemini reads 2D table layouts natively (far better than OCR on dense reports).
    Returns sanitized ExtractedTest dicts, or None if no key / failure.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    # Downscale large photos before upload — faster, and 1800px is plenty for Gemini to read a report.
    send_bytes, mt = file_bytes, (mime_type or "image/png")
    if mime_type == "application/pdf":
        mt = "application/pdf"
    else:
        try:
            from PIL import Image
            import io as _io
            im = Image.open(_io.BytesIO(file_bytes)).convert("RGB")
            w, h = im.size
            if max(w, h) > 1800:
                sc = 1800 / max(w, h)
                im = im.resize((int(w * sc), int(h * sc)))
            buf = _io.BytesIO()
            im.save(buf, "JPEG", quality=88)
            send_bytes, mt = buf.getvalue(), "image/jpeg"
        except Exception as e:
            logger.warning(f"Gemini image downscale skipped: {e}")
    b64 = base64.b64encode(send_bytes).decode()
    body = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mt, "data": b64}},
            {"text": GEMINI_EXTRACT_PROMPT},
        ]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 8192,
            # Disable 2.5-flash "thinking": much faster, and prevents the answer
            # from being truncated by thinking tokens.
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    # Only 2 attempts, short fixed backoff — this is a "premium accuracy" extra on
    # top of the free parser/LLM path, not a hard dependency, so it must fail fast
    # rather than stall the whole analysis. 429 (quota/rate-limit) is NOT retried:
    # it means the key's quota is exhausted right now, so a retry a few seconds
    # later won't succeed either — it previously cost ~17s of pure backoff before
    # falling back, which was the actual cause of "the last steps take forever".
    for attempt in range(1, 3):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                r = await client.post(url, json=body)
            if r.status_code == 200:
                data = r.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = parse_llm_json(text)
                tests = _sanitize_all_tests(parsed.get("all_tests"))
                logger.info(f"Gemini extracted {len(tests or [])} tests (attempt {attempt})")
                return tests
            logger.warning(f"Gemini extract HTTP {r.status_code} (attempt {attempt}): {r.text[:160]}")
            if r.status_code == 429:
                logger.warning("Gemini quota/rate-limit hit — falling back without retry. "
                                "Check quota at https://aistudio.google.com/apikey")
                return None
            if r.status_code not in (500, 503):  # only 500/503 are worth a quick retry
                return None
        except Exception as e:
            logger.warning(f"Gemini extract error (attempt {attempt}): {e}")
        await asyncio.sleep(1)
    return None


def _sanitize_all_tests(raw_list) -> Optional[List[dict]]:
    """
    Coerce the LLM's `all_tests` into valid ExtractedTest dicts.
    Drops rows without a name or numeric value; fills required `raw_name`;
    computes deviation_percent so the UI bar chart works.
    """
    if not isinstance(raw_list, list):
        return None
    valid_status = {"low", "normal", "high", "critical"}
    out: List[dict] = []
    for t in raw_list:
        if not isinstance(t, dict):
            continue
        name = str(t.get("test_name") or "").strip()
        if not name:
            continue
        try:
            value = float(t.get("value"))
        except (TypeError, ValueError):
            continue
        llm_status = str(t.get("status") or "normal").lower()
        if llm_status not in valid_status:
            llm_status = "normal"
        nmin = t.get("normal_min")
        nmax = t.get("normal_max")
        try:
            nmin = float(nmin) if nmin not in (None, "") else None
        except (TypeError, ValueError):
            nmin = None
        try:
            nmax = float(nmax) if nmax not in (None, "") else None
        except (TypeError, ValueError):
            nmax = None

        # Recompute status DETERMINISTICALLY from the reference bounds — the LLM
        # often under-flags ranges like "<5.7" or ">40". Code never misses one.
        status = llm_status
        if nmax is not None and value > nmax:
            status = "high"
        elif nmin is not None and value < nmin:
            status = "low"
        elif nmin is not None or nmax is not None:
            status = "normal"
        # preserve a model-flagged 'critical' when the value really is out of range
        if llm_status == "critical" and status in ("high", "low"):
            status = "critical"

        # deviation vs the nearest breached bound
        deviation = None
        if nmax is not None and value > nmax and nmax != 0:
            deviation = round((value - nmax) / nmax * 100, 1)
        elif nmin is not None and value < nmin and nmin != 0:
            deviation = round((value - nmin) / nmin * 100, 1)
        out.append({
            "loinc_code": t.get("loinc_code"),
            "test_name": name,
            "raw_name": name,
            "value": value,
            "unit": str(t.get("unit") or ""),
            "normal_min": nmin,
            "normal_max": nmax,
            "status": status,
            "deviation_percent": deviation,
            "category": t.get("category"),
            "specialty": t.get("specialty"),
        })
    return out or None


async def run_llm_pipeline(
    text: str,
    tests: List[ExtractedTest],
    profile: Optional[UserProfile],
    trends: Optional[List[TestTrend]],
    file_bytes: Optional[bytes] = None,
    mime_type: Optional[str] = None,
    max_retries: int = 3
) -> tuple[AnalysisOutput, bool]:
    """
    Run LLM pipeline with retry logic.
    Returns (AnalysisOutput, fallback_used: bool)
    
    Retry strategy:
    - Attempt 1: with file attachment (vision grounding)
    - Attempt 2: text-only prompt (faster)
    - Attempt 3: simplified prompt
    """
    # ── Medical RAG 2.0 (optional, env-gated) ───────────────────────────────
    # When ENABLE_RAG=1, ground the LLM in retrieved evidence instead of model
    # memory alone. Failure is non-fatal — we fall back to the ungrounded prompt.
    evidence_block = await build_rag_evidence(tests, profile)

    prompt = build_context_prompt(text, tests, profile, trends, evidence_block)

    for attempt in range(1, max_retries + 1):
        try:
            # Only attach file on first attempt (expensive)
            fb = file_bytes if attempt == 1 else None
            mt = mime_type if attempt == 1 else None

            raw = await call_groq(prompt, fb, mt)
            parsed = parse_llm_json(raw)

            # Inject computed trends if LLM omitted them
            if trends and not parsed.get("trends"):
                parsed["trends"] = [t.model_dump() for t in trends]

            # Sanitize the LLM's full test list so it satisfies the ExtractedTest schema
            parsed["all_tests"] = _sanitize_all_tests(parsed.get("all_tests"))

            output = AnalysisOutput(**parsed)
            logger.info(
                f"LLM success attempt={attempt} "
                f"risk={output.risk_level} conf={output.confidence:.2f}"
            )
            return output, False

        except json.JSONDecodeError as e:
            logger.warning(f"LLM attempt {attempt} JSON parse fail: {e}")
        except ValueError as e:
            logger.warning(f"LLM attempt {attempt} schema validation fail: {e}")
        except Exception as e:
            logger.error(f"LLM attempt {attempt} call error: {e}")
            if attempt == max_retries:
                break

        if attempt < max_retries:
            await asyncio.sleep(1.5 * attempt)

    logger.warning("All LLM attempts failed — using fallback analysis")
    return _make_fallback(tests), True


async def gemini_read_text(file_bytes: bytes, mime_type: str) -> Optional[str]:
    """
    Transcribe ALL readable text from any document/image (lab report, prescription,
    consultant note, discharge summary) using Gemini vision. Used by AskFit so users
    can attach a doc and ask questions about it. Returns plain text, or None.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    send_bytes, mt = file_bytes, (mime_type or "image/png")
    if mime_type == "application/pdf":
        mt = "application/pdf"
    else:
        try:
            from PIL import Image
            import io as _io
            im = Image.open(_io.BytesIO(file_bytes)).convert("RGB")
            w, h = im.size
            if max(w, h) > 1800:
                sc = 1800 / max(w, h)
                im = im.resize((int(w * sc), int(h * sc)))
            buf = _io.BytesIO()
            im.save(buf, "JPEG", quality=88)
            send_bytes, mt = buf.getvalue(), "image/jpeg"
        except Exception as e:
            logger.warning(f"Gemini read_text downscale skipped: {e}")
    b64 = base64.b64encode(send_bytes).decode()
    prompt = (
        "Transcribe ALL readable text from this medical document exactly as written — "
        "every test name, value, unit, reference range, date, doctor's note and instruction. "
        "Preserve the structure. Return ONLY the transcribed text, no commentary."
    )
    body = {
        "contents": [{"parts": [
            {"inline_data": {"mime_type": mt, "data": b64}},
            {"text": prompt},
        ]}],
        "generationConfig": {"temperature": 0.0, "maxOutputTokens": 4096, "thinkingConfig": {"thinkingBudget": 0}},
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(url, json=body)
        if r.status_code != 200:
            logger.warning(f"Gemini read_text {r.status_code}: {r.text[:160]}")
            return None
        data = r.json()
        parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
        return "".join(p.get("text", "") for p in parts).strip() or None
    except Exception as e:
        logger.warning(f"Gemini read_text failed: {e}")
        return None


async def gemini_generate_json_grounded(system: str, prompt: str, max_tokens: int = 1024) -> Optional[dict]:
    """
    Gemini call with Google Search grounding enabled — the model actually runs
    real Google searches and bases its answer on the results, instead of only
    its training-data memory. This is the officially supported way to get
    search-backed answers from Gemini (not scraping search result pages, which
    would violate Google's ToS); it's what powers products like new/obscure
    supplements or brand names a plain LLM call would otherwise have to guess
    at or hallucinate (e.g. a newly-launched product not in training data).

    Structured JSON mode and the search tool can't both be forced in the same
    request, so we ask for JSON via the prompt instead and parse leniently.
    Returns None on any failure so callers fall back to the ungrounded path.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [{"text": (
            f"{system}\n\n{prompt}\n\n"
            "Use Google Search to check current, real-world facts before answering — especially "
            "the product's real name, category and purpose, since a wrong guess here is worse than "
            "admitting uncertainty. Respond with ONLY the JSON object, no markdown fences, no text "
            "before or after it."
        )}]}],
        "tools": [{"google_search": {}}],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": max_tokens,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            r = await client.post(url, json=body)
        if r.status_code != 200:
            logger.warning(f"Gemini grounded search {r.status_code}: {r.text[:160]}")
            return None
        data = r.json()
        candidate = data["candidates"][0]
        text = "".join(p.get("text", "") for p in candidate["content"]["parts"])
        parsed = parse_llm_json(text)
        # Surface which real queries/pages grounded the answer, when Gemini returns them.
        grounding = candidate.get("groundingMetadata", {})
        queries = grounding.get("webSearchQueries") or []
        chunks = grounding.get("groundingChunks") or []
        sources = [c.get("web", {}).get("title") or c.get("web", {}).get("uri") for c in chunks if c.get("web")]
        if queries or sources:
            parsed["_grounding"] = {"queries": queries, "sources": [s for s in sources if s][:5]}
        return parsed
    except Exception as e:
        logger.warning(f"Gemini grounded search failed: {e}")
        return None


async def gemini_generate_json(system: str, prompt: str, max_tokens: int = 1024) -> Optional[dict]:
    """
    Text-only Gemini call returning parsed JSON — used as a second opinion when
    Groq comes back thin/empty (e.g. an obscure or India-only medicine Groq's
    training data underrepresents). Returns None on any failure so callers can
    fall back to whatever they already have rather than erroring out.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = {
        "contents": [{"parts": [{"text": f"{system}\n\n{prompt}"}]}],
        "generationConfig": {
            "response_mime_type": "application/json",
            "temperature": 0.2,
            "maxOutputTokens": max_tokens,
            "thinkingConfig": {"thinkingBudget": 0},
        },
    }
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            r = await client.post(url, json=body)
        if r.status_code != 200:
            logger.warning(f"Gemini generate_json {r.status_code}: {r.text[:160]}")
            return None
        data = r.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return parse_llm_json(text)
    except Exception as e:
        logger.warning(f"Gemini generate_json failed: {e}")
        return None
