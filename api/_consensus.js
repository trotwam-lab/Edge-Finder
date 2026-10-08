// api/_consensus.js — no-vig consensus probabilities for game markets.
//
// Same math as the edge scan (api/edges.js): remove each book's vig, then
// average the fair probability for each outcome across books. Used to record
// closing lines for verified bets without running a whole edge scan.

import { probIndexKey } from './_receipts.js';

const MIN_BOOKS = 2;

function impliedProbability(american) {
  if (american > 0) return 100 / (american + 100);
  return Math.abs(american) / (Math.abs(american) + 100);
}

function removeVig(probs) {
  const total = probs.reduce((sum, p) => sum + p, 0);
  if (total <= 0) return probs;
  return probs.map(p => p / total);
}

export function getConsensusProbabilities(bookmakers, marketKey) {
  const probSums = new Map();
  const probCounts = new Map();
  for (const book of bookmakers) {
    const market = book.markets?.find(m => m.key === marketKey);
    if (!market || !Array.isArray(market.outcomes) || market.outcomes.length < 2) continue;
    if (market.outcomes.some(o => !Number.isFinite(o?.price))) continue;
    const fairProbs = removeVig(market.outcomes.map(o => impliedProbability(o.price)));
    market.outcomes.forEach((outcome, i) => {
      const key = outcome.point !== undefined ? `${outcome.name}|${outcome.point}` : outcome.name;
      probSums.set(key, (probSums.get(key) || 0) + fairProbs[i]);
      probCounts.set(key, (probCounts.get(key) || 0) + 1);
    });
  }
  if (probSums.size === 0) return null;
  const consensus = new Map();
  for (const [key, sum] of probSums) consensus.set(key, sum / probCounts.get(key));
  return consensus;
}

// probIndexKey → { fairProb, bestPrice, commenceTime } for every priced
// outcome of every PREGAME game (live prices never become a "close").
export function buildProbIndex(games, now = Date.now()) {
  const index = new Map();
  for (const game of games || []) {
    const start = Date.parse(game?.commence_time || '');
    if (!Number.isFinite(start) || start <= now || !Array.isArray(game.bookmakers)) continue;
    for (const marketKey of ['h2h', 'spreads', 'totals']) {
      const books = game.bookmakers.filter(b => b.markets?.some(m => m.key === marketKey));
      if (books.length < MIN_BOOKS) continue;
      const consensus = getConsensusProbabilities(books, marketKey);
      if (!consensus) continue;
      for (const book of books) {
        const market = book.markets.find(m => m.key === marketKey);
        for (const outcome of market.outcomes || []) {
          const fairProb = consensus.get(outcome.point !== undefined ? `${outcome.name}|${outcome.point}` : outcome.name);
          if (!fairProb) continue;
          const key = probIndexKey(game.id, marketKey, outcome.name, outcome.point ?? null);
          const existing = index.get(key);
          if (!existing) index.set(key, { fairProb, bestPrice: outcome.price, commenceTime: game.commence_time });
          else if (outcome.price > existing.bestPrice) existing.bestPrice = outcome.price;
        }
      }
    }
  }
  return index;
}
