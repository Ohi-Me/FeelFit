'use client';
/**
 * FeelFit v10 — Motion Primitives
 * Shared Framer Motion building blocks used across the app for entrance
 * animations, scroll reveals, staggered groups, animated counters, and
 * page/tab transitions. Keep all "premium motion" choices centralized here
 * so the rest of the app stays declarative and consistent.
 *
 * All primitives respect `prefers-reduced-motion` via useReducedMotion().
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useInView,
  useMotionValue,
  useReducedMotion,
  animate,
  type Variants,
  type Transition,
} from 'framer-motion';

export { motion, AnimatePresence };

// ── Shared easing & transitions ─────────────────────────────────────────────
// Mirrors --transition-slow / --transition in globals.css for visual consistency
export const EASE = [0.16, 1, 0.3, 1] as any;
export const EASE_SOFT = [0.22, 1, 0.36, 1] as any;

export const springSnappy: Transition = { type: 'spring', stiffness: 340, damping: 26, mass: 0.6 };
export const springSoft: Transition = { type: 'spring', stiffness: 200, damping: 24 };

// ── FadeIn — mount-triggered fade + rise ────────────────────────────────────
interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  style?: React.CSSProperties;
  className?: string;
}
export function FadeIn({ children, delay = 0, duration = 0.6, y = 18, style, className }: FadeInProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0.01 : duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// ── Reveal — scroll-triggered fade + rise, fires once ───────────────────────
interface RevealProps extends FadeInProps {
  amount?: number; // fraction of element that must be visible to trigger
}
export function Reveal({ children, delay = 0, duration = 0.65, y = 28, amount = 0.2, style, className }: RevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: reduce ? 0.01 : duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// ── Stagger / StaggerItem — orchestrated sequential reveal ──────────────────
const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
};
const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
const staggerItemReduced: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
};

interface StaggerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  amount?: number;
}
export function Stagger({ children, style, className, amount = 0.15 }: StaggerProps) {
  return (
    <motion.div
      className={className}
      style={style}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={staggerContainer}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}
export function StaggerItem({ children, style, className }: StaggerItemProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} style={style} variants={reduce ? staggerItemReduced : staggerItem}>
      {children}
    </motion.div>
  );
}

// ── AnimatedNumber — scroll-triggered count-up ───────────────────────────────
interface AnimatedNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  duration?: number; // seconds
  style?: React.CSSProperties;
  className?: string;
}
export function AnimatedNumber({ value, suffix = '', prefix = '', decimals = 0, duration = 1.4, style, className }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const motionVal = useMotionValue(0);
  const [display, setDisplay] = useState(() => (decimals > 0 ? (0).toFixed(decimals) : '0'));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString());
      return;
    }
    const controls = animate(motionVal, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => setDisplay(decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString()),
    });
    return () => controls.stop();
  }, [inView, value, duration, decimals, reduce, motionVal]);

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}{display}{suffix}
    </span>
  );
}

// ── AnimatedRing — animated SVG progress ring (used by health score, etc.) ──
interface AnimatedRingProps {
  value: number;     // 0-100
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  duration?: number;
}
export function AnimatedRing({ value, size = 136, strokeWidth = 9, color, trackColor = 'var(--bd2)', duration = 1.4 }: AnimatedRingProps) {
  const reduce = useReducedMotion();
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const c = size / 2;
  const [offset, setOffset] = useState(circ);
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const motionVal = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;
    const target = circ - (Math.max(0, Math.min(100, value)) / 100) * circ;
    if (reduce) { setOffset(target); return; }
    const controls = animate(motionVal, target, {
      duration, ease: EASE,
      onUpdate: (v) => setOffset(v),
    });
    return () => controls.stop();
  }, [inView, value, circ, duration, reduce, motionVal]);

  return (
    <svg ref={ref} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={strokeWidth - 1}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${c} ${c})`}
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
    </svg>
  );
}

// ── PageTransition — cross-fade + rise between tab/route content ────────────
// On Capacitor we use a longer, smoother slide + fade that feels native
// (iOS-like push transition); on web we keep the snappier 0.32s fade.
interface PageTransitionProps {
  children: React.ReactNode;
  keyId: string;
}
export function PageTransition({ children, keyId }: PageTransitionProps) {
  const reduce = useReducedMotion();
  // Detect Capacitor at render time — the class is set on <html> by
  // useNativeBridge before any tab change happens.
  const [isCapacitor, setIsCapacitor] = useState(false);
  useEffect(() => {
    setIsCapacitor(document.documentElement.classList.contains('is-capacitor'));
  }, []);

  if (reduce) {
    return <AnimatePresence mode="wait" initial={false}><motion.div key={keyId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>{children}</motion.div></AnimatePresence>;
  }

  // Capacitor: fast 120ms fade-out, then a springy 260ms rise-in. Keeping the
  // exit short is what makes tab switches feel instant — the old symmetric
  // 380ms/380ms pair read as lag on mid-range phones.
  if (isCapacitor) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={keyId}
          className="ff-page-transition"
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.12, ease: 'easeIn' } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Web: snappy 320ms cross-fade + 14px rise
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={keyId}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
