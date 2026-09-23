import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  toLocalDateStr, parseBetDate, calculateCLV, getPointCLV, getTimingValue,
  gradeTiming, getRelativeDate, getBetSport, settleProfit,
} from './bets.js';

afterEach(() => vi.useRealTimers());

describe('bet calendar days', () => {
  it('uses the local day, not the UTC day, for a US evening', () => {
    // 10:30pm Eastern on Sep 22 is already Sep 23 in UTC.
    expect(toLocalDateStr(new Date('2026-09-23T02:30:00Z'))).toBe('2026-09-22');
  });

  it('parses bare YYYY-MM-DD strings as local midnight', () => {
    const d = parseBetDate('2026-09-22');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 22, 0]);
    expect(toLocalDateStr('2026-09-22')).toBe('2026-09-22');
  });

  it('labels a bet placed today as TODAY', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-22T15:00:00-04:00'));
    expect(getRelativeDate('2026-09-22')).toBe('TODAY');
    expect(getRelativeDate('2026-09-21')).toBe('YESTERDAY');
  });
});

describe('closing line value', () => {
  it('is positive when the bet beat the closing price', () => {
    expect(calculateCLV(-105, -120)).toBeGreaterThan(0);
    expect(calculateCLV(-120, -105)).toBeLessThan(0);
    expect(calculateCLV(null, -110)).toBeNull();
  });

  it('measures spread and total CLV in points from the bettor\'s side', () => {
    expect(getPointCLV({ type: 'Spread', betPoint: 3.5, closingPoint: 2.5 })).toBe(1);
    expect(getPointCLV({ type: 'Total', outcomeName: 'Over', betPoint: 47.5, closingPoint: 49 })).toBe(1.5);
    expect(getPointCLV({ type: 'Total', outcomeName: 'Under', betPoint: 47.5, closingPoint: 49 })).toBe(-1.5);
    expect(getPointCLV({ type: 'Player Prop', outcomeName: 'Over', outcomePoint: 24.5, closingPoint: 25.5 })).toBe(1);
  });

  it('prefers point CLV over price CLV', () => {
    expect(getTimingValue({ type: 'Spread', betPoint: -3, closingPoint: -4, odds: -110, closingOdds: -110 })).toEqual({ type: 'point', value: 1 });
    expect(getTimingValue({ odds: -110, closingOdds: -130 }).type).toBe('price');
    expect(getTimingValue({})).toBeNull();
  });

  it('grades timing bands', () => {
    expect(gradeTiming(3.2).label).toBe('Sharp');
    expect(gradeTiming(0).label).toBe('Neutral');
    expect(gradeTiming(-5).label).toBe('Chased');
    expect(gradeTiming(null).label).toBe('—');
  });
});

describe('settlement and sport detection', () => {
  it('pays winners at the American price and returns pushes', () => {
    expect(settleProfit({ wager: 100, odds: 150 }, 'won')).toBe(150);
    expect(settleProfit({ wager: 110, odds: -110 }, 'won')).toBe(100);
    expect(settleProfit({ wager: 50, odds: -110 }, 'lost')).toBe(-50);
    expect(settleProfit({ wager: 50, odds: -110 }, 'push')).toBe(0);
  });

  it('reads the sport from the stored sport key', () => {
    expect(getBetSport({ sportKey: 'americanfootball_ncaaf' })).toBe('NCAAF');
    expect(getBetSport({ sportKey: 'mma_mixed_martial_arts' })).toBe('UFC');
    expect(getBetSport({ game: 'Yankees @ Red Sox' })).toBe('MLB');
    expect(getBetSport({ game: 'Unknown FC' })).toBe('Other');
  });
});
