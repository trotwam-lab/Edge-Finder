// api/sports.js — active-sports catalog from The Odds API.
// The /v4/sports endpoint is quota-free and lists which sport keys are in
// season right now. Seasonal keys rotate constantly (each tennis major is its
// own key; cups appear and disappear), so the client uses this to skip odds
// requests for out-of-season sports instead of burning a paid request per
// dead key on every refresh.

const cache = { data: null, ts: 0 };
const TTL = 30 * 60 * 1000; // in-season status changes daily at most

export default async function handler(req, res) {
  if (cache.data && Date.now() - cache.ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  try {
    const response = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`);
    if (!response.ok) return res.status(response.status).json({ error: `Upstream error: ${response.status}` });
    const catalog = await response.json();
    const sports = (Array.isArray(catalog) ? catalog : [])
      .filter(s => s?.active)
      .map(s => ({ key: s.key, title: s.title, group: s.group, has_outrights: !!s.has_outrights }));
    cache.data = sports;
    cache.ts = Date.now();
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    return res.status(200).json(sports);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
