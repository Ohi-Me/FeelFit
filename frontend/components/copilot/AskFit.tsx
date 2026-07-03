'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { motion, AnimatePresence } from '@/components/ui/motion';
import { ragRetrieve, attachDocument } from '@/lib/api';
import { pickDocument, toFile, isCapacitor, haptic, openExternal, share } from '@/lib/native';

const FREE_ASKS = 10; // free questions before a plan is required

const SAMPLES = ['Why is ferritin low?', 'What does HbA1c 6.7% mean?', 'Is my TSH high?', 'Tips for high cholesterol', 'What should I eat for low Vitamin D?'];

// Friendly labels for evidence sources — users see "Lab standard", not "LOINC 3016-3".
const SOURCE_LABEL: Record<string, string> = {
  loinc: 'Lab standards', snomed_ct: 'Condition info', icd: 'Condition info',
  rxnorm: 'Medicine info', drug: 'Medicine info', research: 'Clinical guidelines',
  indian_health: 'India health notes', knowledge_graph: 'Health knowledge',
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  evidence_supported: { label: 'Well supported', color: 'var(--ok)' },
  partial_evidence: { label: 'Partly supported', color: 'var(--warn)' },
  insufficient_evidence: { label: 'Limited evidence', color: 'var(--txt3)' },
};

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  status?: string;
  confidence?: number;
  sources?: string[];
  personalized?: boolean;
  followups?: string[];
}

function friendlySources(citations: { source: string }[] | undefined): string[] {
  if (!citations) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of citations) {
    const label = SOURCE_LABEL[c.source] || 'Trusted source';
    if (!seen.has(label)) { seen.add(label); out.push(label); }
  }
  return out.slice(0, 4);
}

// A couple of natural next questions to keep the conversation flowing.
function suggestFollowups(q: string): string[] {
  const base = ['What can I do about it?', 'What foods help?', 'Should I see a doctor?', 'Is this serious?'];
  return base.filter(f => f.toLowerCase() !== q.toLowerCase()).slice(0, 3);
}

function AnswerCard({ m }: { m: Msg }) {
  const [showSources, setShowSources] = useState(false);
  const st = m.status ? STATUS_META[m.status] : null;
  return (
    <div style={{ alignSelf: 'flex-start', maxWidth: '92%', display: 'flex', gap: 10 }}>
      <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: 'var(--askfit-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
        <Icon name="sparkles" size={15} color="#fff" />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: '4px 16px 16px 16px', padding: '13px 16px' }}>
          {m.personalized && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--askfit)', fontWeight: 600, marginBottom: 8 }}>
              <Icon name="heartpulse" size={12} color="var(--askfit)" /> Answered with your recent results in mind
            </div>
          )}
          <p style={{ fontSize: 14.5, color: 'var(--txt)', lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>{m.text}</p>

          {(st || (m.sources && m.sources.length > 0)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--bd)' }}>
              {st && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: st.color }}>
                  <Icon name="shield" size={12} color={st.color} /> {st.label}
                </span>
              )}
              {m.sources && m.sources.length > 0 && (
                <button onClick={() => setShowSources(s => !s)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--txt3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <Icon name="eye" size={12} color="var(--txt3)" /> {m.sources.length} source{m.sources.length !== 1 ? 's' : ''}
                  <Icon name={showSources ? 'chevup' : 'chevdown'} size={11} color="var(--txt3)" />
                </button>
              )}
            </div>
          )}
          <AnimatePresence>
            {showSources && m.sources && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {m.sources.map(s => (
                    <span key={s} style={{ fontSize: 11, color: 'var(--txt2)', background: 'var(--surf2)', border: '1px solid var(--bd)', padding: '3px 10px', borderRadius: 100 }}>{s}</span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* follow-up suggestions */}
        {m.followups && m.followups.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {m.followups.map(f => (
              <button key={f} data-followup={f}
                style={{ fontSize: 12, color: 'var(--askfit)', background: 'var(--askfit-bg)', border: '1px solid var(--askfit-bd)', padding: '6px 12px', borderRadius: 100, cursor: 'pointer' }}>
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AskFit({ isPaid = false, onUpgrade }: { isPaid?: boolean; onUpgrade?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCtx, setShowCtx] = useState(false);
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [conditions, setConditions] = useState('');
  const [medications, setMedications] = useState('');
  const [asks, setAsks] = useState(0);
  const [opening, setOpening] = useState(true);
  const [attachment, setAttachment] = useState<{ filename: string; text: string } | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [listening, setListening] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recogRef = useRef<any>(null);

  useEffect(() => {
    try { setAsks(parseInt(localStorage.getItem('askfit_asks') || '0', 10) || 0); } catch {}
    const t = setTimeout(() => setOpening(false), 1100);
    return () => clearTimeout(t);
  }, []);
  // Scroll WITHIN the chat container (never the whole page) so we stay put.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const remaining = Math.max(0, FREE_ASKS - asks);
  const limitReached = !isPaid && remaining <= 0;

  const ask = async (raw: string) => {
    const text = raw.trim();
    if (text.length < 2 || loading) return;
    if (!isPaid && asks >= FREE_ASKS) { onUpgrade?.(); return; }
    if (!isPaid) {
      const n = asks + 1; setAsks(n);
      try { localStorage.setItem('askfit_asks', String(n)); } catch {}
    }
    const priorHistory = messages.map(m => ({ role: m.role, text: m.text }));
    setQuery('');
    setMessages(m => [...m, { role: 'user', text }]);
    setLoading(true);
    try {
      const res: any = await ragRetrieve(text, {
        age: age || undefined, gender: gender || undefined,
        conditions: conditions ? conditions.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        medications: medications ? medications.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        history: priorHistory,
        attachment: attachment?.text,
      });
      const answer = res.answer || 'I couldn’t find enough to answer that confidently — try rephrasing, or ask about a specific lab value, symptom, or medicine.';
      setMessages(m => [...m, {
        role: 'assistant', text: answer,
        status: res.validation_status, confidence: res.confidence,
        sources: friendlySources(res.citations), personalized: !!res.personalized,
        followups: suggestFollowups(text),
      }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', text: 'Something went wrong reaching the health engine. Please make sure the backend is running and try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  // delegate clicks on follow-up chips
  const onThreadClick = (e: React.MouseEvent) => {
    const f = (e.target as HTMLElement)?.getAttribute?.('data-followup');
    if (f) ask(f);
  };

  // ── Attach a document (report / prescription / note) ──────────────────────────
  // On Capacitor we use the native document picker; on web the regular <input>.
  const onPickFile = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    let file: File | null = null;
    if (e) {
      file = e.target.files?.[0] || null;
      if (file) e.currentTarget.value = '';
    } else {
      // Native path triggered by the attach button on Capacitor
      try {
        haptic('select');
        const picked = await pickDocument(['application/pdf', 'image/jpeg', 'image/png', 'image/*', 'text/csv']);
        if (picked) file = toFile(picked, picked.name);
      } catch { /* user cancelled */ }
    }
    if (!file) return;
    setAttaching(true);
    try {
      const d = await attachDocument(file);
      setAttachment({ filename: d.filename, text: d.text });
      haptic('success');
      setMessages(m => [...m, { role: 'assistant', text: `📎 Got it — I’ve read **${d.filename}**. Ask me anything about it.` }]);
    } catch (err) {
      haptic('error');
      setMessages(m => [...m, { role: 'assistant', text: (err as Error).message || 'I couldn’t read that document. Try a clearer photo or a PDF.' }]);
    } finally { setAttaching(false); }
  };

  // ── Voice input (browser Web Speech API) — follows the selected site language ──
  const speechLang = () => {
    const map: Record<string, string> = {
      en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', te: 'te-IN', mr: 'mr-IN', ta: 'ta-IN',
      gu: 'gu-IN', kn: 'kn-IN', pa: 'pa-IN', ml: 'ml-IN', ur: 'ur-IN',
    };
    try {
      const m = document.cookie.match(/googtrans=\/[^/]*\/([^;]+)/);
      const code = m && m[1] ? m[1] : 'en';
      return map[code] || 'en-IN';
    } catch { return 'en-IN'; }
  };

  const say = (text: string) => setMessages(m => [...m, { role: 'assistant', text }]);

  // Chrome's SpeechRecognition can silently fail (or throw a bare "not-allowed")
  // even after the site's mic permission shows "Allow" — usually because the OS
  // itself (Windows Settings → Privacy → Microphone) is blocking the browser, or
  // because no getUserMedia handshake has happened yet in this page load. Doing
  // an explicit getUserMedia() first surfaces the *real* reason (NotAllowedError
  // vs NotFoundError vs NotReadableError) and reliably "warms up" mic access so
  // the SpeechRecognition call after it actually starts listening.
  const ensureMicAccess = async (): Promise<boolean> => {
    if (!window.isSecureContext) {
      say('Voice input only works on a secure page (https:// or localhost). This page isn’t secure, so Chrome blocks microphone access entirely.');
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      say('This browser doesn’t expose microphone access. Please use Chrome or Edge, or type your question instead.');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop()); // just confirming access — SpeechRecognition opens its own stream
      return true;
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        say('Microphone access is blocked. Click the 🔒/ⓘ icon next to the address bar, set Microphone to "Allow", then reload the page and try again. If it’s already set to Allow, check Windows Settings → Privacy & security → Microphone → make sure "Let apps access your microphone" and Chrome are both turned on.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        say('I couldn’t find a microphone on this device. Please connect one, or type your question instead.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        say('Your microphone seems to be in use by another app (or blocked at the hardware level). Close other apps using it and try again.');
      } else {
        say('Couldn’t access the microphone. Please check your browser and system mic permissions, or type your question instead.');
      }
      return false;
    }
  };

  const toggleVoice = async () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      say('Voice input needs Chrome or Edge (with microphone access). On other browsers, please type your question.');
      return;
    }
    if (listening) { try { recogRef.current?.stop(); } catch {} setListening(false); return; }

    const ok = await ensureMicAccess();
    if (!ok) return;

    const rec = new SR();
    rec.lang = speechLang();
    rec.interimResults = true;
    rec.continuous = true;          // keep listening until the user stops
    rec.maxAlternatives = 1;
    let finalText = '';
    let gotResult = false;
    rec.onresult = (ev: any) => {
      gotResult = true;
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setQuery((finalText + interim).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      switch (e?.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          say('I need microphone permission to hear you. Please allow it in your browser and tap the mic again.');
          break;
        case 'audio-capture':
          say('No microphone could be captured — check it’s connected and not blocked by Windows privacy settings, then try again.');
          break;
        case 'network':
          say('Voice recognition needs an internet connection to work in Chrome. Please check your connection and try again.');
          break;
        case 'no-speech':
          break; // benign — user just didn't say anything before it timed out
        case 'aborted':
          break; // user or we stopped it deliberately
        default:
          if (!gotResult) say('Voice input hit an unexpected error. Please try again, or type your question.');
      }
    };
    recogRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const started = messages.length > 0;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', height: 'calc(100vh - 130px)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Entry animation — a soft expanding aura + spark drift. Plays once on open. */}
      <AnimatePresence>
        {opening && (
          <motion.div key="askfit-opener"
            initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10, overflow: 'hidden' }}>
            {/* aura ring */}
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.2, 1.6], opacity: [0, 0.55, 0] }}
              transition={{ duration: 1.0, times: [0, 0.45, 1], ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, var(--askfit-glow) 0%, transparent 65%)', filter: 'blur(8px)' }} />
            {/* central spark */}
            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -90 }}
              animate={{ scale: [0, 1.15, 1], opacity: [0, 1, 0], rotate: [-90, 0, 30] }}
              transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'relative', width: 64, height: 64, borderRadius: '50%', background: 'var(--askfit-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 60px var(--askfit-glow)' }}>
              <Icon name="sparkles" size={28} color="#fff" />
            </motion.div>
            {/* drifting sparks */}
            {[0, 1, 2, 3, 4, 5].map(i => {
              const angle = (i / 6) * Math.PI * 2;
              const dx = Math.cos(angle) * 110;
              const dy = Math.sin(angle) * 110;
              return (
                <motion.span key={i}
                  initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                  animate={{ x: dx, y: dy, opacity: [0, 1, 0], scale: [0, 1, 0.6] }}
                  transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
                  style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: i % 2 ? 'var(--askfit-2)' : 'var(--askfit)', boxShadow: '0 0 10px currentColor', color: i % 2 ? 'var(--askfit-2)' : 'var(--askfit)' }} />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slim top bar — branded mark left, free-credit pill far right with breathing room */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '4px 6px 14px', flexShrink: 0 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--askfit)', fontFamily: 'var(--fm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--askfit-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sparkles" size={11} color="#fff" />
          </span>
          AskFit
          {isPaid && (
            <span style={{ marginLeft: 4, padding: '2px 8px', borderRadius: 999, background: 'var(--askfit-bg)', border: '1px solid var(--askfit-bd)', fontSize: 10, fontWeight: 700, color: 'var(--askfit)' }}>PRO</span>
          )}
        </span>
        {!isPaid && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 13px', borderRadius: 999, background: limitReached ? 'var(--warn-bg)' : 'var(--askfit-bg)', border: `1px solid ${limitReached ? 'var(--warn-bd)' : 'var(--askfit-bd)'}`, fontSize: 11.5, fontWeight: 600, color: limitReached ? 'var(--warn)' : 'var(--askfit)' }}>
            <Icon name="sparkles" size={12} color={limitReached ? 'var(--warn)' : 'var(--askfit)'} />
            {limitReached ? 'Upgrade to keep chatting' : `${remaining}/${FREE_ASKS} free`}
          </span>
        )}
      </div>

      {/* Thread (scrolls inside itself; empty state is vertically centered) */}
      <div ref={threadRef} onClick={onThreadClick}
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: started ? 'flex-start' : 'center', gap: 14, padding: '4px 2px' }}>
        {!started && (
          <div style={{ textAlign: 'center', padding: '0 0.5rem' }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--askfit-grad)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, boxShadow: '0 8px 24px var(--askfit-glow)' }}>
              <Icon name="sparkles" size={24} color="#fff" />
            </div>
            <h1 style={{ fontWeight: 700, fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', letterSpacing: '-0.03em', marginBottom: 10 }}>Your friendly health companion</h1>
            <p style={{ fontSize: 14.5, color: 'var(--txt2)', maxWidth: 440, margin: '0 auto 20px', lineHeight: 1.7 }}>
              Ask about a result, symptom, or medicine — in plain words. I’ll answer clearly, with your own recent results in mind.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 560, margin: '0 auto' }}>
              {SAMPLES.map(s => (
                <button key={s} onClick={() => ask(s)}
                  style={{ padding: '8px 14px', borderRadius: 100, background: 'var(--surf)', border: '1px solid var(--bd2)', fontSize: 13, color: 'var(--txt2)', cursor: 'pointer' }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          m.role === 'user' ? (
            <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', padding: '11px 16px', background: 'var(--askfit-grad)', color: '#fff', borderRadius: '16px 16px 4px 16px', fontSize: 14.5, fontWeight: 500, lineHeight: 1.5 }}>
              {m.text}
            </div>
          ) : (
            <AnswerCard key={i} m={m} />
          )
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--askfit-grad)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={15} color="#fff" />
            </span>
            <div style={{ display: 'flex', gap: 4, padding: '14px 16px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: '4px 16px 16px 16px' }}>
              {[0, 1, 2].map(d => (
                <motion.span key={d} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--txt3)' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Personalize (collapsible) */}
      <AnimatePresence>
        {showCtx && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, padding: '12px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', margin: '10px 0' }}>
              <input value={age} onChange={e => setAge(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Age" inputMode="numeric"
                style={{ padding: '9px 11px', fontSize: 13, borderRadius: 'var(--rm)', border: '1px solid var(--bd)', background: 'var(--bg1)', color: 'var(--txt)' }} />
              <select value={gender} onChange={e => setGender(e.target.value)}
                style={{ padding: '9px 11px', fontSize: 13, borderRadius: 'var(--rm)', border: '1px solid var(--bd)', background: 'var(--bg1)', color: gender ? 'var(--txt)' : 'var(--txt3)', cursor: 'pointer' }}>
                <option value="">Gender</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
              </select>
              <input value={conditions} onChange={e => setConditions(e.target.value)} placeholder="Conditions"
                style={{ padding: '9px 11px', fontSize: 13, borderRadius: 'var(--rm)', border: '1px solid var(--bd)', background: 'var(--bg1)', color: 'var(--txt)' }} />
              <input value={medications} onChange={e => setMedications(e.target.value)} placeholder="Medications"
                style={{ padding: '9px 11px', fontSize: 13, borderRadius: 'var(--rm)', border: '1px solid var(--bd)', background: 'var(--bg1)', color: 'var(--txt)' }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Attached document chip */}
      <AnimatePresence>
        {attachment && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '8px 12px', borderRadius: 'var(--rm)', background: 'var(--askfit-bg)', border: '1px solid var(--askfit-bd)', flexShrink: 0 }}>
            <Icon name="file" size={14} color="var(--askfit)" />
            <span style={{ fontSize: 12.5, color: 'var(--txt2)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Attached: <strong style={{ color: 'var(--askfit)' }}>{attachment.filename}</strong> — ask me about it
            </span>
            <button onClick={() => setAttachment(null)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt4)', display: 'flex' }}>
              <Icon name="close" size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <input ref={fileRef} type="file" accept="application/pdf,image/*,.csv" onChange={onPickFile} style={{ display: 'none' }} />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 12, flexShrink: 0 }}>
        <button onClick={() => setShowCtx(v => !v)} title="Personalize"
          style={{ flexShrink: 0, width: 42, height: 44, borderRadius: 999, background: showCtx ? 'var(--askfit-bg)' : 'var(--surf)', border: `1px solid ${showCtx ? 'var(--askfit-bd)' : 'var(--bd2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="user" size={16} color={showCtx ? 'var(--askfit)' : 'var(--txt3)'} />
        </button>
        <button onClick={() => { if (isCapacitor()) onPickFile(); else fileRef.current?.click(); }} title="Attach a report, prescription or note" disabled={attaching}
          style={{ flexShrink: 0, width: 42, height: 44, borderRadius: 999, background: attachment ? 'var(--askfit-bg)' : 'var(--surf)', border: `1px solid ${attachment ? 'var(--askfit-bd)' : 'var(--bd2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {attaching ? (
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex' }}>
              <Icon name="refresh" size={15} color="var(--askfit)" />
            </motion.span>
          ) : <Icon name="paperclip" size={16} color={attachment ? 'var(--askfit)' : 'var(--txt3)'} />}
        </button>
        <div className="askfit-aura" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') (limitReached ? onUpgrade?.() : ask(query)); }}
            placeholder={limitReached ? 'Upgrade to keep chatting…' : listening ? 'Listening…' : started ? 'Ask a follow-up…' : 'Ask anything about your health…'}
            disabled={limitReached}
            style={{ width: '100%', minWidth: 0, padding: '14px 18px', fontSize: 14.5, borderRadius: 'var(--pill)', border: '1px solid var(--bd2)', background: 'var(--surf)', color: 'var(--txt)' }} />
        </div>
        {/* Voice input button — hidden on Capacitor because Web Speech API
            (window.webkitSpeechRecognition) isn't supported inside the
            Android System WebView or iOS WKWebView. Users on mobile can
            type their question instead. */}
        {!isCapacitor() && (
          <button onClick={toggleVoice} title="Speak your question"
            style={{ flexShrink: 0, width: 42, height: 44, borderRadius: 999, background: listening ? 'var(--askfit)' : 'var(--surf)', border: `1px solid ${listening ? 'var(--askfit)' : 'var(--bd2)'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={16} color={listening ? '#fff' : 'var(--txt3)'} />
          </button>
        )}
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => (limitReached ? onUpgrade?.() : ask(query))}
          style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 999, background: 'var(--askfit-grad)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px var(--askfit-glow)' }}>
          <Icon name={limitReached ? 'zap' : 'arrow_r'} size={18} color="#fff" />
        </motion.button>
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt4)', marginTop: 8, paddingBottom: 4, lineHeight: 1.5, flexShrink: 0 }}>
        Here to help you understand — not medical advice. Always partner with your doctor for decisions.
      </p>
    </div>
  );
}
