import { getRequestTier, isProTier } from './_auth.js';
import { coalescedJson, burstBackoffActive } from './_upstream.js';
import {
  fetchSportsGameOddsEvents,
  isSportsGameOddsEnabled,
  leagueIdForOddsSport,
  transformSgoEventToOddsApiGame,
} from './_sportsgameodds.js';
import { guardRequest } from './_http.js';
import { freshestEntry, isFresh, writeSharedCache } from './_sharedCache.js';

const cache = {};
const TTL = 30 * 1000; // 30 seconds - fresher lines for live betting
const EMPTY_TTL = 10 * 60 * 1000; // off-season sports: stop re-asking every 30s
const FREE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm']);
const ODDS_REGIONS = 'us,us2';
const SGO_DEFAULT_EVENT_LIMIT = 30;
const SGO_MAX_EVENT_LIMIT = 80;

function buildFreeOddsPreview(data = []) {
  return data.map(game => ({
    ...game,
    bookmakers: previewBooks(game.bookmakers || []),
  }));
}

function previewBooks(bookmakers = []) {
  const preferred = bookmakers.filter(book => FREE_BOOKS.has(book.key));
  return (preferred.length ? preferred : bookmakers).slice(0, 3);
}

function setTierHeaders(res, tierInfo) {
  res.setHeader('X-EdgeFinder-Tier', isProTier(tierInfo) ? 'pro' : 'free');
  res.setHeader('X-EdgeFinder-Tier-Source', tierInfo?.source || 'unknown');
}

// Query values are interpolated into the upstream URL; only accept plain
// sport keys and a short list of market keys, so a caller can't request
// extra (paid) markets or inject parameters.
const SPORT_RE = /^[a-z0-9_]{2,64}$/;
const MARKETS_RE = /^[a-z0-9_]+(,[a-z0-9_]+){0,5}$/;

function clampInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'odds', rateLimit: 300 })) return;
  const { sport = 'basketball_nba', markets = 'h2h,spreads,totals' } = req.query;
  if (!SPORT_RE.test(String(sport)) || !MARKETS_RE.test(String(markets))) {
    return res.status(400).json({ error: 'Invalid sport or markets' });
  }
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const useSportsGameOdds = isSportsGameOddsEnabled() && leagueIdForOddsSport(sport);
  const eventLimit = useSportsGameOdds
    ? clampInt(req.query.limit, SGO_DEFAULT_EVENT_LIMIT, SGO_MAX_EVENT_LIMIT)
    : null;
  const cacheKey = `odds-${useSportsGameOdds ? `sgo-${eventLimit}` : 'oddsapi'}-${sport}-${markets}-${ODDS_REGIONS}`;
  let cached = cache[cacheKey];
  if (!isFresh(cached, TTL)) cached = await freshestEntry(cache, cacheKey);

  if (isFresh(cached, TTL)) {
    res.setHeader('X-Cache', 'HIT');
    setTierHeaders(res, tierInfo);
    return res.status(200).json(isPro ? cached.data : buildFreeOddsPreview(cached.data));
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey && !useSportsGameOdds) return res.status(500).json({ error: 'API key not configured' });

  // Stale lines beat an error page; the client keeps polling and heals itself.
  const serveDegraded = (reason) => {
    setTierHeaders(res, tierInfo);
    res.setHeader('X-EdgeFinder-Degraded', reason);
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(isPro ? cached.data : buildFreeOddsPreview(cached.data));
    }
    return res.status(200).json([]);
  };

  if (burstBackoffActive()) {
    return serveDegraded('burst-backoff');
  }

  try {
    if (useSportsGameOdds) {
      const result = await fetchSportsGameOddsEvents({
        leagueID: leagueIdForOddsSport(sport),
        includeAltLines: markets.includes('alternate') || req.query.includeAltLines === 'true',
        limit: eventLimit,
      });
      if (!result.ok) {
        console.warn(`sportsgameodds upstream ${result.status} for ${sport}: ${result.error || 'unknown error'}`);
        return serveDegraded(`sportsgameodds-${result.status}`);
      }

      const data = result.data
        .map(transformSgoEventToOddsApiGame)
        .filter(game => game.bookmakers?.length);
      const ttl = data.length === 0 ? EMPTY_TTL : TTL;
      cache[cacheKey] = { data, ts: Date.now(), ttl };
      await writeSharedCache(cacheKey, cache[cacheKey]);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-EdgeFinder-Upstream', 'sportsgameodds');
      setTierHeaders(res, tierInfo);
      return res.status(200).json(isPro ? data : buildFreeOddsPreview(data));
    }

    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=${ODDS_REGIONS}&markets=${markets}&oddsFormat=american`;
    const result = await coalescedJson(url);
    if (!result.ok) {
      console.warn(`odds upstream ${result.status} for ${sport}`);
      return serveDegraded(`upstream-${result.status}`);
    }
    const data = result.data;
    const ttl = Array.isArray(data) && data.length === 0 ? EMPTY_TTL : TTL;
    cache[cacheKey] = { data, ts: Date.now(), ttl };
    await writeSharedCache(cacheKey, cache[cacheKey]);
    res.setHeader('X-Cache', 'MISS');
    setTierHeaders(res, tierInfo);
    return res.status(200).json(isPro ? data : buildFreeOddsPreview(data));
  } catch (e) {
    console.error(`odds error for ${sport}:`, e.message);
    return serveDegraded('upstream-unreachable');
  }
}
