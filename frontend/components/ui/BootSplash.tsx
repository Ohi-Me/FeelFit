'use client';
// ════════════════════════════════════════════════════════════════════════════
// BootSplash — animated opening for web AND mobile (≈3s)
// ════════════════════════════════════════════════════════════════════════════
// A short, centered "life in motion" sequence: a runner, a cyclist, and a
// lifter take the stage one after another (Run → Ride → Train), then the
// FeelFit wordmark springs in and the app is revealed.
//
//   • Capacitor: plays once per cold start (right after the native splash).
//   • Web: plays once per browser session (sessionStorage), so reloads and
//     tab-switching don't replay it.
//   • prefers-reduced-motion: shows a brief wordmark fade instead.
//
// All animation is transform/opacity only (GPU-composited — no layout work),
// and the timeline is anchored to the first PAINTED frame so hydration work
// can't eat the show (see the double-rAF note below).
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { isCapacitor, haptic } from '@/lib/native';

declare global {
  interface Window { __ffSplashDone?: boolean }
}

const ACT_MS = 660;      // each activity's time on stage
const BRAND_MS = 900;    // wordmark hold
const SESSION_KEY = 'ff-splash-done';

// ── Activity pictograms — stroke line-art, consistent with the app's icons ──
// Each is a 48×48 viewBox drawing plus its own micro-animation (bobbing,
// spinning wheels, barbell reps). Colors follow the health palette used by
// the rest of the app.

function RunnerArt({ color }: { color: string }) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <motion.svg
      width={64} height={64} viewBox="0 0 48 48"
      animate={{ y: [0, -2.5, 0], rotate: [0, 1.5, 0] }}
      transition={{ duration: 0.36, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* speed lines */}
      {[
        { d: 'M4 15 h6', delay: 0 },
        { d: 'M2 22 h7', delay: 0.12 },
        { d: 'M5 29 h5', delay: 0.24 },
      ].map(({ d, delay }) => (
        <motion.path key={d} d={d} {...stroke} strokeWidth={2}
          animate={{ x: [4, -5], opacity: [0, 0.7, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, delay, ease: 'linear' }}
        />
      ))}
      {/* runner — mid-stride */}
      <circle cx="29" cy="8.5" r="3.4" {...stroke} />
      <path d="M27.5 13 L23.5 24.5" {...stroke} />                {/* torso */}
      <path d="M27 15.5 L33 20 L37 17.5" {...stroke} />           {/* front arm */}
      <path d="M26.5 16 L20 13.5" {...stroke} />                  {/* back arm */}
      <path d="M23.5 24.5 L30.5 29 L29.5 38" {...stroke} />       {/* front leg */}
      <path d="M23.5 24.5 L17 30 L12.5 26.5" {...stroke} />       {/* back leg (kicked) */}
    </motion.svg>
  );
}

function CyclistArt({ color }: { color: string }) {
  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const wheel = (cx: number) => (
    <g key={cx}>
      <circle cx={cx} cy="35" r="7.5" {...stroke} strokeWidth={2} />
      {/* spokes — a dashed ring that spins */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: `${cx}px 35px`, transformBox: 'view-box' }}
      >
        <circle cx={cx} cy="35" r="4.5" {...stroke} strokeWidth={1.6} strokeDasharray="2.5 5" />
      </motion.g>
    </g>
  );
  return (
    <motion.svg
      width={64} height={64} viewBox="0 0 48 48"
      animate={{ y: [0, -1.5, 0] }}
      transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      {wheel(12)}
      {wheel(36)}
      {/* frame */}
      <path d="M12 35 L20 23 L30 23 L36 35 M23.5 35 L20 23" {...stroke} strokeWidth={2} />
      {/* rider */}
      <circle cx="27.5" cy="8" r="3.2" {...stroke} />
      <path d="M26.5 11.5 L21 22.5" {...stroke} />                {/* torso leaning */}
      <path d="M26 14 L32.5 20.5" {...stroke} />                  {/* arm to handlebar */}
      <path d="M32.5 20.5 L33.5 23" {...stroke} strokeWidth={2} /> {/* handlebar drop */}
      <motion.path d="M21 22.5 L25 29 L22.5 34"
        {...stroke}
        animate={{ rotate: [0, 8, 0] }}
        transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '21px 22.5px', transformBox: 'view-box' }}
      />                                                          {/* pedaling leg */}
    </motion.svg>
  );
}

function LifterArt({ color }: { color: string }) {
  const stroke = { stroke: color, strokeWidth: 2.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <svg width={64} height={64} viewBox="0 0 48 48">
      {/* barbell — presses up and down */}
      <motion.g
        animate={{ y: [3, -2.5, 3] }}
        transition={{ duration: 0.66, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M9 10 H39" {...stroke} strokeWidth={2.2} />
        <path d="M13 5.5 V14.5 M35 5.5 V14.5" {...stroke} strokeWidth={3.2} />
        {/* arms travel with the bar */}
        <path d="M24 20.5 L17 11 M24 20.5 L31 11" {...stroke} />
      </motion.g>
      {/* body */}
      <circle cx="24" cy="17.5" r="3.2" {...stroke} />
      <path d="M24 21 V30" {...stroke} />
      {/* legs — slight squat bounce in counter-phase */}
      <motion.g
        animate={{ y: [0, 1.5, 0] }}
        transition={{ duration: 0.66, repeat: Infinity, ease: 'easeInOut' }}
      >
        <path d="M24 30 L18.5 38.5 M24 30 L29.5 38.5" {...stroke} />
      </motion.g>
    </svg>
  );
}

const ACTS = [
  { key: 'run',  label: 'RUN',   color: '#ef4444', Art: RunnerArt  },
  { key: 'ride', label: 'RIDE',  color: '#0d9488', Art: CyclistArt },
  { key: 'lift', label: 'TRAIN', color: '#f59e0b', Art: LifterArt  },
];

export function BootSplash() {
  const [show, setShow] = useState(false);
  // -1 = not started (blank stage), 0..2 = activity acts, 3 = brand reveal.
  const [stage, setStage] = useState(-1);
  const reduce = useReducedMotion();

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let raf1 = 0, raf2 = 0;

    const run = () => {
      setStage(-1);
      setShow(true);
      // Anchor the timeline to the first PAINTED frame (double-rAF): during a
      // cold boot the main thread is still hydrating, so starting clocks at
      // mount would hide the splash before a single frame was ever seen.
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          // The show actually starts now — THIS is the moment it counts as
          // played. (Marking earlier, in the effect body, breaks under React
          // StrictMode's dev double-invoke: run #1 marks + gets cleaned up,
          // run #2 sees the marker and bails → a stuck blank overlay.)
          if (isCapacitor()) window.__ffSplashDone = true;
          else { try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {} }
          if (reduce) {
            setStage(3);
            timers.push(setTimeout(() => setShow(false), 700));
            return;
          }
          setStage(0);
          timers.push(setTimeout(() => setStage(1), ACT_MS));
          timers.push(setTimeout(() => setStage(2), ACT_MS * 2));
          timers.push(setTimeout(() => setStage(3), ACT_MS * 3));
          timers.push(setTimeout(() => { setShow(false); haptic('light'); }, ACT_MS * 3 + BRAND_MS));
        });
      });
    };

    // Replay hook — lets demos/tests retrigger the show without a reload:
    //   window.dispatchEvent(new CustomEvent('ff:replay-splash'))
    const onReplay = () => run();
    window.addEventListener('ff:replay-splash', onReplay);

    // Play once per cold start in the app; once per browser session on web.
    const alreadyPlayed = isCapacitor()
      ? !!window.__ffSplashDone
      : (() => { try { return !!sessionStorage.getItem(SESSION_KEY); } catch { return true; } })();
    if (!alreadyPlayed) run();

    return () => {
      window.removeEventListener('ff:replay-splash', onReplay);
      cancelAnimationFrame(raf1); cancelAnimationFrame(raf2);
      timers.forEach(clearTimeout);
    };
  }, [reduce]);

  const act = stage >= 0 && stage < 3 ? ACTS[stage] : null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="ff-boot-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg1, #fafaf8)',
          }}
        >
          {/* Stage — activities swap through; then the brand takes over */}
          <div style={{ position: 'relative', width: 180, height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AnimatePresence mode="wait">
              {act && (
                <motion.div
                  key={act.key}
                  initial={{ opacity: 0, scale: 0.55, y: 14 }}
                  animate={{ opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 22 } }}
                  exit={{ opacity: 0, scale: 0.85, y: -10, transition: { duration: 0.13, ease: 'easeIn' } }}
                  style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
                >
                  <span style={{
                    width: 92, height: 92, borderRadius: 28,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${act.color}14`,
                    border: `1px solid ${act.color}2e`,
                  }}>
                    <act.Art color={act.color} />
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', color: act.color }}>
                    {act.label}
                  </span>
                </motion.div>
              )}

              {stage === 3 && (
                <motion.div
                  key="brand"
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.82 }}
                  animate={{ opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 18 } }}
                  style={{ position: 'absolute', textAlign: 'center' }}
                >
                  <div style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 42, letterSpacing: '-0.02em', color: 'var(--txt, #111)' }}>
                    FeelFit
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: 0.18, duration: 0.3, ease: 'easeOut' } }}
                    style={{ marginTop: 6, fontSize: 13, letterSpacing: '0.02em', color: 'var(--txt3, rgba(0,0,0,0.45))' }}
                  >
                    Feel your absolute best
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress dots — one per act, filled as the sequence advances */}
          {!reduce && stage < 3 && (
            <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
              {ACTS.map((a, i) => (
                <motion.span
                  key={a.key}
                  animate={{
                    scale: stage === i ? 1.25 : 1,
                    backgroundColor: stage >= i ? a.color : 'rgba(128,128,128,0.25)',
                  }}
                  transition={{ duration: 0.2 }}
                  style={{ width: 7, height: 7, borderRadius: '50%' }}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
