import React from 'react';
import Logo from './Logo.jsx';
import EdgeReceipts from './EdgeReceipts.jsx';

// Public, no-login-required receipts page (served at /receipts).
// This is the marketing engine: a shareable URL where anyone — including
// betting-Twitter skeptics — can verify the graded record of every edge the
// scan flagged, misses included. The only CTA is into the app.
export default function PublicReceipts() {
  const goToApp = () => { window.location.href = '/'; };

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(1100px 480px at 85% -10%, rgba(123, 92, 255, 0.14), transparent 60%),
        radial-gradient(900px 420px at 8% -6%, rgba(0, 200, 255, 0.1), transparent 55%),
        var(--ef-bg, #070b14)`,
      color: 'var(--ef-text, #e2e8f0)',
      fontFamily: 'var(--ef-font-body, system-ui)',
      padding: '24px 16px calc(40px + env(safe-area-inset-bottom, 0px))',
    }}>
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '22px', flexWrap: 'wrap' }}>
          <Logo size={36} tagline="Public Track Record" />
          <button onClick={goToApp} style={{
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            background: 'var(--ef-gradient, linear-gradient(135deg, #6366f1, #8b5cf6))', color: '#fff',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Open EdgeFinder →
          </button>
        </header>

        <div style={{ marginBottom: '18px' }}>
          <h1 style={{ fontSize: '22px', margin: '0 0 8px', color: '#f8fafc' }}>
            Yesterday&apos;s Receipts — every edge, graded in public.
          </h1>
          <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
            Each day EdgeFinder&apos;s scan flags +EV edges across sportsbooks. The next day, every one of
            them is graded here against the market&apos;s no-vig closing line — hits and misses, no
            cherry-picking, no deleted picks. This page is public on purpose: verify us before you pay us.
          </p>
        </div>

        <EdgeReceipts onNavigate={goToApp} />

        <div style={{
          padding: '16px', borderRadius: '14px', marginTop: '4px',
          background: 'rgba(17,24,39,0.62)', border: '1px solid rgba(71,85,105,0.3)',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>
            Why closing line value?
          </div>
          <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>
            Beating the closing line is the most widely accepted predictor of long-term betting profit.
            If the price we flagged is still better than where the market closed, the edge was real —
            regardless of whether that single bet won or lost. That&apos;s the standard we grade ourselves
            against, every day, automatically.
          </p>
          <button onClick={goToApp} style={{
            marginTop: '14px', padding: '11px 20px', borderRadius: '8px', border: 'none',
            background: 'var(--ef-gradient, linear-gradient(135deg, #6366f1, #8b5cf6))', color: '#fff',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            See today&apos;s live edges — free to start
          </button>
        </div>

        <footer style={{ textAlign: 'center', padding: '20px 0 0', fontSize: '10px', color: '#475569' }}>
          EdgeFinder · Live odds intelligence · <a href="https://x.com/TROTWAM" target="_blank" rel="noopener" style={{ color: '#6366f1', textDecoration: 'none' }}>@TROTWAM</a>
        </footer>
      </div>
    </div>
  );
}
