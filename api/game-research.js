// api/game-research.js — Working version with Odds API historical scores
// Uses scores endpoint with completed games (daysFrom 1-3)

const cache = {};
const TTL = 60 * 1000;

// Team abbreviations
const TEAM_ABBRS = {
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC', 'Los Angeles Lakers': 'LAL',
  'Memphis Grizzlies': 'MEM', 'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL',
  'Minnesota Timberwolves': 'MIN', 'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL', 'Philadelphia 76ers': 'PHI',
  'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR', 'Sacramento Kings': 'SAC',
  'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR', 'Utah Jazz': 'UTA',
  'Washington Wizards': 'WSH',
};

function getTeamAbbr(name) {
  return TEAM_ABBRS[name] || name.split(' ').pop().substring(0, 3).toUpperCase();
}

// Fetch completed games from Odds API (daysFrom: 1-3 looks back)
async function fetchRecentGames(teamName, sport, apiKey) {
  try {
    // Try max range first
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=3`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const games = await res.json();
    
    // Filter for this team and completed games
    return games
      .filter(g => 
        g.completed === true && 
        (g.home_team.includes(teamName.split(' ').pop()) || 
         g.away_team.includes(teamName.split(' ').pop()))
      )
      .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
      .slice(0, 10)
      .map(g => {
        const isHome = g.home_team.includes(teamName.split(' ').pop());
        const teamScore = isHome 
          ? parseInt(g.scores?.[0]?.score || 0)
          : parseInt(g.scores?.[1]?.score || 0);
        const oppScore = isHome
          ? parseInt(g.scores?.[1]?.score || 0)
          : parseInt(g.scores?.[0]?.score || 0);
        
        return {
          date: g.commence_time,
          opponent: isHome ? g.away_team : g.home_team,
          opponentAbbr: getTeamAbbr(isHome ? g.away_team : g.home_team),
          isHome,
          teamScore,
          opponentScore: oppScore,
          won: teamScore > oppScore,
        };
      });
      
  } catch (e) {
    console.error(`Error fetching ${teamName} games:`, e.message);
    return [];
  }
}

// Fetch H2H games between two teams
async function fetchH2H(homeTeam, awayTeam, sport, apiKey) {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=3`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) return [];
    
    const games = await res.json();
    
    return games
      .filter(g => {
        if (!g.completed) return false;
        const homeMatch = g.home_team.includes(homeTeam.split(' ').pop()) || 
                         g.home_team.includes(awayTeam.split(' ').pop());
        const awayMatch = g.away_team.includes(homeTeam.split(' ').pop()) || 
                         g.away_team.includes(awayTeam.split(' ').pop());
        return homeMatch && awayMatch;
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
  } catch (e) {
    return [];
  }
}

// Fetch player props
async function fetchPlayerProps(eventId, sport, apiKey) {
  if (!eventId) return [];
  
  const markets = ['player_points', 'player_rebounds', 'player_assists', 'player_threes'];
  
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds?apiKey=${apiKey}&regions=us&markets=${markets.join(',')}&oddsFormat=american`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data.bookmakers) return [];
    
    const propsMap = new Map();
    
    data.bookmakers.forEach(book => {
      book.markets?.forEach(market => {
        market.outcomes?.forEach(outcome => {
          const key = `${outcome.description}-${market.key}-${outcome.name}`;
          const existing = propsMap.get(key);
          
          if (!existing || outcome.price > existing.price) {
            propsMap.set(key, {
              player: outcome.description,
              market: market.key,
              line: outcome.point,
              outcome: outcome.name,
              price: outcome.price,
              book: book.title,
            });
          }
        });
      });
    });
    
    const grouped = {};
    propsMap.forEach(prop => {
      const key = `${prop.player}-${prop.market}`;
      if (!grouped[key]) {
        grouped[key] = {
          player: prop.player,
          market: prop.market,
          line: prop.line,
          over: null,
          under: null,
        };
      }
      if (prop.outcome === 'Over') {
        grouped[key].over = { price: prop.price, book: prop.book };
      } else {
        grouped[key].under = { price: prop.price, book: prop.book };
      }
    });
    
    return Object.values(grouped).slice(0, 20);
  } catch (e) {
    return [];
  }
}

// Calculate stats from games
function calculateStats(games) {
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
  
  const homeGames = games.filter(g => g.isHome);
  const awayGames = games.filter(g => !g.isHome);
  
  return {
    wins,
    losses,
    streak: streak > 0 ? `${streakType}${streak}` : '-',
    homeRecord: { wins: homeGames.filter(g => g.won).length, losses: homeGames.filter(g => !g.won).length },
    awayRecord: { wins: awayGames.filter(g => g.won).length, losses: awayGames.filter(g => !g.won).length },
    recentGames: games.slice(0, 5),
  };
}

// Calculate trends
function calculateTrends(homeStats, awayStats, h2hGames) {
  const trends = [];
  
  if (homeStats) {
    const winPct = homeStats.wins / (homeStats.wins + homeStats.losses);
    if (winPct >= 0.6) {
      trends.push({
        type: 'HOME_FORM',
        label: winPct >= 0.7 ? '🔥 Home Team Hot' : 'Home Team Strong',
        description: `${homeStats.wins}-${homeStats.losses} in last ${homeStats.wins + homeStats.losses}`,
        confidence: winPct >= 0.7 ? 'high' : 'medium',
        icon: '🔥',
      });
    }
    if (homeStats.streak.startsWith('W') && parseInt(homeStats.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: '📈 Home Streaking',
        description: `On ${homeStats.streak} win streak`,
        confidence: 'high',
        icon: '📈',
      });
    }
  }
  
  if (awayStats) {
    const winPct = awayStats.wins / (awayStats.wins + awayStats.losses);
    if (winPct >= 0.6) {
      trends.push({
        type: 'AWAY_FORM',
        label: winPct >= 0.7 ? '🔥 Away Team Hot' : 'Away Team Strong',
        description: `${awayStats.wins}-${awayStats.losses} in last ${awayStats.wins + awayStats.losses}`,
        confidence: winPct >= 0.7 ? 'high' : 'medium',
        icon: '🔥',
      });
    }
  }
  
  if (h2hGames && h2hGames.length > 0) {
    const homeWins = h2hGames.filter(g => parseInt(g.homeScore) > parseInt(g.awayScore)).length;
    trends.push({
      type: 'H2H',
      label: '🎯 Recent Matchup',
      description: `${h2hGames.length} recent meeting(s)`,
      confidence: 'medium',
      icon: '🎯',
    });
  }
  
  return trends;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { gameId, sport = 'basketball_nba', homeTeam, awayTeam } = req.query;
  
  if (!homeTeam || !awayTeam) {
    return res.status(400).json({ error: 'Missing team names' });
  }
  
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }
  
  const cacheKey = `${homeTeam}-${awayTeam}-${Math.floor(Date.now() / 60000)}`;
  
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[cacheKey].data);
  }
  
  try {
    // Fetch all data
    const [homeGames, awayGames, h2hGames, playerProps] = await Promise.all([
      fetchRecentGames(homeTeam, sport, apiKey),
      fetchRecentGames(awayTeam, sport, apiKey),
      fetchH2H(homeTeam, awayTeam, sport, apiKey),
      fetchPlayerProps(gameId, sport, apiKey),
    ]);
    
    // Calculate stats
    const homeStats = calculateStats(homeGames);
    const awayStats = calculateStats(awayGames);
    const trends = calculateTrends(homeStats, awayStats, h2hGames);
    
    const result = {
      gameId: gameId || null,
      sport,
      homeTeam,
      awayTeam,
      accurate: homeGames.length > 0 || awayGames.length > 0,
      dataSource: 'The Odds API',
      dataWindow: 'Last 3 days',
      timestamp: new Date().toISOString(),
      teams: {
        home: homeStats,
        away: awayStats,
      },
      h2h: h2hGames,
      playerProps: playerProps || [],
      hasPlayerProps: playerProps && playerProps.length > 0,
      trends,
      meta: {
        homeGamesFound: homeGames.length,
        awayGamesFound: awayGames.length,
        h2hGamesFound: h2hGames.length,
        trendCount: trends.length,
      },
    };
    
    cache[cacheKey] = { data: result, ts: Date.now() };
    
    res.setHeader('X-Cache', 'MISS');
    return res.json(result);
  } catch (error) {
    console.error('Game research error:', error);
    return res.status(500).json({ 
      error: error.message,
      accurate: false,
    });
  }
}
