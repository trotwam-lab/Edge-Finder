// The reasoning behind a flagged edge, plus one tap to track it with a
// conservative stake suggestion. Pro edges only (they carry price + fair %).
import React from 'react';
import { Target } from 'lucide-react';
import { edgeToPendingBet, explainEdge, kellyStake } from '../utils/edgeMath.js';
import { formatOdds } from '../utils/odds-math.js';

function savedBankroll() {
  try {
    const value = Number(JSON.parse(localStorage.getItem('edgefinder_bankroll_settings'))?.bankroll);
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export default function EdgeWhy({ edge, onTrack }) {
  const why = explainEdge(edge);
  if (!why) return null;
  const sizing = kellyStake({ price: edge.price, fairProb: why.fairPct / 100, bankroll: savedBankroll() });
  const stake = sizing?.stake || null;
  const canTrack = Boolean(onTrack && edge.gameId && edge.market && edge.outcomeName);

  return (
    <div style={{ marginTop: '6px', fontSize: '11px', color: '#94a3b8', lineHeight: 1.55 }}>
      <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Why: </span>
      {edge.book} pays <span className="ef-mono" style={{ color: '#e2e8f0' }}>{formatOdds(edge.price)}</span> ({why.impliedPct}% implied).
      The no-vig consensus of the other books puts this at {why.fairPct}% — a fair price of <span className="ef-mono">{formatOdds(why.fairAmerican)}</span>.
      That {why.gapPct}-point gap is worth about <span style={{ color: '#22c55e', fontWeight: 700 }}>+{why.evPct}%</span> per bet over time; it isn't a guarantee on any one game.
      {canTrack && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onTrack(edgeToPendingBet(edge, stake))}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px',
              border: '1px solid var(--ef-accent-border)', background: 'var(--ef-accent-soft)', color: 'var(--ef-cyan)',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--ef-font-body)',
            }}
          >
            <Target size={12} /> Track this bet
          </button>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            {stake
              ? `Suggested stake $${stake} (¼ Kelly${sizing.capped ? ', capped at 5% of bankroll' : ''}) — you confirm before it's saved.`
              : 'Add a bankroll in setup to get a suggested stake.'}
          </span>
        </div>
      )}
    </div>
  );
}
