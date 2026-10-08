import React, { useMemo, useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, RefreshCw, Info, Link2, Copy, Check } from 'lucide-react';
import {
  AnchorNote, ChainAlert, EntryRow, HowVerificationWorks, IntegrityBadge, RecordStats, linkButton, mono, panelStyle,
  useAnchorCheck,
} from './verified/RecordParts.jsx';

function suggestedHandle() {
  try {
    const saved = JSON.parse(localStorage.getItem('edgefinder_community_handle') || '""');
    return String(saved || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  } catch {
    return '';
  }
}

export function publicRecordUrl(handle) {
  return `${window.location.origin}/r/${handle}`;
}

function SharingControls({ sharing, onUpdate }) {
  const [handle, setHandle] = useState(() => sharing?.handle || suggestedHandle());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const submit = async (enabled) => {
    if (enabled && !window.confirm('Share your verified record publicly? Anyone with the link can see your verified bets, prices and results. Stakes, your email and your personal tracker are never shown. You can stop sharing at any time.')) return;
    setBusy(true);
    setError('');
    const result = await onUpdate({ enabled, handle });
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(publicRecordUrl(sharing.handle));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Couldn\'t copy. Select the link and copy it manually.');
    }
  };

  const input = {
    padding: '7px 10px', borderRadius: '6px', border: '1px solid rgba(71,85,105,0.4)',
    background: 'rgba(15,23,42,0.7)', color: '#e2e8f0', fontSize: '12px', ...mono, minWidth: 0, flex: '1 1 140px',
  };
  const button = (primary) => ({
    padding: '7px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, cursor: busy ? 'progress' : 'pointer',
    border: primary ? '1px solid rgba(34,197,94,0.45)' : '1px solid rgba(71,85,105,0.4)',
    background: primary ? 'rgba(34,197,94,0.18)' : 'transparent', color: primary ? '#86efac' : '#cbd5e1', fontFamily: 'inherit',
  });

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(71,85,105,0.25)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#e2e8f0', marginBottom: '6px' }}>
        <Link2 size={13} /> Public link
      </div>
      {sharing?.enabled ? (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <a href={publicRecordUrl(sharing.handle)} target="_blank" rel="noopener" style={{ ...mono, fontSize: '12px', color: '#7dd3fc', wordBreak: 'break-all' }}>
            {publicRecordUrl(sharing.handle).replace(/^https?:\/\//, '')}
          </a>
          <button type="button" onClick={copy} style={button(true)} aria-label="Copy public link">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={() => submit(false)} disabled={busy} style={button(false)}>Stop sharing</button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', lineHeight: 1.6 }}>
            Prove your record: share a link that shows your verified bets and results, with the integrity check running in the viewer's browser. Stakes are never shown.
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20))}
              placeholder="your_handle"
              aria-label="Public handle"
              style={input}
            />
            <button type="button" onClick={() => submit(true)} disabled={busy || handle.length < 3} style={button(true)}>
              {busy ? 'Saving…' : 'Share publicly'}
            </button>
          </div>
        </>
      )}
      {error && <div role="alert" style={{ fontSize: '11px', color: '#f87171', marginTop: '6px' }}>{error}</div>}
    </div>
  );
}

export default function VerifiedRecord({ ledger }) {
  const [showEntries, setShowEntries] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const now = Date.now();
  const anchor = useAnchorCheck(ledger?.ledgerId, ledger?.events);

  const entries = useMemo(
    () => [...(ledger?.byClientId?.values() || [])].sort((a, b) => b.seq - a.seq),
    [ledger?.byClientId],
  );

  if (!ledger || ledger.status === 'idle') return null;
  if (ledger.status === 'unavailable') return null; // server not configured (local dev)

  const s = ledger.stats;

  return (
    <section style={panelStyle} aria-label="Verified record">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#86efac', letterSpacing: '0.06em' }}>
            <ShieldCheck size={15} /> VERIFIED RECORD
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
            Server-timestamped before kick-off, priced against the live board, graded from final scores. Can't be edited or deleted.
          </div>
        </div>
        <IntegrityBadge chain={ledger.chain} />
      </div>

      <ChainAlert chain={ledger.chain} />
      <AnchorNote result={anchor} />

      {ledger.status === 'error' && (
        <div style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '10px' }}>
          Couldn't load your verified record. <button type="button" onClick={ledger.refresh} style={{ ...linkButton, color: '#f8fafc' }}>Try again</button>
        </div>
      )}

      {ledger.status === 'loading' && <div className="ef-skeleton" style={{ height: '64px', borderRadius: '8px' }} />}

      {ledger.status !== 'loading' && s.total === 0 && s.voided === 0 && (
        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
          No verified bets yet. Log a moneyline, spread or total from the board before the game starts and it's verified automatically.
        </div>
      )}

      <RecordStats stats={s} audience="owner" />

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px' }}>
        {entries.length > 0 && (
          <button type="button" onClick={() => setShowEntries(v => !v)} style={linkButton} aria-expanded={showEntries}>
            {showEntries ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {showEntries ? 'Hide' : 'Show'} all {entries.length} verified bet{entries.length === 1 ? '' : 's'}
          </button>
        )}
        <button type="button" onClick={() => setShowHow(v => !v)} style={linkButton} aria-expanded={showHow}>
          <Info size={12} /> How verification works
        </button>
        <button type="button" onClick={ledger.refresh} disabled={ledger.status === 'loading' || ledger.status === 'refreshing'} style={linkButton} aria-label="Refresh verified record">
          <RefreshCw size={12} style={{ animation: ledger.status === 'refreshing' ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {showHow && <HowVerificationWorks audience="owner" />}

      {showEntries && (
        <div style={{ marginTop: '10px' }}>
          {entries.map(entry => (
            <EntryRow key={entry.id} entry={entry} now={now} onVoid={ledger.voidVerifiedBet} />
          ))}
        </div>
      )}

      {ledger.status === 'ready' && <SharingControls sharing={ledger.sharing} onUpdate={ledger.updateSharing} />}
    </section>
  );
}
