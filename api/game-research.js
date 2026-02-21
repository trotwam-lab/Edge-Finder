// api/game-research.js — Hybrid: ESPN (historical) + Odds API (props/live odds)

const cache = {};
const TTL = 60 * 1000;

// ESPN team abbreviations
const ESPN_TEAMS = {
  'Atlanta Hawks': 1, 'Boston Celtics': 2, 'Brooklyn Nets': 17, 'Charlotte Hornets': 30,
  'Chicago Bulls': 4, 'Cleveland Cavaliers': 5, 'Dallas Mavericks': 6, 'Denver Nuggets': 7,
  'Detroit Pistons': 8, 'Golden State Warriors': 9, 'Houston Rockets': 10, 'Indiana Pacers': 11,
  'LA Clippers': 12, 'Los Angeles Clippers': 12, 'Los Angeles Lakers': 13, 'Memphis Grizzlies': 29,
  'Miami Heat': 14, 'Milwaukee Bucks': 15, 'Minnesota Timberwolves': 16, 'New Orleans Pelicans': 3,
  'New York Knicks': 18, 'Oklahoma City Thunder': 25, 'Orlando Magic': 19, 'Philadelphia 76ers': 20,
  'Phoenix Suns': 21, 'Portland Trail Blazers': 22, 'Sacramento Kings': 23, 'San Antonio Spurs': 24,
  'Toronto Raptors': 28, 'Utah Jazz': 26, 'Washington Wizards': 27,
};

function getESPNId(teamName) {
  return ESPN_TEAMS[teamName] || null;
}

// Source 1: ESPN API (historical data - last 10 games)
async function fetchFromESPN(teamName, teamId) {
  try {
    if (!teamId) {
      return { games: [], source: 'ESPN', count: 0, error: 'Team not found' };
    }
    
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const events = data.events || [];
    
    // Get completed games with scores
    const completedGames = events
      .filter(e => {
        const status = e.competitions?.[0]?.status;
        return status?.type?.completed === true;
      })
      .slice(0, 10)
      .map(e => {
        const comp = e.competitions[0];
        const homeTeam = comp.competitors[0];
        const awayTeam = comp.competitors[1];
        
        // Determine if our team is home or away
        const isHome = homeTeam.team.displayName === teamName || 
                      homeTeam.team.name === teamName;
        const teamComp = isHome ? homeTeam : awayTeam;
        const oppComp = isHome ? awayTeam : homeTeam;
        
        const teamScore = parseInt(teamComp.score?.displayValue || teamComp.score?.value || 0);
        const oppScore = parseInt(oppComp.score?.displayValue || oppComp.score?.value || 0);
        
        return {
          date: e.date,
          opponent: oppComp.team.displayName,
          opponentAbbr: oppComp.team.abbreviation,
          isHome,
          teamScore,
          opponentScore: oppScore,
          won: teamScore > oppScore,
          source: 'ESPN',
        };
      })
      .filter(g => g.teamScore > 0 || g.opponentScore > 0); // Valid games only
    
    return {
      games: completedGames,
      source: 'ESPN',
      count: completedGames.length,
      totalAvailable: events.length,
    };
  } catch (error) {
    console.error('ESPN error:', error.message);
    return { games: [], source: 'ESPN', count: 0, error: error.message };
  }
}

// Source 2: Odds API (recent games within 3 days)
async function fetchFromOddsAPI(teamName, sport, apiKey) {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=3`,
      { signal: AbortSignal.timeout(10000) }
    );
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const games = await res.json();
    
    const teamGames = games
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
          opponentAbbr: isHome ? g.away_team?.split(' ').pop() : g.home_team?.split(' ').pop(),
          isHome,
          teamScore,
          opponentScore: oppScore,
          won: teamScore > oppScore,
          source: 'OddsAPI',
        };
      })
      .filter(g => g.teamScore > 0 || g.opponentScore > 0);
    
    return { games: teamGames, source: 'OddsAPI', count: teamGames.length };
  } catch (error) {
    console.error('Odds API error:', error.message);
    return { games: [], source: 'OddsAPI', count: 0, error: error.message };
  }
}

// Fetch H2H from Odds API
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

// Fetch player props from Odds API
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

// Calculate stats
function calculateStats(games) {
  if (!games || games.length === 0) return null;
  
  const wins = games.filter(g => g.won).length;
  const losses = games.filter(g => !g.won).length;
  
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
    homeRecord: { 
      wins: homeGames.filter(g => g.won).length, 
      losses: homeGames.filter(g => !g.won).length 
    },
    awayRecord: { 
      wins: awayGames.filter(g => g.won).length, 
      losses: awayGames.filter(g => !g.won).length 
    },
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
    // Get ESPN team IDs
    const homeESPNId = getESPNId(homeTeam);
    const awayESPNId = getESPNId(awayTeam);
    
    // Fetch from both sources in parallel
    const [espnHome, espnAway, oddsHome, oddsAway, h2hGames, playerProps] = await Promise.all([
      fetchFromESPN(homeTeam, homeESPNId),
      fetchFromESPN(awayTeam, awayESPNId),
      fetchFromOddsAPI(homeTeam, sport, apiKey),
      fetchFromOddsAPI(awayTeam, sport, apiKey),
      fetchH2H(homeTeam, awayTeam, sport, apiKey),
      fetchPlayerProps(gameId, sport, apiKey),
    ]);
    
    // Use ESPN as primary (more historical data), Odds API as supplement
    const homeGames = espnHome.count > 0 ? espnHome.games : oddsHome.games;
    const awayGames = espnAway.count > 0 ? espnAway.games : oddsAway.games;
    
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
      dataSource: espnHome.count > 0 ? 'ESPN + Odds API' : 'Odds API',
      dataWindow: espnHome.count > 0 ? `Last ${espnHome.count} games` : 'Last 3 days',
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
        espnGames: espnHome.count + espnAway.count,
        oddsGames: oddsHome.count + oddsAway.count,
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
