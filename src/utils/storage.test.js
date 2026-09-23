import { describe, expect, it } from 'vitest';
import { clearCachedData, readJSON, writeJSON, PROTECTED_KEYS } from './storage.js';

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    map,
  };
}

describe('storage helpers', () => {
  it('reset keeps bets and bankroll but clears cached app data', () => {
    const s = memoryStorage({
      edgefinder_bets: '[1]', edgefinder_bets_archive: '[1]', edgefinder_bankroll_settings: '{}',
      edgefinder_game_lines: '{}', edgefinder_alerts: '[]', other_app_key: 'x',
    });
    const removed = clearCachedData(s);
    expect(removed.sort()).toEqual(['edgefinder_alerts', 'edgefinder_game_lines']);
    PROTECTED_KEYS.filter(k => k !== 'edgefinder_bets_snapshot_date').forEach(k => expect(s.getItem(k)).not.toBeNull());
    expect(s.getItem('other_app_key')).toBe('x');
  });

  it('survives storage that throws', () => {
    const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }, get length() { throw new Error('x'); } };
    expect(readJSON('k', 'fallback', broken)).toBe('fallback');
    expect(writeJSON('k', 1, broken)).toBe(false);
    expect(clearCachedData(broken)).toEqual([]);
  });

  it('round-trips JSON and falls back on bad data', () => {
    const s = memoryStorage({ bad: '{nope' });
    expect(writeJSON('k', { a: 1 }, s)).toBe(true);
    expect(readJSON('k', null, s)).toEqual({ a: 1 });
    expect(readJSON('bad', 'fb', s)).toBe('fb');
  });
});
