'use client';
import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

const STAGES = [
  { icon: 'lock',        label: 'Securing your upload',        sub: 'Private and secure' },
  { icon: 'file',        label: 'Reading your report',         sub: 'Finding every test and value' },
  { icon: 'sparkles',    label: 'Understanding your results',  sub: 'Comparing to healthy ranges' },
  { icon: 'activity',    label: 'Preparing your insights',     sub: 'In simple, calm language' },
  { icon: 'stethoscope', label: 'Matching specialists',        sub: 'So you know your next step' },
];

// Long-tail reassurance shown if the real backend call outlasts the whole
// stage sequence (e.g. a dense report on a slow connection) — keeps the last
// stage from feeling frozen instead of just sitting there silently.
const TAIL_MESSAGES = [
  'Still reading — dense reports take a little longer',
  'Almost there — double-checking the numbers',
  'Nearly done — this one has a lot to read',
];

export function AnalyzingState({ fileName }: { fileName: string }) {
  const [stage, setStage] = useState(0);
  const [tailIdx, setTailIdx] = useState(-1);

  useEffect(() => {
    // Faster cadence — most reports finish well inside this sequence now that
    // extraction runs in parallel on the backend, so the UI should keep pace
    // rather than forcing a slow minimum wait.
    const t = setInterval(() => setStage(s => Math.min(s + 1, STAGES.length - 1)), 1500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (stage < STAGES.length - 1) return;
    // Reached the last stage — if the request is still running after this,
    // rotate in a reassuring sub-message every few seconds instead of going quiet.
    const t = setInterval(() => setTailIdx(i => (i + 1) % TAIL_MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, [stage]);

  return (
    <div style={{ maxWidth: 460, margin: '0 auto', padding: 'clamp(2rem, 6vw, 4rem) 1rem' }}>
      {/* Breathing orb */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2.5rem' }}>
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          <motion.div
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.12, 0.35] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-grad)', filter: 'blur(14px)' }}
          />
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--accent-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-glow-lg)' }}
          >
            <AnimatePresence mode="wait">
              <motion.span key={stage}
                initial={{ opacity: 0, scale: 0.6, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: -4 }}
                transition={{ duration: 0.35, ease: EASE }} style={{ display: 'flex' }}>
                <Icon name={STAGES[stage].icon} size={32} color="#fff" sw={1.8} />
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
        <h2 style={{ fontFamily: 'var(--ff)', fontSize: 'clamp(1.5rem, 4vw, 1.9rem)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
          Reading your report
        </h2>
        <p style={{ color: 'var(--txt3)', fontSize: 13, maxWidth: 320, margin: '0 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {fileName} · this usually takes under a minute
        </p>
      </div>

      {/* Stage list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {STAGES.map((s, i) => {
          const done = i < stage, active = i === stage;
          return (
            <motion.div key={s.label}
              animate={{ opacity: done || active ? 1 : 0.4 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 14px', borderRadius: 'var(--rm)',
                background: active ? 'var(--surf)' : 'transparent', border: `1px solid ${active ? 'var(--bd2)' : 'transparent'}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? 'var(--ok-bg)' : active ? 'var(--glow2)' : 'var(--surf2)',
                border: `1px solid ${done ? 'var(--ok-bd)' : active ? 'var(--bd2)' : 'var(--bd)'}` }}>
                {done ? <Icon name="check" size={14} color="var(--ok)" />
                  : active ? <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.2s ease-in-out infinite' }} />
                  : <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--txt4)' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: active || done ? 600 : 500, color: active ? 'var(--txt)' : 'var(--txt2)' }}>{s.label}</div>
                {active && (
                  <AnimatePresence mode="wait">
                    <motion.div key={i === STAGES.length - 1 ? tailIdx : 'sub'}
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                      style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 2 }}>
                      {i === STAGES.length - 1 && tailIdx >= 0 ? TAIL_MESSAGES[tailIdx] : s.sub}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: '2rem', fontSize: 12, color: 'var(--txt4)' }}>
        <Icon name="lock" size={12} color="var(--ok)" /> Your report is processed privately
      </div>
    </div>
  );
}
