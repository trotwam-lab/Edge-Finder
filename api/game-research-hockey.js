/**
 * game-research-hockey.js
 * NHL-specific game research module for EdgeFinder.
 *
 * Provides rich hockey data: goaltender matchups, team offensive form,
 * special teams, rest/schedule, and auto-generated betting trends.
 *
 * Data sources: ESPN NHL APIs (team statistics, schedule, roster, box scores)
 */

// Using native fetch

// ────────────────────────────────────────────────────────────────
// Constants & Config
// ────────────────────────────────────────────────────────────────
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache (per-process)
const cache = new Map();

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Safe wrapper around fetch with caching and basic retry.
 * @param {string} url
 * @param {object} [params]
 * @returns {Promise<object|null>} Parsed JSON or null on failure
 */
async function safeFetch(url, params = {}, retries = 2) {
  const cacheKey = url + JSON.stringify(params);
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null)
    );
    const fullUrl = qs.toString() ? `${url}?${qs.toString()}` : url;
    const res = await fetch(fullUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return safeFetch(url, params, retries - 1);
    }
    console.error(`[safeFetch] Failed: ${url}`, err.message);
    return null;
  }
}

/**
 * Resolve an ESPN team ID from a display name / abbreviation / nickname.
 * Uses the ESPN teams endpoint.
 * @param {string} teamName
 * @returns {Promise<string|null>}
 */
async function resolveTeamId(teamName) {
  if (!teamName) return null;
  const normalized = teamName.toLowerCase().trim();

  const teamsData = await safeFetch(`${ESPN_BASE}/teams`);
  const teams = teamsData?.sports?.[0]?.leagues?.[0]?.teams;
  if (!Array.isArray(teams)) return null;

  for (const entry of teams) {
    const t = entry.team || {};
    const candidates = [
      t.name,
      t.abbreviation,
      t.displayName,
      t.shortDisplayName,
      t.nickname,
      t.location,
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());

    if (t.location && t.name) {
      candidates.push(`${t.location} ${t.name}`.toLowerCase());
    }

    if (candidates.includes(normalized)) {
      return String(t.id);
    }
  }
  return null;
}

/**
 * Parse a date string (ISO or YYYY-MM-DD) into a local date object.
 * @param {string} dateStr
 * @returns {Date}
 */
function parseGameDate(dateStr) {
  return new Date(dateStr);
}

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date} d
 * @returns {string}
 */
function fmtDate(d) {
  return d.toISOString().split('T')[0];
}

/**
 * Difference in whole days between two dates.
 * @param {Date} a
 * @param {Date} b
 * @returns {number}
 */
function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / msPerDay);
}

// ────────────────────────────────────────────────────────────────
// ESPN Data Fetchers
// ────────────────────────────────────────────────────────────────

async function fetchTeamStats(teamId) {
  return safeFetch(`${ESPN_BASE}/teams/${teamId}/statistics`);
}

async function fetchTeamSchedule(teamId) {
  return safeFetch(`${ESPN_BASE}/teams/${teamId}/schedule`);
}

async function fetchTeamRoster(teamId) {
  return safeFetch(`${ESPN_BASE}/teams/${teamId}/roster`);
}

async function fetchBoxScore(gameId) {
  return safeFetch(`${ESPN_BASE}/summary`, { event: gameId });
}

// ────────────────────────────────────────────────────────────────
// Goaltender Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Extract the starting goalie from a box score.
 * ESPN box scores list goalies under team statistics.
 * @param {object} box
 * @param {string} teamId
 * @returns {object|null}
 */
function extractStartingGoalieFromBox(box, teamId) {
  if (!box || !box.boxscore || !box.boxscore.players) return null;

  const teamBlock = box.boxscore.players.find(
    (p) => String(p.team?.id) === String(teamId)
  );
  if (!teamBlock || !Array.isArray(teamBlock.statistics)) return null;

  const goalieStats = teamBlock.statistics.find((s) =>
    (s.name || '').toLowerCase().includes('goaltending')
  );
  if (!goalieStats || !Array.isArray(goalieStats.athletes)) return null;

  // Usually the starter has more minutes / shots faced
  const sorted = [...goalieStats.athletes].sort((a, b) => {
    const aMins = parseFloat(a.stats?.find((s) => s.name === 'min')?.displayValue || 0);
    const bMins = parseFloat(b.stats?.find((s) => s.name === 'min')?.displayValue || 0);
    return bMins - aMins;
  });

  const starter = sorted[0];
  if (!starter) return null;

  const stats = {};
  if (Array.isArray(starter.stats)) {
    for (const s of starter.stats) {
      stats[s.name] = s.displayValue;
    }
  }

  return {
    id: starter.athlete?.id,
    name: starter.athlete?.displayName || starter.athlete?.fullName,
    position: starter.athlete?.position?.abbreviation,
    saves: stats.saves,
    shotsFaced: stats.shotsFaced || stats.shotsAgainst,
    goalsAgainst: stats.goalsAgainst,
    savePercentage: stats.savePercentage,
    goalsAgainstAverage: stats.goalsAgainstAverage,
    minutes: stats.min,
    decision: stats.decision, // W / L / O
  };
}

/**
 * Build a goalie profile from roster + stats + recent box scores.
 * @param {string} teamId
 * @param {object} rosterData
 * @param {object[]} recentGames — last N games metadata
 * @returns {Promise<object>}
 */
async function buildGoalieProfile(teamId, rosterData, recentGames) {
  // Find goalies on roster
  const goalies = [];
  const entries = rosterData?.athletes || [];
  for (const group of entries) {
    if (!Array.isArray(group.items)) continue;
    for (const player of group.items) {
      if ((player.position?.abbreviation || '').toLowerCase() === 'g') {
        goalies.push({
          id: player.id,
          name: player.displayName || player.fullName,
          jersey: player.jersey,
          experience: player.experience?.years,
        });
      }
    }
  }

  // Pull box scores for recent games to determine likely starter & their stats
  const boxScores = await Promise.all(
    recentGames.map((g) => fetchBoxScore(g.id))
  );

  // Count goalie appearances from box scores
  const appearanceMap = {}; // goalieId -> { count, games: [] }
  for (let i = 0; i < boxScores.length; i++) {
    const box = boxScores[i];
    const gameMeta = recentGames[i];
    const goalie = extractStartingGoalieFromBox(box, teamId);
    if (goalie && goalie.id) {
      if (!appearanceMap[goalie.id]) {
        appearanceMap[goalie.id] = { count: 0, games: [] };
      }
      appearanceMap[goalie.id].count += 1;
      appearanceMap[goalie.id].games.push({
        gameId: gameMeta.id,
        opponent: gameMeta.opponent,
        date: gameMeta.date,
        saves: goalie.saves,
        goalsAgainst: goalie.goalsAgainst,
        shotsFaced: goalie.shotsFaced,
        decision: goalie.decision,
        savePercentage: goalie.savePercentage,
        minutes: goalie.minutes,
      });
    }
  }

  // Pick the goalie with the most recent appearances as the "likely starter"
  let likelyStarter = null;
  let maxApps = 0;
  for (const gid of Object.keys(appearanceMap)) {
    if (appearanceMap[gid].count > maxApps) {
      maxApps = appearanceMap[gid].count;
      likelyStarter = gid;
    }
  }

  if (!likelyStarter && goalies.length > 0) {
    likelyStarter = goalies[0].id;
    appearanceMap[likelyStarter] = { count: 0, games: [] };
  }

  const starterGames = likelyStarter ? appearanceMap[likelyStarter]?.games || [] : [];
  const last3 = starterGames.slice(0, 3).map((g) => ({
    opponent: g.opponent,
    date: g.date,
    saves: g.saves,
    goalsAllowed: g.goalsAgainst,
    shotsFaced: g.shotsFaced,
    decision: g.decision,
    savePercentage: g.savePercentage,
    minutes: g.minutes,
  }));

  // Compute simple aggregates from last 3
  let totalSaves = 0;
  let totalGoalsAgainst = 0;
  let totalShots = 0;
  let wins = 0;
  let losses = 0;
  let shutouts = 0;

  for (const g of starterGames) {
    const sv = parseInt(g.saves, 10) || 0;
    const ga = parseInt(g.goalsAgainst, 10) || 0;
    const sf = parseInt(g.shotsFaced, 10) || sv + ga;
    totalSaves += sv;
    totalGoalsAgainst += ga;
    totalShots += sf;
    if (g.decision === 'W') wins++;
    if (g.decision === 'L') losses++;
    if (ga === 0 && (sv > 0 || sf > 0)) shutouts++;
  }

  const svPct = totalShots > 0 ? (totalSaves / totalShots).toFixed(3) : null;
  const gaa =
    starterGames.length > 0
      ? (totalGoalsAgainst / starterGames.length).toFixed(2)
      : null;

  return {
    likelyStarter: {
      id: likelyStarter,
      name:
        goalies.find((g) => String(g.id) === String(likelyStarter))?.name ||
        'Unknown',
    },
    record: { wins, losses },
    savePercentage: svPct,
    goalsAgainstAverage: gaa,
    shutouts,
    last3Starts: last3,
  };
}

// ────────────────────────────────────────────────────────────────
// Offensive Form Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Extract team-level stats from a box score.
 * @param {object} box
 * @param {string} teamId
 * @returns {object|null}
 */
function extractTeamBoxStats(box, teamId) {
  if (!box || !box.boxscore || !box.boxscore.teams) return null;
  const teamBlock = box.boxscore.teams.find(
    (t) => String(t.team?.id) === String(teamId)
  );
  if (!teamBlock || !teamBlock.statistics) return null;

  const stats = {};
  for (const group of teamBlock.statistics) {
    if (!Array.isArray(group.stats)) continue;
    for (const s of group.stats) {
      stats[s.name] = s.displayValue;
    }
  }
  return stats;
}

/**
 * Build last-5 offensive form summary.
 * @param {string} teamId
 * @param {object[]} recentGames
 * @returns {Promise<object>}
 */
async function buildOffensiveForm(teamId, recentGames) {
  const games = recentGames.slice(0, 5);
  const boxes = await Promise.all(games.map((g) => fetchBoxScore(g.id)));

  const formGames = [];
  let totalGoals = 0;
  let totalShots = 0;
  let totalPpGoals = 0;
  let totalPpOpps = 0;
  let totalPkOpps = 0;
  let totalPkGoalsAgainst = 0;
  let totalPenMinutes = 0;
  let totalShotAttempts = 0;
  let totalShotAttemptsAgainst = 0;

  for (let i = 0; i < games.length; i++) {
    const box = boxes[i];
    const meta = games[i];
    const stats = extractTeamBoxStats(box, teamId);
    if (!stats) continue;

    const goals = parseInt(stats.goals, 10) || 0;
    const shots = parseInt(stats.shots, 10) || 0;
    const ppGoals = parseInt(stats.powerPlayGoals, 10) || 0;
    const ppOpps = parseInt(stats.powerPlayOpportunities, 10) || 0;
    const penMinutes = parseInt(stats.penaltyMinutes, 10) || 0;

    // Attempt to infer Corsi (shot attempts) — ESPN sometimes includes these
    const shotAttempts =
      parseInt(stats.shotAttempts, 10) ||
      parseInt(stats.corsiFor, 10) ||
      shots;
    const shotAttemptsAgainst =
      parseInt(stats.shotAttemptsAgainst, 10) ||
      parseInt(stats.corsiAgainst, 10) ||
      null;

    totalGoals += goals;
    totalShots += shots;
    totalPpGoals += ppGoals;
    totalPpOpps += ppOpps;
    totalPenMinutes += penMinutes;
    if (shotAttempts) totalShotAttempts += shotAttempts;
    if (shotAttemptsAgainst) totalShotAttemptsAgainst += shotAttemptsAgainst;

    // PK data requires opponent box — try to fetch opponent PP goals from same box
    const opponentBlock = box.boxscore.teams.find(
      (t) => String(t.team?.id) !== String(teamId)
    );
    let oppPpGoals = 0;
    let oppPpOpps = 0;
    if (opponentBlock && opponentBlock.statistics) {
      for (const group of opponentBlock.statistics) {
        if (!Array.isArray(group.stats)) continue;
        for (const s of group.stats) {
          if (s.name === 'powerPlayGoals') oppPpGoals = parseInt(s.displayValue, 10) || 0;
          if (s.name === 'powerPlayOpportunities') oppPpOpps = parseInt(s.displayValue, 10) || 0;
        }
      }
    }
    totalPkGoalsAgainst += oppPpGoals;
    totalPkOpps += oppPpOpps;

    formGames.push({
      opponent: meta.opponent,
      date: meta.date,
      goals,
      shotsOnGoal: shots,
      powerPlayGoals: ppGoals,
      powerPlayOpportunities: ppOpps,
      penaltyMinutes: penMinutes,
      shotAttempts,
      shotAttemptsAgainst,
      result: meta.result,
    });
  }

  const gp = formGames.length || 1;
  const ppPct = totalPpOpps > 0 ? ((totalPpGoals / totalPpOpps) * 100).toFixed(1) : '0.0';
  const pkPct = totalPkOpps > 0 ? (((totalPkOpps - totalPkGoalsAgainst) / totalPkOpps) * 100).toFixed(1) : '0.0';

  return {
    gamesPlayed: gp,
    goalsPerGame: (totalGoals / gp).toFixed(2),
    shotsPerGame: (totalShots / gp).toFixed(1),
    powerPlayPercentage: ppPct,
    penaltyKillPercentage: pkPct,
    penaltyMinutesPerGame: (totalPenMinutes / gp).toFixed(1),
    corsiForPerGame: gp > 0 ? (totalShotAttempts / gp).toFixed(1) : null,
    corsiAgainstPerGame: totalShotAttemptsAgainst > 0 ? (totalShotAttemptsAgainst / gp).toFixed(1) : null,
    gameLog: formGames,
  };
}

// ────────────────────────────────────────────────────────────────
// Special Teams Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Build special teams summary from season stats + recent form.
 * @param {object} statsData — ESPN team statistics response
 * @param {object} offensiveForm — output from buildOffensiveForm
 * @returns {object}
 */
function buildSpecialTeams(statsData, offensiveForm) {
  const categories = statsData?.statistics?.categories || [];
  const findStat = (catName, statName) => {
    const cat = categories.find((c) => c.name === catName);
    if (!cat) return null;
    const s = cat.stats.find((st) => st.name === statName);
    return s ? s.displayValue : null;
  };

  // Season-level special teams
  const seasonPP = findStat('scoring', 'powerPlayPct');
  const seasonPK = findStat('scoring', 'penaltyKillPct');
  const ppOpportunities = findStat('scoring', 'powerPlayOpportunities');
  const gamesPlayed = parseInt(findStat('general', 'gamesPlayed') || offensiveForm.gamesPlayed, 10) || 1;

  const ppOppsPerGame = ppOpportunities
    ? (parseFloat(ppOpportunities) / gamesPlayed).toFixed(1)
    : null;

  // Penalty minutes (season)
  const seasonPenMinutes = findStat('general', 'penaltyMinutes');
  const penMinutesPerGame = seasonPenMinutes
    ? (parseFloat(seasonPenMinutes) / gamesPlayed).toFixed(1)
    : offensiveForm.penaltyMinutesPerGame;

  return {
    season: {
      powerPlayPercentage: seasonPP,
      penaltyKillPercentage: seasonPK,
      powerPlayOpportunitiesPerGame: ppOppsPerGame,
      penaltyMinutesPerGame: penMinutesPerGame,
    },
    last5Games: {
      powerPlayPercentage: offensiveForm.powerPlayPercentage,
      penaltyKillPercentage: offensiveForm.penaltyKillPercentage,
      penaltyMinutesPerGame: offensiveForm.penaltyMinutesPerGame,
    },
  };
}

// ────────────────────────────────────────────────────────────────
// Rest & Schedule Helpers
// ────────────────────────────────────────────────────────────────

/**
 * Compute rest days and back-to-back flags from schedule.
 * @param {object[]} events — schedule events
 * @param {Date} targetDate — game date
 * @param {boolean} isHome
 * @returns {object}
 */
function computeRest(events, targetDate, isHome) {
  if (!Array.isArray(events)) {
    return { daysOfRest: null, isBackToBack: false, homeAwayFatigue: null };
  }

  // Sort descending
  const sorted = [...events]
    .filter((e) => e.competitions?.[0]?.status?.type?.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const lastGame = sorted[0];
  let daysOfRest = null;
  if (lastGame) {
    const lastDate = new Date(lastGame.date);
    daysOfRest = daysBetween(lastDate, targetDate);
  }

  // Check if previous game was yesterday (back-to-back)
  let isBackToBack = false;
  if (daysOfRest !== null && daysOfRest <= 1) {
    isBackToBack = true;
  }

  // Home/away fatigue: count recent road games
  const recent = sorted.slice(0, 5);
  let roadGames = 0;
  for (const g of recent) {
    const comp = g.competitions[0];
    const homeTeam = comp.competitors.find((c) => c.homeAway === 'home');
    const isTeamHome = homeTeam && String(homeTeam.team?.id) === String(g.teamId);
    if (!isTeamHome) roadGames++;
  }

  const homeAwayFatigue = isHome
    ? `${roadGames} of last 5 on road`
    : `${5 - roadGames} of last 5 at home`;

  return {
    daysOfRest: daysOfRest !== null ? Math.max(0, daysOfRest) : null,
    isBackToBack,
    homeAwayFatigue,
    lastGameDate: lastGame ? fmtDate(new Date(lastGame.date)) : null,
  };
}

// ────────────────────────────────────────────────────────────────
// Trend Engine
// ────────────────────────────────────────────────────────────────

/**
 * Generate betting trends with confidence levels based on available data.
 * @param {object} home — home team aggregated data
 * @param {object} away — away team aggregated data
 * @returns {object[]}
 */
function generateTrends(home, away) {
  const trends = [];

  // Helper to push a trend
  const push = (text, confidence, category) => {
    trends.push({ text, confidence, category });
  };

  // Goalie edge
  if (home.goalie?.savePercentage && away.goalie?.savePercentage) {
    const hSV = parseFloat(home.goalie.savePercentage);
    const aSV = parseFloat(away.goalie.savePercentage);
    if (hSV > aSV + 0.015) {
      push(
        `${home.name} has the goaltending edge (${hSV} SV% vs ${aSV} SV%)`,
        'high',
        'goaltending'
      );
    } else if (aSV > hSV + 0.015) {
      push(
        `${away.name} has the goaltending edge (${aSV} SV% vs ${hSV} SV%)`,
        'high',
        'goaltending'
      );
    }
  }

  // Offensive form
  const hGPG = parseFloat(home.offense?.goalsPerGame) || 0;
  const aGPG = parseFloat(away.offense?.goalsPerGame) || 0;
  if (hGPG > aGPG + 0.5) {
    push(`${home.name} scoring more lately (${hGPG} GPG vs ${aGPG})`, 'medium', 'offense');
  } else if (aGPG > hGPG + 0.5) {
    push(`${away.name} scoring more lately (${aGPG} GPG vs ${hGPG})`, 'medium', 'offense');
  }

  // Special teams
  const hPP = parseFloat(home.specialTeams?.last5Games?.powerPlayPercentage) || 0;
  const aPK = parseFloat(away.specialTeams?.last5Games?.penaltyKillPercentage) || 0;
  if (hPP > 25 && aPK < 75) {
    push(
      `${home.name} PP (${hPP}%) vs ${away.name} PK (${aPK}%) is a mismatch`,
      'medium',
      'specialTeams'
    );
  }

  const aPP = parseFloat(away.specialTeams?.last5Games?.powerPlayPercentage) || 0;
  const hPK = parseFloat(home.specialTeams?.last5Games?.penaltyKillPercentage) || 0;
  if (aPP > 25 && hPK < 75) {
    push(
      `${away.name} PP (${aPP}%) vs ${home.name} PK (${hPK}%) is a mismatch`,
      'medium',
      'specialTeams'
    );
  }

  // Rest / back-to-back
  if (home.rest?.isBackToBack && !away.rest?.isBackToBack) {
    push(`${home.name} is on a back-to-back; ${away.name} is rested`, 'high', 'rest');
  } else if (away.rest?.isBackToBack && !home.rest?.isBackToBack) {
    push(`${away.name} is on a back-to-back; ${home.name} is rested`, 'high', 'rest');
  }

  if (home.rest?.daysOfRest !== null && away.rest?.daysOfRest !== null) {
    const diff = home.rest.daysOfRest - away.rest.daysOfRest;
    if (diff >= 2) {
      push(`${home.name} has ${diff} more days of rest`, 'medium', 'rest');
    } else if (diff <= -2) {
      push(`${away.name} has ${Math.abs(diff)} more days of rest`, 'medium', 'rest');
    }
  }

  // Discipline
  const hPIM = parseFloat(home.offense?.penaltyMinutesPerGame) || 0;
  const aPIM = parseFloat(away.offense?.penaltyMinutesPerGame) || 0;
  if (hPIM > aPIM + 3) {
    push(`${home.name} taking more penalties (${hPIM} PIM/G vs ${aPIM})`, 'low', 'discipline');
  } else if (aPIM > hPIM + 3) {
    push(`${away.name} taking more penalties (${aPIM} PIM/G vs ${hPIM})`, 'low', 'discipline');
  }

  return trends;
}

// ────────────────────────────────────────────────────────────────
// Main Module Export
// ────────────────────────────────────────────────────────────────

/**
 * Fetch rich NHL game research data for a matchup.
 * @param {string} homeTeam — Home team name/abbreviation
 * @param {string} awayTeam — Away team name/abbreviation
 * @param {string} gameDate — ISO date string (YYYY-MM-DD)
 * @returns {Promise<object>}
 */
async function getHockeyGameResearch(homeTeam, awayTeam, gameDate) {
  const targetDate = parseGameDate(gameDate);

  // Resolve ESPN team IDs
  const [homeId, awayId] = await Promise.all([
    resolveTeamId(homeTeam),
    resolveTeamId(awayTeam),
  ]);

  if (!homeId || !awayId) {
    throw new Error(
      `Could not resolve team IDs for "${homeTeam}" and/or "${awayTeam}"`
    );
  }

  // Parallel fetch of base data
  const [homeStats, awayStats, homeSchedule, awaySchedule, homeRoster, awayRoster] =
    await Promise.all([
      fetchTeamStats(homeId),
      fetchTeamStats(awayId),
      fetchTeamSchedule(homeId),
      fetchTeamSchedule(awayId),
      fetchTeamRoster(homeId),
      fetchTeamRoster(awayId),
    ]);

  // Build recent game lists (last 10 for context, last 5 for form)
  const extractGames = (scheduleData, teamId) => {
    const events = scheduleData?.events || [];
    const completed = events
      .filter((e) => e.competitions?.[0]?.status?.type?.completed)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return completed.slice(0, 10).map((e) => {
      const comp = e.competitions[0];
      const opponent = comp.competitors.find((c) => String(c.team?.id) !== String(teamId));
      const self = comp.competitors.find((c) => String(c.team?.id) === String(teamId));
      return {
        id: e.id,
        date: fmtDate(new Date(e.date)),
        opponent: opponent?.team?.displayName || opponent?.team?.name || 'Unknown',
        result: self?.winner === true ? 'W' : self?.winner === false ? 'L' : 'T',
        score: self?.score?.displayValue || null,
        opponentScore: opponent?.score?.displayValue || null,
      };
    });
  };

  const homeRecent = extractGames(homeSchedule, homeId);
  const awayRecent = extractGames(awaySchedule, awayId);

  // Build detailed profiles
  const [homeGoalie, awayGoalie, homeOffense, awayOffense] = await Promise.all([
    buildGoalieProfile(homeId, homeRoster, homeRecent),
    buildGoalieProfile(awayId, awayRoster, awayRecent),
    buildOffensiveForm(homeId, homeRecent),
    buildOffensiveForm(awayId, awayRecent),
  ]);

  // Special teams
  const homeSpecialTeams = buildSpecialTeams(homeStats, homeOffense);
  const awaySpecialTeams = buildSpecialTeams(awayStats, awayOffense);

  // Rest
  const homeRest = computeRest(homeSchedule?.events || [], targetDate, true);
  const awayRest = computeRest(awaySchedule?.events || [], targetDate, false);

  // Assemble team objects
  const homeData = {
    name: homeTeam,
    id: homeId,
    goalie: homeGoalie,
    offense: homeOffense,
    specialTeams: homeSpecialTeams,
    rest: homeRest,
    recentGames: homeRecent,
  };

  const awayData = {
    name: awayTeam,
    id: awayId,
    goalie: awayGoalie,
    offense: awayOffense,
    specialTeams: awaySpecialTeams,
    rest: awayRest,
    recentGames: awayRecent,
  };

  // Generate trends
  const trends = generateTrends(homeData, awayData);

  return {
    sport: 'icehockey_nhl',
    gameDate: fmtDate(targetDate),
    home: homeData,
    away: awayData,
    trends,
    generatedAt: new Date().toISOString(),
  };
}

export { getHockeyGameResearch };
