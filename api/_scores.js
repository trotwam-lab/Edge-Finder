// api/_scores.js — final scores for grading, from two independent sources.
//
// The Odds API scores feed is primary. ESPN's public scoreboard fills in
// games the primary feed doesn't have (it only reaches back 3 days, and its
// team naming can differ from the odds feed we priced the bet on). ESPN rows
// are only used for games the primary feed lacks, so the same game is never
// listed twice — and grading (src/utils/grading.js) still refuses anything
// ambiguous or not explicitly final.

import { coalescedJson } from './_upstream.js';
import { ESPN_SITE_BASE, SPORT_PATHS } from './_espn-paths.js';
import { normalizeTeam } from '../src/utils/grading.js';

const SPORT_RE = /^[a-z0-9_]{2,64}$/;
const TTL = 2 * 60 * 1000;
const cache = new Map();
const MATCH_WINDOW_MS = 12 * 60 * 60 * 1000;

// College scoreboards default to ranked/featured games; these group ids ask
// ESPN for all Division I games.
const ESPN_GROUPS = {
  americanfootball_ncaaf: '80',
  basketball_ncaab: '50',
  basketball_wncaab: '50',
};

async function cached(key, load) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL) return hit.data;
  const data = await load();
  if (data) cache.set(key, { data, ts: Date.now() });
  return data;
}

// ESPN scoreboards are organised by US Eastern calendar day.
export function etDateKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date).replace(/-/g, '');
}

export async function fetchOddsApiScoreRows(sport) {
  if (!SPORT_RE.test(sport)) return null;
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;
  return cached(`oddsapi:${sport}`, async () => {
    const result = await coalescedJson(`https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=3`);
    return result.ok && Array.isArray(result.data) ? result.data : null;
  });
}

// One ESPN event → an Odds-API-shaped score row. Final only when ESPN says
// the game is completed (postponed/cancelled games are "post" but not
// completed, and are never graded).
export function espnEventToScoreRow(event) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  if (!home?.team?.displayName || !away?.team?.displayName) return null;
  const type = (competition.status || event.status || {}).type || {};
  return {
    id: `espn:${event.id}`,
    home_team: home.team.displayName,
    away_team: away.team.displayName,
    commence_time: event.date,
    completed: type.completed === true,
    scores: [
      { name: home.team.displayName, score: home.score == null ? null : String(home.score) },
      { name: away.team.displayName, score: away.score == null ? null : String(away.score) },
    ],
    source: 'ESPN final scores',
  };
}

export async function fetchEspnScoreRows(sport, dates = []) {
  const path = SPORT_PATHS[sport];
  if (!path) return null;
  const rows = [];
  let anyOk = false;
  for (const date of [...new Set(dates)].filter(d => /^\d{8}$/.test(d)).slice(0, 4)) {
    const groups = ESPN_GROUPS[sport] ? `&groups=${ESPN_GROUPS[sport]}&limit=500` : '';
    const data = await cached(`espn:${sport}:${date}`, async () => {
      // Plain fetch: an ESPN rate limit must not pause the Odds API (which
      // coalescedJson's burst backoff would do).
      try {
        const res = await fetch(`${ESPN_SITE_BASE}/${path}/scoreboard?dates=${date}${groups}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const json = await res.json();
        return Array.isArray(json?.events) ? json.events : null;
      } catch {
        return null;
      }
    });
    if (!data) continue;
    anyOk = true;
    data.forEach(event => {
      const row = espnEventToScoreRow(event);
      if (row) rows.push(row);
    });
  }
  return anyOk ? rows : null;
}

const sameGame = (a, b) => normalizeTeam(a.home_team) === normalizeTeam(b.home_team)
  && normalizeTeam(a.away_team) === normalizeTeam(b.away_team)
  && Math.abs(Date.parse(a.commence_time) - Date.parse(b.commence_time)) <= MATCH_WINDOW_MS;

// Primary rows, plus fallback rows for games the primary feed doesn't list.
export function mergeScoreRows(primary, fallback) {
  const base = Array.isArray(primary) ? primary : [];
  const extra = (Array.isArray(fallback) ? fallback : []).filter(row => !base.some(p => sameGame(p, row)));
  return [...base, ...extra];
}

// Score rows for a sport. `dates` (YYYYMMDD, Eastern) tell the fallback
// which scoreboards to read. Null when neither source answered.
export async function fetchScoreRows(sport, { dates = [] } = {}) {
  const [primary, fallback] = await Promise.all([
    fetchOddsApiScoreRows(sport).catch(() => null),
    dates.length ? fetchEspnScoreRows(sport, dates).catch(() => null) : null,
  ]);
  if (!primary && !fallback) return null;
  return mergeScoreRows(primary, fallback);
}
