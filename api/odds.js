const cache = {};
const TTL = 2 * 60 * 1000; // 2 minutes

export default async function handler(req, res) {
  const { sport = 'basketball_nba', markets = 'h2h,spreads,totals' } = req.query;
  const cacheKey = `odds-${sport}-${markets}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache[cacheKey].data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=${markets}&oddsFormat=american`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    const data = await response.json();
    cache[cacheKey] = { data, ts: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
