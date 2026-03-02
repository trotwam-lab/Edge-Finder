// src/utils/odds-math.js
// Pure math utilities for odds conversion, EV calculation, and edge scoring.
// All functions are side-effect-free and unit-testable.

// ============================================================
// Basic odds conversion
// ============================================================

// Convert American odds to implied probability (0-1)
export function americanToImplied(odds) {
    if (odds === undefined || odds === null) return null;
    if (odds > 0) return 100 / (odds + 100);
    return Math.abs(odds) / (Math.abs(odds) + 100);
}

// Convert implied probability (0-1) to American odds
export function impliedToAmerican(prob) {
    if (!prob || prob <= 0 || prob >= 1) return null;
    if (prob >= 0.5) return Math.round(-100 * prob / (1 - prob));
    return Math.round(100 * (1 - prob) / prob);
}

// Convert American odds to decimal multiplier (e.g., -110 → 1.909)
export function americanToDecimal(odds) {
    if (odds > 0) return odds / 100 + 1;
    return 100 / Math.abs(odds) + 1;
}

// ============================================================
// Vig removal
// Remove the overround from a set of raw implied probabilities
// so they sum to exactly 1.0 (representing the fair/true market).
// ============================================================
export function removeVig(probs) {
    const total = probs.reduce((a, b) => a + b, 0);
    if (!total || total <= 0) return probs;
    return probs.map(p => p / total);
}

// ============================================================
// Fair odds for a two-sided market
// Returns { fair1, fair2, hold } where fair values are American odds
// and hold is the bookmaker's edge as a percentage.
// ============================================================
export function calculateFairOdds(odds1, odds2) {
    const p1 = americanToImplied(odds1);
    const p2 = americanToImplied(odds2);
    if (!p1 || !p2) return null;

  const total = p1 + p2; // > 1.0 means overround/vig
  const [fairP1, fairP2] = removeVig([p1, p2]);
    const hold = (total - 1) * 100; // percentage

  return {
        fair1: impliedToAmerican(fairP1),
        fair2: impliedToAmerican(fairP2),
        hold: Math.round(hold * 10) / 10,
        impliedProb1: fairP1,
        impliedProb2: fairP2,
  };
}

// Calculate hold/juice for a market (array of outcomes with .price)
export function calculateHold(outcomes) {
    if (!outcomes || outcomes.length < 2) return null;
    const totalImplied = outcomes.reduce((sum, o) => sum + (americanToImplied(o.price) || 0), 0);
    return Math.round((totalImplied - 1) * 1000) / 10;
}

// ============================================================
// EV Calculation
// EV% = (decimalOdds × trueProbability - 1) × 100
// Positive = profitable bet over many repetitions.
// ============================================================

/**
 * Calculate Expected Value percentage
 * @param {number} americanOdds - The odds being offered (e.g., -110, +150)
 * @param {number} trueProbability - The "real" chance of winning (0-1)
 * @returns {number|null} EV as a percentage (positive = good bet)
 */
export function calculateEV(americanOdds, trueProbability) {
    if (!trueProbability || trueProbability <= 0 || trueProbability >= 1) return null;
    const decimal = americanToDecimal(americanOdds);
    return (decimal * trueProbability - 1) * 100;
}

// ============================================================
// Kelly Criterion
// Tells you what fraction of bankroll to bet.
// kellyFraction = (b×p - q) / b  where b = decimal odds - 1
// Returns 0 if no edge (never negative).
// ============================================================
export function kellyBet(americanOdds, trueProbability) {
    const b = americanToDecimal(americanOdds) - 1;
    const p = trueProbability;
    const q = 1 - p;
    const kelly = ((b * p) - q) / b;
    return Math.max(0, kelly);
}

// ============================================================
// Positive EV check
// Returns true if bookOdds beat the fair line.
// Higher American odds = better for the bettor.
// ============================================================
export function isPositiveEV(bookOdds, fairOdds) {
    if (bookOdds === null || fairOdds === null) return false;
    return bookOdds > fairOdds;
}

// ============================================================
// Best odds finder
// Scans all bookmakers for the highest price on a specific outcome.
// ============================================================
export function findBestOdds(bookmakers, marketKey, outcomeName) {
    let best = -Infinity;
    let bestBook = null;
    bookmakers?.forEach(book => {
          const market = book.markets?.find(m => m.key === marketKey);
          const outcome = market?.outcomes?.find(o =>
                  outcomeName ? o.name === outcomeName : true
                                                     );
          if (outcome?.price > best) {
                  best = outcome.price;
                  bestBook = book.key;
          }
    });
    return best > -Infinity ? { price: best, book: bestBook } : null;
}

// ============================================================
// Consensus fair odds across all bookmakers for a market
// Removes vig from each book, then averages the fair probabilities.
// Returns fair American odds for each outcome plus the average hold.
// ============================================================
export function getConsensusFairOdds(bookmakers, marketKey) {
    const allOdds = [];
    bookmakers?.forEach(book => {
          const market = book.markets?.find(m => m.key === marketKey);
          if (market?.outcomes?.length >= 2) {
                  allOdds.push(market.outcomes);
          }
    });

  if (allOdds.length === 0) return null;

  const numOutcomes = allOdds[0].length;
    const outcomeNames = allOdds[0].map(o => o.name);
    const outcomePoints = allOdds[0].map(o => o.point);

  // For each position, average the raw implied probs and the raw total
  const rawProbSums = new Array(numOutcomes).fill(0);
    const rawTotalSum = { value: 0, count: 0 };

  allOdds.forEach(outcomes => {
        const rawProbs = outcomes.map(o => americanToImplied(o.price) || 0);
        const rawTotal = rawProbs.reduce((a, b) => a + b, 0);
        rawTotalSum.value += rawTotal;
        rawTotalSum.count += 1;
        rawProbs.forEach((p, i) => {
                rawProbSums[i] += p;
        });
  });

  // Average the raw probs, then remove vig
  const avgRawProbs = rawProbSums.map(s => s / allOdds.length);
    const fairProbs = removeVig(avgRawProbs);
    const fairOdds = fairProbs.map(p => impliedToAmerican(p));
    const avgHold = Math.round(((rawTotalSum.value / rawTotalSum.count) - 1) * 1000) / 10;

  return {
        outcomes: outcomeNames.map((name, i) => ({
                name,
                point: outcomePoints[i],
                fairPrice: fairOdds[i],
                fairProb: fairProbs[i],
        })),
        hold: avgHold,
  };
}

// ============================================================
// Edge Score™ — composite 0-100 rating for how "edgy" a bet is
// Factors: books disagreement on spread/total/moneyline, line history.
// Higher = more potential edge opportunity.
// ============================================================
export function calculateEdgeScore(game, gameLineHistory) {
    let score = 50; // Start at neutral

  if (!game?.bookmakers?.length) return 0;

  const spreads = [];   // Home team spread points from each book
  const totals = [];    // Over/under totals from each book
  const moneylines = []; // Home team moneyline price from each book

  game.bookmakers.forEach(book => {
        book.markets?.forEach(market => {
                if (market.key === 'spreads') {
                          const homeOutcome = market.outcomes?.find(o => o.name === game.home_team);
                          if (homeOutcome?.point != null) spreads.push(homeOutcome.point);
                }
                if (market.key === 'totals') {
                          const overOutcome = market.outcomes?.find(o => o.name === 'Over');
                          if (overOutcome?.point != null) totals.push(overOutcome.point);
                }
                if (market.key === 'h2h') {
                          const homeOutcome = market.outcomes?.find(o => o.name === game.home_team);
                          if (homeOutcome?.price != null) moneylines.push(homeOutcome.price);
                }
        });
  });

  // Spread disagreement: 2+ point range = meaningful edge opportunity
  if (spreads.length >= 2) {
        const spreadRange = Math.max(...spreads) - Math.min(...spreads);
        score += Math.min(spreadRange * 8, 20); // up to +20
  }

  // Total disagreement
  if (totals.length >= 2) {
        const totalRange = Math.max(...totals) - Math.min(...totals);
        score += Math.min(totalRange * 5, 15); // up to +15
  }

  // Moneyline disagreement (bigger range = more edge opportunity)
  if (moneylines.length >= 2) {
        const mlRange = Math.max(...moneylines) - Math.min(...moneylines);
        score += Math.min(mlRange / 10, 15); // up to +15
  }

  // Line movement bonus (more snapshots with changes = active line)
  if (gameLineHistory && gameLineHistory[game.id]) {
        const entries = Object.values(gameLineHistory[game.id]);
        if (entries.length >= 2) {
                // Check if the line actually moved
          const hasMovement = entries.some((e, i) => {
                    if (i === 0) return false;
                    const prev = entries[i - 1];
                    return e.spread !== prev.spread || e.total !== prev.total;
          });
                if (hasMovement) {
                          score += Math.min(entries.length * 3, 15); // up to +15 for active movement
                }
        }
  }

  return Math.min(Math.max(Math.round(score), 0), 100);
}

// Format American odds with + prefix for display
export function formatOdds(odds) {
    if (odds === null || odds === undefined) return '-';
    return odds > 0 ? `+${odds}` : `${odds}`;
}
