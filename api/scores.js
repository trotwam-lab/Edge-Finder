// api/scores.js — Odds API scores proxy with burst protection.
//
// This route takes the heaviest polling (every tracked sport, every cycle),
// which made it the main source of upstream 429 bursts. Coalescing, stale
// serving, and empty-result caching keep it useful and quota-polite.

import { coalescedJson, burstBackoffActive } from './_upstream.js';
import { guardRequest } from './_http.js';

const cache = {};

// Both values are interpolated into the upstream URL (and the cache key), so
// only plain sport keys and a small day count get through.
const SPORT_RE = /^[a-z0-9_]{2,64}$/;
const DAYS_RE = /^[1-3]$/;
const TTL = 2 * 60 * 1000;             // fresh window for live scores
const EMPTY_TTL = 10 * 60 * 1000;      // off-season sports: don't re-ask every 2min
// Scores are identical for every caller, so the CDN can absorb repeat polls.
const PUBLIC_CACHE = 'public, s-maxage=30, stale-while-revalidate=60';

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'scores', rateLimit: 300 })) return;
  const { sport = 'basketball_nba', daysFrom = '1' } = req.query;
  if (!SPORT_RE.test(String(sport)) || !DAYS_RE.test(String(daysFrom))) {
    return res.status(400).json({ error: 'Invalid sport or daysFrom' });
  }
  const cacheKey = `scores-${sport}-${daysFrom}`;
  const cached = cache[cacheKey];

  if (cached && Date.now() - cached.ts < (cached.ttl ?? TTL)) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', PUBLIC_CACHE);
    return res.status(200).json(cached.data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  // Slightly old scores beat an error — clients keep their last board either way.
  const serveDegraded = (reason) => {
    res.setHeader('X-EdgeFinder-Degraded', reason);
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cached.data);
    }
    return res.status(200).json([]);
  };

  if (burstBackoffActive()) {
    return serveDegraded('burst-backoff');
  }

  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=${daysFrom}`;
    const result = await coalescedJson(url);
    if (!result.ok) {
      console.warn(`scores upstream ${result.status} for ${sport}`);
      return serveDegraded(`upstream-${result.status}`);
    }
    const data = result.data;
    const ttl = Array.isArray(data) && data.length === 0 ? EMPTY_TTL : TTL;
    cache[cacheKey] = { data, ts: Date.now(), ttl };
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', PUBLIC_CACHE);
    return res.status(200).json(data);
  } catch (e) {
    console.error(`scores error for ${sport}:`, e.message);
    return serveDegraded('upstream-unreachable');
  }
}
