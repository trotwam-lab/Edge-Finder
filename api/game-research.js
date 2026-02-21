// api/game-research.js — Fetches detailed research for specific games
// Returns: recent form, head-to-head, ATS trends, key stats

import { fetchESPNData } from '../src/utils/espn.js';

const cache = {};
const TTL = 30 * 60 * 1000; // 30 minutes

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
    // Fetch research data
    const research = await fetchGameResearch(awayTeam, homeTeam, sport);
    
    // Cache it
    cache[cacheKey] = { data: research, ts: Date.now() };
    
    return res.json(research);
  } catch (error) {
    console.error('Research fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch research' });
  }
}

async function fetchGameResearch(away, home, sport) {
  // This will integrate with ESPN, Basketball-Reference, etc.
  // For now, return structured placeholder that we'll fill with real data
  
  return {
    lastUpdated: new Date().toISOString(),
    awayTeam: {
      name: away,
      recentForm: {
        last5: ['W', 'W', 'L', 'W', 'W'],
        record: '4-1',
        avgPoints: 118.4,
        avgAllowed: 112.2,
      },
      ats: {
        overall: '35-25-2',
        home: '18-10-1',
        away: '17-15-1',
        last5: '3-2',
      },
      injuries: [],
    },
    homeTeam: {
      name: home,
      recentForm: {
        last5: ['W', 'L', 'W', 'W', 'L'],
        record: '3-2',
        avgPoints: 122.1,
        avgAllowed: 115.8,
      },
      ats: {
        overall: '32-28-2',
        home: '20-8-1',
        away: '12-20-1',
        last5: '2-3',
      },
      injuries: [],
    },
    headToHead: {
      thisSeason: [
        { date: '2026-01-15', winner: home, score: '122-109', spread: `${home} -6` },
      ],
      lastMeetings: [
        { date: '2025-12-20', winner: away, score: '115-108', spread: `${away} +3` },
        { date: '2025-11-08', winner: home, score: '130-125', spread: `${home} -4.5` },
      ],
      overall: `${home} leads 2-1`,
    },
    keyTrends: [
      `${away} is 5-0 ATS in last 5 road games`,
      `${home} is 2-6 ATS in last 8 home games`,
      'Over has hit in 4 of last 5 meetings',
      `${away} averaging 118+ points in last 5`,
    ],
  };
}
