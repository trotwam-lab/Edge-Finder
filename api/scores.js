const cache = {};
const TTL = 60 * 1000; // 60 seconds — fresher scores for live games

export default async function handler(req, res) {
  const { sport = 'basketball_nba', daysFrom = '1' } = req.query;
  const cacheKey = `scores-${sport}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Cache-Age', String(Math.round((Date.now() - cache[cacheKey].ts) / 1000)));
    return res.status(200).json(cache[cacheKey].data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=${daysFrom}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    const data = await response.json();
    cache[cacheKey] = { data, ts: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (e) {
    // Serve stale cache if available
    if (cache[cacheKey]) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache[cacheKey].data);
    }
    return res.status(500).json({ error: e.message });
  }
}
