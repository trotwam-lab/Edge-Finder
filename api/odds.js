const cache = {};
const TTL = 30 * 1000; // 30 seconds - fresher lines for live betting
const LIVE_TTL = 15 * 1000; // 15 seconds for live/in-play games

export default async function handler(req, res) {
  const { sport = 'basketball_nba', markets = 'h2h,spreads,totals', live = '' } = req.query;
  const cacheKey = `odds-${sport}-${markets}-${live}`;
  const cacheTTL = live === 'true' ? LIVE_TTL : TTL;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < cacheTTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Cache-Age', String(Math.round((Date.now() - cache[cacheKey].ts) / 1000)));
    return res.status(200).json(cache[cacheKey].data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american`;
    const response = await fetch(url);

    // Pass through remaining API usage headers for monitoring
    const remaining = response.headers.get('x-requests-remaining');
    const used = response.headers.get('x-requests-used');
    if (remaining) res.setHeader('X-API-Remaining', remaining);
    if (used) res.setHeader('X-API-Used', used);

    if (!response.ok) return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    const data = await response.json();
    cache[cacheKey] = { data, ts: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (e) {
    // If fetch fails but we have stale cache, serve it with a warning header
    if (cache[cacheKey]) {
      res.setHeader('X-Cache', 'STALE');
      res.setHeader('X-Cache-Age', String(Math.round((Date.now() - cache[cacheKey].ts) / 1000)));
      return res.status(200).json(cache[cacheKey].data);
    }
    return res.status(500).json({ error: e.message });
  }
}
