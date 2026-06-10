import { getRequestTier, isProTier } from './_auth.js';

const cache = {};
const TTL = 30 * 1000; // 30 seconds - fresher lines for live betting
const FREE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm']);
const ODDS_REGIONS = 'us,us2';

function buildFreeOddsPreview(data = []) {
  return data.map(game => ({
    ...game,
    bookmakers: (game.bookmakers || []).filter(book => FREE_BOOKS.has(book.key)),
  }));
}

export default async function handler(req, res) {
  const { sport = 'basketball_nba', markets = 'h2h,spreads,totals' } = req.query;
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const cacheKey = `odds-${sport}-${markets}-${ODDS_REGIONS}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-EdgeFinder-Tier', isPro ? 'pro' : 'free');
    return res.status(200).json(isPro ? cache[cacheKey].data : buildFreeOddsPreview(cache[cacheKey].data));
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=${ODDS_REGIONS}&markets=${markets}&oddsFormat=american`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    const data = await response.json();
    cache[cacheKey] = { data, ts: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-EdgeFinder-Tier', isPro ? 'pro' : 'free');
    return res.status(200).json(isPro ? data : buildFreeOddsPreview(data));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
