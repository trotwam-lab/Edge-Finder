import React, { useMemo } from 'react';
import { Zap, ShoppingCart } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import {
  getMarketDisplayName,
  formatOdds,
  getBookAbbreviation,
  scorePropCandidate,
} from '../utils/props.js';

const BEST_LIMIT_FREE = 3;
const BEST_LIMIT_PRO = 12;

function ScoreBadge({ score }) {
  let color, bg, border;
  if (score >= 65) {
    color = '#fbbf24'; bg = 'rgba(251,191,36,0.15)'; border = 'rgba(251,191,36,0.35)';
  } else if (score >= 45) {
    color = '#a78bfa'; bg = 'rgba(167,139,250,0.12)'; border = 'rgba(167,139,250,0.3)';
  } else {
    color = '#64748b'; bg = 'rgba(71,85,105,0.18)'; border = 'rgba(71,85,105,0.28)';
  }
  return (
    <div title="Composite score: edge + depth + disagreement + movement + timing" style={{
      padding: '3px 8px', borderRadius: '6px', background: bg, border: `1px solid ${border}`,
      fontSize: '11px', fontWeight: 800, color,
      fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.02em', flexShrink: 0,
    }}>
      {score}
    </div>
  );
}

function RankBadge({ rank }) {
  const palettes = {
    1: { color: '#fbbf24', bg: 'rgba(251,191,36,0.18)' },
    2: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
    3: { color: '#cd7c2f', bg: 'rgba(205,124,47,0.18)' },
  };
  const { color, bg } = palettes[rank] || { color: '#475569', bg: 'rgba(71,85,105,0.12)' };
  return (
    <div style={{
      width: 22, height: 22, borderRadius: '50%', background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '10px', fontWeight: 800, color,
      fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
    }}>
      {rank}
    </div>
  );
}

function PropCard({ candidate, rank, onQuickAdd }) {
  const { player, marketKey, side, score, bestPrice, bestBook, reasons, timing } = candidate;
  const mkt = candidate.mkt;
  const line = mkt.line;
  const displayMarket = getMarketDisplayName(marketKey);
  const isOver = side === 'over';
  const accentColor = isOver ? '#22c55e' : '#ef4444';
  const accentBg = isOver ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)';

  const handleAdd = () => {
    if (!onQuickAdd || !bestBook || bestPrice == null) return;
    onQuickAdd({
      player: player.name,
      game: player.game,
      book: bestBook,
      odds: bestPrice,
      pick: `${player.name} ${displayMarket} ${isOver ? 'Over' : 'Under'} ${line ?? '—'}`,
      type: 'Player Prop',
      date: new Date().toISOString(),
    });
  };

  return (
    <div style={{
      background: 'rgba(30,41,59,0.7)',
      border: '1px solid rgba(71,85,105,0.22)',
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: '10px',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'stretch',
    }}>
      {/* Main content */}
      <div style={{ flex: 1, padding: '11px 14px' }}>
        {/* Row 1: rank + player name + score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <RankBadge rank={rank} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
              {player.name}
            </span>
            <span style={{ marginLeft: '7px', fontSize: '10px', color: '#64748b' }}>
              {player.sportMeta?.icon} {player.game}
            </span>
          </div>
          <ScoreBadge score={score} />
        </div>

        {/* Row 2: pick + best book/price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '15px', fontWeight: 800, color: accentColor, fontFamily: 'JetBrains Mono, monospace' }}>
            {isOver ? 'Over' : 'Under'} {line ?? '—'}
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{displayMarket}</span>
          {bestBook && bestPrice != null && (
            <span style={{ fontSize: '12px', color: '#cbd5e1', marginLeft: 'auto', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
              {getBookAbbreviation(bestBook)}{' '}
              <span style={{ color: bestPrice > 0 ? '#22c55e' : '#e2e8f0', fontWeight: 700 }}>
                {formatOdds(bestPrice)}
              </span>
            </span>
          )}
        </div>

        {/* Row 3: reason chips + timing */}
        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
          {reasons.map((r, i) => (
            <span key={i} style={{
              fontSize: '10px', color: '#94a3b8',
              background: 'rgba(71,85,105,0.22)', padding: '2px 6px', borderRadius: '4px',
            }}>
              {r}
            </span>
          ))}
          {timing?.key === 'live' && (
            <span style={{
              fontSize: '10px', color: '#f43f5e', fontWeight: 700,
              background: 'rgba(244,63,94,0.12)', padding: '2px 6px', borderRadius: '4px',
            }}>
              LIVE
            </span>
          )}
          {timing?.key === 'pregame' && timing?.detail && (
            <span style={{ fontSize: '10px', color: '#64748b' }}>{timing.detail}</span>
          )}
        </div>
      </div>

      {/* Quick-add button */}
      {onQuickAdd && bestBook && (
        <button
          onClick={handleAdd}
          title={`Add ${isOver ? 'Over' : 'Under'} ${line} to Bet Tracker`}
          style={{
            padding: '0 14px', background: 'transparent',
            border: 'none', borderLeft: '1px solid rgba(71,85,105,0.18)',
            cursor: 'pointer', color: '#475569',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = accentBg; e.currentTarget.style.color = accentColor; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#475569'; }}
        >
          <ShoppingCart size={14} />
        </button>
      )}
    </div>
  );
}

export default function BestProps({ players, setPendingBet }) {
  const { tier } = useAuth();

  const candidates = useMemo(() => {
    const list = [];
    players.forEach(player => {
      if (player.timing?.key === 'final') return;

      Object.entries(player.markets).forEach(([marketKey, mkt]) => {
        const result = scorePropCandidate({ marketKey, mkt, timing: player.timing });
        // Minimum signal threshold: score >= 20 and a valid book + price
        if (result.score < 20 || result.bestBook == null || result.bestPrice == null) return;
        list.push({ ...result, player, marketKey, mkt });
      });
    });
    return list.sort((a, b) => b.score - a.score);
  }, [players]);

  const limit = tier === 'pro' ? BEST_LIMIT_PRO : BEST_LIMIT_FREE;
  const visible = candidates.slice(0, limit);

  if (players.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
        No props data loaded yet.
      </div>
    );
  }

  if (candidates.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
        <div style={{ fontSize: '28px', marginBottom: '12px' }}>📊</div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8', marginBottom: '6px' }}>
          No ranked props at the moment
        </div>
        <div style={{ fontSize: '11px', lineHeight: '1.6' }}>
          Markets with sufficient book coverage, a price edge, or line movement will appear here.
          Rankings improve as more books price markets and line history builds up.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={14} color="#fbbf24" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>Best Props Right Now</span>
          <span style={{
            fontSize: '10px', color: '#64748b',
            background: 'rgba(71,85,105,0.18)', padding: '2px 7px', borderRadius: '4px',
          }}>
            {candidates.length} found
          </span>
        </div>
        <span style={{ fontSize: '10px', color: '#475569' }}>edge · depth · movement · timing</span>
      </div>

      {/* Ranked cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {visible.map((c, i) => (
          <PropCard
            key={`${c.player.key}::${c.marketKey}`}
            candidate={c}
            rank={i + 1}
            onQuickAdd={setPendingBet}
          />
        ))}
      </div>

      {/* Pro gate */}
      {tier === 'free' && candidates.length > BEST_LIMIT_FREE && (
        <div style={{ marginTop: '14px' }}>
          <div style={{
            textAlign: 'center', padding: '14px',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '10px', marginBottom: '12px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#818cf8', marginBottom: '4px' }}>
              +{candidates.length - BEST_LIMIT_FREE} more ranked props locked
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Upgrade to Pro for the full ranked list
            </div>
          </div>
          <ProBanner />
        </div>
      )}

      {/* Methodology note */}
      <div style={{
        marginTop: '16px', padding: '10px 14px',
        background: 'rgba(15,23,42,0.4)', border: '1px solid rgba(71,85,105,0.14)',
        borderRadius: '8px', fontSize: '10px', color: '#475569', lineHeight: '1.7',
      }}>
        <span style={{ color: '#64748b', fontWeight: 600 }}>How ranking works: </span>
        Price edge vs consensus fair value (up to 40 pts) · Book market depth (up to 20 pts) ·
        Line disagreement across books (up to 15 pts) · Observed line movement (up to 15 pts) ·
        Timing relevance — live/pregame (up to 10 pts). Minimum score of 20 to appear.
        Fair value is derived from vig-removal averaging across all available books.
      </div>
    </div>
  );
}
