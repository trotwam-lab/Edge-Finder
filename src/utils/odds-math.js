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

// Convert American odds to decimal
export function americanToDecimal(odds) {
  if (odds > 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}

// Calculate no-vig fair odds for a two-sided market
// Returns { fair1, fair2, hold } where fair values are American odds
export function calculateFairOdds(odds1, odds2) {
  const p1 = americanToImplied(odds1);
  const p2 = americanToImplied(odds2);
  if (!p1 || !p2) return null;

  const total = p1 + p2; // > 1.0 means overround/vig
  const fairP1 = p1 / total;
  const fairP2 = p2 / total;
  const hold = (total - 1) * 100; // percentage

  return {
    fair1: impliedToAmerican(fairP1),
    fair2: impliedToAmerican(fairP2),
    hold: Math.round(hold * 10) / 10,
    impliedProb1: fairP1,
    impliedProb2: fairP2
  };
}

// Calculate hold/juice for a market (array of outcomes with .price)
export function calculateHold(outcomes) {
  if (!outcomes || outcomes.length < 2) return null;
  const totalImplied = outcomes.reduce((sum, o) => sum + (americanToImplied(o.price) || 0), 0);
  return Math.round((totalImplied - 1) * 1000) / 10;
}

// Check if a book's odds beat the fair line (positive EV)
export function isPositiveEV(bookOdds, fairOdds) {
  if (bookOdds === null || fairOdds === null) return false;
  // Higher American odds = better for bettor
  // For negative odds: -105 > -110 (less juice)
  // For positive odds: +115 > +110 (more payout)
  return bookOdds > fairOdds;
}

// Find best odds across bookmakers for a specific market and outcome
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

// Calculate consensus fair odds across all bookmakers for a market
export function getConsensusFairOdds(bookmakers, marketKey) {
  const allOdds = [];
  
  bookmakers?.forEach(book => {
    const market = book.markets?.find(m => m.key === marketKey);
    if (market?.outcomes?.length >= 2) {
      allOdds.push(market.outcomes);
    }
  });
  
  if (allOdds.length === 0) return null;

  // Average the implied probabilities across books, then derive fair
  const numOutcomes = allOdds[0].length;
  const avgProbs = [];
  const outcomeNames = allOdds[0].map(o => o.name);
  const outcomePoints = allOdds[0].map(o => o.point);

  for (let i = 0; i < numOutcomes; i++) {
    let sum = 0;
    let count = 0;
    allOdds.forEach(outcomes => {
      if (outcomes[i]) {
        const p = americanToImplied(outcomes[i].price);
        if (p) { sum += p; count++; }
      }
    });
    avgProbs.push(count > 0 ? sum / count : 0);
  }

  // Remove vig
  const totalProb = avgProbs.reduce((a, b) => a + b, 0);
  const fairProbs = avgProbs.map(p => p / totalProb);
  const fairOdds = fairProbs.map(p => impliedToAmerican(p));
  const hold = Math.round((totalProb - 1) * 1000) / 10;

  return {
    outcomes: outcomeNames.map((name, i) => ({
      name,
      point: outcomePoints[i],
      fairPrice: fairOdds[i],
      fairProb: fairProbs[i]
    })),
    hold
  };
}

// === EV CALCULATOR FUNCTIONS ===
// EV = Expected Value â tells you if a bet is profitable long-term
// Positive EV (+EV) means you'd make money over many bets at these odds

/**
 * Calculate Expected Value percentage
 * @param {number} americanOdds â The odds being offered (e.g., -110, +150)
 * @param {number} trueProbability â The "real" chance of winning (0 to 1, e.g., 0.55 = 55%)
 * @returns {number} EV as a percentage (positive = good bet, negative = bad bet)
 * 
 * THE MATH:
 * EV = (probability Ã profit) - (1 - probability) Ã stake
 * For a $100 bet at +150 with 45% true probability:
 * EV = (0.45 Ã $150) - (0.55 Ã $100) = $67.50 - $55 = $12.50 = 12.5% EV
 */
export function calculateEV(americanOdds, trueProbability) {
  if (!trueProbability || trueProbability <= 0 || trueProbability >= 1) return null;
  const decimal = americanToDecimal(americanOdds);
  // EV% = (decimal odds Ã true probability) - 1, expressed as percentage
  return ((decimal * trueProbability) - 1) * 100;
}

// Kelly Criterion â tells you what % of your bankroll to bet
// edge = your estimated probability - implied probability
// kellyFraction = (bp - q) / b
// b = decimal odds - 1, p = your probability, q = 1 - p
export function kellyBet(americanOdds, trueProbability) {
  const b = americanToDecimal(americanOdds) - 1;
  const p = trueProbability;
  const q = 1 - p;
  const kelly = ((b * p) - q) / b;
  return Math.max(0, kelly); // never negative (don't bet if no edge)
}

// ============================================================
// Edge Scoreâ¢ â composite rating 1-100 for how "edgy" a bet is
// Factors: line movement, odds disagreement between books, implied value
// Higher = more potential edge
// ============================================================
export function calculateEdgeScore(game, gameLineHistory) {
  let score = 50; // Start at neutral (middle of 0-100 scale)

  // If no bookmakers data, we can't calculate anything
  if (!game?.bookmakers?.length) return 0;

  // Factor 1: Books disagreement (more spread = more edge opportunity)
  // We collect the same market from every book and see how much they differ
  const spreads = [];    // home team spread points from each book
  const totals = [];     // over/under totals from each book
  const moneylines = []; // home team moneyline price from each book

  game.bookmakers.forEach(book => {
    book.markets?.forEach(market => {
      if (market.key === 'spreads') {
        const homeOutcome = market.outcomes?.find(o => o.name === game.home_team);
        if (homeOutcome) spreads.push(homeOutcome.point);
      }
      if (market.key === 'totals') {
        const overOutcome = market.outcomes?.find(o => o.name === 'Over');
        if (overOutcome) totals.push(overOutcome.point);
      }
      if (market.key === 'h2h') {
        const homeOutcome = market.outcomes?.find(o => o.name === game.home_team);
        if (homeOutcome) moneylines.push(homeOutcome.price);
      }
    });
  });

  // Spread disagreement: if books differ by 2+ points, that's interesting
  if (spreads.length >= 2) {
    const spreadRange = Math.max(...spreads) - Math.min(...spreads);
    score += Math.min(spreadRange * 8, 20); // up to +20 points
  }

  // Total disagreement
  if (totals.length >= 2) {
    const totalRange = Math.max(...totals) - Math.min(...totals);
    score += Math.min(totalRange * 5, 15); // up to +15 points
  }

  // Moneyline disagreement (bigger range = more edge)
  if (moneylines.length >= 2) {
    const mlRange = Math.max(...moneylines) - Math.min(...moneylines);
    score += Math.min(mlRange / 10, 15); // up to +15 points
  }

  // Factor 2: Line movement (if we have history)
  // Big movement = something changed = potential edge
  if (gameLineHistory && gameLineHistory[game.id]) {
    const history = gameLineHistory[game.id];
    const entries = Object.values(history);
    if (entries.length >= 2) {
      score += Math.min(entries.length * 3, 15); // more snapshots with changes = +15 max
    }
  }

  // Clamp between 0 and 100
  return Math.min(Math.max(Math.round(score), 0), 100);
}

// Format American odds with + prefix
export function formatOdds(odds) {
  if (odds === null || odds === undefined) return '-';
  return odds > 0 ? `+${odds}` : `${odds}`;
}
