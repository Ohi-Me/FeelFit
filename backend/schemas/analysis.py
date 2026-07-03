"""
FeelFit v4 — Strict Pydantic Schemas
Multi-level validation: schema → value → consistency
"""
from __future__ import annotations
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator, model_validator


class RiskLevel(str, Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class TestStatus(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


class Urgency(str, Enum):
    ROUTINE = "routine"
    SOON = "soon"
    URGENT = "urgent"


# ── Blocked clinical phrases (safety) ─────────────────────────────────────────
_BLOCKED_PHRASES = [
    "diagnosed with", "you have", "prescribe", "take medication",
    "disease confirmed", "i diagnose", "you are suffering", "treatment is",
    "you need to take", "medication required",
]


class ExtractedTest(BaseModel):
    loinc_code: Optional[str] = None
    test_name: str
    canonical_name: Optional[str] = None
    raw_name: str
    value: float
    unit: str
    normal_min: Optional[float] = None
    normal_max: Optional[float] = None
    status: TestStatus
    deviation_percent: Optional[float] = None
    clinical_note: Optional[str] = None
    category: Optional[str] = None
    specialty: Optional[str] = None


class AbnormalTest(BaseModel):
    loinc_code: Optional[str] = None
    test_name: str
    value: float
    unit: str
    normal_range: Optional[str] = None
    status: TestStatus
    clinical_note: str
    specialty: Optional[str] = None

    @field_validator("clinical_note")
    @classmethod
    def no_clinical_diagnosis(cls, v: str) -> str:
        for phrase in _BLOCKED_PHRASES:
            if phrase in v.lower():
                raise ValueError(f"Disallowed clinical language detected: '{phrase}'")
        return v


class TestTrend(BaseModel):
    test_name: str
    direction: str  # increasing | decreasing | stable
    previous_value: Optional[float] = None
    current_value: float
    unit: str
    summary: str
    change_percent: Optional[float] = None


class Alert(BaseModel):
    test_name: str
    loinc_code: Optional[str] = None
    message: str
    urgency: str  # warning | critical


class UserProfile(BaseModel):
    age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[str] = None
    known_conditions: List[str] = []
    current_medications: List[str] = []
    historical_tests: Optional[List[dict]] = None  # for trend analysis


class AnalysisOutput(BaseModel):
    report_type: str
    summary: str = Field(..., min_length=20, max_length=1000)
    risk_level: RiskLevel
    confidence: float = Field(..., ge=0.0, le=1.0)
    key_findings: List[str] = Field(..., min_length=1)
    abnormal_tests: List[AbnormalTest] = []
    all_tests: Optional[List[ExtractedTest]] = None  # complete set read by the LLM from the report
    recommendations: List[str] = Field(..., min_length=1)
    lifestyle_suggestions: List[str] = []
    diet_tips: List[str] = []
    exercise_tips: List[str] = []
    habit_tips: List[str] = []
    follow_up: str
    required_specialization: str
    urgency: Urgency
    trends: Optional[List[TestTrend]] = None
    alerts: Optional[List[Alert]] = None

    @field_validator("summary")
    @classmethod
    def no_diagnosis_in_summary(cls, v: str) -> str:
        for phrase in _BLOCKED_PHRASES:
            if phrase in v.lower():
                raise ValueError(f"Disallowed clinical language in summary: '{phrase}'")
        return v

    @field_validator("key_findings", "recommendations")
    @classmethod
    def non_empty_lists(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("Field must have at least one item")
        return v

    @model_validator(mode="after")
    def high_risk_needs_evidence(self) -> "AnalysisOutput":
        if self.risk_level == RiskLevel.HIGH and not self.abnormal_tests and not self.alerts:
            raise ValueError("High risk must be backed by abnormal tests or alerts")
        return self

    @model_validator(mode="after")
    def urgent_needs_high_or_moderate_risk(self) -> "AnalysisOutput":
        if self.urgency == Urgency.URGENT and self.risk_level == RiskLevel.LOW:
            # Upgrade risk level automatically rather than fail
            object.__setattr__(self, "risk_level", RiskLevel.MODERATE)
        return self


class AnalyzeResponse(BaseModel):
    model_config = {"extra": "allow"}
    success: bool
    job_id: str
    analysis: Optional[AnalysisOutput] = None
    extracted_tests: Optional[List[ExtractedTest]] = None
    raw_text_preview: Optional[str] = None
    processing_time_ms: int
    loinc_matched: int = 0
    total_tests_found: int = 0
    error: Optional[str] = None
    fallback_used: bool = False
    cache_hit: bool = False
    extraction_quality: Optional[str] = None
    extraction_warning: Optional[str] = None


class DoctorResult(BaseModel):
    name: str
    specialization: str
    clinic: str
    rating: float = Field(..., ge=0, le=5)
    experience_years: int
    address: str
    phone: str
    distance_km: float
    availability: str
    fees_inr: str
    score: float = 0.0
    languages: List[str] = []


class DoctorResponse(BaseModel):
    specialization: str
    total_found: int
    doctors: List[DoctorResult]
    search_location: Optional[str] = None


class DoctorRequest(BaseModel):
    specialization: str
    lat: float = Field(default=30.9010, ge=-90, le=90)
    lng: float = Field(default=75.8573, ge=-180, le=180)
    max_distance_km: float = Field(default=15.0, ge=1, le=50)

# ── Extended response with cache + quality fields ──────────────────────────────
# (AnalyzeResponse updated inline in main.py via extra fields — Pydantic v2 allows extra)
