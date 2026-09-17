// api/scores.js — Odds API scores proxy with burst protection.
//
// This route takes the heaviest polling (every tracked sport, every cycle),
// which made it the main source of upstream 429 bursts. Coalescing, stale
// serving, and empty-result caching keep it useful and quota-polite.

import { coalescedJson, burstBackoffActive } from './_upstream.js';

const cache = {};
const TTL = 2 * 60 * 1000;             // fresh window for live scores
const IDLE_TTL = 5 * 60 * 1000;        // nothing live or imminent: scores can't change
const EMPTY_TTL = 10 * 60 * 1000;      // off-season sports: don't re-ask every 2min

// Scores only move while a game is in progress. If everything returned is
// final or still hours away, a longer cache costs nothing and saves quota.
function ttlForScores(data) {
  if (!Array.isArray(data) || data.length === 0) return EMPTY_TTL;
  const hasAction = data.some(game => {
    if (game.completed) return false;
    const t = Date.parse(game.commence_time);
    // In progress, or starts within 30 minutes.
    return Number.isFinite(t) && t - Date.now() < 30 * 60 * 1000;
  });
  return hasAction ? TTL : IDLE_TTL;
}

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
    cache[cacheKey] = { data, ts: Date.now(), ttl: ttlForScores(data) };
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (e) {
    console.error(`scores error for ${sport}:`, e.message);
    return serveDegraded('upstream-unreachable');
  }
}
