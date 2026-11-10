import { describe, expect, it } from 'vitest';
import { dedupeRankedEdges } from './_edgeRanking.js';

describe('dedupeRankedEdges', () => {
  it('keeps one best-book entry for the same wager', () => {
    const edges = [
      { gameId: 'g1', game: 'A @ B', market: 'h2h', outcomeName: 'A', outcomePoint: null, book: 'Book A', price: 2800, ev: 11 },
      { gameId: 'g1', game: 'A @ B', market: 'h2h', outcomeName: 'A', outcomePoint: null, book: 'Book B', price: 3000, ev: 14 },
      { gameId: 'g1', game: 'A @ B', market: 'spreads', outcomeName: 'A', outcomePoint: 12.5, book: 'Book C', price: -105, ev: 7 },
    ];

    expect(dedupeRankedEdges(edges)).toEqual([
      expect.objectContaining({ book: 'Book B', market: 'h2h', price: 3000 }),
      expect.objectContaining({ book: 'Book C', market: 'spreads', outcomePoint: 12.5 }),
    ]);
  });

  it('keeps distinct alternate lines separate', () => {
    const edges = [
      { gameId: 'g1', market: 'spreads', outcomeName: 'A', outcomePoint: 6.5, price: -110, ev: 5 },
      { gameId: 'g1', market: 'spreads', outcomeName: 'A', outcomePoint: 7.5, price: -110, ev: 4 },
    ];
    expect(dedupeRankedEdges(edges)).toHaveLength(2);
  });
});

