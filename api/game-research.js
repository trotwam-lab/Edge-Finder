// api/game-research.js — Fetches detailed research for specific games
// Uses ESPN API for accurate, real-time data

import { fetchGameResearch } from '../src/utils/espn.js';

const cache = {};
const TTL = 10 * 60 * 1000; // 10 minutes - fresher data for live games

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { homeTeam, awayTeam, sport } = req.query;
  
  if (!homeTeam || !awayTeam) {
    return res.status(400).json({ error: 'Missing team names' });
  }
  
  const cacheKey = `${awayTeam}-${homeTeam}-${sport || 'nba'}`;
  
  // Check cache
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    return res.json(cache[cacheKey].data);
  }
  
  try {
    // Fetch real research data from ESPN
    const research = await fetchGameResearch(awayTeam, homeTeam, sport);
    
    // Transform to match our component format
    const formatted = {
      lastUpdated: research.lastUpdated,
      source: research.source,
      awayTeam: {
        name: research.awayTeam.name,
        recentForm: {
          last5: research.awayTeam.recentForm.last5,
          record: research.awayTeam.recentForm.record,
          avgPoints: research.awayTeam.recentForm.avgPoints,
          avgAllowed: research.awayTeam.recentForm.avgAllowed,
        },
        ats: {
          overall: 'N/A', // ESPN doesn't provide ATS data
          home: research.awayTeam.seasonStats?.homeRecord || 'N/A',
          away: research.awayTeam.seasonStats?.awayRecord || 'N/A',
          last5: research.awayTeam.recentForm.record,
        },
      },
      homeTeam: {
        name: research.homeTeam.name,
        recentForm: {
          last5: research.homeTeam.recentForm.last5,
          record: research.homeTeam.recentForm.record,
          avgPoints: research.homeTeam.recentForm.avgPoints,
          avgAllowed: research.homeTeam.recentForm.avgAllowed,
        },
        ats: {
          overall: 'N/A',
          home: research.homeTeam.seasonStats?.homeRecord || 'N/A',
          away: research.homeTeam.seasonStats?.awayRecord || 'N/A',
          last5: research.homeTeam.recentForm.record,
        },
      },
      headToHead: {
        thisSeason: research.headToHead.games
          .filter(g => g.completed && new Date(g.date).getFullYear() === new Date().getFullYear())
          .map(g => ({
            date: g.date,
            winner: g.winner,
            score: g.score,
            spread: 'N/A', // ESPN doesn't provide spread data
          })),
        lastMeetings: research.headToHead.games
          .filter(g => g.completed)
          .slice(0, 5)
          .map(g => ({
            date: g.date,
            winner: g.winner,
            score: g.score,
          })),
        overall: `${research.headToHead.count} games`,
      },
      keyTrends: [
        `${research.awayTeam.name}: ${research.awayTeam.recentForm.record} in last 5`,
        `${research.homeTeam.name}: ${research.homeTeam.recentForm.record} in last 5`,
        `${research.awayTeam.name} averaging ${research.awayTeam.recentForm.avgPoints} PPG`,
        `${research.homeTeam.name} averaging ${research.homeTeam.recentForm.avgPoints} PPG`,
      ],
    };
    
    // Cache it
    cache[cacheKey] = { data: formatted, ts: Date.now() };
    
    return res.json(formatted);
  } catch (error) {
    console.error('Research fetch error:', error);
    // Return fallback data instead of error
    return res.json({
      lastUpdated: new Date().toISOString(),
      source: 'FALLBACK',
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
      keyTrends: ['Data temporarily unavailable'],
    });
  }
}
