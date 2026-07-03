"""
FeelFit — 90-day "Move One Number" program + outcome proof.

Turns a focus biomarker into a structured 90-day journey (phases, weekly actions,
milestones, retest) and — most importantly — computes PROOF: when a newer report
or vital shows the focus number moving toward its target, FeelFit can say
"your HbA1c dropped 6.8 → 6.1 in 11 weeks." That proof is the retention moment
and the reason someone keeps paying.
"""
from __future__ import annotations

from datetime import datetime

from services import health_store

# Which direction is "better" for each biomarker.
_LOWER_IS_BETTER = {
    "hba1c", "fasting_glucose", "pp_glucose", "random_glucose", "ldl", "triglycerides",
    "total_cholesterol", "vldl", "sgpt_alt", "sgot_ast", "alp", "bilirubin_total", "ggt",
    "tsh", "creatinine", "urea", "uric_acid", "crp", "esr",
    "bp_systolic", "bp_diastolic", "glucose_home", "weight",
}
_HIGHER_IS_BETTER = {
    "hdl", "vitamin_d", "vitamin_b12", "ferritin", "iron", "hemoglobin", "egfr",
    "t3", "t4", "calcium",
}


def direction(canonical: str) -> str:
    if canonical in _HIGHER_IS_BETTER:
        return "higher"
    return "lower"  # default & most cardiometabolic markers


def build_program(focus: dict | None) -> dict | None:
    """A 3-phase, ~12-week plan derived from the focus's action steps."""
    if not focus:
        return None
    weeks = focus.get("retest_weeks", 12)
    plan = focus.get("plan", []) or []
    label = focus.get("label", "your number")
    # distribute the plan steps across three phases
    third = max(1, len(plan) // 3) if plan else 1
    p1, p2, p3 = plan[:third] or plan[:1], plan[third:2 * third] or plan[:1], plan[2 * third:] or plan
    phases = [
        {"name": "Reset", "weeks": f"1–{max(2, weeks // 3)}",
         "goal": f"Build the daily habits that move {label}.", "actions": p1},
        {"name": "Build", "weeks": f"{max(3, weeks // 3 + 1)}–{max(4, 2 * weeks // 3)}",
         "goal": "Make the habits automatic and add consistency.", "actions": p2},
        {"name": "Lock-in", "weeks": f"{max(5, 2 * weeks // 3 + 1)}–{weeks}",
         "goal": f"Hold the routine and prepare to retest {label}.", "actions": p3},
    ]
    milestones = [
        {"week": 1, "label": "Start — baseline recorded"},
        {"week": max(2, weeks // 3), "label": "First habits locked in"},
        {"week": max(4, 2 * weeks // 3), "label": "Halfway — log a vital to check in"},
        {"week": weeks, "label": f"Retest {label} — see your progress"},
    ]
    return {"label": label, "weeks": weeks, "phases": phases, "milestones": milestones,
            "retest_date": focus.get("retest_date"), "start_date": focus.get("start_date")}


def compute_progress(identity: str, focus: dict | None) -> dict | None:
    """
    Progress + proof for the current focus:
      - time elapsed vs the 90-day window
      - engagement (check-in streak)
      - baseline → latest for the focus biomarker, and whether it improved
    """
    if not focus:
        return None
    canon = focus.get("canonical")
    weeks = focus.get("retest_weeks", 12)
    start_iso = focus.get("start_date")
    try:
        start = datetime.fromisoformat(start_iso).date()
        days_elapsed = max(0, (datetime.now().date() - start).days)
    except Exception:
        days_elapsed = 0
    days_total = weeks * 7
    percent = min(100, round(days_elapsed / days_total * 100)) if days_total else 0

    series = health_store.get_series(identity, canon) if canon else []
    proof = None
    if len(series) >= 2:
        baseline = series[0]
        latest = series[-1]
        b, l = baseline.get("value"), latest.get("value")
        if b is not None and l is not None:
            dir_ = direction(canon)
            delta = round(l - b, 2)
            improved = (dir_ == "lower" and l < b) or (dir_ == "higher" and l > b)
            now_in_range = (latest.get("status") or "").lower() == "normal"
            proof = {
                "baseline_value": b, "baseline_date": baseline.get("report_date"),
                "latest_value": l, "latest_date": latest.get("report_date"),
                "delta": delta, "abs_delta": abs(delta),
                "improved": improved, "now_in_range": now_in_range,
                "unit": latest.get("unit"), "label": focus.get("label"),
                "direction": dir_,
            }

    return {
        "days_elapsed": days_elapsed, "days_total": days_total, "percent": percent,
        "streak": health_store.get_streak(identity),
        "readings_count": len(series),
        "proof": proof,
    }
