'use client';
import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Card, Badge, Btn } from '@/components/ui/index';
import { motion, AnimatePresence, Stagger, StaggerItem, Reveal } from '@/components/ui/motion';
import { SPECIALIZATIONS_V2, SPEC_ICONS } from '@/lib/doctorDB';
import { getCurrentPosition, openLink, haptic, isCapacitor } from '@/lib/native';
import type { DoctorResult } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiveDoctor {
  place_id?: string;
  name: string;
  specialization: string;
  clinic: string;
  address: string;
  phone: string;
  website?: string;
  rating: number;
  review_count: number;
  distance_km: number;
  availability: string;
  is_open?: boolean | null;
  maps_url?: string;
  photo_url?: string;
  review_snippets?: string[];
  review_summary?: string;
  score: number;
  fees_inr?: string;
  languages?: string[];
  verified?: boolean;
  source?: string;
  // legacy fields
  experience_years?: number;
}

interface InsightsPanel {
  total_found: number;
  location: string;
  avg_rating: number;
  top_specializations: string[];
  open_now_count?: number;
  verified_count?: number;
  radius_km?: number;
}

// ── Star Rating ───────────────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={11} height={11} viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? '#f59e0b' : 'var(--bd2)'}
          stroke={i <= Math.round(rating) ? '#f59e0b' : 'var(--bd2)'} strokeWidth={1.5}>
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </div>
  );
}

// ── Score Bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div style={{ height: 3, background: 'var(--bd)', borderRadius: 2, overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${score * 100}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent)88)', borderRadius: 2 }}
      />
    </div>
  );
}

// ── Skeleton Loader ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass-panel-elevated" style={{ borderRadius: 'var(--rl)', padding: '1.4rem' }}>
      {[80, 60, 90, 50].map((w, i) => (
        <div key={i} style={{
          height: i === 0 ? 18 : 13,
          width: `${w}%`,
          background: 'var(--surf2)',
          borderRadius: 6,
          marginBottom: i === 3 ? 0 : 10,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

// ── Doctor Card ───────────────────────────────────────────────────────────────

function DoctorCard({ doctor, onSelect }: { doctor: LiveDoctor; onSelect: (d: LiveDoctor) => void }) {
  const isOpen = doctor.is_open;
  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.012 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      onClick={() => onSelect(doctor)}
      className="glass-panel-elevated motion-card"
      style={{ borderRadius: 'var(--rl)', padding: '1.4rem', cursor: 'pointer', position: 'relative' }}
    >
      {/* AI Score Badge */}
      {doctor.score >= 0.8 && (
        <div style={{
          position: 'absolute', top: 12, right: 12,
          background: 'var(--ok)',
          borderRadius: 100, padding: '3px 9px', fontSize: 10, fontWeight: 700, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ✨ Top Pick
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Photo + name row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            {doctor.photo_url ? (
              <img src={doctor.photo_url} alt={doctor.name}
                style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--bd2)', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--surf2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                {SPEC_ICONS[doctor.specialization] || '⚕️'}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <h3 style={{ fontFamily: 'var(--ff)', fontWeight: 800, fontSize: '0.97rem', color: 'var(--txt)' }}>{doctor.name}</h3>
                {doctor.verified && (
                  <span title="Verified on Google Maps" style={{ color: 'var(--accent)' }}>
                    <Icon name="check_circle" size={13} color="var(--accent)" />
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--accent)', fontSize: 12.5, fontWeight: 600 }}>
                {SPEC_ICONS[doctor.specialization] || '⚕️'} {doctor.specialization}
              </p>
            </div>
          </div>
          <p style={{ color: 'var(--txt3)', fontSize: 12 }}>{doctor.clinic}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
          {doctor.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 100, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <span style={{ color: '#f59e0b', fontWeight: 800, fontSize: 13.5 }}>{doctor.rating.toFixed(1)}</span>
              <Icon name="star" size={11} color="#f59e0b" />
            </div>
          )}
          {doctor.review_count > 0 && (
            <span style={{ fontSize: 11, color: 'var(--txt3)' }}>{doctor.review_count.toLocaleString('en-IN')} reviews</span>
          )}
          {doctor.distance_km > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--txt3)' }}>{doctor.distance_km.toFixed(1)} km</span>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: '0.9rem' }}>
        {[
          { icon: 'map', text: doctor.address },
          { icon: 'clock', text: doctor.availability },
        ].filter(r => r.text).map(({ icon, text }) => (
          <div key={icon} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 12.5 }}>
            <Icon name={icon} size={12} color="var(--txt3)" />
            <span style={{ color: 'var(--txt2)', lineHeight: 1.4 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* AI review summary */}
      {doctor.review_summary && (
        <div style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--surf)', border: '1px solid var(--bd)', marginBottom: 10, fontSize: 12, color: 'var(--txt2)', lineHeight: 1.5 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 5 }}>💬</span>
          {doctor.review_summary}
        </div>
      )}

      {/* Score bar */}
      {doctor.score > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--txt3)', marginBottom: 4 }}>
            <span>AI Score</span>
            <span>{Math.round(doctor.score * 100)}%</span>
          </div>
          <ScoreBar score={doctor.score} />
        </div>
      )}

      {/* Open status + CTA */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {isOpen === true && (
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: 'rgba(16,217,160,0.1)', border: '1px solid var(--ok-bd)', color: 'var(--ok)', fontWeight: 600 }}>
              🟢 Open Now
            </span>
          )}
          {isOpen === false && (
            <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 100, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 600 }}>
              🔴 Closed
            </span>
          )}
          {doctor.source === 'google_maps' && (
            <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 100, background: 'var(--surf2)', border: '1px solid var(--bd)', color: 'var(--txt3)' }}>
              📍 Google Maps
            </span>
          )}
        </div>
        <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600 }}>View details →</span>
      </div>
    </motion.div>
  );
}

// ── Doctor Detail Modal ────────────────────────────────────────────────────────

function DoctorDetail({ doctor, onClose }: { doctor: LiveDoctor; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 30 }}
        onClick={e => e.stopPropagation()}
        className="glass-panel-elevated"
        style={{ borderRadius: 'var(--rl)', padding: '2rem', maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 800, fontSize: '1.2rem', marginBottom: 4 }}>{doctor.name}</h2>
            <p style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 13.5 }}>
              {SPEC_ICONS[doctor.specialization] || '⚕️'} {doctor.specialization}
            </p>
            <p style={{ color: 'var(--txt3)', fontSize: 12.5, marginTop: 2 }}>{doctor.clinic}</p>
          </div>
          <button onClick={onClose} style={{ background: 'var(--surf2)', border: '1px solid var(--bd)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: 'var(--txt2)', fontSize: 13 }}>✕</button>
        </div>

        {/* Rating section */}
        {doctor.rating > 0 && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', background: 'var(--surf)', borderRadius: 10, marginBottom: '1rem' }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#f59e0b' }}>{doctor.rating.toFixed(1)}</span>
            <div>
              <StarRating rating={doctor.rating} />
              <p style={{ fontSize: 12, color: 'var(--txt3)', marginTop: 3 }}>{doctor.review_count.toLocaleString('en-IN')} Google reviews</p>
            </div>
          </div>
        )}

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: '1rem' }}>
          {[
            { label: 'Address', value: doctor.address, icon: 'map' },
            { label: 'Distance', value: doctor.distance_km > 0 ? `${doctor.distance_km.toFixed(1)} km away` : 'N/A', icon: 'target' },
            { label: 'Phone', value: doctor.phone, icon: 'phone' },
            { label: 'Fees', value: doctor.fees_inr || 'Contact clinic', icon: 'zap' },
            { label: 'Hours', value: doctor.availability, icon: 'clock' },
          ].map(({ label, value, icon }) => value && (
            <div key={label} style={{ padding: '10px 12px', background: 'var(--surf)', borderRadius: 8, border: '1px solid var(--bd)' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 3 }}>
                <Icon name={icon} size={12} color="var(--accent)" />
                <span style={{ fontSize: 10.5, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.4 }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Review summary */}
        {doctor.review_summary && (
          <div style={{ padding: '12px 14px', background: 'var(--surf)', borderRadius: 10, border: '1px solid var(--bd)', marginBottom: '1rem' }}>
            <p style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 600, marginBottom: 5 }}>💬 AI Review Summary</p>
            <p style={{ fontSize: 13, color: 'var(--txt2)', lineHeight: 1.5 }}>{doctor.review_summary}</p>
          </div>
        )}

        {/* Review snippets */}
        {doctor.review_snippets && doctor.review_snippets.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: 11.5, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Patient Reviews</p>
            {doctor.review_snippets.slice(0, 2).map((snippet, i) => (
              <div key={i} style={{ padding: '10px 14px', background: 'var(--surf)', borderRadius: 8, border: '1px solid var(--bd)', marginBottom: 6, fontSize: 12.5, color: 'var(--txt2)', lineHeight: 1.5 }}>
                "{snippet.slice(0, 180)}{snippet.length > 180 ? '…' : ''}"
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {doctor.phone && doctor.phone !== 'Call via Maps' && (
            <button type="button" onClick={(e) => { e.preventDefault(); haptic('light'); openLink(`tel:${doctor.phone}`); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, background: 'var(--ok)', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', textDecoration: 'none' }}>
              <Icon name="phone" size={13} color="#fff" /> Call
            </button>
          )}
          {doctor.maps_url && (
            <button type="button" onClick={(e) => { e.preventDefault(); haptic('light'); openLink(doctor.maps_url as string); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, background: 'var(--surf)', border: '1px solid var(--bd)', color: 'var(--txt2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Icon name="map" size={13} color="var(--txt2)" /> Directions
            </button>
          )}
          {doctor.website && (
            <button type="button" onClick={(e) => { e.preventDefault(); haptic('light'); openLink(doctor.website as string); }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', borderRadius: 10, background: 'var(--surf)', border: '1px solid var(--bd)', color: 'var(--txt2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Icon name="external" size={13} color="var(--txt2)" /> Website
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Insights Panel ─────────────────────────────────────────────────────────────

function InsightsBanner({ insights, location }: { insights: InsightsPanel; location: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ padding: '1.1rem 1.4rem', background: 'linear-gradient(135deg, var(--glow2), var(--surf))', border: '1px solid var(--accent)', borderRadius: 'var(--rl)', marginBottom: '1.5rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'var(--fm)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            🔍 Healthcare Insights for {location}
          </p>
          <p style={{ fontSize: 13.5, color: 'var(--txt)', fontWeight: 600 }}>
            Found <strong>{insights.total_found}</strong> verified healthcare providers ·{' '}
            Avg Rating <strong>{insights.avg_rating}⭐</strong>
            {insights.open_now_count ? ` · ${insights.open_now_count} open now` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {insights.top_specializations.slice(0, 3).map(s => (
            <span key={s} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 100, background: 'var(--surf)', border: '1px solid var(--bd)', color: 'var(--txt2)' }}>
              {SPEC_ICONS[s] || '⚕️'} {s}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Filter Pill ───────────────────────────────────────────────────────────────

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <motion.button onClick={onClick} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
      style={{ padding: '6px 14px', borderRadius: 100, fontSize: 12.5, fontWeight: active ? 600 : 500, cursor: 'pointer', background: active ? 'var(--ok-bg)' : 'var(--surf)', border: `1px solid ${active ? 'var(--ok)' : 'var(--bd)'}`, color: active ? 'var(--ok)' : 'var(--txt2)', whiteSpace: 'nowrap', transition: 'all 0.16s' }}>
      {label}
    </motion.button>
  );
}

// ── Main DoctorSection ────────────────────────────────────────────────────────

interface DoctorSectionProps {
  doctors?: DoctorResult[];
  specialization?: string;
}

export function DoctorSection({ doctors: initialDoctors, specialization: initialSpec }: DoctorSectionProps) {
  const [locationInput, setLocationInput] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [spec, setSpec] = useState(initialSpec || '');
  const [radiusKm, setRadiusKm] = useState(5);
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState<'score' | 'rating' | 'distance' | 'reviews'>('score');

  const [results, setResults] = useState<LiveDoctor[]>([]);
  const [insights, setInsights] = useState<InsightsPanel | null>(null);
  const [tier, setTier] = useState<'premium' | 'free'>('free');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<LiveDoctor | null>(null);

  const [locLoading, setLocLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoActive, setGeoActive] = useState(false);

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>();

  // Fetch location suggestions
  useEffect(() => {
    clearTimeout(suggestTimer.current);
    if (locationInput.length < 2) { setSuggestions([]); return; }
    suggestTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/doctors/suggest?q=${encodeURIComponent(locationInput)}`);
        if (r.ok) {
          const d = await r.json();
          setSuggestions(d.suggestions || []);
          setShowSuggestions(true);
        }
      } catch (_) {}
    }, 300);
  }, [locationInput]);

  // Search function
  const searchDoctors = useCallback(async (loc: string, coords?: { lat: number; lng: number }) => {
    if (!loc.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);
    setInsights(null);

    try {
      const body: Record<string, unknown> = {
        location: loc.trim(),
        specialization: spec,
        radius_km: radiusKm,
        max_results: 20,
      };
      if (coords) {
        body.user_lat = coords.lat;
        body.user_lng = coords.lng;
      }

      const r = await fetch(`${API_BASE}/api/doctors/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!r.ok) throw new Error(`Server error ${r.status}`);
      const data = await r.json();

      if (data.error) throw new Error(data.error);

      setResults(data.doctors || []);
      setInsights(data.insights || null);
      setTier(data.tier || 'free');
      setLocationQuery(loc);
    } catch (e) {
      setError((e as Error).message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [spec, radiusKm]);

  // Detect user location — native wrapper works on Capacitor + falls back on web.
  const detectLocation = useCallback(async () => {
    haptic('select');
    setLocLoading(true);
    const coords = await getCurrentPosition();
    if (!coords) {
      setError('Could not get location. Please search by city name.');
      setLocLoading(false);
      return;
    }
    setUserCoords(coords);
    setGeoActive(true);
    setLocLoading(false);
    setLocationInput('Near Me');
    await searchDoctors('Near Me (current location)', coords);
  }, [searchDoctors]);

  // Filtered + sorted results
  const displayResults = useMemo(() => {
    let filtered = results;
    if (minRating > 0) filtered = filtered.filter(d => d.rating >= minRating);
    if (spec) filtered = filtered.filter(d =>
      d.specialization.toLowerCase().includes(spec.toLowerCase()) ||
      spec.toLowerCase().includes(d.specialization.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === 'score') return b.score - a.score;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'distance') return a.distance_km - b.distance_km;
      if (sortBy === 'reviews') return b.review_count - a.review_count;
      return 0;
    });
  }, [results, minRating, spec, sortBy]);

  const hasSearched = results.length > 0 || (locationQuery && !loading);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <Reveal>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--ff)', fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', fontWeight: 800, marginBottom: 8 }}>
            Find a doctor near you
          </h2>
          <p style={{ color: 'var(--txt2)', fontSize: 14 }}>
            Search any city, area, PIN code, or landmark in India
          </p>
        </div>
      </Reveal>

      {/* Search Bar */}
      <Reveal delay={0.06}>
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Location Input */}
            <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
                <Icon name="map" size={15} color="var(--txt3)" />
              </span>
              <input
                placeholder="Search city, area, PIN code, or landmark... e.g. Prayagraj, Bandra, 211001"
                value={locationInput}
                onChange={e => { setLocationInput(e.target.value); setShowSuggestions(true); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { setShowSuggestions(false); searchDoctors(locationInput, userCoords || undefined); }
                  if (e.key === 'Escape') setShowSuggestions(false);
                }}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 'var(--rm)', fontSize: 13.5, border: '1.5px solid var(--bd)', background: 'var(--surf)', color: 'var(--txt)' }}
              />
              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 10, zIndex: 100, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4 }}>
                  {suggestions.map(s => (
                    <div key={s} onMouseDown={() => { setLocationInput(s); setShowSuggestions(false); }}
                      style={{ padding: '10px 14px', fontSize: 13.5, cursor: 'pointer', color: 'var(--txt2)', display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surf2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Icon name="map" size={12} color="var(--txt3)" /> {s}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search button */}
            <Btn variant="primary" size="md" loading={loading} onClick={() => searchDoctors(locationInput, userCoords || undefined)} icon="search">
              Search
            </Btn>

            {/* Near Me */}
            <Btn variant="ghost" size="md" loading={locLoading} onClick={detectLocation} icon="target">
              {geoActive ? '📍 Location On' : 'Near Me'}
            </Btn>
          </div>

          {geoActive && (
            <div style={{ fontSize: 12, color: 'var(--ok)', marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
              <Icon name="check_circle" size={12} color="var(--ok)" /> Using your location
            </div>
          )}
        </div>
      </Reveal>

      {/* Specialization Filter */}
      <Reveal delay={0.09}>
        <div style={{ marginBottom: '1.1rem' }}>
          <div style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'var(--fm)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Specialization</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <FilterPill label="All" active={!spec} onClick={() => setSpec('')} />
            {SPECIALIZATIONS_V2.map(s => (
              <FilterPill key={s} label={`${SPEC_ICONS[s] || ''} ${s}`} active={spec === s} onClick={() => setSpec(s === spec ? '' : s)} />
            ))}
          </div>
        </div>
      </Reveal>

      {/* Controls row */}
      <Reveal delay={0.12}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
          {/* Radius */}
          <select value={radiusKm} onChange={e => setRadiusKm(Number(e.target.value))}
            style={{ padding: '9px 13px', borderRadius: 'var(--rm)', fontSize: 13, background: 'var(--surf)', border: '1px solid var(--bd)', color: 'var(--txt2)', cursor: 'pointer' }}>
            <option value={2}>📍 Within 2 km</option>
            <option value={5}>📍 Within 5 km</option>
            <option value={10}>📍 Within 10 km</option>
            <option value={20}>📍 Within 20 km</option>
          </select>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
            style={{ padding: '9px 13px', borderRadius: 'var(--rm)', fontSize: 13, background: 'var(--surf)', border: '1px solid var(--bd)', color: 'var(--txt2)', cursor: 'pointer' }}>
            <option value="score">✨ AI Recommended</option>
            <option value="rating">⭐ Best Rated</option>
            <option value="distance">📍 Nearest First</option>
            <option value="reviews">💬 Most Reviewed</option>
          </select>

          {/* Rating filter */}
          <select value={minRating} onChange={e => setMinRating(Number(e.target.value))}
            style={{ padding: '9px 13px', borderRadius: 'var(--rm)', fontSize: 13, background: 'var(--surf)', border: '1px solid var(--bd)', color: 'var(--txt2)', cursor: 'pointer' }}>
            <option value={0}>Any Rating</option>
            <option value={3.5}>3.5+ ⭐</option>
            <option value={4}>4.0+ ⭐</option>
            <option value={4.5}>4.5+ ⭐⭐</option>
          </select>
        </div>
      </Reveal>

      {/* Error */}
      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: '1rem', fontSize: 13.5, color: '#ef4444' }}>
          ⚠️ {error}
        </motion.div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 13.5, color: 'var(--txt2)' }}>Searching OpenStreetMap for healthcare near <strong>{locationInput}</strong>…</span>
          </motion.div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* Results */}
      {!loading && displayResults.length > 0 && (
        <>
          {/* Premium badge — visible win for paid users (Google ratings + reviews) */}
          {tier === 'premium' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 14px', borderRadius: 100, background: 'var(--askfit-bg)', border: '1px solid var(--askfit-bd)', marginBottom: 12, fontSize: 12.5, color: 'var(--askfit)', fontWeight: 600, width: 'fit-content' }}>
              <Icon name="sparkles" size={13} color="var(--askfit)" />
              Premium results · real ratings & reviews from Google Maps
            </div>
          )}

          {/* Insights panel */}
          {insights && <InsightsBanner insights={insights} location={locationQuery} />}

          {/* Results header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.1rem', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Icon name="stethoscope" size={18} color="var(--accent)" />
              <span style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: '1.05rem' }}>
                {spec ? `${SPEC_ICONS[spec] || ''} ${spec} Specialists` : 'Healthcare Providers'} in {locationQuery}
              </span>
              <Badge color="var(--accent)" bg="var(--glow2)">{displayResults.length} found</Badge>
            </div>
          </div>

          <Stagger style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
            {displayResults.map((doc, i) => (
              <StaggerItem key={doc.place_id || `${doc.name}-${i}`}>
                <DoctorCard doctor={doc} onSelect={setSelected} />
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}

      {/* Empty state after search */}
      {!loading && hasSearched && displayResults.length === 0 && !error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '3.5rem 0', color: 'var(--txt3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <p style={{ fontSize: 14, marginBottom: 8 }}>We couldn’t spot a match for <strong>{locationQuery}</strong> yet — try a nearby area or a broader search.</p>
          <p style={{ fontSize: 13 }}>Try a nearby city, a broader area, or remove the specialization filter</p>
        </motion.div>
      )}

      {/* Initial empty state */}
      {!loading && !hasSearched && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--txt3)' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🗺️</div>
          <h3 style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: '1.1rem', color: 'var(--txt2)', marginBottom: 8 }}>Search any location in India</h3>
          <p style={{ fontSize: 13.5, maxWidth: 400, margin: '0 auto', marginBottom: 20 }}>
            Enter a city like <strong>Prayagraj</strong>, an area like <strong>Bandra West</strong>, a PIN code like <strong>211001</strong>, or a landmark
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['Prayagraj', 'Bandra, Mumbai', 'Civil Lines Lucknow', 'Salt Lake Kolkata', 'Jubilee Hills Hyderabad'].map(loc => (
              <button key={loc} onClick={() => { setLocationInput(loc); searchDoctors(loc); }}
                style={{ padding: '8px 16px', borderRadius: 100, fontSize: 13, cursor: 'pointer', background: 'var(--surf)', border: '1px solid var(--bd)', color: 'var(--txt2)', fontWeight: 500 }}>
                📍 {loc}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Disclaimer */}
      {hasSearched && (
        <Reveal>
          <div style={{ marginTop: '2rem', padding: '14px 18px', background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', fontSize: 12, color: 'var(--txt3)', display: 'flex', gap: 10 }}>
            <Icon name="info" size={14} />
            <span><strong style={{ color: 'var(--txt2)' }}>Data from OpenStreetMap (© OSM contributors).</strong> Coverage and contact details depend on community mapping and may be incomplete. Always call ahead to confirm. FeelFit does not facilitate actual appointments.</span>
          </div>
        </Reveal>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selected && <DoctorDetail doctor={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
