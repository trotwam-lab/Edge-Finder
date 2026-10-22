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
// Batch mode (?sports=a,b,c): one request covers several sports, so the board
// costs a handful of function calls instead of one per sport. Upstream misses
// inside a batch run a few at a time to stay under the provider's burst limit.
const MAX_BATCH_SPORTS = 12;
const BATCH_UPSTREAM_CONCURRENCY = 2;
// Vercel caps a function response at 4.5MB; stay well clear of it.
const MAX_BATCH_BYTES = 3.5 * 1024 * 1024;

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

// A rate limit, a provider outage or a network failure says nothing about
// whether games exist, so with no cached board to fall back on the answer is
// "unavailable, retry" — never an empty list the client would show as "no
// games". Other 4xx answers (unknown sport, quota gone) really mean nothing
// to show.
function isTransientStatus(status) {
  return status === 429 || !Number.isFinite(status) || status >= 500;
}

async function readSportCache(cacheKey) {
  let cached = cache[cacheKey];
  if (!isFresh(cached, TTL)) cached = await freshestEntry(cache, cacheKey);
  return cached || null;
}

// Resolves one sport to { data, cacheStatus, degraded?, upstream? } or, when
// there is nothing to serve, { data: null, degraded, transient }.
async function resolveSport({ sport, markets, eventLimit, includeAltLines, cached }) {
  if (isFresh(cached, TTL)) return { data: cached.data, cacheStatus: 'HIT' };

  // Stale lines beat an error page; the client keeps polling and heals itself.
  const degraded = (reason, transient) => (cached
    ? { data: cached.data, cacheStatus: 'STALE', degraded: reason }
    : { data: null, degraded: reason, transient });

  if (burstBackoffActive()) return degraded('burst-backoff', true);

  try {
    const result = await fetchFreshOdds({ sport, markets, eventLimit, includeAltLines });
    if (!result.ok) {
      if (result.upstream === 'sportsgameodds') {
        console.warn(`sportsgameodds upstream ${result.status} for ${sport}: ${result.error || 'unknown error'}`);
        return degraded(`sportsgameodds-${result.status}`, isTransientStatus(result.status));
      }
      console.warn(`odds upstream ${result.status} for ${sport}`);
      return degraded(`upstream-${result.status}`, isTransientStatus(result.status));
    }

    const cacheKey = oddsCacheKey(sport, markets, eventLimit);
    cache[cacheKey] = cacheEntryFor(result.data);
    await writeSharedCache(cacheKey, cache[cacheKey]);
    return { data: result.data, cacheStatus: 'MISS', upstream: result.upstream };
  } catch (e) {
    console.error(`odds error for ${sport}:`, e.message);
    return degraded('upstream-unreachable', true);
  }
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

function eventLimitFor(sport, query) {
  return usesSportsGameOdds(sport)
    ? clampInt(query.limit, SGO_DEFAULT_EVENT_LIMIT, SGO_MAX_EVENT_LIMIT)
    : null;
}

function parseSportList(value) {
  const list = [...new Set(String(value).split(',').map(s => s.trim()).filter(Boolean))];
  if (!list.length || list.length > MAX_BATCH_SPORTS || !list.every(s => SPORT_RE.test(s))) return null;
  return list;
}

async function handleBatch(req, res, { sports, markets, includeAltLines }) {
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const apiKey = process.env.ODDS_API_KEY;

  const entries = sports.map(sport => {
    const eventLimit = eventLimitFor(sport, req.query);
    return { sport, markets, eventLimit, includeAltLines, cacheKey: oddsCacheKey(sport, markets, eventLimit) };
  });
  // Cache lookups are cheap and independent — do them all at once.
  await Promise.all(entries.map(async entry => { entry.cached = await readSportCache(entry.cacheKey); }));

  const results = await mapWithConcurrency(entries, BATCH_UPSTREAM_CONCURRENCY, async (entry) => {
    if (!isFresh(entry.cached, TTL) && !apiKey && !usesSportsGameOdds(entry.sport)) {
      return { error: 'API key not configured', transient: false };
    }
    return resolveSport(entry);
  });

  const body = { sports: {} };
  let bytes = 0;
  entries.forEach((entry, i) => {
    const result = results[i];
    if (result.error) {
      body.sports[entry.sport] = { error: result.error };
    } else if (result.data == null) {
      body.sports[entry.sport] = result.transient
        ? { error: 'unavailable', reason: result.degraded, retry: true }
        : { games: [], degraded: result.degraded };
    } else {
      const games = isPro ? result.data : buildFreeOddsPreview(result.data);
      const size = Buffer.byteLength(JSON.stringify(games));
      // Never let a batch outgrow the platform's response cap; the client
      // fetches anything left over on its own.
      if (bytes + size > MAX_BATCH_BYTES) {
        body.sports[entry.sport] = { error: 'too-large', retry: true, single: true };
        return;
      }
      bytes += size;
      body.sports[entry.sport] = {
        games,
        cache: result.cacheStatus,
        ...(result.degraded ? { degraded: result.degraded } : {}),
      };
    }
  });
  setTierHeaders(res, tierInfo);
  return res.status(200).json(body);
}

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'odds', rateLimit: 300 })) return;
  const { sport = 'basketball_nba', markets = 'h2h,spreads,totals' } = req.query;
  if (!MARKETS_RE.test(String(markets))) {
    return res.status(400).json({ error: 'Invalid sport or markets' });
  }
  const includeAltLines = String(markets).includes('alternate') || req.query.includeAltLines === 'true';

  if (req.query.sports != null) {
    const sports = parseSportList(req.query.sports);
    if (!sports) return res.status(400).json({ error: `Invalid sports list (1-${MAX_BATCH_SPORTS} sport keys)` });
    return handleBatch(req, res, { sports, markets: String(markets), includeAltLines });
  }

  if (!SPORT_RE.test(String(sport))) {
    return res.status(400).json({ error: 'Invalid sport or markets' });
  }
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const eventLimit = eventLimitFor(sport, req.query);
  const cached = await readSportCache(oddsCacheKey(sport, markets, eventLimit));

  if (isFresh(cached, TTL)) {
    res.setHeader('X-Cache', 'HIT');
    setTierHeaders(res, tierInfo);
    return res.status(200).json(isPro ? cached.data : buildFreeOddsPreview(cached.data));
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey && !usesSportsGameOdds(sport)) return res.status(500).json({ error: 'API key not configured' });

  const result = await resolveSport({ sport, markets, eventLimit, includeAltLines, cached });
  setTierHeaders(res, tierInfo);
  if (result.degraded) res.setHeader('X-EdgeFinder-Degraded', result.degraded);
  if (result.data == null) {
    if (result.transient) {
      res.setHeader('Retry-After', '3');
      return res.status(503).json({ error: 'Odds temporarily unavailable', reason: result.degraded });
    }
    return res.status(200).json([]);
  }
  res.setHeader('X-Cache', result.cacheStatus);
  if (result.upstream === 'sportsgameodds') res.setHeader('X-EdgeFinder-Upstream', 'sportsgameodds');
  return res.status(200).json(isPro ? result.data : buildFreeOddsPreview(result.data));
}
