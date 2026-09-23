import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Loader, Lock, ChevronDown, ChevronUp, X, Plus, Check, ShoppingCart, ArrowUpDown, Zap, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import BestProps from './BestProps.jsx';
import {
  getBookAbbreviation,
  getBookDisplayName,
  getMarketDisplayName,
  formatOdds,
  getSportMeta,
  SPORT_SORT_ORDER,
  buildTeamVisuals,
  getPlayerInitials,
  normalizeTeamKey,
  aggregatePlayerProps,
  buildPropAlerts,
  getPropTimingState,
  getPropSideLabel,
  formatPropPick,
} from '../utils/props.js';
import { getSportVisual, resolveTeamLogo } from '../utils/team-logos.js';

const FREE_PLAYERS_LIMIT = 3;
const MONO = 'JetBrains Mono, monospace';
// Movement sort is omitted while prop line history has no writer (every
// market would tie at zero); sortPlayers still supports it.
const SORT_OPTIONS = [
  { value: 'default', label: 'By game' },
  { value: 'edge', label: 'Best price edge' },
  { value: 'books', label: 'Most books' },
  { value: 'markets', label: 'Most markets' },
];
const QUICK_STAKES = [10, 25, 50, 100];
const TIMING_ORDER = { live: 0, pregame: 1, unknown: 2, final: 3 };
const STATUS_COLORS = { Playable: '#22c55e', Monitor: '#f59e0b', Pass: '#94a3b8' };

function compareSports(a, b) {
  const aIndex = SPORT_SORT_ORDER.indexOf(a);
  const bIndex = SPORT_SORT_ORDER.indexOf(b);
  if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
  if (aIndex === -1) return 1;
  if (bIndex === -1) return -1;
  return aIndex - bIndex;
}

function formatEdge(edge) {
  if (edge == null || !Number.isFinite(edge)) return null;
  const rounded = Math.round(edge);
  return `${rounded > 0 ? '+' : ''}${rounded}¢`;
}

function chipStyle(active, accent = '#6366f1') {
  return {
    padding: '7px 12px',
    background: active ? `${accent}30` : 'rgba(30,41,59,0.4)',
    border: active ? `1px solid ${accent}80` : '1px solid rgba(71,85,105,0.3)',
    borderRadius: '999px',
    color: active ? '#f8fafc' : '#94a3b8',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: MONO,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

function QuickAddModal({ bet, onConfirm, onCancel }) {
  const [wager, setWager] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  if (!bet) return null;
  const amount = Number(wager);
  const valid = wager !== '' && Number.isFinite(amount) && amount > 0;
  const handleConfirm = () => {
    if (!valid) return;
    onConfirm({ ...bet, wager: amount });
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Quick add bet" style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: 'rgb(15,23,42)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={18} color="#818cf8" /></div>
            <div><div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Quick Add Bet</div><div style={{ fontSize: '11px', color: '#64748b' }}>Confirm and save to tracker</div></div>
          </div>
          <button onClick={onCancel} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
        </div>
        <div style={{ background: 'rgba(30,41,59,0.7)', borderRadius: '10px', padding: '16px', marginBottom: '18px', border: '1px solid rgba(71,85,105,0.3)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '12px', lineHeight: 1.4 }}>{bet.pick}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Book', value: bet.book },
              { label: 'Odds', value: formatOdds(bet.odds), color: bet.odds > 0 ? '#22c55e' : '#f8fafc' },
              { label: 'Game', value: bet.game },
              { label: 'Bet Type', value: 'Player Prop' },
            ].map(({ label, value, color }) => <div key={label} style={{ minWidth: 0 }}><div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div><div style={{ fontSize: '13px', fontWeight: 600, color: color || '#e2e8f0', overflowWrap: 'anywhere' }}>{value || '—'}</div></div>)}
          </div>
        </div>
        <div style={{ marginBottom: '18px' }}>
          <label htmlFor="props-quick-wager" style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>Wager Amount ($)</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', padding: '10px 14px', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 700 }}>$</span>
            <input id="props-quick-wager" type="number" inputMode="decimal" min="1" step="1" placeholder="e.g. 25" value={wager} onChange={e => setWager(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }} autoFocus style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '16px', fontWeight: 700, width: '100%', fontFamily: MONO }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            {QUICK_STAKES.map(stake => (
              <button key={stake} type="button" onClick={() => setWager(String(stake))} style={{ flex: 1, padding: '7px 0', borderRadius: '6px', border: '1px solid rgba(71,85,105,0.35)', background: amount === stake ? 'rgba(99,102,241,0.25)' : 'rgba(30,41,59,0.5)', color: '#cbd5e1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: MONO }}>${stake}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: '8px', background: 'rgba(71,85,105,0.2)', border: '1px solid rgba(71,85,105,0.3)', color: '#94a3b8', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!valid} style={{ flex: 2, padding: '11px', borderRadius: '8px', background: valid ? 'rgba(99,102,241,0.8)' : 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.5)', color: valid ? '#fff' : '#64748b', fontSize: '13px', fontWeight: 700, cursor: valid ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Check size={15} />Add to Tracker</button>
        </div>
      </div>
    </div>
  );
}

function TeamBadge({ team }) {
  const [fallback, setFallback] = useState(!team?.logo);

  useEffect(() => {
    setFallback(!team?.logo);
  }, [team?.logo]);

  if (!team) return null;
  return (
    <div title={team.name} style={{ width: 22, height: 22, borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(15,23,42,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
      {fallback || !team.logo
        ? team.initials
        : <img src={team.logo} alt={team.name} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} onError={() => setFallback(true)} />}
    </div>
  );
}

function PlayerBadge({ name, photo }) {
  const [fallback, setFallback] = useState(!photo);

  useEffect(() => {
    setFallback(!photo);
  }, [photo]);

  return (
    <div style={{ width: 36, height: 36, borderRadius: '999px', background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(14,165,233,0.25))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc', fontWeight: 800, fontSize: '12px', flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.15)' }}>
      {fallback || !photo
        ? getPlayerInitials(name)
        : <img src={photo} alt={name} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setFallback(true)} />}
    </div>
  );
}

function TimingPill({ timing }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '999px', background: timing.background, border: `1px solid ${timing.border}`, color: timing.color, fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      <span>{timing.label}</span>
      <span style={{ color: '#cbd5e1', fontWeight: 600, letterSpacing: 0 }}>{timing.detail}</span>
    </span>
  );
}

function getGameTeamNames(game) {
  return String(game || '')
    .split(/\s+(?:@|vs\.?|v\.)\s+/i)
    .map(name => name.trim())
    .filter(Boolean);
}

function findTeamIndexEntry(sportTeams, teamName) {
  const key = normalizeTeamKey(teamName);
  if (!key) return null;
  if (sportTeams[key]) return sportTeams[key];

  return Object.entries(sportTeams).find(([teamKey]) => (
    teamKey.includes(key) || key.includes(teamKey)
  ))?.[1] || null;
}

function collectRosterAthletes(data) {
  return (data?.athletes || []).flatMap(group => {
    if (Array.isArray(group?.items)) return group.items;
    if (group?.athlete) return [group.athlete];
    return group ? [group] : [];
  });
}

// Builds the tracker payload for one side of a market at one book. The line
// is the book's own number, which can differ from the consensus line when
// the book only posts an alternate.
function buildQuickAddBet({ player, marketKey, mkt, side, book, cell }) {
  return {
    player: player.name,
    game: player.game,
    book: getBookDisplayName(book),
    odds: cell.price,
    pick: `${player.name} ${getMarketDisplayName(marketKey)} ${formatPropPick(mkt, side, cell.line)}`,
    type: 'Player Prop',
    date: new Date().toISOString(),
    gameId: player.gameId,
    sportKey: player.sport,
    marketKey,
    outcomeName: getPropSideLabel(mkt, side),
    outcomePoint: cell.line,
    commenceTime: player.commenceTime,
  };
}

function OddsCell({ cell, isBest, side, label, onAdd }) {
  const [hovered, setHovered] = useState(false);
  if (!cell) return <td style={{ padding: '7px 8px', textAlign: 'center', color: '#334155', fontSize: '11px', fontFamily: MONO }}>—</td>;
  const isOver = side === 'over';
  const baseColor = isOver ? '#22c55e' : '#ef4444';
  const bestBg = isOver ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  const hoverBg = isOver ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)';
  const highlight = isBest || hovered;
  return (
    <td style={{ padding: '2px', textAlign: 'center' }}>
      <button
        type="button"
        onClick={onAdd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        title={`Add ${label} @ ${formatOdds(cell.price)} to Bet Tracker${cell.alt ? ' (this book posts a different line)' : ''}`}
        style={{ width: '100%', minWidth: '54px', padding: '6px 6px', cursor: 'pointer', borderRadius: '6px', border: 'none', background: hovered ? hoverBg : isBest ? bestBg : 'transparent', transition: 'background 0.12s', fontFamily: MONO, fontSize: '11px', lineHeight: 1.25, opacity: cell.alt && !hovered ? 0.7 : 1 }}
      >
        <span style={{ color: highlight ? baseColor : '#e2e8f0', fontWeight: highlight ? 700 : 400 }}>{formatOdds(cell.price)}</span>
        {isBest && !hovered && <span style={{ marginLeft: '2px', fontSize: '9px', color: baseColor }}>★</span>}
        {hovered && <Plus size={9} color={baseColor} style={{ marginLeft: '3px', verticalAlign: 'middle' }} />}
        {cell.alt && <span style={{ display: 'block', fontSize: '9px', color: '#94a3b8' }}>{cell.line ?? '—'}</span>}
      </button>
    </td>
  );
}

function StatChip({ label, children, color = '#e2e8f0' }) {
  return (
    <div style={{ padding: '7px 10px', borderRadius: '8px', background: 'rgba(30,41,59,0.65)', border: '1px solid rgba(71,85,105,0.25)', minWidth: 0 }}>
      <div style={{ fontSize: '9px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</div>
      <div style={{ fontSize: '12px', color, fontWeight: 700, fontFamily: MONO, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{children}</div>
    </div>
  );
}

function MarketBlock({ player, marketKey, mkt, onQuickAdd }) {
  const { insights } = mkt;
  const books = mkt.bookList || [];
  const sides = ['over', 'under'].filter(side => books.some(book => mkt.cells[side][book]));
  const hasAlt = sides.some(side => books.some(book => mkt.cells[side][book]?.alt));
  const bestLabel = (side) => {
    const book = side === 'over' ? insights.bestOverBook : insights.bestUnderBook;
    const price = side === 'over' ? insights.bestOver : insights.bestUnder;
    return book ? `${getBookAbbreviation(book)} ${formatOdds(price)}` : '—';
  };
  const fairLabel = mkt.yesNo
    ? `${insights.fairOverPrice != null ? formatOdds(insights.fairOverPrice) : '—'} / ${insights.fairUnderPrice != null ? formatOdds(insights.fairUnderPrice) : '—'}`
    : `O ${insights.fairOverPrice != null ? formatOdds(insights.fairOverPrice) : '—'} · U ${insights.fairUnderPrice != null ? formatOdds(insights.fairUnderPrice) : '—'}`;

  return (
    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: '10px', border: '1px solid rgba(71,85,105,0.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', fontFamily: MONO }}>{getMarketDisplayName(marketKey)}</span>
        {mkt.line != null && <span style={{ fontSize: '11px', color: '#cbd5e1', fontFamily: MONO, background: 'rgba(71,85,105,0.3)', padding: '2px 8px', borderRadius: '999px' }}>Line {mkt.line}</span>}
        <span style={{ fontSize: '10px', color: '#64748b' }}>{books.length} book{books.length !== 1 ? 's' : ''}</span>
        <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 800, color: STATUS_COLORS[insights.recommendation] || '#94a3b8', background: `${STATUS_COLORS[insights.recommendation] || '#94a3b8'}1f`, padding: '3px 8px', borderRadius: '999px', letterSpacing: '0.04em' }}>{insights.recommendation.toUpperCase()}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '6px', marginBottom: '8px' }}>
        <StatChip label={`Best ${getPropSideLabel(mkt, 'over')}`} color="#22c55e">{bestLabel('over')}</StatChip>
        <StatChip label={`Best ${getPropSideLabel(mkt, 'under')}`} color="#ef4444">{bestLabel('under')}</StatChip>
        <StatChip label="Fair (no-vig)">{fairLabel}</StatChip>
        {insights.lineRange > 0 && <StatChip label="Line spread" color="#f59e0b">{insights.lineRange.toFixed(1)} pts</StatChip>}
        {insights.strongestMove && <StatChip label="Movement" color="#a5b4fc">{getBookAbbreviation(insights.strongestMove.book)} {insights.strongestMove.lineChange > 0 ? '+' : ''}{insights.strongestMove.lineChange}</StatChip>}
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', lineHeight: 1.5 }}>
        {insights.summary}
        {insights.details.map((detail, idx) => <span key={idx}> {detail}</span>)}
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: books.length > 5 ? '100%' : 'auto', minWidth: '240px', borderCollapse: 'separate', borderSpacing: 0, fontSize: '11px', fontFamily: MONO }}>
          <thead>
            <tr>
              <th scope="col" style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600, textAlign: 'left', width: '56px', position: 'sticky', left: 0, background: 'rgb(20,28,44)' }}>Side</th>
              {books.map(book => <th scope="col" key={book} title={getBookDisplayName(book)} style={{ padding: '4px 6px', color: '#64748b', fontWeight: 600, textAlign: 'center', minWidth: '64px' }}>{getBookAbbreviation(book)}</th>)}
            </tr>
          </thead>
          <tbody>
            {sides.map(side => {
              const best = side === 'over' ? insights.bestOver : insights.bestUnder;
              const sideLabel = getPropSideLabel(mkt, side);
              return (
                <tr key={side}>
                  <th scope="row" style={{ padding: '6px 8px', color: side === 'over' ? '#22c55e' : '#ef4444', fontWeight: 700, textAlign: 'left', position: 'sticky', left: 0, background: 'rgb(20,28,44)' }}>{sideLabel}</th>
                  {books.map(book => {
                    const cell = mkt.cells[side][book];
                    return (
                      <OddsCell
                        key={book}
                        cell={cell}
                        side={side}
                        label={cell ? formatPropPick(mkt, side, cell.line) : sideLabel}
                        isBest={!!cell && !cell.alt && best != null && cell.price === best}
                        onAdd={() => cell && onQuickAdd(buildQuickAddBet({ player, marketKey, mkt, side, book, cell }))}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasAlt && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>Dimmed prices are at a different line (shown under the price) and are left out of best price and fair value.</div>}
    </div>
  );
}

function PlayerCard({ player, accent, expanded, onToggle, visibleMarkets, onQuickAdd, showGame }) {
  const focus = player.focusMarket;
  const focusInsight = focus?.mkt.insights;
  const focusSide = focusInsight && (focusInsight.edgeOver ?? -Infinity) >= (focusInsight.edgeUnder ?? -Infinity) ? 'over' : 'under';
  const focusBook = focusInsight && (focusSide === 'over' ? focusInsight.bestOverBook : focusInsight.bestUnderBook);
  const focusPrice = focusInsight && (focusSide === 'over' ? focusInsight.bestOver : focusInsight.bestUnder);
  const focusEdge = focusInsight && (focusSide === 'over' ? focusInsight.edgeOver : focusInsight.edgeUnder);
  const edgeText = formatEdge(focusEdge);

  return (
    <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderLeft: `3px solid ${accent}`, borderRadius: '12px', overflow: 'hidden' }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: expanded ? 'rgba(99,102,241,0.08)' : 'transparent', gap: '12px', flexWrap: 'wrap', outline: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 220px' }}>
          <PlayerBadge name={player.name} photo={player.photo} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: '#e2e8f0', fontFamily: MONO, overflowWrap: 'anywhere' }}>{player.name}</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {showGame && <>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><TeamBadge team={player.visuals.away} /><span>@</span><TeamBadge team={player.visuals.home} /></span>
                <span>{player.game}</span>
                <TimingPill timing={player.timing} />
              </>}
              <span>{player.summaryMetrics.markets} market{player.summaryMetrics.markets !== 1 ? 's' : ''} · {player.summaryMetrics.books} book{player.summaryMetrics.books !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginLeft: 'auto' }}>
          {focus && focusBook && focusPrice != null && (
            <span style={{ fontSize: '11px', color: '#e2e8f0', background: 'rgba(51,65,85,0.65)', padding: '4px 9px', borderRadius: '999px', fontFamily: MONO, whiteSpace: 'nowrap' }}>
              {getMarketDisplayName(focus.marketKey)} {formatPropPick(focus.mkt, focusSide)} · {getBookAbbreviation(focusBook)} {formatOdds(focusPrice)}
            </span>
          )}
          {edgeText && <span style={{ fontSize: '10px', fontWeight: 700, color: focusEdge > 0 ? '#22c55e' : '#94a3b8', background: focusEdge > 0 ? 'rgba(34,197,94,0.12)' : 'rgba(71,85,105,0.3)', padding: '4px 8px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{edgeText} vs fair</span>}
          {focusInsight && <span style={{ fontSize: '10px', fontWeight: 700, color: STATUS_COLORS[focusInsight.recommendation] || '#94a3b8', padding: '4px 2px' }}>{focusInsight.recommendation}</span>}
          {expanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '0 14px 14px' }}>
          {visibleMarkets.map(marketKey => (
            <MarketBlock key={marketKey} player={player} marketKey={marketKey} mkt={player.markets[marketKey]} onQuickAdd={onQuickAdd} />
          ))}
          <div style={{ fontSize: '10px', color: '#6366f1', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}><ShoppingCart size={11} />Tap any price to add it to your Bet Tracker</div>
        </div>
      )}
    </div>
  );
}

function sortPlayers(list, sortBy) {
  const sorted = [...list];
  const m = (p) => p.summaryMetrics;
  if (sortBy === 'edge') sorted.sort((a, b) => m(b).edge - m(a).edge || m(b).books - m(a).books);
  else if (sortBy === 'books') sorted.sort((a, b) => m(b).books - m(a).books || m(b).markets - m(a).markets);
  else if (sortBy === 'movement') sorted.sort((a, b) => m(b).movement - m(a).movement || m(b).edge - m(a).edge);
  else if (sortBy === 'markets') sorted.sort((a, b) => m(b).markets - m(a).markets || m(b).books - m(a).books);
  return sorted;
}

function groupByGame(sportPlayers) {
  const games = new Map();
  sportPlayers.forEach(player => {
    const key = player.gameId || player.game;
    if (!games.has(key)) games.set(key, { key, game: player.game, visuals: player.visuals, timing: player.timing, commenceTime: player.commenceTime, players: [] });
    games.get(key).players.push(player);
  });
  return Array.from(games.values()).sort((a, b) => (
    (TIMING_ORDER[a.timing.key] ?? 2) - (TIMING_ORDER[b.timing.key] ?? 2)
    || (Date.parse(a.commenceTime || '') || Infinity) - (Date.parse(b.commenceTime || '') || Infinity)
    || String(a.game).localeCompare(String(b.game))
  ));
}

export default function PropsView({ playerProps = [], games = [], loading, propHistory, propClosingLines, setPendingBet, onRefresh, onNavigate }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';
  const [propFilter, setPropFilter] = useState('ALL');
  const [sportFilter, setSportFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('default');
  const [propSearch, setPropSearch] = useState('');
  // Browse All is the primary discovery view — default to it so users land
  // on the full board by sport and game, then can toggle to Best Props.
  const [viewMode, setViewMode] = useState('all');
  const [expandedPlayers, setExpandedPlayers] = useState(() => new Set());
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [pendingModal, setPendingModal] = useState(null);
  const [logoMap, setLogoMap] = useState({});
  const [teamIndexMap, setTeamIndexMap] = useState({});
  const [playerHeadshots, setPlayerHeadshots] = useState({});
  // Asset requests are tracked in refs so prop refreshes and state updates
  // from one sport's response don't re-request what is already in flight.
  const requestedLogoSports = useRef(new Set());
  const requestedRosters = useRef(new Set());

  const propSports = useMemo(
    () => Array.from(new Set(playerProps.map(prop => prop.sport).filter(Boolean))),
    [playerProps]
  );

  useEffect(() => {
    propSports.forEach(async (sport) => {
      const meta = getSportMeta(sport);
      if (!meta.espnPath || requestedLogoSports.current.has(sport)) return;
      requestedLogoSports.current.add(sport);
      try {
        const res = await fetch(`/api/espn-assets?type=teams&path=${encodeURIComponent(meta.espnPath)}`);
        if (!res.ok) { requestedLogoSports.current.delete(sport); return; }
        const data = await res.json();
        const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
        const nextLogos = {};
        const nextTeams = {};
        teams.forEach(entry => {
          const team = entry.team;
          if (!team?.id) return;
          const logo = team.logos?.[0]?.href || (team.abbreviation && meta.logoSport ? `https://a.espncdn.com/i/teamlogos/${meta.logoSport}/500/${team.abbreviation.toLowerCase()}.png` : null);
          [team.displayName, team.shortDisplayName, team.location, team.name, team.abbreviation].filter(Boolean).forEach(name => {
            const key = normalizeTeamKey(name);
            nextLogos[key] = logo;
            nextTeams[key] = { id: team.id, abbreviation: team.abbreviation, sport };
          });
        });
        setLogoMap(prev => ({ ...prev, [sport]: nextLogos }));
        setTeamIndexMap(prev => ({ ...prev, [sport]: nextTeams }));
      } catch {
        requestedLogoSports.current.delete(sport);
      }
    });
  }, [propSports]);

  useEffect(() => {
    const rosterTargets = [];
    playerProps.forEach(prop => {
      const sportTeams = teamIndexMap[prop.sport];
      if (!sportTeams) return;
      getGameTeamNames(prop.game).forEach(teamName => {
        const match = findTeamIndexEntry(sportTeams, teamName);
        if (!match) return;
        const key = `${prop.sport}::${match.id}`;
        if (requestedRosters.current.has(key)) return;
        requestedRosters.current.add(key);
        rosterTargets.push({ sport: prop.sport, teamId: match.id, espnPath: getSportMeta(prop.sport).espnPath });
      });
    });

    rosterTargets.forEach(async ({ sport, teamId, espnPath }) => {
      try {
        const res = await fetch(`/api/espn-assets?type=roster&path=${encodeURIComponent(espnPath)}&teamId=${encodeURIComponent(teamId)}`);
        if (!res.ok) return;
        const data = await res.json();
        const athletes = collectRosterAthletes(data);
        if (!athletes.length) return;
        setPlayerHeadshots(prev => {
          const next = { ...prev };
          athletes.forEach(athlete => {
            const person = athlete?.athlete || athlete;
            const displayName = person?.displayName || person?.fullName;
            const headshot = person?.headshot?.href || person?.image?.href || person?.photoUrl || null;
            if (!displayName || !headshot) return;
            next[`${sport}::${normalizeTeamKey(displayName)}`] = headshot;
          });
          return next;
        });
      } catch {}
    });
  }, [playerProps, teamIndexMap]);

  const gameStatusMap = useMemo(() => {
    const map = {};
    games.forEach(game => {
      if (!game?.id) return;
      const started = !!game.commence_time && Date.parse(game.commence_time) <= Date.now();
      map[game.id] = {
        started,
        completed: !!game.completed,
        live: started && !game.completed,
        commenceTime: game.commence_time || null,
      };
    });
    return map;
  }, [games]);

  // Market math only depends on the feed; visuals are layered on separately
  // so logo/headshot arrivals don't recompute every market.
  const aggregatedPlayers = useMemo(() => aggregatePlayerProps(playerProps, propHistory), [playerProps, propHistory]);

  const players = useMemo(() => aggregatedPlayers.map(base => {
    const marketEntries = Object.entries(base.markets).map(([marketKey, mkt]) => ({ marketKey, mkt }));
    const topMarket = [...marketEntries].sort((a, b) => (b.mkt.insights.sortEdge - a.mkt.insights.sortEdge) || (b.mkt.insights.sortBooks - a.mkt.insights.sortBooks))[0] || null;
    const visuals = buildTeamVisuals(base.game, base.sport, logoMap);
    if (visuals.away && !visuals.away.logo) visuals.away.logo = resolveTeamLogo(logoMap, base.sport, visuals.away.name);
    if (visuals.home && !visuals.home.logo) visuals.home.logo = resolveTeamLogo(logoMap, base.sport, visuals.home.name);
    return {
      ...base,
      sportMeta: getSportMeta(base.sport),
      timing: getPropTimingState({ gameStatus: gameStatusMap[base.gameId], commenceTime: base.commenceTime }),
      visuals,
      photo: playerHeadshots[`${base.sport}::${normalizeTeamKey(base.name)}`] || null,
      topMarket,
      topInsight: topMarket?.mkt.insights || null,
      summaryMetrics: {
        markets: marketEntries.length,
        books: Math.max(0, ...marketEntries.map(({ mkt }) => mkt.insights.sortBooks || 0)),
        edge: Math.max(-999, ...marketEntries.map(({ mkt }) => (Number.isFinite(mkt.insights.sortEdge) ? mkt.insights.sortEdge : -999))),
        movement: Math.max(0, ...marketEntries.map(({ mkt }) => mkt.insights.sortMovement || 0)),
      },
    };
  }).sort((a, b) => compareSports(a.sport, b.sport) || b.summaryMetrics.markets - a.summaryMetrics.markets), [aggregatedPlayers, logoMap, playerHeadshots, gameStatusMap]);

  const sportOptions = useMemo(() => {
    const counts = {};
    players.forEach(player => { counts[player.sport] = (counts[player.sport] || 0) + 1; });
    return Object.keys(counts).sort(compareSports).map(sport => ({ sport, count: counts[sport] }));
  }, [players]);

  // A sport filter left over from an earlier slate falls back to all sports.
  const activeSport = sportFilter === 'ALL' || sportOptions.some(option => option.sport === sportFilter) ? sportFilter : 'ALL';

  const sportScopedPlayers = useMemo(
    () => (activeSport === 'ALL' ? players : players.filter(player => player.sport === activeSport)),
    [players, activeSport]
  );

  // Market chips only list stats offered in the selected sport, most common first.
  const marketOptions = useMemo(() => {
    const counts = {};
    sportScopedPlayers.forEach(player => {
      Object.keys(player.markets).forEach(marketKey => { counts[marketKey] = (counts[marketKey] || 0) + 1; });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1] || getMarketDisplayName(a[0]).localeCompare(getMarketDisplayName(b[0])))
      .map(([market, count]) => ({ market, count }));
  }, [sportScopedPlayers]);

  const activeMarket = propFilter === 'ALL' || marketOptions.some(option => option.market === propFilter) ? propFilter : 'ALL';

  const filteredPlayers = useMemo(() => {
    let filtered = sportScopedPlayers;
    const search = propSearch.trim().toLowerCase();
    if (search) {
      filtered = filtered.filter(player => player.name?.toLowerCase().includes(search) || player.game?.toLowerCase().includes(search) || player.sportMeta.label.toLowerCase().includes(search));
    }
    if (activeMarket !== 'ALL') filtered = filtered.filter(player => player.markets[activeMarket]);
    return filtered.map(player => {
      // With a market filter, the card header summarizes that market.
      const focusMarket = activeMarket !== 'ALL'
        ? { marketKey: activeMarket, mkt: player.markets[activeMarket] }
        : player.topMarket;
      return { ...player, focusMarket };
    });
  }, [sportScopedPlayers, propSearch, activeMarket]);

  const sections = useMemo(() => {
    const bySport = new Map();
    filteredPlayers.forEach(player => {
      if (!bySport.has(player.sport)) bySport.set(player.sport, []);
      bySport.get(player.sport).push(player);
    });
    return Array.from(bySport.entries()).map(([sport, sportPlayers]) => {
      const ordered = sortBy === 'default'
        ? [...sportPlayers].sort((a, b) => (TIMING_ORDER[a.timing.key] ?? 2) - (TIMING_ORDER[b.timing.key] ?? 2))
        : sortPlayers(sportPlayers, sortBy);
      const visible = isPro ? ordered : ordered.slice(0, FREE_PLAYERS_LIMIT);
      return {
        sport,
        total: sportPlayers.length,
        visible,
        locked: isPro ? [] : ordered.slice(FREE_PLAYERS_LIMIT),
        gameGroups: sortBy === 'default' ? groupByGame(visible) : null,
      };
    });
  }, [filteredPlayers, sortBy, isPro]);

  const propAlerts = useMemo(
    () => buildPropAlerts(filteredPlayers.filter(player => player.timing.key !== 'final'), propHistory, propClosingLines),
    [filteredPlayers, propHistory, propClosingLines]
  );

  const visiblePlayerKeys = useMemo(() => sections.flatMap(section => section.visible.map(player => player.key)), [sections]);
  const allExpanded = visiblePlayerKeys.length > 0 && visiblePlayerKeys.every(key => expandedPlayers.has(key));
  const toggleExpand = key => setExpandedPlayers(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const toggleExpandAll = () => setExpandedPlayers(allExpanded ? new Set() : new Set(visiblePlayerKeys));

  const hasActiveFilters = activeSport !== 'ALL' || activeMarket !== 'ALL' || propSearch.trim() !== '';
  const clearFilters = () => { setSportFilter('ALL'); setPropFilter('ALL'); setPropSearch(''); };
  const selectSport = (sport) => { setSportFilter(sport); setPropFilter('ALL'); };

  const totalLines = playerProps.length;
  const gamesCount = useMemo(() => new Set(players.map(player => player.gameId || player.game)).size, [players]);
  const visualForSport = (sport) => getSportVisual(sport);

  const handleConfirm = (betWithWager) => {
    if (setPendingBet) setPendingBet({
      ...betWithWager,
      game: betWithWager.game || betWithWager.player,
      type: 'Player Prop',
      date: betWithWager.date || new Date().toISOString(),
      autoSave: true,
    });
    setPendingModal(null);
  };

  const openAlert = (alert) => {
    if (!alert.playerKey) return;
    const player = players.find(entry => entry.key === alert.playerKey);
    if (player) {
      setSportFilter(player.sport);
      if (alert.marketKey) setPropFilter(alert.marketKey);
    }
    setViewMode('all');
    setExpandedPlayers(prev => new Set(prev).add(alert.playerKey));
  };

  if (loading) return <div style={{ padding: '20px 24px', textAlign: 'center', paddingTop: '60px' }}><Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} /><p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading player props...</p></div>;

  const renderPlayer = (player, accent, showGame) => (
    <PlayerCard
      key={player.key}
      player={player}
      accent={accent}
      showGame={showGame}
      expanded={expandedPlayers.has(player.key)}
      onToggle={() => toggleExpand(player.key)}
      visibleMarkets={activeMarket === 'ALL' ? Object.keys(player.markets) : [activeMarket]}
      onQuickAdd={setPendingModal}
    />
  );

  return (<>
    {pendingModal && <QuickAddModal bet={pendingModal} onConfirm={handleConfirm} onCancel={() => setPendingModal(null)} />}
    <div style={{ padding: '20px 24px', maxWidth: '1180px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>Player Props</h2>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontFamily: MONO }}>
            {players.length} players · {gamesCount} game{gamesCount !== 1 ? 's' : ''} · {totalLines} lines · {sportOptions.length} sport{sportOptions.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View toggle — Browse All listed first so it is the primary view */}
          <div role="tablist" aria-label="Props view" style={{ display: 'flex', gap: '4px', padding: '4px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '10px' }}>
            <button role="tab" aria-selected={viewMode === 'all'} onClick={() => setViewMode('all')} style={{ padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: viewMode === 'all' ? 'rgba(99,102,241,0.18)' : 'transparent', border: viewMode === 'all' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', color: viewMode === 'all' ? '#818cf8' : '#64748b', fontFamily: MONO }}>Browse All</button>
            <button role="tab" aria-selected={viewMode === 'best'} onClick={() => setViewMode('best')} style={{ padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', background: viewMode === 'best' ? 'rgba(251,191,36,0.18)' : 'transparent', border: viewMode === 'best' ? '1px solid rgba(251,191,36,0.4)' : '1px solid transparent', color: viewMode === 'best' ? '#fbbf24' : '#64748b', fontFamily: MONO }}>⚡ Best Props</button>
          </div>
          {onRefresh && <button onClick={onRefresh} title="Refresh odds" aria-label="Refresh odds" style={{ padding: '9px', borderRadius: '8px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}><RefreshCw size={14} /></button>}
        </div>
      </div>

      {/* Sport strip */}
      {sportOptions.length > 1 && (
        <div className="scroll-strip" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '10px' }}>
          <button onClick={() => selectSport('ALL')} style={chipStyle(activeSport === 'ALL')}>ALL SPORTS <span style={{ color: '#64748b' }}>{players.length}</span></button>
          {sportOptions.map(({ sport, count }) => {
            const meta = getSportMeta(sport);
            return (
              <button key={sport} onClick={() => selectSport(sport)} style={chipStyle(activeSport === sport, visualForSport(sport).color)}>
                <span>{meta.icon}</span><span>{meta.label}</span><span style={{ color: '#64748b' }}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar: search + sort + expand */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {isPro ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.25)', borderRadius: '8px', flex: '1 1 220px', minWidth: 0 }}>
            <Search size={14} color="#64748b" />
            <input type="search" aria-label="Search props" placeholder="Search player, team, or sport..." value={propSearch} onChange={e => setPropSearch(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '13px', width: '100%', fontFamily: MONO }} />
            {propSearch && <button onClick={() => setPropSearch('')} aria-label="Clear search" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: 0 }}><X size={14} /></button>}
          </label>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(30,41,59,0.3)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '8px', flex: '1 1 220px', opacity: 0.6 }}><Lock size={14} color="#64748b" /><span style={{ color: '#64748b', fontSize: '13px' }}>Search (Pro only)</span></div>
        )}
        {viewMode === 'all' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '8px' }}>
            <ArrowUpDown size={14} color="#94a3b8" />
            <select aria-label="Sort props" value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: 'transparent', color: '#e2e8f0', border: 'none', outline: 'none', fontSize: '12px' }}>{SORT_OPTIONS.map(option => <option key={option.value} value={option.value} style={{ color: '#0f172a' }}>{option.label}</option>)}</select>
          </label>
        )}
        {viewMode === 'all' && visiblePlayerKeys.length > 0 && (
          <button onClick={toggleExpandAll} style={{ padding: '8px 12px', borderRadius: '8px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', color: '#cbd5e1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {allExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{allExpanded ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </div>

      {/* Market chips, scoped to the selected sport */}
      {marketOptions.length > 1 && (
        <div className="scroll-strip" style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '12px' }}>
          <button onClick={() => setPropFilter('ALL')} style={chipStyle(activeMarket === 'ALL')}>ALL MARKETS</button>
          {marketOptions.map(({ market, count }) => (
            <button key={market} onClick={() => setPropFilter(market)} style={chipStyle(activeMarket === market)}>
              {getMarketDisplayName(market)} <span style={{ color: '#64748b' }}>{count}</span>
            </button>
          ))}
        </div>
      )}

      {hasActiveFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', fontSize: '11px', color: '#94a3b8' }}>
          <span>Showing {filteredPlayers.length} of {players.length} players</span>
          <button onClick={clearFilters} style={{ padding: '4px 10px', borderRadius: '999px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: '11px', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><X size={11} />Clear filters</button>
        </div>
      )}

      {/* Best Props view — honours the sport, market and search filters */}
      {viewMode === 'best' && (
        <BestProps
          players={activeMarket === 'ALL' ? filteredPlayers : filteredPlayers.map(player => ({ ...player, markets: { [activeMarket]: player.markets[activeMarket] } }))}
          setPendingBet={setPendingModal}
        />
      )}

      {/* Browse All view */}
      {viewMode === 'all' && <>
        {propAlerts.length > 0 && (
          <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#facc15', fontSize: '12px', fontWeight: 700 }}>
              <Zap size={14} />Prop alerts <span style={{ color: '#a16207', fontWeight: 600 }}>{propAlerts.length}</span>
              {propAlerts.length > 4 && <button onClick={() => setShowAllAlerts(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#facc15', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{showAllAlerts ? 'Show less' : 'Show all'}</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '8px' }}>
              {(showAllAlerts ? propAlerts : propAlerts.slice(0, 4)).map(alert => (
                <button key={alert.id} onClick={() => openAlert(alert)} title="Open this market" style={{ textAlign: 'left', padding: '10px', background: 'rgba(15,23,42,0.45)', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.25)', cursor: 'pointer', color: 'inherit', font: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}><div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 700 }}>{alert.emoji} {alert.title}</div><div style={{ fontSize: '10px', color: '#facc15', whiteSpace: 'nowrap' }}>{alert.metricDisplay}</div></div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>{alert.edge}</div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>{alert.note}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {filteredPlayers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
            <div style={{ fontSize: '34px', marginBottom: '10px' }}>{hasActiveFilters ? '🔍' : '🏈'}</div>
            <div style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px' }}>{hasActiveFilters ? 'No props match these filters' : 'No props available yet for this slate'}</div>
            <div style={{ fontSize: '12px', lineHeight: 1.6, maxWidth: '380px', margin: '0 auto 16px' }}>
              {hasActiveFilters ? 'Try a different sport or market, or clear the filters to see the full board.' : 'Books usually post player props closer to game time — often the morning of the game.'}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              {hasActiveFilters && (
                <button onClick={clearFilters} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontFamily: MONO }}>
                  Clear filters
                </button>
              )}
              {!hasActiveFilters && onRefresh && (
                <button onClick={onRefresh} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', color: '#5eead4', fontFamily: MONO }}>
                  Refresh odds
                </button>
              )}
              {!hasActiveFilters && onNavigate && (
                <button onClick={() => onNavigate('GAMES')} style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', fontFamily: MONO }}>
                  Browse game lines
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {sections.map(section => {
              const meta = getSportMeta(section.sport);
              const visual = visualForSport(section.sport);
              return (
                <section key={section.sport}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 14px', borderRadius: '999px', background: `${visual.color}18`, border: `1px solid ${visual.color}55` }}>
                      <span style={{ fontSize: '15px' }}>{meta.icon}</span>
                      <span style={{ fontSize: '12px', color: visual.color, fontWeight: 800, letterSpacing: '0.5px' }}>{meta.label}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8' }}>{section.total} player{section.total !== 1 ? 's' : ''}</span>
                    </div>
                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${visual.color}55, transparent)` }} />
                  </div>

                  {section.gameGroups ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {section.gameGroups.map(group => (
                        <div key={group.key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '0 2px 8px', fontSize: '12px', color: '#cbd5e1', fontWeight: 700 }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><TeamBadge team={group.visuals.away} /><TeamBadge team={group.visuals.home} /></span>
                            <span>{group.game}</span>
                            <TimingPill timing={group.timing} />
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>{group.players.length} player{group.players.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {group.players.map(player => renderPlayer(player, visual.color, false))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {section.visible.map(player => renderPlayer(player, visual.color, true))}
                    </div>
                  )}

                  {section.locked.length > 0 && <>
                    <div style={{ position: 'relative', marginTop: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none' }} aria-hidden="true">
                        {section.locked.slice(0, 2).map(p => <div key={p.key} style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px' }}><div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{p.name}</div><div style={{ fontSize: '11px', color: '#64748b' }}>{p.summaryMetrics.markets} markets</div></div>)}
                      </div>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', borderRadius: '12px', minHeight: '110px' }}>
                        <Lock size={24} color="#818cf8" style={{ marginBottom: '8px' }} />
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>+{section.locked.length} more player{section.locked.length !== 1 ? 's' : ''} locked</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Upgrade to Pro for all player props</div>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px' }}><ProBanner /></div>
                  </>}
                </section>
              );
            })}
          </div>
        )}
      </>}
    </div>
  </>);
}
