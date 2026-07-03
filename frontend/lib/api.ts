// FeelFit — API Layer
// All AI features are served by the FastAPI backend (Groq + RAG). The frontend
// never calls an LLM provider directly, so no API key is ever exposed client-side.
//
// In the Capacitor build, the auth token + local history are stored via the
// native Preferences plugin (Keychain / Keystore) through lib/native.ts. On
// the web build we fall back to localStorage.

import type {
  AnalyzeResponse, AnalysisProfile, DashboardData, DoctorResult,
  InteractionResult, MedicineInfo, UserProfile, ReportSummary
} from '@/types';
import { secureGet, secureSet, secureRemove, isCapacitor } from '@/lib/native';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Accounts / freemium ─────────────────────────────────────────────────────────

const TOKEN_KEY = 'feelfit_token';

// Cache the token in memory after first read so we don't await Preferences on
// every fetch. The setter keeps both the cache and the persistent store in sync.
let _cachedToken: string | null = null;
let _tokenLoaded = false;

export function getToken(): string {
  // Sync API for web (localStorage). For Capacitor we use the cached value
  // (loaded asynchronously by loadToken()) so existing call sites keep working.
  if (!_tokenLoaded) {
    try {
      _cachedToken = localStorage.getItem(TOKEN_KEY) || '';
    } catch { _cachedToken = ''; }
    _tokenLoaded = true;
    // On Capacitor, kick off an async load to refresh the cache from native
    // secure storage on the next tick — preserves cross-launch persistence.
    if (isCapacitor()) {
      secureGet(TOKEN_KEY).then(v => { _cachedToken = v || ''; });
    }
  }
  return _cachedToken || '';
}

/** Async-safe loader — called once on app boot when running inside Capacitor. */
export async function loadToken(): Promise<void> {
  if (!isCapacitor()) { _tokenLoaded = true; return; }
  _cachedToken = await secureGet(TOKEN_KEY);
  _tokenLoaded = true;
  // Mirror to localStorage so any code path that reads it directly still works.
  if (_cachedToken) { try { localStorage.setItem(TOKEN_KEY, _cachedToken); } catch {} }
}

export function setToken(t: string | null) {
  _cachedToken = t || '';
  _tokenLoaded = true;
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch {}
  if (isCapacitor()) {
    // Fire-and-forget the native secure write so this stays sync-compatible.
    if (t) secureSet(TOKEN_KEY, t); else secureRemove(TOKEN_KEY);
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const t = getToken();
  return t ? { ...extra, 'x-auth-token': t } : extra;
}

export interface Plan {
  id: string; label: string; price: number; seconds: number; period: string;
}

export interface UsageStatus {
  email: string | null; free_used: number; free_limit: number;
  remaining_free: number; is_paid: boolean; pass_expires: number | null; price_inr: number;
  plans?: Plan[];
}

// Front-end fallback plan ladder (kept in sync with backend account_service.PLANS).
export const PLANS: Plan[] = [
  { id: 'day',    label: 'Day Pass', price: 19,   seconds: 86400,    period: 'for 24 hours' },
  { id: 'week',   label: 'Weekly',   price: 89,   seconds: 604800,   period: 'per week' },
  { id: 'month',  label: 'Monthly',  price: 349,  seconds: 2592000,  period: 'per month' },
  { id: 'yearly', label: 'Yearly',   price: 1999, seconds: 31536000, period: 'per year' },
];

export async function getUsage(): Promise<UsageStatus> {
  const r = await fetch(`${API_BASE}/api/usage`, { headers: authHeaders() });
  return await r.json();
}

export interface SignupExtras { name?: string; age?: number; gender?: string; }

/** Step 1 of email signup — sends a 6-digit code to prove the person actually
 * controls that inbox. `dev_code` is only ever present in local dev when SMTP
 * isn't configured, never in production. */
export async function sendSignupOtp(email: string): Promise<{ ok: boolean; dev_code?: string }> {
  const r = await fetch(`${API_BASE}/api/auth/signup/send-otp`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Could not send the verification code');
  return d;
}

/** Step 2 — completes signup once the emailed code is entered. */
export async function signup(email: string, password: string, code: string, extras?: SignupExtras): Promise<{ token: string; email: string; status: UsageStatus; is_new_account: boolean }> {
  const r = await fetch(`${API_BASE}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, code, ...extras }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Sign up failed');
  setToken(d.token);
  return d;
}

export async function login(email: string, password: string): Promise<{ token: string; email: string; status: UsageStatus; is_new_account: boolean }> {
  const r = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Login failed');
  setToken(d.token);
  return d;
}

export async function googleSignIn(credential: string): Promise<{ token: string; email: string; status: UsageStatus; is_new_account: boolean }> {
  const r = await fetch(`${API_BASE}/api/auth/google`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Google sign-in failed');
  setToken(d.token);
  return d;
}

export async function phoneSignIn(idToken: string): Promise<{ token: string; email: string; status: UsageStatus; is_new_account: boolean }> {
  const r = await fetch(`${API_BASE}/api/auth/phone`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id_token: idToken }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Phone sign-in failed');
  setToken(d.token);
  return d;
}

export function logout() { setToken(null); }

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

async function confirmPayment(plan: string, order_id: string, extra: Record<string, string> = {}): Promise<UsageStatus> {
  const cf = await fetch(`${API_BASE}/api/billing/confirm`, {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ order_id, plan, ...extra }),
  });
  const d = await cf.json();
  if (!cf.ok) throw new Error(d.error || 'Payment confirmation failed');
  return d.status;
}

/**
 * Purchase a plan (day/week/month/yearly).
 * - Test mode (no Razorpay keys): confirms instantly, no charge.
 * - Live mode: opens the real Razorpay payment sheet, then confirms with a verified signature.
 */
export async function buyPlan(plan: string = 'day'): Promise<UsageStatus> {
  const co = await fetch(`${API_BASE}/api/billing/checkout`, {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ plan }),
  });
  const order = await co.json();
  if (!co.ok) throw new Error(order.error || 'Checkout failed');

  // Live Razorpay: open the hosted payment sheet and resolve on success.
  if (order.mode === 'razorpay') {
    const ok = await loadRazorpay();
    if (!ok) {
      // ── Capacitor fallback: if the Razorpay script can't load (rare, but
      // happens on poor connections or if Razorpay blocks the WebView origin),
      // open the backend's hosted checkout page in the in-app browser. The
      // backend polls for payment success and redirects back to the app.
      if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
        const { openExternal } = await import('@/lib/native');
        const checkoutUrl = `${API_BASE}/api/billing/hosted?order_id=${encodeURIComponent(order.order_id)}&plan=${encodeURIComponent(order.plan || plan)}`;
        await openExternal(checkoutUrl);
        // We can't observe the in-app browser's lifecycle from JS — return the
        // current usage; the caller can refresh after the user returns to the app.
        return getUsage();
      }
      throw new Error('Could not load the payment gateway. Please try again.');
    }
    return new Promise<UsageStatus>((resolve, reject) => {
      const rzp = new (window as unknown as { Razorpay: any }).Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'FeelFit',
        description: `${order.plan_label || 'FeelFit'} plan`,
        order_id: order.order_id,
        theme: { color: '#111111' },
        handler: async (resp: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            resolve(await confirmPayment(order.plan || plan, order.order_id, {
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            }));
          } catch (e) { reject(e); }
        },
        modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
      });
      rzp.open();
    });
  }

  // Test mode: confirm immediately (no real charge).
  return confirmPayment(order.plan || plan, order.order_id);
}

/** @deprecated use buyPlan('day') */
export const buyDayPass = () => buyPlan('day');

// ── Health graph / Focus / Today (the AskFit loop) ─────────────────────────────

export interface HealthFocus {
  canonical: string; label: string; condition: string;
  current_value?: number | null; unit?: string | null; status?: string | null;
  target: string; why: string; plan: string[];
  retest_weeks: number; start_date: string; retest_date: string; other_flags?: string[];
}
export interface TodayCard {
  focus: HealthFocus | null;
  action: { title: string; text: string };
  retest: { days_left: number | null; state: string };
  streak: number;
  checked_in_today: boolean;
  biomarker_count: number;
}

export async function getToday(): Promise<TodayCard> {
  const r = await fetch(`${API_BASE}/api/health/today`, { headers: authHeaders() });
  return await r.json();
}
export async function getHealthGraph(): Promise<any> {
  const r = await fetch(`${API_BASE}/api/health/graph`, { headers: authHeaders() });
  return await r.json();
}
export async function getProgram(): Promise<any> {
  const r = await fetch(`${API_BASE}/api/health/program`, { headers: authHeaders() });
  return await r.json();
}
export async function logVital(type: string, value: number, unit?: string): Promise<any> {
  const r = await fetch(`${API_BASE}/api/health/vitals`, {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ type, value, unit }),
  });
  if (!r.ok) throw new Error('Could not save that reading');
  return await r.json();
}
export async function checkinToday(action?: string): Promise<{ streak: number }> {
  const r = await fetch(`${API_BASE}/api/health/checkin`, {
    method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ action }),
  });
  return await r.json();
}

// ── Lab Analysis ──────────────────────────────────────────────────────────────

export async function analyzeReport(
  file: File,
  profile: AnalysisProfile,
  sessionId?: string
): Promise<AnalyzeResponse> {
  const fd = new FormData();
  fd.append('file', file);
  if (profile.age)         fd.append('age', profile.age);
  if (profile.gender)      fd.append('gender', profile.gender);
  if (profile.conditions)  fd.append('known_conditions', profile.conditions);
  if (profile.medications) fd.append('current_medications', profile.medications);

  const headers = authHeaders(sessionId ? { 'X-Session-Id': sessionId } : {});

  const r = await fetch(`${API_BASE}/api/analyze`, { method: 'POST', body: fd, headers, signal: AbortSignal.timeout(120000) });
  if (!r.ok) {
    const detail = await r.json().catch(() => null);
    const msg = detail?.message || detail?.error || `Analysis failed (${r.status}). Is the backend running?`;
    const e = new Error(msg);
    (e as Error & { code?: number }).code = r.status;  // 402 upgrade · 422 unreadable
    (e as Error & { detail?: any }).detail = detail;
    throw e;
  }
  return await r.json();
}

// ── Medicine ──────────────────────────────────────────────────────────────────

// Fetch can reject before a response ever exists (backend not running, wrong
// port, DNS failure) — the browser gives us a bare "Failed to fetch" / "Load
// failed" TypeError with no detail. We turn that into a message that actually
// tells you what to check, instead of leaving the raw browser error on screen.
async function fetchOrExplain(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('That took too long to respond. Please try again.');
    }
    throw new Error(`Can't reach the FeelFit backend at ${API_BASE}. Make sure it's running (see backend/README.md — "python main.py" or "uvicorn main:app"), then try again.`);
  }
}

export async function getMedicineInfo(name: string, conditions?: string[]): Promise<MedicineInfo> {
  const r = await fetchOrExplain(`${API_BASE}/api/medicine/info`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicine_name: name, user_conditions: conditions }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Medicine lookup failed (${r.status}). Is the backend running?`);
  return await r.json();
}

export async function checkInteractions(medicines: string[]): Promise<InteractionResult> {
  const r = await fetchOrExplain(`${API_BASE}/api/medicine/interactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ medicines }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Interaction check failed (${r.status}). Is the backend running?`);
  return await r.json();
}

// ── Doctors ───────────────────────────────────────────────────────────────────

export async function searchDoctorsByLocation(
  location: string,
  specialization?: string,
  userLat?: number,
  userLng?: number,
  radiusKm?: number,
): Promise<{ doctors: DoctorResult[]; insights: object | null; total: number; tier?: 'premium' | 'free'; source?: string }> {
  const r = await fetch(`${API_BASE}/api/doctors/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location,
      specialization: specialization || '',
      user_lat: userLat,
      user_lng: userLng,
      radius_km: radiusKm || 5,
      max_results: 20,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`Doctor search failed: ${r.status}`);
  const data = await r.json();
  return { doctors: data.doctors || [], insights: data.insights || null, total: data.total || 0, tier: data.tier as ('premium' | 'free' | undefined), source: data.source as (string | undefined) };
}

// ── Medical RAG 2.0 — AskFit ──────────────────────────────────────────

import type { RagBundle } from '@/types';

/** Attach a document (report/prescription/note) to AskFit — returns its text. */
export async function attachDocument(file: File): Promise<{ filename: string; text: string; chars: number }> {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch(`${API_BASE}/api/askfit/attach`, { method: 'POST', body: fd, headers: authHeaders(), signal: AbortSignal.timeout(120000) });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(d?.error || d?.message || 'Could not read that document.');
  return d;
}

export async function ragRetrieve(
  query: string,
  ctx?: { age?: string; gender?: string; conditions?: string[]; medications?: string[]; topK?: number; history?: { role: string; text: string }[]; attachment?: string },
): Promise<RagBundle> {
  const r = await fetch(`${API_BASE}/api/rag/retrieve`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      query,
      top_k: ctx?.topK ?? 4,
      age: ctx?.age ? Number(ctx.age) : undefined,
      gender: ctx?.gender || undefined,
      conditions: ctx?.conditions,
      medications: ctx?.medications,
      history: ctx?.history,
      attachment: ctx?.attachment,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`RAG retrieve failed: ${r.status}`);
  return await r.json();
}

// ── Profile / Dashboard ───────────────────────────────────────────────────────

export async function getDashboard(sessionId: string): Promise<DashboardData | null> {
  try {
    const r = await fetch(`${API_BASE}/api/profile/dashboard`, {
      headers: authHeaders({ 'X-Session-Id': sessionId }), signal: AbortSignal.timeout(10000),
    });
    if (r.ok) return await r.json();
  } catch (_) {}
  return null;
}

export async function saveProfile(sessionId: string, data: Partial<UserProfile>): Promise<boolean> {
  try {
    const r = await fetch(`${API_BASE}/api/profile`, {
      method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json', 'X-Session-Id': sessionId }),
      body: JSON.stringify(data),
    });
    return r.ok;
  } catch (_) { return false; }
}

// ── Local History (with retention) ──────────────────────────────────────────────

const HISTORY_KEY = 'feelfit_history_v8';
const RETENTION_KEY = 'feelfit_retention_days';

/** How long report history is kept before auto-deleting. Default: 7 days. */
export function getRetentionDays(): number {
  try { return parseInt(localStorage.getItem(RETENTION_KEY) || '7', 10) || 7; } catch { return 7; }
}
export function setRetentionDays(days: number): void {
  try { localStorage.setItem(RETENTION_KEY, String(days)); } catch (_) {}
}

function pruneExpired(list: ReportSummary[]): ReportSummary[] {
  const days = getRetentionDays();
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return list.filter(h => {
    const t = h.timestamp ? new Date(h.timestamp).getTime() : Date.now();
    return isNaN(t) || t >= cutoff;
  });
}

export function getLocalHistory(): ReportSummary[] {
  try {
    const raw: ReportSummary[] = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const kept = pruneExpired(raw);
    if (kept.length !== raw.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(kept));
    return kept;
  } catch { return []; }
}

export function saveToHistory(entry: ReportSummary): void {
  try {
    const h = getLocalHistory();
    h.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 30)));
  } catch (_) {}
}

/** Delete a single report from history by job_id. Returns the remaining list. */
export function deleteHistoryItem(jobId: string): ReportSummary[] {
  try {
    const kept = getLocalHistory().filter(h => h.job_id !== jobId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(kept));
    return kept;
  } catch { return getLocalHistory(); }
}

/** Full erase: clears local history and wipes the server-side health graph. */
export async function eraseAllHistory(): Promise<void> {
  try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
  try { await fetch(`${API_BASE}/api/health/data`, { method: 'DELETE', headers: authHeaders() }); } catch (_) {}
}

export function clearHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch (_) {}
}

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const key = 'ff_session_v8';
  let s = localStorage.getItem(key);
  if (!s) { s = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(key, s); }
  return s;
}
