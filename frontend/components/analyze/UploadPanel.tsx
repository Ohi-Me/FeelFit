'use client';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, Badge, Btn, Input, Select } from '@/components/ui/index';
import { getProfiles, saveProfileEntry, deleteProfile, toAnalysisProfile, type FamilyProfile } from '@/lib/profiles';
import { pickImage, pickDocument, toFile, isCapacitor, haptic, type PickedFile } from '@/lib/native';
import type { AnalysisProfile, ReportSummary } from '@/types';

interface UploadPanelProps {
  onFile: (f: File) => void;
  profile: AnalysisProfile;
  setProfile: React.Dispatch<React.SetStateAction<AnalysisProfile>>;
  history: ReportSummary[];
  onShowHistory: () => void;
}

const ACCEPTED = ['.pdf', '.jpg', '.jpeg', '.png', '.tiff', '.csv'];
const FORMATS = ['PDF', 'JPEG', 'PNG', 'TIFF', 'CSV'];

export function UploadPanel({ onFile, profile, setProfile, history, onShowHistory }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<File | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [cap, setCap] = useState(false); // true when running inside Capacitor

  // Family profiles (stored locally)
  const [profiles, setProfiles] = useState<FamilyProfile[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [saveName, setSaveName] = useState('');
  useEffect(() => { setProfiles(getProfiles()); setCap(isCapacitor()); }, []);

  const selectPerson = (p: FamilyProfile) => {
    setActiveId(p.id);
    setProfile(toAnalysisProfile(p));
  };
  const saveCurrentPerson = () => {
    const name = saveName.trim();
    if (!name) return;
    saveProfileEntry({ name, age: profile.age, gender: profile.gender, conditions: profile.conditions, medications: profile.medications });
    setProfiles(getProfiles());
    setSaveName('');
  };
  const removePerson = (id: string) => {
    deleteProfile(id);
    setProfiles(getProfiles());
    if (activeId === id) setActiveId('');
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) { setPreview(f); onFile(f); }
  }, [onFile]);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setPreview(f); onFile(f); haptic('light'); }
  };

  // ── Capacitor-only: native camera / gallery ────────────────────────────────
  const handleNativeCamera = useCallback(async () => {
    try {
      haptic('select');
      const picked = await pickImage({ source: 'camera' });
      if (!picked) return; // user cancelled
      const file = toFile(picked, `report-cam-${Date.now()}.${picked.type.split('/')[1] || 'jpg'}`);
      setPreview(file);
      onFile(file);
    } catch (e) { /* user-cancelled or permission denied — silent */ }
  }, [onFile]);

  const handleNativeGallery = useCallback(async () => {
    try {
      haptic('select');
      const picked = await pickImage({ source: 'gallery' });
      if (!picked) return;
      const file = toFile(picked, picked.name);
      setPreview(file);
      onFile(file);
    } catch (e) { /* silent */ }
  }, [onFile]);

  const handleNativeDocument = useCallback(async () => {
    try {
      haptic('select');
      const picked = await pickDocument(['application/pdf', 'image/jpeg', 'image/png', 'text/csv', 'image/tiff', 'image/webp']);
      if (!picked) return;
      const file = toFile(picked, picked.name);
      setPreview(file);
      onFile(file);
    } catch (e) { /* silent */ }
  }, [onFile]);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }} className="animate-fadeUp">

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '6px 16px', borderRadius: 100,
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          marginBottom: 22, fontSize: 12, color: 'var(--ok)', fontWeight: 600,
        }}>
          <Icon name="lock" size={13} color="var(--ok)" />
          Processed privately · Yours alone
        </div>

        <h1 style={{
          fontFamily: 'var(--ff)', fontWeight: 800, lineHeight: 1.08,
          letterSpacing: '-0.04em', marginBottom: '1.1rem',
          fontSize: 'clamp(2.2rem, 5.5vw, 3.6rem)',
        }}>
          Upload your{' '}
          <br />
          <span style={{
            background: 'var(--accent-grad-shine)',
            backgroundSize: '200% 200%', animation: 'borderFlow 5s linear infinite',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            lab report
          </span>
        </h1>

        <p style={{ fontSize: '1.05rem', color: 'var(--txt2)', maxWidth: 500, margin: '0 auto', lineHeight: 1.8 }}>
          Get a clear, simple explanation of what each result means — CBC, lipid, thyroid, HbA1c, and more. Your first 2 checks are free.
        </p>
      </div>

      {/* Drop Zone */}
      <div
        className="glass-panel-elevated"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${drag ? 'var(--accent)' : 'var(--bd2)'}`,
          borderRadius: 'var(--rxl)', padding: '3.5rem 2.5rem', textAlign: 'center',
          cursor: 'pointer', background: drag ? 'var(--glow2)' : 'var(--surf)',
          transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
          transform: drag ? 'scale(1.02)' : 'scale(1)',
          boxShadow: drag ? 'var(--shadow-glow-lg)' : 'var(--shadow-lg)',
        }}
      >
        <div className="animate-float" style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1.4rem',
          background: 'linear-gradient(135deg, rgba(13,148,136,0.14), rgba(45,212,191,0.04))', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(13,148,136,0.28)',
          boxShadow: drag ? '0 0 40px var(--glow)' : '0 10px 20px rgba(0,0,0,0.2)',
          transition: 'all 0.3s',
        }}>
          <Icon name="upload" size={32} color="var(--accent)" sw={1.5} />
        </div>

        <h3 style={{ fontFamily: 'var(--ff)', fontSize: '1.25rem', fontWeight: 700, marginBottom: 6 }}>
          {drag ? 'Release to analyze' : 'Drop your medical report here'}
        </h3>
        <p style={{ color: 'var(--txt3)', marginBottom: '1.4rem', fontSize: 13.5 }}>
          {cap ? 'or use the buttons below' : 'or click to browse files'}
        </p>

        {cap && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.2rem' }}>
            <Btn variant="primary" icon="camera" onClick={handleNativeCamera} style={{ minWidth: 140, justifyContent: 'center' }}>
              Take Photo
            </Btn>
            <Btn variant="ghost" icon="image" onClick={handleNativeGallery} style={{ minWidth: 140, justifyContent: 'center' }}>
              From Gallery
            </Btn>
            <Btn variant="ghost" icon="file" onClick={handleNativeDocument} style={{ minWidth: 140, justifyContent: 'center' }}>
              Browse Files
            </Btn>
          </div>
        )}

        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap' }}>
          {FORMATS.map(f => (
            <span key={f} style={{
              padding: '4px 13px', borderRadius: 100,
              border: '1px solid var(--bd)', fontSize: 11.5, color: 'var(--txt2)', fontFamily: 'var(--fm)',
            }}>{f}</span>
          ))}
        </div>
        <input
          ref={inputRef} type="file" accept={ACCEPTED.join(',')}
          style={{ display: 'none' }} onChange={handlePick}
        />
      </div>

      {/* File preview pill */}
      {preview && (
        <div className="animate-scaleIn" style={{
          marginTop: 10, padding: '10px 16px',
          background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)',
          borderRadius: 'var(--rm)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <Icon name="file" size={14} color="var(--ok)" />
          <span style={{ flex: 1, color: 'var(--txt2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {preview.name}
          </span>
          <span style={{ color: 'var(--txt3)', fontSize: 11, fontFamily: 'var(--fm)', flexShrink: 0 }}>
            {(preview.size / 1024).toFixed(0)} KB
          </span>
          <Icon name="check_circle" size={15} color="var(--ok)" />
        </div>
      )}

      {/* Profile accordion */}
      <div style={{ marginTop: '1rem' }}>
        {/* Who is this report for? — family profiles */}
        {profiles.length > 0 && (
          <div style={{ marginBottom: 8, padding: '12px 16px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)' }}>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="user" size={13} /> Who is this report for?
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
              {profiles.map(p => (
                <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => selectPerson(p)}
                    style={{ padding: '6px 13px', borderRadius: 100, cursor: 'pointer', fontSize: 12.5, fontWeight: activeId === p.id ? 700 : 500,
                      background: activeId === p.id ? 'var(--accent)' : 'var(--surf2)',
                      border: `1px solid ${activeId === p.id ? 'var(--accent)' : 'var(--bd2)'}`,
                      color: activeId === p.id ? '#fff' : 'var(--txt2)' }}>
                    {p.name}{p.age ? ` · ${p.age}` : ''}
                  </button>
                  <button onClick={() => removePerson(p.id)} title="Remove" style={{ background: 'none', border: 'none', color: 'var(--txt4)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowProfile(s => !s)}
          style={{
            width: '100%', padding: '12px 18px', background: 'var(--surf)',
            border: '1px solid var(--bd)', borderRadius: 'var(--rm)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            color: 'var(--txt2)', fontSize: 13.5, cursor: 'pointer', transition: 'all 0.18s',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="user" size={15} />
            Add profile for personalized insights
            <span style={{ color: 'var(--txt3)', fontSize: 12, fontWeight: 400 }}>(optional)</span>
          </span>
          <Icon name={showProfile ? 'chevup' : 'chevdown'} size={14} color="var(--txt3)" />
        </button>

        {showProfile && (
          <div className="animate-scaleIn" style={{
            marginTop: 8, padding: '1.4rem', background: 'var(--surf)',
            border: '1px solid var(--bd)', borderRadius: 'var(--rm)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Input label="Age" type="number" placeholder="32"
                value={profile.age} onChange={e => setProfile(p => ({ ...p, age: e.target.value }))} />
              <Select
                label="Gender"
                value={profile.gender}
                onChange={e => setProfile(p => ({ ...p, gender: e.target.value }))}
                options={[
                  { value: '', label: 'Select...' },
                  { value: 'male', label: 'Male' },
                  { value: 'female', label: 'Female' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <div style={{ gridColumn: '1/-1' }}>
                <Input label="Known Conditions" placeholder="diabetes, hypertension, thyroid..."
                  value={profile.conditions} onChange={e => setProfile(p => ({ ...p, conditions: e.target.value }))} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <Input label="Current Medications" placeholder="metformin, aspirin, levothyroxine..."
                  value={profile.medications} onChange={e => setProfile(p => ({ ...p, medications: e.target.value }))} />
              </div>
            </div>

            {/* Save as a family profile for reuse */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--bd)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                placeholder="Save as… (e.g. Self, Mom, Aarav)"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveCurrentPerson()}
                style={{ flex: 1, minWidth: 180, padding: '9px 13px', borderRadius: 'var(--rm)', fontSize: 13, border: '1px solid var(--bd)', background: 'var(--surf2)', color: 'var(--txt)' }}
              />
              <Btn variant="ghost" size="sm" icon="user" onClick={saveCurrentPerson} disabled={!saveName.trim()}>
                Save profile
              </Btn>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--txt4)', marginTop: 8 }}>
              Saved profiles stay right here on your device — handy for checking reports for the whole family.
            </p>
          </div>
        )}
      </div>

      {/* Feature cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: '1.75rem' }}>
        {[
          { icon: 'activity', title: 'Simple language',   desc: 'Every value explained in simple words', color: 'var(--accent)'        },
          { icon: 'flask',    title: 'Standard ranges',   desc: 'Compared to age & gender reference ranges', color: 'var(--accent-purple)' },
          { icon: 'shield',   title: 'Safe & supportive',  desc: 'Here to inform and reassure — never to diagnose', color: 'var(--ok)'            },
        ].map(({ icon, title, desc, color }) => (
          <div key={title} style={{
            padding: '1.1rem', background: 'var(--surf)',
            border: '1px solid var(--bd)', borderRadius: 'var(--rl)', textAlign: 'center',
            transition: 'var(--transition-fast)',
          }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
              <Icon name={icon} size={20} color={color} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 11.5, color: 'var(--txt3)', lineHeight: 1.55 }}>{desc}</div>
          </div>
        ))}
      </div>

      {/* History quick access */}
      {history.length > 0 && (
        <button
          onClick={onShowHistory}
          style={{
            width: '100%', marginTop: '1rem', padding: '12px 16px',
            background: 'var(--surf)', border: '1px solid var(--bd)',
            borderRadius: 'var(--rm)', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.18s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13.5, color: 'var(--txt2)' }}>
            <Icon name="history" size={15} color="var(--accent)" />
            {history.length} previous report{history.length !== 1 ? 's' : ''} in history
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Badge style={{ fontSize: 9.5 }}>{history.length}</Badge>
            <Icon name="chevright" size={13} color="var(--txt3)" />
          </div>
        </button>
      )}
    </div>
  );
}
