// api/game-markets.js — extra MLB markets (first-five run line, team totals,
// NRFI) for one game, fetched when a user opens that game.
//
// The Odds API only serves these per event, at markets x regions credits per
// call, so responses are cached (per instance and in the shared Firestore
// cache) and only requested on demand, never on the board's refresh loop.
import { getRequestTier, isProTier } from './_auth.js';
import { guardRequest } from './_http.js';
import { coalescedJson, burstBackoffActive } from './_upstream.js';
import { freshestEntry, isFresh, writeSharedCache } from './_sharedCache.js';
import { ODDS_API_EXTRA_MARKETS, transformEventMarkets } from './_gameMarkets.js';

const cache = {};
const TTL = 3 * 60 * 1000;
const ODDS_REGIONS = 'us,us2';
const FREE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm']);
const SUPPORTED_SPORTS = new Set(['baseball_mlb']);
const EVENT_ID_RE = /^[a-z0-9]{8,64}$/i;

function forTier(data, isPro) {
  if (isPro) return data;
  return { bookmakers: (data?.bookmakers || []).filter(book => FREE_BOOKS.has(book.key)) };
}

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'game-markets', rateLimit: 60 })) return;
  const { sport = '', eventId = '' } = req.query || {};
  if (!SUPPORTED_SPORTS.has(String(sport)) || !EVENT_ID_RE.test(String(eventId))) {
    return res.status(400).json({ error: 'Invalid sport or eventId' });
  }

  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const cacheKey = `game-markets-${sport}-${eventId}`;
  let cached = cache[cacheKey];
  if (!isFresh(cached, TTL)) cached = await freshestEntry(cache, cacheKey);
  if (isFresh(cached, TTL)) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(forTier(cached.data, isPro));
  }

  const apiKey = process.env.ODDS_API_KEY;
  const empty = { bookmakers: [] };
  if (!apiKey) return res.status(200).json(cached ? forTier(cached.data, isPro) : empty);
  if (burstBackoffActive()) return res.status(200).json(cached ? forTier(cached.data, isPro) : empty);

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds?apiKey=${apiKey}&regions=${ODDS_REGIONS}&markets=${ODDS_API_EXTRA_MARKETS.join(',')}&oddsFormat=american`;
    const result = await coalescedJson(url);
    if (!result.ok) {
      // 404/422 mean the event or its markets aren't available (e.g. already
      // started); cache that briefly so repeated opens don't re-spend quota.
      if ([404, 422].includes(result.status)) {
        cache[cacheKey] = { data: empty, ts: Date.now(), ttl: TTL };
      }
      return res.status(200).json(cached ? forTier(cached.data, isPro) : empty);
    }
    const data = transformEventMarkets(result.data);
    cache[cacheKey] = { data, ts: Date.now(), ttl: TTL };
    await writeSharedCache(cacheKey, cache[cacheKey]);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(forTier(data, isPro));
  } catch (error) {
    console.warn(`game-markets error for ${eventId}:`, error.message);
    return res.status(200).json(cached ? forTier(cached.data, isPro) : empty);
  }
}
