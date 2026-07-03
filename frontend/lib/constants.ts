// FeelFit v8 — UI Constants & Configs
import type { RiskLevel, TestStatus, Urgency, InteractionSeverity } from '@/types';

export const STATUS_CFG: Record<TestStatus, { color: string; bg: string; bd: string; label: string; icon: string }> = {
  low:      { color: 'var(--warn)',   bg: 'var(--warn-bg)',   bd: 'var(--warn-bd)',   label: 'LOW',      icon: 'trend_down' },
  normal:   { color: 'var(--ok)',     bg: 'var(--ok-bg)',     bd: 'var(--ok-bd)',     label: 'NORMAL',   icon: 'check'      },
  high:     { color: 'var(--danger)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)', label: 'HIGH',     icon: 'trend_up'   },
  critical: { color: 'var(--crit)',   bg: 'var(--crit-bg)',   bd: 'var(--crit-bd)',   label: 'CRITICAL', icon: 'alert'      },
};

export const RISK_CFG: Record<RiskLevel, { color: string; bg: string; label: string }> = {
  low:      { color: 'var(--ok)',     bg: 'var(--ok-bg)',     label: 'Low Risk'      },
  moderate: { color: 'var(--warn)',   bg: 'var(--warn-bg)',   label: 'Moderate Risk' },
  high:     { color: 'var(--danger)', bg: 'var(--danger-bg)', label: 'High Risk'     },
};

export const URGENCY_CFG: Record<Urgency, { color: string; label: string }> = {
  routine:  { color: 'var(--ok)',     label: 'Routine follow-up'      },
  soon:     { color: 'var(--warn)',   label: 'See doctor soon'         },
  urgent:   { color: 'var(--crit)',   label: 'Urgent — seek care now'  },
};

export const SEVERITY_CFG: Record<InteractionSeverity, { color: string; label: string }> = {
  minor:    { color: 'var(--ok)',     label: 'Minor'    },
  moderate: { color: 'var(--warn)',   label: 'Moderate' },
  major:    { color: 'var(--danger)', label: 'Major'    },
  unknown:  { color: 'var(--txt3)',   label: 'Unknown'  },
};

export const SPECIALIZATIONS = [
  'General Physician', 'Endocrinologist', 'Cardiologist', 'Diabetologist',
  'Nephrologist', 'Hematologist', 'Gastroenterologist', 'Neurologist',
  'Pulmonologist', 'Rheumatologist', 'Oncologist', 'Dermatologist',
  'Orthopedist', 'Pediatrician', 'Gynecologist', 'Urologist',
];

export const DRUG_CATEGORIES = [
  { name: 'Antidiabetic',     icon: '🩸', meds: ['Metformin', 'Glimepiride', 'Insulin', 'Sitagliptin', 'Empagliflozin'] },
  { name: 'Antihypertensive', icon: '❤️', meds: ['Amlodipine', 'Losartan', 'Atenolol', 'Ramipril', 'Telmisartan'] },
  { name: 'Thyroid',          icon: '🦋', meds: ['Levothyroxine', 'Carbimazole', 'Methimazole', 'Propylthiouracil'] },
  { name: 'Cardiovascular',   icon: '💊', meds: ['Atorvastatin', 'Rosuvastatin', 'Aspirin', 'Clopidogrel', 'Bisoprolol'] },
  { name: 'Antibiotics',      icon: '🦠', meds: ['Amoxicillin', 'Azithromycin', 'Ciprofloxacin', 'Doxycycline'] },
  { name: 'Pain & Inflammation', icon: '💙', meds: ['Paracetamol', 'Ibuprofen', 'Diclofenac', 'Naproxen', 'Celecoxib'] },
  { name: 'Supplements',      icon: '🌿', meds: ['Vitamin D3', 'Vitamin B12', 'Iron', 'Calcium', 'Omega-3', 'Folate'] },
  { name: 'Gastric',          icon: '🫁', meds: ['Omeprazole', 'Pantoprazole', 'Ondansetron', 'Domperidone', 'Rabeprazole'] },
];

export const PIPELINE_STEPS = [
  'Upload', 'Validate', 'Extract', 'Clean',
  'NLP', 'LOINC', 'Enrich', 'LLM', 'Validate', 'Respond',
];

export const ANALYZING_STEPS = [
  'Validating your file...',
  'Checking previous results...',
  'Reading your report with OCR...',
  'Identifying test values...',
  'Matching tests to medical standards...',
  'Checking against reference ranges...',
  'Personalizing insights for your profile...',
  'AI reasoning over your results...',
  'Safety-checking the response...',
  'Preparing your health summary...',
];
