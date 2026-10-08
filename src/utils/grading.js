// src/utils/grading.js
// Pure, deterministic bet grading from a final score. Shared by the server
// (verified ledger) and the client (tracker), so a result is computed the
// same way everywhere and anyone can re-check it from the public score.
//
// Safety rules — when in doubt, do NOT grade (the bet stays pending and the
// user can settle it by hand):
//   * only full-game h2h / spreads / totals markets;
//   * only sports whose final score is what those markets settle on
//     (basketball, American football, baseball, hockey). Soccer is excluded
//     on purpose: its markets settle on 90 minutes, but a "final" score can
//     include extra time;
//   * only when the game is marked completed and both scores are numbers;
//   * the score must match the bet's game unambiguously.

const GRADEABLE_SPORT_PREFIXES = ['basketball_', 'americanfootball_', 'baseball_', 'icehockey_'];
const GRADEABLE_MARKETS = new Set(['h2h', 'spreads', 'totals']);

export function isAutoGradeable(bet) {
  const sportKey = String(bet?.sportKey || '');
  return GRADEABLE_SPORT_PREFIXES.some(prefix => sportKey.startsWith(prefix))
    && GRADEABLE_MARKETS.has(bet?.marketKey)
    && Boolean(bet?.outcomeName);
}

export function normalizeTeam(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toScore(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Accepts an Odds API style score row ({ home_team, away_team, completed,
// scores: [{ name, score }] }) and returns { home, away, completed } with
// numeric scores, or null when the row can't be trusted.
export function readFinalScore(row) {
  if (!row || row.completed !== true) return null;
  const scores = Array.isArray(row.scores) ? row.scores : [];
  const home = toScore(scores.find(s => normalizeTeam(s?.name) === normalizeTeam(row.home_team))?.score);
  const away = toScore(scores.find(s => normalizeTeam(s?.name) === normalizeTeam(row.away_team))?.score);
  if (home === null || away === null) return null;
  return { homeTeam: row.home_team, awayTeam: row.away_team, home, away, completed: true };
}

const MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;

// Find the one score row for a bet's game. Exact id first; otherwise the same
// two teams starting within 12h. More than one candidate (doubleheaders) means
// we can't be sure which game it was — return null rather than guess.
export function findScoreRow(rows, { gameId, homeTeam, awayTeam, commenceTime }) {
  if (!Array.isArray(rows)) return null;
  const byId = gameId ? rows.filter(r => r?.id === gameId) : [];
  if (byId.length === 1) return byId[0];
  const home = normalizeTeam(homeTeam);
  const away = normalizeTeam(awayTeam);
  if (!home || !away) return null;
  const start = Date.parse(commenceTime || '');
  const candidates = rows.filter(r => {
    if (normalizeTeam(r?.home_team) !== home || normalizeTeam(r?.away_team) !== away) return false;
    const t = Date.parse(r?.commence_time || '');
    return Number.isFinite(start) && Number.isFinite(t) && Math.abs(t - start) <= MATCH_WINDOW_MS;
  });
  return candidates.length === 1 ? candidates[0] : null;
}

// Grade one bet against a final score. Returns 'won' | 'lost' | 'push', or
// null when the bet can't be graded safely.
export function gradeBet(bet, final) {
  if (!isAutoGradeable(bet) || !final?.completed) return null;
  const { home, away, homeTeam, awayTeam } = final;
  if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
  const pick = normalizeTeam(bet.outcomeName);
  const isHome = pick === normalizeTeam(homeTeam);
  const isAway = pick === normalizeTeam(awayTeam);
  const point = bet.outcomePoint == null ? null : Number(bet.outcomePoint);

  if (bet.marketKey === 'h2h') {
    if (!isHome && !isAway) return null; // e.g. a "Draw" outcome — not graded here
    if (home === away) return 'push';
    return (isHome ? home > away : away > home) ? 'won' : 'lost';
  }

  if (bet.marketKey === 'spreads') {
    if ((!isHome && !isAway) || !Number.isFinite(point)) return null;
    const margin = (isHome ? home - away : away - home) + point;
    if (margin === 0) return 'push';
    return margin > 0 ? 'won' : 'lost';
  }

  if (bet.marketKey === 'totals') {
    if (!Number.isFinite(point)) return null;
    const total = home + away;
    if (total === point) return 'push';
    if (pick === 'over') return total > point ? 'won' : 'lost';
    if (pick === 'under') return total < point ? 'won' : 'lost';
    return null;
  }

  return null;
}
