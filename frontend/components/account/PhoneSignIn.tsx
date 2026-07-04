'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Input, Btn } from '@/components/ui/index';
import { Icon } from '@/components/ui/Icon';
import { firebaseEnabled, getFirebaseAuth } from '@/lib/firebase';
import { phoneSignIn, type UsageStatus } from '@/lib/api';
import { isCapacitor, haptic } from '@/lib/native';
import type { ConfirmationResult } from 'firebase/auth';

const COUNTRY_CODE = '+91'; // FeelFit is India-focused; extend if you go multi-country.

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10) return null;
  return `${COUNTRY_CODE}${digits}`;
}

export function PhoneSignIn({ onSignedIn, onError }: { onSignedIn: (u: UsageStatus, isNew?: boolean) => void; onError: (m: string) => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const verifierRef = useRef<import('firebase/auth').RecaptchaVerifier | null>(null);
  const [capacitorMode, setCapacitorMode] = useState(false);

  useEffect(() => { setCapacitorMode(isCapacitor()); }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  useEffect(() => () => { verifierRef.current?.clear(); }, []);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = normalizePhone(phone);
    if (!num) { onError('Enter a valid 10-digit mobile number.'); return; }
    onError(''); setBusy(true);
    try {
      const auth = await getFirebaseAuth();
      if (!auth) throw new Error('not-configured');
      const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
      // Inside Capacitor the standard invisible RecaptchaVerifier fails because
      // Google's reCAPTCHA doesn't accept capacitor://localhost as an authorized
      // domain. We pass `isMobileNative: true` to make Firebase use the
      // "device-aware" flow if the user has Firebase Auth ≥ v11.5 — otherwise
      // the call falls back to the standard verifier, which works in dev when
      // localhost is authorized in the Firebase console.
      const verifierOpts: any = { size: 'invisible' };
      if (capacitorMode) verifierOpts.isMobileNative = true;
      if (!verifierRef.current && recaptchaRef.current) {
        verifierRef.current = new RecaptchaVerifier(auth, recaptchaRef.current, verifierOpts);
      }
      confirmRef.current = await signInWithPhoneNumber(auth, num, verifierRef.current!);
      haptic('success');
      setStep('code'); setResendIn(30);
    } catch (err) {
      haptic('error');
      // Firebase's `.message` is frequently just "Firebase: Error (auth/<code>)."
      // with no descriptive text (the SDK only includes verbose descriptions
      // when the app opts into `debugErrorMap` — see lib/firebase.ts). `.code`
      // is ALWAYS the reliable machine-readable string, so classify on that,
      // not on substrings of a message that can be reduced to nothing useful.
      const code = (err as { code?: string }).code || '';
      const msg = (err as Error).message || '';
      // eslint-disable-next-line no-console
      console.error('[PhoneSignIn] sendCode failed:', code, msg);
      if (msg === 'not-configured') onError('Phone sign-in isn’t configured yet.');
      else if (code === 'auth/too-many-requests') onError('Too many attempts — please try again in a few minutes.');
      else if (code === 'auth/invalid-phone-number') onError('That phone number looks invalid.');
      else if (code === 'auth/unauthorized-domain' || code === 'auth/captcha-check-failed' || code === 'auth/invalid-app-credential') {
        onError(capacitorMode
          ? 'Phone sign-in needs Firebase authorized domains configured for the mobile app. Use email or Google sign-in for now.'
          : 'Phone sign-in needs this domain added under Firebase Console → Authentication → Settings → Authorized domains.');
      }
      else onError('Could not send the code — please try again.');
      // A failed attempt can leave the reCAPTCHA widget in a bad state (e.g.
      // "already used" token) — drop it so the next Send/Resend tap builds a
      // fresh verifier instead of silently repeating the same failure.
      verifierRef.current?.clear();
      verifierRef.current = null;
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) { onError('Enter the 6-digit code from your SMS.'); return; }
    if (!confirmRef.current) { onError('Please request a new code.'); setStep('phone'); return; }
    onError(''); setBusy(true);
    try {
      const cred = await confirmRef.current.confirm(code.trim());
      const idToken = await cred.user.getIdToken();
      const r = await phoneSignIn(idToken);
      haptic('success');
      onSignedIn(r.status, r.is_new_account);
    } catch (err) {
      haptic('error');
      const msg = (err as Error).message || '';
      if (msg.includes('invalid-verification-code')) onError('That code doesn’t match — check and try again.');
      else if (msg.includes('code-expired')) onError('That code expired — request a new one.');
      else onError('Could not verify that code — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseEnabled()) {
    return (
      <div style={{ padding: '14px 16px', background: 'var(--surf2)', border: '1px dashed var(--bd2)', borderRadius: 'var(--rm)', fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center', lineHeight: 1.6 }}>
        Phone sign-in isn’t configured yet. Add <code style={{ color: 'var(--txt2)' }}>NEXT_PUBLIC_FIREBASE_*</code> keys to enable it.
      </div>
    );
  }

  // Inside Capacitor, warn the user that phone OTP requires extra Firebase setup.
  const capacitorHint = capacitorMode && step === 'phone' && (
    <p style={{ fontSize: 11, color: 'var(--txt4)', textAlign: 'center', marginTop: 6, lineHeight: 1.55 }}>
      Phone OTP works inside the app once Firebase is configured to accept the mobile app’s domain. If the code doesn’t arrive, use email or Google sign-in.
    </p>
  );

  return (
    <div>
      <div ref={recaptchaRef} />
      {step === 'phone' ? (
        <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>
              Mobile number
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRadius: 'var(--rm)', background: 'var(--surf2)', border: '1px solid var(--bd)', fontSize: 14, color: 'var(--txt2)', fontWeight: 600 }}>
                {COUNTRY_CODE}
              </div>
              <Input type="tel" icon="phone" placeholder="98765 43210" value={phone}
                onChange={e => setPhone(e.target.value)} inputMode="numeric" maxLength={10} style={{ flex: 1 }} required />
            </div>
          </div>
          <Btn type="submit" variant="primary" loading={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            Send code
          </Btn>
          {capacitorHint}
        </form>
      ) : (
        <form onSubmit={verifyCode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center' }}>
            Enter the 6-digit code sent to {COUNTRY_CODE} {phone}
          </p>
          <Input type="text" icon="lock" placeholder="123456" value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required
            style={{ textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700 }} />
          <Btn type="submit" variant="primary" loading={busy} style={{ width: '100%', justifyContent: 'center' }}>
            Verify & continue
          </Btn>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button type="button" onClick={() => { setStep('phone'); setCode(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--txt3)' }}>
              <Icon name="chevleft" size={12} /> Change number
            </button>
            <button type="button" disabled={resendIn > 0} onClick={sendCode as unknown as () => void}
              style={{ background: 'none', border: 'none', cursor: resendIn > 0 ? 'default' : 'pointer', fontSize: 12, color: resendIn > 0 ? 'var(--txt4)' : 'var(--accent)', fontWeight: 600 }}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
