'use client';
// ════════════════════════════════════════════════════════════════════════════
// useNativeBridge — one-time Capacitor bootstrapping
// ════════════════════════════════════════════════════════════════════════════
// Wires everything that should happen exactly once when the app boots inside
// Capacitor:
//   • bootstrapNative() — hide splash, set status bar, install safe-area vars
//   • add the `is-capacitor` class on <html> so mobile.css activates
//   • listen for the hardware Back button (Android) and route it through the
//     provided onBack handler
//   • listen for app pause/resume so the caller can refresh data on resume
//
// Returns the current platform so the caller can show platform-specific UI.
//
// IMPORTANT: the `opts` callbacks (onBack, onResume, onLeaveActive) are kept
// in a ref so they always see the latest state from the caller. Without this,
// the back-button listener would close over the *first render's* values of
// showAccount/showSignIn/tab — pressing back would always see stale `false`
// for those states and exit the app immediately.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import {
  bootstrapNative,
  isCapacitor,
  onBackButton,
  onAppStateChange,
  platform,
} from '@/lib/native';

export interface NativeBridgeOpts {
  onBack?: () => void;
  onLeaveActive?: () => void;
  onResume?: () => void;
}

export function useNativeBridge(opts?: NativeBridgeOpts) {
  const [ready, setReady] = useState(false);
  const [plat, setPlat] = useState<'android' | 'ios' | 'web'>('web');

  // Keep the latest opts in a ref so listeners attached ONCE on mount always
  // invoke the freshest closures (avoids the stale-closure bug).
  const optsRef = useRef<NativeBridgeOpts | undefined>(opts);
  optsRef.current = opts;

  useEffect(() => {
    const native = isCapacitor();
    setPlat(platform());
    if (native) {
      document.documentElement.classList.add('is-capacitor');
      document.documentElement.classList.add(`is-${platform()}`);
      // Load the persisted auth token from native secure storage BEFORE the
      // app renders — so the first /api/usage call has the right header.
      import('@/lib/api').then(({ loadToken }) => loadToken()).finally(() => {
        bootstrapNative().finally(() => setReady(true));
      });
    } else {
      setReady(true);
    }

    // Back button: read the freshest onBack from the ref.
    const offBack = onBackButton(canGoBack => {
      const cb = optsRef.current?.onBack;
      if (!cb) return;
      if (canGoBack) window.history.back();
      else cb();
    });

    // App pause/resume: read the freshest onResume/onLeaveActive from the ref.
    const offState = onAppStateChange(isActive => {
      if (isActive) optsRef.current?.onResume?.();
      else optsRef.current?.onLeaveActive?.();
    });

    return () => { offBack(); offState(); };
  }, []);

  return { ready, platform: plat, isCapacitor: isCapacitor() };
}
