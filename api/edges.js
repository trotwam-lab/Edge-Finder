// api/edges.js — Edge Detection API
// Fetches odds from The Odds API, finds edges across bookmakers, returns sorted by EV
// Caches results for 15 minutes to save API credits

const cache = { data: null, ts: 0 };
const TTL = 15 * 60 * 1000; // 15 minutes

const TRACKED_SPORTS = [
  'basketball_nba',
  'americanfootball_nfl',
  'icehockey_nhl',
  'baseball_mlb',
  'mma_mixed_martial_arts',
];

const SPORT_LABELS = {
  basketball_nba: 'NBA',
  americanfootball_nfl: 'NFL',
  icehockey_nhl: 'NHL',
  baseball_mlb: 'MLB',
  mma_mixed_martial_arts: 'UFC',
};

const SPORT_EMOJI = {
  NBA: '🏀',
  NFL: '🏈',
  NHL: '🏒',
  MLB: '⚾',
  UFC: '🥊',
};

const MIN_EV_THRESHOLD = 3.0;
const MAX_EV_THRESHOLD = 25.0;
const MIN_LINE_DISCREPANCY = 20;
const MIN_BOOKS = 3;

function americanToDecimal(american) {
  if (american > 0) return (american / 100) + 1;
  return (100 / Math.abs(american)) + 1;
}

function impliedProbability(american) {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

function findEdges(games, sportKey) {
  const edges = [];
  const sportName = SPORT_LABELS[sportKey] || sportKey.toUpperCase();
  const emoji = SPORT_EMOJI[sportName] || '🎯';

  for (const game of games) {
    const home = game.home_team;
    const away = game.away_team;
    const gameName = `${away} vs ${home}`;

    for (const market of ['h2h', 'spreads', 'totals']) {
      const allOutcomes = {};

      for (const bookmaker of game.bookmakers) {
        const mkt = bookmaker.markets.find(m => m.key === market);
        if (!mkt) continue;

        for (const outcome of mkt.outcomes) {
          const key = outcome.name + (outcome.point ? `_${outcome.point}` : '');
          if (!allOutcomes[key]) allOutcomes[key] = [];
          allOutcomes[key].push({
            book: bookmaker.title,
            price: outcome.price,
            point: outcome.point,
            name: outcome.name,
          });
        }
      }

      for (const [outcomeKey, books] of Object.entries(allOutcomes)) {
        if (books.length < MIN_BOOKS) continue;

        const sorted = [...books].sort((a, b) => b.price - a.price);
        const best = sorted[0];
        const worst = sorted[sorted.length - 1];

        const avgImplied = books.reduce((sum, b) => sum + impliedProbability(b.price), 0) / books.length;
        const bestDecimal = americanToDecimal(best.price);
        const ev = ((bestDecimal * (1 - avgImplied) - avgImplied) / avgImplied) * 100;
        const discrepancy = Math.abs(best.price - worst.price);

        if ((ev >= MIN_EV_THRESHOLD && ev <= MAX_EV_THRESHOLD) || (discrepancy >= MIN_LINE_DISCREPANCY && ev > 0 && ev <= MAX_EV_THRESHOLD)) {
          const confidence = ev >= 5 ? 'HIGH' : ev >= 3 ? 'MEDIUM' : 'LOW';

          let edgeDesc = '';
          if (market === 'h2h') {
            edgeDesc = `Moneyline: ${best.name} @ ${best.price > 0 ? '+' : ''}${best.price}`;
          } else if (market === 'spreads') {
            edgeDesc = `Spread: ${best.name} ${best.point > 0 ? '+' : ''}${best.point} @ ${best.price > 0 ? '+' : ''}${best.price}`;
          } else if (market === 'totals') {
            edgeDesc = `Total: ${best.name} ${best.point} @ ${best.price > 0 ? '+' : ''}${best.price}`;
          }

          edges.push({
            sport: sportName,
            emoji,
            game: gameName,
            gameId: game.id,
            edge: edgeDesc,
            ev: parseFloat(ev.toFixed(1)),
            evDisplay: `+${ev.toFixed(1)}%`,
            book: best.book,
            confidence,
            market,
            timestamp: new Date().toISOString(),
          });
        }
      }
    }
  }

  return edges.sort((a, b) => b.ev - a.ev);
}

export default async function handler(req, res) {
  // Return cached data if fresh
  if (cache.data && Date.now() - cache.ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });

  try {
    const allEdges = [];

    for (const sport of TRACKED_SPORTS) {
      try {
        const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=spreads,totals,h2h&oddsFormat=american`;
        const response = await fetch(url);
        if (!response.ok) continue;
        const games = await response.json();
        const edges = findEdges(games, sport);
        allEdges.push(...edges);
      } catch (e) {
        console.warn(`Edge scan failed for ${sport}:`, e.message);
      }
    }

    // Sort all edges by EV descending
    allEdges.sort((a, b) => b.ev - a.ev);

    cache.data = allEdges;
    cache.ts = Date.now();

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(allEdges);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
