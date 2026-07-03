"""
FeelFit — "Move One Number" Focus engine.

The audit's core insight: people don't pay to understand a report — they pay to
*improve one number and see proof*. This engine turns a pile of abnormal values
into ONE primary focus: the highest-leverage biomarker to move this cycle, with a
plain target, the reason it matters, a short evidence-based action plan, and a
retest date. Deterministic and non-diagnostic by design (no LLM thresholds).

Priority reflects India's cardiometabolic burden and what is realistically
reversible through behaviour in ~8–12 weeks. Deficiencies rank high because they
are the fastest, most motivating first win — proof the loop works.
"""
from __future__ import annotations

from datetime import datetime, timedelta

# canonical → focus definition. Ordered by strategic priority (first match wins
# among abnormal biomarkers). Each: condition, why, target, plan, retest weeks.
_FOCUS_DEFS: list[dict] = [
    {
        "canonical": "hba1c", "condition": "Blood sugar control", "retest_weeks": 12,
        "target": "Bring HbA1c toward < 5.7%",
        "why": "HbA1c reflects your average blood sugar over ~3 months. Nudging it down is the single biggest lever for long-term metabolic health and energy.",
        "plan": [
            "Walk 10–15 minutes after each main meal — it blunts the post-meal sugar spike.",
            "Swap refined carbs (white rice, maida) for whole grains, millets and more dal/veg.",
            "Build each plate around protein + fibre first, carbs last.",
            "Aim for 7–8k steps and 2 short strength sessions a week.",
        ],
    },
    {
        "canonical": "fasting_glucose", "condition": "Fasting blood sugar", "retest_weeks": 10,
        "target": "Bring fasting glucose toward < 100 mg/dL",
        "why": "A raised fasting sugar is an early, very reversible warning sign — small daily habits move it fast.",
        "plan": [
            "A 10–15 minute walk after dinner steadies overnight sugar.",
            "Cut sugary drinks and late-night refined snacks.",
            "Front-load protein and fibre at every meal.",
            "Protect 7+ hours of sleep — poor sleep raises fasting sugar.",
        ],
    },
    {
        "canonical": "triglycerides", "condition": "Triglycerides", "retest_weeks": 10,
        "target": "Bring triglycerides toward < 150 mg/dL",
        "why": "Triglycerides respond quickly to diet and movement — one of the easiest lipid numbers to improve.",
        "plan": [
            "Cut added sugar, sweets and refined carbs — the biggest triglyceride driver.",
            "Reduce fried foods; add omega-3s (fish, flax, walnuts).",
            "Brisk activity 30 min most days.",
            "Limit alcohol.",
        ],
    },
    {
        "canonical": "ldl", "condition": "LDL cholesterol", "retest_weeks": 12,
        "target": "Lower LDL toward your doctor's goal (often < 100 mg/dL)",
        "why": "LDL is a leading driver of long-term heart risk. Diet and activity can meaningfully lower it.",
        "plan": [
            "Add soluble fibre — oats, beans, fruit, vegetables.",
            "Swap saturated fats (ghee, fried, processed) for nuts, seeds and oily fish.",
            "30 minutes of brisk activity most days.",
            "If already advised medication, take it consistently and discuss progress.",
        ],
    },
    {
        "canonical": "sgpt_alt", "condition": "Liver health (fatty liver)", "retest_weeks": 12,
        "target": "Bring SGPT/ALT back into range",
        "why": "A raised SGPT often points to early fatty liver — one of the most reversible conditions through weight and diet.",
        "plan": [
            "Cut sugar, refined carbs and alcohol — the main fatty-liver drivers.",
            "Even 5–7% weight loss can normalise liver enzymes.",
            "Daily brisk walking + 2 strength sessions a week.",
            "Build meals around vegetables, protein and whole grains.",
        ],
    },
    {
        "canonical": "vitamin_d", "condition": "Vitamin D", "retest_weeks": 10,
        "target": "Restore Vitamin D into the healthy range",
        "why": "Low Vitamin D is extremely common and easy to fix — and correcting it often lifts energy, mood and immunity within weeks. A great first win.",
        "plan": [
            "15–20 minutes of midday sunlight on arms/face most days.",
            "Discuss a Vitamin D supplement dose with your doctor or pharmacist.",
            "Add fortified foods, eggs and (if you eat it) oily fish.",
            "Pair with adequate calcium and magnesium.",
        ],
    },
    {
        "canonical": "vitamin_b12", "condition": "Vitamin B12", "retest_weeks": 10,
        "target": "Restore B12 into the healthy range",
        "why": "Low B12 quietly causes fatigue, brain fog and tingling — and is very fixable, especially on vegetarian diets.",
        "plan": [
            "Discuss a B12 supplement or course with your doctor.",
            "Add dairy, eggs and fortified foods (or B12-fortified options if vegetarian).",
            "Recheck after the course to confirm it's back up.",
        ],
    },
    {
        "canonical": "ferritin", "condition": "Iron stores", "retest_weeks": 10,
        "target": "Rebuild iron stores (ferritin) into range",
        "why": "Low iron stores are a leading cause of tiredness and breathlessness — and respond well to diet and supplements.",
        "plan": [
            "Add iron-rich foods — leafy greens, legumes, dates, (if you eat it) lean meat.",
            "Pair iron foods with Vitamin C (lemon, amla) to absorb more.",
            "Avoid tea/coffee right after meals — they block iron absorption.",
            "Discuss an iron supplement with your doctor.",
        ],
    },
    {
        "canonical": "hemoglobin", "condition": "Anemia (low hemoglobin)", "retest_weeks": 8,
        "target": "Raise hemoglobin back into the healthy range",
        "why": "Low hemoglobin means less oxygen carried around the body — fixing it restores energy and focus.",
        "plan": [
            "Iron-rich meals + Vitamin C to boost absorption.",
            "Avoid tea/coffee with meals.",
            "Discuss the cause and any iron supplement with your doctor.",
        ],
    },
    {
        "canonical": "tsh", "condition": "Thyroid (TSH)", "retest_weeks": 8,
        "target": "Bring TSH into the healthy range",
        "why": "Thyroid affects metabolism, weight, mood and energy. Tracking TSH over time keeps it well-managed.",
        "plan": [
            "If prescribed thyroid medication, take it consistently, same time daily, empty stomach.",
            "Keep a steady sleep and activity routine.",
            "Recheck TSH on the schedule your doctor advises.",
        ],
    },
    {
        "canonical": "uric_acid", "condition": "Uric acid", "retest_weeks": 8,
        "target": "Bring uric acid into range",
        "why": "High uric acid can cause joint pain/gout — and responds well to hydration and diet.",
        "plan": [
            "Drink more water through the day.",
            "Cut sugary drinks, red meat and organ meats.",
            "Limit alcohol, especially beer.",
        ],
    },
    {
        "canonical": "creatinine", "condition": "Kidney function", "retest_weeks": 8,
        "target": "Discuss kidney markers with your doctor and recheck",
        "why": "Creatinine reflects kidney function — worth monitoring and discussing rather than self-treating.",
        "plan": [
            "Stay well hydrated unless your doctor has advised otherwise.",
            "Review any medications or supplements with your doctor.",
            "Manage blood pressure and blood sugar, which protect the kidneys.",
        ],
    },
]
_ORDER = {d["canonical"]: i for i, d in enumerate(_FOCUS_DEFS)}
_DEF_BY_KEY = {d["canonical"]: d for d in _FOCUS_DEFS}


def retest_status(retest_date_iso: str | None) -> dict:
    """Days until the retest + a simple state for the reminder UI."""
    if not retest_date_iso:
        return {"days_left": None, "state": "none"}
    try:
        d = datetime.fromisoformat(retest_date_iso).date()
    except Exception:
        return {"days_left": None, "state": "none"}
    days = (d - datetime.now().date()).days
    state = "overdue" if days < 0 else "due" if days <= 7 else "upcoming"
    return {"days_left": days, "state": state}


def daily_action(focus: dict | None) -> dict:
    """One concrete thing to do today — rotated from the focus plan, with a fallback."""
    fallback = {
        "title": "Move your body today",
        "text": "A 20–30 minute brisk walk is the simplest win for almost every health number.",
    }
    if not focus or not focus.get("plan"):
        return fallback
    plan = focus["plan"]
    idx = datetime.now().timetuple().tm_yday % len(plan)
    return {"title": f"Today, for your {focus.get('label', 'health')}", "text": plan[idx]}


def _is_abnormal(reading: dict) -> bool:
    return (reading.get("status") or "").lower() in ("low", "high", "critical")


def pick_focus(latest: dict[str, dict]) -> dict | None:
    """
    Given the latest reading per canonical biomarker, choose the single highest-
    priority abnormal biomarker and return a full focus object. None if all good.
    """
    candidates = [
        (key, r) for key, r in latest.items()
        if key in _DEF_BY_KEY and _is_abnormal(r)
    ]
    if not candidates:
        return None
    # Critical first, then strategic priority order.
    candidates.sort(key=lambda kr: (
        0 if (kr[1].get("status") or "").lower() == "critical" else 1,
        _ORDER.get(kr[0], 999),
    ))
    key, reading = candidates[0]
    d = _DEF_BY_KEY[key]
    today = datetime.now().date()
    retest = today + timedelta(weeks=d["retest_weeks"])
    from services.health_store import label_for
    return {
        "canonical": key,
        "label": label_for(key),
        "condition": d["condition"],
        "current_value": reading.get("value"),
        "unit": reading.get("unit"),
        "status": reading.get("status"),
        "ref_min": reading.get("ref_min"),
        "ref_max": reading.get("ref_max"),
        "target": d["target"],
        "why": d["why"],
        "plan": d["plan"],
        "retest_weeks": d["retest_weeks"],
        "start_date": today.isoformat(),
        "retest_date": retest.isoformat(),
        "other_flags": [label_for(k) for k, _ in candidates[1:5]],
    }
