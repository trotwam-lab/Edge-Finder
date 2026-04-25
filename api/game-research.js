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

const axios = require('axios');

// Sport-specific modules (loaded lazily to avoid hard deps)
let baseballModule = null;
let basketballModule = null;
let hockeyModule = null;

function loadBaseball() {
  if (!baseballModule) baseballModule = require('./game-research-baseball');
  return baseballModule;
}
function loadBasketball() {
  if (!basketballModule) basketballModule = require('./game-research-basketball');
  return basketballModule;
}
function loadHockey() {
  if (!hockeyModule) hockeyModule = require('./game-research-hockey');
  return hockeyModule;
}

// ────────────────────────────────────────────────────────────────
// Generic fallback: last-10 games via ESPN
// ────────────────────────────────────────────────────────────────

async function getGenericGameResearch(homeTeam, awayTeam, sport, gameDate) {
  const ESPN_BASE = `https://site.api.espn.com/apis/site/v2/sports/${sport}`;

  async function safeFetch(url) {
    try {
      const { data } = await axios.get(url, { timeout: 10000 });
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
async function getGameResearch(homeTeam, awayTeam, sport, gameDate) {
  // Normalize sport key
  const key = (sport || '').toLowerCase().trim();

  if (key === 'baseball_mlb') {
    const mod = loadBaseball();
    return mod.getBaseballGameResearch(homeTeam, awayTeam, gameDate);
  }

  if (key === 'basketball_nba') {
    const mod = loadBasketball();
    return mod.getBasketballGameResearch(homeTeam, awayTeam, gameDate);
  }

  if (key === 'icehockey_nhl') {
    const mod = loadHockey();
    return mod.getHockeyGameResearch(homeTeam, awayTeam, gameDate);
  }

  // Fallback for unsupported sports
  return getGenericGameResearch(homeTeam, awayTeam, sport, gameDate);
}

module.exports = { getGameResearch };
