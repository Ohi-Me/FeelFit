'use client';
import React, { useState } from 'react';
import { lookupTerm } from '@/lib/glossary';

/**
 * Wraps a medical term with a plain-language tooltip. If no definition exists,
 * it renders the text plainly (no dotted underline) so nothing looks broken.
 * Hover on desktop, tap on mobile.
 */
export function Term({ children, define }: { children: string; define?: string }) {
  const [open, setOpen] = useState(false);
  const definition = define ?? lookupTerm(children);
  if (!definition) return <>{children}</>;

  return (
    <span
      style={{ position: 'relative', display: 'inline', cursor: 'help', borderBottom: '1px dotted var(--txt3)' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
      tabIndex={0}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
            width: 'max-content', maxWidth: 260, padding: '10px 12px', zIndex: 200,
            background: 'var(--surf)', border: '1px solid var(--bd2)', borderRadius: 'var(--rm)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.28)', fontSize: 12.5, lineHeight: 1.6,
            color: 'var(--txt2)', fontWeight: 400, whiteSpace: 'normal', textAlign: 'left', cursor: 'default',
          }}
        >
          {definition}
        </span>
      )}
    </span>
  );
}
