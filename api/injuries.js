const cache = {};
const TTL = 5 * 60 * 1000; // 5 min for injuries

export default async function handler(req, res) {
  const { sport = 'basketball/nba' } = req.query;
  const cacheKey = `injuries-${sport}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache[cacheKey].data);
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/injuries`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: `ESPN error: ${response.status}` });
    const data = await response.json();
    cache[cacheKey] = { data, ts: Date.now() };
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
