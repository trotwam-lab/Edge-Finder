// api/game-research-baseball.js — Rich MLB-specific game research module
// Provides: pitching matchups, offensive form, bullpen stats, park factors, weather
// Data sources: ESPN API (team stats, rosters, schedules, box scores), OpenWeatherMap

// ─── Configuration ─────────────────────────────────────────────────────────
const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb';
const ESPN_CORE = 'https://site.api.espn.com/apis/core/v2/sports/baseball/mlb';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';

// ESPN team name → team ID mapping (exported for reuse by parent module)
export const MLB_IDS = {
  'Arizona Diamondbacks': 29, 'Atlanta Braves': 15, 'Baltimore Orioles': 1,
  'Boston Red Sox': 2, 'Chicago Cubs': 16, 'Chicago White Sox': 4,
  'Cincinnati Reds': 17, 'Cleveland Guardians': 5, 'Colorado Rockies': 27,
  'Detroit Tigers': 6, 'Houston Astros': 18, 'Kansas City Royals': 7,
  'Los Angeles Angels': 3, 'Los Angeles Dodgers': 19, 'Miami Marlins': 28,
  'Milwaukee Brewers': 8, 'Minnesota Twins': 9, 'New York Mets': 21,
  'New York Yankees': 10, 'Oakland Athletics': 11, 'Philadelphia Phillies': 22,
  'Pittsburgh Pirates': 23, 'San Diego Padres': 25, 'San Francisco Giants': 26,
  'Seattle Mariners': 12, 'St. Louis Cardinals': 24, 'Tampa Bay Rays': 30,
  'Texas Rangers': 13, 'Toronto Blue Jays': 14, 'Washington Nationals': 20,
};

// Park factors (simplified — 100 = neutral, >100 favors hitters, <100 favors pitchers)
// Source: 3-year rolling park factors from FanGraphs/Statcast approximations
const PARK_FACTORS = {
  'Arizona Diamondbacks': { name: 'Chase Field', factor: 104, type: 'hitter', notes: 'Retractable roof, warm air helps carry' },
  'Atlanta Braves': { name: 'Truist Park', factor: 98, type: 'pitcher', notes: 'Fair park, slightly pitcher-friendly' },
  'Baltimore Orioles': { name: 'Oriole Park', factor: 101, type: 'neutral', notes: 'Short RF porch boosts lefty power' },
  'Boston Red Sox': { name: 'Fenway Park', factor: 106, type: 'hitter', notes: 'Green Monster, quirky dimensions' },
  'Chicago Cubs': { name: 'Wrigley Field', factor: 103, type: 'hitter', notes: 'Wind-dependent; can be extreme either way' },
  'Chicago White Sox': { name: 'Guaranteed Rate Field', factor: 102, type: 'neutral', notes: 'Slightly hitter-friendly' },
  'Cincinnati Reds': { name: 'Great American Ball Park', factor: 107, type: 'hitter', notes: 'One of the most hitter-friendly parks' },
  'Cleveland Guardians': { name: 'Progressive Field', factor: 97, type: 'pitcher', notes: 'Pitcher-friendly, suppresses HRs' },
  'Colorado Rockies': { name: 'Coors Field', factor: 116, type: 'hitter', notes: 'Extreme hitter park due to altitude' },
  'Detroit Tigers': { name: 'Comerica Park', factor: 95, type: 'pitcher', notes: 'Large outfield, suppresses offense' },
  'Houston Astros': { name: 'Minute Maid Park', factor: 100, type: 'neutral', notes: 'Short LF porch, high CF wall' },
  'Kansas City Royals': { name: 'Kauffman Stadium', factor: 99, type: 'neutral', notes: 'Large outfield, slightly pitcher-friendly' },
  'Los Angeles Angels': { name: 'Angel Stadium', factor: 98, type: 'pitcher', notes: 'Pitcher-friendly, suppresses runs' },
  'Los Angeles Dodgers': { name: 'Dodger Stadium', factor: 96, type: 'pitcher', notes: 'Pitcher-friendly, large foul territory' },
  'Miami Marlins': { name: 'loanDepot park', factor: 94, type: 'pitcher', notes: 'Retractable roof, pitcher-friendly' },
  'Milwaukee Brewers': { name: 'American Family Field', factor: 101, type: 'neutral', notes: 'Retractable roof, fairly neutral' },
  'Minnesota Twins': { name: 'Target Field', factor: 99, type: 'neutral', notes: 'Fairly balanced' },
  'New York Mets': { name: 'Citi Field', factor: 96, type: 'pitcher', notes: 'Pitcher-friendly, large dimensions' },
  'New York Yankees': { name: 'Yankee Stadium', factor: 105, type: 'hitter', notes: 'Short RF porch, extreme for lefty power' },
  'Oakland Athletics': { name: 'Sutter Health Park', factor: 97, type: 'pitcher', notes: 'Pitcher-friendly, large foul territory' },
  'Philadelphia Phillies': { name: 'Citizens Bank Park', factor: 104, type: 'hitter', notes: 'Hitter-friendly, bandbox' },
  'Pittsburgh Pirates': { name: 'PNC Park', factor: 96, type: 'pitcher', notes: 'Pitcher-friendly, large RF' },
  'San Diego Padres': { name: 'Petco Park', factor: 93, type: 'pitcher', notes: 'One of the most pitcher-friendly parks' },
  'San Francisco Giants': { name: 'Oracle Park', factor: 92, type: 'pitcher', notes: 'Extreme pitcher park, marine layer' },
  'Seattle Mariners': { name: 'T-Mobile Park', factor: 95, type: 'pitcher', notes: 'Pitcher-friendly, marine layer' },
  'St. Louis Cardinals': { name: 'Busch Stadium', factor: 97, type: 'pitcher', notes: 'Pitcher-friendly, large outfield' },
  'Tampa Bay Rays': { name: 'Tropicana Field', factor: 96, type: 'pitcher', notes: 'Dome, pitcher-friendly, turf' },
  'Texas Rangers': { name: 'Globe Life Field', factor: 98, type: 'pitcher', notes: 'Retractable roof, fairly neutral' },
  'Toronto Blue Jays': { name: 'Rogers Centre', factor: 102, type: 'neutral', notes: 'Retractable roof, slightly hitter-friendly' },
  'Washington Nationals': { name: 'Nationals Park', factor: 99, type: 'neutral', notes: 'Fairly balanced' },
};

// City mapping for weather lookups
const TEAM_CITIES = {
  'Arizona Diamondbacks': 'Phoenix,US', 'Atlanta Braves': 'Atlanta,US',
  'Baltimore Orioles': 'Baltimore,US', 'Boston Red Sox': 'Boston,US',
  'Chicago Cubs': 'Chicago,US', 'Chicago White Sox': 'Chicago,US',
  'Cincinnati Reds': 'Cincinnati,US', 'Cleveland Guardians': 'Cleveland,US',
  'Colorado Rockies': 'Denver,US', 'Detroit Tigers': 'Detroit,US',
  'Houston Astros': 'Houston,US', 'Kansas City Royals': 'Kansas City,US',
  'Los Angeles Angels': 'Los Angeles,US', 'Los Angeles Dodgers': 'Los Angeles,US',
  'Miami Marlins': 'Miami,US', 'Milwaukee Brewers': 'Milwaukee,US',
  'Minnesota Twins': 'Minneapolis,US', 'New York Mets': 'New York,US',
  'New York Yankees': 'New York,US', 'Oakland Athletics': 'Sacramento,US',
  'Philadelphia Phillies': 'Philadelphia,US', 'Pittsburgh Pirates': 'Pittsburgh,US',
  'San Diego Padres': 'San Diego,US', 'San Francisco Giants': 'San Francisco,US',
  'Seattle Mariners': 'Seattle,US', 'St. Louis Cardinals': 'St. Louis,US',
  'Tampa Bay Rays': 'Tampa,US', 'Texas Rangers': 'Arlington,US',
  'Toronto Blue Jays': 'Toronto,CA', 'Washington Nationals': 'Washington,US',
};

// ─── Helpers ───────────────────────────────────────────────────────────────
function getTeamId(teamName) {
  return MLB_IDS[teamName] || null;
}

function getParkFactor(teamName) {
  return PARK_FACTORS[teamName] || { name: 'Unknown', factor: 100, type: 'neutral', notes: 'No data available' };
}

function getCity(teamName) {
  return TEAM_CITIES[teamName] || null;
}

// Generic fetch with timeout and error handling
async function safeFetch(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeout || 10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Fetch error for ${url}:`, err.message);
    return null;
  }
}

// Format date as YYYY-MM-DD
function formatDate(d) {
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

// Get date 7 days ago
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// ─── 1. PITCHING MATCHUP DATA ──────────────────────────────────────────────

/**
 * Fetch team roster and identify probable starting pitcher
 * ESPN doesn't always have "probable" starters in roster, so we:
 * 1. Get the roster
 * 2. Filter pitchers
 * 3. Cross-reference with recent games to find who started last
 * 4. Use rotation logic to estimate next starter
 */
async function fetchPitchingMatchup(homeTeam, awayTeam, gameDate) {
  const homeId = getTeamId(homeTeam);
  const awayId = getTeamId(awayTeam);
  if (!homeId || !awayId) return { error: 'Team ID not found' };

  const [homeRoster, awayRoster, homeSchedule, awaySchedule] = await Promise.all([
    safeFetch(`${ESPN_BASE}/teams/${homeId}/roster`),
    safeFetch(`${ESPN_BASE}/teams/${awayId}/roster`),
    safeFetch(`${ESPN_BASE}/teams/${homeId}/schedule`),
    safeFetch(`${ESPN_BASE}/teams/${awayId}/schedule`),
  ]);

  // Find the specific game in schedule to get probable pitchers if available
  const targetDate = formatDate(gameDate);
  const homeGame = findGameByDate(homeSchedule, targetDate);
  const awayGame = findGameByDate(awaySchedule, targetDate);

  // Try to extract probable pitcher from schedule competition notes
  const homeProbable = extractProbablePitcher(homeGame, homeRoster);
  const awayProbable = extractProbablePitcher(awayGame, awayRoster);

  // If no probable found in schedule, estimate from rotation
  const homeStarter = homeProbable || await estimateNextStarter(homeId, homeRoster, homeSchedule, targetDate);
  const awayStarter = awayProbable || await estimateNextStarter(awayId, awayRoster, awaySchedule, targetDate);

  return {
    home: homeStarter,
    away: awayStarter,
  };
}

function findGameByDate(schedule, dateStr) {
  if (!schedule?.events) return null;
  return schedule.events.find(e => {
    const gameDate = formatDate(e.date);
    return gameDate === dateStr;
  }) || null;
}

function extractProbablePitcher(gameEvent, roster) {
  if (!gameEvent?.competitions?.[0]?.notes?.length) return null;
  
  // ESPN sometimes puts probable pitcher info in notes
  const notes = gameEvent.competitions[0].notes.map(n => n.headline || n.text || '').join(' ');
  const pitcherMatch = notes.match(/([A-Z][a-z]+\s[A-Z][a-z]+)\s*\(/);
  
  if (pitcherMatch && roster?.athletes) {
    const name = pitcherMatch[1];
    const player = roster.athletes.find(a => 
      a.fullName?.includes(name) || name.includes(a.fullName?.split(' ').pop() || '')
    );
    if (player) return formatPitcherFromRoster(player);
  }
  return null;
}

function formatPitcherFromRoster(player) {
  const stats = player.statistics || {};
  const seasonStats = stats.seasonStats || {};
  const pitching = seasonStats.pitching || {};
  
  return {
    name: player.fullName || 'Unknown',
    id: player.id,
    position: player.position?.abbreviation || 'P',
    era: parseFloat(pitching.earnedRunAverage) || null,
    whip: parseFloat(pitching.walksHitsPerInningPitched) || null,
    inningsPitched: pitching.inningsPitched || null,
    wins: parseInt(pitching.wins) || 0,
    losses: parseInt(pitching.losses) || 0,
    record: `${pitching.wins || 0}-${pitching.losses || 0}`,
    strikeouts: parseInt(pitching.strikeouts) || 0,
    walks: parseInt(pitching.walks) || 0,
    gamesStarted: parseInt(pitching.gamesStarted) || 0,
    source: 'roster',
  };
}

/**
 * Estimate next starter by looking at last 5 games and finding who started
 * Uses a simple rotation estimate — in a real app you'd track rotations more carefully
 */
async function estimateNextStarter(teamId, roster, schedule, targetDate) {
  if (!schedule?.events || !roster?.athletes) return null;

  // Get completed games, most recent first
  const completedGames = schedule.events
    .filter(e => e.competitions?.[0]?.status?.type?.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 10);

  // Fetch box scores for recent games to identify starters
  const starters = [];
  for (const game of completedGames.slice(0, 5)) {
    const gameId = game.competitions[0].id;
    const boxScore = await safeFetch(`${ESPN_BASE}/summary?event=${gameId}`);
    if (boxScore) {
      const starter = extractStarterFromBoxScore(boxScore, teamId);
      if (starter) starters.push({ ...starter, date: game.date });
    }
  }

  if (starters.length === 0) {
    // Fallback: return best pitcher by games started from roster stats
    const pitchers = roster.athletes.filter(a => a.position?.abbreviation === 'P');
    const withStats = pitchers
      .map(p => formatPitcherFromRoster(p))
      .filter(p => p.gamesStarted > 0)
      .sort((a, b) => b.gamesStarted - a.gamesStarted);
    return withStats[0] || null;
  }

  // Get the most recent starter and their stats
  const mostRecent = starters[0];
  const player = roster.athletes.find(a => a.id === mostRecent.id);
  if (player) {
    const formatted = formatPitcherFromRoster(player);
    formatted.lastStart = {
      date: mostRecent.date,
      opponent: mostRecent.opponent,
      earnedRuns: mostRecent.earnedRuns,
      innings: mostRecent.innings,
    };
    return formatted;
  }

  return mostRecent;
}

function extractStarterFromBoxScore(boxScore, teamId) {
  if (!boxScore?.boxscore?.players) return null;
  
  for (const teamBox of boxScore.boxscore.players) {
    if (!teamBox.team?.id || teamBox.team.id != teamId) continue;
    
    // Find the pitching section
    const pitchingStats = teamBox.statistics?.find(s => s.name === 'pitching');
    if (!pitchingStats?.athletes) continue;
    
    // The starter is usually the first pitcher listed with the most innings
    const pitchers = pitchingStats.athletes
      .filter(a => a.stats && a.stats.length > 0)
      .map(a => ({
        id: a.athlete?.id,
        name: a.athlete?.displayName,
        innings: a.stats[0] || '', // IP is usually first stat
        earnedRuns: extractEarnedRuns(a.stats),
        opponent: boxScore.header?.competitions?.[0]?.competitors?.find(c => c.team?.id != teamId)?.team?.displayName,
      }))
      .filter(p => p.id && p.innings)
      .sort((a, b) => parseFloat(b.innings) - parseFloat(a.innings));
    
    return pitchers[0] || null;
  }
  return null;
}

function extractEarnedRuns(stats) {
  // Stats array varies, but ER is often included
  if (!stats) return null;
  const erStat = stats.find(s => typeof s === 'string' && s.includes('ER'));
  if (erStat) {
    const match = erStat.match(/(\d+)\s*ER/);
    return match ? parseInt(match[1]) : null;
  }
  return null;
}

/**
 * Fetch last 3 starts for a specific pitcher
 */
async function fetchPitcherLastStarts(pitcherId, teamId, opponentTeamName = null) {
  if (!pitcherId) return [];
  
  // Get team schedule and filter games where this pitcher started
  const schedule = await safeFetch(`${ESPN_BASE}/teams/${teamId}/schedule`);
  if (!schedule?.events) return [];

  const completedGames = schedule.events
    .filter(e => e.competitions?.[0]?.status?.type?.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5); // Check last 5 games max

  // Fetch box scores in parallel with timeout
  const boxScorePromises = completedGames.map(game => {
    const gameId = game.competitions[0].id;
    return safeFetch(`${ESPN_BASE}/summary?event=${gameId}`, { timeout: 8000 });
  });

  const boxScores = await Promise.all(boxScorePromises);

  const starts = [];
  const vsOpponent = [];

  for (let i = 0; i < completedGames.length; i++) {
    if (starts.length >= 3) break;
    
    const game = completedGames[i];
    const boxScore = boxScores[i];
    
    if (boxScore) {
      const start = extractPitcherStartFromBoxScore(boxScore, pitcherId, teamId);
      if (start) {
        starts.push({
          date: game.date,
          opponent: start.opponent,
          opponentAbbr: start.opponentAbbr,
          earnedRuns: start.earnedRuns,
          inningsPitched: start.inningsPitched,
          hits: start.hits,
          walks: start.walks,
          strikeouts: start.strikeouts,
          decision: start.decision,
        });

        // Track vs opponent history
        if (opponentTeamName && start.opponent === opponentTeamName) {
          vsOpponent.push({
            date: game.date,
            earnedRuns: start.earnedRuns,
            inningsPitched: start.inningsPitched,
            hits: start.hits,
            walks: start.walks,
            strikeouts: start.strikeouts,
            decision: start.decision,
          });
        }
      }
    }
  }

  return { starts, vsOpponent };
}

function extractPitcherStartFromBoxScore(boxScore, pitcherId, teamId) {
  if (!boxScore?.boxscore?.players) return null;
  
  for (const teamBox of boxScore.boxscore.players) {
    if (!teamBox.team?.id || teamBox.team.id != teamId) continue;
    
    const pitchingStats = teamBox.statistics?.find(s => s.name === 'pitching');
    if (!pitchingStats?.athletes) continue;
    
    const pitcher = pitchingStats.athletes.find(a => a.athlete?.id == pitcherId);
    if (!pitcher?.stats) continue;
    
    const stats = pitcher.stats;
    const competition = boxScore.header?.competitions?.[0];
    const opponent = competition?.competitors?.find(c => c.team?.id != teamId);
    
    return {
      opponent: opponent?.team?.displayName || 'Unknown',
      opponentAbbr: opponent?.team?.abbreviation || 'UNK',
      inningsPitched: stats[0] || '',
      hits: parseInt(stats[1]) || 0,
      runs: parseInt(stats[2]) || 0,
      earnedRuns: parseInt(stats[3]) || 0,
      walks: parseInt(stats[4]) || 0,
      strikeouts: parseInt(stats[5]) || 0,
      decision: stats[6] || '', // W/L/ND
    };
  }
  return null;
}

// ─── 2. TEAM OFFENSIVE FORM ────────────────────────────────────────────────

/**
 * Fetch last 5 games with detailed offensive stats from box scores
 */
async function fetchOffensiveForm(teamName, teamId) {
  if (!teamId) return { error: 'Team ID not found', games: [] };

  const schedule = await safeFetch(`${ESPN_BASE}/teams/${teamId}/schedule`);
  if (!schedule?.events) return { error: 'No schedule data', games: [] };

  const completedGames = schedule.events
    .filter(e => e.competitions?.[0]?.status?.type?.completed)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  const games = [];
  for (const game of completedGames) {
    const gameId = game.competitions[0].id;
    const boxScore = await safeFetch(`${ESPN_BASE}/summary?event=${gameId}`);
    
    const gameData = extractOffensiveStats(boxScore, teamId, teamName, game);
    if (gameData) games.push(gameData);
  }

  // Calculate averages
  const avgRuns = games.length > 0 ? (games.reduce((s, g) => s + g.runsScored, 0) / games.length).toFixed(2) : '0.00';
  const avgHits = games.length > 0 ? (games.reduce((s, g) => s + g.hits, 0) / games.length).toFixed(2) : '0.00';
  const avgHR = games.length > 0 ? (games.reduce((s, g) => s + g.homeRuns, 0) / games.length).toFixed(2) : '0.00';
  const totalRuns = games.reduce((s, g) => s + g.runsScored, 0);

  return {
    games,
    summary: {
      gamesPlayed: games.length,
      totalRunsScored: totalRuns,
      avgRunsScored: parseFloat(avgRuns),
      avgHits: parseFloat(avgHits),
      avgHomeRuns: parseFloat(avgHR),
      record: `${games.filter(g => g.won).length}-${games.filter(g => !g.won).length}`,
    },
  };
}

function extractOffensiveStats(boxScore, teamId, teamName, gameEvent) {
  if (!boxScore?.boxscore?.players || !gameEvent?.competitions?.[0]) return null;

  const competition = gameEvent.competitions[0];
  const isHome = competition.competitors[0]?.team?.id == teamId;
  const teamComp = isHome ? competition.competitors[0] : competition.competitors[1];
  const oppComp = isHome ? competition.competitors[1] : competition.competitors[0];

  // Find team in box score
  for (const teamBox of boxScore.boxscore.players) {
    if (teamBox.team?.id != teamId) continue;
    
    const battingStats = teamBox.statistics?.find(s => s.name === 'batting');
    if (!battingStats?.totals) continue;
    
    const totals = battingStats.totals;
    // totals format: [AB, R, H, RBI, BB, SO, PA, BA, OBP, SLG, OPS, ...]
    // This varies by ESPN version, so we extract what we can
    
    return {
      date: gameEvent.date,
      opponent: oppComp.team?.displayName || 'Unknown',
      opponentAbbr: oppComp.team?.abbreviation || 'UNK',
      isHome,
      won: parseInt(teamComp.score?.value || 0) > parseInt(oppComp.score?.value || 0),
      runsScored: parseInt(teamComp.score?.value || 0),
      runsAllowed: parseInt(oppComp.score?.value || 0),
      hits: parseInt(totals[2]) || 0,
      atBats: parseInt(totals[0]) || 0,
      runsBattedIn: parseInt(totals[3]) || 0,
      walks: parseInt(totals[4]) || 0,
      strikeouts: parseInt(totals[5]) || 0,
      homeRuns: extractHomeRunsFromTotals(totals),
      battingAverage: totals[7] || null,
      onBasePct: totals[8] || null,
      sluggingPct: totals[9] || null,
    };
  }

  // Fallback if box score doesn't have detailed stats
  return {
    date: gameEvent.date,
    opponent: oppComp.team?.displayName || 'Unknown',
    opponentAbbr: oppComp.team?.abbreviation || 'UNK',
    isHome,
    won: parseInt(teamComp.score?.value || 0) > parseInt(oppComp.score?.value || 0),
    runsScored: parseInt(teamComp.score?.value || 0),
    runsAllowed: parseInt(oppComp.score?.value || 0),
    hits: null,
    atBats: null,
    runsBattedIn: null,
    walks: null,
    strikeouts: null,
    homeRuns: null,
    battingAverage: null,
    onBasePct: null,
    sluggingPct: null,
    note: 'Box score details unavailable',
  };
}

function extractHomeRunsFromTotals(totals) {
  // HR is sometimes in totals, sometimes not — try to find it
  if (!totals) return 0;
  // Look for a number that could be HR (usually small, <10)
  for (let i = 10; i < totals.length; i++) {
    const val = parseInt(totals[i]);
    if (!isNaN(val) && val >= 0 && val <= 10) return val;
  }
  return 0;
}

// ─── SEASON TEAM BATTING STATS ─────────────────────────────────────────────

/**
 * Fetch season-level team batting statistics from ESPN
 */
async function fetchTeamBattingStats(teamId) {
  if (!teamId) return null;

  try {
    const data = await safeFetch(`${ESPN_BASE}/teams/${teamId}/statistics`);
    if (!data?.statistics) return null;

    // Find batting statistics category
    const battingCategory = data.statistics.find(s => s.name === 'batting' || s.displayName === 'Batting');
    if (!battingCategory?.stats) return null;

    const stats = battingCategory.stats;
    const findStat = (labels) => {
      for (const label of labels) {
        const stat = stats.find(s => s.name === label || s.displayName === label || s.shortDisplayName === label);
        if (stat) return stat.value !== undefined ? stat.value : stat.displayValue;
      }
      return null;
    };

    return {
      battingAverage: findStat(['avg', 'AVG', 'Batting Average']),
      ops: findStat(['ops', 'OPS', 'On-base Plus Slugging']),
      runsPerGame: findStat(['runsPerGame', 'R/G', 'Runs Per Game']),
      homeRuns: findStat(['homeRuns', 'HR', 'Home Runs']),
      hits: findStat(['hits', 'H', 'Hits']),
      rbis: findStat(['RBIs', 'RBI', 'Runs Batted In']),
      stolenBases: findStat(['stolenBases', 'SB', 'Stolen Bases']),
    };
  } catch (err) {
    console.error('Team batting stats error:', err.message);
    return null;
  }
}

// ─── 3. BULLPEN STATS ──────────────────────────────────────────────────────

/**
 * Calculate bullpen ERA from last 7 days of games
 * Fetches box scores and aggregates relief pitcher stats
 */
async function fetchBullpenStats(teamId) {
  if (!teamId) return { error: 'Team ID not found' };

  const sinceDate = daysAgo(7);
  const schedule = await safeFetch(`${ESPN_BASE}/teams/${teamId}/schedule`);
  if (!schedule?.events) return { error: 'No schedule data' };

  // Get games from last 7 days
  const recentGames = schedule.events
    .filter(e => {
      if (!e.competitions?.[0]?.status?.type?.completed) return false;
      const gameDate = formatDate(e.date);
      return gameDate >= sinceDate;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let totalEarnedRuns = 0;
  let totalInnings = 0;
  let gamesCounted = 0;
  const relieversUsed = new Set();

  for (const game of recentGames) {
    const gameId = game.competitions[0].id;
    const boxScore = await safeFetch(`${ESPN_BASE}/summary?event=${gameId}`);
    
    if (boxScore) {
      const bullpenData = extractBullpenFromBoxScore(boxScore, teamId);
      if (bullpenData) {
        totalEarnedRuns += bullpenData.earnedRuns;
        totalInnings += bullpenData.innings;
        gamesCounted++;
        bullpenData.pitchers.forEach(p => relieversUsed.add(p));
      }
    }
  }

  const era = totalInnings > 0 ? ((totalEarnedRuns / totalInnings) * 9).toFixed(2) : '0.00';

  return {
    era: parseFloat(era),
    gamesCounted,
    totalEarnedRuns,
    totalInnings: parseFloat(totalInnings.toFixed(1)),
    uniqueRelievers: relieversUsed.size,
    period: 'Last 7 days',
    note: gamesCounted === 0 ? 'No games in last 7 days' : null,
  };
}

function extractBullpenFromBoxScore(boxScore, teamId) {
  if (!boxScore?.boxscore?.players) return null;

  for (const teamBox of boxScore.boxscore.players) {
    if (teamBox.team?.id != teamId) continue;
    
    const pitchingStats = teamBox.statistics?.find(s => s.name === 'pitching');
    if (!pitchingStats?.athletes) continue;
    
    let earnedRuns = 0;
    let innings = 0;
    const pitchers = [];
    
    // Identify starter by most innings pitched, then sum all OTHER pitchers (relievers)
    const sortedByInnings = [...pitchingStats.athletes]
      .filter(a => a.stats && a.stats.length > 0)
      .sort((a, b) => parseFloat(b.stats[0] || 0) - parseFloat(a.stats[0] || 0));
    
    const starterId = sortedByInnings[0]?.athlete?.id;
    const relievers = pitchingStats.athletes.filter(a => a.athlete?.id !== starterId);
    
    for (const pitcher of relievers) {
      if (!pitcher.stats || pitcher.stats.length < 4) continue;
      
      const ip = parseFloat(pitcher.stats[0]) || 0;
      const er = parseInt(pitcher.stats[3]) || 0;
      
      innings += ip;
      earnedRuns += er;
      if (pitcher.athlete?.displayName) {
        pitchers.push(pitcher.athlete.displayName);
      }
    }
    
    return { earnedRuns, innings, pitchers };
  }
  return null;
}

// ─── 4. PARK FACTOR ────────────────────────────────────────────────────────

function getParkFactorData(teamName) {
  const park = getParkFactor(teamName);
  return {
    parkName: park.name,
    factor: park.factor,
    type: park.type,
    description: park.notes,
    impact: park.factor > 105 ? 'Significant hitter advantage'
      : park.factor > 102 ? 'Slight hitter advantage'
      : park.factor >= 98 ? 'Neutral'
      : park.factor > 94 ? 'Slight pitcher advantage'
      : 'Significant pitcher advantage',
  };
}

// ─── 5. WEATHER ────────────────────────────────────────────────────────────

/**
 * Fetch weather for game location using OpenWeatherMap
 * Requires OPENWEATHER_API_KEY environment variable
 * Falls back to generic data if no API key
 */
async function fetchWeather(teamName, gameDate) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  const city = getCity(teamName);
  
  if (!apiKey) {
    return {
      source: 'none',
      note: 'OPENWEATHER_API_KEY not configured. Set the OPENWEATHER_API_KEY environment variable to enable live weather data. Get a free key at https://openweathermap.org/api',
      temperature: null,
      windSpeed: null,
      windDirection: null,
      condition: null,
      humidity: null,
    };
  }

  if (!city) {
    return {
      source: 'none',
      note: `City mapping not found for ${teamName}`,
      temperature: null,
      windSpeed: null,
      windDirection: null,
      condition: null,
      humidity: null,
    };
  }

  try {
    // Always use 5-day forecast endpoint for better game-time accuracy
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=imperial`;

    const data = await safeFetch(url);
    if (!data) {
      return {
        source: 'openweathermap',
        note: 'Weather API request failed',
        temperature: null,
        windSpeed: null,
        windDirection: null,
        condition: null,
        humidity: null,
      };
    }

    // Find forecast closest to game time
    let weatherData;
    if (data.list) {
      const target = new Date(gameDate);
      const closest = data.list.reduce((prev, curr) => {
        const prevDiff = Math.abs(new Date(prev.dt * 1000) - target);
        const currDiff = Math.abs(new Date(curr.dt * 1000) - target);
        return currDiff < prevDiff ? curr : prev;
      });
      weatherData = closest;
    } else {
      weatherData = data;
    }

    const temp = weatherData.main?.temp;
    const windSpeed = weatherData.wind?.speed;
    const windDeg = weatherData.wind?.deg;
    const condition = weatherData.weather?.[0]?.description;
    const humidity = weatherData.main?.humidity;

    return {
      source: 'openweathermap',
      city,
      temperature: temp ? Math.round(temp) : null,
      temperatureUnit: 'F',
      windSpeed: windSpeed ? Math.round(windSpeed) : null,
      windSpeedUnit: 'mph',
      windDirection: windDeg ? degreesToDirection(windDeg) : null,
      windDegrees: windDeg,
      condition,
      humidity: humidity ? `${humidity}%` : null,
      bettingImpact: assessWeatherImpact(temp, windSpeed, windDeg, condition),
    };
  } catch (err) {
    console.error('Weather fetch error:', err.message);
    return {
      source: 'openweathermap',
      note: `Error: ${err.message}`,
      temperature: null,
      windSpeed: null,
      windDirection: null,
      condition: null,
      humidity: null,
    };
  }
}

function degreesToDirection(deg) {
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(deg / 22.5) % 16;
  return directions[index];
}

function assessWeatherImpact(temp, windSpeed, windDeg, condition) {
  const impacts = [];
  
  // Temperature impact
  if (temp > 85) impacts.push('Hot weather may favor hitters (ball carries better)');
  else if (temp < 50) impacts.push('Cold weather may suppress offense');
  
  // Wind impact
  if (windSpeed > 15) {
    if (windDeg && (windDeg > 45 && windDeg < 135)) {
      impacts.push('Strong wind OUT to LF — favors hitters, especially lefties');
    } else if (windDeg && (windDeg > 225 && windDeg < 315)) {
      impacts.push('Strong wind IN from LF — favors pitchers');
    } else {
      impacts.push('Strong winds may affect fly balls');
    }
  }
  
  // Condition impact
  if (condition?.includes('rain')) impacts.push('Rain may delay game or affect pitcher grip');
  if (condition?.includes('cloud')) impacts.push('Overcast skies may reduce visibility');
  
  return impacts.length > 0 ? impacts : ['Neutral conditions'];
}

// ─── H2H MATCHUPS ──────────────────────────────────────────────────────────

/**
 * Fetch head-to-head history between two teams this season
 */
async function fetchH2H(homeTeam, awayTeam, homeId, awayId) {
  // Get home team schedule and filter for games vs away team
  const schedule = await safeFetch(`${ESPN_BASE}/teams/${homeId}/schedule`);
  if (!schedule?.events) return [];

  const h2hGames = schedule.events
    .filter(e => {
      if (!e.competitions?.[0]?.status?.type?.completed) return false;
      const competitors = e.competitions[0].competitors;
      const opponentId = competitors.find(c => c.team?.id != homeId)?.team?.id;
      return opponentId == awayId;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return h2hGames.map(game => {
    const comp = game.competitions[0];
    const homeComp = comp.competitors.find(c => c.team?.id == homeId);
    const awayComp = comp.competitors.find(c => c.team?.id == awayId);
    
    return {
      date: game.date,
      homeScore: parseInt(homeComp?.score?.value || 0),
      awayScore: parseInt(awayComp?.score?.value || 0),
      winner: parseInt(homeComp?.score?.value || 0) > parseInt(awayComp?.score?.value || 0) ? homeTeam : awayTeam,
    };
  });
}

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────

/**
 * Main function: fetch comprehensive MLB game research data
 * @param {string} homeTeam - Full team name (e.g., "Los Angeles Dodgers")
 * @param {string} awayTeam - Full team name (e.g., "New York Yankees")
 * @param {string} gameDate - ISO date string for the game
 * @returns {Object} Structured research data
 */
export async function getBaseballResearch(homeTeam, awayTeam, gameDate) {
  const homeId = getTeamId(homeTeam);
  const awayId = getTeamId(awayTeam);

  if (!homeId || !awayId) {
    return {
      error: 'Team not found in MLB database',
      homeTeam,
      awayTeam,
      validTeams: Object.keys(MLB_IDS),
    };
  }

  try {
    // Fetch all data in parallel where possible
    const [
      pitchingMatchup,
      homeOffense,
      awayOffense,
      homeBullpen,
      awayBullpen,
      h2h,
      weather,
      homeSeasonStats,
      awaySeasonStats,
    ] = await Promise.all([
      fetchPitchingMatchup(homeTeam, awayTeam, gameDate),
      fetchOffensiveForm(homeTeam, homeId),
      fetchOffensiveForm(awayTeam, awayId),
      fetchBullpenStats(homeId),
      fetchBullpenStats(awayId),
      fetchH2H(homeTeam, awayTeam, homeId, awayId),
      fetchWeather(homeTeam, gameDate),
      fetchTeamBattingStats(homeId),
      fetchTeamBattingStats(awayId),
    ]);

    // Enrich pitching data with last 3 starts + vs opponent history
    if (pitchingMatchup.home?.id) {
      const homeStartsData = await fetchPitcherLastStarts(pitchingMatchup.home.id, homeId, awayTeam);
      pitchingMatchup.home.last3Starts = homeStartsData.starts;
      pitchingMatchup.home.vsOpponent = homeStartsData.vsOpponent;
    }
    if (pitchingMatchup.away?.id) {
      const awayStartsData = await fetchPitcherLastStarts(pitchingMatchup.away.id, awayId, homeTeam);
      pitchingMatchup.away.last3Starts = awayStartsData.starts;
      pitchingMatchup.away.vsOpponent = awayStartsData.vsOpponent;
    }

    const parkFactor = getParkFactorData(homeTeam);

    // Build betting trends
    const trends = buildBaseballTrends(homeOffense, awayOffense, homeBullpen, awayBullpen, pitchingMatchup, parkFactor, h2h);

    return {
      sport: 'baseball_mlb',
      homeTeam,
      awayTeam,
      gameDate,
      timestamp: new Date().toISOString(),
      pitchingMatchup,
      offensiveForm: {
        home: { ...homeOffense, seasonStats: homeSeasonStats },
        away: { ...awayOffense, seasonStats: awaySeasonStats },
      },
      bullpen: {
        home: homeBullpen,
        away: awayBullpen,
      },
      parkFactor,
      weather,
      h2h,
      trends,
      meta: {
        dataSources: ['ESPN API', 'OpenWeatherMap (if configured)'],
        notes: [
          'Pitching matchup estimated from rotation if probable starter not announced',
          'Bullpen stats cover last 7 days of games',
          'Weather requires OPENWEATHER_API_KEY environment variable',
        ],
      },
    };
  } catch (err) {
    console.error('Baseball research error:', err);
    return {
      error: err.message,
      homeTeam,
      awayTeam,
      gameDate,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── TREND BUILDER ─────────────────────────────────────────────────────────

function buildBaseballTrends(homeOffense, awayOffense, homeBullpen, awayBullpen, pitchingMatchup, parkFactor, h2h) {
  const trends = [];
  const push = (label, desc, confidence, icon) => trends.push({ label, description: desc, confidence, icon });

  // Offensive trends
  if (homeOffense?.summary) {
    const avgRuns = homeOffense.summary.avgRunsScored;
    if (avgRuns >= 6) push('🔥 Home Offense Hot', `${avgRuns.toFixed(1)} runs/game last 5`, 'high', '🔥');
    else if (avgRuns >= 4.5) push('📈 Home Offense Strong', `${avgRuns.toFixed(1)} runs/game last 5`, 'medium', '📈');
    else if (avgRuns < 3) push('📉 Home Offense Cold', `${avgRuns.toFixed(1)} runs/game last 5`, 'high', '📉');
  }

  if (awayOffense?.summary) {
    const avgRuns = awayOffense.summary.avgRunsScored;
    if (avgRuns >= 6) push('🔥 Away Offense Hot', `${avgRuns.toFixed(1)} runs/game last 5`, 'high', '🔥');
    else if (avgRuns >= 4.5) push('📈 Away Offense Strong', `${avgRuns.toFixed(1)} runs/game last 5`, 'medium', '📈');
    else if (avgRuns < 3) push('📉 Away Offense Cold', `${avgRuns.toFixed(1)} runs/game last 5`, 'high', '📉');
  }

  // Bullpen trends
  if (homeBullpen?.era !== undefined) {
    if (homeBullpen.era > 5.5) push('🏠 Home Bullpen Struggling', `ERA ${homeBullpen.era} last 7 days`, 'high', '⚠️');
    else if (homeBullpen.era < 3) push('🏠 Home Bullpen Strong', `ERA ${homeBullpen.era} last 7 days`, 'medium', '💪');
  }

  if (awayBullpen?.era !== undefined) {
    if (awayBullpen.era > 5.5) push('✈️ Away Bullpen Struggling', `ERA ${awayBullpen.era} last 7 days`, 'high', '⚠️');
    else if (awayBullpen.era < 3) push('✈️ Away Bullpen Strong', `ERA ${awayBullpen.era} last 7 days`, 'medium', '💪');
  }

  // Pitching matchup trends
  if (pitchingMatchup.home?.era !== undefined && pitchingMatchup.away?.era !== undefined) {
    const homeERA = pitchingMatchup.home.era;
    const awayERA = pitchingMatchup.away.era;
    
    if (homeERA < 3 && awayERA > 4.5) {
      push('⚾ Pitching Mismatch', `${pitchingMatchup.home.name} (${homeERA} ERA) vs ${pitchingMatchup.away.name} (${awayERA} ERA)`, 'high', '⚾');
    } else if (awayERA < 3 && homeERA > 4.5) {
      push('⚾ Pitching Mismatch', `${pitchingMatchup.away.name} (${awayERA} ERA) vs ${pitchingMatchup.home.name} (${homeERA} ERA)`, 'high', '⚾');
    }
  }

  // Park factor trend
  if (parkFactor?.factor) {
    if (parkFactor.factor > 105) {
      push('🏟️ Hitter-Friendly Park', `${parkFactor.parkName} (factor: ${parkFactor.factor})`, 'medium', '🏟️');
    } else if (parkFactor.factor < 95) {
      push('🏟️ Pitcher-Friendly Park', `${parkFactor.parkName} (factor: ${parkFactor.factor})`, 'medium', '🏟️');
    }
  }

  // H2H trend
  if (h2h?.length >= 2) {
    const homeWins = h2h.filter(g => g.winner === homeTeam).length;
    push('🎯 H2H History', `${homeTeam} ${homeWins}-${h2h.length - homeWins} in ${h2h.length} meetings`, 'medium', '🎯');
  }

  return trends;
}

export default getBaseballResearch;
