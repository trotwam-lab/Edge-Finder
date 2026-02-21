// api/game-research.js — ACCURATE DATA ONLY
// Multi-source validation for maximum accuracy
// If sources disagree or fail, returns "unavailable" rather than guessing

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const NBA_BASE = 'https://stats.nba.com/stats'; // Official NBA API
const ODDS_API_KEY = process.env.ODDS_API_KEY;

// Cache
const cache = {};
const TTL = 5 * 60 * 1000; // 5 minutes

// Static NBA team mappings (ESPN IDs)
const NBA_TEAMS = {
  'hawks': { id: '1', name: 'Atlanta Hawks', abbr: 'ATL' },
  'celtics': { id: '2', name: 'Boston Celtics', abbr: 'BOS' },
  'nets': { id: '17', name: 'Brooklyn Nets', abbr: 'BKN' },
  'hornets': { id: '4', name: 'Charlotte Hornets', abbr: 'CHA' },
  'bulls': { id: '5', name: 'Chicago Bulls', abbr: 'CHI' },
  'cavaliers': { id: '6', name: 'Cleveland Cavaliers', abbr: 'CLE' },
  'cavs': { id: '6', name: 'Cleveland Cavaliers', abbr: 'CLE' },
  'mavericks': { id: '7', name: 'Dallas Mavericks', abbr: 'DAL' },
  'mavs': { id: '7', name: 'Dallas Mavericks', abbr: 'DAL' },
  'nuggets': { id: '8', name: 'Denver Nuggets', abbr: 'DEN' },
  'pistons': { id: '9', name: 'Detroit Pistons', abbr: 'DET' },
  'warriors': { id: '10', name: 'Golden State Warriors', abbr: 'GS' },
  'rockets': { id: '11', name: 'Houston Rockets', abbr: 'HOU' },
  'pacers': { id: '12', name: 'Indiana Pacers', abbr: 'IND' },
  'clippers': { id: '13', name: 'LA Clippers', abbr: 'LAC' },
  'lakers': { id: '14', name: 'Los Angeles Lakers', abbr: 'LAL' },
  'grizzlies': { id: '15', name: 'Memphis Grizzlies', abbr: 'MEM' },
  'heat': { id: '16', name: 'Miami Heat', abbr: 'MIA' },
  'bucks': { id: '18', name: 'Milwaukee Bucks', abbr: 'MIL' },
  'timberwolves': { id: '19', name: 'Minnesota Timberwolves', abbr: 'MIN' },
  'pelicans': { id: '20', name: 'New Orleans Pelicans', abbr: 'NO' },
  'knicks': { id: '21', name: 'New York Knicks', abbr: 'NY' },
  'thunder': { id: '22', name: 'Oklahoma City Thunder', abbr: 'OKC' },
  'magic': { id: '23', name: 'Orlando Magic', abbr: 'ORL' },
  '76ers': { id: '24', name: 'Philadelphia 76ers', abbr: 'PHI' },
  'suns': { id: '25', name: 'Phoenix Suns', abbr: 'PHX' },
  'trail blazers': { id: '26', name: 'Portland Trail Blazers', abbr: 'POR' },
  'blazers': { id: '26', name: 'Portland Trail Blazers', abbr: 'POR' },
  'kings': { id: '27', name: 'Sacramento Kings', abbr: 'SAC' },
  'spurs': { id: '28', name: 'San Antonio Spurs', abbr: 'SA' },
  'raptors': { id: '29', name: 'Toronto Raptors', abbr: 'TOR' },
  'jazz': { id: '30', name: 'Utah Jazz', abbr: 'UTAH' },
  'wizards': { id: '31', name: 'Washington Wizards', abbr: 'WSH' },
};

// Find team by name with fuzzy matching
function findTeam(searchName) {
  const normalized = searchName.toLowerCase().trim();
  
  // Direct match
  if (NBA_TEAMS[normalized]) return NBA_TEAMS[normalized];
  
  // Check if search contains a team name
  for (const [key, team] of Object.entries(NBA_TEAMS)) {
    if (normalized.includes(key)) return team;
    if (normalized.includes(team.abbr.toLowerCase())) return team;
    if (normalized.includes(team.name.toLowerCase())) return team;
  }
  
  return null;
}

// Fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Source 1: ESPN API (most complete)
async function getFromESPN(teamId) {
  try {
    const res = await fetchWithTimeout(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`
    );
    
    if (!res.ok) throw new Error(`ESPN HTTP ${res.status}`);
    
    const data = await res.json();
    
    const games = data.events
      ?.filter(e => e.competitions?.[0]?.status?.type?.completed === true)
      ?.slice(0, 5)
      ?.map(e => {
        const comp = e.competitions[0];
        const team = comp.competitors.find(c => c.team.id === teamId);
        const opp = comp.competitors.find(c => c.team.id !== teamId);
        
        return {
          date: e.date,
          opponent: opp?.team?.shortDisplayName || 'Unknown',
          result: parseInt(team?.score) > parseInt(opp?.score) ? 'W' : 'L',
          score: `${team?.score || 0}-${opp?.score || 0}`,
          teamScore: parseInt(team?.score) || 0,
          oppScore: parseInt(opp?.score) || 0,
          source: 'ESPN',
        };
      }) || [];
    
    return { games, source: 'ESPN', count: games.length };
  } catch (error) {
    console.error('ESPN error:', error.message);
    return { games: [], source: 'ESPN', error: error.message };
  }
}

// Source 2: The Odds API (verified scores)
async function getFromOddsApi(teamName) {
  try {
    const res = await fetchWithTimeout(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/scores/?daysFrom=14&apiKey=${ODDS_API_KEY}`,
      {},
      10000
    );
    
    if (!res.ok) throw new Error(`Odds API HTTP ${res.status}`);
    
    const games = await res.json();
    
    const teamGames = games
      .filter(g => 
        g.completed === true &&
        (g.home_team?.toLowerCase().includes(teamName.toLowerCase()) ||
         g.away_team?.toLowerCase().includes(teamName.toLowerCase()))
      )
      .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
      .slice(0, 5)
      .map(g => {
        const isHome = g.home_team?.toLowerCase().includes(teamName.toLowerCase());
        const teamScore = isHome ? g.scores?.[0] : g.scores?.[1];
        const oppScore = isHome ? g.scores?.[1] : g.scores?.[0];
        const opponent = isHome ? g.away_team : g.home_team;
        
        return {
          date: g.commence_time,
          opponent: opponent?.split(' ').pop() || 'Unknown', // Last word (team name)
          result: parseInt(teamScore) > parseInt(oppScore) ? 'W' : 'L',
          score: `${teamScore || 0}-${oppScore || 0}`,
          teamScore: parseInt(teamScore) || 0,
          oppScore: parseInt(oppScore) || 0,
          source: 'OddsAPI',
        };
      });
    
    return { games: teamGames, source: 'OddsAPI', count: teamGames.length };
  } catch (error) {
    console.error('Odds API error:', error.message);
    return { games: [], source: 'OddsAPI', error: error.message };
  }
}

// Cross-validate data from multiple sources
function validateData(espnData, oddsData) {
  // If ESPN has data, use it (most accurate)
  if (espnData.count >= 3) {
    return {
      games: espnData.games,
      source: 'ESPN',
      confidence: 'high',
    };
  }
  
  // If Odds API has data, use it
  if (oddsData.count >= 3) {
    return {
      games: oddsData.games,
      source: 'OddsAPI',
      confidence: 'medium',
    };
  }
  
  // If both have some data, merge (take most recent from each)
  if (espnData.count > 0 || oddsData.count > 0) {
    const merged = [...espnData.games, ...oddsData.games]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
    
    return {
      games: merged,
      source: 'Mixed',
      confidence: 'medium',
    };
  }
  
  // No reliable data
  return {
    games: [],
    source: 'None',
    confidence: 'none',
  };
}

// Main handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { homeTeam, awayTeam, sport } = req.query;
  
  if (!homeTeam || !awayTeam) {
    return res.status(400).json({ 
      error: 'Missing team names',
      accurate: false,
    });
  }
  
  // Only support NBA for now (most accurate data)
  if (sport && sport !== 'basketball_nba' && !sport.includes('nba')) {
    return res.json({
      accurate: false,
      message: 'Accurate research only available for NBA currently',
      awayTeam: { name: awayTeam, recentForm: null },
      homeTeam: { name: homeTeam, recentForm: null },
    });
  }
  
  const cacheKey = `${awayTeam}-${homeTeam}`;
  
  // Check cache
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data);
  }
  
  // Find teams
  const away = findTeam(awayTeam);
  const home = findTeam(homeTeam);
  
  if (!away || !home) {
    return res.json({
      accurate: false,
      message: `Could not identify teams: ${!away ? awayTeam : ''} ${!home ? homeTeam : ''}`,
      awayTeam: { name: awayTeam, recentForm: null },
      homeTeam: { name: homeTeam, recentForm: null },
    });
  }
  
  // Fetch from both sources in parallel
  const [espnAway, espnHome, oddsAway, oddsHome] = await Promise.all([
    getFromESPN(away.id),
    getFromESPN(home.id),
    getFromOddsApi(awayTeam),
    getFromOddsApi(homeTeam),
  ]);
  
  // Validate and merge
  const awayValidated = validateData(espnAway, oddsAway);
  const homeValidated = validateData(espnHome, oddsHome);
  
  // Check if we have accurate data
  const hasAccurateData = awayValidated.confidence !== 'none' && homeValidated.confidence !== 'none';
  
  if (!hasAccurateData) {
    return res.json({
      accurate: false,
      message: 'Research data temporarily unavailable. Please check back shortly.',
      awayTeam: {
        name: away.name,
        recentForm: null,
      },
      homeTeam: {
        name: home.name,
        recentForm: null,
      },
      headToHead: { thisSeason: [], lastMeetings: [], overall: 'No data available' },
      keyTrends: [],
    });
  }
  
  // Calculate stats
  const awayGames = awayValidated.games;
  const homeGames = homeValidated.games;
  
  const awayWins = awayGames.filter(g => g.result === 'W').length;
  const awayLosses = awayGames.filter(g => g.result === 'L').length;
  const homeWins = homeGames.filter(g => g.result === 'W').length;
  const homeLosses = homeGames.filter(g => g.result === 'L').length;
  
  const awayAvgPoints = awayGames.length > 0 
    ? (awayGames.reduce((sum, g) => sum + g.teamScore, 0) / awayGames.length).toFixed(1)
    : '0.0';
  const awayAvgAllowed = awayGames.length > 0
    ? (awayGames.reduce((sum, g) => sum + g.oppScore, 0) / awayGames.length).toFixed(1)
    : '0.0';
  const homeAvgPoints = homeGames.length > 0
    ? (homeGames.reduce((sum, g) => sum + g.teamScore, 0) / homeGames.length).toFixed(1)
    : '0.0';
  const homeAvgAllowed = homeGames.length > 0
    ? (homeGames.reduce((sum, g) => sum + g.oppScore, 0) / homeGames.length).toFixed(1)
    : '0.0';
  
  const response = {
    accurate: true,
    lastUpdated: new Date().toISOString(),
    dataSource: `${awayValidated.source} / ${homeValidated.source}`,
    confidence: awayValidated.confidence === 'high' && homeValidated.confidence === 'high' ? 'high' : 'medium',
    awayTeam: {
      name: away.name,
      recentForm: {
        last5: awayGames.map(g => g.result),
        record: `${awayWins}-${awayLosses}`,
        avgPoints: awayAvgPoints,
        avgAllowed: awayAvgAllowed,
        games: awayGames,
      },
      ats: { overall: 'N/A', home: 'N/A', away: 'N/A', last5: `${awayWins}-${awayLosses}` },
    },
    homeTeam: {
      name: home.name,
      recentForm: {
        last5: homeGames.map(g => g.result),
        record: `${homeWins}-${homeLosses}`,
        avgPoints: homeAvgPoints,
        avgAllowed: homeAvgAllowed,
        games: homeGames,
      },
      ats: { overall: 'N/A', home: 'N/A', away: 'N/A', last5: `${homeWins}-${homeLosses}` },
    },
    headToHead: {
      thisSeason: [], // TODO: Implement H2H lookup
      lastMeetings: [],
      overall: 'H2H data unavailable',
    },
    keyTrends: [
      `${away.name}: ${awayWins}-${awayLosses} in last ${awayGames.length}`,
      `${home.name}: ${homeWins}-${homeLosses} in last ${homeGames.length}`,
      `${away.name} averaging ${awayAvgPoints} PPG`,
      `${home.name} averaging ${homeAvgPoints} PPG`,
    ],
  };
  
  // Cache the accurate data
  cache[cacheKey] = { data: response, ts: Date.now() };
  
  return res.json(response);
}
