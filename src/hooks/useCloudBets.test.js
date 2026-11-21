import { describe, expect, it, vi } from 'vitest';

vi.mock('../firestore.js', () => ({ db: {} }));
vi.mock('../AuthGate.jsx', () => ({ useAuth: () => ({ user: null }) }));

const { mergeInto, sameBets, unionBets } = await import('./useCloudBets.js');

const bet = (id, over = {}) => ({ id, game: 'A vs B', pick: `pick ${id}`, odds: -110, wager: 10, status: 'pending', ...over });

describe('useCloudBets merge helpers', () => {
  it('treats Firestore key order as the same data', () => {
    // Firestore returns map keys sorted; the local copy keeps insertion order.
    const local = [{ id: 1, wager: 10, game: 'A vs B' }];
    const fromCloud = [{ game: 'A vs B', id: 1, wager: 10 }];
    expect(sameBets(local, fromCloud)).toBe(true);
    expect(sameBets(local, [{ ...local[0], wager: 11 }])).toBe(false);
  });

  it('keeps the current array when a cloud copy adds nothing', () => {
    // A fresh-but-identical array re-ran the save effect, and the save's own
    // snapshot echo then looked like new data: a Firestore write every 1.5s.
    const prev = [bet(2), bet(1)];
    const echo = JSON.parse(JSON.stringify(prev)).map(b => Object.fromEntries(Object.entries(b).sort()));
    expect(mergeInto(prev, echo)).toBe(prev);
    expect(mergeInto(prev, [])).toBe(prev);
  });

  it('returns a merged array when another copy has news', () => {
    const prev = [bet(1)];
    const next = mergeInto(prev, [bet(2), bet(1)]);
    expect(next).not.toBe(prev);
    expect(next.map(b => b.id)).toEqual([2, 1]);
    const settled = mergeInto(prev, [bet(1, { status: 'won', updatedAt: Date.now() })]);
    expect(settled[0].status).toBe('won');
  });

  it('still never drops a known bet', () => {
    expect(unionBets([bet(1)], [bet(2)], null).map(b => b.id)).toEqual([2, 1]);
  });
});
