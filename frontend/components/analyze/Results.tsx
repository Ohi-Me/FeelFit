'use client';
import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Badge, Card, SecHead, Collapse, Btn } from '@/components/ui/index';
import { STATUS_CFG, RISK_CFG, URGENCY_CFG } from '@/lib/constants';
import { FocusCard } from '@/components/analyze/FocusCard';
import { ProofBanner } from '@/components/analyze/ProofBanner';
import { share as nativeShare, haptic, isCapacitor, openExternal, copyToClipboard as nativeCopy } from '@/lib/native';
import type { AnalyzeResponse, ExtractedTest, AnalysisProfile } from '@/types';

// ── Mini Bar Chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ tests }: { tests: ExtractedTest[] }) {
  const abnormal = tests.filter(t => t.status !== 'normal');
  if (!abnormal.length) return null;
  const maxDev = Math.max(...abnormal.map(t => Math.abs(t.deviation_percent || 40)));
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
        Deviation from Reference Range
      </div>
      {abnormal.slice(0, 8).map((t, i) => {
        const cfg = STATUS_CFG[t.status];
        const pct = maxDev > 0 ? Math.min((Math.abs(t.deviation_percent || 0) / maxDev) * 100, 100) : 20;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 10, alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.test_name}</span>
            <div style={{ height: 7, background: 'var(--bd)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`, width: `${pct}%`, animation: `slideRight 0.8s ease ${i * 0.06}s both` }} />
            </div>
            <Badge color={cfg.color} bg={cfg.bg} style={{ fontSize: 9 }}>{cfg.label}</Badge>
          </div>
        );
      })}
    </div>
  );
}

// ── Print helper ──────────────────────────────────────────────────────────────
function printReport(result: AnalyzeResponse, profile: AnalysisProfile) {
  const a = result.analysis;
  const focus = result.focus;
  const doctors = result.doctors || [];
  const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c]);
  const date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const tests = result.extracted_tests || [];
  const counts = { normal: 0, low: 0, high: 0, critical: 0 };
  tests.forEach(t => { if (counts[t.status as keyof typeof counts] !== undefined) counts[t.status as keyof typeof counts]++; });
  // `printReport` is intentionally NOT async — the Capacitor branch uses
  // promise chains instead of await so the function signature stays the same
  // as the web build's (which uses synchronous window.open).
  // Semantic status colors are kept exactly as-is regardless of the premium gold
  // theme below — in a health report, color meaning (normal/low/high/critical)
  // must never be sacrificed for aesthetics.
  const riskHero: Record<string, { c: string; bg: string; label: string }> = {
    low:      { c: '#0a7c4a', bg: '#e8f7ef', label: 'Looks Healthy' },
    moderate: { c: '#a3681a', bg: '#fdf4e3', label: 'Worth Watching' },
    high:     { c: '#a8261d', bg: '#fcebe9', label: 'Needs Attention' },
  };
  const r = riskHero[a.risk_level] || riskHero.moderate;
  const statusColor: Record<string, string> = { normal: '#0a7c4a', low: '#a3681a', high: '#a8261d', critical: '#7a1411' };
  const stars = (rating: number) => '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FeelFit — ${esc(a.report_type)}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --ink: #0b0b0c; --ink2: #201c14; --gold: #b3902f; --gold-deep: #8a6d20;
  --gold-bg: #faf6e8; --gold-line: #e7dab0; --paper: #fffdf9;
}
body { font-family: 'Helvetica Neue', Arial, -apple-system, BlinkMacSystemFont, sans-serif; color: #201c14; background: var(--paper); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; min-height: 297mm; padding: 28mm 22mm; margin: 0 auto; background: var(--paper); border: 1px solid var(--gold-line); }
.cover { background: linear-gradient(135deg, var(--ink) 0%, var(--ink2) 100%); color: #fff; padding: 26mm 22mm; margin: -28mm -22mm 14mm; border-bottom: 3px solid var(--gold); position: relative; }
.cover::after { content: ''; position: absolute; left: 0; right: 0; bottom: -3px; height: 1px; background: linear-gradient(90deg, transparent, var(--gold), transparent); }
.brand { display: flex; align-items: center; gap: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; font-size: 11px; color: var(--gold); }
.brand-mark { width: 28px; height: 28px; border-radius: 8px; background: var(--gold); color: var(--ink); display: inline-flex; align-items: center; justify-content: center; font-weight: 900; font-size: 14px; }
.premium-badge { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; padding: 4px 11px; border-radius: 999px; border: 1px solid var(--gold); color: var(--gold); font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.cover-top { display: flex; align-items: center; }
.cover h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 30px; font-weight: 600; margin: 22px 0 6px; letter-spacing: -0.01em; line-height: 1.15; color: #fff; }
.cover .meta { font-size: 12px; color: rgba(255,255,255,0.65); }
.risk-pill { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; padding: 8px 16px; border-radius: 999px; background: ${r.bg}; color: ${r.c}; font-weight: 700; font-size: 12.5px; letter-spacing: 0.04em; text-transform: uppercase; }
.risk-pill::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: ${r.c}; }
.patient-row { display: flex; gap: 24px; margin-top: 18px; padding-top: 18px; border-top: 1px solid rgba(179,144,47,0.35); font-size: 12px; color: rgba(255,255,255,0.9); flex-wrap: wrap; }
.patient-row strong { display: block; font-size: 10px; color: var(--gold); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; font-weight: 600; }
.section { margin-bottom: 18px; }
.section-title { font-family: Georgia, serif; font-size: 16px; font-weight: 600; color: var(--ink); padding-bottom: 8px; border-bottom: 2px solid var(--gold); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
.section-title .count { font-size: 11px; font-weight: 600; color: var(--gold-deep); background: var(--gold-bg); padding: 3px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid var(--gold-line); }
.summary { font-size: 13.5px; line-height: 1.75; color: #2b2717; padding: 16px 18px; background: var(--gold-bg); border-left: 4px solid var(--gold); border-radius: 0 8px 8px 0; }
.focus-card { padding: 18px 20px; background: linear-gradient(135deg, var(--gold-bg) 0%, #fff 100%); border: 1px solid var(--gold-line); border-radius: 12px; }
.focus-card .eyebrow { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold-deep); margin-bottom: 8px; }
.focus-card h3 { font-family: Georgia, serif; font-size: 18px; font-weight: 600; margin-bottom: 6px; color: var(--ink); }
.focus-card .why { font-size: 12.5px; color: #4b5563; line-height: 1.6; margin-bottom: 12px; }
.focus-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
.focus-chips span { padding: 5px 11px; border-radius: 999px; background: #fff; border: 1px solid var(--gold-line); font-size: 11px; font-weight: 600; color: #4b5563; }
.plan-steps { list-style: none; counter-reset: s; }
.plan-steps li { counter-increment: s; padding-left: 30px; position: relative; font-size: 12.5px; line-height: 1.6; margin-bottom: 7px; color: #1f2937; }
.plan-steps li::before { content: counter(s); position: absolute; left: 0; top: 1px; width: 20px; height: 20px; border-radius: 50%; background: var(--gold); color: #fff; font-size: 10.5px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.findings { display: grid; gap: 8px; }
.finding { padding: 10px 14px; background: #faf9f5; border-left: 3px solid var(--gold); border-radius: 0 8px 8px 0; font-size: 12.5px; color: #1f2937; }
.test-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
.test-cell { padding: 12px 10px; border-radius: 10px; text-align: center; border: 1px solid #e5e7eb; }
.test-cell .num { font-family: Georgia, serif; font-size: 24px; font-weight: 700; line-height: 1; }
.test-cell .label { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 6px; }
.test-cell.normal { background: #e8f7ef; } .test-cell.normal .num, .test-cell.normal .label { color: #0a7c4a; }
.test-cell.low { background: #fdf4e3; } .test-cell.low .num, .test-cell.low .label { color: #a3681a; }
.test-cell.high { background: #fcebe9; } .test-cell.high .num, .test-cell.high .label { color: #a8261d; }
.test-cell.critical { background: #f5d6d2; } .test-cell.critical .num, .test-cell.critical .label { color: #7a1411; }
table.results { width: 100%; border-collapse: collapse; font-size: 12px; }
table.results th { text-align: left; padding: 10px 12px; background: var(--ink); color: var(--gold); font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 2px solid var(--gold); }
table.results th:first-child { border-radius: 8px 0 0 0; }
table.results th:last-child { border-radius: 0 8px 0 0; }
table.results td { padding: 10px 12px; border-bottom: 1px solid #f1ede0; }
table.results tr:last-child td { border-bottom: none; }
.status-pill { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
.recs { display: grid; gap: 6px; }
.recs li { list-style: none; padding: 9px 12px; padding-left: 32px; position: relative; font-size: 12.5px; color: #1f2937; background: #faf9f5; border-radius: 8px; line-height: 1.55; }
.recs li::before { content: '✓'; position: absolute; left: 12px; top: 9px; color: var(--gold-deep); font-weight: 800; }
.tip-groups { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.tip-group { padding: 14px; background: #faf9f5; border: 1px solid var(--gold-line); border-radius: 10px; }
.tip-group h4 { font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--gold-deep); margin-bottom: 9px; }
.tip-group ul { list-style: none; }
.tip-group li { font-size: 11.5px; line-height: 1.55; color: #2b2717; padding-left: 14px; position: relative; margin-bottom: 6px; }
.tip-group li::before { content: '–'; position: absolute; left: 0; color: var(--gold); }
.doctor-list { display: grid; gap: 8px; }
.doctor { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 14px; background: #faf9f5; border: 1px solid var(--gold-line); border-radius: 10px; }
.doctor .name { font-weight: 700; font-size: 13px; color: var(--ink); }
.doctor .meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
.doctor .rating { color: var(--gold-deep); font-size: 11px; font-weight: 700; white-space: nowrap; }
.followup { padding: 14px 16px; background: #faf9f5; border-radius: 8px; font-size: 12.5px; color: #1f2937; line-height: 1.6; border: 1px solid var(--gold-line); }
.followup strong { color: var(--ink); }
.footer { margin-top: 22px; padding-top: 14px; border-top: 1px solid var(--gold-line); font-size: 10.5px; color: #6b7280; text-align: center; line-height: 1.7; }
.footer .signature { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 8px; font-weight: 700; color: var(--ink); font-size: 11px; letter-spacing: 0.04em; }
.footer .signature::before, .footer .signature::after { content: ''; flex: 1; max-width: 50px; height: 1px; background: var(--gold-line); }
@media print { .page { padding: 18mm 18mm; border: none; } .cover { padding: 18mm 18mm; margin: -18mm -18mm 12mm; } }
</style></head><body>
<div class="page">
  <!-- COVER -->
  <div class="cover">
    <div class="cover-top">
      <div class="brand"><span class="brand-mark">F</span> FeelFit · Health Report</div>
      <div class="premium-badge">★ Premium Report</div>
    </div>
    <h1>${esc(a.report_type)}</h1>
    <div class="meta">${esc(date)} at ${esc(time)}${result.engine === 'gemini' ? ' · Premium AI extraction' : ''}</div>
    <div class="risk-pill">${esc(r.label)} · ${counts.high + counts.critical || 0} flagged</div>
    ${(profile.age || profile.gender || profile.conditions || profile.medications) ? `<div class="patient-row">
      ${profile.age ? `<div><strong>Age</strong>${esc(profile.age)}</div>` : ''}
      ${profile.gender ? `<div><strong>Gender</strong>${esc(profile.gender)}</div>` : ''}
      ${profile.conditions ? `<div><strong>Known conditions</strong>${esc(profile.conditions)}</div>` : ''}
      ${profile.medications ? `<div><strong>Medications</strong>${esc(profile.medications)}</div>` : ''}
    </div>` : ''}
  </div>

  <!-- SUMMARY -->
  <div class="section">
    <div class="section-title">Your Health Summary <span class="count">${Math.round((a.confidence || 0) * 100)}% confidence</span></div>
    <div class="summary">${esc(a.summary)}</div>
  </div>

  <!-- TEST OVERVIEW -->
  ${tests.length ? `<div class="section">
    <div class="section-title">Test Overview <span class="count">${tests.length} tests</span></div>
    <div class="test-grid">
      <div class="test-cell normal"><div class="num">${counts.normal}</div><div class="label">Normal</div></div>
      <div class="test-cell low"><div class="num">${counts.low}</div><div class="label">Low</div></div>
      <div class="test-cell high"><div class="num">${counts.high}</div><div class="label">High</div></div>
      <div class="test-cell critical"><div class="num">${counts.critical}</div><div class="label">Critical</div></div>
    </div>
  </div>` : ''}

  <!-- FOCUS -->
  ${focus ? `<div class="section">
    <div class="section-title">Your Focus This Cycle</div>
    <div class="focus-card">
      <div class="eyebrow">Move one number</div>
      <h3>${esc(focus.target)}</h3>
      <div class="why">${esc(focus.why)}</div>
      <div class="focus-chips">
        ${focus.current_value != null ? `<span>Now: ${esc(focus.current_value)}${focus.unit ? ' ' + esc(focus.unit) : ''} (${esc(focus.status)})</span>` : ''}
        <span>Retest by ${esc(new Date(focus.retest_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))} · ${focus.retest_weeks} weeks</span>
      </div>
      <ol class="plan-steps">${focus.plan.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    </div>
  </div>` : ''}

  <!-- KEY FINDINGS -->
  ${(a.key_findings || []).length ? `<div class="section">
    <div class="section-title">Key Findings <span class="count">${a.key_findings.length}</span></div>
    <div class="findings">${a.key_findings.map(f => `<div class="finding">${esc(f)}</div>`).join('')}</div>
  </div>` : ''}

  <!-- ALL TEST RESULTS -->
  ${tests.length ? `<div class="section">
    <div class="section-title">All Test Results <span class="count">${tests.length} tests</span></div>
    <table class="results">
      <thead><tr><th>Test</th><th>Value</th><th>Reference</th><th>Status</th></tr></thead>
      <tbody>
        ${tests.map(t => `<tr>
          <td><strong>${esc(t.test_name)}</strong>${t.category ? `<br/><span style="font-size:10px;color:#6b7280">${esc(t.category)}</span>` : ''}</td>
          <td style="font-family:Georgia,serif;font-weight:700;color:${statusColor[t.status] || '#1f2937'}">${esc(t.value)} <span style="color:#6b7280;font-weight:400;font-family:Helvetica,sans-serif;font-size:11px">${esc(t.unit || '')}</span></td>
          <td style="color:#6b7280">${t.normal_min != null && t.normal_max != null ? `${esc(t.normal_min)}–${esc(t.normal_max)}` : '—'}</td>
          <td><span class="status-pill" style="background:${statusColor[t.status]}18;color:${statusColor[t.status] || '#1f2937'}">${esc(t.status)}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- RECOMMENDATIONS -->
  ${(a.recommendations || []).length ? `<div class="section">
    <div class="section-title">Recommendations</div>
    <ul class="recs">${a.recommendations.map(rec => `<li>${esc(rec)}</li>`).join('')}</ul>
  </div>` : ''}

  <!-- LIFESTYLE -->
  ${(a.lifestyle_suggestions || []).length ? `<div class="section">
    <div class="section-title">Lifestyle Suggestions</div>
    <ul class="recs">${a.lifestyle_suggestions.map(rec => `<li>${esc(rec)}</li>`).join('')}</ul>
  </div>` : ''}

  <!-- DIET / EXERCISE / HABITS -->
  ${((a.diet_tips?.length || 0) + (a.exercise_tips?.length || 0) + (a.habit_tips?.length || 0)) ? `<div class="section">
    <div class="section-title">Diet, Exercise &amp; Daily Habits</div>
    <div class="tip-groups">
      ${(a.diet_tips?.length || 0) ? `<div class="tip-group"><h4>Diet</h4><ul>${a.diet_tips!.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${(a.exercise_tips?.length || 0) ? `<div class="tip-group"><h4>Exercise</h4><ul>${a.exercise_tips!.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
      ${(a.habit_tips?.length || 0) ? `<div class="tip-group"><h4>Daily Habits</h4><ul>${a.habit_tips!.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : ''}
    </div>
  </div>` : ''}

  <!-- NEARBY DOCTORS -->
  ${doctors.length ? `<div class="section">
    <div class="section-title">Nearby Doctors <span class="count">${doctors.length} found</span></div>
    <div class="doctor-list">
      ${doctors.slice(0, 5).map(d => `<div class="doctor">
        <div>
          <div class="name">${esc(d.name)}</div>
          <div class="meta">${esc(d.specialization)} · ${esc(d.clinic)}${d.distance_km != null ? ` · ${esc(d.distance_km)} km away` : ''}</div>
        </div>
        <div class="rating">${d.rating ? stars(d.rating) : ''} ${d.rating ? esc(d.rating.toFixed(1)) : ''}</div>
      </div>`).join('')}
    </div>
  </div>` : ''}

  <!-- FOLLOW-UP -->
  <div class="section">
    <div class="section-title">Follow-up Guidance</div>
    <div class="followup">
      ${esc(a.follow_up)}
      <br/><br/><strong>Recommended specialist:</strong> ${esc(a.required_specialization)}
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <div class="signature">Generated with care by FeelFit</div>
    Here to help you understand — not a medical diagnosis. Please partner with a qualified healthcare professional for medical decisions.<br/>
    Report ID: ${esc(result.job_id || '—')}
  </div>
</div>
</body></html>`;

  // ── Mobile (Capacitor): popups are blocked. We write the HTML to a Blob URL
  // and open it in the in-app browser, where the user can use the OS print
  // sheet (e.g., "Save to PDF" / AirPrint / "Print to cloud"). If the in-app
  // browser isn't available, fall back to the native share sheet with the
  // text summary. Uses promise chains (not await) so the function stays
  // synchronous for the web branch's window.open pattern.
  if (isCapacitor()) {
    const fallbackShare = () => {
      nativeShare({
        title: `${a.report_type} — FeelFit Report`,
        text: `${a.summary}\n\nKey findings:\n${(a.key_findings || []).join('\n')}`,
      });
    };
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      openExternal(url).then(() => {
        // Revoke after a delay to give the in-app browser time to load it.
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }).catch(() => {
        URL.revokeObjectURL(url);
        fallbackShare();
      });
    } catch {
      fallbackShare();
    }
    return;
  }

  // ── Web: open in a new tab and trigger window.print()
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400); }
}

// ── Main Results Component ────────────────────────────────────────────────────
interface ResultsProps {
  result: AnalyzeResponse;
  onReset: () => void;
  profile: AnalysisProfile;
  onUpgrade?: () => void;
}

export function Results({ result, onReset, profile, onUpgrade }: ResultsProps) {
  const { analysis, extracted_tests, processing_time_ms, loinc_matched, job_id, fallback_used, total_tests_found, extraction_quality, extraction_warning, cache_hit, downgraded, downgrade_message } = result;
  const [showExtracted, setShowExtracted] = useState(false);
  const [copied, setCopied] = useState(false);

  const risk = RISK_CFG[analysis.risk_level] ?? RISK_CFG.moderate;
  const urg = URGENCY_CFG[analysis.urgency] ?? URGENCY_CFG.routine;
  const abnormalCount = analysis.abnormal_tests?.length ?? 0;
  const verdict = analysis.risk_level === 'high'
    ? 'A few things worth discussing with a doctor'
    : analysis.risk_level === 'moderate'
    ? 'Some values worth keeping an eye on'
    : 'Mostly looking healthy';

  const handleCopy = async () => {
    // Use the native clipboard wrapper so it works on Capacitor (Preferences
    // plugin) and falls back to navigator.clipboard on web.
    const text = `${analysis.summary}\n\n${(analysis.key_findings || []).join('\n')}`;
    const ok = await nativeCopy(text);
    if (ok) {
      haptic('light');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} className="animate-fadeUp">

      {/* ── "Your number moved" — outcome proof on a re-test ── */}
      {result.progress?.proof?.improved && (
        <ProofBanner proof={result.progress.proof} daysElapsed={result.progress.days_elapsed} />
      )}

      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 11 }}>
            <Badge color={risk.color} bg={risk.bg}><Icon name="shield" size={10} /> {risk.label}</Badge>
            <Badge color={urg.color} bg={`${urg.color}15`}><Icon name="clock" size={10} /> {urg.label}</Badge>
            <Badge color="var(--txt3)" bg="var(--surf)"><Icon name="flask" size={10} /> {loinc_matched || 0} Tests Mapped</Badge>
            {total_tests_found > 0 && <Badge><Icon name="layers" size={10} /> {total_tests_found} tests</Badge>}
            {result.engine === 'gemini' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 100, fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'var(--askfit-grad)', color: '#fff' }}>
                <Icon name="sparkles" size={10} color="#fff" /> Premium AI Vision
              </span>
            )}
            
            
            
            {extraction_quality && (
              <Badge color={extraction_quality === 'good' ? 'var(--ok)' : extraction_quality === 'fair' ? 'var(--warn)' : 'var(--danger)'}>
                {extraction_quality === 'good' ? '✓ Good Scan' : extraction_quality === 'fair' ? 'Fair Scan' : 'Poor Scan'}
              </Badge>
            )}
          </div>
          <h1 style={{ fontFamily: 'var(--ff)', fontSize: 'clamp(1.6rem, 3.2vw, 2.35rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}>
            {analysis.report_type}
          </h1>
          
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isCapacitor() && (
            <Btn icon="external" variant="ghost" size="sm" onClick={async () => {
              haptic('select');
              const summary = analysis.summary || 'My FeelFit lab report analysis';
              await nativeShare({
                title: 'FeelFit Report',
                text: summary.slice(0, 280),
                url: window.location.href,
              });
            }}>
              <span className="hide-mobile">Share</span>
            </Btn>
          )}
          <Btn icon="printer" variant="ghost" size="sm" onClick={() => printReport(result, profile)}>
            <span className="hide-mobile">Print PDF</span>
          </Btn>
          <Btn icon={copied ? 'check' : 'copy'} variant="ghost" size="sm" onClick={handleCopy}
            style={{ color: copied ? 'var(--ok)' : undefined }}>
            <span className="hide-mobile">{copied ? 'Copied!' : 'Copy'}</span>
          </Btn>
          <Btn icon="refresh" variant="ghost" size="sm" onClick={onReset}>
            <span className="hide-mobile">New Report</span>
          </Btn>
        </div>
      </div>

      {/* Gemini (premium AI vision) was tried first but fell back to the standard
          model — tell the user plainly rather than silently serving a different
          accuracy tier than they might expect. */}
      {downgraded && downgrade_message && (
        <div className="animate-scaleIn" style={{
          marginBottom: '1rem', padding: '12px 18px',
          background: 'var(--surf2)', border: '1px dashed var(--bd2)',
          borderRadius: 'var(--rm)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13.5,
        }}>
          <Icon name="info" size={14} color="var(--txt3)" />
          <span style={{ color: 'var(--txt2)', flex: 1, minWidth: 200 }}>{downgrade_message}</span>
          {onUpgrade && !result.usage?.is_paid && (
            <Btn size="sm" variant="primary" icon="zap" onClick={onUpgrade}>Upgrade</Btn>
          )}
        </div>
      )}

      {/* Extraction warning */}
      {extraction_warning && (
        <div className="animate-scaleIn" style={{
          marginBottom: '1rem', padding: '12px 18px',
          background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)',
          borderRadius: 'var(--rm)', display: 'flex', gap: 9, alignItems: 'center', fontSize: 13.5,
        }}>
          <Icon name="warning" size={14} color="var(--warn)" />
          <span style={{ color: 'var(--txt2)' }}>{extraction_warning}</span>
        </div>
      )}

      {/* Critical Alerts */}
      {(analysis.alerts?.length ?? 0) > 0 && (
        <div className="animate-scaleIn" style={{
          marginBottom: '1.25rem', padding: '1.25rem 1.5rem',
          background: 'var(--crit-bg)', border: '2px solid var(--crit-bd)', borderRadius: 'var(--rl)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, fontFamily: 'var(--ff)', fontWeight: 700, color: 'var(--crit)', fontSize: '0.95rem' }}>
            <Icon name="alert" size={17} color="var(--crit)" /> Critical Alerts — Seek Medical Attention
          </div>
          {analysis.alerts!.map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 13.5 }}>
              <span style={{ color: 'var(--crit)', fontWeight: 700, flexShrink: 0 }}>⚠ {a.test_name}:</span>
              <span style={{ color: 'var(--txt2)' }}>{a.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Verdict hero — calm, human */}
      <div className="glass-panel-elevated animate-fadeUp" style={{
        borderRadius: 'var(--rxl)', padding: 'clamp(1.5rem, 4vw, 2.5rem)', marginBottom: '1.25rem',
        position: 'relative', overflow: 'hidden', borderLeft: `3px solid ${risk.color}`,
      }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 0% 0%, ${risk.color}14 0%, transparent 55%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, marginBottom: 10, letterSpacing: '0.02em' }}>{analysis.report_type}</div>
          <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 16, color: 'var(--txt)' }}>
            {verdict}
          </h2>
          <p style={{ fontSize: '1.02rem', color: 'var(--txt2)', lineHeight: 1.8, maxWidth: 680, marginBottom: 20 }}>{analysis.summary}</p>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: risk.bg, border: `1px solid ${risk.color}40`, fontSize: 12.5, fontWeight: 700, color: risk.color }}>
              <Icon name="shield" size={12} color={risk.color} /> {risk.label}
            </span>
            {abnormalCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd)', fontSize: 12.5, fontWeight: 600, color: 'var(--txt2)' }}>
                <Icon name="alert" size={12} color="var(--txt3)" /> {abnormalCount} value{abnormalCount !== 1 ? 's' : ''} to review
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd)', fontSize: 12.5, fontWeight: 600, color: 'var(--txt2)' }}>
              <Icon name="check_circle" size={12} color="var(--ok)" /> {Math.round(analysis.confidence * 100)}% confidence
            </span>
          </div>
        </div>
      </div>

      {/* ── "Move One Number" focus — the outcome to improve this cycle ── */}
      {result.focus && <FocusCard focus={result.focus} />}

      {/* Stats grid */}
      {(extracted_tests?.length ?? 0) > 0 && (
        <Card style={{ marginBottom: '1.25rem', padding: '1.5rem' }}>
          <SecHead icon="chart">Test Overview</SecHead>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 4 }}>
            {(['normal', 'low', 'high', 'critical'] as const).map(s => {
              const cfg = STATUS_CFG[s];
              const count = extracted_tests!.filter(t => t.status === s).length;
              return (
                <div key={s} style={{ padding: '12px', background: cfg.bg, border: `1px solid ${cfg.bd}`, borderRadius: 'var(--rm)', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--ff)', fontSize: 28, fontWeight: 700, color: cfg.color, animation: 'countUp 0.5s ease both' }}>{count}</div>
                  <div style={{ fontSize: 9.5, color: cfg.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 2 }}>{s}</div>
                </div>
              );
            })}
          </div>
          <MiniBarChart tests={extracted_tests!} />
        </Card>
      )}

      {/* 2-col grid — left column stacks the shorter sections so the tall
          Abnormal Values list on the right never leaves an empty gap. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', gap: '1.1rem', marginBottom: '1.1rem', alignItems: 'start' }}>

        {/* LEFT: Key Findings + Recommendations + Lifestyle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <Collapse title="Key Findings" icon="target" defaultOpen count={analysis.key_findings?.length}>
            {(analysis.key_findings || []).map((f, i) => (
              <div key={i} className={`animate-fadeIn delay-${Math.min(i + 1, 5) as 1}`} style={{
                display: 'flex', gap: 9, padding: '9px 12px',
                background: 'var(--bg2)', borderRadius: 'var(--r)', marginBottom: 7, fontSize: 13.5, lineHeight: 1.65,
              }}>
                <Icon name="chevright" size={13} color="var(--accent)" />
                <span style={{ color: 'var(--txt2)' }}>{f}</span>
              </div>
            ))}
          </Collapse>

          <Collapse title="Recommendations" icon="check" defaultOpen count={analysis.recommendations?.length}>
            {(analysis.recommendations || []).map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 0', borderBottom: i < analysis.recommendations.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--glow2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Icon name="chevright" size={10} color="var(--accent)" />
                </div>
                <span style={{ color: 'var(--txt2)', fontSize: 13.5, lineHeight: 1.65 }}>{r}</span>
              </div>
            ))}
          </Collapse>

          <Collapse title="Lifestyle Suggestions" icon="heart" count={analysis.lifestyle_suggestions?.length}>
            {(analysis.lifestyle_suggestions || []).map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, padding: '9px 0', borderBottom: i < analysis.lifestyle_suggestions.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--ok-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Icon name="check" size={10} color="var(--ok)" />
                </div>
                <span style={{ color: 'var(--txt2)', fontSize: 13.5, lineHeight: 1.65 }}>{s}</span>
              </div>
            ))}
          </Collapse>

          {((analysis.diet_tips?.length ?? 0) + (analysis.exercise_tips?.length ?? 0) + (analysis.habit_tips?.length ?? 0)) > 0 && (
            <Collapse title="Diet, Exercise & Daily Habits" icon="salad"
              count={(analysis.diet_tips?.length ?? 0) + (analysis.exercise_tips?.length ?? 0) + (analysis.habit_tips?.length ?? 0)}>
              {[
                { key: 'diet', label: 'Diet', icon: 'salad', color: 'var(--ok)', items: analysis.diet_tips },
                { key: 'exercise', label: 'Exercise', icon: 'dumbbell', color: 'var(--accent)', items: analysis.exercise_tips },
                { key: 'habits', label: 'Daily Habits', icon: 'clock', color: 'var(--askfit)', items: analysis.habit_tips },
              ].filter(g => (g.items?.length ?? 0) > 0).map((g, gi) => (
                <div key={g.key} style={{ marginBottom: gi < 2 ? 14 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, fontSize: 11.5, fontWeight: 700, color: g.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    <Icon name={g.icon} size={13} color={g.color} /> {g.label}
                  </div>
                  {g.items!.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: 9, padding: '7px 0', borderBottom: i < g.items!.length - 1 ? '1px solid var(--bd)' : 'none' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: `${g.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                        <Icon name={g.icon} size={9} color={g.color} />
                      </div>
                      <span style={{ color: 'var(--txt2)', fontSize: 13.5, lineHeight: 1.65 }}>{s}</span>
                    </div>
                  ))}
                </div>
              ))}
            </Collapse>
          )}
        </div>

        {/* RIGHT: Abnormal Values (tall) */}
        {(analysis.abnormal_tests?.length ?? 0) > 0 && (
          <Collapse title="Abnormal Values" icon="alert" defaultOpen count={analysis.abnormal_tests?.length}>
            {analysis.abnormal_tests?.map((t, i) => {
              const cfg = STATUS_CFG[t.status] ?? STATUS_CFG.normal;
              return (
                <div key={i} style={{ padding: '11px 13px', borderRadius: 'var(--r)', background: cfg.bg, border: `1px solid ${cfg.bd}`, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon name={cfg.icon} size={13} color={cfg.color} />
                      {t.test_name}
                      
                    </span>
                    <Badge color={cfg.color} bg={cfg.bg}>{cfg.label}</Badge>
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 13, marginBottom: t.clinical_note ? 5 : 0 }}>
                    <span style={{ fontFamily: 'var(--fm)', color: cfg.color, fontWeight: 700 }}>{t.value} {t.unit}</span>
                    {t.normal_range && <span style={{ color: 'var(--txt3)' }}>ref: {t.normal_range}</span>}
                    {t.specialty && <span style={{ color: 'var(--accent)', fontSize: 11 }}>{t.specialty}</span>}
                  </div>
                  {t.clinical_note && <div style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.65 }}>{t.clinical_note}</div>}
                </div>
              );
            })}
          </Collapse>
        )}
      </div>

      {/* NLP Table */}
      {(extracted_tests?.length ?? 0) > 0 && (
        <Card style={{ marginBottom: '1.1rem', padding: '1.5rem' }}>
          <SecHead icon="layers" right={
            <Btn size="sm" variant="ghost" icon="eye" onClick={() => setShowExtracted(s => !s)}>
              {showExtracted ? 'Hide' : 'View All'} Tests
            </Btn>
          }>
            All Test Results — {extracted_tests!.filter(t => t.loinc_code).length}/{extracted_tests!.length} Tests Standardized
          </SecHead>
          {showExtracted && (
            <div style={{ overflowX: 'auto' }} className="animate-fadeIn">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                    {['LOINC', 'Test Name', 'Value', 'Unit', 'Normal Range', 'Status', 'Deviation', 'Category'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--txt3)', fontWeight: 700, fontFamily: 'var(--fm)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {extracted_tests!.map((t, i) => {
                    const cfg = STATUS_CFG[t.status] ?? STATUS_CFG.normal;
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--bd)', background: i % 2 ? 'var(--surf)' : 'transparent' }}>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--fm)', color: 'var(--txt4)', fontSize: 9.5 }}>{t.loinc_code || '—'}</td>
                        <td style={{ padding: '8px 10px', fontWeight: 600 }}>{t.test_name}</td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--fm)', color: cfg.color, fontWeight: 700 }}>{t.value}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--txt3)', fontFamily: 'var(--fm)' }}>{t.unit || '—'}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--txt2)' }}>{t.normal_min != null ? `${t.normal_min}–${t.normal_max}` : '—'}</td>
                        <td style={{ padding: '8px 10px' }}><Badge color={cfg.color} bg={cfg.bg}>{cfg.label}</Badge></td>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--fm)', fontSize: 11, color: (t.deviation_percent ?? 0) > 0 ? 'var(--danger)' : (t.deviation_percent ?? 0) < 0 ? 'var(--warn)' : 'var(--txt3)' }}>
                          {t.deviation_percent != null ? `${t.deviation_percent > 0 ? '+' : ''}${t.deviation_percent}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 10px', color: 'var(--txt3)', fontSize: 11 }}>{t.category || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Trends */}
      {(analysis.trends?.length ?? 0) > 0 && (
        <Card style={{ marginBottom: '1.1rem', padding: '1.5rem' }}>
          <SecHead icon="layers">Trend Analysis (vs Previous Report)</SecHead>
          {analysis.trends?.map((t, i) => {
            const dirColor = t.direction === 'increasing' ? 'var(--danger)' : t.direction === 'decreasing' ? 'var(--warn)' : 'var(--ok)';
            return (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 13px', background: 'var(--bg2)', borderRadius: 'var(--r)', marginBottom: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${dirColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name={t.direction === 'increasing' ? 'trend_up' : t.direction === 'decreasing' ? 'trend_down' : 'minus'} size={13} color={dirColor} />
                </div>
                <div style={{ fontSize: 13.5 }}>
                  <strong>{t.test_name}</strong>
                  <span style={{ color: 'var(--txt2)', marginLeft: 8 }}>{t.summary}</span>
                  {t.change_percent != null && (
                    <span style={{ marginLeft: 8, fontFamily: 'var(--fm)', fontSize: 11, color: dirColor }}>
                      ({t.change_percent > 0 ? '+' : ''}{t.change_percent}%)
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Follow-up + Specialist */}
      <Card style={{ marginBottom: '1.1rem', padding: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
          <div>
            <SecHead icon="clock">Follow-up Guidance</SecHead>
            <p style={{ color: 'var(--txt2)', fontSize: 13.5, lineHeight: 1.78 }}>{analysis.follow_up}</p>
          </div>
          <div>
            <SecHead icon="stethoscope">Recommended Specialist</SecHead>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--glow2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent)25' }}>
                <Icon name="stethoscope" size={22} color="var(--accent)" />
              </div>
              <div>
                <p style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.05rem', fontFamily: 'var(--ff)' }}>{analysis.required_specialization}</p>
                <p style={{ fontSize: 12, color: 'var(--txt3)' }}>Consult for proper interpretation</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Disclaimer */}
      <div style={{ padding: '14px 18px', borderRadius: 'var(--rm)', background: 'var(--surf)', border: '1px solid var(--bd)', display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: '3rem' }}>
        <Icon name="info" size={15} color="var(--txt3)" />
        <p style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.72 }}>
          <strong style={{ color: 'var(--txt2)' }}>Here to help you understand.</strong> FeelFit shares general health insights using LOINC-standardized reference ranges — a friendly companion to your care, not a medical diagnosis, treatment plan, or prescription. Always partner with a qualified healthcare professional for medical decisions.
        </p>
      </div>
    </div>
  );
}
