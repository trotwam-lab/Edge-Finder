// Vercel serverless function entry point
import { getGameResearch } from './game-research.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { homeTeam, awayTeam, sport, gameDate } = req.query;

  if (!homeTeam || !awayTeam || !sport) {
    return res.status(400).json({
      error: 'Missing required parameters: homeTeam, awayTeam, sport',
    });
  }

  try {
    const research = await getGameResearch(homeTeam, awayTeam, sport, gameDate);
    return res.status(200).json(research);
  } catch (err) {
    console.error('[API Error]', err);
    return res.status(500).json({
      error: err.message || 'Internal server error',
      sport,
      homeTeam,
      awayTeam,
    });
  }
}
