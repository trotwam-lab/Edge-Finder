// api/scores.js — Odds API scores proxy with burst protection.
//
// This route takes the heaviest polling (every tracked sport, every cycle),
// which made it the main source of upstream 429 bursts. Coalescing, stale
// serving, and empty-result caching keep it useful and quota-polite.

import { coalescedJson, burstBackoffActive } from './_upstream.js';

const cache = {};
const TTL = 2 * 60 * 1000;             // fresh window for live scores
const EMPTY_TTL = 10 * 60 * 1000;      // off-season sports: don't re-ask every 2min

export default async function handler(req, res) {
  const { sport = 'basketball_nba', daysFrom = '1' } = req.query;
  const cacheKey = `scores-${sport}-${daysFrom}`;
  const cached = cache[cacheKey];

  if (cached && Date.now() - cached.ts < (cached.ttl ?? TTL)) {
    res.setHeader('X-Cache', 'HIT');
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
    return res.status(200).json(data);
  } catch (e) {
    console.error(`scores error for ${sport}:`, e.message);
    return serveDegraded('upstream-unreachable');
  }
}
