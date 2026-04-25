/**
 * game-research.js
 * EdgeFinder game research router.
 *
 * Routes to sport-specific modules:
 *   - MLB  -> game-research-baseball.js
 *   - NBA  -> game-research-basketball.js
 *   - NHL  -> game-research-hockey.js   (icehockey_nhl)
 *   - else -> generic last-10 fallback
 */

import { getBaseballResearch } from './game-research-baseball.js';
import { getBasketballGameResearch } from './game-research-basketball.js';
import { getHockeyGameResearch } from './game-research-hockey.js';

// ────────────────────────────────────────────────────────────────
// Generic fallback: last-10 games via ESPN
// ────────────────────────────────────────────────────────────────

async function getGenericGameResearch(homeTeam, awayTeam, sport, gameDate) {
  const ESPN_BASE = `https://site.api.espn.com/apis/site/v2/sports/${sport}`;

  async function safeFetch(url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`[generic] fetch failed: ${url}`, err.message);
      return null;
    }
  }

  async function resolveTeamId(teamName) {
    const normalized = teamName.toLowerCase().trim();
    const teamsData = await safeFetch(`${ESPN_BASE}/teams`);
    if (!teamsData || !Array.isArray(teamsData.sports?.[0]?.leagues?.[0]?.teams)) {
      return null;
    }
    const teams = teamsData.sports[0].leagues[0].teams;
    for (const entry of teams) {
      const t = entry.team;
      const candidates = [
        t.id,
        t.name?.toLowerCase(),
        t.abbreviation?.toLowerCase(),
        t.displayName?.toLowerCase(),
        t.shortDisplayName?.toLowerCase(),
        t.nickname?.toLowerCase(),
        t.location?.toLowerCase(),
      ];
      if (candidates.includes(normalized)) return String(t.id);
    }
    return null;
  }

  async function getLast10(teamId) {
    const schedule = await safeFetch(`${ESPN_BASE}/teams/${teamId}/schedule`);
    const events = schedule?.events || [];
    const completed = events
      .filter((e) => e.competitions?.[0]?.status?.type?.completed)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    return completed.map((e) => {
      const comp = e.competitions[0];
      const opponent = comp.competitors.find((c) => String(c.team?.id) !== String(teamId));
      const self = comp.competitors.find((c) => String(c.team?.id) === String(teamId));
      return {
        date: e.date.split('T')[0],
        opponent: opponent?.team?.displayName || 'Unknown',
        result: self?.winner === true ? 'W' : self?.winner === false ? 'L' : 'T',
        score: self?.score?.displayValue || null,
        opponentScore: opponent?.score?.displayValue || null,
      };
    });
  }

  const [homeId, awayId] = await Promise.all([
    resolveTeamId(homeTeam),
    resolveTeamId(awayTeam),
  ]);

  if (!homeId || !awayId) {
    throw new Error(`Could not resolve team IDs for generic research`);
  }

  const [homeGames, awayGames] = await Promise.all([
    getLast10(homeId),
    getLast10(awayId),
  ]);

  return {
    sport,
    gameDate,
    home: { name: homeTeam, id: homeId, last10: homeGames },
    away: { name: awayTeam, id: awayId, last10: awayGames },
    generatedAt: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────
// Main Router
// ────────────────────────────────────────────────────────────────

/**
 * Fetch game research for a matchup.
 * @param {string} homeTeam
 * @param {string} awayTeam
 * @param {string} sport       — e.g. 'baseball_mlb', 'basketball_nba', 'icehockey_nhl'
 * @param {string} gameDate    — YYYY-MM-DD
 * @returns {Promise<object>}
 */
export async function getGameResearch(homeTeam, awayTeam, sport, gameDate) {
  const key = (sport || '').toLowerCase().trim();

  if (key === 'baseball_mlb') {
    return getBaseballResearch(homeTeam, awayTeam, gameDate);
  }

  if (key === 'basketball_nba') {
    return getBasketballGameResearch(homeTeam, awayTeam, gameDate);
  }

  if (key === 'icehockey_nhl') {
    return getHockeyGameResearch(homeTeam, awayTeam, gameDate);
  }

  return getGenericGameResearch(homeTeam, awayTeam, sport, gameDate);
}

// Vercel serverless handler
export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const {
      homeTeam,
      awayTeam,
      sport = 'basketball_nba',
      commenceTime,
    } = req.query || {};

    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: 'Missing homeTeam or awayTeam query parameter.' });
    }

    const gameDate = commenceTime
      ? new Date(commenceTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const data = await getGameResearch(homeTeam, awayTeam, sport, gameDate);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Game research API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch game research' });
  }
}
