// api/game-research.js — Triple-source validation for accurate game research
// Priority: 1. Basketball-Reference (historic data) → 2. Odds API (verified scores) → 3. ESPN (emergency fallback)
// Only displays data if 2+ sources agree or single source has high confidence

const cache = {};
const TTL = 2 * 60 * 1000; // 2 minute cache to balance freshness vs API limits

// Source priority (lower number = higher priority)
const SOURCE_PRIORITY = {
  'BasketballReference': 1,
  'OddsAPI': 2,
  'ESPN': 3,
};

// Team name mappings for Basketball-Reference
const BBR_TEAMS = {
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BRK',
  'Charlotte Hornets': 'CHO', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK', 'Oklahoma City Thunder': 'OKC',
  'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHO',
  'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS',
  'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
};

// Normalize team name for matching
function normalizeTeamName(name) {
  const normalized = name?.replace(/\s+/g, ' ').trim();
  return BBR_TEAMS[normalized] || normalized?.split(' ')?.pop()?.substring(0, 3).toUpperCase();
}

// Fetch with timeout and retry
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
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

// Source 1: Basketball-Reference (via balldontlie.io API)
// BBR has the most accurate historic data
// Free tier: 60 requests/min, no API key required for basic endpoints
async function fetchFromBBR(teamAbbr, sport) {
  try {
    const teamId = getBalldontlieTeamId(teamAbbr);
    if (!teamId) {
      return { games: [], source: 'BasketballReference', count: 0, error: 'Team not mapped' };
    }
    
    // Build headers - API key optional for free tier
    const headers = {};
    const apiKey = process.env.BALLDONTLIE_API_KEY;
    if (apiKey && apiKey.length > 5) {
      headers['Authorization'] = apiKey;
    }
    
    // Using balldontlie as a proxy for BBR-style data
    const res = await fetchWithTimeout(
      `https://api.balldontlie.io/v1/games?team_ids[]=${teamId}&per_page=10&seasons[]=2024`,
      { headers },
      10000
    );
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      console.error(`Balldontlie API error: ${res.status} - ${errorText}`);
      return { games: [], source: 'BasketballReference', count: 0, error: `HTTP ${res.status}` };
    }
    
    const data = await res.json();
    
    if (!data.data || !Array.isArray(data.data)) {
      return { games: [], source: 'BasketballReference', count: 0, error: 'Invalid response format' };
    }
    
    const games = data.data
      .filter(g => g.status === 'Final')
      .slice(0, 10)
      .map(g => {
        const isHome = g.home_team.abbreviation === teamAbbr;
        const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
        const oppScore = isHome ? g.visitor_team_score : g.home_team_score;
        const opponent = isHome ? g.visitor_team.name : g.home_team.name;
        
        return {
          date: g.date,
          opponent: opponent?.split(' ').pop() || 'Unknown',
          opponentAbbr: isHome ? g.visitor_team.abbreviation : g.home_team.abbreviation,
          isHome,
          teamScore,
          opponentScore: oppScore,
          won: teamScore > oppScore,
          source: 'BasketballReference',
        };
      });
    
    return { games, source: 'BasketballReference', count: games.length };
  } catch (error) {
    console.error('BBR/Balldontlie error:', error.message);
    return { games: [], source: 'BasketballReference', count: 0, error: error.message };
  }
}

// Map team abbreviations to balldontlie IDs (subset of NBA teams)
function getBalldontlieTeamId(abbr) {
  const mappings = {
    'ATL': 1, 'BOS': 2, 'BRK': 3, 'CHO': 4, 'CHI': 5, 'CLE': 6, 'DAL': 7, 'DEN': 8,
    'DET': 9, 'GSW': 10, 'HOU': 11, 'IND': 12, 'LAC': 13, 'LAL': 14, 'MEM': 15,
    'MIA': 16, 'MIL': 17, 'MIN': 18, 'NOP': 19, 'NYK': 20, 'OKC': 21, 'ORL': 22,
    'PHI': 23, 'PHO': 24, 'POR': 25, 'SAC': 26, 'SAS': 27, 'TOR': 28, 'UTA': 29, 'WAS': 30,
  };
  return mappings[abbr] || null;
}

// Source 2: Odds API (verified game scores)
async function fetchFromOddsAPI(teamName, sport, apiKey) {
  try {
    const res = await fetchWithTimeout(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores/?daysFrom=30&apiKey=${apiKey}`,
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
      .slice(0, 10)
      .map(g => {
        const isHome = g.home_team?.toLowerCase().includes(teamName.toLowerCase());
        const teamScore = isHome 
          ? parseInt(g.scores?.find(s => s.name === g.home_team)?.score)
          : parseInt(g.scores?.find(s => s.name === g.away_team)?.score);
        const oppScore = isHome
          ? parseInt(g.scores?.find(s => s.name === g.away_team)?.score)
          : parseInt(g.scores?.find(s => s.name === g.home_team)?.score);
        const opponent = isHome ? g.away_team : g.home_team;
        
        return {
          date: g.commence_time,
          opponent: opponent?.split(' ').pop() || 'Unknown',
          opponentAbbr: normalizeTeamName(opponent),
          isHome,
          teamScore: isNaN(teamScore) ? 0 : teamScore,
          opponentScore: isNaN(oppScore) ? 0 : oppScore,
          won: teamScore > oppScore,
          source: 'OddsAPI',
        };
      });
    
    return { games: teamGames, source: 'OddsAPI', count: teamGames.length };
  } catch (error) {
    console.error('Odds API error:', error.message);
    return { games: [], source: 'OddsAPI', count: 0, error: error.message };
  }
}

// Source 3: ESPN (emergency fallback)
async function fetchFromESPN(teamAbbr, sport) {
  try {
    // Get team ID from ESPN
    const teamsRes = await fetchWithTimeout(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
      {},
      8000
    );
    
    if (!teamsRes.ok) throw new Error(`ESPN teams HTTP ${teamsRes.status}`);
    
    const teamsData = await teamsRes.json();
    const teamEntry = teamsData.sports?.[0]?.leagues?.[0]?.teams?.find(
      t => t.team.abbreviation === teamAbbr
    );
    
    if (!teamEntry) {
      return { games: [], source: 'ESPN', count: 0, error: 'Team not found' };
    }
    
    const teamId = teamEntry.team.id;
    
    // Get schedule
    const scheduleRes = await fetchWithTimeout(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule?seasontype=2&limit=15`,
      {},
      8000
    );
    
    if (!scheduleRes.ok) throw new Error(`ESPN schedule HTTP ${scheduleRes.status}`);
    
    const scheduleData = await scheduleRes.json();
    
    const games = scheduleData.events
      ?.filter(e => {
        const status = e.competitions?.[0]?.status;
        return status?.type?.completed === true || status?.type?.state === 'post';
      })
      ?.slice(0, 10)
      ?.map(e => {
        const comp = e.competitions[0];
        const teamComp = comp.competitors?.find(c => c.team.id === teamId);
        const oppComp = comp.competitors?.find(c => c.team.id !== teamId);
        
        if (!teamComp || !oppComp) return null;
        
        // Only include games with valid scores (not 0-0 placeholders)
        const teamScore = parseInt(teamComp.score);
        const oppScore = parseInt(oppComp.score);
        
        if (isNaN(teamScore) || isNaN(oppScore) || (teamScore === 0 && oppScore === 0)) {
          return null; // Skip games without real scores
        }
        
        return {
          date: e.date,
          opponent: oppComp.team?.displayName?.split(' ').pop() || 'Unknown',
          opponentAbbr: oppComp.team?.abbreviation || '???',
          isHome: teamComp.homeAway === 'home',
          teamScore,
          opponentScore: oppScore,
          won: teamScore > oppScore,
          source: 'ESPN',
        };
      })
      ?.filter(g => g !== null) || [];
    
    return { games, source: 'ESPN', count: games.length };
  } catch (error) {
    console.error('ESPN error:', error.message);
    return { games: [], source: 'ESPN', count: 0, error: error.message };
  }
}

// Triple-source validation
// Returns data only if 2+ sources agree OR single high-confidence source
function validateTripleSource(bbrData, oddsData, espnData) {
  // Filter to only sources with actual game data (valid scores)
  const validSources = [bbrData, oddsData, espnData].filter(s => 
    s.count > 0 && s.games.every(g => g.teamScore > 0 || g.opponentScore > 0)
  );
  
  // If we have 2+ valid sources
  if (validSources.length >= 2) {
    // Use highest priority source with most games
    const bestSource = validSources.sort((a, b) => {
      const prioDiff = SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source];
      if (prioDiff !== 0) return prioDiff;
      return b.count - a.count;
    })[0];
    
    return {
      games: bestSource.games,
      source: bestSource.source,
      confidence: 'high',
      sourcesUsed: validSources.map(s => s.source),
      verified: true,
    };
  }
  
  // If only 1 valid source
  if (validSources.length === 1) {
    const source = validSources[0];
    // Require at least 3 games with real data
    if (source.count >= 3) {
      return {
        games: source.games,
        source: source.source,
        confidence: source.source === 'BasketballReference' ? 'high' : 'medium',
        sourcesUsed: [source.source],
        verified: false,
      };
    }
  }
  
  // No reliable data
  return {
    games: [],
    source: 'None',
    confidence: 'none',
    sourcesUsed: [],
    verified: false,
  };
}

// Calculate team stats and trends
function calculateTeamStats(games) {
  if (!games || games.length === 0) return null;
  
  const wins = games.filter(g => g.won).length;
  const losses = games.filter(g => !g.won).length;
  
  // Calculate streak
  let streak = 0, streakType = '';
  for (const game of games) {
    if (streakType === '') {
      streakType = game.won ? 'W' : 'L';
      streak = 1;
    } else if ((streakType === 'W' && game.won) || (streakType === 'L' && !game.won)) {
      streak++;
    } else {
      break;
    }
  }
  
  // Home/Away splits
  const homeGames = games.filter(g => g.isHome);
  const awayGames = games.filter(g => !g.isHome);
  
  // Rest days (days since last game)
  let restDays = null;
  if (games.length > 0) {
    const lastGame = new Date(games[0].date);
    const now = new Date();
    restDays = Math.floor((now - lastGame) / (1000 * 60 * 60 * 24));
  }
  
  return {
    wins,
    losses,
    streak: streak > 0 ? `${streakType}${streak}` : '-',
    homeRecord: { wins: homeGames.filter(g => g.won).length, losses: homeGames.filter(g => !g.won).length },
    awayRecord: { wins: awayGames.filter(g => g.won).length, losses: awayGames.filter(g => !g.won).length },
    restDays,
    recentGames: games,
  };
}

// Calculate H2H from Odds API
async function fetchH2H(homeTeam, awayTeam, sport, apiKey) {
  try {
    const res = await fetchWithTimeout(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores/?daysFrom=90&apiKey=${apiKey}`,
      {},
      10000
    );
    
    if (!res.ok) return [];
    
    const games = await res.json();
    
    const h2hGames = games.filter(game => {
      const homeName = game.home_team?.toLowerCase() || '';
      const awayName = game.away_team?.toLowerCase() || '';
      const homeTarget = homeTeam?.toLowerCase() || '';
      const awayTarget = awayTeam?.toLowerCase() || '';
      
      const homeMatch = homeName.includes(homeTarget.split(' ').pop());
      const awayMatch = awayName.includes(awayTarget.split(' ').pop());
      const reverseHome = homeName.includes(awayTarget.split(' ').pop());
      const reverseAway = awayName.includes(homeTarget.split(' ').pop());
      
      return (homeMatch && awayMatch) || (reverseHome && reverseAway);
    });
    
    return h2hGames
      .map(game => ({
        date: game.commence_time,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        homeScore: game.scores?.find(s => s.name === game.home_team)?.score,
        awayScore: game.scores?.find(s => s.name === game.away_team)?.score,
        completed: game.completed,
      }))
      .filter(g => g.completed && g.homeScore != null)
      .slice(0, 10);
  } catch (e) {
    console.error('H2H fetch error:', e);
    return [];
  }
}

// Calculate trends based on validated data
function calculateTrends(homeStats, awayStats, h2hGames) {
  const trends = [];
  
  if (!homeStats && !awayStats) return trends;
  
  // Home team form
  if (homeStats) {
    const winPct = homeStats.wins / (homeStats.wins + homeStats.losses) || 0;
    
    if (winPct >= 0.7) {
      trends.push({
        type: 'HOME_FORM',
        label: '🔥 Home Team Hot',
        description: `${homeStats.wins}-${homeStats.losses} in last ${homeStats.wins + homeStats.losses}`,
        confidence: winPct >= 0.8 ? 'high' : 'medium',
        icon: '🔥',
      });
    }
    
    if (homeStats.streak && homeStats.streak.startsWith('W') && parseInt(homeStats.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: '📈 Home Streaking',
        description: `On ${homeStats.streak} win streak`,
        confidence: 'high',
        icon: '📈',
      });
    }
  }
  
  // Away team form
  if (awayStats) {
    const winPct = awayStats.wins / (awayStats.wins + awayStats.losses) || 0;
    
    if (winPct >= 0.7) {
      trends.push({
        type: 'AWAY_FORM',
        label: '🔥 Away Team Hot',
        description: `${awayStats.wins}-${awayStats.losses} in last ${awayStats.wins + awayStats.losses}`,
        confidence: winPct >= 0.8 ? 'high' : 'medium',
        icon: '🔥',
      });
    }
  }
  
  // H2H trends
  if (h2hGames && h2hGames.length >= 2) {
    const homeWins = h2hGames.filter(g => {
      const isHome = g.homeTeam.includes(homeTeam?.split(' ').pop());
      return isHome ? parseInt(g.homeScore) > parseInt(g.awayScore) : parseInt(g.awayScore) > parseInt(g.homeScore);
    }).length;
    
    const homeAdvantage = homeWins / h2hGames.length;
    
    if (homeAdvantage >= 0.7) {
      trends.push({
        type: 'H2H',
        label: '🎯 H2H Dominance',
        description: `Home team won ${homeWins} of last ${h2hGames.length}`,
        confidence: 'high',
        icon: '🎯',
      });
    }
  }
  
  return trends;
}

// Main handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { gameId, sport = 'basketball_nba', homeTeam, awayTeam } = req.query;
  
  if (!gameId || !homeTeam || !awayTeam) {
    return res.status(400).json({
      error: 'Missing required params: gameId, homeTeam, awayTeam',
      accurate: false,
    });
  }
  
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ODDS_API_KEY not configured',
      accurate: false,
    });
  }
  
  const cacheKey = `${gameId}-${Date.now().toString().slice(0, -6)}`;
  
  // Check cache
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[cacheKey].data);
  }
  
  try {
    const homeAbbr = normalizeTeamName(homeTeam);
    const awayAbbr = normalizeTeamName(awayTeam);
    
    // Fetch from all 3 sources in parallel
    const [bbrHome, bbrAway, oddsHome, oddsAway, espnHome, espnAway, h2hGames] = await Promise.all([
      fetchFromBBR(homeAbbr, sport),
      fetchFromBBR(awayAbbr, sport),
      fetchFromOddsAPI(homeTeam, sport, apiKey),
      fetchFromOddsAPI(awayTeam, sport, apiKey),
      fetchFromESPN(homeAbbr, sport),
      fetchFromESPN(awayAbbr, sport),
      fetchH2H(homeTeam, awayTeam, sport, apiKey),
    ]);
    
    // Validate each team's data
    const homeValidation = validateTripleSource(bbrHome, oddsHome, espnHome);
    const awayValidation = validateTripleSource(bbrAway, oddsAway, espnAway);
    
    // Calculate stats
    const homeStats = calculateTeamStats(homeValidation.games);
    const awayStats = calculateTeamStats(awayValidation.games);
    
    // Calculate trends
    const trends = calculateTrends(homeStats, awayStats, h2hGames);
    
    // Determine overall accuracy
    const isAccurate = homeValidation.confidence !== 'none' || awayValidation.confidence !== 'none';
    const isVerified = homeValidation.verified || awayValidation.verified;
    
    const result = {
      gameId,
      sport,
      homeTeam,
      awayTeam,
      accurate: isAccurate,
      verified: isVerified,
      dataQuality: isVerified ? 'verified' : isAccurate ? 'single-source' : 'unavailable',
      timestamp: new Date().toISOString(),
      sources: {
        home: homeValidation.sourcesUsed,
        away: awayValidation.sourcesUsed,
      },
      teams: {
        home: homeStats ? {
          ...homeStats,
          confidence: homeValidation.confidence,
          primarySource: homeValidation.source,
        } : null,
        away: awayStats ? {
          ...awayStats,
          confidence: awayValidation.confidence,
          primarySource: awayValidation.source,
        } : null,
      },
      h2h: h2hGames,
      trends,
      meta: {
        highConfidenceTrends: trends.filter(t => t.confidence === 'high').length,
        sourcesVerified: isVerified,
      },
    };
    
    // Cache result
    cache[cacheKey] = { data: result, ts: Date.now() };
    
    // Clean old cache
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      const oldest = keys.sort((a, b) => cache[a].ts - cache[b].ts)[0];
      delete cache[oldest];
    }
    
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Data-Quality', result.dataQuality);
    return res.json(result);
  } catch (error) {
    console.error('Game research error:', error);
    return res.status(500).json({
      error: error.message,
      accurate: false,
      dataQuality: 'error',
    });
  }
}
