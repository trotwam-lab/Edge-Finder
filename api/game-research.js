/**
 * Game Research Router
 * Delegates to sport-specific modules for enriched pre-game data.
 */

const { safeFetch } = require('../utils');

// Sport-specific modules
const { getBaseballGameResearch } = require('./game-research-baseball');
const { getBasketballGameResearch } = require('./game-research-basketball');

/**
 * Main entry point.  Routes to the correct research module based on sport.
 *
 * @param {string} sport       - Sport key, e.g. 'baseball_mlb', 'basketball_nba', 'americanfootball_nfl'
 * @param {string} homeTeam    - Home team name or abbreviation
 * @param {string} awayTeam    - Away team name or abbreviation
 * @param {string} gameDate    - ISO date string (YYYY-MM-DD)
 * @returns {Promise<Object>}  - Structured research object
 */
async function getGameResearch(sport, homeTeam, awayTeam, gameDate) {
  switch (sport) {
    case 'baseball_mlb':
      return getBaseballGameResearch(homeTeam, awayTeam, gameDate);

    case 'basketball_nba':
      return getBasketballGameResearch(homeTeam, awayTeam, gameDate);

    default:
      // Generic fallback for NFL and any other sport
      return getGenericGameResearch(homeTeam, awayTeam, gameDate);
  }
}

/**
 * Generic fallback research used for NFL and unhandled sports.
 * Provides basic last-10 form, streaks, and head-to-head.
 */
async function getGenericGameResearch(homeTeam, awayTeam, gameDate) {
  const [homeForm, awayForm, h2h] = await Promise.all([
    fetchBasicForm(homeTeam),
    fetchBasicForm(awayTeam),
    fetchHeadToHead(homeTeam, awayTeam),
  ]);

  return {
    sport: 'generic',
    gameDate,
    homeTeam,
    awayTeam,
    home: { form: homeForm },
    away: { form: awayForm },
    headToHead: h2h,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Generic helpers (retained from original implementation)             */
/* ------------------------------------------------------------------ */

async function fetchBasicForm(team) {
  // Stub: replace with real generic form fetch if needed
  return {
    last10: { wins: 0, losses: 0 },
    streak: 'N/A',
    note: 'Generic form data not yet implemented',
  };
}

async function fetchHeadToHead(home, away) {
  // Stub: replace with real H2H fetch if needed
  return {
    lastMeetings: [],
    note: 'Head-to-head data not yet implemented',
  };
}

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

module.exports = {
  getGameResearch,
};
