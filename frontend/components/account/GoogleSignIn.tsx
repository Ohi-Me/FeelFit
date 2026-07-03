'use client';
import React, { useEffect, useRef, useState } from 'react';
import { googleSignIn, type UsageStatus } from '@/lib/api';
import { isCapacitor, openExternal, haptic } from '@/lib/native';
import { Icon } from '@/components/ui/Icon';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

// Module-level singleton so every mount (including React StrictMode's
// intentional double-invoke in dev) shares one load, instead of racing
// multiple <script> tags / 'load' listeners against each other — that race
// was the actual cause of "nothing happens": window.google could exist
// before google.accounts.id was populated, so an early mount would call
// accounts.id.initialize() on a half-initialised object and throw.
let gsiPromise: Promise<void> | null = null;

function loadGsi(): Promise<void> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise((resolve, reject) => {
    let settled = false;
    const ready = () => {
      if (settled) return;
      const g = (window as unknown as { google?: any }).google;
      if (!g?.accounts?.id) return; // not actually ready yet — wait for onGoogleLibraryLoad
      settled = true;
      resolve();
    };
    const existing = (window as unknown as { google?: any }).google;
    if (existing?.accounts?.id) { settled = true; resolve(); return; }

    // The authoritative signal per Google's docs — fires once accounts.id is
    // truly populated, unlike the script's own 'load' event which can fire
    // before the library finishes internal setup.
    (window as unknown as { onGoogleLibraryLoad?: () => void }).onGoogleLibraryLoad = ready;

    const existingScript = document.getElementById('gsi-script') as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', ready, { once: true });
      existingScript.addEventListener('error', () => { if (!settled) reject(new Error('Could not reach Google.')); }, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true; s.id = 'gsi-script';
    s.onload = ready;
    s.onerror = () => { if (!settled) reject(new Error('Could not reach Google.')); };
    document.body.appendChild(s);

    // Fallback: if neither signal fires (unlikely), stop waiting instead of hanging forever.
    setTimeout(() => { if (!settled) reject(new Error('Timed out waiting for Google sign-in to load.')); }, 8000);
  });
  // Let a failed load be retried on the next call instead of caching the rejection forever.
  gsiPromise.catch(() => { gsiPromise = null; });
  return gsiPromise;
}

/** Real Google Sign-In via Google Identity Services. Shared by the navbar
 * sign-in modal and the plans/payment modal.
 *
 * On the web build we use the GIS button (rendered into a div). Inside
 * Capacitor the GIS script can't reliably initialize because Google restricts
 * authorized JavaScript origins to https URLs (capacitor://localhost is not
 * accepted). We fall back to an OAuth redirect flow: open the Google consent
 * screen in the in-app browser, the user signs in, and Google redirects to
 * the backend's /api/auth/google/callback URL which forwards the credential
 * back to the app via deep link.
 */
export function GoogleSignIn({ onSignedIn, onError }: { onSignedIn: (u: UsageStatus, isNew?: boolean) => void; onError: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [capacitorMode, setCapacitorMode] = useState(false);

  useEffect(() => { setCapacitorMode(isCapacitor()); }, []);

  // ── Capacitor fallback: open Google OAuth in the in-app browser ──────────
  // The backend exposes /api/auth/google/mobile?return_to=app.feelfit.mobile
  // which builds the OAuth URL with the right redirect URI and returns a 302
  // to Google's consent screen. After consent, Google redirects to the
  // backend's /api/auth/google/callback which then deep-links back to the app
  // with the credential in the URL fragment.
  const handleCapacitorGoogleSignIn = async () => {
    haptic('select');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
    const url = `${apiBase}/api/auth/google/mobile?return_to=app.feelfit.mobile`;
    try {
      await openExternal(url);
    } catch {
      onError('Could not open Google sign-in. Please try again.');
    }
  };

  // Listen for the deep-link callback (capacitor://app.feelfit.mobile/auth?token=…)
  useEffect(() => {
    if (!capacitorMode) return;
    const handler = async (e: MessageEvent) => {
      // The backend's interstitial page posts a message with the credential.
      if (e?.data?.feelfit_credential) {
        try {
          const r = await googleSignIn(e.data.feelfit_credential);
          onSignedIn(r.status, r.is_new_account);
        } catch (err) {
          onError((err as Error).message || 'Google sign-in failed.');
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [capacitorMode, onSignedIn, onError]);

  // ── Web build: GIS button flow ───────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || capacitorMode) return;
    let cancelled = false;
    loadGsi()
      .then(() => {
        if (cancelled || !ref.current) return;
        const g = (window as unknown as { google?: any }).google;
        g.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (resp: { credential: string }) => {
            try { const r = await googleSignIn(resp.credential); onSignedIn(r.status, r.is_new_account); }
            catch (e) { onError((e as Error).message || 'Google sign-in failed — please try again.'); }
          },
        });
        g.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', shape: 'pill', width: 320, text: 'continue_with' });
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[GoogleSignIn] failed to load:', e);
        onError('Could not load Google sign-in — please check your connection and try again.');
      });
    return () => { cancelled = true; };
  }, [onSignedIn, onError, capacitorMode]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <div style={{ padding: '14px 16px', background: 'var(--surf2)', border: '1px dashed var(--bd2)', borderRadius: 'var(--rm)', fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center', lineHeight: 1.6 }}>
        Google sign-in isn’t configured yet. Add <code style={{ color: 'var(--txt2)' }}>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable it.
      </div>
    );
  }

  // ── Capacitor: rendered as a native-styled button (mimics the GIS pill) ──
  if (capacitorMode) {
    return (
      <button
        type="button"
        onClick={handleCapacitorGoogleSignIn}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', maxWidth: 320, margin: '0 auto',
          padding: '12px 18px', borderRadius: 999,
          background: '#fff', color: '#3c4043',
          border: '1px solid #dadce0',
          fontSize: 14, fontWeight: 500, cursor: 'pointer',
          boxShadow: '0 1px 3px rgba(60,64,67,0.3)',
        }}
      >
        <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        Continue with Google
      </button>
    );
  }

  return <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />;
}
