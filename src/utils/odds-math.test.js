import { describe, expect, it } from 'vitest';
import {
  americanToImplied, impliedToAmerican, americanToDecimal, removeVig,
  calculateFairOdds, calculateHold, calculateEV, kellyBet,
} from './odds-math.js';

describe('odds conversion', () => {
  it('converts American odds to implied probability', () => {
    expect(americanToImplied(-110)).toBeCloseTo(0.5238, 4);
    expect(americanToImplied(150)).toBeCloseTo(0.4, 4);
    expect(americanToImplied(null)).toBeNull();
  });

  it('round-trips probability back to American odds', () => {
    expect(impliedToAmerican(0.5238)).toBe(-110);
    expect(impliedToAmerican(0.4)).toBe(150);
    expect(impliedToAmerican(0)).toBeNull();
    expect(impliedToAmerican(1)).toBeNull();
  });

  it('converts American odds to decimal', () => {
    expect(americanToDecimal(100)).toBe(2);
    expect(americanToDecimal(-200)).toBe(1.5);
  });
});

describe('vig and fair odds', () => {
  it('normalizes probabilities to sum to one', () => {
    const [a, b] = removeVig([0.5238, 0.5238]);
    expect(a + b).toBeCloseTo(1, 10);
    expect(a).toBeCloseTo(0.5, 10);
  });

  it('computes fair odds and hold for a -110/-110 market', () => {
    const fair = calculateFairOdds(-110, -110);
    expect(fair.fair1).toBe(-100);
    expect(fair.hold).toBeCloseTo(4.8, 1);
  });

  it('computes market hold from outcomes', () => {
    expect(calculateHold([{ price: -110 }, { price: -110 }])).toBeCloseTo(4.8, 1);
    expect(calculateHold([{ price: -110 }])).toBeNull();
  });
});

describe('EV and Kelly', () => {
  it('is zero EV at a fair price', () => {
    expect(calculateEV(100, 0.5)).toBeCloseTo(0, 10);
    expect(calculateEV(110, 0.5)).toBeCloseTo(5, 10);
  });

  it('never recommends a negative Kelly stake', () => {
    expect(kellyBet(-110, 0.4)).toBe(0);
    expect(kellyBet(100, 0.55)).toBeCloseTo(0.1, 10);
  });
});
