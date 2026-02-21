// api/game-research.js — Simple Odds API approach for game research
// Uses The Odds API for recent scores and props

const cache = {};
const TTL = 60 * 1000; // 1 minute cache

// Team name mappings
const TEAM_ABBRS = {
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
};

function getTeamAbbr(name) {
  return TEAM_ABBRS[name] || name.split(' ').pop().substring(0, 3).toUpperCase();
}

// Fetch recent scores from Odds API
async function fetchRecentScores(teamName, sport, apiKey) {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=30`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const games = await res.json();
    
    return games
      .filter(g => 
        g.completed && 
        (g.home_team.includes(teamName.split(' ').pop()) || 
         g.away_team.includes(teamName.split(' ').pop()))
      )
      .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
      .slice(0, 10)
      .map(g => {
        const isHome = g.home_team.includes(teamName.split(' ').pop());
        const teamScore = isHome 
          ? parseInt(g.scores?.[0]?.score)
          : parseInt(g.scores?.[1]?.score);
        const oppScore = isHome
          ? parseInt(g.scores?.[1]?.score)
          : parseInt(g.scores?.[0]?.score);
        
        return {
          date: g.commence_time,
          opponent: isHome ? g.away_team : g.home_team,
          opponentAbbr: getTeamAbbr(isHome ? g.away_team : g.home_team),
          isHome,
          teamScore: isNaN(teamScore) ? 0 : teamScore,
          opponentScore: isNaN(oppScore) ? 0 : oppScore,
          won: teamScore > oppScore,
        };
      })
      .filter(g => g.teamScore > 0 || g.opponentScore > 0);
      
  } catch (e) {
    console.error('Scores fetch error:', e);
    return [];
  }
}

// Fetch H2H games
async function fetchH2H(homeTeam, awayTeam, sport, apiKey) {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=90`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) return [];
    
    const games = await res.json();
    
    return games
      .filter(g => {
        const homeMatch = g.home_team.includes(homeTeam.split(' ').pop()) || 
                         g.home_team.includes(awayTeam.split(' ').pop());
        const awayMatch = g.away_team.includes(homeTeam.split(' ').pop()) || 
                         g.away_team.includes(awayTeam.split(' ').pop());
        return g.completed && homeMatch && awayMatch;
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
  if (!eventId || eventId === 'undefined') return [];
  
  const markets = ['player_points', 'player_rebounds', 'player_assists', 'player_threes'];
  
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events/${eventId}/odds?apiKey=${apiKey}&regions=us&markets=${markets.join(',')}&oddsFormat=american`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) return [];
    
    const data = await res.json();
    if (!data.bookmakers) return [];
    
    // Aggregate best lines
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
    
    // Group by player/market
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

// Calculate trends
function calculateTrends(homeGames, awayGames) {
  const trends = [];
  
  if (homeGames.length > 0) {
    const wins = homeGames.filter(g => g.won).length;
    const losses = homeGames.length - wins;
    const winPct = wins / homeGames.length;
    
    if (winPct >= 0.6) {
      trends.push({
        type: 'HOME_FORM',
        label: winPct >= 0.7 ? '🔥 Home Team Hot' : 'Home Team Strong',
        description: `${wins}-${losses} in last ${homeGames.length}`,
        confidence: winPct >= 0.7 ? 'high' : 'medium',
        icon: '🔥',
      });
    }
    
    // Check streak
    let streak = 0, streakType = '';
    for (const g of homeGames) {
      if (streakType === '') {
        streakType = g.won ? 'W' : 'L';
        streak = 1;
      } else if ((streakType === 'W' && g.won) || (streakType === 'L' && !g.won)) {
        streak++;
      } else {
        break;
      }
    }
    
    if (streak >= 3) {
      trends.push({
        type: 'STREAK',
        label: `${streakType === 'W' ? '📈' : '📉'} Home on ${streakType}${streak} Streak`,
        description: `${streakType === 'W' ? 'Winning' : 'Losing'} ${streak} in a row`,
        confidence: 'high',
        icon: streakType === 'W' ? '📈' : '📉',
      });
    }
  }
  
  if (awayGames.length > 0) {
    const wins = awayGames.filter(g => g.won).length;
    const losses = awayGames.length - wins;
    const winPct = wins / awayGames.length;
    
    if (winPct >= 0.6) {
      trends.push({
        type: 'AWAY_FORM',
        label: winPct >= 0.7 ? '🔥 Away Team Hot' : 'Away Team Strong',
        description: `${wins}-${losses} in last ${awayGames.length}`,
        confidence: winPct >= 0.7 ? 'high' : 'medium',
        icon: '🔥',
      });
    }
  }
  
  return trends;
}

export default async function handler(req, res) {
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
    // Fetch all data in parallel
    const [homeGames, awayGames, h2hGames, playerProps] = await Promise.all([
      fetchRecentScores(homeTeam, sport, apiKey),
      fetchRecentScores(awayTeam, sport, apiKey),
      fetchH2H(homeTeam, awayTeam, sport, apiKey),
      fetchPlayerProps(gameId, sport, apiKey),
    ]);
    
    // Calculate stats
    const homeStats = homeGames.length > 0 ? {
      wins: homeGames.filter(g => g.won).length,
      losses: homeGames.filter(g => !g.won).length,
      recentGames: homeGames.slice(0, 5),
    } : null;
    
    const awayStats = awayGames.length > 0 ? {
      wins: awayGames.filter(g => g.won).length,
      losses: awayGames.filter(g => !g.won).length,
      recentGames: awayGames.slice(0, 5),
    } : null;
    
    const trends = calculateTrends(homeGames, awayGames);
    
    const result = {
      gameId: gameId || 'unknown',
      sport,
      homeTeam,
      awayTeam,
      accurate: homeGames.length > 0 || awayGames.length > 0,
      dataSource: 'The Odds API',
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
