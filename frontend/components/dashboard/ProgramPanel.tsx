'use client';
import React, { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion } from 'framer-motion';
import { getProgram } from '@/lib/api';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The 90-day "Move One Number" program on the dashboard: the focus, a progress
 * ring (time + engagement), the phase plan, milestones, and — when a retest has
 * landed — the proven delta. The home of the long-term health strategy.
 */
export function ProgramPanel({ onUpload }: { onUpload: () => void }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => { getProgram().then(setD).catch(() => {}); }, []);

  if (!d || !d.focus || !d.program) return null;
  const { focus, program, progress, retest } = d;
  const proof = progress?.proof;
  const pct = progress?.percent ?? 0;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
      style={{ marginBottom: '1.25rem', borderRadius: 'var(--rxl)', overflow: 'hidden', border: '1px solid var(--bd2)', background: 'var(--surf)' }}>
      {/* header */}
      <div style={{ padding: 'clamp(1.3rem, 3vw, 1.8rem)', background: 'var(--askfit-grad)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="target" size={15} color="#fff" />
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}>
            Your 90-day program
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(1rem, 4vw, 2rem)', flexWrap: 'wrap' }}>
          {/* progress ring */}
          <div style={{ position: 'relative', width: 92, height: 92, flexShrink: 0 }}>
            <svg viewBox="0 0 92 92" style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }}>
              <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
              <motion.circle cx="46" cy="46" r="40" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 40}
                initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - pct / 100) }}
                transition={{ duration: 1.1, ease: EASE }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <span style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: '1.4rem', lineHeight: 1 }}>{pct}%</span>
              <span style={{ fontSize: 9, opacity: 0.85 }}>of cycle</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <h3 style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 'clamp(1.2rem, 3vw, 1.6rem)', color: '#fff', marginBottom: 6 }}>{focus.target}</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                <Icon name="flame" size={12} color="#fff" /> {progress?.streak ?? 0} day streak
              </span>
              {retest?.days_left != null && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12, fontWeight: 700 }}>
                  <Icon name="clock" size={12} color="#fff" /> {retest.days_left < 0 ? 'Retest overdue' : `Retest in ${retest.days_left}d`}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: 'clamp(1.2rem, 3vw, 1.7rem)' }}>
        {/* proof, if a retest has improved the number */}
        {proof?.improved && (
          <div style={{ marginBottom: 18, padding: '14px 16px', borderRadius: 'var(--rl)', background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Icon name="trend_up" size={20} color="var(--ok)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ok)' }}>
                {proof.label}: {proof.baseline_value} → {proof.latest_value}{proof.unit ? ` ${proof.unit}` : ''}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--txt2)', marginTop: 2 }}>
                {proof.now_in_range ? 'Back in the healthy range — great work.' : 'Moving in the right direction. Keep going.'}
              </div>
            </div>
          </div>
        )}

        {/* phases */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 16 }}>
          {program.phases.map((ph: any, i: number) => (
            <div key={i} style={{ padding: '14px', borderRadius: 'var(--rl)', background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{ph.name}</span>
                <span style={{ fontSize: 10.5, color: 'var(--txt4)', fontFamily: 'var(--fm)' }}>wk {ph.weeks}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.55, marginBottom: 8 }}>{ph.goal}</p>
              {ph.actions.slice(0, 2).map((a: string, j: number) => (
                <div key={j} style={{ display: 'flex', gap: 6, fontSize: 11.5, color: 'var(--txt2)', marginBottom: 4, lineHeight: 1.45 }}>
                  <Icon name="check" size={11} color="var(--ok)" /> <span>{a}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* milestones */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {program.milestones.map((m: any, i: number) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd)', fontSize: 11.5, color: 'var(--txt2)' }}>
              <span style={{ fontFamily: 'var(--fm)', color: 'var(--askfit)', fontWeight: 700 }}>W{m.week}</span> {m.label}
            </span>
          ))}
        </div>

        <button onClick={onUpload} style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 100, cursor: 'pointer', background: 'var(--accent)', color: 'var(--bg1)', border: 'none', fontSize: 13, fontWeight: 700 }}>
          <Icon name="upload" size={14} color="var(--bg1)" /> Upload your retest to log progress
        </button>
      </div>
    </motion.div>
  );
}
