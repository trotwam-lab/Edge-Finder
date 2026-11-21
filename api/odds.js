import { getRequestTier, isProTier } from './_auth.js';
import { burstBackoffActive } from './_upstream.js';
import { guardRequest } from './_http.js';
import { freshestEntry, isFresh, writeSharedCache } from './_sharedCache.js';
import {
  ODDS_TTL as TTL,
  SGO_DEFAULT_EVENT_LIMIT,
  cacheEntryFor,
  fetchFreshOdds,
  oddsCacheKey,
  usesSportsGameOdds,
} from './_oddsFeed.js';

const cache = {};
const FREE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm']);
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
// sport keys and the board's own markets, so a caller can't request extra
// (paid) markets or inject parameters. Every distinct market list is its own
// cache entry, so any other key or ordering would also mean a fresh,
// multi-credit upstream call on every request.
const SPORT_RE = /^[a-z0-9_]{2,64}$/;
const ALLOWED_MARKETS = ['h2h', 'spreads', 'totals'];

// "totals,h2h" → "h2h,totals"; null for anything outside ALLOWED_MARKETS.
export function normalizeMarkets(value) {
  const requested = String(value).split(',');
  if (!requested.length || requested.some(m => !ALLOWED_MARKETS.includes(m))) return null;
  return ALLOWED_MARKETS.filter(m => requested.includes(m)).join(',');
}

function clampInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'odds', rateLimit: 300 })) return;
  const { sport = 'basketball_nba' } = req.query;
  const markets = normalizeMarkets(req.query.markets ?? ALLOWED_MARKETS.join(','));
  if (!SPORT_RE.test(String(sport)) || !markets) {
    return res.status(400).json({ error: 'Invalid sport or markets' });
  }
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const useSportsGameOdds = usesSportsGameOdds(sport);
  const eventLimit = useSportsGameOdds
    ? clampInt(req.query.limit, SGO_DEFAULT_EVENT_LIMIT, SGO_MAX_EVENT_LIMIT)
    : null;
  const cacheKey = oddsCacheKey(sport, markets, eventLimit);
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
    const result = await fetchFreshOdds({
      sport,
      markets,
      eventLimit,
      includeAltLines: markets.includes('alternate') || req.query.includeAltLines === 'true',
    });
    if (!result.ok) {
      if (result.upstream === 'sportsgameodds') {
        console.warn(`sportsgameodds upstream ${result.status} for ${sport}: ${result.error || 'unknown error'}`);
        return serveDegraded(`sportsgameodds-${result.status}`);
      }
      console.warn(`odds upstream ${result.status} for ${sport}`);
      return serveDegraded(`upstream-${result.status}`);
    }

    const data = result.data;
    cache[cacheKey] = cacheEntryFor(data);
    await writeSharedCache(cacheKey, cache[cacheKey]);
    res.setHeader('X-Cache', 'MISS');
    if (result.upstream === 'sportsgameodds') res.setHeader('X-EdgeFinder-Upstream', 'sportsgameodds');
    setTierHeaders(res, tierInfo);
    return res.status(200).json(isPro ? data : buildFreeOddsPreview(data));
  } catch (e) {
    console.error(`odds error for ${sport}:`, e.message);
    return serveDegraded('upstream-unreachable');
  }
}
