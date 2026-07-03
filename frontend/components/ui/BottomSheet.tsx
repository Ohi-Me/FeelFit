'use client';
// ════════════════════════════════════════════════════════════════════════════
// BottomSheet — native-feeling sheet that slides up from the bottom on phones
// ════════════════════════════════════════════════════════════════════════════
// On Capacitor (or any touch device), this renders a sheet that slides up from
// the bottom of the screen with a grabber handle, dimmed backdrop, and spring
// physics. On desktop web it renders nothing — callers should still render the
// normal <Modal> for desktop. We achieve this by accepting `children` and a
// `when` predicate; if `when` returns false (desktop), we return null and the
// caller's existing <Modal> handles the desktop case.
//
// Usage:
//   <>
//     <BottomSheet when={isCapacitor()} open={show} onClose={...}>...</BottomSheet>
//     {!isCapacitor() && <Modal ...>...</Modal>}
//   </>
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { haptic } from '@/lib/native';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** When false, the sheet renders nothing (caller should render <Modal> instead). */
  when?: boolean;
  /** Max height as a percentage of viewport. Default 0.85. */
  maxHeightRatio?: number;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function BottomSheet({ open, onClose, title, children, when = true, maxHeightRatio = 0.88 }: Props) {
  // Lock body scroll while open so the sheet scrolls independently.
  useEffect(() => {
    if (!open || !when) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, when]);

  // Close on Escape for desktop preview.
  useEffect(() => {
    if (!open || !when) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, when, onClose]);

  if (!when) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="bottom-sheet-root"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 280,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          {/* Dimmed backdrop — tap to close */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => { haptic('light'); onClose(); }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.9 }}
            className="ff-bottom-sheet"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 580,
              maxHeight: `${maxHeightRatio * 100}vh`,
              background: 'var(--bg1)',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              boxShadow: '0 -16px 48px rgba(0,0,0,0.32)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              paddingBottom: 'var(--sab, env(safe-area-inset-bottom, 0px))',
            }}
          >
            {/* Grabber handle */}
            <div
              onClick={onClose}
              style={{
                flexShrink: 0,
                paddingTop: 8,
                paddingBottom: 4,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'center',
              }}
              aria-label="Close sheet"
              role="button"
            >
              <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--bd3, rgba(128,128,128,0.5))' }} />
            </div>

            {/* Title row */}
            <div style={{
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 18px 14px',
              borderBottom: '1px solid var(--bd)',
            }}>
              <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 800, fontSize: '1.05rem', margin: 0 }}>{title}</h2>
              <button
                onClick={() => { haptic('light'); onClose(); }}
                aria-label="Close"
                style={{
                  width: 32, height: 32, borderRadius: 999,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--surf)', border: '1px solid var(--bd)',
                  color: 'var(--txt2)', cursor: 'pointer', padding: 0,
                }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '16px 18px 24px',
              flex: 1,
            }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
