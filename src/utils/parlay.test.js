import { describe, expect, it } from 'vitest';
import { combinedDecimal, decimalToAmerican, parlayClosingEvPct, settleParlay } from './parlay.js';

describe('parlay pricing', () => {
  it('multiplies leg prices', () => {
    expect(combinedDecimal([-110, -110])).toBeCloseTo(3.6446, 4);
    expect(decimalToAmerican(combinedDecimal([-110, -110]))).toBe(264);
    expect(combinedDecimal([150, -200])).toBe(3.75);
    expect(decimalToAmerican(1.5)).toBe(-200);
  });

  it('rejects invalid or single-leg parlays', () => {
    expect(combinedDecimal([-110])).toBeNull();
    expect(combinedDecimal([-110, 50])).toBeNull();
    expect(decimalToAmerican(1)).toBeNull();
  });
});

describe('settleParlay', () => {
  const odds = [-110, 150, 100];
  it('loses as soon as any leg loses, even with legs still pending', () => {
    expect(settleParlay(['won', 'lost', null], odds)).toEqual({ result: 'lost', effectiveDecimal: null });
  });
  it('waits while an undecided leg could change the result', () => {
    expect(settleParlay(['won', 'won', null], odds)).toBeNull();
  });
  it('drops pushed legs from the price', () => {
    expect(settleParlay(['won', 'push', 'won'], odds)).toEqual({ result: 'won', effectiveDecimal: Number((1.9091 * 2).toFixed(4)) });
    expect(settleParlay(['push', 'push', 'push'], odds)).toEqual({ result: 'push', effectiveDecimal: 1 });
  });
  it('pays the full price when every leg wins', () => {
    expect(settleParlay(['won', 'won', 'won'], odds).effectiveDecimal).toBeCloseTo(combinedDecimal(odds), 3);
  });
});

describe('parlayClosingEvPct', () => {
  it('needs a close on every leg', () => {
    expect(parlayClosingEvPct([100, 100], [0.55, 0.55])).toBeCloseTo(21, 2);
    expect(parlayClosingEvPct([100, 100], [0.55, null])).toBeNull();
  });
});
