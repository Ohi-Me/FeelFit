"""
FeelFit — Longitudinal Health Store (the data spine of the copilot).

A durable, per-identity biomarker time-series. Every value from every report is
normalised to a canonical key and stored as a dated point, so FeelFit can reason
about *trajectories* ("your HbA1c went 6.4 → 5.9 over 11 weeks"), not just a single
snapshot. This is the foundation the Focus engine, retest loop and AskFit memory
all read from.

Storage: SQLite (real relational DB, zero-setup, file at backend/data/feelfit.db).
It sits behind a small function API so it can be swapped for Postgres in production
without touching callers.

Identity = the same key the rest of the app uses: logged-in email, else client IP.
That means the health graph works for anonymous users too (keyed by IP).
"""
from __future__ import annotations

import json
import os
import re
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta
from pathlib import Path
from threading import Lock

_DATA = Path(__file__).parent.parent / "data"
_DATA.mkdir(exist_ok=True)
# DB path is env-configurable so deployment can point at a mounted volume.
# Production swap path: replace this SQLite layer with a Postgres adapter behind
# the same function API (record_readings / latest_readings / get_series / ...).
_DB = Path(os.environ.get("FEELFIT_DB", str(_DATA / "feelfit.db")))
_lock = Lock()


# ── Canonical biomarker normalisation ────────────────────────────────────────────
# Maps the many ways a lab prints a test → one stable key the engine reasons about.
_CANON: dict[str, list[str]] = {
    "hba1c":            ["hba1c", "glycated", "glycosylated", "a1c"],
    "fasting_glucose":  ["fasting blood sugar", "fasting glucose", "fasting plasma glucose", "fbs", "glucose fasting"],
    "pp_glucose":       ["postprandial", "post prandial", "pp blood sugar", "ppbs", "post-prandial"],
    "random_glucose":   ["random blood sugar", "random glucose", "rbs"],
    "ldl":              ["ldl"],
    "hdl":              ["hdl"],
    "triglycerides":    ["triglyceride", "tg"],
    "total_cholesterol":["total cholesterol", "cholesterol total", "cholesterol, total"],
    "vldl":             ["vldl"],
    "tsh":              ["tsh", "thyroid stimulating"],
    "t3":               ["t3", "triiodothyronine"],
    "t4":               ["t4", "thyroxine"],
    "sgpt_alt":         ["sgpt", "alt", "alanine"],
    "sgot_ast":         ["sgot", "ast", "aspartate"],
    "alp":              ["alkaline phosphatase", "alp"],
    "bilirubin_total":  ["bilirubin total", "total bilirubin"],
    "ggt":              ["ggt", "gamma glutamyl", "gamma-glutamyl"],
    "vitamin_d":        ["vitamin d", "25-hydroxy", "25 hydroxy", "25-oh", "vit d"],
    "vitamin_b12":      ["vitamin b12", "b12", "cobalamin"],
    "ferritin":         ["ferritin"],
    "iron":             ["serum iron", "iron"],
    "hemoglobin":       ["hemoglobin", "haemoglobin", "hb", "hgb"],
    "creatinine":       ["creatinine"],
    "urea":             ["blood urea", "urea"],
    "uric_acid":        ["uric acid"],
    "egfr":             ["egfr", "gfr"],
    "calcium":          ["calcium"],
    "crp":              ["crp", "c-reactive", "c reactive"],
    "esr":              ["esr", "sedimentation"],
    "wbc":              ["wbc", "white blood", "leucocyte", "leukocyte", "total leucocyte"],
    "platelets":        ["platelet", "plt"],
}
# Pretty labels for UI.
_LABELS: dict[str, str] = {
    "hba1c": "HbA1c", "fasting_glucose": "Fasting Glucose", "pp_glucose": "Post-meal Glucose",
    "random_glucose": "Random Glucose", "ldl": "LDL Cholesterol", "hdl": "HDL Cholesterol",
    "triglycerides": "Triglycerides", "total_cholesterol": "Total Cholesterol", "vldl": "VLDL",
    "tsh": "TSH", "t3": "T3", "t4": "T4", "sgpt_alt": "SGPT / ALT", "sgot_ast": "SGOT / AST",
    "alp": "Alkaline Phosphatase", "bilirubin_total": "Total Bilirubin", "ggt": "GGT",
    "vitamin_d": "Vitamin D", "vitamin_b12": "Vitamin B12", "ferritin": "Ferritin", "iron": "Iron",
    "hemoglobin": "Hemoglobin", "creatinine": "Creatinine", "urea": "Blood Urea",
    "uric_acid": "Uric Acid", "egfr": "eGFR", "calcium": "Calcium", "crp": "CRP", "esr": "ESR",
    "wbc": "WBC", "platelets": "Platelets",
    # self-logged vitals
    "bp_systolic": "Blood Pressure (systolic)", "bp_diastolic": "Blood Pressure (diastolic)",
    "weight": "Weight", "glucose_home": "Home Glucose",
    # wearable / continuous signals
    "steps": "Steps", "sleep_hours": "Sleep", "resting_hr": "Resting Heart Rate", "hrv": "HRV",
}

# Self-logged + wearable points: type → (canonical, default unit, healthy_min, healthy_max)
VITALS: dict[str, tuple] = {
    "bp_systolic":  ("bp_systolic",  "mmHg", 90, 120),
    "bp_diastolic": ("bp_diastolic", "mmHg", 60, 80),
    "weight":       ("weight",       "kg",   None, None),
    "glucose_home": ("glucose_home", "mg/dL", 70, 140),
    "steps":        ("steps",        "steps", None, None),
    "sleep_hours":  ("sleep_hours",  "hrs",   7, 9),
    "resting_hr":   ("resting_hr",   "bpm",   50, 90),
    "hrv":          ("hrv",          "ms",    None, None),
}


def canonical_key(test_name: str) -> str | None:
    """Map a raw test name to a stable canonical key (or None if unrecognised)."""
    if not test_name:
        return None
    t = test_name.lower().strip()
    for key, needles in _CANON.items():
        if any(n in t for n in needles):
            return key
    return None


def label_for(key: str) -> str:
    return _LABELS.get(key, key.replace("_", " ").title())


def _to_float(v) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"-?\d+(?:\.\d+)?", str(v))
    return float(m.group()) if m else None


# ── Connection / schema ──────────────────────────────────────────────────────────
@contextmanager
def _conn():
    cx = sqlite3.connect(_DB)
    cx.row_factory = sqlite3.Row
    try:
        yield cx
        cx.commit()
    finally:
        cx.close()


def init() -> None:
    with _lock, _conn() as cx:
        cx.executescript(
            """
            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                identity   TEXT NOT NULL,
                canonical  TEXT NOT NULL,
                test_name  TEXT,
                value      REAL,
                unit       TEXT,
                status     TEXT,
                ref_min    REAL,
                ref_max    REAL,
                report_date TEXT,
                job_id     TEXT,
                created_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_readings_id ON readings(identity, canonical, report_date);
            CREATE TABLE IF NOT EXISTS focus (
                identity   TEXT PRIMARY KEY,
                canonical  TEXT,
                payload    TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS checkins (
                identity   TEXT NOT NULL,
                day        TEXT NOT NULL,
                action     TEXT,
                created_at TEXT,
                PRIMARY KEY (identity, day)
            );
            """
        )


init()


# ── Writes ───────────────────────────────────────────────────────────────────────
def record_readings(identity: str, tests: list, report_date: str | None, job_id: str | None) -> int:
    """
    Persist every recognised biomarker from a report as a dated point.
    `tests` are ExtractedTest-like objects/dicts with: test_name, value, unit,
    status, normal_min, normal_max. Returns the count stored.
    De-dupes on (identity, canonical, report_date, job_id) so re-analysis is idempotent.
    """
    if not identity or not tests:
        return 0
    rdate = report_date or datetime.now().strftime("%Y-%m-%d")
    now = datetime.now().isoformat()
    rows = []
    for t in tests:
        g = (lambda o, k: getattr(o, k, None) if not isinstance(o, dict) else o.get(k))
        name = g(t, "test_name")
        key = canonical_key(name or "")
        if not key:
            continue
        val = _to_float(g(t, "value"))
        if val is None:
            continue
        status = g(t, "status")
        status = getattr(status, "value", status)
        rows.append((identity, key, name, val, g(t, "unit"), status,
                     _to_float(g(t, "normal_min")), _to_float(g(t, "normal_max")),
                     rdate, job_id, now))
    if not rows:
        return 0
    with _lock, _conn() as cx:
        for r in rows:
            # idempotency: skip if same identity+canonical+report_date already from this job
            existing = cx.execute(
                "SELECT 1 FROM readings WHERE identity=? AND canonical=? AND report_date=? AND job_id IS ? LIMIT 1",
                (r[0], r[1], r[8], r[9]),
            ).fetchone()
            if existing:
                continue
            cx.execute(
                """INSERT INTO readings
                   (identity, canonical, test_name, value, unit, status, ref_min, ref_max, report_date, job_id, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                r,
            )
    return len(rows)


# ── Reads ────────────────────────────────────────────────────────────────────────
def get_series(identity: str, canonical: str) -> list[dict]:
    with _conn() as cx:
        rows = cx.execute(
            "SELECT value, unit, status, report_date, created_at FROM readings "
            "WHERE identity=? AND canonical=? ORDER BY report_date ASC, created_at ASC",
            (identity, canonical),
        ).fetchall()
    return [dict(r) for r in rows]


def latest_readings(identity: str) -> dict[str, dict]:
    """Most-recent point per canonical biomarker for this identity."""
    out: dict[str, dict] = {}
    with _conn() as cx:
        rows = cx.execute(
            "SELECT canonical, test_name, value, unit, status, ref_min, ref_max, report_date "
            "FROM readings WHERE identity=? ORDER BY report_date ASC, created_at ASC",
            (identity,),
        ).fetchall()
    for r in rows:
        out[r["canonical"]] = dict(r)  # later rows overwrite → keeps latest
    return out


def timeline(identity: str) -> list[dict]:
    """Distinct report dates on record (for the dated health timeline)."""
    with _conn() as cx:
        rows = cx.execute(
            "SELECT report_date, job_id, COUNT(*) n, "
            "SUM(CASE WHEN status IN ('low','high','critical') THEN 1 ELSE 0 END) abnormal "
            "FROM readings WHERE identity=? GROUP BY report_date, job_id ORDER BY report_date ASC",
            (identity,),
        ).fetchall()
    return [dict(r) for r in rows]


def graph(identity: str) -> dict:
    """Full health graph: per-biomarker series + the dated timeline + latest snapshot."""
    latest = latest_readings(identity)
    series = {k: get_series(identity, k) for k in latest}
    return {
        "latest": {k: {**v, "label": label_for(k)} for k, v in latest.items()},
        "series": series,
        "timeline": timeline(identity),
        "biomarker_count": len(latest),
    }


# ── Focus ────────────────────────────────────────────────────────────────────────
def set_focus(identity: str, payload: dict) -> None:
    with _lock, _conn() as cx:
        cx.execute(
            "INSERT INTO focus (identity, canonical, payload, updated_at) VALUES (?,?,?,?) "
            "ON CONFLICT(identity) DO UPDATE SET canonical=excluded.canonical, "
            "payload=excluded.payload, updated_at=excluded.updated_at",
            (identity, payload.get("canonical"), json.dumps(payload), datetime.now().isoformat()),
        )


def get_focus(identity: str) -> dict | None:
    with _conn() as cx:
        row = cx.execute("SELECT payload FROM focus WHERE identity=?", (identity,)).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["payload"])
    except Exception:
        return None


def erase_identity(identity: str) -> int:
    """Permanently delete all biomarker readings, focus and check-ins for an identity."""
    with _lock, _conn() as cx:
        n = cx.execute("SELECT COUNT(*) c FROM readings WHERE identity=?", (identity,)).fetchone()["c"]
        cx.execute("DELETE FROM readings WHERE identity=?", (identity,))
        cx.execute("DELETE FROM focus WHERE identity=?", (identity,))
        cx.execute("DELETE FROM checkins WHERE identity=?", (identity,))
    return n


# ── Self-logged vitals ────────────────────────────────────────────────────────────
def record_vital(identity: str, vtype: str, value: float, unit: str | None = None) -> dict:
    """Log a self-measured vital (BP / weight / home glucose) as a dated point."""
    spec = VITALS.get(vtype)
    if not spec:
        raise ValueError(f"unknown vital type: {vtype}")
    canon, default_unit, lo, hi = spec
    val = _to_float(value)
    if val is None:
        raise ValueError("value must be numeric")
    status = None
    if lo is not None and hi is not None:
        status = "low" if val < lo else "high" if val > hi else "normal"
    now = datetime.now()
    with _lock, _conn() as cx:
        cx.execute(
            """INSERT INTO readings
               (identity, canonical, test_name, value, unit, status, ref_min, ref_max, report_date, job_id, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            (identity, canon, label_for(canon), val, unit or default_unit, status, lo, hi,
             now.strftime("%Y-%m-%d"), "vital", now.isoformat()),
        )
    return {"canonical": canon, "label": label_for(canon), "value": val, "unit": unit or default_unit, "status": status}


# ── Daily check-in / streak (the habit primitive) ─────────────────────────────────
def add_checkin(identity: str, action: str | None = None) -> int:
    today = datetime.now().strftime("%Y-%m-%d")
    with _lock, _conn() as cx:
        cx.execute(
            "INSERT OR IGNORE INTO checkins (identity, day, action, created_at) VALUES (?,?,?,?)",
            (identity, today, action, datetime.now().isoformat()),
        )
    return get_streak(identity)


def checked_in_today(identity: str) -> bool:
    today = datetime.now().strftime("%Y-%m-%d")
    with _conn() as cx:
        return cx.execute("SELECT 1 FROM checkins WHERE identity=? AND day=?", (identity, today)).fetchone() is not None


def get_streak(identity: str) -> int:
    """Consecutive days (ending today or yesterday) with a check-in."""
    with _conn() as cx:
        rows = cx.execute("SELECT day FROM checkins WHERE identity=? ORDER BY day DESC", (identity,)).fetchall()
    days = {r["day"] for r in rows}
    if not days:
        return 0
    streak = 0
    cur = datetime.now().date()
    # allow today not yet checked: start from today, else yesterday
    if cur.isoformat() not in days:
        cur = cur - timedelta(days=1)
        if cur.isoformat() not in days:
            return 0
    while cur.isoformat() in days:
        streak += 1
        cur = cur - timedelta(days=1)
    return streak
