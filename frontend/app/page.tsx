'use client';
import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { NetworkStatus } from '@/components/layout/NetworkStatus';
import { HomePage } from '@/components/home/HomePage';
import { UploadPanel } from '@/components/analyze/UploadPanel';
import { AnalyzingState } from '@/components/analyze/AnalyzingState';
import { Results } from '@/components/analyze/Results';
import { Modal, Toast } from '@/components/ui/index';
import { motion, AnimatePresence, PageTransition } from '@/components/ui/motion';
import { Icon } from '@/components/ui/Icon';
import { BrandMark } from '@/components/ui/BrandMark';
import { AccountModal } from '@/components/account/AccountModal';
import { SignInModal } from '@/components/account/SignInModal';
import { BottomNav } from '@/components/layout/BottomNav';
import { BootSplash } from '@/components/ui/BootSplash';
import { usePullToRefresh } from '@/components/hooks/usePullToRefresh';
import { useNativeBridge } from '@/components/hooks/useNativeBridge';
import { isCapacitor, haptic, attachKeyboardDismisser, setStatusBarTheme } from '@/lib/native';
import { analyzeReport, getLocalHistory, saveToHistory, getSessionId, getUsage, deleteHistoryItem, eraseAllHistory, getRetentionDays, setRetentionDays, type UsageStatus } from '@/lib/api';
import { RISK_CFG } from '@/lib/constants';
import type { Tab, AnalyzeState, AnalyzeResponse, AnalysisProfile, ReportSummary } from '@/types';

// ── Lazy-loaded tab content ─────────────────────────────────────────────────
// Splitting the heavy tab bodies into separate chunks cuts the initial bundle
// from ~230 kB → ~140 kB First Load JS, and lets each tab's code download on
// first visit (or be pre-fetched during idle time). The <Suspense> fallback is
// a branded skeleton so the user never sees a blank frame.
const MedicineTab   = lazy(() => import('@/components/medicine/MedicineTab').then(m => ({ default: m.MedicineTab })));
const DoctorSection = lazy(() => import('@/components/doctors/DoctorSection').then(m => ({ default: m.DoctorSection })));
const SymptomChecker = lazy(() => import('@/components/symptoms/SymptomChecker').then(m => ({ default: m.SymptomChecker })));
const HealthTools   = lazy(() => import('@/components/tools/HealthTools').then(m => ({ default: m.HealthTools })));
const DashboardTab  = lazy(() => import('@/components/dashboard/DashboardTab').then(m => ({ default: m.DashboardTab })));
const AskFit        = lazy(() => import('@/components/copilot/AskFit').then(m => ({ default: m.AskFit })));
const AboutPage     = lazy(() => import('@/components/about/AboutPage').then(m => ({ default: m.AboutPage })));

// Lightweight skeleton used as the Suspense fallback for every lazy tab.
function TabSkeleton() {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '1rem' }} aria-busy="true" aria-live="polite">
      <div style={{ height: 28, width: '40%', borderRadius: 8, background: 'var(--surf2)', marginBottom: 16, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 180, borderRadius: 'var(--rl)', background: 'var(--surf)', marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 120, borderRadius: 'var(--rl)', background: 'var(--surf)', marginBottom: 12, animation: 'pulse 1.5s ease-in-out 0.15s infinite' }} />
      <div style={{ height: 90, borderRadius: 'var(--rl)', background: 'var(--surf)', animation: 'pulse 1.5s ease-in-out 0.3s infinite' }} />
    </div>
  );
}

function HistoryPanel() {
  const [history, setHistory] = useState<ReportSummary[]>([]);
  const [retention, setRetention] = useState(7);
  const [confirmErase, setConfirmErase] = useState(false);
  useEffect(() => { setHistory(getLocalHistory()); setRetention(getRetentionDays()); }, []);

  const changeRetention = (days: number) => { setRetentionDays(days); setRetention(days); setHistory(getLocalHistory()); };
  const removeOne = (jobId: string) => setHistory(deleteHistoryItem(jobId));
  const eraseAll = async () => { await eraseAllHistory(); setHistory([]); setConfirmErase(false); };

  return (
    <div>
      {/* Retention controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--bd)' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Auto-delete after</div>
          <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surf2)', border: '1px solid var(--bd)' }}>
            {[[7, '7 days'], [30, '1 month']].map(([d, label]) => (
              <button key={d as number} onClick={() => changeRetention(d as number)}
                style={{ padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: retention === d ? 'var(--accent)' : 'transparent', color: retention === d ? 'var(--bg1)' : 'var(--txt3)' }}>
                {label as string}
              </button>
            ))}
          </div>
        </div>
        {history.length > 0 && (
          confirmErase ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--txt3)' }}>Erase everything?</span>
              <button onClick={eraseAll} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--danger)', color: '#fff', border: 'none' }}>Yes, erase</button>
              <button onClick={() => setConfirmErase(false)} style={{ padding: '7px 13px', borderRadius: 999, fontSize: 12, cursor: 'pointer', background: 'var(--surf2)', color: 'var(--txt2)', border: '1px solid var(--bd)' }}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmErase(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--danger-bg)', border: '1px solid var(--danger-bd)', color: 'var(--danger)' }}>
              <Icon name="close" size={12} color="var(--danger)" /> Erase all
            </button>
          )
        )}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--txt4)', marginBottom: 14, lineHeight: 1.55 }}>
        Reports are kept on this device and auto-delete after {retention === 7 ? '7 days' : '1 month'}. Your long-term progress trends are kept until you choose “Erase all”.
      </p>

      {!history.length ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--txt3)' }}>
          <Icon name="history" size={36} color="var(--bd2)" />
          <p style={{ marginTop: 12, fontSize: 14 }}>No saved reports right now.</p>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {history.map((h, i) => {
        const risk = RISK_CFG[h.risk_level as keyof typeof RISK_CFG] ?? RISK_CFG.moderate;
        return (
          <div key={h.job_id || i} style={{ padding: '12px 14px', background: 'var(--surf2)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 3 }}>{h.report_type}</div>
                <div style={{ fontSize: 12, color: 'var(--txt3)' }}>
                  {h.timestamp ? new Date(h.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  {h.total_tests > 0 && <span style={{ marginLeft: 8 }}>· {h.total_tests} tests</span>}
                </div>
                {h.summary_preview && <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 4, lineHeight: 1.6 }}>{h.summary_preview}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ padding: '3px 9px', borderRadius: 100, background: risk.bg, border: `1px solid ${risk.color}40`, fontSize: 10, fontWeight: 700, color: risk.color, fontFamily: 'var(--fm)' }}>
                  {h.risk_level?.toUpperCase()}
                </span>
                <button onClick={() => removeOne(h.job_id)} title="Delete this report"
                  style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'transparent', border: '1px solid var(--bd)', color: 'var(--txt4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--danger-bd)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--txt4)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--bd)'; }}>
                  <Icon name="close" size={13} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
      </div>
      )}
    </div>
  );
}

function BgDecor() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '100vh', pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-25%', left: '-12%', width: '65%', height: '65%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.06) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', bottom: '-22%', right: '-12%', width: '55%', height: '55%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.045) 0%, transparent 70%)' }} />
      <div style={{ position: 'absolute', top: '45%', left: '38%', width: '28%', height: '28%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.025) 0%, transparent 70%)' }} />
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [analyzeState, setAnalyzeState] = useState<AnalyzeState>('upload');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [profile, setProfile] = useState<AnalysisProfile>({ age: '', gender: '', conditions: '', medications: '' });
  const [localHistory, setLocalHistory] = useState<ReportSummary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [sessionId, setSessionId] = useState('ssr');
  const [mounted, setMounted] = useState(false);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [showAccount, setShowAccount] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [aboutAnchor, setAboutAnchor] = useState<string | undefined>(undefined);

  const goAbout = useCallback((anchor?: string) => { setAboutAnchor(anchor); setTab('about'); }, []);

  // ── Capacitor bootstrapping: status bar, safe-area, back button, app resume ──
  const { ready: nativeReady } = useNativeBridge({
    onBack: () => {
      // Hardware back (Android): if a modal is open, close it; otherwise go Home; otherwise exit.
      if (showAccount) { setShowAccount(false); return; }
      if (showSignIn) { setShowSignIn(false); return; }
      if (showHistory) { setShowHistory(false); return; }
      if (tab !== 'home') { setTab('home'); return; }
      // On Home with nothing open — defer to the OS to background the app.
      import('@capacitor/app').then(({ App }) => App.exitApp()).catch(() => {});
    },
    onResume: () => {
      // Refresh usage + history when the user returns to the app.
      getUsage().then(setUsage).catch(() => {});
      setLocalHistory(getLocalHistory());
    },
  });

  useEffect(() => {
    setMounted(true);
    setSessionId(getSessionId());
    setLocalHistory(getLocalHistory());
    getUsage().then(setUsage).catch(() => {});
  }, []);

  // Keep the raw <html>/<body> canvas in sync with the theme. The theme
  // wrapper is a div, so without this any region outside it (horizontal
  // overflow bands on phone browsers, overscroll glow) shows the :root
  // dark palette — a black band next to a light app.
  useEffect(() => {
    const bg = dark ? '#0a0a0a' : '#f4f4f6';
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
  }, [dark]);

  // ── Mobile-only UX wires: tap-to-dismiss-keyboard + status-bar theme sync ──
  useEffect(() => {
    if (!isCapacitor()) return;
    const detachKeyboard = attachKeyboardDismisser();
    // Keep the native status bar in sync with the in-app theme toggle.
    setStatusBarTheme(dark);
    return () => { detachKeyboard(); };
  }, [dark]);

  // Always start a freshly-opened tab from the top.
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [tab, analyzeState]);

  // ── Browser history: make each tab a real history entry so the browser's
  // back/forward buttons and swipe-back gestures navigate between pages. ──────────
  const isPopNav = useRef(false);
  const firstHistorySync = useRef(true);
  const VALID_TABS: Tab[] = ['home', 'analyze', 'medicine', 'doctors', 'symptoms', 'tools', 'dashboard', 'askfit', 'about'];

  useEffect(() => {
    // Hydrate the tab from the URL hash on first load (e.g. a shared #doctors link).
    const h = (window.location.hash || '').replace('#', '');
    if (VALID_TABS.includes(h as Tab) && h !== 'home') setTab(h as Tab);

    const onPop = () => {
      const hh = (window.location.hash || '').replace('#', '');
      isPopNav.current = true;
      setTab((VALID_TABS.includes(hh as Tab) ? hh : 'home') as Tab);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (isPopNav.current) { isPopNav.current = false; return; }   // came from back/forward → don't re-push
    const url = tab === 'home' ? window.location.pathname + window.location.search : `#${tab}`;
    if (firstHistorySync.current) { firstHistorySync.current = false; window.history.replaceState({ tab }, '', url); }
    else if (window.location.hash !== (tab === 'home' ? '' : `#${tab}`)) {
      window.history.pushState({ tab }, '', url);
    }
  }, [tab]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === 'u') { e.preventDefault(); setTab('analyze'); setAnalyzeState('upload'); }
        if (e.key === 'm') { e.preventDefault(); setTab('medicine'); }
        if (e.key === 'd') { e.preventDefault(); setTab('dashboard'); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleFile = useCallback(async (f: File) => {
    const validTypes = ['application/pdf','image/jpeg','image/jpg','image/png','image/tiff','image/webp','text/csv','application/vnd.ms-excel'];
    const isCSV = f.name.toLowerCase().endsWith('.csv');
    if (!validTypes.includes(f.type) && !isCSV) { setError('Please upload PDF, JPEG, PNG, or CSV.'); return; }
    if (f.size > 15 * 1024 * 1024) { setError('File too large — max 15 MB.'); return; }
    setCurrentFile(f); setAnalyzeState('analyzing'); setError(null); setResult(null);
    try {
      const res = await analyzeReport(f, profile, sessionId);
      if (res.analysis) {
        const entry: ReportSummary = {
          job_id: res.job_id, report_type: res.analysis.report_type,
          risk_level: res.analysis.risk_level, confidence: res.analysis.confidence,
          timestamp: new Date().toISOString(),
          summary_preview: (res.analysis.summary || '').slice(0, 90) + '...',
          key_findings: (res.analysis.key_findings || []).slice(0, 3),
          abnormal_count: (res.analysis.abnormal_tests || []).length,
          total_tests: res.total_tests_found, loinc_matched: res.loinc_matched,
        };
        saveToHistory(entry); setLocalHistory(getLocalHistory());
        setToast({ msg: 'Report analyzed successfully!', type: 'success' });
      }
      const u = (res as AnalyzeResponse & { usage?: UsageStatus }).usage;
      if (u) setUsage(u);
      setResult(res); setAnalyzeState('results');
    } catch (err) {
      const code = (err as Error & { code?: number }).code;
      if (code === 402) {
        // Free limit reached → open the upgrade/login paywall
        getUsage().then(setUsage).catch(() => {});
        setPaywall(true); setShowAccount(true); setError(null);
      } else if (code === 422) {
        // Couldn't read the report — show the helpful message verbatim, no scary prefix.
        setError((err as Error).message);
      } else {
        setError(`Analysis failed: ${(err as Error).message}`);
      }
      setAnalyzeState('upload');
    }
  }, [profile, sessionId]);

  const resetAnalyze = useCallback(() => {
    setCurrentFile(null); setResult(null); setError(null); setAnalyzeState('upload');
    haptic('light');
  }, []);

  // ── Pull-to-refresh: refresh the current tab's live data ──────────────────
  const ptr = usePullToRefresh(async () => {
    haptic('success');
    setLocalHistory(getLocalHistory());
    await getUsage().then(setUsage).catch(() => {});
    setToast({ msg: 'Up to date', type: 'info' });
    setTimeout(() => setToast(null), 1400);
  });

  if (!mounted) return null;

  return (
    <div className={dark ? '' : 'light'} style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--txt)' }}>
      {/* Animated opening (Capacitor only, ~2s once per cold start) */}
      <BootSplash />
      <BgDecor />
      {/* Pull-to-refresh spinner — only visible on Capacitor / touch devices */}
      {(ptr.pulling || ptr.refreshing) && (
        <div className={`ff-ptr-indicator${ptr.pulling ? ' visible' : ''}${ptr.refreshing ? ' spinning visible' : ''}`}>
          <Icon name="loader" size={18} color="var(--txt2)" />
        </div>
      )}
      <Navbar
        tab={tab} setTab={setTab} dark={dark} setDark={setDark} historyCount={localHistory.length} onLogoClick={resetAnalyze}
        accountActive={!!usage?.is_paid}
        loggedIn={!!usage?.email}
        accountLabel={usage?.is_paid ? 'Unlimited' : usage?.email ? `${usage.remaining_free} free` : usage ? `${usage.remaining_free} free · Sign in` : 'Sign in'}
        onAccountClick={() => setShowSignIn(true)}
        onPlansClick={() => { setPaywall(false); setShowAccount(true); }}
      />

      {error && (
        <div style={{ padding: '10px 2rem', background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-bd)', color: 'var(--danger)', display: 'flex', gap: 9, alignItems: 'center', fontSize: 13.5, zIndex: 50, position: 'relative' }}>
          <Icon name="alert" size={14} />
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', color: 'inherit', fontSize: 18, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      <main style={{ padding: 'clamp(1.5rem, 3vw, 3rem) clamp(1rem, 3vw, 2rem)', position: 'relative', zIndex: 1, minHeight: 'calc(100vh - 60px)' }}>
        <PageTransition keyId={tab === 'analyze' ? `analyze-${analyzeState}` : tab}>
          {tab === 'home'      && <HomePage onGetStarted={() => setTab('analyze')} onNavigate={(t) => setTab(t as Tab)} />}
          {tab === 'analyze'   && (
            <>
              {analyzeState === 'upload'    && <UploadPanel onFile={handleFile} profile={profile} setProfile={setProfile} history={localHistory} onShowHistory={() => setShowHistory(true)} />}
              {analyzeState === 'analyzing' && <AnalyzingState fileName={currentFile?.name || 'report'} />}
              {analyzeState === 'results'   && result && (
                <>
                  <Results result={result} onReset={resetAnalyze} profile={profile} onUpgrade={() => { setPaywall(true); setShowAccount(true); }} />
                  {(result.doctors?.length || result.analysis?.required_specialization) && (
                    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                      <DoctorSection doctors={result.doctors} specialization={result.analysis?.required_specialization} />
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {tab === 'medicine'  && (
            <Suspense fallback={<TabSkeleton />}>
              <MedicineTab />
            </Suspense>
          )}
          {tab === 'askfit'    && (
            <Suspense fallback={<TabSkeleton />}>
              <AskFit isPaid={!!usage?.is_paid} onUpgrade={() => { setPaywall(true); setShowAccount(true); }} />
            </Suspense>
          )}
          {tab === 'doctors'   && (
            <Suspense fallback={<TabSkeleton />}>
              <DoctorSection />
            </Suspense>
          )}
          {tab === 'symptoms'  && (
            <Suspense fallback={<TabSkeleton />}>
              <SymptomChecker onAnalyzeReport={() => setTab('analyze')} onFindDoctor={() => setTab('doctors')} onAskQuestion={() => setTab('askfit')} />
            </Suspense>
          )}
          {tab === 'tools'     && (
            <Suspense fallback={<TabSkeleton />}>
              <HealthTools />
            </Suspense>
          )}
          {tab === 'dashboard' && (
            <Suspense fallback={<TabSkeleton />}>
              <DashboardTab sessionId={sessionId} onUploadClick={() => setTab('analyze')} />
            </Suspense>
          )}
          {tab === 'about'     && (
            <Suspense fallback={<TabSkeleton />}>
              <AboutPage scrollToId={aboutAnchor} onGetStarted={() => setTab('analyze')} />
            </Suspense>
          )}
        </PageTransition>
      </main>

      <footer style={{ borderTop: '1px solid var(--bd)', marginTop: '3rem', padding: 'clamp(2.5rem, 5vw, 4rem) clamp(1.25rem, 4vw, 3rem) 2rem', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.4fr) repeat(3, 1fr)', gap: 'clamp(1.5rem, 4vw, 3rem)', marginBottom: '2.5rem' }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <div style={{ width: 26, height: 26, borderRadius: 9, background: dark ? '#fff' : '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BrandMark size={16} glyph={dark ? '#111' : '#fff'} bg={dark ? '#fff' : '#111'} />
                </div>
                <span style={{ fontFamily: 'var(--ff)', fontWeight: 600, fontSize: '1.15rem', color: 'var(--txt)' }}>FeelFit</span>
              </div>
              <p style={{ fontSize: 13.5, color: 'var(--txt3)', lineHeight: 1.65, maxWidth: 240 }}>
                Understand your lab reports in simple language. Calm, private, and grounded in evidence.
              </p>
            </div>
            {/* Link columns */}
            {[
              { h: 'Product', links: [['Analyze', 'analyze'], ['AskFit', 'askfit'], ['Find a doctor', 'doctors'], ['Medicine', 'medicine']] as [string, Tab, string?][] },
              { h: 'Explore', links: [['Symptoms', 'symptoms'], ['Health tools', 'tools'], ['Dashboard', 'dashboard']] as [string, Tab, string?][] },
              { h: 'About', links: [['About FeelFit', 'about'], ['Made with love, by Ohi', 'about']] as [string, Tab, string?][] },
            ].map(col => (
              <div key={col.h}>
                <div style={{ fontFamily: 'var(--fm)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--txt4)', marginBottom: 14 }}>{col.h}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {col.links.map(([label, t, anchor]) => (
                    <button key={label} onClick={() => (t === 'about' ? goAbout(anchor) : setTab(t))}
                      style={{ background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 13.5, color: 'var(--txt2)', padding: 0, transition: 'color 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--txt)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--txt2)')}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Theme switcher + Plans (inline) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: 'var(--surf2)', border: '1px solid var(--bd)' }}>
              {[['Light', false], ['Dark', true]].map(([label, d]) => (
                <button key={label as string} onClick={() => setDark(d as boolean)}
                  style={{ padding: '6px 16px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: dark === d ? 'var(--accent)' : 'transparent', color: dark === d ? 'var(--bg1)' : 'var(--txt3)' }}>
                  {label as string}
                </button>
              ))}
            </div>
            <button onClick={() => { setPaywall(false); setShowAccount(true); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 18px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                background: 'var(--ok-bg)', border: '1px solid var(--ok)', color: 'var(--ok)' }}>
              <Icon name="zap" size={13} color="var(--ok)" /> View plans
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, paddingTop: '1.5rem', borderTop: '1px solid var(--bd)', fontSize: 12, color: 'var(--txt4)' }}>
            <span>© 2026 FeelFit · Made with care</span>
            <span>Here to help you understand your health — never to replace your doctor</span>
          </div>
        </div>
      </footer>

      {/* Floating AskFit button — bottom-left, ask from anywhere */}
      <AnimatePresence>
        {tab !== 'askfit' && (
          <motion.button key="askfit-fab"
            initial={{ opacity: 0, scale: 0.6, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6, y: 12 }}
            whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            onClick={() => { haptic('light'); setTab('askfit'); }} title="Ask FeelFit a health question"
            className="askfit-fab"
            style={{ position: 'fixed', right: 'clamp(20px, 6vw, 76px)', bottom: 'clamp(20px, 4vw, 40px)', zIndex: 90,
              display: 'flex', alignItems: 'center', gap: 9, padding: '12px 18px 12px 14px', borderRadius: 999, cursor: 'pointer',
              background: 'var(--askfit-grad)', color: '#fff', border: 'none', boxShadow: '0 10px 30px var(--askfit-glow), 0 4px 12px rgba(0,0,0,0.18)' }}>
            {/* Soft pulsing aura — Capacitor-only, draws the eye to the FAB */}
            {isCapacitor() && (
              <motion.span aria-hidden
                animate={{ scale: [1, 1.35, 1], opacity: [0.45, 0, 0.45] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                style={{ position: 'absolute', inset: 0, borderRadius: 999, background: 'var(--askfit-grad)', zIndex: -1 }}
              />
            )}
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={16} color="#fff" />
            </span>
            <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: '-0.01em' }}>AskFit</span>
          </motion.button>
        )}
      </AnimatePresence>

      <BottomNav tab={tab} setTab={setTab} onMore={() => {
        // Ask the Navbar's burger menu to open — uses a CustomEvent so we
        // don't have to lift the menu state up out of the Navbar.
        window.dispatchEvent(new CustomEvent('ff:open-menu'));
      }} />

      {/* Network status banner — floats above the navbar when offline. */}
      <NetworkStatus />

      {/* History modal — auto-renders as a bottom sheet on Capacitor via the Modal component. */}
      <AnimatePresence>
        {showHistory && <Modal title={`Report History (${localHistory.length})`} onClose={() => setShowHistory(false)}><HistoryPanel /></Modal>}
      </AnimatePresence>
      <AnimatePresence>
        {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAccount && (
          <AccountModal
            usage={usage}
            paywall={paywall}
            onClose={() => setShowAccount(false)}
            onChange={u => { setUsage(u); if (u.is_paid) setToast({ msg: 'Plan active — unlimited checks!', type: 'success' }); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSignIn && (
          <SignInModal
            usage={usage}
            onClose={() => setShowSignIn(false)}
            onChange={u => {
              setUsage(u);
              if (u.email && !u.is_paid) setToast({ msg: 'Signed in! Add your health details in Dashboard for more personalized insights.', type: 'success' });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
