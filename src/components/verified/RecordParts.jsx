// Building blocks shared by the owner's Verified Record panel and the public
// record page, so both always show the same numbers the same way.
import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { closingEvPct } from '../../utils/ledger.js';
import { formatOdds, formatPoint } from '../../utils/bets.js';

export const panelStyle = {
  background: 'linear-gradient(135deg, rgba(34,197,94,0.07), rgba(15,23,42,0.75))',
  border: '1px solid rgba(34,197,94,0.25)',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '16px',
};
const tile = { background: 'rgba(15,23,42,0.6)', borderRadius: '8px', padding: '10px', textAlign: 'center' };
export const mono = { fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' };
export const linkButton = {
  display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none',
  color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: '4px 0', fontFamily: 'inherit',
};

export const signed = (n, digits = 2, suffix = '') => (n == null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(digits)}${suffix}`);
export const tone = (n) => (n == null ? '#94a3b8' : n > 0 ? '#22c55e' : n < 0 ? '#f87171' : '#e2e8f0');

export function pickLabel(e) {
  if (e.marketKey === 'h2h') return `${e.outcomeName} ML`;
  if (e.marketKey === 'spreads') return `${e.outcomeName} ${formatPoint(e.outcomePoint)}`;
  return `${e.outcomeName} ${e.outcomePoint}`;
}

export function formatWhen(iso) {
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

export function IntegrityBadge({ chain }) {
  if (!chain) return null;
  const broken = !chain.valid;
  const linkedNote = chain.linkedOnly ? ` (${chain.linkedOnly} older entr${chain.linkedOnly === 1 ? 'y' : 'ies'} checked by link)` : '';
  return (
    <div
      role="status"
      title={broken
        ? chain.reason
        : `Every entry's fingerprint was recomputed in your browser and links to the one before it.${chain.linkedOnly ? ' Entries recorded before stakes were made private are checked by their links, because their contents include the stake.' : ''}`}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700,
        padding: '4px 8px', borderRadius: '6px',
        color: broken ? '#fca5a5' : '#86efac',
        background: broken ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.12)',
      }}
    >
      {broken ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
      {broken
        ? `Integrity check failed at entry #${chain.brokenAtSeq}`
        : `Integrity verified · ${chain.checked} entr${chain.checked === 1 ? 'y' : 'ies'}${linkedNote}`}
    </div>
  );
}

export function ChainAlert({ chain }) {
  if (!chain || chain.valid) return null;
  return (
    <div role="alert" style={{ fontSize: '11px', color: '#fca5a5', marginBottom: '12px' }}>
      Entry #{chain.brokenAtSeq}: {chain.reason}. The record no longer matches what was originally written, so it can't be trusted.
    </div>
  );
}

// `audience`: 'owner' ("your bets") or 'public' ("these bets").
export function RecordStats({ stats: s, audience = 'owner' }) {
  if (!s || s.total === 0) return null;
  const whose = audience === 'owner' ? 'your' : 'these';
  return (
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
          <strong style={{ color: '#e2e8f0' }}>Skill vs. luck:</strong> at the closing prices {whose} {s.clvGradedCount} graded bet{s.clvGradedCount === 1 ? ' was' : 's were'} worth{' '}
          <span style={{ ...mono, color: tone(s.expectedUnits) }}>{signed(s.expectedUnits, 2, 'u')}</span>; they returned{' '}
          <span style={{ ...mono, color: tone(s.actualUnitsOnClvBets) }}>{signed(s.actualUnitsOnClvBets, 2, 'u')}</span>
          {' '}— <span style={{ ...mono, color: tone(s.luckUnits) }}>{signed(s.luckUnits, 2, 'u')}</span> {s.luckUnits >= 0 ? 'above' : 'below'} expectation, which is variance rather than skill.
          {s.clvGradedCount < 100 && <span style={{ color: '#64748b' }}> Small sample: results swing a lot until there are a few hundred bets; CLV settles much sooner.</span>}
        </div>
      )}
    </>
  );
}

export function EntryRow({ entry, now, onVoid }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const status = statusOf(entry, now);
  const clv = closingEvPct(entry);
  const grade = entry.derived?.grade;
  // Mirrors the server rule: an undo for mistakes within 10 minutes, pregame.
  const canVoid = Boolean(onVoid)
    && !entry.voided
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
            {entry.priceAdjusted && <> · <span style={{ color: '#f59e0b' }}>{formatOdds(entry.claimedOdds)} was entered; the best price on the board was {formatOdds(entry.odds)}, so that's what was recorded</span></>}
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

export function HowVerificationWorks({ audience = 'owner' }) {
  const owner = audience === 'owner';
  return (
    <ul style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7, margin: '10px 0 0', paddingLeft: '18px' }}>
      <li>When a moneyline, spread or total is logged from the board, EdgeFinder's server, not the bettor's device, records it with the server's clock, and only if the game hasn't started.</li>
      <li>The line must be on the board at that moment. If someone enters a better price than any book is offering, the best real price is recorded instead.</li>
      <li>Each entry carries a SHA-256 fingerprint of its contents plus the previous entry's fingerprint. Changing, deleting or reordering anything breaks the chain, and {owner ? 'your' : 'this'} browser re-checks the whole chain every time the record loads.</li>
      <li>Verified bets can't be edited or deleted. A mistake can be voided within 10 minutes of logging (and before the game starts); the void stays on the record.</li>
      <li>The closing line is the no-vig consensus across books just before kick-off. Results come from final scores (basketball, football, baseball and hockey). Neither can be typed in.</li>
      <li>Stats use only the verified record, with flat 1-unit staking, so bet sizing can't flatter the results.{owner ? ' Your personal tracker below stays fully editable and is labelled "self-reported" where it isn\'t verified.' : ' Stake sizes are private: each entry stores a fingerprint of its stake instead.'}</li>
    </ul>
  );
}
