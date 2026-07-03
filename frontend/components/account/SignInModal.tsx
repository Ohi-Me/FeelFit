'use client';
import React, { useState } from 'react';
import { Modal, Btn, Input, Select } from '@/components/ui/index';
import { Icon } from '@/components/ui/Icon';
import { GoogleSignIn } from '@/components/account/GoogleSignIn';
import { EmailSignIn } from '@/components/account/EmailSignIn';
import { PhoneSignIn } from '@/components/account/PhoneSignIn';
import { logout, saveProfile, type UsageStatus } from '@/lib/api';

type Method = 'google' | 'phone' | 'email';

interface Props {
  usage: UsageStatus | null;
  onClose: () => void;
  onChange: (u: UsageStatus) => void;
}

const TABS: { k: Method; icon: string; label: string }[] = [
  { k: 'google', icon: 'globe', label: 'Google' },
  { k: 'phone',  icon: 'phone', label: 'Phone' },
  { k: 'email',  icon: 'mail',  label: 'Email' },
];

/** Shown once, right after a brand-new Google/Phone signup (email already
 * collects this inline in its own form). A couple of quick details here go a
 * long way toward more relevant FeelFit summaries and AskFit answers. */
function OnboardingStep({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await saveProfile('', {
        name: name.trim() || undefined,
        age: age ? parseInt(age, 10) : undefined,
        gender: gender || undefined,
      });
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center', lineHeight: 1.6, marginBottom: 4 }}>
        A little context helps FeelFit and AskFit give you more relevant answers — optional, takes 10 seconds.
      </p>
      <Input label="Full name" icon="user" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Input label="Age" type="number" placeholder="32" value={age} onChange={e => setAge(e.target.value)} min={0} max={120} />
        <Select label="Gender" value={gender} onChange={e => setGender(e.target.value)}
          options={[{ value: '', label: 'Select...' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
      </div>
      <Btn type="submit" variant="primary" loading={busy} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
        Continue
      </Btn>
      <button type="button" onClick={onDone}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--txt3)', textAlign: 'center', padding: 4 }}>
        Skip for now
      </button>
    </form>
  );
}

/** Pure sign-in / sign-up / account status — no plans, no payment. Reachable
 * from the navbar. Buying a plan lives only in AccountModal (footer "View
 * plans" or when the free limit is hit). */
export function SignInModal({ usage, onClose, onChange }: Props) {
  const [method, setMethod] = useState<Method>('google');
  const [err, setErr] = useState('');
  const [pendingUsage, setPendingUsage] = useState<UsageStatus | null>(null);

  const handleSignedIn = (u: UsageStatus, isNew?: boolean) => {
    setErr('');
    // Email already asked for name/age/gender inline during signup — only
    // Google/Phone need this follow-up step, and only for a brand-new account.
    if (isNew && method !== 'email') { setPendingUsage(u); return; }
    onChange(u); onClose();
  };

  const finishOnboarding = () => {
    if (pendingUsage) onChange(pendingUsage);
    onClose();
  };

  if (pendingUsage) {
    return (
      <Modal title="Tell us about yourself" onClose={finishOnboarding} width={380}>
        <OnboardingStep onDone={finishOnboarding} />
      </Modal>
    );
  }

  if (usage?.email) {
    return (
      <Modal title="Your account" onClose={onClose} width={380}>
        <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--glow2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Icon name="user" size={24} color="var(--accent)" />
          </div>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>{usage.email}</h3>
          <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 6 }}>
            {usage.is_paid ? 'Unlimited plan active — thanks for being a member!' : `${usage.remaining_free} of ${usage.free_limit} free checks left.`}
          </p>
          <Btn variant="ghost" onClick={() => { logout(); onChange({ ...(usage as UsageStatus), email: null, is_paid: false }); }} style={{ marginTop: 16 }}>
            Log out
          </Btn>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Sign in or create account" onClose={onClose} width={400}>
      <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 999, background: 'var(--surf2)', border: '1px solid var(--bd)', marginBottom: 18 }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => { setMethod(t.k); setErr(''); }}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none',
              background: method === t.k ? 'var(--accent)' : 'transparent', color: method === t.k ? 'var(--bg1)' : 'var(--txt3)',
            }}>
            <Icon name={t.icon} size={13} color={method === t.k ? 'var(--bg1)' : 'var(--txt3)'} /> {t.label}
          </button>
        ))}
      </div>

      {method === 'google' && <GoogleSignIn onSignedIn={handleSignedIn} onError={setErr} />}
      {method === 'phone' && <PhoneSignIn onSignedIn={handleSignedIn} onError={setErr} />}
      {method === 'email' && <EmailSignIn onSignedIn={handleSignedIn} onError={setErr} />}

      {err && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 14, textAlign: 'center' }}>{err}</p>}

      <p style={{ fontSize: 11, color: 'var(--txt4)', textAlign: 'center', marginTop: 16, lineHeight: 1.6 }}>
        Free to sign in — no payment needed. Plans are available anytime from the footer.
      </p>
    </Modal>
  );
}
