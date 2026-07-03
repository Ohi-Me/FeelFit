'use client';
import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { motion, AnimatePresence, EASE, springSoft } from '@/components/ui/motion';
import { haptic } from '@/lib/native';
import type { Tab } from '@/types';

interface NavbarProps {
  tab: Tab;
  setTab: (t: Tab) => void;
  dark: boolean;
  setDark: (d: boolean) => void;
  historyCount: number;
  onLogoClick: () => void;
  accountLabel?: string;
  accountActive?: boolean;
  loggedIn?: boolean;
  onAccountClick?: () => void;
  /** Opens the plans/upgrade view (Capacitor More sheet only). */
  onPlansClick?: () => void;
}

// Animated hamburger ⇄ X
function Burger({ open, color }: { open: boolean; color: string }) {
  const line: React.CSSProperties = { position: 'absolute', left: 9, right: 9, height: 1.8, borderRadius: 2, background: color };
  const tr = { duration: 0.32, ease: EASE };
  return (
    <div style={{ position: 'relative', width: 36, height: 36 }}>
      <motion.span style={{ ...line, top: 14 }} animate={{ rotate: open ? 45 : 0, y: open ? 4 : 0 }} transition={tr} />
      <motion.span style={{ ...line, top: 18 }} animate={{ opacity: open ? 0 : 1, scaleX: open ? 0.4 : 1 }} transition={{ duration: 0.2 }} />
      <motion.span style={{ ...line, top: 22 }} animate={{ rotate: open ? -45 : 0, y: open ? -4 : 0 }} transition={tr} />
    </div>
  );
}

const TABS: { k: Tab; icon: string; label: string }[] = [
  { k: 'home',      icon: 'home',        label: 'Home'      },
  { k: 'analyze',   icon: 'activity',    label: 'Analyze'   },
  { k: 'medicine',  icon: 'pill',        label: 'Medicine'  },
  { k: 'askfit',    icon: 'sparkles',    label: 'AskFit'    },
  { k: 'doctors',   icon: 'stethoscope', label: 'Doctors'   },
  { k: 'symptoms',  icon: 'search',      label: 'Symptoms'  },
  { k: 'tools',     icon: 'flask',       label: 'Tools'     },
  { k: 'dashboard', icon: 'chart',       label: 'Dashboard' },
];

// Capacitor "More" sheet: ONLY destinations that are NOT already one tap away
// on the bottom nav (Home/Analyze/AskFit/Meds/You live there) — no duplicates.
const MOBILE_MENU: { k: Tab; icon: string; label: string; sub: string }[] = [
  { k: 'doctors',  icon: 'stethoscope', label: 'Find Doctors',    sub: 'Real clinics near you'        },
  { k: 'symptoms', icon: 'search',      label: 'Symptom Checker', sub: 'What could this feeling be?'  },
  { k: 'tools',    icon: 'flask',       label: 'Health Tools',    sub: 'BMI, water, sleep & more'     },
  { k: 'about',    icon: 'info',        label: 'About FeelFit',   sub: 'Our promise, privacy & story' },
];

export function Navbar({ tab, setTab, dark, setDark, historyCount, onLogoClick, accountLabel, accountActive, loggedIn, onAccountClick, onPlansClick }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Capacitor: the header is hidden (bottom nav owns navigation), and the
  // "More" menu re-anchors as a bottom sheet just above the bottom nav.
  const [isCap, setIsCap] = useState(false);
  useEffect(() => { setIsCap(document.documentElement.classList.contains('is-capacitor')); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Allow other components (e.g. BottomNav's "More" button) to open the menu
  // without lifting state up — they dispatch a `ff:open-menu` CustomEvent.
  useEffect(() => {
    const onOpen = () => setMobileOpen(true);
    window.addEventListener('ff:open-menu', onOpen as EventListener);
    return () => window.removeEventListener('ff:open-menu', onOpen as EventListener);
  }, []);

  // Premium white-in-light / dark-glass-in-dark capsule
  const light = !dark;
  const capsuleBg = light ? 'rgba(255,255,255,0.92)' : 'rgba(22,34,30,0.82)';
  const capsuleBd = light ? 'var(--bd2)' : 'rgba(255,255,255,0.10)';
  const logoCol = light ? 'var(--txt)' : '#ecf3f1';
  const navInactive = light ? 'var(--txt3)' : 'rgba(236,243,241,0.6)';
  const ctaBg = light ? '#10201c' : '#ffffff';
  const ctaText = light ? '#ffffff' : '#10201c';
  const chipBd = light ? 'var(--bd2)' : 'rgba(255,255,255,0.14)';
  const iconCol = light ? 'var(--txt2)' : '#ecf3f1';

  return (
    <>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, padding: '14px clamp(0.6rem, 3vw, 1.5rem) 0', background: 'transparent', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          background: capsuleBg, border: `1px solid ${capsuleBd}`, maxWidth: 'calc(100% - 16px)',
          borderRadius: 999, padding: '6px 7px 6px 18px', display: 'inline-flex', alignItems: 'center', gap: 'clamp(12px, 2.5vw, 22px)',
          boxShadow: scrolled ? 'var(--shadow-lg)' : 'var(--shadow)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transition: 'box-shadow 0.25s',
        }}>

          {/* Logo — wordmark only (the F-mark lives in the favicon/footer) */}
          <button onClick={() => { onLogoClick(); setTab('home'); setMobileOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
            <span style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: '1.12rem', letterSpacing: '-0.01em', color: logoCol }}>FeelFit</span>
          </button>

          {/* Right actions — compact: Language · Get Started · Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Language switcher (whole-site translation). On Capacitor the
                header is hidden, so the switcher lives in the More sheet
                instead — rendering it here too would duplicate the Google
                widget host element's id. */}
            {!isCap && <LanguageSwitcher dark={dark} />}

            {/* Get Started — solid pill with a left→right shine sweep on hover */}
            <motion.button onClick={() => setTab('analyze')} className="sweep"
              whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.96 }} transition={springSoft}
              style={{ fontSize: 13.5, padding: '9px 18px', fontWeight: 700, borderRadius: 999, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, background: ctaBg, color: ctaText, border: 'none', flexShrink: 0 }}>
              {accountActive ? 'Unlimited' : 'Get Started'}
            </motion.button>

            {/* Menu (animated hamburger ⇄ X) */}
            <motion.button onClick={() => setMobileOpen(o => !o)} whileTap={{ scale: 0.92 }} title="Menu"
              style={{ width: 38, height: 38, borderRadius: 999, background: 'transparent', border: `1px solid ${chipBd}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
              <Burger open={mobileOpen} color={iconCol} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Menu + tap-anywhere backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            onClick={() => setMobileOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 98, background: 'rgba(0,0,0,0.25)' }} />
        )}
        {mobileOpen && (
          <motion.div key="menu"
            className={isCap ? 'ff-more-sheet' : undefined}
            initial={isCap ? { opacity: 0, y: 32, scale: 0.98 } : { opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={isCap ? { opacity: 0, y: 32, scale: 0.98 } : { opacity: 0, y: -14, scale: 0.96 }}
            transition={isCap ? { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'fixed', top: 78, left: 0, right: 0, margin: '0 auto', width: 'min(560px, calc(100% - 24px))', transformOrigin: 'top center', zIndex: 99, background: light ? '#111111' : '#1a1a1a', backdropFilter: isCap ? undefined : 'blur(24px)', WebkitBackdropFilter: isCap ? undefined : 'blur(24px)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 26, padding: '1.1rem', boxShadow: 'var(--shadow-xl)' }}>
            {isCap ? (
              /* ── Capacitor: single-column premium list — every destination
                    exactly once (bottom-nav tabs are excluded), then Plans,
                    Theme, and Language/Sign-in. ── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {MOBILE_MENU.map(({ k, icon, label, sub }, i) => {
                  const active = tab === k;
                  return (
                    <motion.button key={k} onClick={() => { haptic('select'); setTab(k); setMobileOpen(false); }}
                      initial={{ opacity: 0, y: 16, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.03 + i * 0.05, type: 'spring', stiffness: 420, damping: 30 }}
                      whileTap={{ scale: 0.97 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '13px 12px', borderRadius: 16, cursor: 'pointer', border: 'none', textAlign: 'left', background: active ? 'rgba(255,255,255,0.10)' : 'transparent', color: '#fff' }}>
                      <span style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.10)' }}>
                        <Icon name={icon} size={18} color={active ? '#fff' : 'rgba(255,255,255,0.75)'} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{label}</span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{sub}</span>
                      </span>
                      <Icon name="chevright" size={15} color="rgba(255,255,255,0.35)" />
                    </motion.button>
                  );
                })}

                {/* Plans — the footer's "View plans", now living here */}
                {onPlansClick && (
                  <motion.button onClick={() => { haptic('select'); onPlansClick(); setMobileOpen(false); }}
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.03 + MOBILE_MENU.length * 0.05, type: 'spring', stiffness: 420, damping: 30 }}
                    whileTap={{ scale: 0.97 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '13px 12px', borderRadius: 16, cursor: 'pointer', border: 'none', textAlign: 'left', background: 'transparent', color: '#fff' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(52,211,153,0.16)', border: '1px solid rgba(52,211,153,0.28)' }}>
                      <Icon name="zap" size={18} color="#34d399" />
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>{accountActive ? 'Your plan' : 'Plans & upgrade'}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{accountActive ? 'Unlimited is active' : 'Unlimited checks & premium AI'}</span>
                    </span>
                    <Icon name="chevright" size={15} color="rgba(255,255,255,0.35)" />
                  </motion.button>
                )}

                {/* Theme — the footer's Light/Dark toggle, now living here */}
                <motion.button onClick={() => { haptic('light'); setDark(!dark); }}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.03 + (MOBILE_MENU.length + 1) * 0.05, type: 'spring', stiffness: 420, damping: 30 }}
                  whileTap={{ scale: 0.97 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '13px 12px', borderRadius: 16, cursor: 'pointer', border: 'none', textAlign: 'left', background: 'transparent', color: '#fff' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 13, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.10)' }}>
                    <motion.span key={dark ? 'moon' : 'sun'} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} style={{ display: 'inline-flex' }}>
                      <Icon name={dark ? 'moon' : 'sun'} size={18} color="rgba(255,255,255,0.85)" />
                    </motion.span>
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600 }}>Appearance</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{dark ? 'Dark — tap for light' : 'Light — tap for dark'}</span>
                  </span>
                  {/* iOS-style switch */}
                  <span style={{ width: 42, height: 25, borderRadius: 999, padding: 2.5, flexShrink: 0, background: dark ? '#34d399' : 'rgba(255,255,255,0.18)', display: 'flex', justifyContent: dark ? 'flex-end' : 'flex-start', transition: 'background 0.25s' }}>
                    <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                  </span>
                </motion.button>
              </div>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
            {TABS.filter(t => !['home', 'analyze', 'askfit'].includes(t.k)).map(({ k, icon, label }, i) => {
              const active = tab === k;
              return (
              <motion.button key={k} onClick={() => { setTab(k); setMobileOpen(false); }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025, duration: 0.22, ease: EASE }}
                whileHover="hover" whileTap={{ scale: 0.97 }}
                style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 14, fontSize: 14.5, fontWeight: active ? 600 : 500, cursor: 'pointer', background: 'transparent', border: 'none', color: active ? '#ffffff' : 'rgba(255,255,255,0.66)', overflow: 'hidden' }}>
                {/* hover/active glow fill — slides in from left */}
                <motion.span aria-hidden
                  variants={{ hover: { opacity: 1, scaleX: 1 } }}
                  initial={false}
                  animate={{ opacity: active ? 1 : 0, scaleX: active ? 1 : 0.6 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  style={{ position: 'absolute', inset: 0, borderRadius: 14, transformOrigin: 'left', background: 'rgba(255,255,255,0.10)', zIndex: 0 }} />
                {/* left accent bar */}
                <motion.span aria-hidden
                  variants={{ hover: { scaleY: 1, opacity: 1 } }}
                  initial={false}
                  animate={{ scaleY: active ? 1 : 0, opacity: active ? 1 : 0 }}
                  transition={{ duration: 0.28, ease: EASE }}
                  style={{ position: 'absolute', left: 0, top: 9, bottom: 9, width: 3, borderRadius: 3, background: '#fff', zIndex: 1 }} />
                <motion.span variants={{ hover: { x: 4 } }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  style={{ position: 'relative', zIndex: 1, display: 'inline-flex' }}>
                  <Icon name={icon} size={16} color={active ? '#ffffff' : 'rgba(255,255,255,0.5)'} />
                </motion.span>
                <motion.span variants={{ hover: { x: 4 } }} transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  style={{ position: 'relative', zIndex: 1 }}>{label}</motion.span>
                {k === 'dashboard' && historyCount > 0 && (
                  <span style={{ position: 'relative', zIndex: 1, marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />
                )}
              </motion.button>
              );
            })}
            </div>
            )}

            {/* Footer: small, centered Sign in / up (+ language on Capacitor,
                where the header — its usual home — is hidden) */}
            {onAccountClick && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                {isCap && <LanguageSwitcher dark direction="up" />}
                <motion.button onClick={() => { onAccountClick(); setMobileOpen(false); }}
                  whileHover={{ y: -1, background: 'rgba(255,255,255,0.12)' }} whileTap={{ scale: 0.96 }} transition={springSoft}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 20px', borderRadius: 999, cursor: 'pointer', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: accountActive ? '#fff' : 'rgba(255,255,255,0.85)', fontSize: 12.5, fontWeight: 600 }}>
                  <Icon name={accountActive ? 'check_circle' : 'user'} size={14} color="#fff" />
                  {accountLabel || 'Sign in or up'}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
