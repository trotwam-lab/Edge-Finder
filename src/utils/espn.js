// utils/espn.js — ESPN API integration for game research
// ESPN has a public API that's free to use

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports';

// Map our sport keys to ESPN sport paths
const SPORT_PATHS = {
  'basketball_nba': 'basketball/nba',
  'basketball_ncaab': 'basketball/mens-college-basketball',
  'americanfootball_nfl': 'football/nfl',
  'americanfootball_ncaaf': 'football/college-football',
  'icehockey_nhl': 'hockey/nhl',
  'baseball_mlb': 'baseball/mlb',
  'basketball_wnba': 'basketball/wnba',
};

/**
 * Get team ID from ESPN by team name
 * This is tricky because team names vary (Lakers vs Los Angeles Lakers)
 */
async function getTeamId(teamName, sport = 'basketball_nba') {
  const sportPath = SPORT_PATHS[sport] || 'basketball/nba';
  
  try {
    // Fetch all teams for this sport
    const res = await fetch(`${ESPN_BASE}/${sportPath}/teams`);
    const data = await res.json();
    
    // Search for team by name (case insensitive, smart matching)
    const searchName = teamName.toLowerCase().trim();
    const searchWords = searchName.split(/\s+/); // Split "Brooklyn Nets" into ["brooklyn", "nets"]
    
    const team = data.sports[0].leagues[0].teams.find(t => {
      const displayName = t.team.displayName.toLowerCase();
      const shortName = t.team.shortDisplayName.toLowerCase();
      const abbreviation = t.team.abbreviation.toLowerCase();
      const nickname = t.team.name.toLowerCase();
      const location = t.team.location?.toLowerCase() || '';
      
      // Check exact match first
      if (abbreviation === searchName) return true;
      if (nickname === searchName) return true;
      if (displayName === searchName) return true;
      
      // Check if search contains team nickname ("Brooklyn Nets" includes "nets")
      if (searchName.includes(nickname)) return true;
      
      // Check if any search word matches nickname (for "LA Lakers", check if "lakers" matches)
      if (searchWords.some(word => word === nickname || word === abbreviation)) return true;
      
      // Check if display name contains all search words
      if (searchWords.every(word => displayName.includes(word))) return true;
      
      // Check if search contains location + nickname combination
      if (searchName.includes(location) && searchName.includes(nickname)) return true;
      
      return false;
    });
    
    return team ? team.team.id : null;
  } catch (error) {
    console.error('ESPN team lookup error:', error);
    return null;
  }
}

/**
 * Get team's recent games and results
 */
async function getTeamRecentForm(teamId, sport = 'basketball_nba', limit = 5) {
  const sportPath = SPORT_PATHS[sport] || 'basketball/nba';
  
  try {
    // Fetch team's schedule/results
    const res = await fetch(`${ESPN_BASE}/${sportPath}/teams/${teamId}/schedule`);
    const data = await res.json();
    
    // Get completed games (events with results)
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

/**
 * Get team season stats (PPG, allowed, etc.)
 */
async function getTeamStats(teamId, sport = 'basketball_nba') {
  const sportPath = SPORT_PATHS[sport] || 'basketball/nba';
  
  try {
    const res = await fetch(`${ESPN_BASE}/${sportPath}/teams/${teamId}`);
    const data = await res.json();
    
    // ESPN returns different stat structures per sport
    // For NBA, we can calculate from record
    const team = data.team;
    
    return {
      record: team.record?.items?.[0]?.summary || '0-0',
      homeRecord: team.record?.items?.find(r => r.type === 'home')?.summary || '0-0',
      awayRecord: team.record?.items?.find(r => r.type === 'road')?.summary || '0-0',
      // Note: ESPN doesn't provide PPG in the free API, we'd need to calculate from games
    };
  } catch (error) {
    console.error('ESPN team stats error:', error);
    return null;
  }
}

/**
 * Get head-to-head history between two teams
 */
async function getHeadToHead(teamId1, teamId2, sport = 'basketball_nba', limit = 5) {
  const sportPath = SPORT_PATHS[sport] || 'basketball/nba';
  
  try {
    // ESPN doesn't have a direct H2H endpoint, but we can get recent games between teams
    // by checking both teams' schedules and finding common opponents
    // This is a simplified version
    
    const [team1Schedule, team2Schedule] = await Promise.all([
      fetch(`${ESPN_BASE}/${sportPath}/teams/${teamId1}/schedule`).then(r => r.json()),
      fetch(`${ESPN_BASE}/${sportPath}/teams/${teamId2}/schedule`).then(r => r.json()),
    ]);
    
    // Find games where they played each other
    const team1Games = team1Schedule.events.filter(e => 
      e.competitions[0].competitors.some(c => c.team.id === teamId2)
    ).slice(0, limit);
    
    return team1Games.map(game => {
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

/**
 * Main function to fetch complete game research
 */
export async function fetchGameResearch(awayTeam, homeTeam, sport = 'basketball_nba') {
  try {
    // Get team IDs
    const [awayId, homeId] = await Promise.all([
      getTeamId(awayTeam, sport),
      getTeamId(homeTeam, sport),
    ]);
    
    if (!awayId || !homeId) {
      throw new Error('Could not find team IDs');
    }
    
    // Fetch all data in parallel
    const [
      awayRecent,
      homeRecent,
      awayStats,
      homeStats,
      h2h,
    ] = await Promise.all([
      getTeamRecentForm(awayId, sport, 5),
      getTeamRecentForm(homeId, sport, 5),
      getTeamStats(awayId, sport),
      getTeamStats(homeId, sport),
      getHeadToHead(awayId, homeId, sport, 5),
    ]);
    
    // Calculate averages
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
          games: awayRecent,
        },
        seasonStats: awayStats,
      },
      homeTeam: {
        name: homeTeam,
        recentForm: {
          last5: homeRecent.map(g => g.result),
          record: `${homeRecent.filter(g => g.result === 'W').length}-${homeRecent.filter(g => g.result === 'L').length}`,
          avgPoints: homeAvgPoints.toFixed(1),
          avgAllowed: homeAvgAllowed.toFixed(1),
          games: homeRecent,
        },
        seasonStats: homeStats,
      },
      headToHead: {
        games: h2h,
        count: h2h.length,
      },
    };
  } catch (error) {
    console.error('Game research fetch error:', error);
    throw error;
  }
}

// Export individual functions for flexibility
export {
  getTeamId,
  getTeamRecentForm,
  getTeamStats,
  getHeadToHead,
};
