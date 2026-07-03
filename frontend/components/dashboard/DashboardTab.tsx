'use client';
import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, SecHead, Badge, Btn, Skeleton, Input, Select } from '@/components/ui/index';
import { AnimatedRing, AnimatedNumber, Stagger, StaggerItem, Reveal } from '@/components/ui/motion';
import { getDashboard, saveProfile, getLocalHistory } from '@/lib/api';
import { ProgramPanel } from '@/components/dashboard/ProgramPanel';
import type { DashboardData, TrendPoint, UserProfile } from '@/types';

// ── Health Score Ring ─────────────────────────────────────────────────────────
function HealthScoreRing({ score, grade, label, color }: { score: number; grade: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', width: 136, height: 136, flexShrink: 0 }}>
        <AnimatedRing value={score} size={136} strokeWidth={10} color={color} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'var(--ff)', fontWeight: 900, fontSize: '2.1rem', color, lineHeight: 1, textShadow: `0 0 20px ${color}50` }}>
            <AnimatedNumber value={score} duration={1.4} />
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--fm)', letterSpacing: '0.06em' }}>/ 100</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--ff)', fontSize: '2.6rem', fontWeight: 900, color, lineHeight: 1, textShadow: `0 0 24px ${color}60` }}>{grade}</div>
        <div style={{ fontFamily: 'var(--ff)', fontSize: '1.1rem', fontWeight: 700, marginTop: 4, marginBottom: 8 }}>{label}</div>
        <p style={{ fontSize: 12.5, color: 'var(--txt3)', maxWidth: 200, lineHeight: 1.65 }}>
          Based on your uploaded reports, risk levels, and profile completeness.
        </p>
      </div>
    </div>
  );
}

// ── Sparkline Chart ───────────────────────────────────────────────────────────
function SparkLine({ points }: { points: TrendPoint[] }) {
  if (!points || points.length < 2) return null;
  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const W = 100, H = 28;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * W;
    const y = H - ((p.value - min) / range) * H;
    return `${x},${y}`;
  });
  const statusColors: Record<string, string> = { normal: 'var(--ok)', low: 'var(--warn)', high: 'var(--danger)', critical: 'var(--crit)' };
  const lastColor = statusColors[points[points.length - 1]?.status] || 'var(--accent)';
  const last = coords[coords.length - 1].split(',');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <polyline points={coords.join(' ')} fill="none" stroke={lastColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="4.5" fill={lastColor} style={{filter: `drop-shadow(0 0 4px ${lastColor})`}} />
    </svg>
  );
}

// ── Profile Editor ────────────────────────────────────────────────────────────
function ProfileEditor({ initial, sessionId, onSave }: { initial: UserProfile | null; sessionId: string; onSave: () => void }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    age: initial?.age?.toString() || '',
    gender: initial?.gender || '',
    blood_group: initial?.blood_group || '',
    height_cm: initial?.height_cm?.toString() || '',
    weight_kg: initial?.weight_kg?.toString() || '',
    known_conditions: (initial?.known_conditions || []).join(', '),
    current_medications: (initial?.current_medications || []).join(', '),
    allergies: (initial?.allergies || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const data: Partial<UserProfile> = {
      name: form.name || undefined,
      age: form.age ? parseInt(form.age) : undefined,
      gender: form.gender || undefined,
      blood_group: form.blood_group || undefined,
      height_cm: form.height_cm ? parseFloat(form.height_cm) : undefined,
      weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : undefined,
      known_conditions: form.known_conditions ? form.known_conditions.split(',').map(s => s.trim()).filter(Boolean) : [],
      current_medications: form.current_medications ? form.current_medications.split(',').map(s => s.trim()).filter(Boolean) : [],
      allergies: form.allergies ? form.allergies.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    await saveProfile(sessionId, data);
    setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); onSave(); }, 1200);
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: '1rem' }}>
        <Input label="Full Name" placeholder="Your name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
        <Input label="Age" type="number" placeholder="32" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} />
        <Select label="Gender" value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
          options={[{ value: '', label: 'Select...' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
        <Input label="Blood Group" placeholder="A+, B-, O+..." value={form.blood_group} onChange={e => setForm(p => ({ ...p, blood_group: e.target.value }))} />
        <Input label="Height (cm)" type="number" placeholder="170" value={form.height_cm} onChange={e => setForm(p => ({ ...p, height_cm: e.target.value }))} />
        <Input label="Weight (kg)" type="number" placeholder="70" value={form.weight_kg} onChange={e => setForm(p => ({ ...p, weight_kg: e.target.value }))} />
      </div>
      {[
        { k: 'known_conditions', l: 'Known Conditions', p: 'diabetes, hypertension, thyroid...' },
        { k: 'current_medications', l: 'Current Medications', p: 'metformin, aspirin, levothyroxine...' },
        { k: 'allergies', l: 'Allergies', p: 'penicillin, sulfa, latex...' },
      ].map(f => (
        <div key={f.k} style={{ marginBottom: 12 }}>
          <Input label={f.l} placeholder={f.p}
            value={(form as Record<string, string>)[f.k]}
            onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Btn variant="primary" loading={saving} onClick={handleSave}>
          {saved ? '✓ Saved!' : 'Save Profile'}
        </Btn>
        <p style={{ fontSize: 12, color: 'var(--txt3)' }}>Stored locally for personalized insights</p>
      </div>
    </div>
  );
}

// ── Dashboard Tab ─────────────────────────────────────────────────────────────
interface DashboardTabProps {
  sessionId: string;
  onUploadClick: () => void;
}

export function DashboardTab({ sessionId, onUploadClick }: DashboardTabProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editProfile, setEditProfile] = useState(false);

  const riskBadge: Record<string, { color: string; bg: string }> = {
    low:      { color: 'var(--ok)',     bg: 'var(--ok-bg)'     },
    moderate: { color: 'var(--warn)',   bg: 'var(--warn-bg)'   },
    high:     { color: 'var(--danger)', bg: 'var(--danger-bg)' },
  };

  const load = async () => {
    setLoading(true);
    const d = await getDashboard(sessionId);
    if (d) {
      setData(d);
    } else {
      // Build from local history (using the api.ts helper which works on both
      // web and Capacitor — handles the localStorage path consistently).
      const hist = getLocalHistory();
      const scoreMap: Record<string, { score: number; grade: import('@/types').HealthGrade; label: string; color: string }> = {
        low:      { score: 82, grade: 'A',  label: 'Good',            color: 'var(--ok)'     },
        moderate: { score: 58, grade: 'B',  label: 'Fair',            color: 'var(--warn)'   },
        high:     { score: 38, grade: 'C',  label: 'Needs Attention', color: 'var(--danger)' },
      };
      const latestRisk = hist[0]?.risk_level || 'low';
      const sc = scoreMap[latestRisk] || scoreMap.low;
      setData({
        profile: null, reports: hist.slice(0, 5), report_count: hist.length,
        trends: [],
        score: { ...sc, breakdown: {}, last_updated: new Date().toISOString() },
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [sessionId]);

  if (loading) return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      {[200, 280, 160].map((h, i) => <Skeleton key={i} height={h} style={{ marginBottom: '1.1rem', borderRadius: 'var(--rl)' }} />)}
    </div>
  );

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>

      {/* ── 90-day "Move One Number" program (shows once you have a focus) ── */}
      <ProgramPanel onUpload={onUploadClick} />

      {/* Health Score */}
      <Card glow style={{ marginBottom: '1.25rem', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: 12 }}>
          <SecHead icon="activity">
            Health Score
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--fm)', marginLeft: 8 }}>
              {data?.report_count || 0} report{data?.report_count !== 1 ? 's' : ''} analyzed
            </span>
          </SecHead>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm" variant="ghost" icon="refresh" onClick={load}>Refresh</Btn>
          </div>
        </div>

        {data?.score && data.score.score > 0 && (data?.report_count ?? 0) > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2.5rem', alignItems: 'center' }}>
            <HealthScoreRing score={data.score.score} grade={data.score.grade} label={data.score.label} color={data.score.color || 'var(--accent)'} />
            {data.score.breakdown && Object.keys(data.score.breakdown).length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>Score Breakdown</div>
                {Object.entries(data.score.breakdown).map(([k, v]) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '165px 1fr 32px', gap: 10, alignItems: 'center', marginBottom: 9 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--txt2)', textTransform: 'capitalize' }}>{k.replace(/_/g, ' ')}</span>
                    <div style={{ height: 6, background: 'var(--bd)', borderRadius: 3 }}>
                      <div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--accent), var(--accent2))', width: `${(v / 40) * 100}%`, transition: 'width 1.2s ease' }} />
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--accent)', fontFamily: 'var(--fm)', textAlign: 'right', fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--txt3)' }}>
            <Icon name="activity" size={44} color="var(--bd2)" />
            <p style={{ marginTop: 14, fontSize: 14, marginBottom: 16 }}>Upload your first report to get a health score</p>
            <Btn variant="primary" icon="upload" onClick={onUploadClick}>Upload Report</Btn>
          </div>
        )}
      </Card>

      {/* Reports + Trends */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.1rem', marginBottom: '1.25rem' }}>

        {/* Report History */}
        <Card style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <SecHead icon="history">Report History</SecHead>
            <span style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--fm)' }}>{data?.report_count || 0} total</span>
          </div>
          {!data?.reports?.length ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--txt3)', fontSize: 13 }}>
              Ready when you are — upload your first report to start tracking your progress.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.reports.map((r, i) => {
                const rb = riskBadge[r.risk_level] || riskBadge.moderate;
                return (
                  <div key={i} style={{ padding: '11px 13px', background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}>{r.report_type}</div>
                        <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                          {r.timestamp ? new Date(r.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          {r.total_tests > 0 && <span style={{ marginLeft: 8 }}>· {r.total_tests} tests · {r.abnormal_count} abnormal</span>}
                        </div>
                      </div>
                      <Badge color={rb.color} bg={rb.bg} style={{ flexShrink: 0, marginLeft: 8, fontSize: 9.5 }}>
                        {r.risk_level?.toUpperCase()}
                      </Badge>
                    </div>
                    {r.summary_preview && (
                      <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 5, lineHeight: 1.6 }}>{r.summary_preview}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Test Trends */}
        <Card style={{ padding: '1.5rem' }}>
          <SecHead icon="layers">Test Trends Over Time</SecHead>
          {!data?.trends?.length ? (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--txt3)', fontSize: 13, lineHeight: 1.7 }}>
              Upload 2+ reports to see how your test values change over time across reports.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {data.trends.map((t, i) => {
                const statusColors: Record<string, string> = { normal: 'var(--ok)', low: 'var(--warn)', high: 'var(--danger)', critical: 'var(--crit)' };
                const dirColor = t.direction === 'worsening' ? 'var(--danger)' : t.direction === 'improving' ? 'var(--ok)' : 'var(--txt3)';
                const latestColor = statusColors[t.latest_status] || 'var(--txt3)';
                return (
                  <div key={i} style={{ padding: '11px 13px', background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--bd)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.test_name}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: dirColor, fontWeight: 700 }}>{t.direction}</span>
                        <span style={{ padding: '2px 8px', borderRadius: 100, background: `${latestColor}15`, fontSize: 10.5, color: latestColor, fontFamily: 'var(--fm)' }}>
                          {t.latest_status}
                        </span>
                      </div>
                    </div>
                    <SparkLine points={t.points} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--txt3)', marginTop: 5, fontFamily: 'var(--fm)' }}>
                      <span>{t.points?.length} data points</span>
                      <span>{t.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Profile */}
      <Card style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editProfile ? '1.25rem' : '0.75rem' }}>
          <SecHead icon="user">Health Profile</SecHead>
          <Btn size="sm" variant="ghost" icon={editProfile ? 'close' : 'edit'} onClick={() => setEditProfile(e => !e)}>
            {editProfile ? 'Cancel' : 'Edit Profile'}
          </Btn>
        </div>

        {editProfile ? (
          <ProfileEditor initial={data?.profile || null} sessionId={sessionId} onSave={() => { setEditProfile(false); load(); }} />
        ) : (
          !data?.profile ? (
            <div style={{ color: 'var(--txt3)', fontSize: 13.5, textAlign: 'center', padding: '1rem' }}>
              Add your profile to unlock more personalized insights — just tap <strong style={{ color: 'var(--accent)' }}>Edit Profile</strong> to begin.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10 }}>
              {[
                { l: 'Name',         v: data.profile.name },
                { l: 'Account',      v: data.profile.email || data.profile.phone },
                { l: 'Age',          v: data.profile.age },
                { l: 'Gender',       v: data.profile.gender },
                { l: 'Blood Group',  v: data.profile.blood_group },
                { l: 'Height',       v: data.profile.height_cm ? `${data.profile.height_cm} cm` : null },
                { l: 'Weight',       v: data.profile.weight_kg ? `${data.profile.weight_kg} kg` : null },
              ].filter(f => f.v).map(f => (
                <div key={f.l} style={{ padding: '10px 13px', background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--bd)' }}>
                  <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{f.l}</div>
                  <div style={{ fontWeight: 600, fontSize: 14, textTransform: f.l === 'Account' ? 'none' : 'capitalize' }}>{f.v}</div>
                </div>
              ))}
              {(data.profile.known_conditions?.length ?? 0) > 0 && (
                <div style={{ padding: '10px 13px', background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--bd)', gridColumn: '1/-1' }}>
                  <div style={{ fontSize: 10, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Conditions</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {data.profile.known_conditions.map((c, i) => (
                      <span key={i} style={{ padding: '3px 10px', borderRadius: 100, background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', fontSize: 12, color: 'var(--warn)' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        )}
      </Card>
    </div>
  );
}
