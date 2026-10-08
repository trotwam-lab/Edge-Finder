import { describe, expect, it } from 'vitest';
import { matchTakenEdges } from './receipts.js';

describe('matchTakenEdges', () => {
  const edges = [
    { gameId: 'g1', market: 'spreads', outcomeName: 'Boston Celtics', outcomePoint: -4.5, beatClose: true },
    { gameId: 'g2', market: 'h2h', outcomeName: 'Miami Heat', outcomePoint: null, beatClose: false },
  ];
  it('matches game, market, side and line', () => {
    const bets = [
      { gameId: 'g1', marketKey: 'spreads', outcomeName: 'Boston Celtics', outcomePoint: -4.5 },
      { gameId: 'g2', marketKey: 'h2h', outcomeName: 'Chicago Bulls' },
    ];
    expect(matchTakenEdges(edges, bets)).toEqual([edges[0]]);
  });
  it('ignores a different line, deleted bets and typed-in bets', () => {
    expect(matchTakenEdges(edges, [{ gameId: 'g1', marketKey: 'spreads', outcomeName: 'Boston Celtics', outcomePoint: -5.5 }])).toEqual([]);
    expect(matchTakenEdges(edges, [{ gameId: 'g2', marketKey: 'h2h', outcomeName: 'Miami Heat', deleted: true }])).toEqual([]);
    expect(matchTakenEdges(edges, [{ game: 'Heat', pick: 'Miami Heat ML' }])).toEqual([]);
  });
});
