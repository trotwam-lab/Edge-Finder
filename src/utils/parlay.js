// src/utils/parlay.js — parlay pricing and settlement, shared by the server
// (verified ledger) and the browser (tracker). Pure and unit tested.

export const MIN_PARLAY_LEGS = 2;
export const MAX_PARLAY_LEGS = 10;

export function americanToDecimal(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || (n > -100 && n < 100)) return null;
  return n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
}

// Nearest whole American price for a decimal price (> 1).
export function decimalToAmerican(decimal) {
  const d = Number(decimal);
  if (!Number.isFinite(d) || d <= 1) return null;
  return d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
}

// Combined decimal price of independent legs, rounded to 4 places so the
// server and browser agree exactly. Null if any leg price is invalid.
export function combinedDecimal(legOdds) {
  if (!Array.isArray(legOdds) || legOdds.length < MIN_PARLAY_LEGS) return null;
  let product = 1;
  for (const odds of legOdds) {
    const d = americanToDecimal(odds);
    if (!d) return null;
    product *= d;
  }
  return Number(product.toFixed(4));
}

// Standard settlement: any losing leg loses the parlay; a pushed leg drops out
// (its price becomes 1.0); all legs pushed returns the stake. Returns
// { result, effectiveDecimal } or null while any undecided leg could still
// change the outcome.
export function settleParlay(legResults, legOdds) {
  if (!Array.isArray(legResults) || legResults.length !== legOdds?.length) return null;
  if (legResults.some(r => r === 'lost')) return { result: 'lost', effectiveDecimal: null };
  if (legResults.some(r => r !== 'won' && r !== 'push')) return null;
  let effective = 1;
  legResults.forEach((r, i) => { if (r === 'won') effective *= americanToDecimal(legOdds[i]); });
  effective = Number(effective.toFixed(4));
  if (legResults.every(r => r === 'push')) return { result: 'push', effectiveDecimal: 1 };
  return { result: 'won', effectiveDecimal: effective };
}

// Closing value of a parlay: the product of each leg's price times its no-vig
// closing probability, minus one. Null unless every leg has a close.
export function parlayClosingEvPct(legOdds, legFairProbs) {
  if (!legOdds?.length || legOdds.length !== legFairProbs?.length) return null;
  let value = 1;
  for (let i = 0; i < legOdds.length; i += 1) {
    const d = americanToDecimal(legOdds[i]);
    const p = Number(legFairProbs[i]);
    if (!d || !Number.isFinite(p) || p <= 0 || p >= 1) return null;
    value *= d * p;
  }
  return Number(((value - 1) * 100).toFixed(2));
}
