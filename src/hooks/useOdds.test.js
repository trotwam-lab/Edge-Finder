import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase.js', () => ({ auth: { currentUser: null } }));
const { needsScores, pruneSnapshotGames } = await import('./useOdds.js');

describe('needsScores', () => {
  const now = Date.parse('2026-10-22T18:00:00Z');
  it('skips the scores call while every game is still upcoming', () => {
    expect(needsScores([{ commence_time: '2026-10-22T23:00:00Z' }], now)).toBe(false);
  });
  it('asks for scores once any game has started', () => {
    expect(needsScores([{ commence_time: '2026-10-22T23:00:00Z' }, { commence_time: '2026-10-22T17:00:00Z' }], now)).toBe(true);
  });
});

describe('pruneSnapshotGames', () => {
  const games = [
    { id: 'live-1', sport_key: 'nba' },     // live data, never touched
    { id: 'saved-nba', sport_key: 'nba' },  // saved, sport loaded, gone from feed
    { id: 'saved-nhl', sport_key: 'nhl' },  // saved, sport failed to load
    { id: 'saved-old', sport_key: 'cfl' },  // saved, sport no longer on the board
  ];
  const placeholders = new Map([['saved-nba', 'nba'], ['saved-nhl', 'nhl'], ['saved-old', 'cfl']]);

  it('drops stale saved games, keeps a failed sport until it loads, never touches live games', () => {
    const kept = pruneSnapshotGames(games, {
      placeholders,
      liveIds: new Set(['live-1']),
      loadedKeys: new Set(['nba']),
      attemptedKeys: new Set(['nba', 'nhl']),
    });
    expect(kept.map(g => g.id)).toEqual(['live-1', 'saved-nhl']);
  });

  it('keeps a saved game the feed still lists', () => {
    const kept = pruneSnapshotGames([{ id: 'saved-nba', sport_key: 'nba' }], {
      placeholders,
      liveIds: new Set(['saved-nba']),
      loadedKeys: new Set(['nba']),
      attemptedKeys: new Set(['nba']),
    });
    expect(kept).toHaveLength(1);
  });
});
