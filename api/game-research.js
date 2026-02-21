// api/game-research.js — Comprehensive Game Research with ESPN + Odds API
// Fetches: recent form, team stats, H2H, trends, rest days, home/away splits

const cache = {};
const TTL = 45 * 1000; // 45 second cache for fresher data

// ESPN API endpoints for different sports
const ESPN_ENDPOINTS = {
  basketball_nba: {
    teams: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams',
    scoreboard: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
    standings: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/standings',
  },
  americanfootball_nfl: {
    teams: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams',
    scoreboard: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
    standings: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings',
  },
  icehockey_nhl: {
    teams: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams',
    scoreboard: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
    standings: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/standings',
  },
  baseball_mlb: {
    teams: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/teams',
    scoreboard: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
    standings: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/standings',
  },
};

// Team name mappings (Odds API -> ESPN abbreviation)
const TEAM_MAPPINGS = {
  // NBA
  'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN', 'New York Knicks': 'NY',
  'Philadelphia 76ers': 'PHI', 'Toronto Raptors': 'TOR', 'Chicago Bulls': 'CHI',
  'Cleveland Cavaliers': 'CLE', 'Detroit Pistons': 'DET', 'Indiana Pacers': 'IND',
  'Milwaukee Bucks': 'MIL', 'Atlanta Hawks': 'ATL', 'Charlotte Hornets': 'CHA',
  'Miami Heat': 'MIA', 'Orlando Magic': 'ORL', 'Washington Wizards': 'WSH',
  'Denver Nuggets': 'DEN', 'Minnesota Timberwolves': 'MIN', 'Oklahoma City Thunder': 'OKC',
  'Portland Trail Blazers': 'POR', 'Utah Jazz': 'UTAH', 'Golden State Warriors': 'GS',
  'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL',
  'Phoenix Suns': 'PHX', 'Sacramento Kings': 'SAC', 'Dallas Mavericks': 'DAL',
  'Houston Rockets': 'HOU', 'Memphis Grizzlies': 'MEM', 'New Orleans Pelicans': 'NO',
  'San Antonio Spurs': 'SA',
  // NFL
  'Arizona Cardinals': 'ARI', 'Atlanta Falcons': 'ATL', 'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF', 'Carolina Panthers': 'CAR', 'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN', 'Cleveland Browns': 'CLE', 'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN', 'Detroit Lions': 'DET', 'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU', 'Indianapolis Colts': 'IND', 'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC', 'Las Vegas Raiders': 'LV', 'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LAR', 'Miami Dolphins': 'MIA', 'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE', 'New Orleans Saints': 'NO', 'New York Giants': 'NYG',
  'New York Jets': 'NYJ', 'Philadelphia Eagles': 'PHI', 'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF', 'Seattle Seahawks': 'SEA', 'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN', 'Washington Commanders': 'WSH',
  // NHL
  'Anaheim Ducks': 'ANA', 'Boston Bruins': 'BOS', 'Buffalo Sabres': 'BUF',
  'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR', 'Chicago Blackhawks': 'CHI',
  'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ', 'Dallas Stars': 'DAL',
  'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM', 'Florida Panthers': 'FLA',
  'Los Angeles Kings': 'LA', 'Minnesota Wild': 'MIN', 'Montreal Canadiens': 'MTL',
  'Nashville Predators': 'NSH', 'New Jersey Devils': 'NJ', 'New York Islanders': 'NYI',
  'New York Rangers': 'NYR', 'Ottawa Senators': 'OTT', 'Philadelphia Flyers': 'PHI',
  'Pittsburgh Penguins': 'PIT', 'San Jose Sharks': 'SJ', 'Seattle Kraken': 'SEA',
  'St. Louis Blues': 'STL', 'Tampa Bay Lightning': 'TB', 'Toronto Maple Leafs': 'TOR',
  'Utah Hockey Club': 'UTA', 'Vancouver Canucks': 'VAN', 'Vegas Golden Knights': 'VGK',
  'Washington Capitals': 'WSH', 'Winnipeg Jets': 'WPG',
  // MLB
  'Arizona Diamondbacks': 'ARI', 'Atlanta Braves': 'ATL', 'Baltimore Orioles': 'BAL',
  'Boston Red Sox': 'BOS', 'Chicago Cubs': 'CHC', 'Chicago White Sox': 'CWS',
  'Cincinnati Reds': 'CIN', 'Cleveland Guardians': 'CLE', 'Colorado Rockies': 'COL',
  'Detroit Tigers': 'DET', 'Houston Astros': 'HOU', 'Kansas City Royals': 'KC',
  'Los Angeles Angels': 'LAA', 'Los Angeles Dodgers': 'LAD', 'Miami Marlins': 'MIA',
  'Milwaukee Brewers': 'MIL', 'Minnesota Twins': 'MIN', 'New York Mets': 'NYM',
  'New York Yankees': 'NYY', 'Oakland Athletics': 'OAK', 'Philadelphia Phillies': 'PHI',
  'Pittsburgh Pirates': 'PIT', 'San Diego Padres': 'SD', 'San Francisco Giants': 'SF',
  'Seattle Mariners': 'SEA', 'St. Louis Cardinals': 'STL', 'Tampa Bay Rays': 'TB',
  'Texas Rangers': 'TEX', 'Toronto Blue Jays': 'TOR', 'Washington Nationals': 'WSH',
};

function normalizeTeamName(name) {
  const normalized = name?.replace(/\s+/g, ' ').trim();
  return TEAM_MAPPINGS[normalized] || normalized?.split(' ')?.pop()?.substring(0, 3).toUpperCase();
}

function normalizeSportKey(sport) {
  const mappings = {
    'NBA': 'basketball_nba', 'NFL': 'americanfootball_nfl',
    'NHL': 'icehockey_nhl', 'MLB': 'baseball_mlb',
    'UFC': 'mma_mixed_martial_arts', 'NCAAB': 'basketball_ncaab',
    'NCAAF': 'americanfootball_ncaaf',
  };
  if (sport?.includes('_')) return sport;
  return mappings[sport?.toUpperCase()] || sport;
}

// Get ESPN sport path from sport key
function getESPNPath(sport) {
  const paths = {
    'basketball_nba': 'basketball/nba',
    'americanfootball_nfl': 'football/nfl',
    'icehockey_nhl': 'hockey/nhl',
    'baseball_mlb': 'baseball/mlb',
  };
  return paths[sport] || sport.replace('_', '/');
}

// Fetch comprehensive team data
async function fetchTeamData(teamAbbr, sport) {
  const endpoints = ESPN_ENDPOINTS[sport];
  if (!endpoints) return null;
  
  try {
    // Get team list to find ID
    const teamsRes = await fetch(endpoints.teams);
    if (!teamsRes.ok) return null;
    const teamsData = await teamsRes.json();
    
    const teamEntry = teamsData.sports?.[0]?.leagues?.[0]?.teams?.find(
      t => t.team.abbreviation === teamAbbr
    );
    
    if (!teamEntry) return null;
    
    const team = teamEntry.team;
    const teamId = team.id;
    
    // Fetch schedule and stats in parallel
    const espnPath = getESPNPath(sport);
    const [scheduleRes, statsRes] = await Promise.all([
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${teamId}/schedule`),
      fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${teamId}?enable=stats`)
    ]);
    
    const scheduleData = scheduleRes.ok ? await scheduleRes.json() : { events: [] };
    const statsData = statsRes.ok ? await statsRes.json() : null;
    
    // Parse recent games
    const events = scheduleData.events || [];
    const recentGames = events
      .filter(e => e.competitions?.[0]?.status?.type?.completed)
      .slice(0, 10)
      .map(e => {
        const comp = e.competitions[0];
        const teamComp = comp.competitors?.find(c => c.team.abbreviation === teamAbbr);
        const opponentComp = comp.competitors?.find(c => c.team.abbreviation !== teamAbbr);
        const isHome = teamComp?.homeAway === 'home';
        
        return {
          date: e.date,
          opponent: opponentComp?.team?.displayName || 'Unknown',
          opponentAbbr: opponentComp?.team?.abbreviation || '',
          isHome,
          teamScore: parseInt(teamComp?.score) || 0,
          opponentScore: parseInt(opponentComp?.score) || 0,
          won: parseInt(teamComp?.score) > parseInt(opponentComp?.score),
          spread: null, // Would need historical odds data
        };
      });
    
    // Calculate streak
    let streak = 0, streakType = '';
    for (const game of recentGames) {
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
    const homeGames = recentGames.filter(g => g.isHome);
    const awayGames = recentGames.filter(g => !g.isHome);
    
    // Calculate rest days (days since last game)
    let restDays = null;
    if (recentGames.length > 0) {
      const lastGame = new Date(recentGames[0].date);
      const now = new Date();
      restDays = Math.floor((now - lastGame) / (1000 * 60 * 60 * 24));
    }
    
    // Extract stats from stats data
    let stats = null;
    if (statsData?.team?.statistics) {
      const statsArr = statsData.team.statistics;
      stats = {
        ppg: extractStat(statsArr, 'pointsPerGame', 'avgPointsFor'),
        papg: extractStat(statsArr, 'pointsAllowedPerGame', 'avgPointsAgainst'),
        fgPct: extractStat(statsArr, 'fieldGoalPct', 'fgPct'),
        threePtPct: extractStat(statsArr, 'threePointPct', 'threePtPct'),
      };
    }
    
    return {
      team: team.displayName,
      abbreviation: teamAbbr,
      record: team.record?.items?.[0]?.summary || '0-0',
      recentGames,
      streak: streak > 0 ? `${streakType}${streak}` : '-',
      wins: recentGames.filter(g => g.won).length,
      losses: recentGames.filter(g => !g.won).length,
      homeRecord: { wins: homeGames.filter(g => g.won).length, losses: homeGames.filter(g => !g.won).length },
      awayRecord: { wins: awayGames.filter(g => g.won).length, losses: awayGames.filter(g => !g.won).length },
      restDays,
      stats,
      logo: team.logo,
    };
  } catch (e) {
    console.error('Error fetching team data:', e);
    return null;
  }
}

function extractStat(stats, ...possibleNames) {
  for (const name of possibleNames) {
    const stat = stats.find(s => s.name === name || s.displayName === name);
    if (stat) return stat.displayValue || stat.value;
  }
  return null;
}

// Fetch H2H from Odds API
async function fetchH2HData(homeTeam, awayTeam, sport, apiKey) {
  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=90`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const scores = await response.json();
    
    const h2hGames = scores.filter(game => {
      const homeName = game.home_team?.toLowerCase() || '';
      const awayName = game.away_team?.toLowerCase() || '';
      const homeTarget = homeTeam?.toLowerCase() || '';
      const awayTarget = awayTeam?.toLowerCase() || '';
      
      const homeMatch = homeName === homeTarget || homeName.includes(homeTeam?.split(' ').pop()?.toLowerCase());
      const awayMatch = awayName === awayTarget || awayName.includes(awayTeam?.split(' ').pop()?.toLowerCase());
      const reverseHome = homeName === awayTarget || homeName.includes(awayTeam?.split(' ').pop()?.toLowerCase());
      const reverseAway = awayName === homeTarget || awayName.includes(homeTeam?.split(' ').pop()?.toLowerCase());
      
      return (homeMatch && awayMatch) || (reverseHome && reverseAway);
    });
    
    return h2hGames.map(game => ({
      date: game.commence_time,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      homeScore: game.scores?.find(s => s.name === game.home_team)?.score,
      awayScore: game.scores?.find(s => s.name === game.away_team)?.score,
      completed: game.completed,
    })).filter(g => g.completed && g.homeScore != null).slice(0, 10);
  } catch (e) {
    console.error('Error fetching H2H:', e);
    return null;
  }
}

// Fetch consensus odds for context
async function fetchConsensusOdds(sport, apiKey) {
  try {
    const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=spreads&oddsFormat=american`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json();
  } catch (e) {
    return null;
  }
}

// Calculate comprehensive trends
function calculateAdvancedTrends(homeData, awayData, h2hGames) {
  const trends = [];
  
  if (!homeData && !awayData) return trends;
  
  // Recent form trends
  if (homeData) {
    const homeWinPct = homeData.wins / (homeData.wins + homeData.losses) || 0;
    
    if (homeWinPct >= 0.7) {
      trends.push({
        type: 'HOME_FORM',
        label: '🔥 Home Team Elite Form',
        description: `${homeData.team} is ${homeData.wins}-${homeData.losses} in last 10 (${(homeWinPct*100).toFixed(0)}% win rate)`,
        confidence: homeWinPct >= 0.8 ? 'high' : 'medium',
        icon: '🔥'
      });
    } else if (homeWinPct <= 0.3) {
      trends.push({
        type: 'HOME_FORM',
        label: '⚠️ Home Team Cold',
        description: `${homeData.team} struggling at ${homeData.wins}-${homeData.losses} in last 10`,
        confidence: 'medium',
        icon: '⚠️'
      });
    }
    
    // Home court advantage trend
    const homeGames = homeData.homeRecord.wins + homeData.homeRecord.losses;
    if (homeGames >= 3) {
      const homeWinPct = homeData.homeRecord.wins / homeGames;
      if (homeWinPct >= 0.75) {
        trends.push({
          type: 'HOME_COURT',
          label: '🏠 Strong Home Court',
          description: `${homeData.homeRecord.wins}-${homeData.homeRecord.losses} at home recently`,
          confidence: 'high',
          icon: '🏠'
        });
      }
    }
    
    // Streak trend
    if (homeData.streak && homeData.streak.startsWith('W') && parseInt(homeData.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: '📈 Home Streaking',
        description: `${homeData.team} on ${homeData.streak} win streak`,
        confidence: 'high',
        icon: '📈'
      });
    } else if (homeData.streak && homeData.streak.startsWith('L') && parseInt(homeData.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: '📉 Home in Slump',
        description: `${homeData.team} on ${homeData.streak} losing streak`,
        confidence: 'medium',
        icon: '📉'
      });
    }
    
    // Rest advantage
    if (homeData.restDays != null && awayData?.restDays != null) {
      const restDiff = homeData.restDays - awayData.restDays;
      if (restDiff >= 2) {
        trends.push({
          type: 'REST',
          label: '💤 Home Rest Advantage',
          description: `${homeData.restDays} days rest vs ${awayData.restDays} for opponent`,
          confidence: 'medium',
          icon: '💤'
        });
      }
    }
  }
  
  // Away team trends
  if (awayData) {
    const awayWinPct = awayData.wins / (awayData.wins + awayData.losses) || 0;
    
    if (awayWinPct >= 0.7) {
      trends.push({
        type: 'AWAY_FORM',
        label: '🔥 Away Team Hot',
        description: `${awayData.team} is ${awayData.wins}-${awayData.losses} in last 10`,
        confidence: awayWinPct >= 0.8 ? 'high' : 'medium',
        icon: '🔥'
      });
    }
    
    // Road warrior trend
    const awayGames = awayData.awayRecord.wins + awayData.awayRecord.losses;
    if (awayGames >= 3) {
      const awayWinPct = awayData.awayRecord.wins / awayGames;
      if (awayWinPct >= 0.66) {
        trends.push({
          type: 'ROAD_WARRIOR',
          label: '✈️ Road Warriors',
          description: `${awayData.team} is ${awayData.awayRecord.wins}-${awayData.awayRecord.losses} on the road`,
          confidence: 'medium',
          icon: '✈️'
        });
      }
    }
    
    // Streak trend
    if (awayData.streak && awayData.streak.startsWith('W') && parseInt(awayData.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: '📈 Away Streaking',
        description: `${awayData.team} on ${awayData.streak} win streak`,
        confidence: 'high',
        icon: '📈'
      });
    }
    
    // Rest advantage for away team
    if (awayData.restDays != null && homeData?.restDays != null) {
      const restDiff = awayData.restDays - homeData.restDays;
      if (restDiff >= 2) {
        trends.push({
          type: 'REST',
          label: '💤 Away Rest Advantage',
          description: `${awayData.restDays} days rest vs ${homeData.restDays} for home team`,
          confidence: 'medium',
          icon: '💤'
        });
      }
    }
  }
  
  // H2H trends
  if (h2hGames && h2hGames.length >= 2) {
    const homeTeamName = homeData?.team || '';
    const homeWins = h2hGames.filter(g => {
      const isHome = g.homeTeam.includes(homeTeamName.split(' ').pop());
      return isHome ? parseInt(g.homeScore) > parseInt(g.awayScore) : parseInt(g.awayScore) > parseInt(g.homeScore);
    }).length;
    
    const homeAdvantage = homeWins / h2hGames.length;
    
    if (homeAdvantage >= 0.75) {
      trends.push({
        type: 'H2H',
        label: '🎯 H2H Dominance',
        description: `Home team has won ${homeWins} of last ${h2hGames.length} meetings`,
        confidence: 'high',
        icon: '🎯'
      });
    } else if (homeAdvantage <= 0.25) {
      trends.push({
        type: 'H2H',
        label: '🎯 H2H Underdog',
        description: `Home team has only won ${homeWins} of last ${h2hGames.length} meetings`,
        confidence: 'medium',
        icon: '🎯'
      });
    }
    
    // Close games trend
    const closeGames = h2hGames.filter(g => Math.abs(parseInt(g.homeScore) - parseInt(g.awayScore)) <= 5);
    if (closeGames.length >= h2hGames.length * 0.6) {
      trends.push({
        type: 'CLOSE_GAMES',
        label: '😰 Tight Contests',
        description: `${closeGames.length} of last ${h2hGames.length} games decided by 5 or fewer points`,
        confidence: 'medium',
        icon: '😰'
      });
    }
  }
  
  // Form differential
  if (homeData && awayData) {
    const homeWinPct = homeData.wins / (homeData.wins + homeData.losses) || 0;
    const awayWinPct = awayData.wins / (awayData.wins + awayData.losses) || 0;
    const diff = Math.abs(homeWinPct - awayWinPct);
    
    if (diff >= 0.4) {
      const betterTeam = homeWinPct > awayWinPct ? homeData.team : awayData.team;
      trends.push({
        type: 'FORM_GAP',
        label: '⚡ Form Mismatch',
        description: `${betterTeam} has significantly better recent form`,
        confidence: 'high',
        icon: '⚡'
      });
    }
  }
  
  return trends.sort((a, b) => (b.confidence === 'high' ? 1 : 0) - (a.confidence === 'high' ? 1 : 0));
}

export default async function handler(req, res) {
  const { gameId, sport = 'basketball_nba', homeTeam, awayTeam, commenceTime } = req.query;
  
  if (!gameId || !homeTeam || !awayTeam) {
    return res.status(400).json({ 
      error: 'Missing required params: gameId, homeTeam, awayTeam',
      accurate: false,
      dataSource: 'Error'
    });
  }
  
  const normalizedSport = normalizeSportKey(sport);
  const cacheKey = `research-${gameId}`;
  
  // Check cache
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache[cacheKey].data);
  }
  
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: 'ODDS_API_KEY not configured',
      accurate: false,
      dataSource: 'Error'
    });
  }
  
  try {
    const homeAbbr = normalizeTeamName(homeTeam);
    const awayAbbr = normalizeTeamName(awayTeam);
    
    // Fetch all data in parallel
    const [homeData, awayData, h2hGames] = await Promise.all([
      fetchTeamData(homeAbbr, normalizedSport),
      fetchTeamData(awayAbbr, normalizedSport),
      fetchH2HData(homeTeam, awayTeam, normalizedSport, apiKey),
    ]);
    
    // Calculate trends
    const trends = calculateAdvancedTrends(homeData, awayData, h2hGames);
    
    // Determine data quality
    const hasHomeData = homeData && homeData.recentGames?.length > 0;
    const hasAwayData = awayData && awayData.recentGames?.length > 0;
    const hasH2H = h2hGames && h2hGames.length > 0;
    
    const dataQuality = hasHomeData && hasAwayData ? 'full' : hasHomeData || hasAwayData ? 'partial' : 'minimal';
    const isAccurate = dataQuality !== 'minimal';
    
    // Game context
    const gameContext = {
      commenceTime: commenceTime || null,
      isLive: commenceTime ? new Date(commenceTime) < new Date() : false,
    };
    
    const result = {
      gameId,
      sport: normalizedSport,
      homeTeam,
      awayTeam,
      accurate: isAccurate,
      dataQuality,
      dataSource: isAccurate ? 'ESPN + Odds API' : 'Limited Data',
      timestamp: new Date().toISOString(),
      gameContext,
      teams: {
        home: homeData,
        away: awayData,
      },
      h2h: h2hGames || [],
      trends,
      meta: {
        trendCount: trends.length,
        highConfidenceTrends: trends.filter(t => t.confidence === 'high').length,
      }
    };
    
    // Cache result
    cache[cacheKey] = { data: result, ts: Date.now() };
    
    // Clean old cache entries (keep last 50)
    const keys = Object.keys(cache);
    if (keys.length > 50) {
      const oldest = keys.sort((a, b) => cache[a].ts - cache[b].ts)[0];
      delete cache[oldest];
    }
    
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);
  } catch (e) {
    console.error('Game research error:', e);
    return res.status(500).json({ 
      error: e.message,
      accurate: false,
      dataSource: 'Error',
      timestamp: new Date().toISOString(),
    });
  }
}
