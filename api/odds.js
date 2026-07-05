import { getRequestTier, isProTier } from './_auth.js';
import { coalescedJson, burstBackoffActive } from './_upstream.js';

const cache = {};
const TTL = 30 * 1000; // 30 seconds - fresher lines for live betting
const EMPTY_TTL = 10 * 60 * 1000; // off-season sports: stop re-asking every 30s
const FREE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm']);
const ODDS_REGIONS = 'us,us2';

function buildFreeOddsPreview(data = []) {
  return data.map(game => ({
    ...game,
    bookmakers: (game.bookmakers || []).filter(book => FREE_BOOKS.has(book.key)),
  }));
}

function setTierHeaders(res, tierInfo) {
  res.setHeader('X-EdgeFinder-Tier', isProTier(tierInfo) ? 'pro' : 'free');
  res.setHeader('X-EdgeFinder-Tier-Source', tierInfo?.source || 'unknown');
}

export default async function handler(req, res) {
  const { sport = 'basketball_nba', markets = 'h2h,spreads,totals' } = req.query;
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const cacheKey = `odds-${sport}-${markets}-${ODDS_REGIONS}`;
  const cached = cache[cacheKey];

  if (cached && Date.now() - cached.ts < (cached.ttl ?? TTL)) {
    res.setHeader('X-Cache', 'HIT');
    setTierHeaders(res, tierInfo);
    return res.status(200).json(isPro ? cached.data : buildFreeOddsPreview(cached.data));
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

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
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=${ODDS_REGIONS}&markets=${markets}&oddsFormat=american`;
    const result = await coalescedJson(url);
    if (!result.ok) {
      console.warn(`odds upstream ${result.status} for ${sport}`);
      return serveDegraded(`upstream-${result.status}`);
    }
    const data = result.data;
    const ttl = Array.isArray(data) && data.length === 0 ? EMPTY_TTL : TTL;
    cache[cacheKey] = { data, ts: Date.now(), ttl };
    res.setHeader('X-Cache', 'MISS');
    setTierHeaders(res, tierInfo);
    return res.status(200).json(isPro ? data : buildFreeOddsPreview(data));
  } catch (e) {
    console.error(`odds error for ${sport}:`, e.message);
    return serveDegraded('upstream-unreachable');
  }
}
