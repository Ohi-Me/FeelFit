'use client';
import React from 'react';

/**
 * FeelFit brand mark — a clean, modern "F" monogram with an upward leaf flick,
 * echoing growth and vitality. Renders crisply at any size.
 * `glyph` colours the F; pass a gradient id via CSS if needed (default solid).
 */
export function BrandMark({ size = 16, glyph = '#fff', bg = '#111111' }: { size?: number; glyph?: string; bg?: string }) {
  void bg;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {/* Blocky F */}
      <path
        d="M6 3.4h12.6v4.1H10v3.1h7.4v4.1H10V20.6H6V3.4z"
        fill={glyph}
      />
      {/* upward leaf flick off the top — a hint of growth */}
      <path
        d="M16.4 3.4c2.4 0 4.2 1.1 4.2 1.1s-1 2.7-3.1 3.4c-1.1.4-2.1.1-2.1.1s-.3-1.1.1-2.1c.4-1.1 1-2.5.9-2.6z"
        fill={glyph}
        opacity={0.55}
      />
    </svg>
  );
}
