'use client';
// ════════════════════════════════════════════════════════════════════════════
// usePullToRefresh — touch-driven PTR for Capacitor + mobile web
// ════════════════════════════════════════════════════════════════════════════
// Native apps feel premium when pull-to-refresh has weight. This hook wires
// touch events on document.body so any scrollable page can be refreshed by
// pulling down at scrollTop === 0. On release past the threshold, the caller's
// `onRefresh` is invoked (and a light haptic fires).
//
// On the desktop web build it does nothing — only activates on touch devices.
// ════════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { haptic, isCapacitor } from '@/lib/native';

interface PtrState {
  pulling: boolean;
  distance: number;
  refreshing: boolean;
}

const THRESHOLD = 70;
const MAX_PULL = 110;
const RESISTANCE = 0.55; // 1px input → 0.55px movement (feels heavier)

export function usePullToRefresh(onRefresh: () => Promise<void> | void, enabled = true) {
  const [state, setState] = useState<PtrState>({ pulling: false, distance: 0, refreshing: false });
  const startY = useRef(0);
  const active = useRef(false);
  const cbRef = useRef(onRefresh);
  cbRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;
    const isTouch = isCapacitor() || (('ontouchstart' in window) && window.matchMedia('(pointer: coarse)').matches);
    if (!isTouch) return;

    const onStart = (e: TouchEvent) => {
      if (state.refreshing) return;
      if (window.scrollY > 0) return;
      active.current = true;
      startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!active.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) { setState(s => ({ ...s, pulling: false, distance: 0 })); return; }
      if (window.scrollY <= 0 && dy > 4) {
        if (e.cancelable) e.preventDefault();
        const distance = Math.min(dy * RESISTANCE, MAX_PULL);
        setState({ pulling: true, distance, refreshing: false });
      }
    };
    const onEnd = async () => {
      if (!active.current) return;
      active.current = false;
      setState(s => {
        if (s.distance >= THRESHOLD) {
          haptic('medium');
          Promise.resolve(cbRef.current()).finally(() => {
            setState({ pulling: false, distance: 0, refreshing: false });
          });
          return { pulling: false, distance: 0, refreshing: true };
        }
        return { pulling: false, distance: 0, refreshing: false };
      });
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, state.refreshing]);

  return state;
}
