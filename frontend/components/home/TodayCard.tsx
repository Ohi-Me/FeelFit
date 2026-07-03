'use client';
import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion, useReducedMotion } from 'framer-motion';
import { Stagger, StaggerItem, AnimatedNumber, springSnappy, springSoft } from '@/components/ui/motion';
import { getToday, checkinToday, logVital, type TodayCard as TodayData } from '@/lib/api';

const VITALS: { type: string; label: string; placeholder: string; unit: string; icon: string }[] = [
  { type: 'bp_systolic', label: 'BP (sys)', placeholder: '120', unit: 'mmHg', icon: 'heart' },
  { type: 'weight',      label: 'Weight',   placeholder: '70',  unit: 'kg', icon: 'scale' },
  { type: 'glucose_home',label: 'Glucose',  placeholder: '110', unit: 'mg/dL', icon: 'droplet' },
  { type: 'steps',       label: 'Steps',    placeholder: '8000', unit: 'today', icon: 'activity' },
  { type: 'sleep_hours', label: 'Sleep',    placeholder: '7.5', unit: 'hrs', icon: 'moon' },
];

function retestText(r: TodayData['retest']) {
  if (r.days_left == null) return null;
  if (r.state === 'overdue') return `Retest was due ${Math.abs(r.days_left)} day${Math.abs(r.days_left) !== 1 ? 's' : ''} ago`;
  if (r.days_left === 0) return 'Retest due today';
  return `Retest in ${r.days_left} day${r.days_left !== 1 ? 's' : ''}`;
}

/**
 * The daily return habit. When a user has analyzed a report, FeelFit greets them
 * with: their focus, one action for today, a streak, a retest countdown, and a
 * quick vitals log — the things that bring them back tomorrow.
 */
export function TodayCard({ onAnalyze, onAsk }: { onAnalyze: () => void; onAsk: () => void }) {
  const [data, setData] = useState<TodayData | null>(null);
  const [streak, setStreak] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [vital, setVital] = useState<Record<string, string>>({});
  const [savedVital, setSavedVital] = useState<string | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    getToday().then(d => { setData(d); setStreak(d.streak); setDone(d.checked_in_today); }).catch(() => {});
  }, []);

  // Only show once the user has health data (i.e., analyzed a report).
  if (!data || data.biomarker_count === 0) return null;

  const check = async () => {
    setDone(true);
    try { const r = await checkinToday(data.action?.title); setStreak(r.streak); } catch {}
  };
  const saveVital = async (type: string) => {
    const v = parseFloat(vital[type]); if (!v) return;
    setSaving(type);
    try { await logVital(type, v); setSavedVital(type); setVital(s => ({ ...s, [type]: '' })); setTimeout(() => setSavedVital(null), 1800); }
    catch {} finally { setSaving(null); }
  };

  const rt = retestText(data.retest);

  return (
    <motion.section
      initial={{ opacity: 0, y: reduce ? 0 : 34, scale: reduce ? 1 : 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={reduce ? { duration: 0.01 } : { ...springSoft, opacity: { duration: 0.5 } }}
      style={{ maxWidth: 1080, margin: '0 auto', padding: 'clamp(3.5rem, 8vw, 6rem) 0 1rem' }}
    >
      <motion.div whileHover={{ y: -3 }} transition={springSoft}
        style={{ borderRadius: 'var(--rxl)', overflow: 'hidden', border: '1px solid var(--bd2)', background: 'var(--surf)', boxShadow: 'var(--shadow)' }}>
        {/* header strip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: '14px clamp(1.1rem, 3vw, 1.6rem)', background: 'var(--askfit-grad)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.span
              initial={{ scale: reduce ? 1 : 0, rotate: reduce ? 0 : -30 }} whileInView={{ scale: 1, rotate: 0 }}
              viewport={{ once: true }} transition={{ ...springSnappy, delay: 0.1 }}
              style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="heartpulse" size={16} color="#fff" />
            </motion.span>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 11.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', fontWeight: 700 }}>Your health, today</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <motion.span
              initial={{ opacity: 0, x: reduce ? 0 : 14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              transition={{ ...springSnappy, delay: 0.18 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
              <motion.span animate={reduce ? {} : { scale: [1, 1.25, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'inline-flex' }}>
                <Icon name="flame" size={12} color="#fff" />
              </motion.span>
              <AnimatedNumber value={streak} duration={0.9} /> day streak
            </motion.span>
            {rt && (
              <motion.span
                initial={{ opacity: 0, x: reduce ? 0 : 14 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ ...springSnappy, delay: 0.26 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: data.retest.state === 'overdue' ? '#fff' : 'rgba(255,255,255,0.2)', color: data.retest.state === 'overdue' ? 'var(--askfit)' : '#fff', fontSize: 12, fontWeight: 700 }}>
                <Icon name="clock" size={12} color={data.retest.state === 'overdue' ? 'var(--askfit)' : '#fff'} /> {rt}
              </motion.span>
            )}
          </div>
        </div>

        <Stagger style={{ padding: 'clamp(1.2rem, 3vw, 1.6rem)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'clamp(1rem, 3vw, 1.5rem)' }}>
          {/* Focus + today's action */}
          <StaggerItem>
            {data.focus && (
              <div style={{ fontSize: 12.5, color: 'var(--askfit)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name="target" size={14} color="var(--askfit)" /> Focus: {data.focus.label} — {data.focus.target}
              </div>
            )}
            <h3 style={{ fontWeight: 600, fontSize: '1.15rem', letterSpacing: '-0.01em', marginBottom: 6 }}>{data.action.title}</h3>
            <p style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.65, marginBottom: 14 }}>{data.action.text}</p>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              <motion.button onClick={check} disabled={done} whileHover={done ? {} : { scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }}
                animate={done ? { scale: [1, 1.08, 1] } : {}} transition={springSnappy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 100, cursor: done ? 'default' : 'pointer', border: 'none',
                  background: done ? 'var(--ok-bg)' : 'var(--askfit-grad)', color: done ? 'var(--ok)' : '#fff', fontSize: 13, fontWeight: 700 }}>
                <Icon name={done ? 'check_circle' : 'check'} size={14} color={done ? 'var(--ok)' : '#fff'} />
                {done ? 'Done today' : "I did it"}
              </motion.button>
              <motion.button onClick={onAsk} whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.96 }} transition={springSnappy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 100, cursor: 'pointer', background: 'var(--surf2)', border: '1px solid var(--bd2)', color: 'var(--txt2)', fontSize: 13, fontWeight: 600 }}>
                <Icon name="sparkles" size={14} color="var(--askfit)" /> Ask FeelFit
              </motion.button>
            </div>
          </StaggerItem>

          {/* Quick vitals log */}
          <StaggerItem>
            <div style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Log a quick reading</div>
            <Stagger style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {VITALS.map(v => (
                <StaggerItem key={v.type}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--txt2)', width: 96, flexShrink: 0 }}>
                      <Icon name={v.icon} size={14} color="var(--askfit)" /> {v.label}
                    </span>
                    <input value={vital[v.type] || ''} onChange={e => setVital(s => ({ ...s, [v.type]: e.target.value.replace(/[^0-9.]/g, '') }))}
                      inputMode="decimal" placeholder={v.placeholder}
                      style={{ flex: 1, minWidth: 0, padding: '8px 11px', fontSize: 13.5, borderRadius: 'var(--rm)', border: '1px solid var(--bd2)', background: 'var(--bg1)', color: 'var(--txt)', transition: 'box-shadow 0.2s, border-color 0.2s' }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--askfit)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--askfit-bg)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'var(--bd2)'; e.currentTarget.style.boxShadow = 'none'; }} />
                    <span style={{ fontSize: 11, color: 'var(--txt4)', width: 42 }}>{v.unit}</span>
                    <motion.button onClick={() => saveVital(v.type)} disabled={!vital[v.type] || saving === v.type}
                      whileHover={vital[v.type] ? { scale: 1.1 } : {}} whileTap={{ scale: 0.9 }}
                      animate={savedVital === v.type ? { scale: [1, 1.2, 1] } : {}} transition={springSnappy}
                      style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 'var(--rm)', cursor: 'pointer', border: 'none',
                        background: savedVital === v.type ? 'var(--ok)' : 'var(--accent)', color: 'var(--bg1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={savedVital === v.type ? 'check' : 'plus'} size={14} color="var(--bg1)" />
                    </motion.button>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <button onClick={onAnalyze} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt3)', fontSize: 12.5, padding: 0 }}>
              <Icon name="upload" size={12} color="var(--txt3)" /> Add a new report to update your focus →
            </button>
          </StaggerItem>
        </Stagger>
      </motion.div>
    </motion.section>
  );
}
