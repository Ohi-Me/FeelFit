'use client';
import React, { useState, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1] as const;

type Cat = 'Move' | 'Strength' | 'Eat' | 'Hydrate' | 'Sleep' | 'Mind' | 'Recover' | 'Habit';
const CAT_ICON: Record<Cat, string> = {
  Move: 'activity', Strength: 'dumbbell', Eat: 'salad', Hydrate: 'bottle',
  Sleep: 'moon', Mind: 'lotus', Recover: 'heart', Habit: 'calendar',
};

interface Tip { cat: Cat; title: string; body: string }

// 30+ practical, general-wellness tips. Not medical advice.
const TIPS: Tip[] = [
  { cat: 'Move', title: 'Aim for 7–8k steps', body: 'A daily walk is the single easiest win for heart health and mood. Park further, take stairs, pace on calls.' },
  { cat: 'Move', title: 'Break up sitting', body: 'Stand or stretch for two minutes every hour. Long unbroken sitting works against even a daily workout.' },
  { cat: 'Move', title: '10-minute morning movement', body: 'A short flow — squats, lunges, arm circles — wakes the body and sets an active tone for the day.' },
  { cat: 'Move', title: 'Walk after meals', body: 'A 10–15 minute walk after eating helps blunt blood-sugar spikes and aids digestion.' },
  { cat: 'Strength', title: 'Train strength 2× a week', body: 'Two short resistance sessions protect muscle, bone and metabolism as you age. Bodyweight counts.' },
  { cat: 'Strength', title: 'Master the squat', body: 'Sit-to-stand from a chair, 3 sets of 10. It builds the legs and hips that keep you mobile for life.' },
  { cat: 'Strength', title: 'Push, pull, hinge', body: 'Cover a push-up, a row, and a hip-hinge each week and you’ve trained most major muscle groups.' },
  { cat: 'Strength', title: 'Progress slowly', body: 'Add a rep or a little weight each week. Small, steady overload beats occasional heroics.' },
  { cat: 'Eat', title: 'Fill half your plate with veg', body: 'Vegetables bring fibre, vitamins and volume for few calories. Aim for colour and variety.' },
  { cat: 'Eat', title: 'Protein at every meal', body: 'A palm-sized portion keeps you full, steadies energy and protects muscle. Dal, eggs, paneer, chicken, fish.' },
  { cat: 'Eat', title: 'Choose whole grains', body: 'Swap refined flour for whole grains and millets — more fibre, slower energy, steadier appetite.' },
  { cat: 'Eat', title: 'Eat slowly', body: 'It takes ~20 minutes for fullness to register. Slowing down naturally trims how much you eat.' },
  { cat: 'Eat', title: 'Cut sugary drinks', body: 'Liquid sugar adds up fast without filling you. Water, chaas, or unsweetened tea are easy swaps.' },
  { cat: 'Eat', title: 'Snack on a handful of nuts', body: 'Almonds, walnuts or peanuts give healthy fats and protein that carry you to the next meal.' },
  { cat: 'Eat', title: 'Plan tomorrow tonight', body: 'A loose plan for the next day’s meals beats deciding while hungry — the hungry brain picks worse.' },
  { cat: 'Hydrate', title: 'Start the day with water', body: 'A glass on waking rehydrates you after sleep and often curbs a false morning hunger.' },
  { cat: 'Hydrate', title: 'Keep a bottle in sight', body: 'Visible water gets sipped. Aim for pale-yellow urine as a simple hydration check.' },
  { cat: 'Hydrate', title: 'Drink around workouts', body: 'Sip before, during and after exercise — even mild dehydration saps strength and focus.' },
  { cat: 'Sleep', title: 'Protect 7–9 hours', body: 'Sleep is when the body repairs and the brain files memories. It’s a performance tool, not a luxury.' },
  { cat: 'Sleep', title: 'Keep a steady schedule', body: 'Same sleep and wake time — even on weekends — anchors your body clock and improves sleep quality.' },
  { cat: 'Sleep', title: 'Dim screens before bed', body: 'Wind down 30–60 minutes screen-free. Bright light late tells your brain it’s still daytime.' },
  { cat: 'Sleep', title: 'Cool, dark, quiet', body: 'A slightly cool, dark room is the easiest environment to fall and stay asleep in.' },
  { cat: 'Mind', title: 'Breathe 4-7-8', body: 'Inhale 4, hold 7, exhale 8. A minute of slow breathing calms the nervous system anywhere.' },
  { cat: 'Mind', title: 'Take a daylight break', body: 'A few minutes of morning sunlight steadies mood and sleep rhythm better than any app.' },
  { cat: 'Mind', title: 'Name three good things', body: 'A tiny daily gratitude habit reliably nudges mood and lowers stress over time.' },
  { cat: 'Mind', title: 'Single-task for 25 min', body: 'Focused blocks with short breaks beat constant switching — kinder on the mind, better for output.' },
  { cat: 'Recover', title: 'Take rest days', body: 'Muscles grow during recovery, not just training. A lighter day is part of the plan, not a failure.' },
  { cat: 'Recover', title: 'Stretch tight spots', body: 'A few minutes on hips, hamstrings and shoulders eases the stiffness of desk life.' },
  { cat: 'Recover', title: 'Warm up, cool down', body: 'Five easy minutes either side of exercise lowers injury risk and helps you bounce back faster.' },
  { cat: 'Habit', title: 'Stack a new habit', body: 'Attach a habit to one you already do — “after I brush my teeth, I stretch.” Cues beat willpower.' },
  { cat: 'Habit', title: 'Make it two minutes', body: 'Shrink any goal to a two-minute start. Showing up is the habit; the rest follows.' },
  { cat: 'Habit', title: 'Track one number', body: 'Steps, glasses of water, or sleep — watching a single metric gently pulls it in the right direction.' },
  { cat: 'Habit', title: 'Never miss twice', body: 'One slip is life; two becomes a pattern. The goal isn’t perfect — it’s getting back on the next day.' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SHOW = 9;

export function FitTips() {
  // Reshuffles on every page load; the button reshuffles on demand.
  const [tips, setTips] = useState<Tip[]>(() => shuffle(TIPS).slice(0, SHOW));
  const [nonce, setNonce] = useState(0);
  const reshuffle = useCallback(() => { setTips(shuffle(TIPS).slice(0, SHOW)); setNonce(n => n + 1); }, []);

  return (
    <section style={{ padding: 'clamp(2rem, 5vw, 4rem) 0' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: '2rem' }}>
        <div>
          <span style={{ fontSize: 12, color: 'var(--ok)', fontFamily: 'var(--fm)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Stay fit</span>
          <h2 style={{ fontWeight: 700, fontSize: 'clamp(1.7rem, 3.5vw, 2.4rem)', letterSpacing: '-0.03em', marginTop: 10 }}>Little things that keep you well</h2>
          <p style={{ fontSize: 14.5, color: 'var(--txt2)', lineHeight: 1.7, maxWidth: 520, marginTop: 8 }}>
            {TIPS.length}+ simple, doable ideas on moving, eating, resting and feeling better — a fresh set every time you visit.
          </p>
        </div>
        <motion.button onClick={reshuffle} whileHover={{ y: -2 }} whileTap={{ scale: 0.96 }}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 999, cursor: 'pointer',
            background: 'var(--ok-bg)', border: '1px solid var(--ok)', color: 'var(--ok)', fontSize: 13.5, fontWeight: 600 }}>
          <Icon name="refresh" size={15} color="var(--ok)" /> Show me more
        </motion.button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {tips.map((t, i) => (
          <motion.div key={`${nonce}-${t.title}`}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (i % SHOW) * 0.04, duration: 0.45, ease: EASE }}
            whileHover={{ y: -4 }}
            style={{ padding: '1.25rem', borderRadius: 'var(--rxl)', background: 'var(--surf)', border: '1px solid var(--bd2)', boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name={CAT_ICON[t.cat]} size={18} color="var(--ok)" />
              </div>
              <span style={{ fontFamily: 'var(--fm)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt4)' }}>{t.cat}</span>
            </div>
            <h3 style={{ fontWeight: 600, fontSize: 16, letterSpacing: '-0.01em' }}>{t.title}</h3>
            <p style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.65 }}>{t.body}</p>
          </motion.div>
        ))}
      </div>

      <p style={{ marginTop: 18, fontSize: 11.5, color: 'var(--txt4)', textAlign: 'center' }}>
        General wellness ideas — here to help you feel your best, not to replace your doctor.
      </p>
    </section>
  );
}
