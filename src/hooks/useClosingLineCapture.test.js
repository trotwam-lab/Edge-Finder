import { describe, expect, it } from 'vitest';
import { findLiveQuote } from './useClosingLineCapture.js';

const games = [{
  id: 'g1',
  bookmakers: [
    { key: 'fanduel', title: 'FanDuel', markets: [{ key: 'h2h', outcomes: [{ name: 'Bills', price: -150 }] }] },
    { key: 'draftkings', title: 'DraftKings', markets: [
      { key: 'h2h', outcomes: [{ name: 'Bills', price: -160 }] },
      { key: 'team_totals', outcomes: [{ name: 'Bills', side: 'over', point: 24.5, price: -110 }, { name: 'Bills', side: 'under', point: 24.5, price: -115 }] },
    ] },
  ],
}];

describe('findLiveQuote', () => {
  it('reads the close from the book the bet was placed at', () => {
    expect(findLiveQuote(games, { gameId: 'g1', marketKey: 'h2h', outcomeName: 'Bills', bookKey: 'draftkings' }).price).toBe(-160);
    expect(findLiveQuote(games, { gameId: 'g1', marketKey: 'h2h', outcomeName: 'Bills', book: 'DraftKings' }).price).toBe(-160);
  });

  it('falls back to the first book when the bet has none', () => {
    expect(findLiveQuote(games, { gameId: 'g1', marketKey: 'h2h', outcomeName: 'Bills' }).price).toBe(-150);
  });

  it('matches the over/under side for team totals', () => {
    const quote = findLiveQuote(games, { gameId: 'g1', marketKey: 'team_totals', outcomeName: 'Bills', outcomeSide: 'under', bookKey: 'draftkings' });
    expect(quote).toMatchObject({ price: -115, point: 24.5 });
  });

  it('returns null for unknown games or markets', () => {
    expect(findLiveQuote(games, { gameId: 'nope', marketKey: 'h2h', outcomeName: 'Bills' })).toBeNull();
    expect(findLiveQuote(games, { gameId: 'g1', marketKey: 'spreads', outcomeName: 'Bills' })).toBeNull();
  });
});
