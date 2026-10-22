import { describe, expect, it } from 'vitest';
import { decodeBoard, encodeBoard } from './board-snapshot.js';

// What the old plain-JSON snapshot would have stored, minus the unused
// last_update stamps — the encoding must give back exactly this.
const expected = (games) => JSON.parse(JSON.stringify(games, (key, value) => (key === 'last_update' ? undefined : value)));
const roundTrip = (games) => decodeBoard(JSON.parse(JSON.stringify(encodeBoard(games))));

const game = (overrides = {}) => ({
  id: 'g1', sport_key: 'basketball_nba', sport_title: 'NBA', commence_time: '2026-10-22T23:00:00Z',
  home_team: 'Boston Celtics', away_team: 'New York Knicks',
  bookmakers: [
    { key: 'fanduel', title: 'FanDuel', last_update: '2026-10-22T18:00:00Z', markets: [
      { key: 'h2h', last_update: 'x', outcomes: [{ name: 'Boston Celtics', price: -150 }, { name: 'New York Knicks', price: 130 }] },
      { key: 'spreads', outcomes: [{ name: 'Boston Celtics', price: -110, point: -3.5 }, { name: 'New York Knicks', price: -110, point: 3.5 }] },
      { key: 'totals', outcomes: [{ name: 'Over', price: -105, point: 221.5 }, { name: 'Under', price: -115, point: 0 }] },
    ] },
    { key: 'lowvig', title: 'lowvig', markets: [] },
  ],
  ...overrides,
});

describe('board snapshot encoding', () => {
  it('round-trips a normal game exactly', () => {
    const games = [game()];
    expect(roundTrip(games)).toEqual(expected(games));
  });

  it('keeps live status, scores and any other game fields untouched', () => {
    const games = [game({ completed: false, homeScore: 54, awayScore: 50, scores: [{ name: 'Boston Celtics', score: '54' }],
      liveStatus: { state: 'in', detail: 'Q3 4:21', probables: null }, extraField: { nested: [1, 2] } })];
    expect(roundTrip(games)).toEqual(expected(games));
  });

  it('keeps soccer draws, custom names and unusual outcomes verbatim', () => {
    const games = [game({ home_team: 'Arsenal', away_team: 'Chelsea', bookmakers: [
      { key: 'bovada', title: 'Bovada', markets: [
        { key: 'h2h', outcomes: [{ name: 'Arsenal', price: 120 }, { name: 'Draw', price: 240 }, { name: 'Chelsea', price: 210 }] },
        { key: 'alternate', outcomes: [{ name: 'Arsenal', price: -110, point: null }, { name: 'Over', price: 100, point: 2.5, description: 'Goals' }] },
        { key: 'odd', link: 'https://example.test', outcomes: [{ name: 'Chelsea', price: '115' }] },
      ] },
      { key: 'weird', title: 'Weird', sid: 7, markets: [{ key: 'h2h', outcomes: [{ name: 'Arsenal', price: 101 }] }] },
    ] })];
    expect(roundTrip(games)).toEqual(expected(games));
  });

  it('handles games without bookmakers', () => {
    const games = [{ id: 'g2', home_team: 'A', away_team: 'B' }, { id: 'g3', bookmakers: null }];
    expect(roundTrip(games)).toEqual(expected(games));
  });

  it('shrinks a full board well under the snapshot cap', () => {
    const books = ['fanduel', 'draftkings', 'betmgm', 'caesars', 'betonlineag', 'bovada', 'betrivers', 'fanatics', 'lowvig', 'mybookieag', 'williamhill_us', 'espnbet'];
    const board = Array.from({ length: 950 }, (_, i) => game({ id: `g${i}`, home_team: `Home Team ${i}`, away_team: `Away Team ${i}`,
      bookmakers: books.map(key => ({ key, title: key, last_update: '2026-10-22T18:00:00Z', markets: [
        { key: 'h2h', last_update: '2026-10-22T18:00:00Z', outcomes: [{ name: `Home Team ${i}`, price: -150 }, { name: `Away Team ${i}`, price: 130 }] },
        { key: 'spreads', last_update: '2026-10-22T18:00:00Z', outcomes: [{ name: `Home Team ${i}`, price: -110, point: -3.5 }, { name: `Away Team ${i}`, price: -110, point: 3.5 }] },
        { key: 'totals', last_update: '2026-10-22T18:00:00Z', outcomes: [{ name: 'Over', price: -110, point: 221.5 }, { name: 'Under', price: -110, point: 221.5 }] },
      ] })) }));
    const plain = JSON.stringify(board).length;
    const compact = JSON.stringify(encodeBoard(board)).length;
    expect(compact).toBeLessThan(3 * 1024 * 1024);
    expect(compact / plain).toBeLessThan(0.4);
    expect(roundTrip(board)).toEqual(expected(board));
  });
});
