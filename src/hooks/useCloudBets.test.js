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

describe('per-account bet storage', () => {
  function installStorage(initial = {}) {
    const map = new Map(Object.entries(initial));
    globalThis.localStorage = {
      get length() { return map.size; },
      key: (i) => Array.from(map.keys())[i] ?? null,
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, String(v)); },
      removeItem: (k) => { map.delete(k); },
    };
    return map;
  }
  const read = (map, k) => JSON.parse(map.get(k) || 'null');

  it('moves device-wide bets to the first account that signs in, then removes them', async () => {
    const { claimLegacyBets, betStorageKeys } = await import('./useCloudBets.js');
    const map = installStorage({
      edgefinder_bets: JSON.stringify([bet(2)]),
      edgefinder_bets_archive: JSON.stringify([bet(1), bet(2)]),
      edgefinder_bets_snapshot_date: '2026-11-20',
    });
    const claimed = claimLegacyBets('edgefinder_bets', 'uidA');
    expect(claimed.map(b => b.id)).toEqual([2, 1]);
    const keys = betStorageKeys('edgefinder_bets', 'uidA');
    expect(read(map, keys.live).map(b => b.id)).toEqual([2]);
    expect(read(map, keys.archive).map(b => b.id)).toEqual([2, 1]);
    expect(map.get(keys.snapshotDate)).toBe('2026-11-20');
    expect(map.has('edgefinder_bets')).toBe(false);
    expect(map.has('edgefinder_bets_archive')).toBe(false);
    // The next account on this device gets nothing.
    expect(claimLegacyBets('edgefinder_bets', 'uidB')).toEqual([]);
    expect(map.has(betStorageKeys('edgefinder_bets', 'uidB').live)).toBe(false);
  });

  it('keeps the old keys when the new ones cannot be written', async () => {
    const { claimLegacyBets } = await import('./useCloudBets.js');
    const map = installStorage({ edgefinder_bets: JSON.stringify([bet(1)]) });
    globalThis.localStorage.setItem = () => { throw new Error('quota'); };
    expect(claimLegacyBets('edgefinder_bets', 'uidA').map(b => b.id)).toEqual([1]);
    expect(map.has('edgefinder_bets')).toBe(true);
  });

  it('recovery scan ignores other accounts on the same device', async () => {
    const { scanLocalStorageForBets } = await import('./useCloudBets.js');
    installStorage({
      'edgefinder_bets:uidAAAA': JSON.stringify([bet(1)]),
      'edgefinder_bets_archive:uidAAAA': JSON.stringify([bet(2)]),
      'edgefinder_bets:uidBBBB': JSON.stringify([bet(3)]),
    });
    expect(scanLocalStorageForBets('uidAAAA').map(b => b.id)).toEqual([2, 1]);
    expect(scanLocalStorageForBets('uidBBBB').map(b => b.id)).toEqual([3]);
  });
});
