// api/game-research.js — Uses The Odds API only (reliable, authenticated)
const ODDS_API_KEY = process.env.ODDS_API_KEY;

const cache = {};
const TTL = 10 * 60 * 1000; // 10 minutes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { homeTeam, awayTeam } = req.query;
  
  if (!homeTeam || !awayTeam) {
    return res.status(400).json({ error: 'Missing teams' });
  }
  
  const cacheKey = `${awayTeam}-${homeTeam}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data);
  }
  
  try {
    // Use Odds API scores endpoint (you already have this)
    const scoresRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/basketball_nba/scores/?daysFrom=14&apiKey=${ODDS_API_KEY}`
    );
    
    if (!scoresRes.ok) throw new Error('Odds API failed');
    
    const games = await scoresRes.json();
    
    // Normalize team names for matching
    const normalize = (name) => name.toLowerCase().replace(/\s+/g, ' ').trim();
    const searchAway = normalize(awayTeam);
    const searchHome = normalize(homeTeam);
    
    console.log(`[OddsAPI] Searching for: ${searchAway} vs ${searchHome}`);
    console.log(`[OddsAPI] Total games: ${games.length}, completed: ${games.filter(g => g.completed).length}`);
    
    // Find games for each team
    const awayGames = games.filter(g => {
      if (!g.completed) return false;
      const home = normalize(g.home_team || '');
      const away = normalize(g.away_team || '');
      return home.includes(searchAway) || away.includes(searchAway) || 
             searchAway.includes(home.split(' ').pop()) || searchAway.includes(away.split(' ').pop());
    }).sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time)).slice(0, 5);
    
    const homeGames = games.filter(g => 
      g.completed && (
        g.home_team?.toLowerCase().includes(homeTeam.toLowerCase()) ||
        g.away_team?.toLowerCase().includes(homeTeam.toLowerCase())
      )
    ).sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time)).slice(0, 5);
    
    if (awayGames.length === 0 || homeGames.length === 0) {
      throw new Error('No recent games found');
    }
    
    const formatGames = (teamGames, teamName) => {
      return teamGames.map(g => {
        const isHome = g.home_team?.toLowerCase().includes(teamName.toLowerCase());
        const teamScore = isHome ? parseInt(g.scores?.[0]) : parseInt(g.scores?.[1]);
        const oppScore = isHome ? parseInt(g.scores?.[1]) : parseInt(g.scores?.[0]);
        return {
          result: teamScore > oppScore ? 'W' : 'L',
          teamScore,
          oppScore,
        };
      });
    };
    
    const awayForm = formatGames(awayGames, awayTeam);
    const homeForm = formatGames(homeGames, homeTeam);
    
    const awayWins = awayForm.filter(g => g.result === 'W').length;
    const homeWins = homeForm.filter(g => g.result === 'W').length;
    
    const response = {
      accurate: true,
      source: 'OddsAPI',
      confidence: 'high',
      awayTeam: {
        name: awayTeam,
        recentForm: {
          last5: awayForm.map(g => g.result),
          record: `${awayWins}-${awayForm.length - awayWins}`,
          avgPoints: (awayForm.reduce((s, g) => s + g.teamScore, 0) / awayForm.length).toFixed(1),
          avgAllowed: (awayForm.reduce((s, g) => s + g.oppScore, 0) / awayForm.length).toFixed(1),
        },
      },
      homeTeam: {
        name: homeTeam,
        recentForm: {
          last5: homeForm.map(g => g.result),
          record: `${homeWins}-${homeForm.length - homeWins}`,
          avgPoints: (homeForm.reduce((s, g) => s + g.teamScore, 0) / homeForm.length).toFixed(1),
          avgAllowed: (homeForm.reduce((s, g) => s + g.oppScore, 0) / homeForm.length).toFixed(1),
        },
      },
      keyTrends: [
        `${awayTeam}: ${awayWins}-${awayForm.length - awayWins} in last ${awayForm.length}`,
        `${homeTeam}: ${homeWins}-${homeForm.length - homeWins} in last ${homeForm.length}`,
      ],
    };
    
    cache[cacheKey] = { data: response, ts: Date.now() };
    return res.json(response);
    
  } catch (error) {
    console.error('Research error:', error);
    return res.json({
      accurate: false,
      message: 'Live data unavailable',
      error: error.message,
    });
  }
}
