// api/_oddsFeed.js — the single place game odds are fetched upstream.
//
// Shared by /api/odds (what the board shows) and /api/verified-bets (which
// checks a logged price against the board), so verification always judges a
// bet against exactly the same market data users saw.

import { coalescedJson } from './_upstream.js';
import {
  fetchSportsGameOddsEvents,
  isSportsGameOddsEnabled,
  leagueIdForOddsSport,
  transformSgoEventToOddsApiGame,
} from './_sportsgameodds.js';
import { readSharedCache, writeSharedCache } from './_sharedCache.js';

export const ODDS_REGIONS = 'us,us2';
export const DEFAULT_MARKETS = 'h2h,spreads,totals';
export const SGO_DEFAULT_EVENT_LIMIT = 30;
export const ODDS_TTL = 30 * 1000;
export const EMPTY_TTL = 10 * 60 * 1000;

export function usesSportsGameOdds(sport) {
  return Boolean(isSportsGameOddsEnabled() && leagueIdForOddsSport(sport));
}

export function oddsCacheKey(sport, markets, eventLimit) {
  return `odds-${usesSportsGameOdds(sport) ? `sgo-${eventLimit}` : 'oddsapi'}-${sport}-${markets}-${ODDS_REGIONS}`;
}

// Returns { ok, status, data, upstream, error }. Never throws for upstream
// HTTP errors; network failures propagate to the caller.
export async function fetchFreshOdds({ sport, markets = DEFAULT_MARKETS, eventLimit = SGO_DEFAULT_EVENT_LIMIT, includeAltLines = false }) {
  if (usesSportsGameOdds(sport)) {
    const result = await fetchSportsGameOddsEvents({
      leagueID: leagueIdForOddsSport(sport),
      includeAltLines,
      limit: eventLimit,
    });
    if (!result.ok) return { ok: false, status: result.status, data: null, upstream: 'sportsgameodds', error: result.error };
    const data = result.data
      .map(transformSgoEventToOddsApiGame)
      .filter(game => game.bookmakers?.length);
    return { ok: true, status: 200, data, upstream: 'sportsgameodds' };
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return { ok: false, status: 500, data: null, upstream: 'oddsapi', error: 'API key not configured' };
  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=${ODDS_REGIONS}&markets=${markets}&oddsFormat=american`;
  const result = await coalescedJson(url);
  return { ok: result.ok, status: result.status, data: result.ok ? result.data : null, upstream: 'oddsapi' };
}

export function cacheEntryFor(data) {
  const ttl = Array.isArray(data) && data.length === 0 ? EMPTY_TTL : ODDS_TTL;
  return { data, ts: Date.now(), ttl };
}

// The freshest full-market odds for a sport: the shared cache if it is at
// most `maxAgeMs` old, otherwise a fresh upstream fetch (which also refreshes
// the shared cache for the board). Returns { ok, data, ts } — data is the
// full (Pro) book list, never the free preview.
export async function loadSportOdds(sport, { maxAgeMs = 60 * 1000 } = {}) {
  const key = oddsCacheKey(sport, DEFAULT_MARKETS, SGO_DEFAULT_EVENT_LIMIT);
  const shared = await readSharedCache(key);
  if (shared && Date.now() - shared.ts <= maxAgeMs) return { ok: true, data: shared.data, ts: shared.ts };
  const fresh = await fetchFreshOdds({ sport });
  if (!fresh.ok) return { ok: false, data: null, ts: null, status: fresh.status };
  const entry = cacheEntryFor(fresh.data);
  await writeSharedCache(key, entry);
  return { ok: true, data: entry.data, ts: entry.ts };
}
