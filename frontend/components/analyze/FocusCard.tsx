'use client';
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion } from 'framer-motion';
import type { HealthFocus } from '@/types';

const EASE = [0.16, 1, 0.3, 1] as const;

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

/**
 * "Move One Number" — the outcome moment. Instead of leaving the user with a wall
 * of values, FeelFit picks ONE biomarker to improve this cycle, with a plain
 * target, why it matters, a short plan, and a retest date to prove the change.
 * This is the card that turns a report analyzer into a health copilot.
 */
export function FocusCard({ focus, onAsk }: { focus: HealthFocus; onAsk?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
      style={{
        marginBottom: '1.25rem', borderRadius: 'var(--rxl)', overflow: 'hidden',
        background: 'var(--askfit-grad)', boxShadow: '0 12px 40px var(--askfit-glow)',
      }}
    >
      <div style={{ padding: 'clamp(1.4rem, 4vw, 2.2rem)' }}>
        {/* eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.22)' }}>
            <Icon name="target" size={15} color="#fff" />
          </span>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.92)', fontWeight: 700 }}>
            Your focus this cycle
          </span>
        </div>

        {/* headline: the one number */}
        <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', letterSpacing: '-0.02em', lineHeight: 1.15, color: '#fff', marginBottom: 8 }}>
          {focus.target}
        </h2>
        <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.92)', lineHeight: 1.7, maxWidth: 640, marginBottom: 18 }}>
          {focus.why}
        </p>

        {/* current value + retest chips */}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginBottom: 20 }}>
          {focus.current_value != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
              <Icon name="activity" size={12} color="#fff" /> Now: {focus.current_value}{focus.unit ? ` ${focus.unit}` : ''} ({focus.status})
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.18)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
            <Icon name="clock" size={12} color="#fff" /> Retest by {fmtDate(focus.retest_date)} ({focus.retest_weeks} wks)
          </span>
        </div>

        {/* the plan */}
        <div style={{ background: 'rgba(255,255,255,0.14)', borderRadius: 'var(--rl)', padding: 'clamp(1rem, 3vw, 1.4rem)', backdropFilter: 'blur(8px)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12, opacity: 0.95 }}>
            Your simple plan
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {focus.plan.map((step, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: EASE }}
                style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#fff', color: 'var(--askfit)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, fontFamily: 'var(--fm)' }}>{i + 1}</span>
                <span style={{ fontSize: 14, color: '#fff', lineHeight: 1.55 }}>{step}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* footer: other flags + ask */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
          {focus.other_flags && focus.other_flags.length > 0 ? (
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
              Also flagged: {focus.other_flags.join(' · ')} — we’ll tackle these next.
            </span>
          ) : <span />}
          {onAsk && (
            <button onClick={onAsk}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 18px', borderRadius: 100, background: '#fff', color: 'var(--askfit)', fontSize: 13, fontWeight: 700, cursor: 'pointer', border: 'none' }}>
              <Icon name="sparkles" size={14} color="var(--askfit)" /> Ask FeelFit about this
            </button>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 14, lineHeight: 1.6 }}>
          A focused, general-wellness plan — supportive guidance, not a diagnosis. Always confirm changes with your doctor.
        </p>
      </div>
    </motion.div>
  );
}
