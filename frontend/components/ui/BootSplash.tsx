'use client';
// ════════════════════════════════════════════════════════════════════════════
// BootSplash — Capacitor-only animated opening (≈2s)
// ════════════════════════════════════════════════════════════════════════════
// Plays once per cold start, right after the native splash hides:
//   1. Five health icons (heartbeat · gym · nutrition · calm · energy) pop
//      onto an orbit around the center, one by one, with springs.
//   2. They converge into the center as the FeelFit wordmark springs in.
//   3. The overlay fades out and the app is revealed on Home.
// Renders nothing on the web build. Respects prefers-reduced-motion (short
// plain fade instead of the orbit choreography).
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { isCapacitor, haptic } from '@/lib/native';

const ORBIT: { name: string; color: string; angle: number }[] = [
  { name: 'heartpulse', color: '#ef4444', angle: -90 },  // health
  { name: 'dumbbell',   color: '#0d9488', angle: -18 },  // gym
  { name: 'salad',      color: '#22c55e', angle: 54 },   // nutrition
  { name: 'lotus',      color: '#8b5cf6', angle: 126 },  // calm
  { name: 'flame',      color: '#f59e0b', angle: 198 },  // energy
];
const RADIUS = 78;

declare global {
  interface Window { __ffSplashDone?: boolean }
}

export function BootSplash() {
  const [show, setShow] = useState(false);
  // Children mount only once frames are actually being painted — framer
  // animations are time-based, so mounting them while the main thread is
  // still hydrating would make them "skip ahead" instead of playing.
  const [started, setStarted] = useState(false);
  const [merge, setMerge] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!isCapacitor()) return;
    if (window.__ffSplashDone) return;   // once per cold start only
    window.__ffSplashDone = true;
    setShow(true);
    // Anchor the timeline to the first PAINTED frame (double-rAF), not to
    // mount time: during a cold boot the main thread is still hydrating the
    // page, so animations can't render frames yet — starting the clocks at
    // mount would hide the splash before anything was ever seen.
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setStarted(true);
        t1 = setTimeout(() => setMerge(true), reduce ? 300 : 1350);
        t2 = setTimeout(() => { setShow(false); haptic('light'); }, reduce ? 650 : 2100);
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); clearTimeout(t1); clearTimeout(t2); };
  }, [reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="ff-boot-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg1, #fafaf8)',
          }}
        >
          <div style={{ position: 'relative', width: RADIUS * 2 + 80, height: RADIUS * 2 + 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

            {/* Orbiting health icons — pop out, breathe, then converge home */}
            {started && !reduce && ORBIT.map(({ name, color, angle }, i) => {
              const rad = (angle * Math.PI) / 180;
              const x = Math.cos(rad) * RADIUS;
              const y = Math.sin(rad) * RADIUS;
              return (
                <motion.span
                  key={name}
                  initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
                  animate={merge
                    ? { x: 0, y: 0, scale: 0.2, opacity: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: i * 0.03 } }
                    : { x, y, scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 18, delay: 0.12 + i * 0.13 } }}
                  style={{
                    position: 'absolute',
                    width: 46, height: 46, borderRadius: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${color}16`,
                    border: `1px solid ${color}2e`,
                  }}
                >
                  <Icon name={name} size={22} color={color} />
                </motion.span>
              );
            })}

            {/* Wordmark + tagline — springs in as the icons converge */}
            {started && (
            <div style={{ position: 'relative', textAlign: 'center', zIndex: 1 }}>
              <motion.div
                initial={{ scale: reduce ? 1 : 0.82, opacity: 0 }}
                animate={{
                  scale: merge ? 1.06 : 1,
                  opacity: 1,
                  transition: merge
                    ? { type: 'spring', stiffness: 320, damping: 16 }
                    : { type: 'spring', stiffness: 260, damping: 20, delay: 0.28 },
                }}
                style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 40, letterSpacing: '-0.02em', color: 'var(--txt, #111)' }}
              >
                FeelFit
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: merge ? 1 : 0, y: merge ? 0 : 6, transition: { duration: 0.32, ease: 'easeOut' } }}
                style={{ marginTop: 6, fontSize: 13, letterSpacing: '0.02em', color: 'var(--txt3, rgba(0,0,0,0.45))' }}
              >
                Feel your absolute best
              </motion.div>
            </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
