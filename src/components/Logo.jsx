import React, { useId } from 'react';

// The single source of truth for the EdgeFinder brand mark.
// The mark is a rising line that breaks upward through the market with the
// "found edge" highlighted as a glowing point — the product promise in one glyph.
// Use <Logo /> everywhere instead of ad-hoc icon tiles so the brand stays
// consistent across the app shell, landing page, and auth surfaces.

export function LogoMark({ size = 34 }) {
  // Unique per instance — the mark can appear more than once on a page
  // (header + sign-in popup) and SVG gradient ids must not collide.
  const gradId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="EdgeFinder logo"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#7b5cff" />
          <stop offset="1" stopColor="#00c8ff" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="#0d1117" stroke={`url(#${gradId})`} strokeWidth="2.5" />
      <path d="M14 43 L25 34 L33 38.5 L47 19" fill="none" stroke={`url(#${gradId})`} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="47" cy="19" r="6.5" fill="none" stroke="#00c8ff" strokeWidth="2" opacity="0.45" />
      <circle cx="47" cy="19" r="3.4" fill="#00c8ff" />
    </svg>
  );
}

export default function Logo({ size = 34, withWordmark = true, tagline = null }) {
  if (!withWordmark) return <LogoMark size={size} />;
  const wordSize = Math.round(size * 0.56);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: Math.max(8, Math.round(size * 0.3)) }}>
      <LogoMark size={size} />
      <div style={{ lineHeight: 1 }}>
        <div style={{
          fontFamily: 'var(--ef-font-display)',
          fontWeight: 700,
          fontSize: `${wordSize}px`,
          letterSpacing: '-0.02em',
          color: 'var(--ef-text)',
          whiteSpace: 'nowrap',
        }}>
          Edge
          <span style={{
            background: 'var(--ef-gradient)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}>Finder</span>
        </div>
        {tagline && (
          <div style={{
            marginTop: '4px',
            fontFamily: 'var(--ef-font-mono)',
            fontSize: `${Math.max(8, Math.round(size * 0.26))}px`,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--ef-text-dim)',
          }}>{tagline}</div>
        )}
      </div>
    </div>
  );
}
