import { describe, expect, it } from 'vitest';
import { readSharedCache, writeSharedCache, freshestEntry, isFresh } from './_sharedCache.js';

function fakeDb() {
  const store = new Map();
  return {
    store,
    collection: () => ({
      doc: (id) => ({
        get: async () => ({ exists: store.has(id), data: () => store.get(id) }),
        set: async (value) => { store.set(id, value); },
      }),
    }),
  };
}

describe('shared cache', () => {
  it('round-trips a gzipped payload', async () => {
    const db = fakeDb();
    const data = [{ id: 'g1', bookmakers: [{ key: 'fanduel' }] }];
    expect(await writeSharedCache('odds-sgo-30-baseball_mlb', { data, ts: 100, ttl: 30000 }, { db })).toBe(true);
    expect(await readSharedCache('odds-sgo-30-baseball_mlb', { db })).toEqual({ data, ts: 100, ttl: 30000 });
  });

  it('no-ops without an admin database', async () => {
    expect(await readSharedCache('k', { db: null })).toBeNull();
    expect(await writeSharedCache('k', { data: [], ts: 1 }, { db: null })).toBe(false);
  });

  it('prefers the newer of the local and shared entries', async () => {
    const db = fakeDb();
    await writeSharedCache('k', { data: ['shared'], ts: 200 }, { db });
    const local = { k: { data: ['local'], ts: 100 } };
    expect((await freshestEntry(local, 'k', { db })).data).toEqual(['shared']);
    expect(local.k.data).toEqual(['shared']);

    const newerLocal = { k: { data: ['local'], ts: 300 } };
    expect((await freshestEntry(newerLocal, 'k', { db })).data).toEqual(['local']);
  });

  it('swallows database errors', async () => {
    const broken = { collection: () => ({ doc: () => ({ get: async () => { throw new Error('down'); }, set: async () => { throw new Error('down'); } }) }) };
    expect(await readSharedCache('k', { db: broken })).toBeNull();
    expect(await writeSharedCache('k', { data: [], ts: 1 }, { db: broken })).toBe(false);
  });

  it('checks freshness against the entry TTL', () => {
    expect(isFresh({ ts: 1000, ttl: 500 }, 30000, 1400)).toBe(true);
    expect(isFresh({ ts: 1000 }, 300, 1400)).toBe(false);
    expect(isFresh(null, 300)).toBe(false);
  });
});
