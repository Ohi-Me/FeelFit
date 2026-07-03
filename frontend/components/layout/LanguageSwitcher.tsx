'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion, AnimatePresence } from '@/components/ui/motion';

// Popular languages spoken across India (+ English). Native names shown in the menu.
const LANGS: { code: string; label: string; native: string }[] = [
  { code: 'en', label: 'English',   native: 'English' },
  { code: 'hi', label: 'Hindi',     native: 'हिन्दी' },
  { code: 'bn', label: 'Bengali',   native: 'বাংলা' },
  { code: 'te', label: 'Telugu',    native: 'తెలుగు' },
  { code: 'mr', label: 'Marathi',   native: 'मराठी' },
  { code: 'ta', label: 'Tamil',     native: 'தமிழ்' },
  { code: 'gu', label: 'Gujarati',  native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada',   native: 'ಕನ್ನಡ' },
  { code: 'pa', label: 'Punjabi',   native: 'ਪੰਜਾਬੀ' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
  { code: 'ur', label: 'Urdu',      native: 'اردو' },
];
const INCLUDED = LANGS.map(l => l.code).join(',');

declare global {
  interface Window { google?: any; googleTranslateElementInit?: () => void }
}

/**
 * Whole-site language switcher. Drives a hidden Google Website Translate widget,
 * so picking a language re-renders the entire page in that language.
 */
export function LanguageSwitcher({ dark, direction = 'down' }: { dark?: boolean; direction?: 'down' | 'up' }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('en');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const m = document.cookie.match(/googtrans=\/[^/]*\/([^;]+)/);
    if (m && m[1]) setCurrent(m[1]);

    window.googleTranslateElementInit = () => {
      try {
        new window.google.translate.TranslateElement(
          { pageLanguage: 'en', includedLanguages: INCLUDED, autoDisplay: false },
          'google_translate_element',
        );
      } catch { /* ignore */ }
    };
    if (!document.getElementById('google-translate-script')) {
      const s = document.createElement('script');
      s.id = 'google-translate-script';
      s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.async = true;
      document.body.appendChild(s);
    } else if (window.google?.translate) {
      window.googleTranslateElementInit();
    }
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const choose = (code: string) => {
    setCurrent(code);
    setOpen(false);
    const combo = document.querySelector<HTMLSelectElement>('.goog-te-combo');
    if (combo) {
      combo.value = code;
      combo.dispatchEvent(new Event('change'));
    }
    if (code === 'en') {
      document.cookie = 'googtrans=;path=/;max-age=0';
      if (!combo) window.location.reload();
    } else {
      document.cookie = `googtrans=/en/${code};path=/`;
      if (!combo) window.location.reload();
    }
  };

  const cur = LANGS.find(l => l.code === current) || LANGS[0];
  const fg = dark ? '#ecf3f1' : 'var(--txt2)';
  const panelBg = dark ? '#1a1a1a' : '#ffffff';

  return (
    <div ref={ref} className="notranslate" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {/* hidden Google widget host */}
      <div id="google_translate_element" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }} />

      <motion.button onClick={() => setOpen(o => !o)} whileTap={{ scale: 0.94 }} title="Change language"
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 9px', borderRadius: 999, background: 'transparent', border: 'none', cursor: 'pointer', color: fg, fontSize: 12.5, fontWeight: 600, flexShrink: 0 }}>
        <Icon name="globe" size={15} color={fg} />
        <span className="hide-mobile" style={{ maxWidth: 58, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cur.native}</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: direction === 'up' ? 6 : -6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: direction === 'up' ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            style={{ position: 'absolute', ...(direction === 'up' ? { bottom: 'calc(100% + 10px)' } : { top: 'calc(100% + 10px)' }), right: 0, zIndex: 300, background: panelBg, border: '1px solid var(--bd2)', borderRadius: 16, padding: 6, minWidth: 180, boxShadow: 'var(--shadow-xl)', maxHeight: 340, overflowY: 'auto' }}>
            {LANGS.map(l => {
              const active = current === l.code;
              return (
                <button key={l.code} onClick={() => choose(l.code)}
                  style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 12px', borderRadius: 10, cursor: 'pointer', border: 'none',
                    background: active ? 'var(--ok-bg)' : 'transparent', color: active ? 'var(--ok)' : 'var(--txt)', fontSize: 13.5 }}>
                  <span style={{ fontWeight: active ? 700 : 500 }}>{l.native}</span>
                  <span style={{ opacity: 0.5, fontSize: 11.5 }}>{l.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
