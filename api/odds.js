import { getRequestTier, isProTier } from './_auth.js';
import { coalescedJson, burstBackoffActive } from './_upstream.js';
import {
  fetchSportsGameOddsEvents,
  isSportsGameOddsEnabled,
  leagueIdForOddsSport,
  transformSgoEventToOddsApiGame,
} from './_sportsgameodds.js';

const cache = {};
const TTL = 30 * 1000; // 30 seconds - fresher lines for live betting
const IDLE_TTL = 5 * 60 * 1000; // nothing live or starting soon: lines move slowly
const EMPTY_TTL = 10 * 60 * 1000; // off-season sports: stop re-asking every 30s

// Quota discipline: a 30s TTL is only worth paying for when a game is live or
// about to start. A slate that's hours away moves slowly — caching it for
// 5 minutes cuts upstream spend ~10x on quiet boards, which is what ran the
// monthly quota out mid-cycle.
function ttlForGames(data) {
  if (!Array.isArray(data) || data.length === 0) return EMPTY_TTL;
  const now = Date.now();
  const hasActionSoon = data.some(game => {
    const t = Date.parse(game.commence_time);
    if (!Number.isFinite(t)) return false;
    // Started within the last ~6h (likely in progress) or starts within 1h.
    return (t <= now && now - t < 6 * 60 * 60 * 1000) || (t > now && t - now < 60 * 60 * 1000);
  });
  return hasActionSoon ? TTL : IDLE_TTL;
}
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

function clampInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export default async function handler(req, res) {
  const { sport = 'basketball_nba', markets = 'h2h,spreads,totals' } = req.query;
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const useSportsGameOdds = isSportsGameOddsEnabled() && leagueIdForOddsSport(sport);
  const eventLimit = useSportsGameOdds
    ? clampInt(req.query.limit, SGO_DEFAULT_EVENT_LIMIT, SGO_MAX_EVENT_LIMIT)
    : null;
  const cacheKey = `odds-${useSportsGameOdds ? `sgo-${eventLimit}` : 'oddsapi'}-${sport}-${markets}-${ODDS_REGIONS}`;
  const cached = cache[cacheKey];

  if (cached && Date.now() - cached.ts < (cached.ttl ?? TTL)) {
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
      cache[cacheKey] = { data, ts: Date.now(), ttl: ttlForGames(data) };
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
    cache[cacheKey] = { data, ts: Date.now(), ttl: ttlForGames(data) };
    res.setHeader('X-Cache', 'MISS');
    setTierHeaders(res, tierInfo);
    return res.status(200).json(isPro ? data : buildFreeOddsPreview(data));
  } catch (e) {
    console.error(`odds error for ${sport}:`, e.message);
    return serveDegraded('upstream-unreachable');
  }
}
