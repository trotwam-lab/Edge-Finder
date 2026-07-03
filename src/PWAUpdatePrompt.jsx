import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

// Surfaces a "new version" toast when the service worker has a fresh build
// waiting, and — just as important — actively re-checks for updates whenever
// the app regains focus. Installed PWAs (iOS especially) otherwise keep
// serving whatever bundle they cached the first time, so a comp/Pro user can
// sit on a months-old client that talks to the API the old way and shows the
// wrong tier. registerType is 'prompt', so nothing applies until the user
// taps Update (which calls skipWaiting + reloads).
export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;
      const check = () => registration.update().catch(() => {});
      // Poll hourly for long-lived sessions...
      const timer = setInterval(check, 60 * 60 * 1000);
      // ...and immediately whenever the user returns to the app, which is the
      // moment an installed PWA would otherwise skip its update check.
      const onVisible = () => {
        if (document.visibilityState === 'visible') check();
      };
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', check);
      // Best-effort cleanup; this component lives for the app's lifetime.
      window.addEventListener('beforeunload', () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisible);
        window.removeEventListener('focus', check);
      });
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        bottom: 'calc(90px + env(safe-area-inset-bottom, 0px))',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        maxWidth: 'min(92vw, 420px)',
        padding: '12px 14px',
        borderRadius: '12px',
        border: '1px solid var(--ef-accent-border, rgba(0,200,255,0.32))',
        background: 'var(--ef-surface-solid, #111827)',
        boxShadow: '0 18px 50px rgba(2, 6, 23, 0.45)',
        fontFamily: 'var(--ef-font-body, sans-serif)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ef-text, #e6edf6)' }}>
          A new version of EdgeFinder is ready
        </div>
        <div style={{ fontSize: '11px', color: 'var(--ef-text-muted, #8b9bb4)', marginTop: '2px' }}>
          Reload to get the latest board, tools, and account fixes.
        </div>
      </div>
      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          flexShrink: 0,
          padding: '8px 14px',
          borderRadius: '8px',
          border: 'none',
          background: 'var(--ef-gradient, linear-gradient(135deg, #7b5cff, #00c8ff))',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'var(--ef-font-body, sans-serif)',
        }}
      >
        Update
      </button>
      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Dismiss update notice"
        style={{
          flexShrink: 0,
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid var(--ef-border, rgba(125,141,168,0.16))',
          background: 'transparent',
          color: 'var(--ef-text-muted, #8b9bb4)',
          fontSize: '12px',
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ✕
      </button>
    </div>
  );
}
