'use client';
import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion } from 'framer-motion';
import type { HealthProof } from '@/types';

const EASE = [0.16, 1, 0.3, 1] as const;

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); }
  catch { return iso; }
}

/**
 * The outcome moment. When a re-test shows the focus biomarker moving toward its
 * target, FeelFit celebrates the proof: "HbA1c 6.8 → 5.9 — down 0.9 in 80 days."
 * This is the screen that earns the next month's subscription.
 */
export function ProofBanner({ proof, daysElapsed }: { proof: HealthProof; daysElapsed?: number }) {
  if (!proof.improved) return null;
  const arrow = proof.direction === 'lower' ? '↓' : '↑';
  const span = daysElapsed && daysElapsed > 0 ? ` in ${daysElapsed} days` : '';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 14 }} animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE }}
      style={{ marginBottom: '1.25rem', borderRadius: 'var(--rxl)', overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--ok) 0%, #0ea371 100%)', boxShadow: '0 14px 44px var(--ok-glow)' }}
    >
      <div style={{ padding: 'clamp(1.4rem, 4vw, 2.2rem)', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="trend_up" size={16} color="#fff" />
          </span>
          <span style={{ fontFamily: 'var(--fm)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.95)', fontWeight: 700 }}>
            Your number moved 🎉
          </span>
        </div>

        <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 'clamp(1.5rem, 4vw, 2.2rem)', letterSpacing: '-0.02em', color: '#fff', marginBottom: 10 }}>
          {proof.label}: {proof.baseline_value} {arrow} {proof.latest_value}{proof.unit ? ` ${proof.unit}` : ''}
        </h2>

        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
            {arrow} {proof.abs_delta}{proof.unit ? ` ${proof.unit}` : ''}{span}
          </span>
          {proof.now_in_range && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: '#fff', color: 'var(--ok)', fontSize: 13, fontWeight: 700 }}>
              <Icon name="check_circle" size={13} color="var(--ok)" /> Back in the healthy range
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 100, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
            {fmtDate(proof.baseline_date)} → {fmtDate(proof.latest_date)}
          </span>
        </div>

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.95)', lineHeight: 1.7, marginTop: 16, maxWidth: 640 }}>
          {proof.now_in_range
            ? `This is real progress — your ${proof.label} is back in a healthy range. Keep the routine going and let's hold it there.`
            : `You're moving in the right direction. Keep the habits going — the next retest should bring ${proof.label} even closer to target.`}
        </p>
      </div>
    </motion.div>
  );
}
