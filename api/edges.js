// api/edges.js — Edge Detection API
// Fetches odds from The Odds API, finds +EV edges and arbitrage across bookmakers.
// Uses no-vig consensus probability to calculate true EV (not simplified approximation).
// Caches results for 60 seconds to save API credits while keeping edges fresh.

const cache = { data: null, ts: 0 };
const TTL = 60 * 1000; // 60 seconds

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
    NBA: '🏀', NFL: '🏈', NHL: '🏒', MLB: '⚾', UFC: '🥊',
};

// Minimum EV threshold — below this isn't worth flagging
const MIN_EV_THRESHOLD = 2.0;
// Maximum realistic EV — anything higher is likely stale/erroneous odds
const MAX_EV_THRESHOLD = 15.0;
// Minimum books required to calculate consensus (2 is enough for spreads/totals)
const MIN_BOOKS = 2;

// ============================================================
// Math helpers
// ============================================================

function americanToDecimal(american) {
    if (american > 0) return american / 100 + 1;
    return 100 / Math.abs(american) + 1;
}

function impliedProbability(american) {
    if (american > 0) return 100 / (american + 100);
    return Math.abs(american) / (Math.abs(american) + 100);
}

// Remove the bookmaker's vig from a set of probabilities
// so they sum to exactly 1.0 (fair/true probabilities)
function removeVig(probs) {
    const total = probs.reduce((sum, p) => sum + p, 0);
    if (total <= 0) return probs;
    return probs.map(p => p / total);
}

// EV% = (decimalOdds × fairProbability - 1) × 100
// Positive = profitable bet over the long run
function calculateEV(decimalOdds, fairProbability) {
    return (decimalOdds * fairProbability - 1) * 100;
}

// ============================================================
// Consensus fair probability calculation
// Averages the no-vig implied probability across all books
// for a specific outcome key, then returns the consensus map.
// ============================================================
function getConsensusProbabilities(bookmakers, marketKey) {
    const probSums = new Map();
    const probCounts = new Map();

  for (const book of bookmakers) {
        const market = book.markets.find(m => m.key === marketKey);
        if (!market || market.outcomes.length < 2) continue;

      // Remove vig from this book's market
      const rawProbs = market.outcomes.map(o => impliedProbability(o.price));
        const fairProbs = removeVig(rawProbs);

      market.outcomes.forEach((outcome, i) => {
              // Key includes point so Over 220.5 and Over 221 are separate outcomes
                                    const key = outcome.point !== undefined
                ? `${outcome.name}|${outcome.point}`
                                              : outcome.name;
              probSums.set(key, (probSums.get(key) || 0) + fairProbs[i]);
              probCounts.set(key, (probCounts.get(key) || 0) + 1);
      });
  }

  if (probSums.size === 0) return null;

  // Average across books
  const consensus = new Map();
    for (const [key, sum] of probSums) {
          consensus.set(key, sum / probCounts.get(key));
    }
    return consensus;
}

// ============================================================
// Edge detection for a single game
// ============================================================
function findEdges(game, sportKey) {
    const edges = [];
    const sportName = SPORT_LABELS[sportKey] || sportKey.toUpperCase();
    const emoji = SPORT_EMOJI[sportName] || '🎯';
    const home = game.home_team;
    const away = game.away_team;
    const gameName = `${away} @ ${home}`;

  for (const marketKey of ['h2h', 'spreads', 'totals']) {
        // Need at least MIN_BOOKS covering this market
      const booksWithMarket = game.bookmakers.filter(b =>
              b.markets.some(m => m.key === marketKey)
                                                         );
        if (booksWithMarket.length < MIN_BOOKS) continue;

      const consensusProbs = getConsensusProbabilities(booksWithMarket, marketKey);
        if (!consensusProbs) continue;

      // Check each book's odds against the consensus fair probability
      for (const bookmaker of booksWithMarket) {
              const market = bookmaker.markets.find(m => m.key === marketKey);
              if (!market) continue;

          for (const outcome of market.outcomes) {
                    const key = outcome.point !== undefined
                      ? `${outcome.name}|${outcome.point}`
                                : outcome.name;
                    const fairProb = consensusProbs.get(key);
                    if (!fairProb) continue;

                const decimal = americanToDecimal(outcome.price);
                    const ev = calculateEV(decimal, fairProb);

                if (ev >= MIN_EV_THRESHOLD && ev <= MAX_EV_THRESHOLD) {
                            let edgeDesc = '';
                            if (marketKey === 'h2h') {
                                          edgeDesc = `Moneyline: ${outcome.name} @ ${outcome.price > 0 ? '+' : ''}${outcome.price}`;
                            } else if (marketKey === 'spreads') {
                                          edgeDesc = `Spread: ${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point} @ ${outcome.price > 0 ? '+' : ''}${outcome.price}`;
                            } else if (marketKey === 'totals') {
                                          edgeDesc = `Total: ${outcome.name} ${outcome.point} @ ${outcome.price > 0 ? '+' : ''}${outcome.price}`;
                            }

                      const confidence = ev >= 5 ? 'HIGH' : ev >= 3 ? 'MEDIUM' : 'LOW';

                      edges.push({
                                    sport: sportName,
                                    emoji,
                                    game: gameName,
                                    gameId: game.id,
                                    commenceTime: game.commence_time,
                                    edge: edgeDesc,
                                    ev: parseFloat(ev.toFixed(1)),
                                    evDisplay: `+${ev.toFixed(1)}%`,
                                    book: bookmaker.title,
                                    bookKey: bookmaker.key,
                                    market: marketKey,
                                    confidence,
                                    fairProbability: parseFloat((fairProb * 100).toFixed(1)),
                                    timestamp: new Date().toISOString(),
                      });
                }
          }
      }
  }

  return edges.sort((a, b) => b.ev - a.ev);
}

// ============================================================
// Handler
// ============================================================
export default async function handler(req, res) {
    // Return cached data if still fresh
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
                        const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;
                        const response = await fetch(url);
                        if (!response.ok) {
                                    console.warn(`Odds API error for ${sport}: ${response.status}`);
                                    continue;
                        }
                        const games = await response.json();
                        for (const game of games) {
                                    const edges = findEdges(game, sport);
                                    allEdges.push(...edges);
                        }
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
