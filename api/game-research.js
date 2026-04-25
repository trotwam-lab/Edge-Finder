// api/game-research.js — ESPN (Last 10) + Odds API (H2H scores) hybrid
// Now with sport-specific routing for baseball (rich MLB data)

import getBaseballResearch, { MLB_IDS } from './game-research-baseball.js';

const cache = {};
const TTL = 5 * 60 * 1000; // 5 min cache

// ─── ESPN sport routing ────────────────────────────────────────────────────
// Maps Odds API sport_key prefix → ESPN sport path segment
const ESPN_SPORT_PATH = {
  basketball: 'basketball/nba',
  americanfootball: 'football/nfl',
  baseball: 'baseball/mlb',
  icehockey: 'hockey/nhl',
  soccer: 'soccer/usa.1', // MLS fallback
};

// NBA team name → ESPN team ID
const NBA_IDS = {
  'Atlanta Hawks':1,'Boston Celtics':2,'Brooklyn Nets':17,'Charlotte Hornets':30,
  'Chicago Bulls':4,'Cleveland Cavaliers':5,'Dallas Mavericks':6,'Denver Nuggets':7,
  'Detroit Pistons':8,'Golden State Warriors':9,'Houston Rockets':10,'Indiana Pacers':11,
  'LA Clippers':12,'Los Angeles Clippers':12,'Los Angeles Lakers':13,'Memphis Grizzlies':29,
  'Miami Heat':14,'Milwaukee Bucks':15,'Minnesota Timberwolves':16,'New Orleans Pelicans':3,
  'New York Knicks':18,'Oklahoma City Thunder':25,'Orlando Magic':19,'Philadelphia 76ers':20,
  'Phoenix Suns':21,'Portland Trail Blazers':22,'Sacramento Kings':23,'San Antonio Spurs':24,
  'Toronto Raptors':28,'Utah Jazz':26,'Washington Wizards':27,
};

// NFL team name → ESPN team ID
const NFL_IDS = {
  'Arizona Cardinals':22,'Atlanta Falcons':1,'Baltimore Ravens':33,'Buffalo Bills':2,
  'Carolina Panthers':29,'Chicago Bears':3,'Cincinnati Bengals':4,'Cleveland Browns':5,
  'Dallas Cowboys':6,'Denver Broncos':7,'Detroit Lions':8,'Green Bay Packers':9,
  'Houston Texans':34,'Indianapolis Colts':11,'Jacksonville Jaguars':30,'Kansas City Chiefs':12,
  'Las Vegas Raiders':13,'Los Angeles Chargers':24,'Los Angeles Rams':14,'Miami Dolphins':15,
  'Minnesota Vikings':16,'New England Patriots':17,'New Orleans Saints':18,'New York Giants':19,
  'New York Jets':20,'Philadelphia Eagles':21,'Pittsburgh Steelers':23,'San Francisco 49ers':25,
  'Seattle Seahawks':26,'Tampa Bay Buccaneers':27,'Tennessee Titans':10,'Washington Commanders':28,
};

// MLB_IDS imported from game-research-baseball.js to avoid duplication

// NHL team name → ESPN team ID
const NHL_IDS = {
  'Anaheim Ducks':25,'Arizona Coyotes':53,'Boston Bruins':1,'Buffalo Sabres':2,
  'Calgary Flames':3,'Carolina Hurricanes':12,'Chicago Blackhawks':4,'Colorado Avalanche':17,
  'Columbus Blue Jackets':29,'Dallas Stars':9,'Detroit Red Wings':5,'Edmonton Oilers':22,
  'Florida Panthers':13,'Los Angeles Kings':26,'Minnesota Wild':30,'Montreal Canadiens':8,
  'Nashville Predators':18,'New Jersey Devils':1,'New York Islanders':19,'New York Rangers':20,
  'Ottawa Senators':9,'Philadelphia Flyers':21,'Pittsburgh Penguins':23,'San Jose Sharks':28,
  'Seattle Kraken':55,'St. Louis Blues':24,'Tampa Bay Lightning':14,'Toronto Maple Leafs':10,
  'Vancouver Canucks':15,'Vegas Golden Knights':54,'Washington Capitals':16,'Winnipeg Jets':52,
};

function getESPNId(teamName, sportKey) {
  const prefix = (sportKey || '').split('_')[0];
  const map = prefix === 'americanfootball' ? NFL_IDS
    : prefix === 'baseball' ? MLB_IDS
    : prefix === 'icehockey' ? NHL_IDS
    : NBA_IDS;
  return map[teamName] || null;
}

function getESPNPath(sportKey) {
  const prefix = (sportKey || 'basketball_nba').split('_')[0];
  return ESPN_SPORT_PATH[prefix] || 'basketball/nba';
}

// ─── ESPN: fetch last 10 completed games ──────────────────────────────────
async function fetchESPNLast10(teamName, teamId, sportPath) {
  if (!teamId) return { games: [], error: 'Team not in ESPN map' };
  try {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamId}/schedule`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
    const data = await res.json();
    const events = data.events || [];

    const completed = events
      .filter(e => e.competitions?.[0]?.status?.type?.completed === true)
      .reverse() // most recent first
      .slice(0, 10)
      .map(e => {
        const comp = e.competitions[0];
        const c0 = comp.competitors[0]; // home
        const c1 = comp.competitors[1]; // away
        const isHome = c0.team.displayName === teamName || c0.team.shortDisplayName === teamName || c0.team.name === teamName;
        const teamComp = isHome ? c0 : c1;
        const oppComp  = isHome ? c1 : c0;
        const teamScore = parseInt(teamComp.score?.displayValue || teamComp.score?.value || 0);
        const oppScore  = parseInt(oppComp.score?.displayValue  || oppComp.score?.value  || 0);
        return {
          date: e.date,
          opponent: oppComp.team.displayName,
          opponentAbbr: oppComp.team.abbreviation || oppComp.team.displayName?.split(' ').pop(),
          isHome,
          teamScore,
          opponentScore: oppScore,
          won: teamScore > oppScore,
          source: 'ESPN',
        };
      })
      .filter(g => g.teamScore > 0 || g.opponentScore > 0);

    return { games: completed, count: completed.length };
  } catch (err) {
    console.error('ESPN error:', err.message);
    return { games: [], count: 0, error: err.message };
  }
}

// ─── Odds API: completed scores for last N days ───────────────────────────
async function fetchOddsScores(sport, apiKey, daysFrom = 10) {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=${daysFrom}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) throw new Error(`Odds API HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Odds scores error:', err.message);
    return [];
  }
}

function filterTeamGames(scores, teamName) {
  const last = teamName.split(' ').pop();
  return scores
    .filter(g => g.completed && (g.home_team.includes(last) || g.away_team.includes(last)))
    .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
    .slice(0, 10)
    .map(g => {
      const isHome = g.home_team.includes(last);
      const s0 = parseInt(g.scores?.[0]?.score || 0);
      const s1 = parseInt(g.scores?.[1]?.score || 0);
      const teamScore = isHome ? s0 : s1;
      const oppScore  = isHome ? s1 : s0;
      return {
        date: g.commence_time,
        opponent: isHome ? g.away_team : g.home_team,
        opponentAbbr: (isHome ? g.away_team : g.home_team).split(' ').pop(),
        isHome,
        teamScore,
        opponentScore: oppScore,
        won: teamScore > oppScore,
        source: 'OddsAPI',
      };
    })
    .filter(g => g.teamScore > 0 || g.opponentScore > 0);
}

function filterH2H(scores, homeTeam, awayTeam) {
  const homeLast = homeTeam.split(' ').pop();
  const awayLast = awayTeam.split(' ').pop();
  return scores
    .filter(g => {
      if (!g.completed) return false;
      const h = g.home_team, a = g.away_team;
      return (h.includes(homeLast) && a.includes(awayLast)) ||
             (h.includes(awayLast) && a.includes(homeLast));
    })
    .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
    .slice(0, 5)
    .map(g => ({
      date: g.commence_time,
      homeTeam: g.home_team,
      awayTeam: g.away_team,
      homeScore: g.scores?.[0]?.score,
      awayScore: g.scores?.[1]?.score,
    }));
}

// ─── Stats + trends ───────────────────────────────────────────────────────
function buildStats(games) {
  if (!games || games.length === 0) return null;
  const wins = games.filter(g => g.won).length;
  const losses = games.length - wins;

  let streak = 0, streakType = '';
  for (const g of games) {
    if (!streakType) { streakType = g.won ? 'W' : 'L'; streak = 1; }
    else if ((streakType === 'W') === g.won) streak++;
    else break;
  }

  const homeGames = games.filter(g => g.isHome);
  const awayGames = games.filter(g => !g.isHome);
  return {
    wins, losses,
    record: `${wins}-${losses}`,
    streak: streak > 0 ? `${streakType}${streak}` : '-',
    homeRecord: { wins: homeGames.filter(g=>g.won).length, losses: homeGames.filter(g=>!g.won).length },
    awayRecord: { wins: awayGames.filter(g=>g.won).length, losses: awayGames.filter(g=>!g.won).length },
    recentGames: games.slice(0, 10),
  };
}

function buildTrends(homeStats, awayStats, h2h) {
  const trends = [];
  const push = (label, desc, confidence, icon) => trends.push({ label, description: desc, confidence, icon });

  if (homeStats) {
    const pct = homeStats.wins / (homeStats.wins + homeStats.losses);
    if (pct >= 0.7) push('🔥 Home Team Hot', `${homeStats.wins}-${homeStats.losses} last ${homeStats.wins+homeStats.losses}`, 'high', '🔥');
    else if (pct >= 0.6) push('Home Team Strong', `${homeStats.wins}-${homeStats.losses} last ${homeStats.wins+homeStats.losses}`, 'medium', '📈');
    const streak = parseInt(homeStats.streak.slice(1));
    if (homeStats.streak.startsWith('W') && streak >= 3) push('📈 Home Win Streak', `W${streak} streak`, 'high', '📈');
    if (homeStats.streak.startsWith('L') && streak >= 3) push('📉 Home Losing Streak', `L${streak} streak`, 'high', '📉');
  }
  if (awayStats) {
    const pct = awayStats.wins / (awayStats.wins + awayStats.losses);
    if (pct >= 0.7) push('🔥 Away Team Hot', `${awayStats.wins}-${awayStats.losses} last ${awayStats.wins+awayStats.losses}`, 'high', '🔥');
    else if (pct >= 0.6) push('Away Team Strong', `${awayStats.wins}-${awayStats.losses} last ${awayStats.wins+awayStats.losses}`, 'medium', '📈');
    const streak = parseInt(awayStats.streak.slice(1));
    if (awayStats.streak.startsWith('W') && streak >= 3) push('📈 Away Win Streak', `W${streak} streak`, 'high', '📈');
  }
  if (h2h?.length >= 2) push('🎯 H2H History', `${h2h.length} recent meetings found`, 'medium', '🎯');
  return trends;
}

// ─── Handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { gameId, sport = 'basketball_nba', homeTeam, awayTeam } = req.query;
  if (!homeTeam || !awayTeam) return res.status(400).json({ error: 'Missing team names' });

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });

  // ─── BASEBALL BRANCH: Route to rich MLB research module ─────────────────
  if (sport === 'baseball_mlb') {
    try {
      // Parse gameDate from query or default to today
      const gameDate = req.query.gameDate || new Date().toISOString();
      const baseballData = await getBaseballResearch(homeTeam, awayTeam, gameDate);

      // Cache the result
      const cacheKey = `${sport}:${homeTeam}:${awayTeam}`;
      cache[cacheKey] = { data: baseballData, ts: Date.now() };

      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Data-Source', 'ESPN-MLB-Rich');
      return res.json(baseballData);
    } catch (err) {
      console.error('Baseball research route error:', err);
      // Fall through to generic handler on error so we still return something
    }
  }

  // ─── GENERIC BRANCH: Existing NBA/NFL/Other logic (unchanged) ───────────
  const cacheKey = `${sport}:${homeTeam}:${awayTeam}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[cacheKey].data);
  }

  try {
    const sportPath = getESPNPath(sport);
    const homeId = getESPNId(homeTeam, sport);
    const awayId = getESPNId(awayTeam, sport);

    // Fetch ESPN (L10) and Odds API scores (L10 days) in parallel
    const [espnHome, espnAway, oddsScores] = await Promise.all([
      fetchESPNLast10(homeTeam, homeId, sportPath),
      fetchESPNLast10(awayTeam, awayId, sportPath),
      fetchOddsScores(sport, apiKey, 10),
    ]);

    // Merge: prefer ESPN (larger window), supplement with Odds API for very recent
    const oddsHome = filterTeamGames(oddsScores, homeTeam);
    const oddsAway = filterTeamGames(oddsScores, awayTeam);

    // Use ESPN if it has data, else fall back to Odds API
    const homeGames = espnHome.count > 0 ? espnHome.games : oddsHome;
    const awayGames = espnAway.count > 0 ? espnAway.games : oddsAway;
    const h2h = filterH2H(oddsScores, homeTeam, awayTeam);

    const homeStats = buildStats(homeGames);
    const awayStats = buildStats(awayGames);
    const trends = buildTrends(homeStats, awayStats, h2h);

    const result = {
      gameId,
      sport,
      homeTeam,
      awayTeam,
      accurate: homeGames.length > 0 || awayGames.length > 0,
      dataSource: espnHome.count > 0 ? 'ESPN' : 'Odds API',
      timestamp: new Date().toISOString(),
      teams: {
        home: homeStats ? { ...homeStats, team: homeTeam } : null,
        away: homeStats ? { ...awayStats, team: awayTeam } : null,
      },
      h2h,
      trends,
      meta: {
        homeGamesFound: homeGames.length,
        awayGamesFound: awayGames.length,
        highConfidenceTrends: trends.filter(t => t.confidence === 'high').length,
      },
    };

    cache[cacheKey] = { data: result, ts: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    return res.json(result);
  } catch (err) {
    console.error('game-research error:', err);
    return res.status(500).json({ error: err.message, accurate: false });
  }
}
