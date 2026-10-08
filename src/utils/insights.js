// src/utils/insights.js — where a bettor's results come from. Pure helpers
// behind the tracker's Insights panel (unit tested).
import { getTimingValue, parseBetDate } from './bets.js';

const round = (n, d = 2) => Number(n.toFixed(d));

export function betMarketType(bet) {
  if (bet?.type === 'Parlay' || Array.isArray(bet?.legs)) return 'Parlay';
  const key = String(bet?.marketKey || '');
  if (key.startsWith('player_') || bet?.player || /prop/i.test(bet?.type || '')) return 'Player prop';
  if (key === 'spreads' || bet?.type === 'Spread') return 'Spread';
  if (key === 'totals' || bet?.type === 'Total') return 'Total';
  if (key === 'h2h' || bet?.type === 'Moneyline') return 'Moneyline';
  return bet?.type || 'Other';
}

export function betBook(bet) {
  return bet?.book || bet?.bookTitle || bet?.bookKey || 'Not recorded';
}

// Price buckets, from heavy favourites to longshots.
export const ODDS_BUCKETS = ['-200 or shorter', '-199 to -120', '-119 to +119', '+120 to +199', '+200 or longer'];
export function oddsBucket(bet) {
  const odds = Number(bet?.odds);
  if (!Number.isFinite(odds) || (odds > -100 && odds < 100)) return 'Unknown';
  if (odds <= -200) return ODDS_BUCKETS[0];
  if (odds <= -120) return ODDS_BUCKETS[1];
  if (odds < 120) return ODDS_BUCKETS[2];
  if (odds < 200) return ODDS_BUCKETS[3];
  return ODDS_BUCKETS[4];
}

// How early the bet went in, measured from when it was logged (bet ids are
// creation timestamps) to the scheduled start.
export const TIMING_BUCKETS = ['24h+ before', '6–24h before', '1–6h before', 'Under 1h before'];
export function timingBucket(bet) {
  const placed = Number(bet?.id);
  const start = Date.parse(bet?.commenceTime || '');
  if (!Number.isFinite(placed) || placed < 1e12 || !Number.isFinite(start) || placed > start) return 'Unknown';
  const hours = (start - placed) / 3600000;
  if (hours >= 24) return TIMING_BUCKETS[0];
  if (hours >= 6) return TIMING_BUCKETS[1];
  if (hours >= 1) return TIMING_BUCKETS[2];
  return TIMING_BUCKETS[3];
}

// Results grouped by `keyFn`. ROI is on stakes. "Beat close" is the share
// of bets with a recorded close that beat it — unit-free, so spreads (points)
// and moneylines (%) can be combined honestly.
export function breakdown(bets, keyFn, order = null) {
  const groups = new Map();
  (bets || []).forEach(bet => {
    if (!bet || bet.deleted) return;
    const key = keyFn(bet);
    if (!groups.has(key)) groups.set(key, { key, bets: 0, settled: 0, wins: 0, losses: 0, pushes: 0, wagered: 0, profit: 0, beat: 0, timed: 0 });
    const g = groups.get(key);
    g.bets += 1;
    const timing = getTimingValue(bet);
    if (timing) { g.timed += 1; if (timing.value > 0) g.beat += 1; }
    if (bet.status === 'pending') return;
    g.settled += 1;
    if (bet.status === 'won') g.wins += 1;
    else if (bet.status === 'lost') g.losses += 1;
    else g.pushes += 1;
    g.wagered += Number(bet.wager) || 0;
    g.profit += Number(bet.profit) || 0;
  });
  const rows = [...groups.values()].map(g => ({
    key: g.key,
    bets: g.bets,
    settled: g.settled,
    record: `${g.wins}-${g.losses}-${g.pushes}`,
    winPct: g.wins + g.losses ? round((g.wins / (g.wins + g.losses)) * 100, 1) : null,
    profit: round(g.profit),
    roi: g.wagered > 0 ? round((g.profit / g.wagered) * 100, 1) : null,
    beatClosePct: g.timed ? round((g.beat / g.timed) * 100, 0) : null,
    timed: g.timed,
  }));
  if (order) return rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return rows.sort((a, b) => b.settled - a.settled || b.bets - a.bets);
}

function settledAt(bet) {
  const date = parseBetDate(bet.settledDate || bet.date || '');
  return Number.isNaN(date.getTime()) ? Number(bet.updatedAt) || 0 : date.getTime();
}

// Running bankroll over settled bets, oldest first, with the deepest
// peak-to-trough drop. `start` is the starting bankroll (0 = P/L only).
export function bankrollSeries(bets, start = 0) {
  const settled = (bets || [])
    .filter(b => b && !b.deleted && b.status && b.status !== 'pending')
    .sort((a, b) => settledAt(a) - settledAt(b) || (Number(a.updatedAt) || 0) - (Number(b.updatedAt) || 0));
  let balance = Number(start) || 0;
  let peak = balance;
  let peakIndex = 0;
  let maxDrawdown = { amount: 0, pct: null, fromIndex: null, toIndex: null };
  const points = [{ index: 0, label: 'Start', balance: round(balance) }];
  settled.forEach((bet, i) => {
    balance += Number(bet.profit) || 0;
    const index = i + 1;
    points.push({ index, label: bet.settledDate || bet.date || `#${index}`, balance: round(balance) });
    if (balance > peak) { peak = balance; peakIndex = index; }
    const drop = peak - balance;
    if (drop > maxDrawdown.amount) {
      maxDrawdown = {
        amount: round(drop),
        pct: peak > 0 ? round((drop / peak) * 100, 1) : null,
        fromIndex: peakIndex,
        toIndex: index,
      };
    }
  });
  return {
    points,
    final: round(balance),
    peak: round(peak),
    currentDrawdown: round(peak - balance),
    maxDrawdown,
  };
}

const normText = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9.+-]+/g, ' ').trim();

// An existing (non-deleted) bet with the same game, pick, price and date.
export function findDuplicate(bets, candidate) {
  return (bets || []).find(b => !b.deleted
    && normText(b.game) === normText(candidate.game)
    && normText(b.pick) === normText(candidate.pick)
    && Number(b.odds) === Number(candidate.odds)
    && String(b.date) === String(candidate.date)) || null;
}

// CSV export. Text cells that a spreadsheet would treat as a formula are
// prefixed with an apostrophe (CSV injection), and quotes are escaped.
const CSV_COLUMNS = [
  ['date', 'Date'], ['game', 'Game'], ['type', 'Type'], ['pick', 'Pick'], ['odds', 'Odds'],
  ['wager', 'Stake'], ['status', 'Result'], ['profit', 'Profit'], ['book', 'Book'],
  ['closingOdds', 'Closing odds'], ['closingPoint', 'Closing line'], ['settledDate', 'Settled'],
];

function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^[+-]?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function betsToCsv(bets) {
  const rows = (bets || []).filter(b => b && !b.deleted);
  const header = [...CSV_COLUMNS.map(([, label]) => label), 'Legs'].join(',');
  const lines = rows.map(b => [
    ...CSV_COLUMNS.map(([key]) => csvCell(b[key])),
    csvCell(Array.isArray(b.legs) ? b.legs.map(l => `${l.label} (${l.odds})`).join('; ') : ''),
  ].join(','));
  return [header, ...lines].join('\r\n');
}
