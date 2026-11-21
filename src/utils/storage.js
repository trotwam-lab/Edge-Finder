// src/utils/storage.js
// localStorage can throw (Safari private mode, a full quota, blocked site
// data), so every access goes through these helpers.

// The user's own records — never removed by "reset" actions. Bets are stored
// per account as `<key>:<uid>` (see useCloudBets), which is covered too.
export const PROTECTED_KEYS = [
  'edgefinder_bets',
  'edgefinder_bets_archive',
  'edgefinder_bets_snapshot_date',
  'edgefinder_bankroll_settings',
];

export function isProtectedKey(key) {
  return PROTECTED_KEYS.some(p => key === p || key.startsWith(`${p}:`));
}

function store(storage) {
  if (storage) return storage;
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readJSON(key, fallback = null, storage) {
  try {
    const raw = store(storage)?.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value, storage) {
  try {
    store(storage)?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key, storage) {
  try {
    store(storage)?.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// Removes EdgeFinder's cached app data (line history, openers, settings,
// alerts) but keeps PROTECTED_KEYS. Returns the keys it removed.
export function clearCachedData(storage) {
  const target = store(storage);
  if (!target) return [];
  const removed = [];
  try {
    const keys = [];
    for (let i = 0; i < target.length; i += 1) keys.push(target.key(i));
    keys.forEach(key => {
      if (!key || !key.startsWith('edgefinder_') || isProtectedKey(key)) return;
      target.removeItem(key);
      removed.push(key);
    });
  } catch {}
  return removed;
}
