"""
FeelFit v4 — NLP + LOINC Extraction Service
Hybrid approach: Regex + dictionary mapping + normalization + range checking
"""
from __future__ import annotations
import json
import logging
import math
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from schemas.analysis import (
    ExtractedTest, TestStatus, TestTrend, UserProfile
)

logger = logging.getLogger("feelfit.nlp")

# ── Load LOINC KB ──────────────────────────────────────────────────────────────

_KB_PATH = Path(__file__).parent.parent / "medical_kb.json"
_LOINC_PATH = Path(__file__).parent.parent / "loinc_clinical.json"

MEDICAL_KB: Dict[str, dict] = {}
ALIAS_MAP: Dict[str, str] = {}

def _load_kb():
    global MEDICAL_KB, ALIAS_MAP
    try:
        with open(_KB_PATH) as f:
            MEDICAL_KB = json.load(f)
        for loinc_code, entry in MEDICAL_KB.items():
            for alias in entry.get("aliases", []):
                ALIAS_MAP[alias.lower().strip()] = loinc_code
            ALIAS_MAP[entry["short"].lower()] = loinc_code
            ALIAS_MAP[entry["canonical"].lower()] = loinc_code
        logger.info(f"LOINC KB loaded: {len(MEDICAL_KB)} tests, {len(ALIAS_MAP)} aliases")
    except Exception as e:
        logger.warning(f"KB load error: {e}")

_load_kb()


# ── Unit Normalization ─────────────────────────────────────────────────────────

UNIT_NORM: Dict[str, str] = {
    "g/dl": "g/dL", "g/100ml": "g/dL", "gm/dl": "g/dL",
    "mg/dl": "mg/dL", "mg/100ml": "mg/dL", "mgs/dl": "mg/dL",
    "u/l": "U/L", "iu/l": "IU/L", "u/ml": "U/mL",
    "meq/l": "mmol/L", "mmol/l": "mmol/L", "mol/l": "mmol/L",
    "µg/dl": "µg/dL", "ug/dl": "µg/dL", "mcg/dl": "µg/dL",
    "ng/dl": "ng/dL", "ng/ml": "ng/mL", "pg/ml": "pg/mL",
    "miu/l": "mIU/L", "miu/ml": "mIU/mL",
    "mill/cumm": "10*12/L", "k/ul": "10*9/L",
    "thou/ul": "10*9/L", "10^3/ul": "10*9/L", "10^6/ul": "10*12/L",
    "cells/cumm": "cells/µL", "cells/ul": "cells/µL",
    "mm/hr": "mm/h", "mm/hour": "mm/h",
    "mcg/ml": "µg/mL", "mcg/l": "µg/L",
    "10*9/l": "10*9/L", "10*12/l": "10*12/L",
    "%": "%", "ratio": "ratio", "index": "index",
    "fl": "fL", "pg": "pg", "fmol": "fmol",
}

# ── Medical Name Synonyms ──────────────────────────────────────────────────────

SYNONYM_MAP: Dict[str, str] = {
    "hb": "hemoglobin", "haemoglobin": "hemoglobin",
    "rbc": "red_blood_cells", "red blood cell count": "red_blood_cells",
    "wbc": "white_blood_cells", "white blood cell count": "white_blood_cells",
    "tsh": "thyroid_stimulating_hormone",
    "t3": "triiodothyronine", "t4": "thyroxine",
    "ft3": "free_triiodothyronine", "ft4": "free_thyroxine",
    "hba1c": "glycated_hemoglobin", "a1c": "glycated_hemoglobin",
    "fbs": "fasting_blood_sugar", "fasting glucose": "fasting_blood_sugar",
    "ppbs": "postprandial_blood_sugar",
    "ldl": "ldl_cholesterol", "hdl": "hdl_cholesterol",
    "vldl": "vldl_cholesterol", "tg": "triglycerides",
    "alt": "alanine_aminotransferase", "sgpt": "alanine_aminotransferase",
    "ast": "aspartate_aminotransferase", "sgot": "aspartate_aminotransferase",
    "alp": "alkaline_phosphatase", "alk phos": "alkaline_phosphatase",
    "ggt": "gamma_glutamyl_transferase",
    "creat": "creatinine", "s. creatinine": "creatinine",
    "urea": "blood_urea_nitrogen", "bun": "blood_urea_nitrogen",
    "na": "sodium", "k": "potassium", "cl": "chloride",
    "ca": "calcium", "mg": "magnesium", "p": "phosphorus",
    "hct": "hematocrit", "pcv": "hematocrit",
    "mcv": "mean_corpuscular_volume", "mch": "mean_corpuscular_hemoglobin",
    "mchc": "mean_corpuscular_hemoglobin_concentration",
    "plt": "platelets", "platelet count": "platelets",
    "esr": "erythrocyte_sedimentation_rate",
    "crp": "c_reactive_protein", "c reactive protein": "c_reactive_protein",
    "uric acid": "uric_acid", "s. uric acid": "uric_acid",
    "ferritin": "ferritin", "iron": "serum_iron",
    "tibc": "total_iron_binding_capacity",
    "vit d": "vitamin_d", "vitamin d": "vitamin_d", "25-oh vit d": "vitamin_d",
    "vit b12": "vitamin_b12", "vitamin b12": "vitamin_b12",
    "folate": "folic_acid", "folic acid": "folic_acid",
    "inr": "international_normalized_ratio", "pt": "prothrombin_time",
    "aptt": "activated_partial_thromboplastin_time",
    "psa": "prostate_specific_antigen",
}


def normalize_unit(raw: str) -> str:
    return UNIT_NORM.get(raw.strip().lower(), raw.strip())


def normalize_test_name(raw: str) -> str:
    """Map synonyms to canonical names."""
    clean = raw.lower().strip()
    clean = re.sub(r"\s+", " ", clean)
    return SYNONYM_MAP.get(clean, clean)


# ── LOINC Lookup ──────────────────────────────────────────────────────────────

def lookup_loinc(raw_name: str, gender: Optional[str] = None) -> Optional[dict]:
    """Match raw test name → LOINC KB entry via alias map."""
    clean = raw_name.lower().strip()
    clean = re.sub(r"\s+", " ", clean)

    # Normalize via synonyms first
    normalized = normalize_test_name(clean)

    # Direct match
    for candidate in [clean, normalized]:
        if candidate in ALIAS_MAP:
            return MEDICAL_KB.get(ALIAS_MAP[candidate])

    # Partial longest-match
    best_key, best_len = None, 0
    for alias, code in ALIAS_MAP.items():
        if alias in clean and len(alias) > best_len and len(alias) >= 3:
            best_key, best_len = code, len(alias)

    if best_key:
        return MEDICAL_KB.get(best_key)
    return None


# ── Range Checking ─────────────────────────────────────────────────────────────

def compute_status(
    value: float, entry: dict,
    gender: Optional[str] = None,
    age: Optional[int] = None
) -> Tuple[TestStatus, Optional[float], Optional[float]]:
    """Determine test status (low/normal/high/critical) using gender/age-aware ranges."""
    ranges = entry.get("ranges", {})

    # Pick gender-specific range if available
    ref = None
    if gender == "male" and "adult_male" in ranges:
        ref = ranges["adult_male"]
    elif gender == "female" and "adult_female" in ranges:
        ref = ranges["adult_female"]
    else:
        ref = ranges.get("default") or ranges.get("adult_male") or next(iter(ranges.values()), None)

    if not ref:
        return (TestStatus.NORMAL, None, None)

    low = ref.get("low")
    high = ref.get("high")
    if low is None or high is None:
        return (TestStatus.NORMAL, low, high)

    crit_low = ref.get("critical_low", low * 0.7)
    crit_high = ref.get("critical_high", high * 1.35)

    if value <= crit_low:
        return (TestStatus.CRITICAL, low, high)
    if value < low:
        return (TestStatus.LOW, low, high)
    if value >= crit_high:
        return (TestStatus.CRITICAL, low, high)
    if value > high:
        return (TestStatus.HIGH, low, high)
    return (TestStatus.NORMAL, low, high)


# ── Regex Patterns ────────────────────────────────────────────────────────────

# Primary pattern: "Test Name : 12.5 g/dL"
_TEST_LINE_PRIMARY = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z0-9\s\-/()\.,*%]{1,60}?)"
    r"\s*[:\-=]\s*"
    r"(?P<value>\d{1,6}(?:\.\d{1,4})?)"
    r"\s*"
    r"(?P<unit>[a-zA-Zµ%^*/0-9.\s]{1,20})?",
    re.IGNORECASE
)

# Secondary: tabular "Test Name   12.5   g/dL   10-20"
_TEST_LINE_TABULAR = re.compile(
    r"^(?P<name>[A-Za-z][A-Za-z0-9\s\-/()\.,*%]{2,50}?)\s{2,}"
    r"(?P<value>\d{1,6}(?:\.\d{1,4})?)\s+"
    r"(?P<unit>[a-zA-Zµ%^*/0-9.\s]{1,18})?\s*"
    r"(?P<ref>\d+\.?\d*\s*[-–]\s*\d+\.?\d*)?",
    re.IGNORECASE | re.MULTILINE
)


def extract_structured_tests(
    text: str,
    gender: Optional[str] = None,
    age: Optional[int] = None
) -> List[ExtractedTest]:
    """
    Hybrid extraction: tries primary pattern first, then tabular.
    Each result is LOINC-matched and range-checked.
    """
    results: List[ExtractedTest] = []
    seen: set = set()
    lines = text.split("\n")

    for line in lines:
        line = line.strip()
        if len(line) < 4:
            continue

        # Skip header-like lines
        if re.match(r"^(test|parameter|result|value|unit|reference|normal|range)\s*$", line.lower()):
            continue

        # Try primary pattern
        for m in _TEST_LINE_PRIMARY.finditer(line):
            _process_match(m, seen, results, gender, age)

        # Also try tabular on the same line
        tm = _TEST_LINE_TABULAR.match(line)
        if tm:
            _process_match(tm, seen, results, gender, age)

    logger.info(
        f"NLP extracted {len(results)} tests "
        f"({sum(1 for t in results if t.loinc_code)} LOINC-matched)"
    )
    return results


def _process_match(m, seen: set, results: list, gender, age):
    raw_name = m.group("name").strip().rstrip(":-= \t")
    raw_val = m.group("value")
    raw_unit = (m.group("unit") or "").strip().split()[0] if m.group("unit") else ""

    if len(raw_name) < 2 or raw_name.lower() in {"page", "date", "name", "age", "sex"}:
        return
    if raw_name.replace(" ", "").isdigit():
        return

    try:
        value = float(raw_val)
    except (ValueError, TypeError):
        return

    # Sanity check
    if value < 0 or value > 500_000:
        return

    unit = normalize_unit(raw_unit) if raw_unit else ""
    kb_entry = lookup_loinc(raw_name, gender)
    canonical = (
        kb_entry["canonical"] if kb_entry
        else re.sub(r"\s+", "_", raw_name.lower())
    )

    # Skip duplicate canonical names
    if canonical in seen:
        return
    seen.add(canonical)

    if kb_entry:
        if not unit:
            unit = kb_entry.get("units", "")
        status, n_min, n_max = compute_status(value, kb_entry, gender, age)

        deviation = None
        if n_min is not None and n_max is not None:
            midpoint = (n_min + n_max) / 2
            if midpoint > 0:
                deviation = round(((value - midpoint) / midpoint) * 100, 1)

        # Clinical note only for abnormal
        if status == TestStatus.NORMAL:
            clinical_note = ""
        elif value < (n_min or 0):
            clinical_note = kb_entry.get("clinical_note_low", "")
        else:
            clinical_note = kb_entry.get("clinical_note_high", "")

        results.append(ExtractedTest(
            loinc_code=kb_entry["loinc"],
            test_name=kb_entry["short"],
            canonical_name=canonical,
            raw_name=raw_name,
            value=value,
            unit=unit,
            normal_min=n_min,
            normal_max=n_max,
            status=status,
            deviation_percent=deviation,
            clinical_note=clinical_note,
            category=kb_entry.get("category"),
            specialty=kb_entry.get("specialty"),
        ))
    else:
        results.append(ExtractedTest(
            loinc_code=None,
            test_name=raw_name.title(),
            canonical_name=canonical,
            raw_name=raw_name,
            value=value,
            unit=unit,
            status=TestStatus.NORMAL,
            clinical_note="",
        ))


# ── Trend Analysis ────────────────────────────────────────────────────────────

def compute_trends(
    current: List[ExtractedTest],
    historical: Optional[List[dict]]
) -> List[TestTrend]:
    """
    Compare current test values vs historical report.
    Flags: increasing / decreasing / stable (±5% threshold).
    """
    if not historical:
        return []

    hist_map = {
        (t.get("canonical_name") or t.get("test_name", "").lower()): t
        for t in historical
    }

    trends: List[TestTrend] = []
    for test in current:
        # Skip OCR-noise names (fewer than 3 real letters) so junk can't become a "trend"
        if len(re.sub(r"[^a-zA-Z]", "", test.test_name or "")) < 3:
            continue
        key = test.canonical_name or test.test_name.lower()
        if key not in hist_map:
            continue

        prev = hist_map[key]
        try:
            prev_val = float(prev.get("value", 0))
        except (ValueError, TypeError):
            continue

        curr_val = test.value
        if prev_val == 0:
            continue

        change_pct = round(((curr_val - prev_val) / prev_val) * 100, 1)

        if curr_val > prev_val * 1.05:
            direction = "increasing"
            summary = f"{test.test_name} increased from {prev_val} → {curr_val} {test.unit} (+{change_pct}%)"
        elif curr_val < prev_val * 0.95:
            direction = "decreasing"
            summary = f"{test.test_name} decreased from {prev_val} → {curr_val} {test.unit} ({change_pct}%)"
        else:
            direction = "stable"
            summary = f"{test.test_name} stable at {curr_val} {test.unit}"

        trends.append(TestTrend(
            test_name=test.test_name,
            direction=direction,
            previous_value=prev_val,
            current_value=curr_val,
            unit=test.unit,
            summary=summary,
            change_percent=change_pct,
        ))

    return trends


# ── Deterministic report-row parser (PaddleOCR rows → tests) ────────────────────
# Reads clean OCR rows like "Hemoglobin (Hb) 11.2 g/dL 13.5 - 17.5 L" and extracts
# test / value / unit / reference range / printed H-L-N flag WITHOUT an LLM, so
# values are exact and the lab's own High/Low flag is honoured. Free + offline.

_SPECIALTY_BY_KW = [
    (("hemoglobin", "haemoglobin", "rbc", "wbc", "platelet", "hematocrit", "haematocrit",
      "mcv", "mch ", "mchc", "rdw", "esr", "ferritin"), "Hematologist"),
    (("glucose", "sugar", "fbs", "ppbs", "hba1c", "insulin", "tsh", "t3", "t4", "thyroid",
      "thyroxine"), "Endocrinologist"),
    (("cholesterol", "ldl", "hdl", "vldl", "triglyceride", "troponin", "lipid"), "Cardiologist"),
    (("alt", "sgpt", "ast", "sgot", "bilirubin", "alkaline", "albumin", "protein", "globulin",
      "ggt"), "Gastroenterologist"),
    (("creatinine", "urea", "egfr", "uric"), "Nephrologist"),
]

_UNIT_RE = (
    r"(?:g/d[lL]|mg/d[lL]|million/[µuμ]?[lL]|/[µuμ]?[lL]|U/[lL]|ng/m[lL]|pg/m[lL]|"
    r"m?IU/[lL]|µg/d[lL]|mcg/d[lL]|µg/[lL]|fL|pg|%|mmol/[lL]|mEq/[lL]|"
    r"mL/min[^\s]*|Ratio|x?10\^?3/[µuμ]?[lL])"
)
_RANGE_RE = re.compile(
    r"(?P<lo>\d[\d.]*)\s*[-–to]+\s*(?P<hi>\d[\d.]*)"        # 13.5 - 17.5
    r"|<\s*(?P<lt>\d[\d.]*)"                                  # < 200
    r"|>\s*(?P<gt>\d[\d.]*)"                                  # > 90
)
_NUM_RE = re.compile(r"\d[\d.]*")


def _specialty_for(name: str) -> str:
    n = name.lower()
    for kws, spec in _SPECIALTY_BY_KW:
        if any(k in n for k in kws):
            return spec
    return "General Physician"


def parse_report_rows(text: str) -> List[ExtractedTest]:
    """Deterministically parse OCR/text rows into ExtractedTest objects."""
    if not text:
        return []
    out: List[ExtractedTest] = []
    seen: set = set()
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if len(line) < 4 or not any(c.isdigit() for c in line):
            continue
        # strip thousands separators inside numbers: 13,500 -> 13500
        line = re.sub(r"(?<=\d),(?=\d)", "", line)

        rng = _RANGE_RE.search(line)
        if not rng:
            continue
        before = line[: rng.start()]
        # Prefer the number attached to a unit (e.g. "58 mL/min") — this avoids
        # picking digits out of the test name ("B12") or a unit ("1.73m²").
        vu = list(re.finditer(r"(\d[\d.]*)\s*(" + _UNIT_RE + r")", before))
        if vu:
            m = vu[-1]
            try:
                value = float(m.group(1))
            except ValueError:
                continue
            name = before[: m.start()].strip(" :|-\t")
            unit = m.group(2)
        else:
            nums = list(_NUM_RE.finditer(before))
            if not nums:
                continue
            val_m = nums[-1]
            try:
                value = float(val_m.group())
            except ValueError:
                continue
            name = before[: val_m.start()].strip(" :|-\t")
            unit = before[val_m.end():].strip()
        # name must look like a test (has letters, reasonable length)
        if len(re.sub(r"[^a-zA-Z]", "", name)) < 2 or len(name) > 60:
            continue
        unit = re.sub(r"\s+", " ", unit)[:16]

        # reference bounds
        nmin = nmax = None
        if rng.group("lo") and rng.group("hi"):
            nmin, nmax = float(rng.group("lo")), float(rng.group("hi"))
        elif rng.group("lt"):
            nmax = float(rng.group("lt")); nmin = 0.0
        elif rng.group("gt"):
            nmin = float(rng.group("gt"))

        # printed High/Low/Normal flag (what comes after the range)
        tail = line[rng.end():].strip().upper()
        flag = None
        m = re.match(r"\b([HLN])\b", tail)
        if m:
            flag = m.group(1)

        if flag == "H":
            status = TestStatus.HIGH
        elif flag == "L":
            status = TestStatus.LOW
        elif flag == "N":
            status = TestStatus.NORMAL
        else:  # derive from bounds
            if nmax is not None and value > nmax:
                status = TestStatus.HIGH
            elif nmin is not None and value < nmin:
                status = TestStatus.LOW
            else:
                status = TestStatus.NORMAL

        key = name.lower()
        if key in seen:
            continue
        seen.add(key)

        deviation = None
        if status == TestStatus.HIGH and nmax:
            deviation = round((value - nmax) / nmax * 100, 1)
        elif status == TestStatus.LOW and nmin:
            deviation = round((value - nmin) / nmin * 100, 1)

        out.append(ExtractedTest(
            loinc_code=None, test_name=name, raw_name=name, value=value,
            unit=unit or "", normal_min=nmin, normal_max=nmax, status=status,
            deviation_percent=deviation, category=None, specialty=_specialty_for(name),
        ))
    return out
