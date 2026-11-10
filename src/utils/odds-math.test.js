import { describe, expect, it } from 'vitest';
import {
  americanToImplied, impliedToAmerican, americanToDecimal, removeVig,
  calculateFairOdds, calculateHold, calculateEV, kellyBet,
  buildLineShoppingOpportunities,
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

describe('line shopping value', () => {
  it('measures extra payout cents per dollar instead of subtracting American odds', () => {
    const opportunities = buildLineShoppingOpportunities([
      { key: 'a', title: 'Book A', markets: [{ key: 'h2h', outcomes: [{ name: 'Favorite', price: -3964 }] }] },
      { key: 'b', title: 'Book B', markets: [{ key: 'h2h', outcomes: [{ name: 'Favorite', price: -100000 }] }] },
    ]);

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0].best.price).toBe(-3964);
    expect(opportunities[0].worst.price).toBe(-100000);
    expect(opportunities[0].centsSaved).toBeCloseTo(2.4, 1);
  });

  it('selects the higher payout on both sides of even money', () => {
    const opportunities = buildLineShoppingOpportunities([
      { key: 'a', title: 'Book A', markets: [{ key: 'h2h', outcomes: [{ name: 'Team', price: -120 }, { name: 'Dog', price: 140 }] }] },
      { key: 'b', title: 'Book B', markets: [{ key: 'h2h', outcomes: [{ name: 'Team', price: -110 }, { name: 'Dog', price: 155 }] }] },
    ]);

    const favorite = opportunities.find(item => item.outcomeName === 'Team');
    const dog = opportunities.find(item => item.outcomeName === 'Dog');
    expect(favorite.best.price).toBe(-110);
    expect(favorite.centsSaved).toBeCloseTo(7.6, 1);
    expect(dog.best.price).toBe(155);
    expect(dog.centsSaved).toBe(15);
  });
});
