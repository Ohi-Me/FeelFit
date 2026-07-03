'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, SecHead, Badge, Btn, Input } from '@/components/ui/index';
import { motion, AnimatePresence, Stagger, StaggerItem, Reveal } from '@/components/ui/motion';
import { SEVERITY_CFG } from '@/lib/constants';
import { getMedicineInfo, checkInteractions } from '@/lib/api';
import { getBuyLinks } from '@/lib/medicineExtras';
import { openLink, haptic } from '@/lib/native';
import {
  MEDICINE_DB, MED_CATEGORIES, searchMedicines,
  type MedicineEntry, type MedCategory,
} from '@/lib/medicineDB';
import type { MedicineInfo, InteractionResult } from '@/types';

// ── Buy this medicine — deep links to pharmacy search (no scraping) ───────────
function BuyMedicineBar({ name, price }: { name: string; price?: string }) {
  const links = getBuyLinks(name);
  return (
    <div style={{ padding: '1rem 1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--txt2)' }}>
          <Icon name="external" size={14} color="var(--accent)" /> Buy this medicine
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {links.map(l => (
            <button key={l.label} type="button" onClick={() => { haptic('light'); openLink(l.url); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 999, background: 'var(--surf2)', border: '1px solid var(--bd2)', fontSize: 12.5, fontWeight: 600, color: 'var(--txt2)', cursor: 'pointer' }}>
              {l.label} <Icon name="external" size={10} color="var(--txt4)" />
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--txt4)', marginLeft: 'auto' }}>Opens the pharmacy's own search — compare price &amp; availability there.</span>
      </div>
      {price && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', borderRadius: 'var(--rm)' }}>
          <Icon name="rupee" size={13} color="var(--ok)" />
          <span style={{ fontSize: 12.5, color: 'var(--txt2)' }}><strong style={{ color: 'var(--ok)' }}>Typical price:</strong> {price}</span>
          <span style={{ fontSize: 10.5, color: 'var(--txt4)', marginLeft: 'auto' }}>AI estimate — varies by brand, city &amp; pharmacy</span>
        </div>
      )}
    </div>
  );
}

// ── Loading Spinner ───────────────────────────────────────────────────────────
function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 0' }}>
      <motion.svg viewBox="0 0 60 60" width={48} height={48}
        animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
        style={{ display: 'block', margin: '0 auto 1rem' }}>
        <circle cx={30} cy={30} r={26} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray="60 104" strokeLinecap="round" />
      </motion.svg>
      <p style={{ color: 'var(--txt3)', fontSize: 13 }}>{text}</p>
    </div>
  );
}

// ── Local DB Detail Panel ─────────────────────────────────────────────────────
function LocalMedicinePanelDB({ med, onClear }: { med: MedicineEntry; onClear: () => void }) {
  const rxColor = med.prescription ? 'var(--accent)' : 'var(--ok)';
  const rxBg = med.prescription ? 'var(--glow2)' : 'var(--ok-bg)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Header */}
      <div style={{ padding: '1.75rem', marginBottom: '1.1rem', background: 'linear-gradient(135deg, var(--glow2), var(--surf))', border: '1px solid var(--bd2)', borderRadius: 'var(--rl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--ff)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 5 }}>{med.name}</h2>
              {med.generic !== med.name && <p style={{ color: 'var(--txt3)', fontSize: 13, marginBottom: 10 }}>Generic: <em>{med.generic}</em></p>}
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                <Badge color="var(--accent-purple)" bg="rgba(139,92,246,0.1)">{med.category}</Badge>
                <Badge color={rxColor} bg={rxBg}>{med.prescription ? 'Prescription Only' : 'OTC (Over-the-counter)'}</Badge>
                {med.brands.slice(0, 3).map(b => <Badge key={b} color="var(--txt3)" bg="var(--surf2)">{b}</Badge>)}
              </div>
            </div>
          </div>
          <Btn variant="icon" size="sm" icon="close" onClick={onClear} />
        </div>
      </div>

      <BuyMedicineBar name={med.name} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {/* Usage */}
        <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
          <SecHead icon="target">What It's Used For</SecHead>
          <p style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.78 }}>{med.usage}</p>
        </div>

        {/* Dosage */}
        <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
          <SecHead icon="flask">Dosage Information</SecHead>
          <p style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.78 }}>{med.dosage}</p>
        </div>

        {/* Side Effects */}
        <div style={{ padding: '1.25rem', background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', borderRadius: 'var(--rl)' }}>
          <SecHead icon="alert" color="var(--warn)">Side Effects</SecHead>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {med.sideEffects.map((s, i) => (
              <span key={i} style={{ padding: '4px 11px', borderRadius: 100, background: 'rgba(245,158,11,0.12)', border: '1px solid var(--warn-bd)', fontSize: 12, color: 'var(--warn)' }}>{s}</span>
            ))}
          </div>
        </div>

        {/* Warnings */}
        <div style={{ padding: '1.25rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-bd)', borderRadius: 'var(--rl)' }}>
          <SecHead icon="shield" color="var(--danger)">Important Warnings</SecHead>
          {med.warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--txt2)' }}>
              <span style={{ color: 'var(--danger)', flexShrink: 0 }}>⚠</span>{w}
            </div>
          ))}
        </div>

        {/* Interactions */}
        {med.interactions.length > 0 && (
          <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
            <SecHead icon="x_circle">Drug Interactions</SecHead>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {med.interactions.map((ix, i) => (
                <span key={i} style={{ padding: '4px 11px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd2)', fontSize: 12, color: 'var(--txt2)' }}>{ix}</span>
              ))}
            </div>
          </div>
        )}

        {/* Storage + Alternatives */}
        <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
          <SecHead icon="info">Storage & Alternatives</SecHead>
          <p style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}><strong style={{ color: 'var(--txt3)', fontSize: 11, fontFamily: 'var(--fm)', textTransform: 'uppercase' }}>Storage: </strong>{med.storage}</p>
          {med.alternatives.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>Alternatives</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {med.alternatives.map((a, i) => (
                  <span key={i} style={{ padding: '4px 11px', borderRadius: 100, background: 'var(--glow2)', border: '1px solid var(--bd2)', fontSize: 12, color: 'var(--accent)' }}>{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Brands */}
        {med.brands.length > 0 && (
          <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
            <SecHead icon="pill">Brand Names in India</SecHead>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {med.brands.map((b, i) => (
                <span key={i} style={{ padding: '5px 13px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd2)', fontSize: 13, color: 'var(--txt2)', fontWeight: 600 }}>{b}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: '1rem', padding: '12px 16px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', fontSize: 12, color: 'var(--txt3)', display: 'flex', gap: 8 }}>
        <Icon name="info" size={13} />
        <span><strong style={{ color: 'var(--txt2)' }}>Here to help you understand.</strong> This is general health information, not medical advice. Always check with your doctor or pharmacist before taking any medicine.</span>
      </div>
    </motion.div>
  );
}

// ── LLM-backed Medicine Info Panel (existing schema) ─────────────────────────
function MedicineInfoPanel({ info, onClear }: { info: MedicineInfo; onClear: () => void }) {
  const otcColor = info.otc_or_prescription === 'OTC' ? 'var(--ok)' : info.otc_or_prescription === 'Both' ? 'var(--warn)' : 'var(--accent)';
  const otcBg = info.otc_or_prescription === 'OTC' ? 'var(--ok-bg)' : info.otc_or_prescription === 'Both' ? 'var(--warn-bg)' : 'var(--glow)';
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.16,1,0.3,1] }}>
      <div style={{ padding: '1.75rem', marginBottom: '1.1rem', background: 'linear-gradient(135deg, var(--glow2), var(--surf))', border: '1px solid var(--bd2)', borderRadius: 'var(--rl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontFamily: 'var(--ff)', fontSize: '1.6rem', fontWeight: 800, marginBottom: 5 }}>{info.name}</h2>
              {info.generic_name && info.generic_name !== info.name && <p style={{ color: 'var(--txt3)', fontSize: 13, marginBottom: 10 }}>Generic: <em>{info.generic_name}</em></p>}
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {info.drug_class && <Badge color="var(--accent)" bg="var(--glow)">{info.drug_class}</Badge>}
                {info.drug_category && <Badge color="var(--txt2)" bg="var(--surf2)">{info.drug_category}</Badge>}
                {info.otc_or_prescription && <Badge color={otcColor} bg={otcBg}>{info.otc_or_prescription}</Badge>}
              </div>
            </div>
          </div>
          <Btn variant="icon" size="sm" icon="close" onClick={onClear} />
        </div>
      </div>

      <BuyMedicineBar name={info.name} price={info.typical_price_inr} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
        {info.commonly_used_for?.length > 0 && (
          <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
            <SecHead icon="target">Commonly Used For</SecHead>
            {info.commonly_used_for.map((c, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < info.commonly_used_for.length - 1 ? '1px solid var(--bd)' : 'none', fontSize: 13.5, color: 'var(--txt2)' }}><Icon name="chevright" size={12} color="var(--accent)" />{c}</div>)}
          </div>
        )}
        {info.how_it_works && (
          <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
            <SecHead icon="brain">How It Works</SecHead>
            <p style={{ fontSize: 13.5, color: 'var(--txt2)', lineHeight: 1.78 }}>{info.how_it_works}</p>
            {info.typical_dosage_info && <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--glow3)', borderRadius: 'var(--r)', fontSize: 12.5, color: 'var(--txt2)' }}><strong style={{ color: 'var(--accent)' }}>Dosage forms: </strong>{info.typical_dosage_info}</div>}
          </div>
        )}
        {info.common_side_effects?.length > 0 && (
          <div style={{ padding: '1.25rem', background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', borderRadius: 'var(--rl)' }}>
            <SecHead icon="alert" color="var(--warn)">Common Side Effects</SecHead>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>{info.common_side_effects.map((s, i) => <span key={i} style={{ padding: '4px 11px', borderRadius: 100, background: 'rgba(245,158,11,0.12)', border: '1px solid var(--warn-bd)', fontSize: 12, color: 'var(--warn)' }}>{s}</span>)}</div>
          </div>
        )}
        {info.serious_side_effects?.length > 0 && (
          <div style={{ padding: '1.25rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-bd)', borderRadius: 'var(--rl)' }}>
            <SecHead icon="x_circle" color="var(--danger)">Serious Effects — Seek Medical Help</SecHead>
            {info.serious_side_effects.map((s, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--txt2)' }}><span style={{ color: 'var(--danger)', flexShrink: 0 }}>⚠</span>{s}</div>)}
          </div>
        )}
        {info.general_warnings?.length > 0 && (
          <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
            <SecHead icon="shield">General Warnings</SecHead>
            {info.general_warnings.map((w, i) => <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', fontSize: 13, color: 'var(--txt2)' }}><Icon name="info" size={12} color="var(--txt3)" />{w}</div>)}
          </div>
        )}
        {(info.food_interactions?.length > 0 || info.storage) && (
          <div style={{ padding: '1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)' }}>
            {info.food_interactions?.length > 0 && (<><SecHead icon="heart" color="var(--ok)">Food Interactions</SecHead>{info.food_interactions.map((f, i) => <div key={i} style={{ fontSize: 13, color: 'var(--txt2)', padding: '4px 0' }}>· {f}</div>)}</>)}
            {info.storage && <div style={{ marginTop: info.food_interactions?.length ? 12 : 0, fontSize: 13, color: 'var(--txt2)' }}><strong style={{ color: 'var(--txt3)', fontSize: 11, fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Storage: </strong>{info.storage}</div>}
          </div>
        )}
      </div>
      <div style={{ marginTop: '1rem', padding: '12px 16px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', fontSize: 12, color: 'var(--txt3)', display: 'flex', gap: 8 }}>
        <Icon name="info" size={13} /><span><strong style={{ color: 'var(--txt2)' }}>Here to help you understand.</strong> This is general health information, not medical advice. Always check with your doctor or pharmacist.</span>
      </div>
    </motion.div>
  );
}

// ── Interaction Checker ───────────────────────────────────────────────────────
function InteractionChecker() {
  const [list, setList] = useState(['', '']);
  const [result, setResult] = useState<InteractionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    const meds = list.filter(m => m.trim());
    if (meds.length < 2) { setError('Add at least 2 medicines'); return; }
    setLoading(true); setResult(null); setError(null);
    try { const data = await checkInteractions(meds); setResult(data); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <p style={{ color: 'var(--txt2)', fontSize: 13.5, marginBottom: '1.25rem', lineHeight: 1.75 }}>
        Enter 2–8 medicines to get educational information about potential interactions. Always confirm with your pharmacist for your specific situation.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem', maxWidth: 500 }}>
        {list.map((med, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} style={{ display: 'flex', gap: 8 }}>
            <input
              placeholder={`Medicine ${i + 1}...`}
              value={med}
              onChange={e => { const n = [...list]; n[i] = e.target.value; setList(n); }}
              onKeyDown={e => e.key === 'Enter' && check()}
              style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--rm)', fontSize: 14 }}
            />
            {list.length > 2 && <Btn variant="danger" size="sm" icon="close" onClick={() => setList(l => l.filter((_, j) => j !== i))} />}
          </motion.div>
        ))}
        {list.length < 8 && (
          <motion.button onClick={() => setList(l => [...l, ''])} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
            style={{ padding: '9px', borderRadius: 'var(--rm)', background: 'var(--surf)', border: '1px dashed var(--bd)', color: 'var(--txt3)', fontSize: 13, cursor: 'pointer' }}>
            + Add another medicine
          </motion.button>
        )}
      </div>
      {error && <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
      <Btn variant="primary" loading={loading} onClick={check}>Check Interactions</Btn>
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.16,1,0.3,1] }} style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: '1rem' }}>
              {result.medicines_checked.map((m, i) => <Badge key={i} color="var(--accent)" bg="var(--glow)">{m}</Badge>)}
            </div>
            {result.interactions.length === 0 ? (
              <div style={{ padding: '1.25rem', background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', borderRadius: 'var(--rl)', display: 'flex', gap: 12, alignItems: 'center' }}>
                <Icon name="check_circle" size={22} color="var(--ok)" />
                <div>
                  <strong style={{ display: 'block', marginBottom: 3 }}>No significant interactions found</strong>
                  <span style={{ fontSize: 13, color: 'var(--txt2)' }}>Always confirm with your pharmacist for your specific situation.</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.interactions.map((ix, i) => {
                  const sev = SEVERITY_CFG[ix.severity] ?? SEVERITY_CFG.unknown;
                  return (
                    <div key={i} style={{ padding: '1.25rem', background: 'var(--surf)', border: `1px solid ${sev.color}38`, borderRadius: 'var(--rl)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{ix.medicine_a} × {ix.medicine_b}</span>
                        <Badge color={sev.color} bg={`${sev.color}15`}>{sev.label}</Badge>
                      </div>
                      <p style={{ fontSize: 13.5, color: 'var(--txt2)', marginBottom: ix.general_advice ? 6 : 0, lineHeight: 1.68 }}>{ix.description}</p>
                      {ix.general_advice && <p style={{ fontSize: 12.5, color: 'var(--txt3)' }}>💡 {ix.general_advice}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', fontSize: 11.5, color: 'var(--txt3)' }}>⚠ {result.disclaimer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Category pill selector ────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  'Pain Relief': '💊', 'Fever': '🌡️', 'Cold & Flu': '🤧', 'Allergy': '🌿',
  'Diabetes': '🩸', 'Blood Pressure': '❤️', 'Heart Health': '🫀',
  'Vitamins & Supplements': '💪', 'Digestive Health': '🫁', 'Antibiotics': '🧫',
  'Skin Care': '🧴', 'Mental Health': '🧠', 'Respiratory Health': '🌬️',
  "Women's Health": '♀️', "Children's Medicines": '👶',
};

// ── Main Medicine Tab ─────────────────────────────────────────────────────────
export function MedicineTab() {
  const [mode, setMode] = useState<'info' | 'interactions'>('info');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MedCategory | null>(null);
  const [localResult, setLocalResult] = useState<MedicineEntry | null>(null);
  const [llmResult, setLlmResult] = useState<MedicineInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instant local search
  const localHits = useMemo(() => {
    if (!query.trim() && !activeCategory) return [];
    return searchMedicines(query, activeCategory ?? undefined).slice(0, 20);
  }, [query, activeCategory]);

  const showingResults = query.trim().length > 0 || activeCategory !== null;
  const showDetail = localResult || llmResult;

  const selectLocal = useCallback((med: MedicineEntry) => {
    setLocalResult(med); setLlmResult(null); setError(null);
  }, []);

  const searchLLM = useCallback(async (name: string) => {
    if (!name.trim()) return;
    setLoading(true); setLocalResult(null); setLlmResult(null); setError(null);
    try {
      const data = await getMedicineInfo(name.trim());
      if (data.error) throw new Error(data.error);
      setLlmResult(data);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const clearAll = useCallback(() => {
    setLocalResult(null); setLlmResult(null); setQuery(''); setError(null);
  }, []);

  const categoryMeds = useMemo(() => {
    if (!activeCategory) return [];
    return MEDICINE_DB.filter(m => m.category === activeCategory);
  }, [activeCategory]);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto' }}>
      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: '1.75rem' }}>
        {[{ k: 'info' as const, label: '💊 Medicine Info' }, { k: 'interactions' as const, label: '⚠️ Interaction Check' }].map(({ k, label }) => (
          <motion.button key={k} onClick={() => { setMode(k); setError(null); clearAll(); }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
            style={{ padding: '10px 22px', borderRadius: 'var(--rm)', fontSize: 13.5, fontWeight: mode === k ? 600 : 500, cursor: 'pointer', background: mode === k ? 'var(--ok-bg)' : 'var(--surf)', border: `1px solid ${mode === k ? 'var(--ok)' : 'var(--bd)'}`, color: mode === k ? 'var(--ok)' : 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.16s' }}>
            {label}
          </motion.button>
        ))}
      </div>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: '10px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-bd)', borderRadius: 'var(--rm)', color: 'var(--danger)', fontSize: 13, marginBottom: '1rem', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Icon name="alert" size={14} /> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: 'auto', color: 'inherit', fontSize: 16 }}>×</button>
        </motion.div>
      )}

      {mode === 'info' && (
        <AnimatePresence mode="wait">
          {showDetail ? (
            <motion.div key="detail">
              {localResult
                ? <LocalMedicinePanelDB med={localResult} onClear={clearAll} />
                : llmResult && <MedicineInfoPanel info={llmResult} onClear={clearAll} />}
            </motion.div>
          ) : (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Search bar */}
              <div style={{ display: 'flex', gap: 8, marginBottom: '0.5rem' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}>
                    <Icon name="search" size={15} color="var(--txt3)" />
                  </span>
                  <input
                    placeholder="Search any medicine by name, brand, or use..."
                    value={query}
                    onChange={e => { setQuery(e.target.value); setActiveCategory(null); }}
                    onKeyDown={e => e.key === 'Enter' && query.trim() && searchLLM(query)}
                    style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 'var(--rm)', fontSize: 14 }}
                  />
                </div>
                {query.trim() && (
                  <Btn variant="primary" loading={loading} icon="search" onClick={() => searchLLM(query)}>
                    {localHits.length > 0 ? 'Look up' : 'Search'}
                  </Btn>
                )}
              </div>
              <p style={{ fontSize: 11.5, color: 'var(--txt4)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                Common medicines load instantly below. Any other medicine — including familiar brands like
                <strong style={{ color: 'var(--txt3)' }}> Crocin, Dolo, or Combiflam</strong> — is found in seconds from a library of <strong style={{ color: 'var(--txt3)' }}>100,000+ medicines</strong>. Just type a name and search freely.
              </p>

              {/* Category pills */}
              {!showingResults && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Browse by Category</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {MED_CATEGORIES.map(cat => (
                      <motion.button key={cat} onClick={() => setActiveCategory(cat)}
                        whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.96 }}
                        style={{ padding: '7px 14px', borderRadius: 100, background: 'var(--surf)', border: '1px solid var(--bd)', fontSize: 13, color: 'var(--txt2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{CATEGORY_ICONS[cat] || '💊'}</span> {cat}
                        <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--fm)' }}>
                          {MEDICINE_DB.filter(m => m.category === cat).length}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Active category browse */}
              {activeCategory && !query.trim() && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
                    <Btn variant="ghost" size="sm" icon="chevleft" onClick={() => setActiveCategory(null)}>All Categories</Btn>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{CATEGORY_ICONS[activeCategory]} {activeCategory}</span>
                    <Badge>{categoryMeds.length} medicines</Badge>
                  </div>
                  <Stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                    {categoryMeds.map(med => (
                      <StaggerItem key={med.id}>
                        <motion.div whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: 0.98 }}
                          onClick={() => selectLocal(med)}
                          style={{ padding: '1.1rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', cursor: 'pointer' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{med.name}</span>
                            <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 100, background: med.prescription ? 'var(--glow2)' : 'var(--ok-bg)', color: med.prescription ? 'var(--accent)' : 'var(--ok)', border: `1px solid ${med.prescription ? 'var(--bd2)' : 'var(--ok-bd)'}` }}>
                              {med.prescription ? 'Rx' : 'OTC'}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: 'var(--txt3)', marginBottom: 7 }}>{med.generic}</div>
                          <p style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{med.usage}</p>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                            {med.brands.slice(0, 3).map(b => <span key={b} style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd)', color: 'var(--txt3)' }}>{b}</span>)}
                          </div>
                        </motion.div>
                      </StaggerItem>
                    ))}
                  </Stagger>
                </div>
              )}

              {/* Instant search results */}
              {showingResults && query.trim() && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                    {localHits.length > 0 ? `${localHits.length} result${localHits.length !== 1 ? 's' : ''} in database` : 'No local results — try AI search'}
                  </div>
                  {localHits.length > 0 ? (
                    <Stagger style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {localHits.map(med => (
                        <StaggerItem key={med.id}>
                          <motion.div whileHover={{ x: 4 }} whileTap={{ scale: 0.99 }}
                            onClick={() => selectLocal(med)}
                            style={{ padding: '1rem 1.25rem', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rl)', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--glow2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>{CATEGORY_ICONS[med.category] || '💊'}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                                <span style={{ fontWeight: 700, fontSize: 14 }}>{med.name}</span>
                                <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--fm)' }}>{med.generic}</span>
                              </div>
                              <div style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{med.usage}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: med.prescription ? 'var(--glow2)' : 'var(--ok-bg)', color: med.prescription ? 'var(--accent)' : 'var(--ok)' }}>{med.prescription ? 'Rx' : 'OTC'}</span>
                              <Icon name="chevright" size={14} color="var(--txt3)" />
                            </div>
                          </motion.div>
                        </StaggerItem>
                      ))}
                    </Stagger>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'var(--txt3)' }}>
                      <Icon name="search" size={40} color="var(--bd2)" />
                      <p style={{ fontSize: 13.5, margin: '1rem 0 0.5rem' }}>"{query}" not found in local database</p>
                      <p style={{ fontSize: 12.5, color: 'var(--txt4)', marginBottom: '1.25rem' }}>Try AI Search to look up any medicine</p>
                      <Btn variant="primary" loading={loading} icon="brain" onClick={() => searchLLM(query)}>AI Search for "{query}"</Btn>
                    </div>
                  )}
                </div>
              )}

              {loading && <LoadingSpinner text="Searching AI medicine database..." />}
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {mode === 'interactions' && <InteractionChecker />}
    </div>
  );
}


