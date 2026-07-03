'use client';
import React, { useState, useEffect, CSSProperties } from 'react';
import { Icon } from './Icon';
import { motion, AnimatePresence, EASE, springSoft, springSnappy } from './motion';

// ── Badge ─────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  style?: CSSProperties;
}
export function Badge({ children, color = 'var(--txt3)', bg = 'var(--surf)', style = {} }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 100,
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em',
      textTransform: 'uppercase' as const, fontFamily: 'var(--fm)',
      color, background: bg, border: `1px solid ${color}35`, whiteSpace: 'nowrap' as const,
      ...style,
    }}>
      {children}
    </span>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
interface CardProps {
  children: React.ReactNode;
  style?: CSSProperties;
  glow?: boolean;
  accentColor?: string;
  hover?: boolean;
  className?: string;
  onClick?: () => void;
}
export function Card({ children, style = {}, glow = false, accentColor, hover = true, className = '', onClick }: CardProps) {
  const glowStyle = glow ? { boxShadow: 'var(--shadow-glow)', borderColor: 'var(--bd2)' } : {};
  const accentStyle = accentColor ? { borderLeft: `3px solid ${accentColor}` } : {};
  return (
    <motion.div
      className={`glass-panel-elevated motion-card ${className}`}
      onClick={onClick}
      whileHover={hover ? { y: -4, scale: 1.005 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      transition={springSoft}
      style={{
        borderRadius: 'var(--rl)', padding: '1.75rem',
        cursor: onClick ? 'pointer' : undefined,
        ...glowStyle, ...accentStyle, ...style,
      }}
    >
      {children}
    </motion.div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
interface SecHeadProps {
  icon: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  color?: string;
}
export function SecHead({ icon, children, right, color = 'var(--accent)' }: SecHeadProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'var(--glow2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon name={icon} size={15} color={color} />
        </div>
        <span style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: '0.95rem' }}>{children}</span>
      </div>
      {right && <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>{right}</div>}
    </div>
  );
}

// ── Collapsible ───────────────────────────────────────────────────────────────
interface CollapseProps {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  headerRight?: React.ReactNode;
}
export function Collapse({ title, icon, children, defaultOpen = false, count, headerRight }: CollapseProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ padding: '1.5rem' }} hover={false}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--glow2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={15} color="var(--accent)" />
          </div>
          <span style={{ fontFamily: 'var(--ff)', fontWeight: 700, fontSize: '0.92rem' }}>{title}</span>
          {count != null && <Badge>{count}</Badge>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {headerRight}
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={springSnappy} style={{ display: 'flex' }}>
            <Icon name="chevdown" size={14} color="var(--txt3)" />
          </motion.div>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ marginTop: '1rem' }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
// On Capacitor (mobile), the Modal auto-upgrades to a bottom sheet that slides
// up from below — much more thumb-friendly than a centered card on a phone.
// On desktop web, it stays as the original centered card.
import { BottomSheet } from './BottomSheet';
interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}
export function Modal({ title, children, onClose, width = 560 }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Capacitor: render as a bottom sheet ──────────────────────────────────
  const [cap, setCap] = useState(false);
  useEffect(() => {
    setCap(typeof document !== 'undefined' && document.documentElement.classList.contains('is-capacitor'));
  }, []);
  if (cap) {
    return (
      <BottomSheet open={true} onClose={onClose} title={title} when={true}>
        {children}
      </BottomSheet>
    );
  }

  // ── Web: render as a centered card ───────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE }}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={springSoft}
        className="ff-modal-shell"
        style={{
          position: 'relative', background: 'var(--bg1)',
          border: '1px solid var(--bd2)', borderRadius: 'var(--rxl)',
          padding: '2rem', maxWidth: width, width: '100%',
          maxHeight: '85vh', overflow: 'auto', boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontFamily: 'var(--ff)', fontWeight: 800, fontSize: '1.15rem' }}>{title}</h2>
          <Btn variant="icon" onClick={onClose} aria-label="Close">
            <Icon name="close" size={15} />
          </Btn>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────
interface BtnProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'> {
  variant?: 'primary' | 'ghost' | 'danger' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: string;
  children?: React.ReactNode;
}
export function Btn({ variant = 'ghost', size = 'md', loading, icon, children, style = {}, disabled, ...rest }: BtnProps) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, fontWeight: 600, fontFamily: 'var(--fb)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', outline: 'none',
    opacity: disabled ? 0.5 : 1,
  };

  const variants: Record<string, CSSProperties> = {
    primary: { background: 'var(--accent)', color: 'var(--bg1)', borderRadius: 'var(--rm)', padding: size === 'lg' ? '13px 28px' : size === 'sm' ? '7px 14px' : '10px 22px', fontSize: size === 'sm' ? 12.5 : 14, boxShadow: 'var(--shadow)' },
    ghost:   { background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', color: 'var(--txt2)', padding: size === 'lg' ? '12px 24px' : size === 'sm' ? '6px 12px' : '9px 18px', fontSize: size === 'sm' ? 12.5 : 13.5 },
    danger:  { background: 'var(--danger-bg)', border: '1px solid var(--danger-bd)', borderRadius: 'var(--rm)', color: 'var(--danger)', padding: '9px 18px', fontSize: 13.5 },
    icon:    { background: 'var(--surf)', border: '1px solid var(--bd)', borderRadius: 'var(--rm)', color: 'var(--txt2)', width: 38, height: 38 },
  };

  return (
    <motion.button
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.03, y: -1 } : undefined}
      whileTap={!disabled ? { scale: 0.96 } : undefined}
      transition={springSnappy}
      style={{ ...base, ...variants[variant], ...style }}
      {...rest}
    >
      {loading ? (
        <motion.svg
          width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
          animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        >
          <circle cx={12} cy={12} r={10} strokeDasharray="31 63" strokeLinecap="round" />
        </motion.svg>
      ) : icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </motion.button>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ height = 20, width = '100%', style = {} }: { height?: number; width?: number | string; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height, width, ...style }} />;
}

// ── Input ─────────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: string;
}
export function Input({ label, icon, style = {}, ...rest }: InputProps) {
  return (
    <div>
      {label && (
        <label style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <Icon name={icon} size={14} color="var(--txt3)" />
          </span>
        )}
        <input
          style={{
            width: '100%', padding: icon ? '10px 14px 10px 38px' : '10px 14px',
            borderRadius: 'var(--rm)', fontSize: 14, ...style
          }}
          {...rest}
        />
      </div>
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}
export function Select({ label, options, style = {}, ...rest }: SelectProps) {
  return (
    <div>
      {label && (
        <label style={{ fontSize: 10.5, color: 'var(--txt3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>
          {label}
        </label>
      )}
      <select style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--rm)', fontSize: 14, ...style }} {...rest}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Toast notification ────────────────────────────────────────────────────────
interface ToastProps { message: string; type?: 'success' | 'error' | 'info'; onClose: () => void; }
export function Toast({ message, type = 'info', onClose }: ToastProps) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'var(--ok)', error: 'var(--danger)', info: 'var(--accent)' };
  const icons  = { success: 'check_circle', error: 'x_circle', info: 'info' };
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={springSoft}
      style={{
        position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 300,
        padding: '12px 18px', background: 'var(--bg1)',
        border: `1px solid ${colors[type]}40`, borderRadius: 'var(--rm)',
        boxShadow: 'var(--shadow-xl)', display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 13.5, maxWidth: 360,
      }}
    >
      <Icon name={icons[type]} size={16} color={colors[type]} />
      <span style={{ color: 'var(--txt2)', flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ color: 'var(--txt3)', fontSize: 16, lineHeight: 1 }}>×</button>
    </motion.div>
  );
}
