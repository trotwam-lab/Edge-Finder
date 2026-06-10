// api/espn-assets.js — tiny ESPN proxy for browser-safe logos + rosters
// ESPN's site API does not consistently send browser CORS headers, so the
// React app must fetch teams/rosters through our own API route.

const ESPN_SITE_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const TTL = 6 * 60 * 60 * 1000; // 6 hours; logos/rosters do not need minute-by-minute refreshes
const cache = new Map();

const ALLOWED_PATHS = new Set([
  'basketball/nba',
  'basketball/wnba',
  'basketball/mens-college-basketball',
  'basketball/womens-college-basketball',
  'football/nfl',
  'football/college-football',
  'hockey/nhl',
  'baseball/mlb',
  'soccer/eng.1',
  'soccer/esp.1',
  'soccer/ita.1',
  'soccer/ger.1',
  'soccer/fra.1',
  'soccer/uefa.champions',
  'soccer/usa.1',
  'soccer/mex.1',
]);

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function fromCache(key) {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.ts > TTL) return null;
  return hit.data;
}

function saveCache(key, data) {
  cache.set(key, { ts: Date.now(), data });
}

export default async function handler(req, res) {
  sendCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { path, type = 'teams', teamId } = req.query;
  const sportPath = String(path || '').replace(/^\/+|\/+$/g, '');
  const assetType = String(type || 'teams');

  if (!ALLOWED_PATHS.has(sportPath)) {
    return res.status(400).json({ error: 'Unsupported ESPN sport path' });
  }
  if (!['teams', 'roster'].includes(assetType)) {
    return res.status(400).json({ error: 'Unsupported ESPN asset type' });
  }
  if (assetType === 'roster' && !String(teamId || '').match(/^\d+$/)) {
    return res.status(400).json({ error: 'A numeric teamId is required for roster requests' });
  }

  const url = assetType === 'roster'
    ? `${ESPN_SITE_BASE}/${sportPath}/teams/${teamId}/roster`
    : `${ESPN_SITE_BASE}/${sportPath}/teams`;
  const cacheKey = `${assetType}:${sportPath}:${teamId || ''}`;
  const cached = fromCache(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await upstream.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'ESPN request failed', status: upstream.status, data });
    }

    saveCache(cacheKey, data);
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch ESPN assets', details: err.message });
  }
}
