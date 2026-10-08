// src/utils/edgeMath.js — explaining a flagged edge and sizing it. Pure.
import { americanToDecimal, decimalToAmerican } from './parlay.js';

const pct = (n, d = 1) => Number((n * 100).toFixed(d));

// Plain-language reasons behind an edge from /api/edges (Pro payload).
export function explainEdge(edge) {
  const decimal = americanToDecimal(edge?.price);
  const fair = Number(edge?.fairProbability) / 100;
  if (!decimal || !Number.isFinite(fair) || fair <= 0 || fair >= 1) return null;
  const implied = 1 / decimal;
  return {
    impliedPct: pct(implied),
    fairPct: pct(fair),
    fairAmerican: decimalToAmerican(1 / fair),
    evPct: Number(((decimal * fair - 1) * 100).toFixed(1)),
    gapPct: Number(((fair - implied) * 100).toFixed(1)),
  };
}

// Kelly sizing on the fair probability: f* = (b·p − q) / b with b = decimal − 1.
// Suggests a fraction of full Kelly (quarter by default — full Kelly is far too
// volatile for estimated probabilities), capped at `cap` of bankroll.
export function kellyStake({ price, fairProb, bankroll, fraction = 0.25, cap = 0.05 }) {
  const decimal = americanToDecimal(price);
  const p = Number(fairProb);
  const roll = Number(bankroll);
  if (!decimal || !Number.isFinite(p) || p <= 0 || p >= 1) return null;
  const b = decimal - 1;
  const full = (b * p - (1 - p)) / b;
  if (!(full > 0)) return { fullKellyPct: 0, stake: 0, capped: false };
  const share = Math.min(full * fraction, cap);
  return {
    fullKellyPct: Number((full * 100).toFixed(2)),
    sharePct: Number((share * 100).toFixed(2)),
    stake: Number.isFinite(roll) && roll > 0 ? Math.max(1, Math.round(roll * share)) : null,
    capped: full * fraction > cap,
  };
}

// A tracker bet pre-filled from an edge (the user confirms the stake).
export function edgeToPendingBet(edge, stake = null) {
  const point = edge.outcomePoint ?? null;
  const fmtPoint = point == null ? '' : ` ${point > 0 ? '+' : ''}${point}`;
  const type = edge.market === 'spreads' ? 'Spread' : edge.market === 'totals' ? 'Total' : 'Moneyline';
  const pick = edge.market === 'h2h' ? `${edge.outcomeName} ML` : `${edge.outcomeName}${fmtPoint}`;
  return {
    game: edge.awayTeam && edge.homeTeam ? `${edge.awayTeam} vs ${edge.homeTeam}` : String(edge.game || '').replace(' @ ', ' vs '),
    type,
    pick,
    odds: edge.price,
    wager: stake || null,
    date: edge.commenceTime,
    gameId: edge.gameId,
    sportKey: edge.sportKey || null,
    marketKey: edge.market,
    outcomeName: edge.outcomeName,
    outcomePoint: point,
    commenceTime: edge.commenceTime,
    book: edge.book,
    bookKey: edge.bookKey || null,
  };
}
