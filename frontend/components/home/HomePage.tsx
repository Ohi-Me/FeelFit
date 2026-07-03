'use client';
import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Btn } from '@/components/ui/index';
import { FitTips } from '@/components/home/FitTips';
import { TodayCard } from '@/components/home/TodayCard';
import { motion, AnimatePresence } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

// ── Energetic two-line headline ─────────────────────────────────────────────────
// Cycles through several slogans. In each, the first word of a line is static and
// the second word animates directionally — upper word right→left, lower left→right.
const SLOGANS: [[string, string], [string, string]][] = [
  [['Understand', 'your'], ['whole', 'health']],
  [['Feel', 'your'], ['absolute', 'best']],
  [['Own', 'your'], ['health', 'story']],
  [['Thrive', 'every'], ['single', 'day']],
];

function EnergeticHeadline() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    // Pause cycling when the tab is hidden, so backgrounded timers don't queue up
    // and fire in a burst (which caused the "mixed"/jumbled look on return).
    let t: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (t) clearInterval(t); t = undefined; };
    const start = () => { stop(); t = setInterval(() => setIdx(i => (i + 1) % SLOGANS.length), 5200); };
    start();
    const onVis = () => { if (document.hidden) stop(); else start(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  const [l1, l2] = SLOGANS[idx];

  // mode="wait": the old word fully fades out before the new one slides in — so the
  // two never overlap, even mid-transition. Gentle, slow and clean.
  const animWord = (text: string, fromRight: boolean) => (
    <span style={{ display: 'inline-flex', verticalAlign: 'top', padding: '0 0.04em' }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={text}
          initial={{ x: fromRight ? '0.4em' : '-0.4em', opacity: 0, filter: 'blur(5px)' }}
          animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(5px)', transition: { duration: 0.32, ease: 'easeIn' } }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: 'inline-block', whiteSpace: 'nowrap', fontWeight: 400,
            background: 'var(--accent-grad-shine)', backgroundSize: '220% auto',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </span>
  );
  const staticWord = (text: string) => (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }} transition={{ duration: 0.5, ease: EASE }} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
        {text}
      </motion.span>
    </AnimatePresence>
  );

  // Font eased down + wrapping allowed so long translated headlines (हिन्दी, मराठी,
  // தமிழ்…) fit without spilling out of the container.
  return (
    <h1 style={{ fontFamily: 'var(--ff)', fontWeight: 400, fontSize: 'clamp(2rem, 6vw, 5rem)', lineHeight: 1.22, letterSpacing: '-0.03em', marginBottom: '1.5rem', maxWidth: '100%', overflowWrap: 'break-word' }}>
      <span style={{ display: 'block' }}>{staticWord(l1[0])} {animWord(l1[1], true)}</span>
      <span style={{ display: 'block' }}>{staticWord(l2[0])} {animWord(l2[1], false)}</span>
    </h1>
  );
}

// ── Hero product preview: "report → meaning" ────────────────────────────────────
function HeroPreview({ onAsk }: { onAsk: () => void }) {
  const rows = [
    { name: 'Hemoglobin', val: '11.2', unit: 'g/dL', flag: 'Low', color: 'var(--warn)' },
    { name: 'TSH', val: '9.8', unit: 'mIU/L', flag: 'High', color: 'var(--danger)' },
    { name: 'Vitamin D', val: '12', unit: 'ng/mL', flag: 'Low', color: 'var(--warn)' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: EASE, delay: 0.35 }}
      style={{ position: 'relative', maxWidth: 940, margin: '3.5rem auto 0', padding: '0 0.5rem' }}
    >
      {/* soft glow behind the preview */}
      <div style={{ position: 'absolute', inset: '-8% 6% 12%', background: 'radial-gradient(ellipse at 50% 40%, var(--glow) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="glass-panel-elevated"
        style={{
          position: 'relative', borderRadius: 'var(--rxl)', padding: 'clamp(1rem, 3vw, 1.75rem)',
          display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto minmax(0,1fr)', gap: 'clamp(0.75rem, 2.5vw, 1.5rem)',
          alignItems: 'center', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--bd)',
        }}
      >
        {/* Report panel */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="file" size={14} color="var(--txt3)" />
            <span style={{ fontSize: 12, color: 'var(--txt3)', fontWeight: 600, letterSpacing: '0.02em' }}>Your lab report</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rows.map((r, i) => (
              <motion.div key={r.name}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.12, duration: 0.5, ease: EASE }}
                whileHover={{ x: 3, scale: 1.02, borderColor: r.color }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', background: 'var(--surf2)', borderRadius: 'var(--r)', border: '1px solid var(--bd)', cursor: 'default' }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--fm)', color: 'var(--txt2)' }}>{r.val}</span>
                <motion.span
                  animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
                  style={{ fontSize: 9.5, fontWeight: 700, color: r.color, padding: '2px 8px', borderRadius: 100, border: `1px solid ${r.color}` }}>{r.flag}</motion.span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* AskFit node — clickable, opens AskFit */}
        <motion.button onClick={onAsk}
          initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5, ease: EASE }}
          whileHover={{ scale: 1.08, y: -2 }} whileTap={{ scale: 0.95 }}
          title="Ask FeelFit about this report"
          style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <motion.span
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', top: 0, left: '50%', translate: '-50% 0', width: 44, height: 44, borderRadius: '50%', background: 'var(--askfit-grad)' }} />
          <div style={{ position: 'relative', width: 44, height: 44, borderRadius: '50%', background: 'var(--askfit-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 22px var(--askfit-glow)' }}>
            <Icon name="sparkles" size={19} color="#fff" />
          </div>
          <div style={{ fontSize: 9.5, color: 'var(--askfit)', fontFamily: 'var(--fm)', letterSpacing: '0.06em', fontWeight: 700 }}>AskFit</div>
        </motion.button>

        {/* Insight panel */}
        <motion.div
          initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.15, duration: 0.6, ease: EASE }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="check_circle" size={14} color="var(--accent)" />
            <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.02em' }}>What it means</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.65, marginBottom: 12 }}>
            A few values need attention — your thyroid and iron are worth discussing with a doctor.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['Iron / anemia', 'Thyroid', 'See an endocrinologist'].map(t => (
              <span key={t} style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent2)', background: 'var(--glow2)', border: '1px solid var(--bd2)', padding: '4px 10px', borderRadius: 100 }}>{t}</span>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ── How it works — connected rail ───────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { icon: 'upload', t: 'Upload', d: 'A PDF, a photo, or a CSV of your report.' },
    { icon: 'sparkles', t: 'Understand', d: 'Every value explained in simple words.' },
    { icon: 'stethoscope', t: 'Act', d: 'Know what to discuss, and find a doctor.' },
  ];
  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
      {steps.map((s, i) => (
        <motion.div key={s.t}
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
          transition={{ delay: i * 0.1, duration: 0.6, ease: EASE }}
          style={{ position: 'relative', padding: '0 0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--surf)', border: '1px solid var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <Icon name={s.icon} size={20} color="var(--accent)" />
            </div>
            <span style={{ fontFamily: 'var(--fm)', fontSize: 12, color: 'var(--txt4)', fontWeight: 600 }}>0{i + 1}</span>
          </div>
          <h3 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: 6 }}>{s.t}</h3>
          <p style={{ fontSize: 14, color: 'var(--txt2)', lineHeight: 1.65, maxWidth: 240 }}>{s.d}</p>
        </motion.div>
      ))}
    </div>
  );
}

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--bd)', padding: '1.1rem 0' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', gap: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--txt)' }}>{q}</span>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.3, ease: EASE }}
          style={{ width: 24, height: 24, borderRadius: '50%', background: open ? 'var(--glow2)' : 'var(--surf)', border: '1px solid var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="chevdown" size={12} color={open ? 'var(--accent)' : 'var(--txt3)'} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }} style={{ overflow: 'hidden' }}>
            <p style={{ marginTop: 10, fontSize: 14.5, color: 'var(--txt2)', lineHeight: 1.78, paddingRight: 36 }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Big feature card (TON-style: title, desc, link, visual) ─────────────────────
function FeatureCard({ eyebrow, title, desc, cta, onClick, visual, tone }:
  { eyebrow: string; title: string; desc: string; cta: string; onClick: () => void; visual: React.ReactNode; tone: 'invert' | 'surface' | 'surface2' }) {
  const invert = tone === 'invert';
  const bg = invert ? 'var(--accent)' : tone === 'surface2' ? 'var(--surf2)' : 'var(--surf)';
  const fg = invert ? 'var(--bg1)' : 'var(--txt)';
  const sub = invert ? 'var(--bg1)' : 'var(--txt2)';
  const ctaBg = invert ? 'var(--bg1)' : 'var(--accent)';
  const ctaFg = invert ? 'var(--accent)' : 'var(--bg1)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: EASE }} whileHover={{ y: -6 }}
      onClick={onClick}
      style={{ position: 'relative', borderRadius: 28, padding: '1.75rem 1.75rem 0', background: bg, color: fg,
        minHeight: 540, display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: 'pointer',
        border: '1px solid var(--bd2)', boxShadow: 'var(--shadow-lg)' }}>
      <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: fg, opacity: 0.55, marginBottom: 14 }}>{eyebrow}</div>
      <h3 style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 'clamp(1.7rem, 3vw, 2.1rem)', letterSpacing: '-0.02em', color: fg, marginBottom: 12 }}>{title}</h3>
      <p style={{ fontSize: 15, lineHeight: 1.6, color: sub, marginBottom: 20, maxWidth: 320 }}>{desc}</p>
      <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="sweep"
        style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 18px', borderRadius: 999, background: ctaBg, color: ctaFg, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', border: 'none' }}>
        {cta} <span style={{ fontSize: 15, lineHeight: 1 }}>→</span>
      </button>
      <div style={{ marginTop: 'auto', paddingTop: 26, marginLeft: '-1.75rem', marginRight: '-1.75rem' }}>{visual}</div>
    </motion.div>
  );
}

// Card visuals (CSS/SVG, no external assets)
function ReportVisual() {
  const rows: [string, string, string, string][] = [['Hemoglobin', '11.2', 'Low', 'var(--warn)'], ['TSH', '9.8', 'High', 'var(--danger)'], ['Vitamin D', '12', 'Low', 'var(--warn)']];
  return (
    <div style={{ padding: '0 1.5rem 1.6rem', display: 'flex', flexDirection: 'column', gap: 9 }}>
      {rows.map(([n, v, f, c]) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', background: 'rgba(128,128,128,0.16)', borderRadius: 13, border: '1px solid rgba(128,128,128,0.22)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: 'inherit' }}>{n}</span>
          <span style={{ fontSize: 12.5, fontFamily: 'var(--fm)', color: 'inherit', opacity: 0.8 }}>{v}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: c, padding: '2px 9px', borderRadius: 100, border: `1px solid ${c}` }}>{f}</span>
        </div>
      ))}
    </div>
  );
}
function TrendVisual() {
  return (
    <div style={{ padding: '0 1.5rem 1.6rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, color: 'var(--txt)' }}>
      <div style={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
        <svg viewBox="0 0 96 96" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(128,128,128,0.2)" strokeWidth="8" />
          <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray="251" strokeDashoffset="75" transform="rotate(-90 48 48)" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: 26, color: 'var(--txt)' }}>72</span>
          <span style={{ fontSize: 9, color: 'var(--txt3)' }}>score</span>
        </div>
      </div>
      <svg viewBox="0 0 140 70" style={{ flex: 1, height: 70 }} preserveAspectRatio="none">
        <polyline points="0,55 28,48 56,52 84,30 112,34 140,14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <circle cx="140" cy="14" r="4" fill="currentColor" />
      </svg>
    </div>
  );
}
function AskVisual() {
  return (
    <div style={{ padding: '0 1.5rem 1.6rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%', padding: '10px 14px', background: 'var(--accent)', color: 'var(--bg1)', borderRadius: '16px 16px 4px 16px', fontSize: 13, fontWeight: 500 }}>
        Why is my TSH high?
      </div>
      <div style={{ alignSelf: 'flex-start', maxWidth: '88%', padding: '11px 14px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: '16px 16px 16px 4px', fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.55 }}>
        A high TSH often suggests an underactive thyroid — worth discussing with your doctor.
        <div style={{ marginTop: 7, display: 'flex', gap: 5 }}>
          <span style={{ fontSize: 9.5, color: 'var(--accent2)', background: 'var(--glow2)', padding: '2px 7px', borderRadius: 100 }}>NIH</span>
          <span style={{ fontSize: 9.5, color: 'var(--accent2)', background: 'var(--glow2)', padding: '2px 7px', borderRadius: 100 }}>LOINC</span>
        </div>
      </div>
    </div>
  );
}

interface HomePageProps { onGetStarted: () => void; onNavigate?: (t: string) => void; }

export function HomePage({ onGetStarted, onNavigate }: HomePageProps) {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const go = (t: string) => (onNavigate ? onNavigate(t) : onGetStarted());
  const words = ['Simple.', 'Human.', 'Trustworthy.'];

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>

      {/* ── HERO ── */}
      <section style={{ textAlign: 'center', padding: 'clamp(2.5rem, 6vw, 5rem) 0 0' }}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 100, background: 'var(--surf)', border: '1px solid var(--bd2)', marginBottom: 28, fontSize: 12.5, fontWeight: 600, color: 'var(--txt2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }} />
          Your reports, in your language
        </motion.div>

        <EnergeticHeadline />

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {words.map((w, i) => (
            <motion.span key={w} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.12, duration: 0.5, ease: EASE }}
              style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: 'clamp(0.95rem, 2.4vw, 1.15rem)', color: 'var(--accent)' }}>
              {w}
            </motion.span>
          ))}
        </div>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
          style={{ fontSize: 'clamp(1.05rem, 2.4vw, 1.25rem)', color: 'var(--txt2)', maxWidth: 580, margin: '0 auto 2.25rem', lineHeight: 1.7 }}>
          FeelFit reads your lab report and explains what each result means — calmly, clearly,
          and grounded in evidence — clear, calm understanding you can act on.
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
          style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn variant="primary" size="lg" icon="upload" className="sweep" onClick={onGetStarted} style={{ fontSize: 15.5, padding: '15px 34px', boxShadow: 'var(--shadow-glow)' }}>
            Analyze my report
          </Btn>
          <Btn variant="ghost" size="lg" icon="eye" className="sweep" onClick={() => scrollTo('how')}>How it works</Btn>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20, fontSize: 12.5, color: 'var(--txt3)' }}>
          {[['shield', '2 free checks'], ['lock', 'Private by default'], ['check_circle', 'Doctor-safe']].map(([ic, t]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name={ic} size={13} color="var(--ok)" /> {t}
            </span>
          ))}
        </motion.div>

        <HeroPreview onAsk={() => go('askfit')} />
      </section>

      {/* ── DAILY COMPANION — only shows once you've analyzed a report ── */}
      <TodayCard onAnalyze={onGetStarted} onAsk={() => go('askfit')} />

      {/* ── HOW IT WORKS ── */}
      <section id="how" style={{ padding: 'clamp(4rem, 9vw, 7rem) 0 clamp(3rem, 6vw, 5rem)', scrollMarginTop: 80 }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontFamily: 'var(--fm)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em' }}>How it works</span>
          <h2 style={{ fontWeight: 800, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', marginTop: 12, letterSpacing: '-0.03em' }}>From confusing to clear, in seconds</h2>
        </div>
        <HowItWorks />
      </section>

      {/* ── BIG FEATURE CARDS (TON-style) ── */}
      <section style={{ padding: 'clamp(1rem, 3vw, 2rem) 0 clamp(3rem, 6vw, 5rem)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
          <FeatureCard
            tone="invert" eyebrow="Analyze"
            title="Understand it"
            desc="Upload a lab report and get a clear, simple explanation of every value — what's healthy, and what's worth a closer look."
            cta="Analyze a report" onClick={() => go('analyze')}
            visual={<ReportVisual />}
          />
          <FeatureCard
            tone="surface" eyebrow="Dashboard"
            title="Track it"
            desc="See your health score and watch your values improve over time. Upload reports as you go and FeelFit connects the dots."
            cta="See your dashboard" onClick={() => go('dashboard')}
            visual={<TrendVisual />}
          />
          <FeatureCard
            tone="surface2" eyebrow="AskFit"
            title="Ask it"
            desc="Have a question about a result, a symptom, or a medicine? Get a calm, sourced answer — always backed by real evidence."
            cta="Ask a question" onClick={() => go('askfit')}
            visual={<AskVisual />}
          />
        </div>
      </section>

      {/* ── STAY FIT — shuffling wellness cards ── */}
      <FitTips />

      {/* ── TRUST / PRIVACY ── */}
      <section style={{ padding: 'clamp(3rem, 7vw, 5rem) 0' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease: EASE }}
          style={{ borderRadius: 'var(--rxl)', padding: 'clamp(2rem, 5vw, 3.5rem)', background: 'var(--surf)', border: '1px solid var(--bd2)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 0%, var(--glow2) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Icon name="lock" size={26} color="var(--ok)" />
            </div>
            <h2 style={{ fontWeight: 800, fontSize: 'clamp(1.6rem, 3.5vw, 2.3rem)', letterSpacing: '-0.03em', marginBottom: 14 }}>Your reports stay yours</h2>
            <p style={{ fontSize: 15.5, color: 'var(--txt2)', lineHeight: 1.75, maxWidth: 560, margin: '0 auto 1.75rem' }}>
              Reports are processed privately and saved when you choose. Your account is optional,
              and every answer shows the evidence it's based on. Your data stays yours alone — that's our promise.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[['lock', 'Processed privately'], ['eye', 'Sources on every answer'], ['shield', 'Yours alone'], ['check_circle', 'Doctor-safe guidance']].map(([ic, t]) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--txt2)', background: 'var(--bg1)', border: '1px solid var(--bd)', padding: '8px 14px', borderRadius: 100 }}>
                  <Icon name={ic} size={13} color="var(--ok)" /> {t}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ maxWidth: 720, margin: '0 auto', padding: 'clamp(2rem, 5vw, 4rem) 0' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontWeight: 800, fontSize: 'clamp(1.7rem, 3.5vw, 2.3rem)', letterSpacing: '-0.03em' }}>Questions, answered</h2>
        </div>
        {[
          { q: 'Is FeelFit a substitute for a doctor?', a: 'FeelFit is your friendly guide to understanding lab reports in simple language — it works alongside your doctor, never in place of them. It steers clear of diagnoses, prescriptions, and treatment plans, so always partner with a qualified doctor for medical decisions.' },
          { q: 'What can I upload?', a: 'A PDF, a clear photo (JPEG/PNG), or a CSV of your lab report — up to 15MB. Common panels work well: CBC, lipid, thyroid, liver, kidney, HbA1c, vitamins, and more.' },
          { q: 'Is my data private?', a: 'Absolutely. Your report is processed privately and saved when you choose to. Your account is optional, so you can dive in freely.' },
          { q: 'Do I need an account?', a: 'No. You can analyze a report without signing up. Saving history and trends over time is optional.' },
        ].map(f => <FAQItem key={f.q} {...f} />)}
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '0 0 clamp(3rem, 6vw, 5rem)' }}>
        <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, ease: EASE }}
          style={{ textAlign: 'center', padding: 'clamp(2.5rem, 6vw, 4rem) 2rem', borderRadius: 'var(--rxl)', background: 'var(--accent-grad)', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-glow-lg)' }}>
          <h2 style={{ fontWeight: 700, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', letterSpacing: '-0.03em', color: 'var(--bg1)', marginBottom: 12 }}>Understand your results today</h2>
          <p style={{ color: 'var(--bg1)', opacity: 0.78, fontSize: '1.1rem', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 2rem' }}>
            2 free checks to start — sign up whenever you’re ready. Results in about 30 seconds.
          </p>
          <button onClick={onGetStarted} className="sweep" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '15px 34px', borderRadius: 100, background: 'var(--bg1)', color: 'var(--accent)', fontSize: 15.5, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.22)' }}>
            <Icon name="upload" size={16} color="var(--accent)" /> Analyze my report
          </button>
        </motion.div>
      </section>
    </div>
  );
}
