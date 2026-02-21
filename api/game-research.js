// api/game-research.js — Fetches detailed research for specific games
// Uses ESPN API for accurate, real-time data
// NOTE: ESPN functions inlined here to avoid Vercel path issues

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

const SPORT_PATHS = {
  'basketball_nba': 'basketball/nba',
  'basketball_ncaab': 'basketball/mens-college-basketball',
  'americanfootball_nfl': 'football/nfl',
  'americanfootball_ncaaf': 'football/college-football',
  'icehockey_nhl': 'hockey/nhl',
  'baseball_mlb': 'baseball/mlb',
  'basketball_wnba': 'basketball/wnba',
};

const cache = {};
const TTL = 5 * 60 * 1000; // 5 minutes

// Clear cache on deploy
Object.keys(cache).forEach(key => delete cache[key]);

async function getTeamId(teamName, sport = 'basketball_nba') {
  const sportPath = SPORT_PATHS[sport] || 'basketball/nba';
  
  try {
    const res = await fetch(`${ESPN_BASE}/${sportPath}/teams`);
    const data = await res.json();
    
    const searchName = teamName.toLowerCase().trim();
    const searchWords = searchName.split(/\s+/);
    
    const team = data.sports[0].leagues[0].teams.find(t => {
      const displayName = t.team.displayName.toLowerCase();
      const shortName = t.team.shortDisplayName.toLowerCase();
      const abbreviation = t.team.abbreviation.toLowerCase();
      const nickname = t.team.name.toLowerCase();
      const location = t.team.location?.toLowerCase() || '';
      
      if (abbreviation === searchName) return true;
      if (nickname === searchName) return true;
      if (displayName === searchName) return true;
      if (searchName.includes(nickname)) return true;
      if (searchWords.some(word => word === nickname || word === abbreviation)) return true;
      if (searchWords.every(word => displayName.includes(word))) return true;
      if (searchName.includes(location) && searchName.includes(nickname)) return true;
      
      return false;
    });
    
    return team ? team.team.id : null;
  } catch (error) {
    console.error('ESPN team lookup error:', error);
    return null;
  }
}

async function getTeamRecentForm(teamId, sport = 'basketball_nba', limit = 5) {
  const sportPath = SPORT_PATHS[sport] || 'basketball/nba';
  
  try {
    const res = await fetch(`${ESPN_BASE}/${sportPath}/teams/${teamId}/schedule`);
    const data = await res.json();
    
    const completedGames = data.events
      .filter(e => e.competitions[0].status.type.completed)
      .slice(0, limit);
    
    return completedGames.map(game => {
      const competition = game.competitions[0];
      const team = competition.competitors.find(c => c.team.id === teamId);
      const opponent = competition.competitors.find(c => c.team.id !== teamId);
      
      const teamScore = parseInt(team.score);
      const oppScore = parseInt(opponent.score);
      
      return {
        date: game.date,
        opponent: opponent.team.shortDisplayName,
        result: teamScore > oppScore ? 'W' : 'L',
        score: `${teamScore}-${oppScore}`,
        homeAway: team.homeAway,
        teamScore,
        oppScore,
      };
    });
  } catch (error) {
    console.error('ESPN recent form error:', error);
    return [];
  }
}

async function getHeadToHistory(teamId1, teamId2, sport = 'basketball_nba', limit = 5) {
  const sportPath = SPORT_PATHS[sport] || 'basketball/nba';
  
  try {
    const res = await fetch(`${ESPN_BASE}/${sportPath}/teams/${teamId1}/schedule`);
    const data = await res.json();
    
    const h2hGames = data.events.filter(e => 
      e.competitions[0].competitors.some(c => c.team.id === teamId2)
    ).slice(0, limit);
    
    return h2hGames.map(game => {
      const competition = game.competitions[0];
      const team1 = competition.competitors.find(c => c.team.id === teamId1);
      const team2 = competition.competitors.find(c => c.team.id === teamId2);
      
      return {
        date: game.date,
        winner: parseInt(team1.score) > parseInt(team2.score) ? team1.team.shortDisplayName : team2.team.shortDisplayName,
        score: `${team1.score}-${team2.score}`,
        completed: competition.status.type.completed,
      };
    });
  } catch (error) {
    console.error('ESPN H2H error:', error);
    return [];
  }
}

async function fetchResearch(awayTeam, homeTeam, sport = 'basketball_nba') {
  const [awayId, homeId] = await Promise.all([
    getTeamId(awayTeam, sport),
    getTeamId(homeTeam, sport),
  ]);
  
  if (!awayId || !homeId) {
    throw new Error(`Could not find team IDs: away=${awayId}, home=${homeId}`);
  }
  
  const [awayRecent, homeRecent, h2h] = await Promise.all([
    getTeamRecentForm(awayId, sport, 5),
    getTeamRecentForm(homeId, sport, 5),
    getHeadToHistory(awayId, homeId, sport, 5),
  ]);
  
  const awayAvgPoints = awayRecent.reduce((sum, g) => sum + g.teamScore, 0) / awayRecent.length || 0;
  const awayAvgAllowed = awayRecent.reduce((sum, g) => sum + g.oppScore, 0) / awayRecent.length || 0;
  const homeAvgPoints = homeRecent.reduce((sum, g) => sum + g.teamScore, 0) / homeRecent.length || 0;
  const homeAvgAllowed = homeRecent.reduce((sum, g) => sum + g.oppScore, 0) / homeRecent.length || 0;
  
  return {
    lastUpdated: new Date().toISOString(),
    source: 'ESPN',
    awayTeam: {
      name: awayTeam,
      recentForm: {
        last5: awayRecent.map(g => g.result),
        record: `${awayRecent.filter(g => g.result === 'W').length}-${awayRecent.filter(g => g.result === 'L').length}`,
        avgPoints: awayAvgPoints.toFixed(1),
        avgAllowed: awayAvgAllowed.toFixed(1),
      },
    },
    homeTeam: {
      name: homeTeam,
      recentForm: {
        last5: homeRecent.map(g => g.result),
        record: `${homeRecent.filter(g => g.result === 'W').length}-${homeRecent.filter(g => g.result === 'L').length}`,
        avgPoints: homeAvgPoints.toFixed(1),
        avgAllowed: homeAvgAllowed.toFixed(1),
      },
    },
    headToHead: {
      games: h2h,
      count: h2h.length,
    },
  };
}

// Main handler
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { homeTeam, awayTeam, sport } = req.query;
  
  if (!homeTeam || !awayTeam) {
    return res.status(400).json({ error: 'Missing team names' });
  }
  
  const cacheKey = `${awayTeam}-${homeTeam}-${sport || 'nba'}`;
  
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data);
  }
  
  try {
    const research = await fetchResearch(awayTeam, homeTeam, sport);
    
    const formatted = {
      lastUpdated: research.lastUpdated,
      source: research.source,
      awayTeam: {
        name: research.awayTeam.name,
        recentForm: research.awayTeam.recentForm,
        ats: { overall: 'N/A', home: 'N/A', away: 'N/A', last5: research.awayTeam.recentForm.record },
      },
      homeTeam: {
        name: research.homeTeam.name,
        recentForm: research.homeTeam.recentForm,
        ats: { overall: 'N/A', home: 'N/A', away: 'N/A', last5: research.homeTeam.recentForm.record },
      },
      headToHead: {
        thisSeason: research.headToHead.games
          .filter(g => g.completed && new Date(g.date).getFullYear() === new Date().getFullYear())
          .map(g => ({ date: g.date, winner: g.winner, score: g.score, spread: 'N/A' })),
        lastMeetings: research.headToHead.games
          .filter(g => g.completed)
          .slice(0, 5)
          .map(g => ({ date: g.date, winner: g.winner, score: g.score })),
        overall: `${research.headToHead.count} games`,
      },
      keyTrends: [
        `${research.awayTeam.name}: ${research.awayTeam.recentForm.record} in last 5`,
        `${research.homeTeam.name}: ${research.homeTeam.recentForm.record} in last 5`,
        `${research.awayTeam.name} averaging ${research.awayTeam.recentForm.avgPoints} PPG`,
        `${research.homeTeam.name} averaging ${research.homeTeam.recentForm.avgPoints} PPG`,
      ],
    };
    
    cache[cacheKey] = { data: formatted, ts: Date.now() };
    return res.json(formatted);
    
  } catch (error) {
    console.error('Research error:', error.message);
    // Return fallback
    return res.json({
      lastUpdated: new Date().toISOString(),
      source: 'FALLBACK',
      error: error.message,
      awayTeam: {
        name: awayTeam,
        recentForm: { last5: ['?', '?', '?', '?', '?'], record: 'N/A', avgPoints: '0', avgAllowed: '0' },
        ats: { overall: 'N/A', home: 'N/A', away: 'N/A', last5: 'N/A' },
      },
      homeTeam: {
        name: homeTeam,
        recentForm: { last5: ['?', '?', '?', '?', '?'], record: 'N/A', avgPoints: '0', avgAllowed: '0' },
        ats: { overall: 'N/A', home: 'N/A', away: 'N/A', last5: 'N/A' },
      },
      headToHead: { thisSeason: [], lastMeetings: [], overall: 'No data' },
      keyTrends: ['Data temporarily unavailable: ' + error.message],
    });
  }
}
