import React, { useMemo, useState } from 'react';
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, RefreshCw, Info } from 'lucide-react';
import { closingEvPct } from '../utils/ledger.js';
import { formatOdds, formatPoint } from '../utils/bets.js';

const panel = {
  background: 'linear-gradient(135deg, rgba(34,197,94,0.07), rgba(15,23,42,0.75))',
  border: '1px solid rgba(34,197,94,0.25)',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '16px',
};
const tile = { background: 'rgba(15,23,42,0.6)', borderRadius: '8px', padding: '10px', textAlign: 'center' };
const mono = { fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' };
const linkButton = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
  color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit',
};

const signed = (n, digits = 2, suffix = '') => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`);
const tone = (n) => (n == null ? '#94a3b8' : n > 0 ? '#22c55e' : n < 0 ? '#f87171' : '#e2e8f0');

function pickLabel(e) {
  if (e.marketKey === 'h2h') return `${e.outcomeName} ML`;
  if (e.marketKey === 'spreads') return `${e.outcomeName} ${formatPoint(e.outcomePoint)}`;
  return `${e.outcomeName} ${e.outcomePoint}`;
}

function formatWhen(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function statusOf(e, now) {
  if (e.voided) return { label: 'VOID', color: '#64748b' };
  const r = e.derived?.grade?.result;
  if (r === 'won') return { label: 'WON', color: '#22c55e' };
  if (r === 'lost') return { label: 'LOST', color: '#f87171' };
  if (r === 'push') return { label: 'PUSH', color: '#94a3b8' };
  const start = Date.parse(e.commenceTime);
  if (start > now) return { label: 'PREGAME', color: '#38bdf8' };
  // The score feed only reaches back 3 days; past that we never guess.
  if (now - start > 3 * 24 * 60 * 60 * 1000) return { label: 'UNGRADED', color: '#94a3b8', title: 'No confirmed final score was found, so this bet was never graded. It stays on the record and is counted as pending.' };
  return { label: 'AWAITING FINAL', color: '#f59e0b' };
}

function EntryRow({ entry, now, onVoid }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const status = statusOf(entry, now);
  const clv = closingEvPct(entry);
  const grade = entry.derived?.grade;
  // Mirrors the server rule: an undo for mistakes within 10 minutes, pregame.
  const canVoid = !entry.voided
    && Date.parse(entry.commenceTime) > now
    && now - Date.parse(entry.recordedAt) <= 10 * 60 * 1000;

  const handleVoid = async () => {
    if (!window.confirm('Void this verified bet? Voids are for mistakes: allowed within 10 minutes of logging and before the game starts. The void itself stays on your record permanently.')) return;
    setBusy(true);
    const result = await onVoid(entry.clientBetId);
    setBusy(false);
    if (!result.ok) setMessage(result.message);
  };

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid rgba(71,85,105,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: entry.voided ? '#64748b' : '#e2e8f0', textDecoration: entry.voided ? 'line-through' : 'none' }}>
            {pickLabel(entry)} <span style={{ ...mono, color: '#a5b4fc' }}>{formatOdds(entry.odds)}</span>
            <span style={{ color: '#64748b', fontWeight: 500 }}> · {entry.bookTitle}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>{entry.game}</div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', lineHeight: 1.6 }}>
            Recorded {formatWhen(entry.recordedAt)} (server time) · game {Date.parse(entry.commenceTime) > now ? 'starts' : 'started'} {formatWhen(entry.commenceTime)}
            {entry.priceAdjusted && <> · <span style={{ color: '#f59e0b' }}>you entered {formatOdds(entry.claimedOdds)}; best price on the board was {formatOdds(entry.odds)}, so that's what was recorded</span></>}
            {grade && <> · Final: {grade.awayTeam} {grade.awayScore} @ {grade.homeTeam} {grade.homeScore}</>}
            {clv != null && <> · CLV vs no-vig close <span style={{ ...mono, color: tone(clv) }}>{signed(clv, 1, '%')}</span></>}
          </div>
          <div style={{ ...mono, fontSize: '9px', color: '#475569', marginTop: '3px' }} title={`Entry hash ${entry.hash}\nPrevious ${entry.prevHash}`}>
            #{entry.seq} · {entry.hash?.slice(0, 16)}…
          </div>
          {message && <div role="alert" style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{message}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
          <span title={status.title} style={{ fontSize: '10px', fontWeight: 800, color: status.color, padding: '2px 8px', borderRadius: '4px', background: `${status.color}1f` }}>{status.label}</span>
          {canVoid && (
            <button type="button" onClick={handleVoid} disabled={busy} style={{ ...linkButton, fontSize: '10px', color: '#f87171' }}>
              {busy ? 'Voiding…' : 'Void (mistake, 10 min)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifiedRecord({ ledger }) {
  const [showEntries, setShowEntries] = useState(false);
  const [showHow, setShowHow] = useState(false);
  const now = Date.now();

  const entries = useMemo(
    () => [...(ledger?.byClientId?.values() || [])].sort((a, b) => b.seq - a.seq),
    [ledger?.byClientId],
  );

  if (!ledger || ledger.status === 'idle') return null;
  if (ledger.status === 'unavailable') return null; // server not configured (local dev)

  const s = ledger.stats;
  const chain = ledger.chain;
  const chainBroken = chain && !chain.valid;

  return (
    <section style={panel} aria-label="Verified record">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 800, color: '#86efac', letterSpacing: '0.06em' }}>
            <ShieldCheck size={15} /> VERIFIED RECORD
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
            Server-timestamped before kick-off, priced against the live board, graded from final scores. Can't be edited or deleted.
          </div>
        </div>
        {chain && (
          <div
            role="status"
            title={chainBroken ? chain.reason : 'Every entry\'s fingerprint was recomputed in your browser and links to the one before it.'}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700,
              padding: '4px 8px', borderRadius: '6px',
              color: chainBroken ? '#fca5a5' : '#86efac',
              background: chainBroken ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
            }}
          >
            {chainBroken ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
            {chainBroken ? `Integrity check failed at entry #${chain.brokenAtSeq}` : `Integrity verified · ${chain.checked} entr${chain.checked === 1 ? 'y' : 'ies'}`}
          </div>
        )}
      </div>

      {chainBroken && (
        <div role="alert" style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '12px' }}>
          Entry #{chain.brokenAtSeq}: {chain.reason}. The record no longer matches what was originally written — please contact support.
        </div>
      )}

      {ledger.status === 'error' && (
        <div style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '10px' }}>
          Couldn't load your verified record. <button type="button" onClick={ledger.refresh} style={{ ...linkButton, color: '#f8fafc' }}>Try again</button>
        </div>
      )}

      {(ledger.status === 'loading') && <div className="ef-skeleton" style={{ height: '64px', borderRadius: '8px' }} />}

      {ledger.status !== 'loading' && s.total === 0 && s.voided === 0 && (
        <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>
          No verified bets yet. Log a moneyline, spread or total from the board before the game starts and it's verified automatically.
        </div>
      )}

      {s.total > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '8px' }}>
            {[
              { label: 'Record', value: `${s.wins}-${s.losses}-${s.pushes}`, color: '#e2e8f0', sub: s.pending ? `${s.pending} pending` : 'all graded' },
              { label: 'Flat units', value: signed(s.flatUnits, 2, 'u'), color: tone(s.flatUnits), sub: '1u every bet' },
              { label: 'Flat ROI', value: signed(s.flatRoi, 1, '%'), color: tone(s.flatRoi), sub: s.stakeRoi != null ? `staked ROI ${signed(s.stakeRoi, 1, '%')}` : '' },
              { label: 'Avg CLV', value: signed(s.avgClv, 1, '%'), color: tone(s.avgClv), sub: `${s.clvCount} with a close` },
              { label: 'Beat close', value: s.beatCloseRate == null ? '—' : `${s.beatCloseRate.toFixed(0)}%`, color: s.beatCloseRate == null ? '#94a3b8' : s.beatCloseRate >= 50 ? '#22c55e' : '#f87171', sub: 'vs no-vig close' },
            ].map(t => (
              <div key={t.label} style={tile}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{t.label}</div>
                <div style={{ ...mono, fontSize: '16px', fontWeight: 700, color: t.color, marginTop: '2px' }}>{t.value}</div>
                <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{t.sub}</div>
              </div>
            ))}
          </div>

          {s.luckUnits != null && (
            <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '10px', lineHeight: 1.6 }}>
              <strong style={{ color: '#e2e8f0' }}>Skill vs. luck:</strong> at the closing prices your {s.clvGradedCount} graded bet{s.clvGradedCount === 1 ? ' was' : 's were'} worth{' '}
              <span style={{ ...mono, color: tone(s.expectedUnits) }}>{signed(s.expectedUnits, 2, 'u')}</span>; they returned{' '}
              <span style={{ ...mono, color: tone(s.actualUnitsOnClvBets) }}>{signed(s.actualUnitsOnClvBets, 2, 'u')}</span>
              {' '}— <span style={{ ...mono, color: tone(s.luckUnits) }}>{signed(s.luckUnits, 2, 'u')}</span> {s.luckUnits >= 0 ? 'above' : 'below'} expectation, which is variance rather than skill.
              {s.clvGradedCount < 100 && <span style={{ color: '#64748b' }}> Small sample: results swing a lot until you have a few hundred bets; CLV settles much sooner.</span>}
            </div>
          )}
        </>
      )}

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

      {showHow && (
        <ul style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7, margin: '10px 0 0', paddingLeft: '18px' }}>
          <li>When you log a moneyline, spread or total from the board, our server, not your device, records it with the server's clock, and only if the game hasn't started.</li>
          <li>The line must be on the board at that moment. If you enter a better price than any book is offering, the best real price is recorded instead.</li>
          <li>Each entry carries a SHA-256 fingerprint of its contents plus the previous entry's fingerprint. Changing, deleting or reordering anything breaks the chain, and your browser re-checks the whole chain every time it loads.</li>
          <li>Verified bets can't be edited or deleted. To fix a mistake you can void a bet within 10 minutes of logging it (and before its game starts). The void stays on the record.</li>
          <li>The closing line is the no-vig consensus across books just before kick-off. Results come from final scores (basketball, football, baseball and hockey). Neither can be typed in.</li>
          <li>Stats here use only the verified record: flat 1-unit staking, so bet sizing can't flatter the results. Your personal tracker below stays fully editable and is labelled "self-reported" where it isn't verified.</li>
        </ul>
      )}

      {showEntries && (
        <div style={{ marginTop: '10px' }}>
          {entries.map(entry => (
            <EntryRow key={entry.id} entry={entry} now={now} onVoid={ledger.voidVerifiedBet} />
          ))}
        </div>
      )}
    </section>
  );
}
