'use client';
import React, { useState } from 'react';
import { Modal, Btn } from '@/components/ui/index';
import { Icon } from '@/components/ui/Icon';
import { motion } from '@/components/ui/motion';
import { GoogleSignIn } from '@/components/account/GoogleSignIn';
import { logout, buyPlan, PLANS, type Plan, type UsageStatus } from '@/lib/api';

interface Props {
  usage: UsageStatus | null;
  paywall?: boolean;
  onClose: () => void;
  onChange: (u: UsageStatus) => void;
}

// Plan picker — clean selectable cards + a continue button
const PLAN_TAG: Record<string, string> = {
  day: 'Just trying it out', week: 'Short-term peace of mind',
  month: 'Most popular', yearly: 'Best value · save vs monthly',
};
function PlanPicker({ plans, busy, onBuy }: { plans: Plan[]; busy: boolean; onBuy: (id: string) => void }) {
  const [sel, setSel] = useState('month'); // Monthly is the default highlight
  const selected = plans.find(p => p.id === sel) || plans[0];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginBottom: 18, justifyItems: 'stretch', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
        {plans.map(p => {
          const active = p.id === sel;
          const featured = p.id === 'month';
          return (
            <motion.button key={p.id} onClick={() => setSel(p.id)}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }} transition={{ type: 'spring', stiffness: 360, damping: 24 }}
              style={{
                position: 'relative', cursor: 'pointer', padding: featured ? '32px 14px 18px' : '22px 14px 18px',
                borderRadius: 18, overflow: 'hidden', minHeight: 138,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 4,
                background: active ? 'var(--ok-bg)' : 'var(--surf2)',
                border: `1.5px solid ${active ? 'var(--ok)' : 'var(--bd2)'}`,
                boxShadow: active ? '0 8px 26px var(--ok-glow)' : 'none',
                transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s',
              }}>
              {featured && (
                <span style={{ position: 'absolute', top: 0, left: 0, right: 0, fontSize: 8.5, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 0', background: 'var(--ok)', color: '#fff' }}>Most Popular</span>
              )}
              <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--ok)' : 'var(--txt2)', marginBottom: 8 }}>{p.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: '1.95rem', lineHeight: 1, color: 'var(--txt)' }}>₹{p.price}</span>
                <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>/{p.id === 'day' ? 'day' : p.id === 'week' ? 'wk' : p.id === 'month' ? 'mo' : 'yr'}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--txt4)', marginTop: 8 }}>{PLAN_TAG[p.id] || p.period}</div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, marginBottom: 16 }}>
        {['Unlimited report checks', 'Premium AI accuracy on every report', 'Unlimited AskFit answers'].map(f => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--txt2)' }}>
            <Icon name="check_circle" size={14} color="var(--ok)" /> {f}
          </div>
        ))}
      </div>

      <Btn variant="primary" loading={busy} onClick={() => onBuy(selected.id)} icon="zap" style={{ width: '100%', justifyContent: 'center' }}>
        Continue with {selected.label} — ₹{selected.price}
      </Btn>
    </div>
  );
}

export function AccountModal({ usage, paywall, onClose, onChange }: Props) {
  const loggedIn = !!usage?.email;
  const isPaid = !!usage?.is_paid;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const plans = usage?.plans?.length ? usage.plans : PLANS;

  const [needSignin, setNeedSignin] = useState(false);

  const handleBuy = async (planId: string) => {
    // Anyone can browse plans; signing in is only required to actually pay.
    if (!loggedIn) { setNeedSignin(true); setErr(''); return; }
    setBusy(true); setErr('');
    try { onChange(await buyPlan(planId)); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const title = isPaid ? 'Your account' : 'Plans & pricing';

  return (
    <Modal title={title} onClose={onClose} width={isPaid ? 460 : 580}>
      <div style={{ width: '100%', maxWidth: 540, margin: '0 auto' }}>
        {/* PAID */}
        {isPaid && (
          <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--ok-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
              <Icon name="check_circle" size={28} color="var(--ok)" />
            </div>
            <h3 style={{ fontWeight: 700, fontSize: 16 }}>Pass active — unlimited checks</h3>
            <p style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 6 }}>
              Signed in as <strong>{usage?.email}</strong>. Reports are read with premium accuracy.
            </p>
            <Btn variant="ghost" onClick={() => { logout(); onChange({ ...(usage as UsageStatus), email: null, is_paid: false }); }} style={{ marginTop: 16 }}>Log out</Btn>
          </div>
        )}

        {/* NOT PAID → plans visible to everyone; sign-in only needed to pay */}
        {!isPaid && (
          <div>
            <p style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.6, marginBottom: 16 }}>
              {paywall
                ? <>You’ve used your <strong>{usage?.free_limit}</strong> free checks. Pick a plan to keep going with unlimited, premium-accuracy reports.</>
                : 'Unlimited reports with premium accuracy. Browse the plans below — sign in when you’re ready to pay.'}
            </p>

            <PlanPicker plans={plans} busy={busy} onBuy={handleBuy} />

            {/* Sign in / create account — always available (independent of payment).
                Highlighted when a plan was just clicked (payment needs sign-in). */}
            {!loggedIn && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
                <div style={{ textAlign: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: needSignin ? 'var(--askfit)' : 'var(--txt)', marginBottom: 4 }}>
                    {needSignin ? 'Almost there — sign in to complete your purchase' : 'Sign in or create your free account'}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--txt3)', lineHeight: 1.6 }}>
                    Save your history and reports across devices — no purchase needed.
                  </p>
                </div>
                <GoogleSignIn onSignedIn={onChange} onError={setErr} />
                <p style={{ fontSize: 11, color: 'var(--txt4)', textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>
                  Just your email keeps your account safe — simple and secure.
                </p>
              </div>
            )}

            {loggedIn && (
              <>
                <p style={{ fontSize: 11, color: 'var(--txt4)', textAlign: 'center', marginTop: 10 }}>
                  Secure payment via Razorpay. Signed in as {usage?.email}.
                </p>
                <Btn variant="ghost" size="sm" onClick={() => { logout(); onChange({ ...(usage as UsageStatus), email: null }); }} style={{ marginTop: 8 }}>Log out</Btn>
              </>
            )}
          </div>
        )}

        {err && <p style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12, textAlign: 'center' }}>{err}</p>}
      </div>
    </Modal>
  );
}
