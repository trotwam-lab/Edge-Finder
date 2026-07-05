/**
 * NBA Game Research Module
 * Provides rich basketball-specific data for betting analysis.
 *
 * Data sources:
 * - ESPN API: team stats, schedules, box scores
 * - Odds API: ATS trends (if available)
 */

// ESPN API base URLs — the module serves every basketball league ESPN carries
// with the same API shape; the sport key picks the league path.
const ESPN_LEAGUE_BASES = {
  basketball_nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
  basketball_wnba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/wnba',
};

// RotoWire lineup pages — the same markup system the MLB module already
// parses in production. First URL that yields parseable blocks wins.
const ROTOWIRE_LINEUP_URLS = {
  basketball_nba: ['https://www.rotowire.com/basketball/nba-lineups.php'],
  basketball_wnba: [
    'https://www.rotowire.com/wnba/lineups.php',
    'https://www.rotowire.com/basketball/wnba-lineups.php',
  ],
};

// Simple in-memory cache with TTL (mirrors MLB module pattern)
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Main entry point. Returns a structured research object for an NBA game.
 * @param {string} homeTeam - Home team name or abbreviation
 * @param {string} awayTeam - Away team name or abbreviation
 * @param {string} gameDate - ISO date string (YYYY-MM-DD)
 * @returns {Promise<Object>}
 */
async function getBasketballGameResearch(homeTeam, awayTeam, gameDate, sportKey = 'basketball_nba') {
  const base = ESPN_LEAGUE_BASES[sportKey] || ESPN_LEAGUE_BASES.basketball_nba;
  try {
    // Resolve ESPN team IDs
    const [homeId, awayId] = await Promise.all([
      resolveTeamId(homeTeam, base, sportKey),
      resolveTeamId(awayTeam, base, sportKey),
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
      fetchTeamStats(homeId, base),
      fetchTeamStats(awayId, base),
      fetchTeamSchedule(homeId, base),
      fetchTeamSchedule(awayId, base),
      fetchRecentBoxScores(homeId, 5, base),
      fetchRecentBoxScores(awayId, 5, base),
      fetchInjuries(homeTeam, base),
      fetchInjuries(awayTeam, base),
      fetchAtsTrends(homeTeam),
      fetchAtsTrends(awayTeam),
    ]);

    // Roto lineup confirmations (best effort — null when RotoWire has no
    // page/game or the markup shifted; research ships without it).
    let homeLineup = null;
    let awayLineup = null;
    try {
      const lineupGame = findLineupGame(await fetchRotoLineups(sportKey), awayTeam, homeTeam);
      homeLineup = lineupGame?.home || null;
      awayLineup = lineupGame?.away || null;
    } catch (err) {
      console.warn('[Basketball Research] lineup fetch failed:', err.message);
    }

    // Build enriched form objects from box-score data
    const homeForm = buildTeamForm(homeBoxScores, homeId);
    const awayForm = buildTeamForm(awayBoxScores, awayId);

    // Rest days
    const homeRest = calculateRestDays(homeSchedule, gameDate);
    const awayRest = calculateRestDays(awaySchedule, gameDate);

    // Injury / availability & ATS already fetched in parallel above

    // Pace & efficiency
    const paceMatchup = await buildPaceMatchup(homeStats, awayStats, homeForm, awayForm, base);

    // Auto-generated trends with confidence
    const trends = generateTrends({
      homeTeam,
      awayTeam,
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
      sport: sportKey,
      gameDate,
      homeTeam,
      awayTeam,
      home: {
        teamId: homeId,
        form: homeForm,
        rest: homeRest,
        injuries: homeInjuries,
        lineup: homeLineup,
        ats: homeAts,
        seasonStats: homeStats,
      },
      away: {
        teamId: awayId,
        form: awayForm,
        rest: awayRest,
        injuries: awayInjuries,
        lineup: awayLineup,
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
    console.error('[Basketball Research] Error:', err.message);
    // Return a graceful fallback so the caller doesn't blow up
    return {
      sport: sportKey,
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
async function fetchRecentBoxScores(teamId, limit = 5, base) {
  const schedule = await fetchTeamSchedule(teamId, base);
  if (!schedule || !Array.isArray(schedule.events)) return [];

  // Only completed games
  const completed = schedule.events
    .filter((ev) => ev.competitions?.[0]?.status?.type?.completed)
    .slice(0, limit);

  const boxScores = [];
  for (const ev of completed) {
    const gameId = ev.id;
    const box = await fetchBoxScore(gameId, base);
    if (box) boxScores.push(box);
  }
  return boxScores;
}

async function fetchBoxScore(gameId, base) {
  const url = `${base}/summary?event=${gameId}`;
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
  return `${first}${streak}`;
}

/* ------------------------------------------------------------------ */
/* 2. Player Availability / Injury Impact                              */
/* ------------------------------------------------------------------ */

/**
 * Real injury report from ESPN's league-wide injuries feed. This is the
 * availability ("roto") signal for basketball: who is Out, who is
 * Day-To-Day, going into the game.
 */
async function fetchInjuries(teamName, base) {
  const data = await cachedFetch(`${base}/injuries`);
  const teams = Array.isArray(data?.injuries) ? data.injuries : null;
  if (!teams) {
    return { players: [], playersOut: [], impactScore: 0, note: 'Injury report unavailable' };
  }

  const norm = (s) => String(s || '').toLowerCase().trim();
  const target = norm(teamName);
  const entry = teams.find((t) => {
    const dn = norm(t.displayName);
    if (!dn) return false;
    return dn === target || dn.includes(target) || target.includes(dn) ||
      dn.split(' ').pop() === target.split(' ').pop();
  });

  const players = (entry?.injuries || [])
    .map((i) => ({
      name: i.athlete?.displayName || null,
      position: i.athlete?.position?.abbreviation || null,
      status: i.status || i.type?.description || 'Unknown',
      detail: i.details?.type || i.shortComment || null,
      returnDate: i.details?.returnDate || null,
    }))
    .filter((p) => p.name);

  const playersOut = players.filter((p) => /out/i.test(p.status)).map((p) => p.name);
  const dayToDay = players.filter((p) => /day-to-day|questionable|doubtful/i.test(p.status)).length;

  return {
    players,
    playersOut,
    impactScore: Math.min(10, playersOut.length * 3 + dayToDay),
    note: players.length
      ? `${playersOut.length} out, ${dayToDay} day-to-day`
      : 'No reported injuries',
  };
}

/* ------------------------------------------------------------------ */
/* 2b. Roto Lineup Confirmations (RotoWire)                            */
/* ------------------------------------------------------------------ */

const _lineupCache = new Map(); // sportKey -> { ts, games }
const LINEUP_TTL_MS = 5 * 60 * 1000; // confirmations flip close to tip-off

function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function isSubsequence(small, big) {
  let i = 0;
  for (const ch of big) if (ch === small[i]) i++;
  return i === small.length;
}

// RotoWire's basketball pages show team ABBREVIATIONS (DAL, LV, PHX), not the
// full names the odds feed uses — match abbreviations by initials or by
// letter-subsequence of the city name (PHX ⊂ phoenix, WSH ⊂ washington).
function lineupTeamMatches(rotoName, oddsName) {
  const a = stripTags(rotoName).toLowerCase().trim();
  const b = String(oddsName || '').toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  if (a.split(/\s+/).pop() === b.split(/\s+/).pop()) return true;
  const compact = a.replace(/[^a-z]/g, '');
  if (compact.length >= 2 && compact.length <= 4) {
    const words = b.split(/\s+/);
    const initials = words.map((w) => w[0]).join('');
    const cityInitials = words.slice(0, -1).map((w) => w[0]).join('');
    if (compact === initials || (cityInitials.length >= 2 && compact === cityInitials)) return true;
    if (isSubsequence(compact, words[0])) return true;
  }
  return false;
}

function extractTeamCandidates(html) {
  const candidates = [];
  const text = stripTags(html.replace(/<span[\s\S]*?<\/span>/g, ' '));
  if (text) candidates.push(text);
  for (const m of html.matchAll(/(?:alt|title)="([^"]+)"/g)) candidates.push(m[1]);
  return candidates;
}

function anyTeamMatch(candidates, oddsName) {
  return (candidates || []).some((c) => lineupTeamMatches(c, oddsName));
}

function parseLineupSide(block, side) {
  const m = block.match(new RegExp(`<ul class="lineup__list is-${side}[^"]*"[^>]*>([\\s\\S]*?)(?=<ul class="lineup__list|$)`));
  const html = m?.[1] || '';
  const statusMatch = html.match(/lineup__status[^"]*\bis-(confirmed|expected)\b/);
  const players = [];
  for (const pm of html.matchAll(/<li class="lineup__player[\s\S]*?lineup__pos[^>]*>([^<]*)<[\s\S]*?<a[^>]*title="([^"]+)"/g)) {
    players.push({ position: stripTags(pm[1]) || null, name: stripTags(pm[2]) });
    if (players.length >= 5) break; // starters only
  }
  if (!statusMatch && players.length === 0) return null;
  return { status: statusMatch?.[1] || 'unknown', players, source: 'rotowire' };
}

async function fetchRotoLineups(sportKey) {
  const urls = ROTOWIRE_LINEUP_URLS[sportKey];
  if (!urls) return [];
  const hit = _lineupCache.get(sportKey);
  if (hit && Date.now() - hit.ts < LINEUP_TTL_MS) return hit.games;

  for (const url of urls) {
    let page = null;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) {
        console.warn(`[Basketball Research] RotoWire HTTP ${res.status}: ${url}`);
        continue;
      }
      page = await res.text();
    } catch (err) {
      console.warn(`[Basketball Research] RotoWire fetch failed: ${url}`, err.message);
      continue;
    }

    const games = [];
    const blocks = page.split(/<div class="lineup is-(?:nba|wnba)[^"]*"/).slice(1);
    for (const block of blocks) {
      // MLB pages use lineup__mteam with full names; basketball pages use
      // lineup__team with abbreviations (plus alt/title attributes).
      const teams = {};
      for (const tm of block.matchAll(/<div class="lineup__m?team is-(visit|home)[^"]*"[^>]*>([\s\S]*?)<\/div>/g)) {
        if (!teams[tm[1]]) teams[tm[1]] = extractTeamCandidates(tm[2]);
      }
      if (!teams.visit?.length || !teams.home?.length) continue;
      games.push({
        awayTeam: teams.visit,
        homeTeam: teams.home,
        away: parseLineupSide(block, 'visit'),
        home: parseLineupSide(block, 'home'),
      });
    }
    if (games.length) {
      _lineupCache.set(sportKey, { ts: Date.now(), games });
      return games;
    }
    const classes = [...new Set([...page.matchAll(/class="(lineup[^"]*)"/g)].map((m) => m[1]))].slice(0, 10);
    const teamSnippet = (page.match(/<div class="lineup__m?team is-visit[\s\S]{0,220}/) || [''])[0]
      .replace(/\s+/g, ' ');
    console.warn(`[Basketball Research] RotoWire: ${blocks.length} blocks, 0 games parsed: ${url} ` +
      `(classes: ${classes.join(' | ') || 'none'}) (team snippet: ${teamSnippet || 'none'})`);
  }
  return [];
}

function findLineupGame(games, awayTeam, homeTeam) {
  return (games || []).find((g) =>
    anyTeamMatch(g.awayTeam, awayTeam) && anyTeamMatch(g.homeTeam, homeTeam)) || null;
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
    const { getHistoricalOdds } = await import('./odds.js');
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

async function buildPaceMatchup(homeStats, awayStats, homeForm, awayForm, base) {
  // Use season stats if available, otherwise fall back to last-5 form
  const homePace = homeStats?.pace || homeForm?.averages?.pace || 100;
  const awayPace = awayStats?.pace || awayForm?.averages?.pace || 100;

  // Try to fetch league-wide pace stats for percentile-based ranking
  let allTeamPaces = null;
  try {
    allTeamPaces = await fetchLeaguePaceStats(base);
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

const _leaguePaceCache = new Map(); // per-league (base URL) cache

async function fetchLeaguePaceStats(base) {
  const now = Date.now();
  const hit = _leaguePaceCache.get(base);
  if (hit && now - hit.ts < CACHE_TTL_MS) {
    return hit.data;
  }

  const data = await cachedFetch(`${base}/teams`);
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
        const stats = await fetchTeamStats(teamId, base);
        if (stats && stats.pace) {
          paceValues.push(parseFloat(stats.pace));
        }
      } catch (err) {
        // Skip teams we can't fetch
      }
    })
  );

  if (paceValues.length === 0) return null;

  _leaguePaceCache.set(base, { ts: now, data: paceValues });
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

async function fetchTeamStats(teamId, base) {
  const url = `${base}/teams/${teamId}/statistics`;
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

async function fetchTeamSchedule(teamId, base) {
  const url = `${base}/teams/${teamId}/schedule`;
  return cachedFetch(url);
}

async function resolveTeamId(nameOrAbbr, base, sportKey) {
  // Try static mapping first (fast, no network) — NBA IDs only apply to NBA
  if (sportKey === 'basketball_nba') {
    const staticId = NBA_TEAM_IDS[nameOrAbbr.toUpperCase()];
    if (staticId) return staticId;
  }

  // Fallback: search ESPN teams list
  const data = await cachedFetch(`${base}/teams`);
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
/* safeFetch — local implementation (replaces missing utils module)    */
/* ------------------------------------------------------------------ */

async function safeFetch(url, retries = 2) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`[safeFetch] HTTP ${res.status}: ${url}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 500));
      return safeFetch(url, retries - 1);
    }
    console.error(`[safeFetch] Failed: ${url}`, err.message);
    return null;
  }
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

export { getBasketballGameResearch };
