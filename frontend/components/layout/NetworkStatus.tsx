'use client';
// ════════════════════════════════════════════════════════════════════════════
// NetworkStatus — Capacitor + web network-aware banner
// ════════════════════════════════════════════════════════════════════════════
// Shows a non-blocking banner at the top of the screen whenever the device
// loses connectivity. Inside Capacitor it uses @capacitor/network; on the web
// it falls back to window online/offline events. The banner auto-hides when
// the connection is restored (after a 1.2s grace period to avoid flapping).
//
// Placement: rendered once near the app root (see app/page.tsx). The banner
// is fixed-position so it floats above the navbar.
// ════════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { onNetworkChange, getNetworkStatus } from '@/lib/native';

export function NetworkStatus() {
  const [online, setOnline] = useState(true);
  const [type, setType] = useState('wifi');

  useEffect(() => {
    let mounted = true;
    // Check once on mount — covers cold-launch offline state.
    getNetworkStatus().then(s => {
      if (!mounted) return;
      setOnline(s.connected);
      setType(s.type);
    });
    const off = onNetworkChange((connected, t) => {
      setOnline(connected);
      setType(t);
    });
    return () => { mounted = false; off(); };
  }, []);

  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="offline-banner"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.7 }}
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 'var(--sat, 0px)',
            left: 0,
            right: 0,
            zIndex: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '10px 16px',
            background: 'var(--danger)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
          }}
        >
          <motion.span
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'inline-flex' }}
          >
            <Icon name="wifi_off" size={14} color="#fff" />
          </motion.span>
          <span>You're offline — some features won't work until you're back online.</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
