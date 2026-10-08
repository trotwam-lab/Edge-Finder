// Public, read-only verified record at /r/<handle>. No sign-in needed. The
// integrity check runs here, in the viewer's own browser, so they don't have
// to take EdgeFinder's word for it either.
import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Info } from 'lucide-react';
import Logo from './Logo.jsx';
import { activeBets, verifyChain } from '../utils/ledger.js';
import {
  ChainAlert, EntryRow, HowVerificationWorks, IntegrityBadge, RecordStats, formatWhen, linkButton, panelStyle,
} from './verified/RecordParts.jsx';

export default function PublicRecord({ handle }) {
  const [state, setState] = useState({ status: 'loading' });
  const [showHow, setShowHow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    document.title = `@${handle} · Verified betting record · EdgeFinder`;
    (async () => {
      try {
        const res = await fetch(`/api/verified-bets?handle=${encodeURIComponent(handle)}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.status === 404) { setState({ status: 'not_found' }); return; }
        if (!res.ok || !data?.available || !Array.isArray(data.events)) { setState({ status: 'error' }); return; }
        const chain = await verifyChain(data.events);
        if (!cancelled) setState({ status: 'ready', ...data, chain });
      } catch {
        if (!cancelled) setState({ status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  const entries = useMemo(
    () => (state.events ? activeBets(state.events).sort((a, b) => b.seq - a.seq) : []),
    [state.events],
  );
  const now = Date.now();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ef-bg)', color: 'var(--ef-text)', fontFamily: 'var(--ef-font-body)' }}>
      <header style={{ padding: '14px 16px', borderBottom: '1px solid var(--ef-border)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <a href="/" aria-label="EdgeFinder home" style={{ textDecoration: 'none', color: 'inherit' }}><Logo size={30} /></a>
          <a href="/" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--ef-cyan)', textDecoration: 'none' }}>Track your own record →</a>
        </div>
      </header>

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '20px 16px 48px' }}>
        {state.status === 'loading' && <div className="ef-skeleton" role="status" aria-label="Loading record" style={{ height: '180px', borderRadius: '12px' }} />}

        {state.status === 'not_found' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <h1 style={{ fontSize: '20px', marginBottom: '8px' }}>No public record for @{handle}</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px' }}>The name may be wrong, or its owner stopped sharing.</p>
          </div>
        )}

        {state.status === 'error' && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#fca5a5', fontSize: '13px' }}>
            Couldn't load this record right now. Please try again in a minute.
          </div>
        )}

        {state.status === 'ready' && (
          <>
            <h1 style={{ fontSize: '22px', margin: '0 0 4px' }}>@{state.handle}</h1>
            <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
              Verified betting record{state.since ? ` · shared since ${formatWhen(state.since)}` : ''}
            </div>

            <section style={panelStyle} aria-label="Verified record">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#86efac', letterSpacing: '0.06em' }}>
                  <ShieldCheck size={15} /> VERIFIED BY EDGEFINDER
                </div>
                <IntegrityBadge chain={state.chain} />
              </div>
              <ChainAlert chain={state.chain} />
              {state.stats?.total === 0 && (
                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>No verified bets yet.</div>
              )}
              <RecordStats stats={state.stats} audience="public" />
              <button type="button" onClick={() => setShowHow(v => !v)} style={{ ...linkButton, marginTop: '10px' }} aria-expanded={showHow}>
                <Info size={12} /> How this record is verified
              </button>
              {showHow && <HowVerificationWorks audience="public" />}
            </section>

            {entries.length > 0 && (
              <section aria-label="Verified bets" style={{ ...panelStyle, background: 'rgba(15,23,42,0.6)', borderColor: 'var(--ef-border)' }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.06em', marginBottom: '4px' }}>
                  ALL {entries.length} VERIFIED BET{entries.length === 1 ? '' : 'S'} · NEWEST FIRST
                </div>
                {entries.map(entry => <EntryRow key={entry.id} entry={entry} now={now} />)}
              </section>
            )}

            <p style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.6 }}>
              Every bet was recorded by EdgeFinder's server before its game started, at a price that was actually on the board. Nothing here can be edited or deleted. Stakes are private.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
