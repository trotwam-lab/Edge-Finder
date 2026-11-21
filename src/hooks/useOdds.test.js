import { describe, expect, it, vi } from 'vitest';

vi.mock('../firebase.js', () => ({ auth: { currentUser: null } }));

const { dropEndedGames } = await import('./useOdds.js');

const game = (id, sport_key, liveState) => ({ id, sport_key, liveStatus: liveState ? { state: liveState } : null });

describe('dropEndedGames', () => {
  it('drops a refreshed sport\'s games that left the feed (no frozen LIVE games)', () => {
    const prev = [game('nba-1', 'basketball_nba', 'in'), game('nba-2', 'basketball_nba', 'pre'), game('nhl-1', 'icehockey_nhl', 'in')];
    const next = dropEndedGames(prev, new Set(['basketball_nba']), [game('nba-2', 'basketball_nba', 'pre')]);
    expect(next.map(g => g.id)).toEqual(['nba-2', 'nhl-1']); // NHL wasn't refreshed, so it stays
  });

  it('clears a sport whose complete feed is now empty', () => {
    const prev = [game('nba-1', 'basketball_nba', 'in')];
    expect(dropEndedGames(prev, new Set(['basketball_nba']), [])).toEqual([]);
  });

  it('keeps the same array when nothing ended', () => {
    const prev = [game('nba-1', 'basketball_nba', 'pre')];
    expect(dropEndedGames(prev, new Set(['basketball_nba']), prev)).toBe(prev);
    expect(dropEndedGames(prev, new Set(), [])).toBe(prev);
  });
});
