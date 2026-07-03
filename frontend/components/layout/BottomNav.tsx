'use client';
// ════════════════════════════════════════════════════════════════════════════
// FeelFit — Mobile bottom navigation (Capacitor only)
// ════════════════════════════════════════════════════════════════════════════
// Renders nothing on the web build. On Capacitor it sits above the home
// indicator, gives thumb-friendly access to the 5 most-used tabs, and
// animates the active pill with a spring (mirrors the desktop Navbar's
// hover/active language). The "more" button opens the existing dropdown menu
// so secondary tabs (Symptoms, Tools, Dashboard, About) remain one tap away.
//
// Touch targets are 44pt (Apple HIG). Taps fire a light haptic.
// ════════════════════════════════════════════════════════════════════════════
import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { EASE } from '@/components/ui/motion';
import { isCapacitor, haptic } from '@/lib/native';
import type { Tab } from '@/types';

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  onMore: () => void;
}

const PRIMARY: { k: Tab; icon: string; label: string }[] = [
  { k: 'home',      icon: 'home',        label: 'Home'      },
  { k: 'analyze',   icon: 'activity',    label: 'Analyze'   },
  { k: 'askfit',    icon: 'sparkles',    label: 'AskFit'    },
  { k: 'medicine',  icon: 'pill',        label: 'Meds'      },
  { k: 'dashboard', icon: 'chart',       label: 'You'       },
];

export function BottomNav({ tab, setTab, onMore }: Props) {
  // SSR + web build: render nothing — the desktop Navbar still drives nav.
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { setShow(isCapacitor()); }, []);
  if (!show) return null;

  const handle = (t: Tab) => {
    haptic('select');
    setTab(t);
  };

  const moreActive = ['doctors', 'symptoms', 'tools', 'about'].includes(tab);

  // The active-tab pill glides between tabs via a shared layoutId — the same
  // "magic move" language as the desktop Navbar's hover fill, but springy.
  const pill = (
    <motion.span
      layoutId="ff-bn-active"
      className="ff-bn-active-bg"
      transition={{ type: 'spring', stiffness: 480, damping: 34, mass: 0.7 }}
      aria-hidden
    />
  );

  return (
    <nav className="ff-bottom-nav" role="navigation" aria-label="Primary">
      {PRIMARY.map(({ k, icon, label }) => {
        const active = tab === k;
        return (
          <button
            key={k}
            className={`ff-bottom-nav-item${active ? ' active' : ''}`}
            onClick={() => handle(k)}
            aria-current={active ? 'page' : undefined}
            aria-label={label}
          >
            <span className="ff-bn-icon">
              {active && pill}
              <motion.span
                animate={{ scale: active ? 1.08 : 1, y: active ? -1 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                style={{ display: 'inline-flex' }}
              >
                <Icon name={icon} size={20} color={active ? 'var(--txt)' : 'var(--txt3)'} sw={active ? 2 : 1.5} />
              </motion.span>
            </span>
            <span>{label}</span>
          </button>
        );
      })}
      <button
        className={`ff-bottom-nav-item${moreActive ? ' active' : ''}`}
        onClick={() => { haptic('select'); onMore(); }}
        aria-label="More"
      >
        <span className="ff-bn-icon">
          {moreActive && pill}
          <span style={{ display: 'inline-flex', position: 'relative', zIndex: 1 }}>
            <Icon name="menu" size={20} color={moreActive ? 'var(--txt)' : 'var(--txt3)'} />
          </span>
        </span>
        <span>More</span>
      </button>
    </nav>
  );
}
