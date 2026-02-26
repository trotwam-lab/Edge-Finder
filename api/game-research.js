// api/game-research.js — Hybrid: ESPN (historical) + Odds API (props/live odds)
// Now includes ATS (Against The Spread) and SU (Straight Up) trend calculations

const cache = {};
const TTL = 60 * 1000;

// ESPN team abbreviations — NBA
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

// ESPN sport paths for multi-sport support
const ESPN_SPORT_PATHS = {
  'basketball_nba': 'basketball/nba',
  'americanfootball_nfl': 'football/nfl',
  'icehockey_nhl': 'hockey/nhl',
  'baseball_mlb': 'baseball/mlb',
  'basketball_ncaab': 'basketball/mens-college-basketball',
  'americanfootball_ncaaf': 'football/college-football',
};

function getESPNId(teamName) {
  return ESPN_TEAMS[teamName] || null;
}

// Source 1: ESPN API (historical data — last 10 games with ATS data)
async function fetchFromESPN(teamName, teamId, sport = 'basketball_nba') {
  try {
    if (!teamId) {
      return { games: [], source: 'ESPN', count: 0, error: 'Team not found' };
    }

    const sportPath = ESPN_SPORT_PATHS[sport] || 'basketball/nba';

    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${sportPath}/teams/${teamId}/schedule`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const events = data.events || [];

    // Get completed games with scores (last 30 days only)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const completedGames = events
      .filter(e => {
        const status = e.competitions?.[0]?.status;
        const gameDate = new Date(e.date);
        return status?.type?.completed === true && gameDate >= thirtyDaysAgo;
      })
      .slice(0, 10)
      .map(e => {
        const comp = e.competitions[0];
        const homeComp = comp.competitors[0];
        const awayComp = comp.competitors[1];

        const isHome = homeComp.team.displayName === teamName ||
                      homeComp.team.name === teamName;
        const teamComp = isHome ? homeComp : awayComp;
        const oppComp = isHome ? awayComp : homeComp;

        const teamScore = parseInt(teamComp.score?.displayValue || teamComp.score?.value || 0);
        const oppScore = parseInt(oppComp.score?.displayValue || oppComp.score?.value || 0);

        // Try to extract spread from odds if available
        let spread = null;
        const odds = comp.odds?.[0];
        if (odds) {
          // ESPN odds.spread is the home team spread
          const espnSpread = parseFloat(odds.spread);
          if (!isNaN(espnSpread)) {
            spread = isHome ? espnSpread : -espnSpread;
          }
        }

        // Try to extract total (over/under)
        let overUnder = null;
        if (odds?.overUnder) {
          overUnder = parseFloat(odds.overUnder);
        }

        return {
          date: e.date,
          opponent: oppComp.team.displayName,
          opponentAbbr: oppComp.team.abbreviation,
          isHome,
          teamScore,
          opponentScore: oppScore,
          won: teamScore > oppScore,
          spread,
          overUnder,
          margin: teamScore - oppScore,
          source: 'ESPN',
        };
      })
      .filter(g => g.teamScore > 0 || g.opponentScore > 0);

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
          margin: teamScore - oppScore,
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

// Fetch closing spreads/totals for recent games from Odds API
async function fetchHistoricalOdds(sport, apiKey) {
  try {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=spreads,totals&oddsFormat=american`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return {};
    const data = await res.json();

    const oddsMap = {};
    data.forEach(game => {
      const spreads = {};
      const totals = {};

      game.bookmakers?.forEach(book => {
        const spreadMarket = book.markets?.find(m => m.key === 'spreads');
        const totalMarket = book.markets?.find(m => m.key === 'totals');

        if (spreadMarket) {
          spreadMarket.outcomes?.forEach(o => {
            if (!spreads[o.name]) spreads[o.name] = [];
            spreads[o.name].push(o.point);
          });
        }
        if (totalMarket) {
          totalMarket.outcomes?.forEach(o => {
            if (!totals[o.name]) totals[o.name] = [];
            totals[o.name].push(o.point);
          });
        }
      });

      // Calculate consensus (median) spread for each team
      const consensusSpreads = {};
      Object.entries(spreads).forEach(([team, points]) => {
        const sorted = points.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        consensusSpreads[team] = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      });

      // Consensus total
      const allTotals = Object.values(totals).flat();
      const sortedTotals = allTotals.sort((a, b) => a - b);
      const tMid = Math.floor(sortedTotals.length / 2);
      const consensusTotal = sortedTotals.length > 0
        ? (sortedTotals.length % 2 !== 0 ? sortedTotals[tMid] : (sortedTotals[tMid - 1] + sortedTotals[tMid]) / 2)
        : null;

      oddsMap[game.id] = {
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        spreads: consensusSpreads,
        total: consensusTotal,
      };
    });

    return oddsMap;
  } catch (e) {
    console.error('Historical odds error:', e.message);
    return {};
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

// Calculate stats with ATS and SU records
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

  // --- SU (Straight Up) Record ---
  const suRecord = {
    wins,
    losses,
    total: wins + losses,
    winPct: wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : null,
  };

  // Home/Away SU splits
  const homeSU = {
    wins: homeGames.filter(g => g.won).length,
    losses: homeGames.filter(g => !g.won).length,
  };
  const awaySU = {
    wins: awayGames.filter(g => g.won).length,
    losses: awayGames.filter(g => !g.won).length,
  };

  // --- ATS (Against The Spread) Record ---
  // Only calculate if we have spread data
  const gamesWithSpreads = games.filter(g => g.spread != null);
  let atsRecord = null;

  if (gamesWithSpreads.length >= 3) {
    let atsCover = 0, atsLoss = 0, atsPush = 0;
    gamesWithSpreads.forEach(g => {
      // margin = teamScore - oppScore (positive = team won by that much)
      // spread is team's spread (e.g., -5 means team favored by 5)
      // Team covers if margin > -spread (or margin + spread > 0)
      const adjustedMargin = g.margin + g.spread;
      if (adjustedMargin > 0) atsCover++;
      else if (adjustedMargin === 0) atsPush++;
      else atsLoss++;
    });

    atsRecord = {
      covers: atsCover,
      losses: atsLoss,
      pushes: atsPush,
      total: gamesWithSpreads.length,
      coverPct: (atsCover + atsLoss) > 0 ? ((atsCover / (atsCover + atsLoss)) * 100).toFixed(1) : null,
    };

    // ATS splits for home/away
    const homeAtsGames = gamesWithSpreads.filter(g => g.isHome);
    const awayAtsGames = gamesWithSpreads.filter(g => !g.isHome);

    if (homeAtsGames.length > 0) {
      let hCover = 0, hLoss = 0, hPush = 0;
      homeAtsGames.forEach(g => {
        const adj = g.margin + g.spread;
        if (adj > 0) hCover++;
        else if (adj === 0) hPush++;
        else hLoss++;
      });
      atsRecord.home = { covers: hCover, losses: hLoss, pushes: hPush, total: homeAtsGames.length };
    }

    if (awayAtsGames.length > 0) {
      let aCover = 0, aLoss = 0, aPush = 0;
      awayAtsGames.forEach(g => {
        const adj = g.margin + g.spread;
        if (adj > 0) aCover++;
        else if (adj === 0) aPush++;
        else aLoss++;
      });
      atsRecord.away = { covers: aCover, losses: aLoss, pushes: aPush, total: awayAtsGames.length };
    }
  }

  // --- Over/Under record ---
  const gamesWithTotals = games.filter(g => g.overUnder != null);
  let ouRecord = null;

  if (gamesWithTotals.length >= 3) {
    let overs = 0, unders = 0, ouPush = 0;
    gamesWithTotals.forEach(g => {
      const totalScored = g.teamScore + g.opponentScore;
      if (totalScored > g.overUnder) overs++;
      else if (totalScored < g.overUnder) unders++;
      else ouPush++;
    });
    ouRecord = {
      overs,
      unders,
      pushes: ouPush,
      total: gamesWithTotals.length,
    };
  }

  // Average margin of victory/defeat
  const avgMargin = games.length > 0
    ? (games.reduce((sum, g) => sum + g.margin, 0) / games.length).toFixed(1)
    : null;

  return {
    wins,
    losses,
    streak: streak > 0 ? `${streakType}${streak}` : '-',
    homeRecord: {
      wins: homeSU.wins,
      losses: homeSU.losses
    },
    awayRecord: {
      wins: awaySU.wins,
      losses: awaySU.losses
    },
    recentGames: games.slice(0, 5),
    suRecord,
    atsRecord,
    ouRecord,
    avgMargin,
  };
}

// Calculate trends (enhanced with ATS/SU)
function calculateTrends(homeStats, awayStats, h2hGames, homeTeam, awayTeam) {
  const trends = [];

  // --- SU Trends ---
  if (homeStats && homeStats.suRecord) {
    const su = homeStats.suRecord;
    if (su.total >= 5 && su.winPct !== null) {
      const pct = parseFloat(su.winPct);
      if (pct >= 70) {
        trends.push({
          type: 'HOME_SU',
          label: `${homeTeam?.split(' ').pop()} SU: ${su.wins}-${su.losses}`,
          description: `Winning ${su.winPct}% of games straight up in last ${su.total} games`,
          confidence: 'high',
          icon: '🏆',
        });
      } else if (pct >= 55) {
        trends.push({
          type: 'HOME_SU',
          label: `${homeTeam?.split(' ').pop()} SU: ${su.wins}-${su.losses}`,
          description: `Winning ${su.winPct}% straight up in last ${su.total} games`,
          confidence: 'medium',
          icon: '📊',
        });
      } else if (pct <= 35) {
        trends.push({
          type: 'HOME_SU',
          label: `${homeTeam?.split(' ').pop()} SU: ${su.wins}-${su.losses}`,
          description: `Only ${su.winPct}% straight up — struggling recently`,
          confidence: 'high',
          icon: '📉',
        });
      }
    }
  }

  if (awayStats && awayStats.suRecord) {
    const su = awayStats.suRecord;
    if (su.total >= 5 && su.winPct !== null) {
      const pct = parseFloat(su.winPct);
      if (pct >= 70) {
        trends.push({
          type: 'AWAY_SU',
          label: `${awayTeam?.split(' ').pop()} SU: ${su.wins}-${su.losses}`,
          description: `Winning ${su.winPct}% straight up in last ${su.total} games`,
          confidence: 'high',
          icon: '🏆',
        });
      } else if (pct >= 55) {
        trends.push({
          type: 'AWAY_SU',
          label: `${awayTeam?.split(' ').pop()} SU: ${su.wins}-${su.losses}`,
          description: `Winning ${su.winPct}% straight up in last ${su.total} games`,
          confidence: 'medium',
          icon: '📊',
        });
      } else if (pct <= 35) {
        trends.push({
          type: 'AWAY_SU',
          label: `${awayTeam?.split(' ').pop()} SU: ${su.wins}-${su.losses}`,
          description: `Only ${su.winPct}% straight up — struggling recently`,
          confidence: 'high',
          icon: '📉',
        });
      }
    }
  }

  // --- ATS Trends ---
  if (homeStats?.atsRecord) {
    const ats = homeStats.atsRecord;
    if (ats.total >= 3 && ats.coverPct !== null) {
      const pct = parseFloat(ats.coverPct);
      if (pct >= 65) {
        trends.push({
          type: 'HOME_ATS',
          label: `${homeTeam?.split(' ').pop()} ATS: ${ats.covers}-${ats.losses}${ats.pushes > 0 ? `-${ats.pushes}` : ''}`,
          description: `Covering ${ats.coverPct}% against the spread — sharp value`,
          confidence: 'high',
          icon: '💰',
        });
      } else if (pct >= 50) {
        trends.push({
          type: 'HOME_ATS',
          label: `${homeTeam?.split(' ').pop()} ATS: ${ats.covers}-${ats.losses}${ats.pushes > 0 ? `-${ats.pushes}` : ''}`,
          description: `Covering ${ats.coverPct}% against the spread`,
          confidence: 'medium',
          icon: '📋',
        });
      } else if (pct <= 35) {
        trends.push({
          type: 'HOME_ATS',
          label: `${homeTeam?.split(' ').pop()} ATS: ${ats.covers}-${ats.losses}${ats.pushes > 0 ? `-${ats.pushes}` : ''}`,
          description: `Only covering ${ats.coverPct}% ATS — fade candidate`,
          confidence: 'high',
          icon: '🚫',
        });
      }
    }
  }

  if (awayStats?.atsRecord) {
    const ats = awayStats.atsRecord;
    if (ats.total >= 3 && ats.coverPct !== null) {
      const pct = parseFloat(ats.coverPct);
      if (pct >= 65) {
        trends.push({
          type: 'AWAY_ATS',
          label: `${awayTeam?.split(' ').pop()} ATS: ${ats.covers}-${ats.losses}${ats.pushes > 0 ? `-${ats.pushes}` : ''}`,
          description: `Covering ${ats.coverPct}% against the spread — sharp value`,
          confidence: 'high',
          icon: '💰',
        });
      } else if (pct >= 50) {
        trends.push({
          type: 'AWAY_ATS',
          label: `${awayTeam?.split(' ').pop()} ATS: ${ats.covers}-${ats.losses}${ats.pushes > 0 ? `-${ats.pushes}` : ''}`,
          description: `Covering ${ats.coverPct}% against the spread`,
          confidence: 'medium',
          icon: '📋',
        });
      } else if (pct <= 35) {
        trends.push({
          type: 'AWAY_ATS',
          label: `${awayTeam?.split(' ').pop()} ATS: ${ats.covers}-${ats.losses}${ats.pushes > 0 ? `-${ats.pushes}` : ''}`,
          description: `Only covering ${ats.coverPct}% ATS — fade candidate`,
          confidence: 'high',
          icon: '🚫',
        });
      }
    }
  }

  // --- O/U Trends ---
  if (homeStats?.ouRecord && homeStats.ouRecord.total >= 3) {
    const ou = homeStats.ouRecord;
    const overPct = ((ou.overs / (ou.overs + ou.unders)) * 100).toFixed(0);
    if (ou.overs >= ou.unders + 2) {
      trends.push({
        type: 'HOME_OU',
        label: `${homeTeam?.split(' ').pop()} O/U: ${ou.overs}-${ou.unders}`,
        description: `${overPct}% of games going Over in last ${ou.total}`,
        confidence: 'medium',
        icon: '📈',
      });
    } else if (ou.unders >= ou.overs + 2) {
      trends.push({
        type: 'HOME_OU',
        label: `${homeTeam?.split(' ').pop()} O/U: ${ou.overs}-${ou.unders}`,
        description: `Games leaning Under in last ${ou.total}`,
        confidence: 'medium',
        icon: '📉',
      });
    }
  }

  // --- Streak Trends ---
  if (homeStats) {
    if (homeStats.streak.startsWith('W') && parseInt(homeStats.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: `${homeTeam?.split(' ').pop()} on ${homeStats.streak} streak`,
        description: `${homeStats.streak} win streak — momentum is real`,
        confidence: 'high',
        icon: '🔥',
      });
    }
    if (homeStats.streak.startsWith('L') && parseInt(homeStats.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: `${homeTeam?.split(' ').pop()} on ${homeStats.streak} streak`,
        description: `${homeStats.streak} losing streak — bounce back or fade?`,
        confidence: 'medium',
        icon: '⚠️',
      });
    }
  }
  if (awayStats) {
    if (awayStats.streak.startsWith('W') && parseInt(awayStats.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: `${awayTeam?.split(' ').pop()} on ${awayStats.streak} streak`,
        description: `${awayStats.streak} win streak — riding hot`,
        confidence: 'high',
        icon: '🔥',
      });
    }
    if (awayStats.streak.startsWith('L') && parseInt(awayStats.streak.slice(1)) >= 3) {
      trends.push({
        type: 'STREAK',
        label: `${awayTeam?.split(' ').pop()} on ${awayStats.streak} streak`,
        description: `${awayStats.streak} losing streak`,
        confidence: 'medium',
        icon: '⚠️',
      });
    }
  }

  // --- Margin trend ---
  if (homeStats?.avgMargin) {
    const margin = parseFloat(homeStats.avgMargin);
    if (margin >= 8) {
      trends.push({
        type: 'MARGIN',
        label: `${homeTeam?.split(' ').pop()} avg margin +${homeStats.avgMargin}`,
        description: `Dominating by ${homeStats.avgMargin} points on average`,
        confidence: 'high',
        icon: '💪',
      });
    }
  }
  if (awayStats?.avgMargin) {
    const margin = parseFloat(awayStats.avgMargin);
    if (margin >= 8) {
      trends.push({
        type: 'MARGIN',
        label: `${awayTeam?.split(' ').pop()} avg margin +${awayStats.avgMargin}`,
        description: `Dominating by ${awayStats.avgMargin} points on average`,
        confidence: 'high',
        icon: '💪',
      });
    }
  }

  // --- H2H Trend ---
  if (h2hGames && h2hGames.length > 0) {
    trends.push({
      type: 'H2H',
      label: `${h2hGames.length} recent head-to-head`,
      description: `${h2hGames.length} meeting(s) in recent history`,
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

    // Fetch from all sources in parallel
    const [espnHome, espnAway, oddsHome, oddsAway, h2hGames, playerProps] = await Promise.all([
      fetchFromESPN(homeTeam, homeESPNId, sport),
      fetchFromESPN(awayTeam, awayESPNId, sport),
      fetchFromOddsAPI(homeTeam, sport, apiKey),
      fetchFromOddsAPI(awayTeam, sport, apiKey),
      fetchH2H(homeTeam, awayTeam, sport, apiKey),
      fetchPlayerProps(gameId, sport, apiKey),
    ]);

    // Use ESPN as primary for ATS data (has spread info), Odds API for recent scores
    // Merge: prefer ESPN games (they have spreads), supplement with Odds API
    const homeGames = espnHome.count > 0 ? espnHome.games : oddsHome.games;
    const awayGames = espnAway.count > 0 ? espnAway.games : oddsAway.games;

    // Calculate stats (now includes ATS, SU, O/U)
    const homeStats = calculateStats(homeGames);
    const awayStats = calculateStats(awayGames);
    const trends = calculateTrends(homeStats, awayStats, h2hGames, homeTeam, awayTeam);

    // Determine if we have enough data for meaningful trends
    const hasATSData = !!(homeStats?.atsRecord || awayStats?.atsRecord);
    const hasSUData = !!(homeStats?.suRecord?.total >= 3 || awayStats?.suRecord?.total >= 3);
    const highConfidenceCount = trends.filter(t => t.confidence === 'high').length;

    const result = {
      gameId: gameId || null,
      sport,
      homeTeam,
      awayTeam,
      accurate: homeGames.length >= 3 || awayGames.length >= 3,
      dataSource: espnHome.count > 0 ? 'ESPN + Odds API' : 'Odds API',
      dataWindow: espnHome.count > 0 ? 'Last 30 days' : 'Last 3 days',
      timestamp: new Date().toISOString(),
      teams: {
        home: homeStats ? {
          ...homeStats,
          team: homeTeam,
          logo: homeESPNId ? `https://a.espncdn.com/i/teamlogos/nba/500/${homeESPNId}.png` : null,
          record: homeStats ? `${homeStats.wins}-${homeStats.losses}` : 'N/A',
          restDays: null,
        } : null,
        away: awayStats ? {
          ...awayStats,
          team: awayTeam,
          logo: awayESPNId ? `https://a.espncdn.com/i/teamlogos/nba/500/${awayESPNId}.png` : null,
          record: awayStats ? `${awayStats.wins}-${awayStats.losses}` : 'N/A',
          restDays: null,
        } : null,
      },
      h2h: h2hGames,
      playerProps: playerProps || [],
      hasPlayerProps: playerProps && playerProps.length > 0,
      trends,
      hasATSData,
      hasSUData,
      meta: {
        homeGamesFound: homeGames.length,
        awayGamesFound: awayGames.length,
        espnGames: espnHome.count + espnAway.count,
        oddsGames: oddsHome.count + oddsAway.count,
        trendCount: trends.length,
        highConfidenceTrends: highConfidenceCount,
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
