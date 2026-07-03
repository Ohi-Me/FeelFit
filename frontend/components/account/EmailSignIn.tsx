'use client';
import React, { useEffect, useState } from 'react';
import { Input, Select, Btn } from '@/components/ui/index';
import { Icon } from '@/components/ui/Icon';
import { signup, login, sendSignupOtp, type UsageStatus } from '@/lib/api';

/** Mirrors the backend's account_service.password_error rule so a weak password
 * is caught immediately, before wasting an OTP send on it. */
function passwordError(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include at least one special character (e.g. !@#$%).';
  return null;
}

export function EmailSignIn({ onSignedIn, onError }: { onSignedIn: (u: UsageStatus, isNew?: boolean) => void; onError: (m: string) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  const switchMode = (m: 'login' | 'signup') => { setMode(m); setStep('details'); setCode(''); onError(''); };

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { onError('Enter a valid email address.'); return; }
    const pwErr = passwordError(password);
    if (pwErr) { onError(pwErr); return; }
    setBusy(true); onError('');
    try {
      const r = await sendSignupOtp(email.trim());
      if (r.dev_code) setDevCode(r.dev_code); // local dev only, no SMTP configured
      setStep('code'); setResendIn(30);
    } catch (e) {
      onError((e as Error).message || 'Could not send the verification code — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 6) { onError('Enter the 6-digit code from your email.'); return; }
    setBusy(true); onError('');
    try {
      const r = await signup(email.trim(), password, code.trim(), {
        name: name.trim() || undefined,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || undefined,
      });
      onSignedIn(r.status, r.is_new_account);
    } catch (e) {
      onError((e as Error).message || 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || password.length < 6) { onError('Enter a valid email and a password of at least 6 characters.'); return; }
    setBusy(true); onError('');
    try {
      const r = await login(email.trim(), password);
      onSignedIn(r.status, r.is_new_account);
    } catch (e) {
      onError((e as Error).message || 'Something went wrong — please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'login') {
    return (
      <form onSubmit={doLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Input label="Email" type="email" icon="mail" placeholder="you@example.com" value={email}
          onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        <Input label="Password" type="password" icon="lock" placeholder="Your password" value={password}
          onChange={e => setPassword(e.target.value)} autoComplete="current-password" required minLength={6} />
        <Btn type="submit" variant="primary" loading={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
          Sign in
        </Btn>
        <button type="button" onClick={() => switchMode('signup')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center', padding: 4 }}>
          Don't have an account? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign up</span>
        </button>
      </form>
    );
  }

  if (step === 'code') {
    return (
      <form onSubmit={verifyAndCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center' }}>
          Enter the 6-digit code sent to {email}
        </p>
        {devCode && (
          <p style={{ fontSize: 11, color: 'var(--warn)', textAlign: 'center', background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', borderRadius: 'var(--rm)', padding: '6px 10px' }}>
            Dev mode (no email service configured) — code: <strong>{devCode}</strong>
          </p>
        )}
        <Input type="text" icon="lock" placeholder="123456" value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} required
          style={{ textAlign: 'center', letterSpacing: '0.3em', fontWeight: 700 }} />
        <Btn type="submit" variant="primary" loading={busy} style={{ width: '100%', justifyContent: 'center' }}>
          Verify & create account
        </Btn>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button type="button" onClick={() => { setStep('details'); setCode(''); setDevCode(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--txt3)' }}>
            <Icon name="chevleft" size={12} /> Back
          </button>
          <button type="button" disabled={resendIn > 0} onClick={sendCode as unknown as () => void}
            style={{ background: 'none', border: 'none', cursor: resendIn > 0 ? 'default' : 'pointer', fontSize: 12, color: resendIn > 0 ? 'var(--txt4)' : 'var(--accent)', fontWeight: 600 }}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={sendCode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Input label="Email" type="email" icon="mail" placeholder="you@example.com" value={email}
        onChange={e => setEmail(e.target.value)} autoComplete="email" required />
      <Input label="Password" type="password" icon="lock" placeholder="8+ chars, upper, lower, number & symbol" value={password}
        onChange={e => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />

      <p style={{ fontSize: 11.5, color: 'var(--txt4)', margin: '2px 0 0' }}>
        A little context helps FeelFit and AskFit give you more relevant answers — optional, but recommended.
      </p>
      <Input label="Full name" icon="user" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Age" type="number" placeholder="32" value={age} onChange={e => setAge(e.target.value)} min={0} max={120} />
        <Select label="Gender" value={gender} onChange={e => setGender(e.target.value)}
          options={[{ value: '', label: 'Select...' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
      </div>

      <Btn type="submit" variant="primary" loading={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
        Send verification code
      </Btn>
      <button type="button" onClick={() => switchMode('login')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center', padding: 4 }}>
        Already have an account? <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Sign in</span>
      </button>
    </form>
  );
}
