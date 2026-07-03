'use client';
import React, { useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

interface Section {
  id: string;
  eyebrow: string;
  icon: string;
  title: string;
  lead: string;
  points: { icon: string; t: string; d: string }[];
}

const SECTIONS: Section[] = [
  {
    id: 'health-education',
    eyebrow: 'Understand your body',
    icon: 'heart',
    title: 'Knowledge that empowers you',
    lead: 'FeelFit helps you truly understand your own body. Every lab value is explained in simple, calm language — what it measures, what your number means, and what is worth a friendly chat with your doctor.',
    points: [
      { icon: 'sparkles', t: 'Simple explanations', d: 'Clear, friendly language. Each result becomes a sentence a human can actually use.' },
      { icon: 'shield', t: 'Always supportive', d: 'Calm, encouraging guidance that points you toward the right conversation.' },
      { icon: 'stethoscope', t: 'Built around your doctor', d: 'Walk into your appointment already knowing which questions to ask.' },
    ],
  },
  {
    id: 'sources-shown',
    eyebrow: 'Sources shown',
    icon: 'eye',
    title: 'Every answer shows its evidence',
    lead: 'FeelFit is grounded in trusted medical references — LOINC for lab semantics, plus public sources like NIH and peer-reviewed guidance. When AskFit answers a question, it shows the sources behind it instead of guessing from memory.',
    points: [
      { icon: 'layers', t: 'Retrieval-grounded', d: 'Answers are assembled from a curated knowledge base, not invented on the spot.' },
      { icon: 'file', t: 'Citations attached', d: 'Look for the NIH / LOINC chips under each answer — that is the receipt.' },
      { icon: 'check_circle', t: 'Deterministic ranges', d: 'High / low / critical flags are computed from reference ranges, not estimated by a model.' },
    ],
  },
  {
    id: 'privacy-first',
    eyebrow: 'Privacy first',
    icon: 'lock',
    title: 'Your reports stay yours',
    lead: 'Analyze a report freely — your account is optional. Reports are processed privately and saved when you choose to. Your data stays yours alone, always.',
    points: [
      { icon: 'user', t: 'Start free, sign up later', d: 'Run the full analysis instantly — your account is optional.' },
      { icon: 'lock', t: 'Processed privately', d: 'Your file is read to produce your result, then let go.' },
      { icon: 'shield', t: 'Yours alone', d: 'Private by design — your data stays with you.' },
    ],
  },
  {
    id: 'made-for-india',
    eyebrow: 'Made with care',
    icon: 'heart',
    title: 'Designed around real life',
    lead: 'FeelFit understands the reports, brands, and everyday realities people face. From familiar brand-name medicines to nearby doctors, it is tuned for the way care actually works in your life.',
    points: [
      { icon: 'pill', t: 'Brand-name medicines', d: 'Everyday brands like Dolo and Crocin mapped to their generics and uses.' },
      { icon: 'stethoscope', t: 'Find a doctor nearby', d: 'Real, map-based doctor discovery — free and open for everyone.' },
      { icon: 'zap', t: 'Fast & affordable', d: 'Results in about 30 seconds, with passes priced for everyone.' },
    ],
  },
];

export function AboutPage({ scrollToId, onGetStarted }: { scrollToId?: string; onGetStarted?: () => void }) {
  useEffect(() => {
    if (scrollToId) {
      const t = setTimeout(() => document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      return () => clearTimeout(t);
    }
  }, [scrollToId]);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* Header */}
      <section style={{ textAlign: 'center', padding: 'clamp(1.5rem, 5vw, 3.5rem) 0 clamp(1.5rem, 4vw, 2.5rem)' }}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 15px', borderRadius: 100, background: 'var(--surf)', border: '1px solid var(--bd2)', marginBottom: 24, fontSize: 12.5, fontWeight: 600, color: 'var(--txt2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }} /> About FeelFit
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.05 }}
          style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: 'clamp(2.2rem, 6vw, 3.4rem)', lineHeight: 1.05, letterSpacing: '-0.03em', marginBottom: 18 }}>
          Calm, clear, and on your side
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.6 }}
          style={{ fontSize: 'clamp(1.02rem, 2.4vw, 1.2rem)', color: 'var(--txt2)', maxWidth: 600, margin: '0 auto', lineHeight: 1.7 }}>
          FeelFit turns confusing lab reports into something you can actually understand — privately,
          with the evidence in plain sight, and built around the way you really live.
        </motion.p>
      </section>

      {/* Sections */}
      {SECTIONS.map((s, i) => (
        <motion.section key={s.id} id={s.id}
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: EASE }}
          style={{ scrollMarginTop: 100, padding: 'clamp(1.5rem, 4vw, 2.5rem)', marginBottom: '1.25rem', borderRadius: 'var(--rxl)', background: i % 2 === 0 ? 'var(--surf)' : 'var(--surf2)', border: '1px solid var(--bd2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <div style={{ width: 50, height: 50, borderRadius: 15, background: 'var(--bg1)', border: '1px solid var(--bd2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'var(--shadow-sm)' }}>
              <Icon name={s.icon} size={22} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--txt4)', marginBottom: 4 }}>{s.eyebrow}</div>
              <h2 style={{ fontWeight: 600, fontSize: 'clamp(1.4rem, 3vw, 1.9rem)', letterSpacing: '-0.02em' }}>{s.title}</h2>
            </div>
          </div>
          <p style={{ fontSize: 15.5, color: 'var(--txt2)', lineHeight: 1.75, maxWidth: 640, marginBottom: 22 }}>{s.lead}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {s.points.map(p => (
              <div key={p.t} style={{ padding: '16px 16px', borderRadius: 'var(--rl)', background: 'var(--bg1)', border: '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
                  <Icon name={p.icon} size={16} color="var(--accent)" />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.t}</span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--txt3)', lineHeight: 1.6 }}>{p.d}</p>
              </div>
            ))}
          </div>
        </motion.section>
      ))}

      {/* Made with love — Ohi */}
      <motion.section
        initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.7, ease: EASE }}
        style={{ textAlign: 'center', padding: 'clamp(2.5rem, 6vw, 4rem) 2rem', margin: '1.25rem 0 clamp(3rem, 6vw, 5rem)', borderRadius: 'var(--rxl)', background: 'var(--accent-grad)', position: 'relative', overflow: 'hidden', boxShadow: 'var(--shadow-glow-lg)' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: 16, background: 'var(--bg1)', marginBottom: 18 }}>
          <BrandMark size={28} glyph="var(--accent)" bg="var(--bg1)" />
        </div>
        <h2 style={{ fontWeight: 700, fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', letterSpacing: '-0.03em', color: 'var(--bg1)', marginBottom: 12 }}>
          Made with love, by Ohi
        </h2>
        <p style={{ color: 'var(--bg1)', opacity: 0.8, fontSize: '1.08rem', lineHeight: 1.7, maxWidth: 500, margin: '0 auto 1.75rem' }}>
          FeelFit is a labour of love — built so everyone feels clear and confident looking at their own
          health report. Thoughtfully crafted, endlessly refined, and always on your side. 💛
        </p>
        {onGetStarted && (
          <button onClick={onGetStarted} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '14px 30px', borderRadius: 100, background: 'var(--bg1)', color: 'var(--accent)', fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.22)' }}>
            <Icon name="upload" size={16} color="var(--accent)" /> Analyze my report
          </button>
        )}
        <p style={{ marginTop: 22, fontFamily: 'var(--fm)', fontSize: 11.5, letterSpacing: '0.08em', color: 'var(--bg1)', opacity: 0.55 }}>
          © 2026 FeelFit · Made with care
        </p>
      </motion.section>
    </div>
  );
}
