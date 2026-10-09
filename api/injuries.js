import { guardRequest } from './_http.js';

const cache = {};
const TTL = 5 * 60 * 1000; // 5 min for injuries

// "<sport>/<league>" ESPN path segments only; the value is spliced into the
// upstream URL and used as a cache key.
const SPORT_PATH_RE = /^[a-z0-9-]{2,32}\/[a-z0-9.-]{2,48}$/;
const PUBLIC_CACHE = 'public, s-maxage=120, stale-while-revalidate=300';

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'injuries', rateLimit: 300 })) return;
  const { sport = 'basketball/nba' } = req.query;
  if (!SPORT_PATH_RE.test(String(sport))) return res.status(400).json({ error: 'Invalid sport' });
  const cacheKey = `injuries-${sport}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', PUBLIC_CACHE);
    return res.status(200).json(cache[cacheKey].data);
  }

  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${sport}/injuries`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return res.status(response.status).json({ error: `ESPN error: ${response.status}` });
    const data = await response.json();
    cache[cacheKey] = { data, ts: Date.now() };
    res.setHeader('Cache-Control', PUBLIC_CACHE);
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
