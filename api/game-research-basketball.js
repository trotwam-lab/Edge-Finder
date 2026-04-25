/**
 * NBA Game Research Module
 * Provides rich basketball-specific data for betting analysis.
 *
 * Data sources:
 * - ESPN API: team stats, schedules, box scores
 * - Odds API: ATS trends (if available)
 */

const { safeFetch, cache } = require('../utils');

// ESPN API base URLs
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// Simple in-memory cache with TTL (mirrors MLB module pattern)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Main entry point. Returns a structured research object for an NBA game.
 * @param {string} homeTeam - Home team name or abbreviation
 * @param {string} awayTeam - Away team name or abbreviation
 * @param {string} gameDate - ISO date string (YYYY-MM-DD)
 * @returns {Promise<Object>}
 */
async function getBasketballGameResearch(homeTeam, awayTeam, gameDate) {
  try {
    // Resolve ESPN team IDs
    const [homeId, awayId] = await Promise.all([
      resolveTeamId(homeTeam),
      resolveTeamId(awayTeam),
    ]);

    if (!homeId || !awayId) {
      throw new Error(`Could not resolve team IDs for ${homeTeam} / ${awayTeam}`);
    }

    // Fetch data in parallel where possible
    const [
      homeStats,
      awayStats,
      homeSchedule,
      awaySchedule,
      homeBoxScores,
      awayBoxScores,
      homeInjuries,
      awayInjuries,
      homeAts,
      awayAts,
    ] = await Promise.all([
      fetchTeamStats(homeId),
      fetchTeamStats(awayId),
      fetchTeamSchedule(homeId),
      fetchTeamSchedule(awayId),
      fetchRecentBoxScores(homeId, 5),
      fetchRecentBoxScores(awayId, 5),
      fetchInjuries(homeTeam),
      fetchInjuries(awayTeam),
      fetchAtsTrends(homeTeam),
      fetchAtsTrends(awayTeam),
    ]);

    // Build enriched form objects from box-score data
    const homeForm = buildTeamForm(homeBoxScores, homeId);
    const awayForm = buildTeamForm(awayBoxScores, awayId);

    // Rest days
    const homeRest = calculateRestDays(homeSchedule, gameDate);
    const awayRest = calculateRestDays(awaySchedule, gameDate);

    // Injury / availability & ATS already fetched in parallel above

    // Pace & efficiency
    const paceMatchup = await buildPaceMatchup(homeStats, awayStats, homeForm, awayForm);

    // Auto-generated trends with confidence
    const trends = generateTrends({
      homeForm,
      awayForm,
      homeRest,
      awayRest,
      homeInjuries,
      awayInjuries,
      homeAts,
      awayAts,
      paceMatchup,
    });

    return {
      sport: 'basketball_nba',
      gameDate,
      homeTeam,
      awayTeam,
      home: {
        teamId: homeId,
        form: homeForm,
        rest: homeRest,
        injuries: homeInjuries,
        ats: homeAts,
        seasonStats: homeStats,
      },
      away: {
        teamId: awayId,
        form: awayForm,
        rest: awayRest,
        injuries: awayInjuries,
        ats: awayAts,
        seasonStats: awayStats,
      },
      matchup: {
        pace: paceMatchup,
        trends,
      },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[NBA Research] Error:', err.message);
    // Return a graceful fallback so the caller doesn't blow up
    return {
      sport: 'basketball_nba',
      gameDate,
      homeTeam,
      awayTeam,
      error: err.message,
      generatedAt: new Date().toISOString(),
    };
  }
}

/* ------------------------------------------------------------------ */
/* 1. Team Form with Advanced Stats                                    */
/* ------------------------------------------------------------------ */

/**
 * Fetches the last N box scores for a team and returns an array of
 * parsed game objects with advanced stats.
 */
async function fetchRecentBoxScores(teamId, limit = 5) {
  const schedule = await fetchTeamSchedule(teamId);
  if (!schedule || !Array.isArray(schedule.events)) return [];

  // Only completed games
  const completed = schedule.events
    .filter((ev) => ev.competitions?.[0]?.status?.type?.completed)
    .slice(0, limit);

  const boxScores = [];
  for (const ev of completed) {
    const gameId = ev.id;
    const box = await fetchBoxScore(gameId);
    if (box) boxScores.push(box);
  }
  return boxScores;
}

async function fetchBoxScore(gameId) {
  const url = `${ESPN_BASE}/summary?event=${gameId}`;
  const data = await safeFetch(url);
  if (!data) return null;
  return data;
}

/**
 * Builds a team-form object from an array of ESPN box-score responses.
 */
function buildTeamForm(boxScores, teamId) {
  const games = boxScores.map((box) => parseBoxScore(box, teamId)).filter(Boolean);

  const totals = games.reduce(
    (acc, g) => {
      acc.pts += g.pts;
      acc.oppPts += g.oppPts;
      acc.fgm += g.fgm;
      acc.fga += g.fga;
      acc.tpm += g.tpm;
      acc.tpa += g.tpa;
      acc.ftm += g.ftm;
      acc.fta += g.fta;
      acc.reb += g.reb;
      acc.asts += g.asts;
      acc.tov += g.tov;
      acc.poss += g.poss;
      return acc;
    },
    { pts: 0, oppPts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, reb: 0, asts: 0, tov: 0, poss: 0 }
  );

  const count = games.length || 1;

  // Offensive / Defensive ratings (points per 100 possessions)
  const ortg = totals.poss > 0 ? (totals.pts / totals.poss) * 100 : 0;
  const drtg = totals.poss > 0 ? (totals.oppPts / totals.poss) * 100 : 0;

  return {
    lastGames: games,
    record: {
      wins: games.filter((g) => g.result === 'W').length,
      losses: games.filter((g) => g.result === 'L').length,
    },
    streak: computeStreak(games),
    averages: {
      pts: round(totals.pts / count),
      oppPts: round(totals.oppPts / count),
      fgPct: pct(totals.fgm, totals.fga),
      threePct: pct(totals.tpm, totals.tpa),
      ftPct: pct(totals.ftm, totals.fta),
      reb: round(totals.reb / count),
      ast: round(totals.asts / count),
      tov: round(totals.tov / count),
      pace: round(totals.poss / count),
    },
    ratings: {
      offensive: round(ortg),
      defensive: round(drtg),
      net: round(ortg - drtg),
    },
  };
}

function parseBoxScore(box, teamId) {
  const comp = box.header?.competitions?.[0];
  if (!comp) return null;

  const isHome = String(comp.competitors[0].team.id) === String(teamId);
  const teamIdx = isHome ? 0 : 1;
  const oppIdx = isHome ? 1 : 0;

  const team = comp.competitors[teamIdx];
  const opp = comp.competitors[oppIdx];

  const stats = parseTeamStats(team.statistics || []);

  // Estimate possessions: FGA + 0.44*FTA - OREB + TOV (simplified)
  const poss = stats.fga + 0.44 * stats.fta - stats.oreb + stats.tov;

  return {
    gameId: box.header.id,
    date: box.header.date,
    opponent: opp.team.abbreviation || opp.team.displayName,
    location: isHome ? 'home' : 'away',
    result: team.winner ? 'W' : 'L',
    pts: parseInt(team.score, 10) || 0,
    oppPts: parseInt(opp.score, 10) || 0,
    ...stats,
    poss: round(poss),
  };
}

function parseTeamStats(statsArray) {
  // ESPN returns stats as an array of category objects
  const find = (cat, label) => {
    const category = statsArray.find((s) => s.name === cat);
    if (!category) return 0;
    const stat = category.stats.find((st) => st.name === label);
    return stat ? parseFloat(stat.displayValue) || 0 : 0;
  };

  return {
    fgm: find('fieldGoals', 'fieldGoalsMade'),
    fga: find('fieldGoals', 'fieldGoalsAttempted'),
    tpm: find('threePointFieldGoals', 'threePointFieldGoalsMade'),
    tpa: find('threePointFieldGoals', 'threePointFieldGoalsAttempted'),
    ftm: find('freeThrows', 'freeThrowsMade'),
    fta: find('freeThrows', 'freeThrowsAttempted'),
    reb: find('rebounds', 'totalRebounds'),
    oreb: find('rebounds', 'offensiveRebounds'),
    asts: find('assists', 'assists'),
    tov: find('turnovers', 'turnovers'),
  };
}

function computeStreak(games) {
  if (!games.length) return 'N/A';
  let streak = 0;
  const first = games[0].result;
  for (const g of games) {
    if (g.result === first) streak++;
    else break;
  }
  return `${streak}${first}`;
}

/* ------------------------------------------------------------------ */
/* 2. Player Availability / Injury Impact                              */
/* ------------------------------------------------------------------ */

/**
 * Best-effort injury fetch.  If the project has an existing injuries API,
 * call it here.  Otherwise return an empty placeholder.
 */
async function fetchInjuries(teamName) {
  try {
    // Attempt to use a project-level injuries endpoint if available
    const { getInjuries } = require('./injuries');
    if (typeof getInjuries === 'function') {
      return await getInjuries(teamName);
    }
  } catch {
    // Module not available — that's fine
  }

  // Placeholder: caller can overlay real data later
  return {
    playersOut: [],
    impactScore: 0, // 0-10 scale
    note: 'No injury data source configured',
  };
}

/* ------------------------------------------------------------------ */
/* 3. Rest Days Advantage                                              */
/* ------------------------------------------------------------------ */

function calculateRestDays(schedule, gameDateStr) {
  if (!schedule || !Array.isArray(schedule.events)) {
    return { days: null, isBackToBack: false, note: 'No schedule data' };
  }

  const target = new Date(gameDateStr);
  const previous = schedule.events
    .filter((ev) => {
      const d = new Date(ev.date);
      return d < target && ev.competitions?.[0]?.status?.type?.completed;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];

  if (!previous) {
    return { days: null, isBackToBack: false, note: 'No prior game found' };
  }

  const prevDate = new Date(previous.date);
  const diffMs = target - prevDate;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    days,
    isBackToBack: days === 0,
    isRested: days >= 2,
    previousGameDate: prevDate.toISOString(),
    note: days === 0 ? 'Back-to-back' : days >= 2 ? 'Well rested (2+ days)' : '1 day rest',
  };
}

/* ------------------------------------------------------------------ */
/* 4. ATS (Against The Spread) Trends                                  */
/* ------------------------------------------------------------------ */

/**
 * Best-effort ATS fetch.  If the project has historical odds data,
 * wire it in here.  Otherwise return a placeholder.
 */
async function fetchAtsTrends(teamName) {
  try {
    const { getHistoricalOdds } = require('./odds');
    if (typeof getHistoricalOdds === 'function') {
      const odds = await getHistoricalOdds(teamName);
      return computeAtsFromOdds(odds);
    }
  } catch {
    // Odds module not available
  }

  return {
    last10: { wins: 0, losses: 0, push: 0, pct: 0 },
    home: { wins: 0, losses: 0, push: 0, pct: 0 },
    away: { wins: 0, losses: 0, push: 0, pct: 0 },
    asFavorite: { wins: 0, losses: 0, push: 0, pct: 0 },
    asUnderdog: { wins: 0, losses: 0, push: 0, pct: 0 },
    note: 'No historical odds data source configured',
  };
}

function computeAtsFromOdds(oddsArray) {
  // Stub: implement once odds schema is known
  const empty = { wins: 0, losses: 0, push: 0, pct: 0 };
  return {
    last10: empty,
    home: empty,
    away: empty,
    asFavorite: empty,
    asUnderdog: empty,
    note: 'ATS computation not yet implemented',
  };
}

/* ------------------------------------------------------------------ */
/* 5. Pace & Style Matchup                                             */
/* ------------------------------------------------------------------ */

async function buildPaceMatchup(homeStats, awayStats, homeForm, awayForm) {
  // Use season stats if available, otherwise fall back to last-5 form
  const homePace = homeStats?.pace || homeForm?.averages?.pace || 100;
  const awayPace = awayStats?.pace || awayForm?.averages?.pace || 100;

  // Try to fetch league-wide pace stats for percentile-based ranking
  let allTeamPaces = null;
  try {
    allTeamPaces = await fetchLeaguePaceStats();
  } catch (err) {
    // Silently fall back to hardcoded thresholds
  }

  let homePacePercentile = null;
  let awayPacePercentile = null;
  let expectedPacePercentile = null;
  let paceRankLabel;

  const expectedPace = round((homePace + awayPace) / 2);

  if (allTeamPaces && allTeamPaces.length > 0) {
    homePacePercentile = getPacePercentile(homePace, allTeamPaces);
    awayPacePercentile = getPacePercentile(awayPace, allTeamPaces);
    expectedPacePercentile = round((homePacePercentile + awayPacePercentile) / 2);
    paceRankLabel = paceLabelFromPercentile(expectedPacePercentile);
  } else {
    paceRankLabel = paceLabel(expectedPace);
  }

  const homeOrtg = homeForm?.ratings?.offensive || 110;
  const homeDrtg = homeForm?.ratings?.defensive || 110;
  const awayOrtg = awayForm?.ratings?.offensive || 110;
  const awayDrtg = awayForm?.ratings?.defensive || 110;

  return {
    homePace: round(homePace),
    awayPace: round(awayPace),
    expectedPace,
    homePacePercentile,
    awayPacePercentile,
    expectedPacePercentile,
    homeOffEfficiency: round(homeOrtg),
    homeDefEfficiency: round(homeDrtg),
    awayOffEfficiency: round(awayOrtg),
    awayDefEfficiency: round(awayDrtg),
    paceRankLabel,
    note: `Projected ${paceRankLabel.toLowerCase()} pace (${expectedPace} possessions)`,
  };
}

function paceLabel(possessions) {
  if (possessions >= 102) return 'Fast';
  if (possessions >= 98) return 'Medium';
  return 'Slow';
}

function paceLabelFromPercentile(percentile) {
  if (percentile >= 67) return 'Fast';
  if (percentile >= 34) return 'Medium';
  return 'Slow';
}

/* ------------------------------------------------------------------ */
/* League-wide pace helpers                                            */
/* ------------------------------------------------------------------ */

let _leaguePaceCache = null;

async function fetchLeaguePaceStats() {
  const now = Date.now();
  if (_leaguePaceCache && now - _leaguePaceCache.ts < CACHE_TTL_MS) {
    return _leaguePaceCache.data;
  }

  const data = await cachedFetch(`${ESPN_BASE}/teams`);
  if (!data || !Array.isArray(data.sports?.[0]?.leagues?.[0]?.teams)) {
    return null;
  }

  const teams = data.sports[0].leagues[0].teams;
  const paceValues = [];

  await Promise.all(
    teams.map(async (t) => {
      const teamId = t.team?.id;
      if (!teamId) return;
      try {
        const stats = await fetchTeamStats(teamId);
        if (stats && stats.pace) {
          paceValues.push(parseFloat(stats.pace));
        }
      } catch (err) {
        // Skip teams we can't fetch
      }
    })
  );

  if (paceValues.length === 0) return null;

  _leaguePaceCache = { ts: now, data: paceValues };
  return paceValues;
}

function getPacePercentile(pace, allTeamPaces) {
  if (!allTeamPaces || allTeamPaces.length === 0) return null;
  const sorted = [...allTeamPaces].sort((a, b) => a - b);
  const count = sorted.length;
  let below = 0;
  for (const p of sorted) {
    if (p < pace) below++;
  }
  // Percentile rank: percentage of values strictly below
  const percentile = Math.round((below / count) * 100);
  return Math.min(100, Math.max(0, percentile));
}

/* ------------------------------------------------------------------ */
/* 6. Auto-Generated Trends                                            */
/* ------------------------------------------------------------------ */

function generateTrends(ctx) {
  const trends = [];

  // Rest advantage
  if (ctx.homeRest.days !== null && ctx.awayRest.days !== null) {
    const restDiff = ctx.homeRest.days - ctx.awayRest.days;
    if (restDiff >= 2) {
      trends.push({
        text: `${ctx.homeTeam} has a significant rest advantage (+${restDiff} days)`,
        confidence: 'high',
        category: 'rest',
      });
    } else if (restDiff <= -2) {
      trends.push({
        text: `${ctx.awayTeam} has a significant rest advantage (${Math.abs(restDiff)} days)`,
        confidence: 'high',
        category: 'rest',
      });
    }
  }

  // Back-to-backs
  if (ctx.homeRest.isBackToBack) {
    trends.push({
      text: `${ctx.homeTeam} is on a back-to-back (fatigue risk)`,
      confidence: 'medium',
      category: 'rest',
    });
  }
  if (ctx.awayRest.isBackToBack) {
    trends.push({
      text: `${ctx.awayTeam} is on a back-to-back (fatigue risk)`,
      confidence: 'medium',
      category: 'rest',
    });
  }

  // Injury impact
  if (ctx.homeInjuries.impactScore >= 7) {
    trends.push({
      text: `${ctx.homeTeam} missing key players (impact: ${ctx.homeInjuries.impactScore}/10)`,
      confidence: 'high',
      category: 'injuries',
    });
  }
  if (ctx.awayInjuries.impactScore >= 7) {
    trends.push({
      text: `${ctx.awayTeam} missing key players (impact: ${ctx.awayInjuries.impactScore}/10)`,
      confidence: 'high',
      category: 'injuries',
    });
  }

  // Form momentum
  const homeStreak = ctx.homeForm.streak;
  const awayStreak = ctx.awayForm.streak;
  if (homeStreak && homeStreak.startsWith('W') && parseInt(homeStreak, 10) >= 3) {
    trends.push({
      text: `${ctx.homeTeam} is hot (${homeStreak} streak)`,
      confidence: 'medium',
      category: 'form',
    });
  }
  if (awayStreak && awayStreak.startsWith('W') && parseInt(awayStreak, 10) >= 3) {
    trends.push({
      text: `${ctx.awayTeam} is hot (${awayStreak} streak)`,
      confidence: 'medium',
      category: 'form',
    });
  }

  // Efficiency mismatch
  const homeOrtg = ctx.homeForm.ratings?.offensive || 0;
  const awayDrtg = ctx.awayForm.ratings?.defensive || 0;
  const awayOrtg = ctx.awayForm.ratings?.offensive || 0;
  const homeDrtg = ctx.homeForm.ratings?.defensive || 0;

  if (homeOrtg - awayDrtg > 5) {
    trends.push({
      text: `${ctx.homeTeam} offense should exploit ${ctx.awayTeam} defense`,
      confidence: 'medium',
      category: 'matchup',
    });
  }
  if (awayOrtg - homeDrtg > 5) {
    trends.push({
      text: `${ctx.awayTeam} offense should exploit ${ctx.homeTeam} defense`,
      confidence: 'medium',
      category: 'matchup',
    });
  }

  return trends;
}

/* ------------------------------------------------------------------ */
/* Helpers — ESPN API wrappers                                         */
/* ------------------------------------------------------------------ */

async function fetchTeamStats(teamId) {
  const url = `${ESPN_BASE}/teams/${teamId}/statistics`;
  const data = await cachedFetch(url);
  if (!data) return null;
  // ESPN returns categories like "general", "offense", "defense"
  // Normalize into a flat object for easier consumption
  const stats = {};
  (data.categories || []).forEach((cat) => {
    (cat.stats || []).forEach((s) => {
      stats[s.name] = parseFloat(s.displayValue) || 0;
    });
  });
  return stats;
}

async function fetchTeamSchedule(teamId) {
  const url = `${ESPN_BASE}/teams/${teamId}/schedule`;
  return cachedFetch(url);
}

async function resolveTeamId(nameOrAbbr) {
  // Try static mapping first (fast, no network)
  const staticId = NBA_TEAM_IDS[nameOrAbbr.toUpperCase()];
  if (staticId) return staticId;

  // Fallback: search ESPN teams list
  const data = await cachedFetch(`${ESPN_BASE}/teams`);
  if (!data || !Array.isArray(data.sports?.[0]?.leagues?.[0]?.teams)) return null;

  const teams = data.sports[0].leagues[0].teams;
  const match = teams.find((t) => {
    const team = t.team;
    return (
      team.abbreviation?.toUpperCase() === nameOrAbbr.toUpperCase() ||
      team.displayName?.toUpperCase().includes(nameOrAbbr.toUpperCase()) ||
      team.location?.toUpperCase().includes(nameOrAbbr.toUpperCase()) ||
      team.name?.toUpperCase().includes(nameOrAbbr.toUpperCase())
    );
  });
  return match?.team?.id || null;
}

/* ------------------------------------------------------------------ */
/* Caching wrapper                                                     */
/* ------------------------------------------------------------------ */

const _cache = new Map();

async function cachedFetch(url) {
  const now = Date.now();
  const hit = _cache.get(url);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return hit.data;
  }
  const data = await safeFetch(url);
  if (data) {
    _cache.set(url, { ts: now, data });
  }
  return data;
}

/* ------------------------------------------------------------------ */
/* Utilities                                                           */
/* ------------------------------------------------------------------ */

function pct(made, attempted) {
  if (!attempted) return 0;
  return round((made / attempted) * 100);
}

function round(n, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/* ------------------------------------------------------------------ */
/* Static NBA team ID mapping (ESPN)                                   */
/* ------------------------------------------------------------------ */

const NBA_TEAM_IDS = {
  ATL: 1,
  BOS: 2,
  BKN: 17,
  CHA: 30,
  CHI: 4,
  CLE: 5,
  DAL: 6,
  DEN: 7,
  DET: 8,
  GSW: 9,
  HOU: 10,
  IND: 11,
  LAC: 12,
  LAL: 13,
  MEM: 29,
  MIA: 14,
  MIL: 15,
  MIN: 16,
  NOP: 3,
  NYK: 18,
  OKC: 25,
  ORL: 19,
  PHI: 20,
  PHX: 21,
  POR: 22,
  SAC: 23,
  SAS: 24,
  TOR: 28,
  UTA: 26,
  WAS: 27,
  // Full names
  HAWKS: 1,
  CELTICS: 2,
  NETS: 17,
  HORNETS: 30,
  BULLS: 4,
  CAVALIERS: 5,
  MAVERICKS: 6,
  NUGGETS: 7,
  PISTONS: 8,
  WARRIORS: 9,
  ROCKETS: 10,
  PACERS: 11,
  'CLIPPERS': 12,
  LAKERS: 13,
  GRIZZLIES: 29,
  HEAT: 14,
  BUCKS: 15,
  TIMBERWOLVES: 16,
  PELICANS: 3,
  KNICKS: 18,
  THUNDER: 25,
  MAGIC: 19,
  '76ERS': 20,
  SUNS: 21,
  'TRAIL BLAZERS': 22,
  KINGS: 23,
  SPURS: 24,
  RAPTORS: 28,
  JAZZ: 26,
  WIZARDS: 27,
};

/* ------------------------------------------------------------------ */
/* Exports                                                             */
/* ------------------------------------------------------------------ */

module.exports = {
  getBasketballGameResearch,
};
