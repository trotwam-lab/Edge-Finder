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

describe('findLiveQuote for player props', () => {
  const props = [
    { gameId: 'g1', player: 'Josh Allen', market: 'passing_yards', outcome: 'Over', line: 245.5, price: -115, book: 'Fanduel', bookKey: 'fanduel' },
    { gameId: 'g1', player: 'Josh Allen', market: 'passing_yards', outcome: 'Over', line: 249.5, price: -110, book: 'Draftkings', bookKey: 'draftkings' },
    { gameId: 'g1', player: 'Josh Allen', market: 'passing_yards', outcome: 'Under', line: 249.5, price: -110, book: 'Draftkings', bookKey: 'draftkings' },
  ];
  const bet = { type: 'Player Prop', gameId: 'g1', player: 'Josh Allen', marketKey: 'passing_yards', outcomeName: 'Over', outcomePoint: 245.5 };

  it('reads the prop from the props feed at the bet\'s book', () => {
    expect(findLiveQuote(games, { ...bet, book: 'DraftKings' }, props)).toMatchObject({ price: -110, point: 249.5 });
    expect(findLiveQuote(games, { ...bet, book: 'FanDuel' }, props)).toMatchObject({ price: -115, point: 245.5 });
  });

  it('prefers the line that was bet when the book has several', () => {
    expect(findLiveQuote(games, bet, props)).toMatchObject({ point: 245.5 });
  });

  it('returns null when the prop is gone', () => {
    expect(findLiveQuote(games, { ...bet, player: 'Someone Else' }, props)).toBeNull();
    expect(findLiveQuote(games, bet, [])).toBeNull();
  });
});
