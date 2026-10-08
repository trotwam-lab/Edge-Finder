import { describe, expect, it } from 'vitest';
import {
  bankrollSeries, betMarketType, betsToCsv, breakdown, findDuplicate, oddsBucket, timingBucket, betBook,
} from './insights.js';
import { detectLeague } from './teams.js';

const bet = (over) => ({ id: 1, status: 'won', wager: 100, profit: 90.91, odds: -110, date: '2026-10-01', settledDate: '2026-10-01', ...over });

describe('grouping helpers', () => {
  it('classifies markets, books, prices and timing', () => {
    expect(betMarketType({ marketKey: 'spreads' })).toBe('Spread');
    expect(betMarketType({ type: 'Parlay', legs: [] })).toBe('Parlay');
    expect(betMarketType({ marketKey: 'player_points' })).toBe('Player prop');
    expect(betMarketType({ type: 'Moneyline' })).toBe('Moneyline');
    expect(betBook({ bookKey: 'fanduel' })).toBe('fanduel');
    expect(betBook({})).toBe('Not recorded');
    expect([-250, -150, -110, 150, 300, 50].map(odds => oddsBucket({ odds }))).toEqual([
      '-200 or shorter', '-199 to -120', '-119 to +119', '+120 to +199', '+200 or longer', 'Unknown',
    ]);
    const start = Date.parse('2026-10-08T23:00:00Z');
    expect(timingBucket({ id: start - 30 * 3600e3, commenceTime: '2026-10-08T23:00:00Z' })).toBe('24h+ before');
    expect(timingBucket({ id: start - 30 * 60e3, commenceTime: '2026-10-08T23:00:00Z' })).toBe('Under 1h before');
    expect(timingBucket({ id: 5, commenceTime: '2026-10-08T23:00:00Z' })).toBe('Unknown'); // not a timestamp
    expect(timingBucket({ id: start + 1000, commenceTime: '2026-10-08T23:00:00Z' })).toBe('Unknown'); // logged after start
  });

  it('breaks results down with ROI on stakes, ignoring deleted bets', () => {
    const rows = breakdown([
      bet({ book: 'DK' }),
      bet({ book: 'DK', status: 'lost', profit: -100 }),
      bet({ book: 'FD', status: 'pending', profit: null }),
      bet({ book: 'FD', deleted: true }),
    ], betBook);
    expect(rows).toEqual([
      expect.objectContaining({ key: 'DK', bets: 2, settled: 2, record: '1-1-0', winPct: 50, profit: -9.09, roi: -4.5 }),
      expect.objectContaining({ key: 'FD', bets: 1, settled: 0, roi: null }),
    ]);
  });
});

describe('bankrollSeries', () => {
  it('tracks the balance and the deepest drawdown in settlement order', () => {
    const series = bankrollSeries([
      bet({ id: 3, profit: -300, status: 'lost', settledDate: '2026-10-03' }),
      bet({ id: 1, profit: 200, settledDate: '2026-10-01' }),
      bet({ id: 2, profit: 100, settledDate: '2026-10-02' }),
      bet({ id: 4, profit: 50, settledDate: '2026-10-04' }),
      bet({ id: 5, status: 'pending', profit: null }),
    ], 1000);
    expect(series.points.map(p => p.balance)).toEqual([1000, 1200, 1300, 1000, 1050]);
    expect(series.maxDrawdown).toMatchObject({ amount: 300, pct: 23.1, fromIndex: 2, toIndex: 3 });
    expect(series).toMatchObject({ final: 1050, peak: 1300, currentDrawdown: 250 });
  });
});

describe('findDuplicate', () => {
  it('matches the same game, pick, price and date regardless of spacing/case', () => {
    const existing = [bet({ game: 'Lakers vs Celtics', pick: 'Lakers -3.5', odds: -110, date: '2026-10-01' })];
    expect(findDuplicate(existing, { game: 'lakers  vs celtics', pick: 'LAKERS -3.5', odds: '-110', date: '2026-10-01' })).toBeTruthy();
    expect(findDuplicate(existing, { game: 'Lakers vs Celtics', pick: 'Lakers -3.5', odds: -115, date: '2026-10-01' })).toBeNull();
    expect(findDuplicate([{ ...existing[0], deleted: true }], { ...existing[0] })).toBeNull();
  });
});

describe('betsToCsv', () => {
  it('escapes quotes and neutralises spreadsheet formulas, keeping numbers', () => {
    const csv = betsToCsv([bet({ game: '=HYPERLINK("x")', pick: 'Over 220.5, live', odds: -110 })]);
    const [header, row] = csv.split('\r\n');
    expect(header.startsWith('Date,Game,Type,Pick,Odds,Stake')).toBe(true);
    expect(row).toContain('"\'=HYPERLINK(""x"")"');
    expect(row).toContain('"Over 220.5, live"');
    expect(row).toContain(',-110,');
  });
});

describe('detectLeague', () => {
  it('finds the league from team names, never guessing on shared nicknames', () => {
    expect(detectLeague('Lakers vs Celtics')).toBe('NBA');
    expect(detectLeague('Chiefs @ Eagles')).toBe('NFL');
    expect(detectLeague('Red Sox vs Yankees')).toBe('MLB');
    expect(detectLeague('Maple Leafs at Bruins')).toBe('NHL');
    expect(detectLeague('Kings vs Rangers')).toBe('Other'); // NBA/NHL/MLB nicknames
    expect(detectLeague('Los Angeles Kings vs New York Rangers')).toBe('NHL');
    expect(detectLeague('Texas Rangers vs Houston Astros')).toBe('MLB');
    expect(detectLeague('UFC 310 main event')).toBe('UFC');
    expect(detectLeague('Miami Heat vs Lakers')).toBe('NBA');
    expect(detectLeague('feeling the heat tonight')).toBe('Other');
    expect(detectLeague('New York Liberty vs Las Vegas Aces')).toBe('WNBA');
  });
});
