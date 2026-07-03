'use client';
import React, { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, SecHead, Badge, Btn } from '@/components/ui/index';

// ── BMI Calculator ─────────────────────────────────────────────────────────────
function BMICalculator() {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [result, setResult] = useState<{ bmi: number; category: string; color: string; meaning: string; tips: string[]; idealMin: number; idealMax: number } | null>(null);

  const calculate = () => {
    const h = parseFloat(height) / 100;
    const w = parseFloat(weight);
    if (!h || !w || h <= 0 || w <= 0) return;
    const bmi = parseFloat((w / (h * h)).toFixed(1));
    const idealMin = parseFloat((18.5 * h * h).toFixed(1));
    const idealMax = parseFloat((24.9 * h * h).toFixed(1));
    let category = '', color = '', meaning = '', tips: string[] = [];
    if      (bmi < 18.5) { category = 'Underweight';   color = 'var(--warn)';   meaning = 'A BMI below 18.5 suggests you may be carrying less weight than is ideal for your height — sometimes a sign your body needs more energy or nutrients.'; tips = ['Add nourishing, calorie-rich foods — nuts, dairy, bananas, nut butters', 'Build meals around protein: dal, eggs, paneer, chicken or fish', 'Strength-train to build healthy muscle, not just weight', 'If weight loss is unexplained, check in with your doctor']; }
    else if (bmi < 25)   { category = 'Normal Weight'; color = 'var(--ok)';     meaning = 'Your BMI sits in the healthy range for your height — a great place to be. The goal now is simply to keep it there.'; tips = ['Keep up the habits that are clearly working for you', 'Stay active — aim for 7–8k steps and 2 strength sessions a week', 'Fill half your plate with vegetables and enough protein', 'Protect 7–8 hours of sleep to keep metabolism steady']; }
    else if (bmi < 30)   { category = 'Overweight';    color = 'var(--warn)';   meaning = 'A BMI of 25–30 means a little extra weight for your height. It is very common and very manageable — small, steady changes add up fast.'; tips = ['A 10–15 minute walk after meals steadies blood sugar', 'Trim refined carbs and sugary drinks first — the easiest win', 'Lead each plate with protein and fibre, carbs last', 'Even 5% weight loss meaningfully lowers health risk']; }
    else                 { category = 'Obese';         color = 'var(--danger)'; meaning = 'A BMI above 30 suggests excess weight that can add strain on your heart, joints, and metabolism. The encouraging part: even a 5–10% drop brings big health wins.'; tips = ['Partner with your doctor on a sustainable plan', 'Aim for gradual loss of 0.5–1 kg per week — steady wins', 'Get blood sugar, blood pressure and cholesterol checked', 'Combine daily movement with strength training to protect muscle']; }
    setResult({ bmi, category, color, meaning, tips, idealMin, idealMax });
  };

  const bmiPct = result ? Math.min(((result.bmi - 10) / 30) * 100, 100) : 0;

  return (
    <Card style={{ padding: '1.5rem' }}>
      <SecHead icon="user">BMI Calculator</SecHead>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
        {[
          { label: 'Height (cm)', val: height, set: setHeight, ph: '170' },
          { label: 'Weight (kg)', val: weight, set: setWeight, ph: '70' },
        ].map(f => (
          <div key={f.label}>
            <label style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>{f.label}</label>
            <input type="number" placeholder={f.ph} value={f.val} onChange={e => { f.set(e.target.value); setResult(null); }}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--rm)', fontSize: 14 }} />
          </div>
        ))}
      </div>
      <Btn variant="primary" onClick={calculate} disabled={!height || !weight} style={{ width: '100%', justifyContent: 'center' }}>
        Calculate BMI
      </Btn>

      {result && (
        <div className="animate-scaleIn" style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontFamily: 'var(--ff)', fontWeight: 900, fontSize: '2.4rem', color: result.color }}>{result.bmi}</div>
              <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'var(--fm)' }}>kg/m²</div>
            </div>
            <Badge color={result.color} bg={`${result.color}12`} style={{ fontSize: 12 }}>{result.category}</Badge>
          </div>

          {/* BMI scale */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{ flex: 1, background: 'var(--warn)' }} />
              <div style={{ flex: 1.3, background: 'var(--ok)', boxShadow: '0 0 8px var(--ok-glow)' }} />
              <div style={{ flex: 1, background: 'var(--warn)' }} />
              <div style={{ flex: 1.5, background: 'var(--danger)' }} />
            </div>
            <div style={{ position: 'relative', height: 14 }}>
              <div style={{ position: 'absolute', left: `${bmiPct}%`, transform: 'translateX(-50%)', width: 2, height: 10, background: 'var(--txt)', borderRadius: 1 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--txt3)', fontFamily: 'var(--fm)' }}>
              <span>{'<'}18.5</span><span>18.5-25</span><span>25-30</span><span>{'>'}30</span>
            </div>
          </div>

          {/* What it means */}
          <div style={{ padding: '12px 14px', background: `${result.color}10`, border: `1px solid ${result.color}30`, borderRadius: 'var(--rm)', marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: result.color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>What this means</div>
            <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65 }}>{result.meaning}</p>
          </div>

          {/* Ideal weight range for this height */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', borderRadius: 'var(--rm)', marginBottom: 12, fontSize: 13 }}>
            <Icon name="target" size={15} color="var(--ok)" />
            <span style={{ color: 'var(--txt2)' }}>A healthy weight for your height is roughly <strong style={{ color: 'var(--ok)' }}>{result.idealMin}–{result.idealMax} kg</strong>.</span>
          </div>

          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>What to take care of</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {result.tips.map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '7px 10px', background: 'var(--bg2)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--txt2)' }}>
                <Icon name="check_circle" size={12} color={result.color} />{tip}
              </div>
            ))}
          </div>

          {/* Good to know */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, padding: '10px 13px', background: 'var(--surf2)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', fontSize: 11.5, color: 'var(--txt3)', lineHeight: 1.6 }}>
            <Icon name="info" size={13} color="var(--txt3)" />
            <span>BMI is a quick guide, not the full picture — it doesn’t account for muscle, age, or body type. For people of South Asian descent, risk can begin at a slightly lower BMI (~23). Pair it with how you feel and your doctor’s advice.</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Unit Converter ─────────────────────────────────────────────────────────────
const CONVERSIONS = [
  { label: 'mg/dL → mmol/L (Glucose)', from: 'mg/dL', to: 'mmol/L', factor: 0.0555, unit: 'Glucose' },
  { label: 'mg/dL → mmol/L (Cholesterol)', from: 'mg/dL', to: 'mmol/L', factor: 0.0259, unit: 'Cholesterol' },
  { label: 'µg/dL → pmol/L (Vitamin D)', from: 'µg/dL', to: 'nmol/L', factor: 2.496, unit: 'Vit D' },
  { label: 'ng/mL → IU/L (Vitamin D)', from: 'ng/mL', to: 'nmol/L', factor: 2.496, unit: 'Vit D' },
  { label: 'mg/dL → µmol/L (Creatinine)', from: 'mg/dL', to: 'µmol/L', factor: 88.42, unit: 'Creatinine' },
  { label: 'g/dL → g/L (Hemoglobin)', from: 'g/dL', to: 'g/L', factor: 10, unit: 'Hgb' },
];

function UnitConverter() {
  const [convIdx, setConvIdx] = useState(0);
  const [value, setValue] = useState('');
  const conv = CONVERSIONS[convIdx];
  const converted = value ? (parseFloat(value) * conv.factor).toFixed(3).replace(/\.?0+$/, '') : '';

  return (
    <Card style={{ padding: '1.5rem' }}>
      <SecHead icon="refresh">Unit Converter</SecHead>
      <p style={{ fontSize: 12.5, color: 'var(--txt3)', marginBottom: '1rem', lineHeight: 1.65 }}>
        Convert between common lab unit formats used by different labs.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>Conversion Type</label>
        <select value={convIdx} onChange={e => { setConvIdx(parseInt(e.target.value)); setValue(''); }}
          style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--rm)', fontSize: 13.5 }}>
          {CONVERSIONS.map((c, i) => <option key={i} value={i}>{c.label}</option>)}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end' }}>
        <div>
          <label style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>{conv.from}</label>
          <input type="number" placeholder="Enter value" value={value} onChange={e => setValue(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', borderRadius: 'var(--rm)', fontSize: 14 }} />
        </div>
        <div style={{ paddingBottom: 9 }}>
          <Icon name="arrow_r" size={18} color="var(--txt3)" />
        </div>
        <div>
          <label style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>{conv.to}</label>
          <div style={{ padding: '9px 12px', borderRadius: 'var(--rm)', background: 'var(--bg3)', border: '1px solid var(--bd)', fontSize: 14, fontFamily: 'var(--fm)', color: converted ? 'var(--ok)' : 'var(--txt3)', fontWeight: 700, minHeight: 42 }}>
            {converted || '—'}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ── Normal Ranges Reference ────────────────────────────────────────────────────
const REFERENCE_RANGES = [
  // ── CBC / Hematology ──────────────────────────────────────────────
  { test: 'Hemoglobin', male: '13.5–17.5 g/dL', female: '12.0–16.0 g/dL', category: 'CBC' },
  { test: 'RBC Count', male: '4.5–5.9 ×10⁶/µL', female: '4.0–5.2 ×10⁶/µL', category: 'CBC' },
  { test: 'WBC (Total Count)', male: '4.0–11.0 ×10³/µL', female: '4.0–11.0 ×10³/µL', category: 'CBC' },
  { test: 'Platelets', male: '150–400 ×10³/µL', female: '150–400 ×10³/µL', category: 'CBC' },
  { test: 'Hematocrit (PCV)', male: '40–52 %', female: '36–48 %', category: 'CBC' },
  { test: 'MCV', male: '80–100 fL', female: '80–100 fL', category: 'CBC' },
  { test: 'MCH', male: '27–33 pg', female: '27–33 pg', category: 'CBC' },
  { test: 'MCHC', male: '32–36 g/dL', female: '32–36 g/dL', category: 'CBC' },
  { test: 'RDW', male: '11.5–14.5 %', female: '11.5–14.5 %', category: 'CBC' },
  { test: 'Neutrophils', male: '40–75 %', female: '40–75 %', category: 'CBC' },
  { test: 'Lymphocytes', male: '20–45 %', female: '20–45 %', category: 'CBC' },
  { test: 'Eosinophils', male: '1–6 %', female: '1–6 %', category: 'CBC' },
  { test: 'ESR', male: '0–15 mm/hr', female: '0–20 mm/hr', category: 'Inflammation' },

  // ── Diabetes ──────────────────────────────────────────────────────
  { test: 'Fasting Blood Sugar', male: '70–100 mg/dL', female: '70–100 mg/dL', category: 'Diabetes' },
  { test: 'Postprandial (PP) Sugar', male: '<140 mg/dL', female: '<140 mg/dL', category: 'Diabetes' },
  { test: 'Random Blood Sugar', male: '<140 mg/dL', female: '<140 mg/dL', category: 'Diabetes' },
  { test: 'HbA1c', male: '<5.7 %', female: '<5.7 %', category: 'Diabetes' },
  { test: 'Fasting Insulin', male: '2–25 µIU/mL', female: '2–25 µIU/mL', category: 'Diabetes' },

  // ── Thyroid ───────────────────────────────────────────────────────
  { test: 'TSH', male: '0.4–4.0 mIU/L', female: '0.4–4.0 mIU/L', category: 'Thyroid' },
  { test: 'Free T4 (FT4)', male: '0.8–1.8 ng/dL', female: '0.8–1.8 ng/dL', category: 'Thyroid' },
  { test: 'Free T3 (FT3)', male: '2.3–4.2 pg/mL', female: '2.3–4.2 pg/mL', category: 'Thyroid' },
  { test: 'Total T4', male: '4.5–12.5 µg/dL', female: '4.5–12.5 µg/dL', category: 'Thyroid' },
  { test: 'Total T3', male: '80–200 ng/dL', female: '80–200 ng/dL', category: 'Thyroid' },

  // ── Lipid Profile ─────────────────────────────────────────────────
  { test: 'Total Cholesterol', male: '<200 mg/dL', female: '<200 mg/dL', category: 'Lipids' },
  { test: 'LDL Cholesterol', male: '<100 mg/dL', female: '<100 mg/dL', category: 'Lipids' },
  { test: 'HDL Cholesterol', male: '>40 mg/dL', female: '>50 mg/dL', category: 'Lipids' },
  { test: 'Triglycerides', male: '<150 mg/dL', female: '<150 mg/dL', category: 'Lipids' },
  { test: 'VLDL Cholesterol', male: '5–40 mg/dL', female: '5–40 mg/dL', category: 'Lipids' },
  { test: 'Non-HDL Cholesterol', male: '<130 mg/dL', female: '<130 mg/dL', category: 'Lipids' },

  // ── Kidney ────────────────────────────────────────────────────────
  { test: 'Creatinine', male: '0.7–1.3 mg/dL', female: '0.6–1.1 mg/dL', category: 'Kidney' },
  { test: 'Blood Urea', male: '15–40 mg/dL', female: '15–40 mg/dL', category: 'Kidney' },
  { test: 'BUN', male: '7–20 mg/dL', female: '7–20 mg/dL', category: 'Kidney' },
  { test: 'eGFR', male: '>90 mL/min/1.73m²', female: '>90 mL/min/1.73m²', category: 'Kidney' },
  { test: 'Uric Acid', male: '3.5–7.2 mg/dL', female: '2.6–6.0 mg/dL', category: 'Kidney' },

  // ── Liver Function ────────────────────────────────────────────────
  { test: 'ALT (SGPT)', male: '7–56 U/L', female: '7–45 U/L', category: 'Liver' },
  { test: 'AST (SGOT)', male: '8–48 U/L', female: '8–43 U/L', category: 'Liver' },
  { test: 'ALP', male: '44–147 U/L', female: '44–147 U/L', category: 'Liver' },
  { test: 'GGT', male: '8–61 U/L', female: '5–36 U/L', category: 'Liver' },
  { test: 'Total Bilirubin', male: '0.3–1.2 mg/dL', female: '0.3–1.2 mg/dL', category: 'Liver' },
  { test: 'Direct Bilirubin', male: '0.0–0.3 mg/dL', female: '0.0–0.3 mg/dL', category: 'Liver' },
  { test: 'Total Protein', male: '6.0–8.3 g/dL', female: '6.0–8.3 g/dL', category: 'Liver' },
  { test: 'Albumin', male: '3.5–5.0 g/dL', female: '3.5–5.0 g/dL', category: 'Liver' },

  // ── Iron Studies ──────────────────────────────────────────────────
  { test: 'Serum Iron', male: '65–175 µg/dL', female: '50–170 µg/dL', category: 'Iron' },
  { test: 'Ferritin', male: '30–400 ng/mL', female: '13–150 ng/mL', category: 'Iron' },
  { test: 'TIBC', male: '240–450 µg/dL', female: '240–450 µg/dL', category: 'Iron' },
  { test: 'Transferrin Saturation', male: '20–50 %', female: '15–50 %', category: 'Iron' },

  // ── Vitamins ──────────────────────────────────────────────────────
  { test: 'Vitamin D (25-OH)', male: '30–100 ng/mL', female: '30–100 ng/mL', category: 'Vitamins' },
  { test: 'Vitamin B12', male: '200–900 pg/mL', female: '200–900 pg/mL', category: 'Vitamins' },
  { test: 'Folate (Folic Acid)', male: '2.7–17.0 ng/mL', female: '2.7–17.0 ng/mL', category: 'Vitamins' },

  // ── Electrolytes & Minerals ───────────────────────────────────────
  { test: 'Sodium (Na)', male: '135–145 mEq/L', female: '135–145 mEq/L', category: 'Electrolytes' },
  { test: 'Potassium (K)', male: '3.5–5.1 mEq/L', female: '3.5–5.1 mEq/L', category: 'Electrolytes' },
  { test: 'Chloride (Cl)', male: '98–107 mEq/L', female: '98–107 mEq/L', category: 'Electrolytes' },
  { test: 'Calcium', male: '8.6–10.3 mg/dL', female: '8.6–10.3 mg/dL', category: 'Electrolytes' },
  { test: 'Magnesium', male: '1.7–2.2 mg/dL', female: '1.7–2.2 mg/dL', category: 'Electrolytes' },
  { test: 'Phosphorus', male: '2.5–4.5 mg/dL', female: '2.5–4.5 mg/dL', category: 'Electrolytes' },

  // ── Cardiac & Inflammation ────────────────────────────────────────
  { test: 'Troponin I', male: '<0.04 ng/mL', female: '<0.04 ng/mL', category: 'Cardiac' },
  { test: 'CRP', male: '<3.0 mg/L', female: '<3.0 mg/L', category: 'Inflammation' },
  { test: 'hs-CRP', male: '<1.0 mg/L', female: '<1.0 mg/L', category: 'Inflammation' },

  // ── Hormones ──────────────────────────────────────────────────────
  { test: 'Testosterone (Total)', male: '280–1100 ng/dL', female: '15–70 ng/dL', category: 'Hormones' },
  { test: 'Cortisol (morning)', male: '6–23 µg/dL', female: '6–23 µg/dL', category: 'Hormones' },
  { test: 'Prolactin', male: '4–15 ng/mL', female: '4–23 ng/mL', category: 'Hormones' },
];

function ReferenceRanges() {
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('All');
  const cats = ['All', ...new Set(REFERENCE_RANGES.map(r => r.category))];
  const filtered = REFERENCE_RANGES.filter(r =>
    (catFilter === 'All' || r.category === catFilter) &&
    r.test.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card style={{ padding: '1.5rem' }}>
      <SecHead icon="flask">Normal Range Reference</SecHead>
      <p style={{ fontSize: 12.5, color: 'var(--txt3)', marginBottom: '1rem', lineHeight: 1.65 }}>Common lab test reference ranges. Actual ranges may vary slightly by lab and methodology.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input placeholder="Search test..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 160, padding: '8px 12px', borderRadius: 'var(--rm)', fontSize: 13 }} />
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)}
              style={{ padding: '6px 12px', borderRadius: 100, cursor: 'pointer', fontSize: 12, fontWeight: catFilter === c ? 600 : 400, transition: 'all 0.16s',
                background: catFilter === c ? 'var(--ok-bg)' : 'var(--surf2)',
                border: `1px solid ${catFilter === c ? 'var(--ok)' : 'var(--bd)'}`,
                color: catFilter === c ? 'var(--ok)' : 'var(--txt2)' }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--bd)' }}>
              {['Test', 'Male', 'Female', 'Category'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--txt3)', fontWeight: 700, fontFamily: 'var(--fm)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 ? 'var(--surf)' : 'transparent' }}>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.test}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--txt2)' }}>{r.male}</td>
                <td style={{ padding: '8px 10px', fontFamily: 'var(--fm)', fontSize: 12.5, color: 'var(--txt2)' }}>{r.female}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd)', fontSize: 10.5, color: 'var(--txt3)' }}>{r.category}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ textAlign: 'center', color: 'var(--txt3)', padding: '1rem', fontSize: 13 }}>No tests match your filter.</p>}
      </div>

      <p style={{ marginTop: 10, fontSize: 11.5, color: 'var(--txt3)', lineHeight: 1.65 }}>
        ⚠ Reference ranges are guidelines. Your lab may use different ranges. Always interpret results with your doctor.
      </p>
    </Card>
  );
}

// ── Main Tools Tab ─────────────────────────────────────────────────────────────
export function HealthTools() {
  const [activeTool, setActiveTool] = useState<'bmi' | 'converter' | 'ranges'>('bmi');

  const tools = [
    { k: 'bmi' as const,       icon: 'scale',   label: 'BMI Calculator'     },
    { k: 'converter' as const, icon: 'refresh', label: 'Unit Converter'     },
    { k: 'ranges' as const,    icon: 'flask',   label: 'Normal Ranges'      },
  ];

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 800, fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 6 }}>Health Tools</h2>
        <p style={{ color: 'var(--txt2)', fontSize: 13.5 }}>Quick reference calculators and converters for common health metrics.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
        {tools.map(({ k, icon, label }) => (
          <button key={k} onClick={() => setActiveTool(k)}
            style={{ padding: '9px 18px', borderRadius: 'var(--rm)', fontSize: 13, fontWeight: activeTool === k ? 600 : 500, cursor: 'pointer', transition: 'all 0.18s', display: 'flex', alignItems: 'center', gap: 7,
              background: activeTool === k ? 'var(--ok-bg)' : 'var(--surf)',
              border: `1px solid ${activeTool === k ? 'var(--ok)' : 'var(--bd)'}`,
              color: activeTool === k ? 'var(--ok)' : 'var(--txt2)' }}>
            <Icon name={icon} size={13} color={activeTool === k ? 'var(--ok)' : 'var(--txt3)'} />
            {label}
          </button>
        ))}
      </div>

      {activeTool === 'bmi' && <BMICalculator />}
      {activeTool === 'converter' && <UnitConverter />}
      {activeTool === 'ranges' && <ReferenceRanges />}
    </div>
  );
}
