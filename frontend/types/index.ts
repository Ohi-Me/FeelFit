// FeelFit v8 — Shared TypeScript Types

export type RiskLevel = 'low' | 'moderate' | 'high';
export type TestStatus = 'low' | 'normal' | 'high' | 'critical';
export type Urgency = 'routine' | 'soon' | 'urgent';
export type InteractionSeverity = 'minor' | 'moderate' | 'major' | 'unknown';
export type ExtractionQuality = 'good' | 'fair' | 'poor' | 'empty';
export type HealthGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export interface ExtractedTest {
  loinc_code: string | null;
  test_name: string;
  canonical_name?: string;
  raw_name: string;
  value: number;
  unit: string;
  normal_min?: number;
  normal_max?: number;
  status: TestStatus;
  deviation_percent?: number;
  clinical_note?: string;
  category?: string;
  specialty?: string;
}

export interface AbnormalTest {
  loinc_code?: string;
  test_name: string;
  value: number;
  unit: string;
  normal_range?: string;
  status: TestStatus;
  clinical_note: string;
  specialty?: string;
}

export interface TestTrend {
  test_name: string;
  direction: 'increasing' | 'decreasing' | 'stable' | 'improving' | 'worsening';
  previous_value?: number;
  current_value: number;
  unit: string;
  summary: string;
  change_percent?: number;
}

export interface Alert {
  test_name: string;
  loinc_code?: string;
  message: string;
  urgency: string;
}

export interface AnalysisOutput {
  report_type: string;
  summary: string;
  risk_level: RiskLevel;
  confidence: number;
  key_findings: string[];
  abnormal_tests: AbnormalTest[];
  recommendations: string[];
  lifestyle_suggestions: string[];
  diet_tips?: string[];
  exercise_tips?: string[];
  habit_tips?: string[];
  follow_up: string;
  required_specialization: string;
  urgency: Urgency;
  trends?: TestTrend[];
  alerts?: Alert[];
}

export interface AnalyzeResponse {
  success: boolean;
  job_id: string;
  analysis: AnalysisOutput;
  extracted_tests?: ExtractedTest[];
  raw_text_preview?: string;
  processing_time_ms: number;
  loinc_matched: number;
  total_tests_found: number;
  fallback_used: boolean;
  cache_hit?: boolean;
  extraction_quality?: ExtractionQuality;
  extraction_warning?: string;
  file_type?: string;
  doctors?: DoctorResult[];
  focus?: HealthFocus | null;
  report_date?: string | null;
  health_timeline?: { report_date: string; job_id: string; n: number; abnormal: number }[] | null;
  progress?: HealthProgress | null;
  engine?: 'gemini' | 'parser' | 'csv_parser' | 'llm';
  downgraded?: boolean;
  downgrade_message?: string | null;
  usage?: { is_paid?: boolean } | null;
}

export interface HealthProof {
  baseline_value: number; baseline_date: string;
  latest_value: number; latest_date: string;
  delta: number; abs_delta: number;
  improved: boolean; now_in_range: boolean;
  unit?: string | null; label: string; direction: string;
}
export interface HealthProgress {
  days_elapsed: number; days_total: number; percent: number;
  streak: number; readings_count: number;
  proof?: HealthProof | null;
}

export interface HealthFocus {
  canonical: string;
  label: string;
  condition: string;
  current_value?: number | null;
  unit?: string | null;
  status?: string | null;
  ref_min?: number | null;
  ref_max?: number | null;
  target: string;
  why: string;
  plan: string[];
  retest_weeks: number;
  start_date: string;
  retest_date: string;
  other_flags?: string[];
}

export interface DoctorResult {
  name: string;
  specialization: string;
  clinic: string;
  rating: number;
  experience_years: number;
  address: string;
  phone: string;
  distance_km: number;
  availability: string;
  fees_inr: string;
  score: number;
  languages: string[];
}

export interface MedicineInfo {
  name: string;
  generic_name?: string;
  drug_class?: string;
  commonly_used_for: string[];
  how_it_works?: string;
  typical_dosage_info?: string;
  common_side_effects: string[];
  serious_side_effects: string[];
  general_warnings: string[];
  food_interactions: string[];
  storage?: string;
  otc_or_prescription?: 'OTC' | 'Prescription' | 'Both';
  drug_category?: string;
  typical_price_inr?: string;
  confidence: number;
  query?: string;
  error?: string;
}

export interface DrugInteraction {
  medicine_a: string;
  medicine_b: string;
  severity: InteractionSeverity;
  description: string;
  general_advice?: string;
}

export interface InteractionResult {
  medicines_checked: string[];
  interactions: DrugInteraction[];
  overall_note: string;
  disclaimer: string;
  error?: string;
}

export interface UserProfile {
  name?: string;
  email?: string;
  phone?: string;
  age?: number;
  gender?: string;
  blood_group?: string;
  known_conditions: string[];
  current_medications: string[];
  allergies: string[];
  height_cm?: number;
  weight_kg?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ReportSummary {
  job_id: string;
  report_type: string;
  risk_level: RiskLevel;
  confidence: number;
  timestamp: string;
  summary_preview: string;
  key_findings: string[];
  abnormal_count: number;
  total_tests: number;
  loinc_matched: number;
  test_values?: ExtractedTest[];
}

export interface TrendPoint {
  timestamp: string;
  value: number;
  unit: string;
  status: TestStatus;
}

export interface TestTrendHistory {
  test_name: string;
  loinc_code?: string;
  unit: string;
  points: TrendPoint[];
  direction: string;
  latest_status: TestStatus;
}

export interface HealthScore {
  score: number;
  grade: HealthGrade;
  label: string;
  color: string;
  breakdown: Record<string, number>;
  last_updated: string;
}

export interface DashboardData {
  profile: UserProfile | null;
  reports: ReportSummary[];
  score: HealthScore;
  trends: TestTrendHistory[];
  report_count: number;
}

export interface AnalysisProfile {
  age: string;
  gender: string;
  conditions: string;
  medications: string;
}

export type Tab = 'home' | 'analyze' | 'medicine' | 'doctors' | 'symptoms' | 'tools' | 'dashboard' | 'askfit' | 'about';
export type AnalyzeState = 'upload' | 'analyzing' | 'results';

// ── Medical RAG 2.0 — AskFit ──────────────────────────────────────────
export interface RagRetrievedDoc {
  id: string;
  source: string;
  title: string;
  text: string;
  score: number;
  matched_on: string[];
}
export interface RagCitation {
  doc_id: string;
  source: string;
  title: string;
  version: string;
  score: number;
}
export interface RagBundle {
  query: string;
  knowledge_version: string;
  retrieved_at: number;
  confidence: number;
  validation_status: 'evidence_supported' | 'partial_evidence' | 'insufficient_evidence';
  layers: Record<string, RagRetrievedDoc[]>;
  citations: RagCitation[];
  answer?: string | null;
}
