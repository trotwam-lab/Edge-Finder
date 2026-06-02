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

function americanOddsCost(odds) {
    if (odds === undefined || odds === null || Number.isNaN(Number(odds))) return null;
    const price = Number(odds);
    return price < 0 ? Math.abs(price) - 100 : 100 - price;
}

function marketLabel(marketKey) {
    if (marketKey === 'h2h') return 'Moneyline';
    if (marketKey === 'spreads') return 'Spread';
    if (marketKey === 'totals') return 'Total';
    return marketKey;
}

function formatOutcomeLabel({ marketKey, outcomeName, point }) {
    if (marketKey === 'h2h') return `${outcomeName} ML`;
    if (marketKey === 'spreads') return `${outcomeName} ${point > 0 ? '+' : ''}${point}`;
    if (marketKey === 'totals') return `${outcomeName} ${point}`;
    return point !== undefined && point !== null ? `${outcomeName} ${point}` : outcomeName;
}

// ============================================================
// Line Shopping Score
// Measures how much price a bettor saves by taking the best book
// instead of the worst available book for the same side/number.
// ============================================================
export function buildLineShoppingOpportunities(bookmakers, marketKeys = ['h2h', 'spreads', 'totals']) {
    const grouped = new Map();

    bookmakers?.forEach(book => {
        book.markets?.forEach(market => {
            if (!marketKeys.includes(market.key)) return;
            market.outcomes?.forEach(outcome => {
                if (outcome?.price === undefined || outcome?.price === null || !outcome?.name) return;
                const pointKey = outcome.point === undefined || outcome.point === null ? 'na' : String(outcome.point);
                const key = `${market.key}::${outcome.name}::${pointKey}`;
                if (!grouped.has(key)) {
                    grouped.set(key, {
                        marketKey: market.key,
                        marketLabel: marketLabel(market.key),
                        outcomeName: outcome.name,
                        point: outcome.point ?? null,
                        prices: [],
                    });
                }
                grouped.get(key).prices.push({
                    book: book.key,
                    bookTitle: book.title || book.key,
                    price: Number(outcome.price),
                    cost: americanOddsCost(outcome.price),
                });
            });
        });
    });

    return Array.from(grouped.values())
        .filter(item => item.prices.length >= 2)
        .map(item => {
            const prices = item.prices.filter(price => price.cost !== null);
            const best = prices.reduce((winner, price) => price.cost < winner.cost ? price : winner, prices[0]);
            const worst = prices.reduce((loser, price) => price.cost > loser.cost ? price : loser, prices[0]);
            const centsSaved = Math.max(0, Math.round((worst.cost - best.cost) * 10) / 10);
            return {
                ...item,
                label: formatOutcomeLabel(item),
                best,
                worst,
                centsSaved,
                bookCount: prices.length,
            };
        })
        .filter(item => item.centsSaved > 0)
        .sort((a, b) => b.centsSaved - a.centsSaved);
}

export function getLineShoppingScore(bookmakers, marketKeys) {
    const opportunities = buildLineShoppingOpportunities(bookmakers, marketKeys);
    const top = opportunities[0] || null;
    const score = top ? Math.min(100, Math.round(top.centsSaved * 4 + Math.min(top.bookCount, 8) * 5)) : 0;
    const label = score >= 80 ? 'HIGH' : score >= 45 ? 'GOOD' : score > 0 ? 'SMALL' : 'NONE';
    return {
        score,
        label,
        top,
        opportunities,
    };
}

function formatLineValue(value) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return '-';
    return `${Number(value) > 0 ? '+' : ''}${value}`;
}

export function getSpreadMoveSignal(game, history = [], openerOverride = null, currentOverride = null) {
    const opener = openerOverride ?? history?.[0]?.spread;
    const current = currentOverride ?? history?.[history.length - 1]?.spread;
    if (opener === undefined || opener === null || current === undefined || current === null) return null;
    const move = Number(current) - Number(opener);
    if (!move) return null;
    const moveAbs = Math.abs(move);
    const team = move < 0 ? game?.home_team : game?.away_team;
    const strength = moveAbs >= 2 ? 'HIGH' : moveAbs >= 1 ? 'MEDIUM' : 'LOW';
    return {
        team,
        move,
        moveAbs,
        strength,
        label: `Market toward ${team}`,
        detail: `${formatLineValue(opener)} → ${formatLineValue(current)}`,
    };
}

function rangeFor(values = []) {
    const nums = values.map(v => Number(v)).filter(v => !Number.isNaN(v));
    if (nums.length < 2) return null;
    return Math.max(...nums) - Math.min(...nums);
}

export function buildMarketDisagreement(game) {
    const opportunities = [];
    const homeSpreads = [];
    const totals = [];
    const moneylines = new Map();

    game?.bookmakers?.forEach(book => {
        const spreadMarket = book.markets?.find(m => m.key === 'spreads');
        const homeSpread = spreadMarket?.outcomes?.find(o => o.name === game.home_team);
        if (homeSpread?.point !== undefined && homeSpread?.point !== null) {
            homeSpreads.push({ book: book.key, bookTitle: book.title || book.key, value: Number(homeSpread.point) });
        }

        const totalMarket = book.markets?.find(m => m.key === 'totals');
        const total = totalMarket?.outcomes?.find(o => o.name === 'Over');
        if (total?.point !== undefined && total?.point !== null) {
            totals.push({ book: book.key, bookTitle: book.title || book.key, value: Number(total.point) });
        }

        const h2hMarket = book.markets?.find(m => m.key === 'h2h');
        h2hMarket?.outcomes?.forEach(outcome => {
            if (outcome?.price === undefined || outcome?.price === null) return;
            if (!moneylines.has(outcome.name)) moneylines.set(outcome.name, []);
            moneylines.get(outcome.name).push({ book: book.key, bookTitle: book.title || book.key, value: Number(outcome.price) });
        });
    });

    const addRangeOpportunity = ({ type, label, unit, rows, mediumAt, highAt }) => {
        const range = rangeFor(rows.map(row => row.value));
        if (!range) return;
        const low = rows.reduce((min, row) => row.value < min.value ? row : min, rows[0]);
        const high = rows.reduce((max, row) => row.value > max.value ? row : max, rows[0]);
        const strength = range >= highAt ? 'HIGH' : range >= mediumAt ? 'MEDIUM' : 'LOW';
        opportunities.push({
            type,
            label,
            unit,
            range: Math.round(range * 10) / 10,
            low,
            high,
            bookCount: rows.length,
            strength,
        });
    };

    addRangeOpportunity({
        type: 'spreads',
        label: `${game?.home_team || 'Home'} spread`,
        unit: 'pts',
        rows: homeSpreads,
        mediumAt: 1,
        highAt: 2,
    });
    addRangeOpportunity({
        type: 'totals',
        label: 'Game total',
        unit: 'pts',
        rows: totals,
        mediumAt: 1.5,
        highAt: 3,
    });
    moneylines.forEach((rows, name) => {
        addRangeOpportunity({
            type: 'h2h',
            label: `${name} moneyline`,
            unit: 'c',
            rows,
            mediumAt: 15,
            highAt: 30,
        });
    });

    opportunities.sort((a, b) => {
        const strengthScore = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return strengthScore[b.strength] - strengthScore[a.strength] || b.range - a.range;
    });

    return {
        top: opportunities[0] || null,
        opportunities,
    };
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
