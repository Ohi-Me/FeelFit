"""
FeelFit v7 — Health Profile Service
In-memory user profile store with:
  - Report history per user
  - Health score calculation
  - Trend tracking across reports
  - Risk history
Production: replace _store with PostgreSQL / Redis
"""
from __future__ import annotations
import time
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Models ─────────────────────────────────────────────────────────────────────

class ProfileData(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    known_conditions: list[str] = []
    current_medications: list[str] = []
    allergies: list[str] = []
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now().isoformat())


class ReportSummary(BaseModel):
    job_id: str
    report_type: str
    risk_level: str
    confidence: float
    timestamp: str
    report_date: Optional[str] = None  # date printed on the report (not analysis time)
    summary_preview: str
    key_findings: list[str] = []
    abnormal_count: int = 0
    total_tests: int = 0
    loinc_matched: int = 0
    test_values: Optional[list[dict]] = None  # for trend tracking


class HealthScore(BaseModel):
    score: int = Field(..., ge=0, le=100)
    grade: str  # A+ / A / B / C / D
    label: str  # Excellent / Good / Fair / Needs Attention / Critical
    color: str  # CSS color variable name
    breakdown: dict[str, int]  # category → score contribution
    last_updated: str


class TrendPoint(BaseModel):
    timestamp: str
    value: float
    unit: str
    status: str  # normal/low/high/critical


class TestTrendHistory(BaseModel):
    test_name: str
    loinc_code: Optional[str]
    unit: str
    points: list[TrendPoint]
    direction: str  # improving / worsening / stable
    latest_status: str


# ── In-Memory Store ────────────────────────────────────────────────────────────

class ProfileStore:
    """
    Simple in-memory profile store, keyed by session ID (or IP for anonymous).
    Replace with DB in production.
    """

    def __init__(self):
        self._profiles: dict[str, ProfileData] = {}
        self._reports: dict[str, list[ReportSummary]] = {}  # uid → reports
        self._max_reports = 20  # keep last 20 per user

    # ── Profile CRUD ───────────────────────────────────────────────────────────

    def get_profile(self, uid: str) -> Optional[ProfileData]:
        return self._profiles.get(uid)

    def upsert_profile(self, uid: str, data: ProfileData) -> ProfileData:
        existing = self._profiles.get(uid)
        if existing:
            updates = data.model_dump(exclude_none=True, exclude={"created_at"})
            updates["updated_at"] = datetime.now().isoformat()
            updated = existing.model_copy(update=updates)
            self._profiles[uid] = updated
            return updated
        data.created_at = datetime.now().isoformat()
        data.updated_at = datetime.now().isoformat()
        self._profiles[uid] = data
        return data

    # ── Report History ─────────────────────────────────────────────────────────

    def add_report(self, uid: str, report: ReportSummary) -> list[ReportSummary]:
        if uid not in self._reports:
            self._reports[uid] = []
        self._reports[uid].insert(0, report)
        self._reports[uid] = self._reports[uid][:self._max_reports]
        return self._reports[uid]

    def get_reports(self, uid: str) -> list[ReportSummary]:
        return self._reports.get(uid, [])

    def clear_reports(self, uid: str):
        self._reports[uid] = []

    # ── Health Score ───────────────────────────────────────────────────────────

    def compute_health_score(self, uid: str) -> HealthScore:
        """
        Score 0–100 based on:
          - Recent report risk levels (40 pts)
          - Abnormal test ratio (30 pts)
          - Report consistency / recency (15 pts)
          - Profile completeness (15 pts)
        """
        reports = self.get_reports(uid)
        profile = self.get_profile(uid)

        # ── Risk score (40 pts max) ────────────────────────────────────────────
        risk_score = 40
        if reports:
            recent = reports[:3]  # weight last 3 reports
            risk_weights = {"low": 40, "moderate": 25, "high": 10}
            risk_score = int(sum(risk_weights.get(r.risk_level, 20) for r in recent) / len(recent))

        # ── Abnormal ratio (30 pts max) ────────────────────────────────────────
        abnormal_score = 30
        if reports:
            recent = reports[:5]
            ratios = []
            for r in recent:
                if r.total_tests > 0:
                    ratio = r.abnormal_count / r.total_tests
                    ratios.append(max(0, 30 - int(ratio * 60)))
            if ratios:
                abnormal_score = int(sum(ratios) / len(ratios))

        # ── Recency score (15 pts max) ─────────────────────────────────────────
        recency_score = 0
        if reports:
            try:
                latest_ts = datetime.fromisoformat(reports[0].timestamp)
                days_ago = (datetime.now() - latest_ts).days
                recency_score = max(0, 15 - days_ago // 30)  # loses 1pt per month
            except Exception:
                recency_score = 8

        # ── Profile completeness (15 pts max) ─────────────────────────────────
        profile_score = 0
        if profile:
            fields = [profile.name, profile.age, profile.gender, profile.blood_group,
                      profile.height_cm, profile.weight_kg]
            profile_score = int((sum(1 for f in fields if f) / len(fields)) * 15)

        total = min(100, risk_score + abnormal_score + recency_score + profile_score)

        # Grade
        if total >= 85:   grade, label, color = "A+", "Excellent",        "var(--ok)"
        elif total >= 70: grade, label, color = "A",  "Good",             "var(--ok)"
        elif total >= 55: grade, label, color = "B",  "Fair",             "var(--warn)"
        elif total >= 40: grade, label, color = "C",  "Needs Attention",  "var(--danger)"
        else:             grade, label, color = "D",  "Critical",         "var(--crit)"

        return HealthScore(
            score=total, grade=grade, label=label, color=color,
            breakdown={
                "risk": risk_score,
                "abnormal_values": abnormal_score,
                "report_recency": recency_score,
                "profile_completeness": profile_score,
            },
            last_updated=datetime.now().isoformat(),
        )

    # ── Trend Tracking ─────────────────────────────────────────────────────────

    def get_test_trends(self, uid: str, test_name: Optional[str] = None) -> list[TestTrendHistory]:
        """
        Build trend history for tracked tests across all stored reports.
        Returns list of trend timelines per test.
        """
        reports = self.get_reports(uid)
        # Build per-test timeline from stored test_values
        test_map: dict[str, list[tuple]] = {}  # canonical_name → [(ts, value, unit, status)]

        for report in reversed(reports):  # oldest first
            if not report.test_values:
                continue
            for tv in report.test_values:
                key = (tv.get("canonical_name") or tv.get("test_name", "unknown")).lower()
                if test_name and test_name.lower() not in key:
                    continue
                if key not in test_map:
                    test_map[key] = []
                test_map[key].append((
                    report.timestamp,
                    float(tv.get("value", 0)),
                    tv.get("unit", ""),
                    tv.get("status", "normal"),
                    tv.get("test_name", key),
                    tv.get("loinc_code"),
                ))

        results: list[TestTrendHistory] = []
        for key, points in test_map.items():
            if len(points) < 2:
                continue

            trend_points = [
                TrendPoint(timestamp=p[0], value=p[1], unit=p[2], status=p[3])
                for p in points
            ]

            # Direction
            first_val, last_val = points[0][1], points[-1][1]
            change = ((last_val - first_val) / max(abs(first_val), 0.001)) * 100
            if change > 5:    direction = "worsening" if points[-1][3] in ("high", "critical") else "increasing"
            elif change < -5: direction = "improving"  if points[0][3] in ("high", "critical") else "decreasing"
            else:              direction = "stable"

            results.append(TestTrendHistory(
                test_name=points[-1][4],
                loinc_code=points[-1][5],
                unit=points[-1][2],
                points=trend_points,
                direction=direction,
                latest_status=points[-1][3],
            ))

        return sorted(results, key=lambda t: len(t.points), reverse=True)


# ── Singleton store ────────────────────────────────────────────────────────────
profile_store = ProfileStore()
