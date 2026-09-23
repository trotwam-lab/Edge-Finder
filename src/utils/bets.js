// src/utils/bets.js
// Pure bet-tracker helpers: calendar-day handling, closing-line value, timing
// grades, settlement math and sport detection. Kept out of BetTracker.jsx so
// they can be unit tested.
import { americanToDecimal, americanToImplied } from './odds-math.js';
import { getSportMeta } from './props.js';

// Bet dates are stored as local calendar days (YYYY-MM-DD). toISOString()
// would use the UTC day, so a bet logged on a US evening landed on tomorrow.
export function toLocalDateStr(value = new Date()) {
  const date = value instanceof Date ? value : parseBetDate(value);
  if (Number.isNaN(date.getTime())) return toLocalDateStr(new Date());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function todayStr() {
  return toLocalDateStr(new Date());
}

// new Date('YYYY-MM-DD') parses as UTC midnight, which is the previous
// evening west of Greenwich — parse bare dates as local days instead.
export function parseBetDate(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(value);
}

export function formatOdds(odds) {
  if (odds === null || odds === undefined || Number.isNaN(Number(odds))) return '—';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function formatPoint(point) {
  if (point === null || point === undefined || Number.isNaN(Number(point))) return '—';
  const n = Number(point);
  return n > 0 ? `+${n}` : `${n}`;
}

// CLV (Closing Line Value) — compares the price you got to the closing price.
// Positive CLV means you beat the close (good timing); negative means the market
// moved against you. Measured in implied-probability points for accuracy.
export function calculateCLV(placedOdds, closingOdds) {
  if (placedOdds == null || closingOdds == null) return null;
  const pPlaced = americanToImplied(Number(placedOdds));
  const pClose = americanToImplied(Number(closingOdds));
  if (!pPlaced || !pClose) return null;
  // A lower implied prob at the time of bet = better price than close.
  // CLV = (close - placed) * 100 in percentage points.
  return Number(((pClose - pPlaced) * 100).toFixed(2));
}

export function getBetPoint(bet) {
  return bet?.betPoint ?? bet?.outcomePoint ?? bet?.openingPoint ?? null;
}

export function getPointCLV(bet, closingPoint = bet?.closingPoint) {
  const betPoint = getBetPoint(bet);
  if (betPoint == null || closingPoint == null) return null;
  const placed = Number(betPoint);
  const close = Number(closingPoint);
  if (Number.isNaN(placed) || Number.isNaN(close)) return null;
  const marketKey = bet?.marketKey || '';
  const outcome = String(bet?.outcomeName || bet?.pick || '').toLowerCase();

  if (marketKey === 'spreads' || bet?.type === 'Spread') {
    return Number((placed - close).toFixed(2));
  }
  if (marketKey === 'totals' || marketKey.includes('player_') || bet?.type === 'Total' || bet?.type === 'Prop' || bet?.type === 'Player Prop') {
    if (outcome.includes('under')) return Number((placed - close).toFixed(2));
    if (outcome.includes('over')) return Number((close - placed).toFixed(2));
  }
  return null;
}

export function getOpenerPointEdge(bet) {
  const betPoint = getBetPoint(bet);
  if (betPoint == null || bet?.openingPoint == null) return null;
  return getPointCLV({ ...bet, closingPoint: bet.openingPoint }, bet.openingPoint);
}

export function getTimingValue(bet) {
  const pointClv = getPointCLV(bet);
  const priceClv = calculateCLV(bet?.odds, bet?.closingOdds);
  if (pointClv != null) return { type: 'point', value: pointClv };
  if (priceClv != null) return { type: 'price', value: priceClv };
  return null;
}

// Opening-line edge — how much better/worse the price you got was vs
// the opening number. Positive = you got the opener value, negative = late.
export function calculateOpenerEdge(placedOdds, openingOdds) {
  if (placedOdds == null || openingOdds == null) return null;
  const pPlaced = americanToImplied(Number(placedOdds));
  const pOpen = americanToImplied(Number(openingOdds));
  if (!pPlaced || !pOpen) return null;
  return Number(((pOpen - pPlaced) * 100).toFixed(2));
}

// Classify a bet's timing into a grade so users can see at a glance how
// sharp their bet-placement was vs the market's eventual resolution.
export function gradeTiming(clv) {
  if (clv == null) return { label: '—', color: '#64748b', bg: 'rgba(100,116,139,0.15)' };
  if (clv >= 3)  return { label: 'Sharp',     color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
  if (clv >= 1)  return { label: 'Good',      color: '#84cc16', bg: 'rgba(132,204,22,0.15)' };
  if (clv > -1)  return { label: 'Neutral',   color: '#eab308', bg: 'rgba(234,179,8,0.15)' };
  if (clv > -3)  return { label: 'Late',      color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  return           { label: 'Chased',    color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
}

export function gradeLineTiming(pointClv) {
  if (pointClv == null) return { label: '—', color: '#64748b', bg: 'rgba(100,116,139,0.15)' };
  if (pointClv >= 1.5) return { label: 'Sharp', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
  if (pointClv >= 0.5) return { label: 'Good', color: '#84cc16', bg: 'rgba(132,204,22,0.15)' };
  if (pointClv > -0.5) return { label: 'Neutral', color: '#eab308', bg: 'rgba(234,179,8,0.15)' };
  if (pointClv > -1.5) return { label: 'Late', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  return { label: 'Chased', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
}

export function gradePortfolioTiming(beatCloseRate, recordedBets) {
  if (!recordedBets) return { label: 'Needs Data', color: '#64748b', bg: 'rgba(100,116,139,0.14)' };
  if (beatCloseRate >= 60) return { label: 'Sharp Timing', color: '#22c55e', bg: 'rgba(34,197,94,0.14)' };
  if (beatCloseRate >= 52) return { label: 'Positive Timing', color: '#84cc16', bg: 'rgba(132,204,22,0.14)' };
  if (beatCloseRate >= 45) return { label: 'Neutral Timing', color: '#eab308', bg: 'rgba(234,179,8,0.14)' };
  return { label: 'Chasing Numbers', color: '#ef4444', bg: 'rgba(239,68,68,0.14)' };
}

export function formatTimingValue(timing) {
  if (!timing) return '—';
  const sign = timing.value >= 0 ? '+' : '';
  return timing.type === 'point'
    ? `${sign}${timing.value.toFixed(2)} pts`
    : `${sign}${timing.value.toFixed(2)}%`;
}

export function getRelativeDate(dateStr) {
  const date = parseBetDate(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const betDate = new Date(date);
  betDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - betDate) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

// Bets added from the board carry their sport key; hand-entered bets fall
// back to guessing from the game text.
export function getBetSport(bet) {
  if (bet?.sport) return bet.sport;
  if (bet?.sportKey) {
    const meta = getSportMeta(bet.sportKey);
    if (meta.family !== 'other') return meta.label === 'MMA' ? 'UFC' : meta.label;
  }
  return getSportFromGame(bet?.game);
}

export function getSportFromGame(gameStr) {
  if (!gameStr) return 'Other';
  const game = gameStr.toLowerCase();
  if (game.includes('lakers') || game.includes('celtics') || game.includes('nba')) return 'NBA';
  if (game.includes('chiefs') || game.includes('eagles') || game.includes('nfl')) return 'NFL';
  if (game.includes('ufc') || game.includes('fight')) return 'UFC';
  if (game.includes('yankees') || game.includes('mlb')) return 'MLB';
  return 'Other';
}

// Profit for a settled bet: win pays the American price, loss costs the
// stake, push (or anything else) returns it.
export function settleProfit(bet, result) {
  const wager = Number(bet?.wager) || 0;
  if (result === 'won') {
    const decimal = americanToDecimal(Number(bet.odds));
    return Number((wager * (decimal - 1)).toFixed(2));
  }
  if (result === 'lost') return -wager;
  return 0;
}
