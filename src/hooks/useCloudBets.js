import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { doc, getDoc, getDocs, setDoc, onSnapshot, collection, runTransaction } from 'firebase/firestore';
import { db } from '../firestore.js';
import { useAuth } from '../AuthGate.jsx';
import { canonicalJson } from '../utils/ledger.js';

const SAVE_DEBOUNCE_MS = 1500;
const RETRY_MIN_MS = 5000;
const RETRY_MAX_MS = 60000;
const ARCHIVE_LIMIT = 500;

/**
 * useCloudBets - A hook that syncs bets to Firebase Firestore while keeping localStorage as a fast cache.
 *
 * 1. On mount: loads bets from Firestore doc at users/{userId}/data/bets and
 *    merges them with this device's copy for the same account.
 * 2. When bets change: saves to localStorage at once and to Firestore shortly
 *    after. A cloud save reads the cloud copy and writes the UNION, so a
 *    device with a stale list can never wipe out bets another device added.
 * 3. Each account's bets have their own keys on this device, so whoever signs
 *    in next on a shared browser never inherits them.
 *
 * Usage: const [bets, setBets] = useCloudBets('edgefinder_bets', []);
 */

// This device's storage for one account: the live list, an append-only
// archive of every bet ever seen here (so a bad cloud snapshot or a race can
// never make a bet disappear from the device), and the daily-backup date.
export function betStorageKeys(key, uid) {
  return {
    live: `${key}:${uid}`,
    archive: `${key}_archive:${uid}`,
    snapshotDate: `${key}_snapshot_date:${uid}`,
  };
}

// Before bets were stored per account they lived under these bare keys.
const legacyStorageKeys = (key) => ({ live: key, archive: `${key}_archive`, snapshotDate: `${key}_snapshot_date` });

function readList(storageKey, fallback = []) {
  try {
    const saved = localStorage.getItem(storageKey);
    const parsed = saved ? JSON.parse(saved) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeList(storageKey, bets) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(bets));
  } catch (err) {
    console.error('Error saving to localStorage:', err);
  }
}

/**
 * Move bets saved under the old, device-wide keys to this account's keys.
 * Those bets used to be merged into whichever account signed in, so the
 * first account to sign in after this change claims them (in practice the
 * account that was already signed in on this device); the bare keys are then
 * removed so no later account can pick them up. Nothing is dropped: the old
 * keys are only removed once their bets are written under the new ones.
 * Returns the bets found under the old keys.
 */
export function claimLegacyBets(key, uid) {
  if (!uid) return [];
  const legacy = legacyStorageKeys(key);
  const live = readList(legacy.live);
  const archive = readList(legacy.archive);
  let snapshotDate = null;
  try { snapshotDate = localStorage.getItem(legacy.snapshotDate); } catch {}
  if (!live.length && !archive.length && snapshotDate == null) return [];
  const mine = betStorageKeys(key, uid);
  try {
    localStorage.setItem(mine.live, JSON.stringify(unionBets(readList(mine.live), live)));
    localStorage.setItem(mine.archive, JSON.stringify(unionBets(readList(mine.archive), archive, live).slice(0, ARCHIVE_LIMIT)));
    if (snapshotDate && !localStorage.getItem(mine.snapshotDate)) localStorage.setItem(mine.snapshotDate, snapshotDate);
    localStorage.removeItem(legacy.live);
    localStorage.removeItem(legacy.archive);
    localStorage.removeItem(legacy.snapshotDate);
  } catch (err) {
    // Storage full or blocked: leave the old keys alone. The caller still
    // shows (and cloud-saves) what was found, and the next load tries again.
    console.error('Could not move saved bets to this account:', err);
  }
  return unionBets(live, archive);
}

// Everything this device holds for one account (claiming old shared-key bets
// on the way). Without an account, nothing is read.
function loadLocalBets(key, uid, fallback) {
  if (!uid) return fallback;
  const legacy = claimLegacyBets(key, uid);
  const keys = betStorageKeys(key, uid);
  return unionBets(readList(keys.archive), readList(keys.live, fallback), legacy);
}

// Prefer the "most complete" version of a bet when the same id appears twice:
// pick the one with more filled-in fields and a later settled/updated date.
function mergePair(a, b) {
  if (!a) return b;
  if (!b) return a;
  const out = { ...a };
  // Determine which record is "newer" so differing values can actually update.
  // updatedAt (epoch ms, stamped on every edit) is the primary signal; without
  // it two pending copies of the same bet tie and the FIRST list wins any
  // conflict — which is how a stale archive/cloud copy used to silently revert
  // a manually corrected closing line on the next reload. settledDate remains
  // as a fallback for records written before updatedAt existed, then id
  // (Date.now() at creation) for a deterministic order.
  const aTime = Math.max(a.updatedAt || 0, Date.parse(a.settledDate || '') || 0);
  const bTime = Math.max(b.updatedAt || 0, Date.parse(b.settledDate || '') || 0);
  const bIsNewer = bTime !== aTime ? bTime > aTime : (b.id || 0) > (a.id || 0);
  Object.keys(b).forEach(k => {
    const bv = b[k];
    const av = out[k];
    if (bv == null) return;
    if (av == null) { out[k] = bv; return; }
    if (bv === av) return;
    // Values differ. For status, prefer a settled value over pending so a
    // stale archive entry can never shadow an updated live entry (this is
    // the core fix for the "settled bets revert to pending" bug).
    if (k === 'status') {
      if (av === 'pending' && bv !== 'pending') { out[k] = bv; return; }
      if (bv === 'pending' && av !== 'pending') return; // keep av
    }
    // Otherwise the newer record wins.
    if (bIsNewer) out[k] = bv;
  });
  // Deleted tombstones sync both ways, but a later restore must beat an
  // older delete tombstone or restored bets can disappear again on reload.
  const aDel = a.deletedAt || 0;
  const bDel = b.deletedAt || 0;
  const aRestore = a.restoredAt || 0;
  const bRestore = b.restoredAt || 0;
  if (aDel || bDel) {
    const latestDelete = Math.max(aDel, bDel);
    const latestRestore = Math.max(aRestore, bRestore);
    if (latestRestore > latestDelete) {
      out.deleted = false;
      out.deletedAt = null;
      out.restoredAt = latestRestore;
    } else {
      out.deleted = (aDel >= bDel ? a.deleted : b.deleted) || false;
      out.deletedAt = latestDelete || null;
    }
  }
  return out;
}

function writeArchive(archiveStorageKey, bets) {
  try {
    const existing = readList(archiveStorageKey);
    const map = new Map();
    existing.forEach(b => { if (b?.id != null) map.set(b.id, b); });
    bets.forEach(b => {
      if (b?.id == null) return;
      map.set(b.id, mergePair(map.get(b.id), b));
    });
    // Cap archive to the most recent bets by id (ids are Date.now()).
    const all = Array.from(map.values()).sort((x, y) => (y.id || 0) - (x.id || 0)).slice(0, ARCHIVE_LIMIT);
    localStorage.setItem(archiveStorageKey, JSON.stringify(all));
  } catch {}
}

// Union bets from cloud/local/archive by id. Never drops a known bet — a
// tombstone (`deleted: true`) is how we represent intentional removal so that
// a bad write can't silently erase data.
export function unionBets(...lists) {
  const map = new Map();
  lists.forEach(list => (list || []).forEach(bet => {
    if (!bet || bet.id == null) return;
    map.set(bet.id, mergePair(map.get(bet.id), bet));
  }));
  return Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
}

// Same data, regardless of key order. Firestore returns map keys sorted, so a
// plain JSON or identity comparison would call every cloud copy "changed".
export function sameBets(a, b) {
  return canonicalJson(a || []) === canonicalJson(b || []);
}

// Merge other copies into the current list, but hand back the current array
// itself when they add nothing. A fresh-but-identical array still counts as a
// state change in React, which re-ran the save effect: every save echoed back
// through onSnapshot as "new" data and triggered the next save, forever.
export function mergeInto(prev, ...lists) {
  const merged = unionBets(prev, ...lists);
  return sameBets(merged, prev) ? prev : merged;
}

// The same, for the hook's { owner, bets } state: merges only into the given
// account's bets, and keeps the state object when nothing changed.
function mergeStore(prev, owner, ...lists) {
  if (prev.owner !== owner) return prev;
  const bets = mergeInto(prev.bets, ...lists);
  return bets === prev.bets ? prev : { owner, bets };
}

// Heuristic: does this value look like a bet? Bets always carry an id and at
// least one of the common tracking fields. Used when scanning localStorage for
// anything that might be recoverable bet data under an unexpected key.
function looksLikeBet(x) {
  if (!x || typeof x !== 'object' || x.id == null) return false;
  const keys = ['team','market','stake','odds','pick','sport','wager','selection','sportKey','result'];
  return keys.some(k => x[k] !== undefined);
}

// Walk every localStorage entry looking for arrays of bet-like records.
// Returns the union of everything found. Safe to call repeatedly. Keys that
// belong to another account on this device (`…:<their uid>`) are skipped.
export function scanLocalStorageForBets(uid) {
  const found = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const owner = k.match(/:([A-Za-z0-9_-]{6,128})$/)?.[1];
      if (owner && owner !== uid) continue;
      let raw;
      try { raw = localStorage.getItem(k); } catch { continue; }
      if (!raw || raw[0] !== '[' && raw[0] !== '{') continue;
      let parsed;
      try { parsed = JSON.parse(raw); } catch { continue; }
      const candidate = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bets) ? parsed.bets : null;
      if (!candidate) continue;
      const hits = candidate.filter(looksLikeBet);
      if (hits.length > 0) found.push(hits);
    }
  } catch {}
  return unionBets(...found);
}

// Pull every daily snapshot doc we've written so far and union them. Lets us
// recover from any point-in-time backup even if the main `bets` doc got
// clobbered by a bad write.
export async function loadCloudSnapshots(userId) {
  try {
    const snapsRef = collection(db, 'users', userId, 'bets_snapshots');
    const snap = await getDocs(snapsRef);
    const lists = [];
    snap.forEach(d => {
      const data = d.data();
      if (Array.isArray(data?.bets)) lists.push(data.bets);
    });
    return unionBets(...lists);
  } catch (err) {
    console.error('Snapshot load failed:', err);
    return [];
  }
}

// Write today's snapshot at most once per day (keyed in localStorage) to a
// date-stamped Firestore doc. Each day gets its own doc so snapshots are
// additive — today's bad write can never overwrite yesterday's snapshot.
async function maybeWriteDailySnapshot(userId, dateStorageKey, bets) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const last = localStorage.getItem(dateStorageKey);
    if (last === today) return;
    const ref = doc(db, 'users', userId, 'bets_snapshots', today);
    await setDoc(ref, { bets, savedAt: new Date().toISOString() }, { merge: true });
    localStorage.setItem(dateStorageKey, today);
  } catch (err) {
    console.error('Daily snapshot failed:', err);
  }
}

export function useCloudBets(key, defaultValue = []) {
  const { user } = useAuth();
  const uid = user?.uid || null;

  // `owner` is the account these bets belong to. Every local and cloud write
  // goes to the owner's own storage, so one account's list can never land in
  // another's — not even for a moment while accounts switch.
  const [store, setStore] = useState(() => ({ owner: uid, bets: loadLocalBets(key, uid, defaultValue) }));
  const state = store.bets;

  // A different account signed in without the app remounting: swap in that
  // account's own bets before anything else happens.
  useEffect(() => {
    if (store.owner !== uid) setStore({ owner: uid, bets: loadLocalBets(key, uid, defaultValue) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, uid, store.owner]); // defaultValue excluded: stable default ([] literal)

  // Whether this account's cloud copy has been loaded (saves wait for it).
  const hasLoadedFromFirestore = useRef(false);

  // Canonical JSON of the bets Firestore is known to hold: what we loaded,
  // last received from another device, or last saved. A save is skipped when
  // the current list matches it, so nothing is written unless something
  // actually changed.
  const cloudJsonRef = useRef(null);

  // Always-current state and user, for timers and unload handlers.
  const latestStoreRef = useRef(store);
  useEffect(() => { latestStoreRef.current = store; }, [store]);
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Cloud saves. Stable for the hook's lifetime; everything they read comes
  // from refs.
  const saver = useMemo(() => {
    let debounceTimer = null;
    let retryDelay = RETRY_MIN_MS;
    let saving = false;
    let saveAgain = false;

    function schedule(delay = SAVE_DEBOUNCE_MS) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { save(); }, delay);
    }

    function hasPending() {
      return debounceTimer != null;
    }

    async function save() {
      if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
      const { owner, bets } = latestStoreRef.current;
      if (!owner || userRef.current?.uid !== owner || !hasLoadedFromFirestore.current) return;
      if (canonicalJson(bets) === cloudJsonRef.current) return;
      if (saving) { saveAgain = true; return; }
      saving = true;
      try {
        // Read the cloud copy and write the union in one transaction. A plain
        // overwrite let a device with a stale list (a phone waking up, a tab
        // left open) wipe out bets another device had just saved — they then
        // had to be logged again.
        const ref = doc(db, 'users', owner, 'data', 'bets');
        const saved = await runTransaction(db, async (tx) => {
          const snap = await tx.get(ref);
          const cloudBets = snap.exists() ? (snap.data().bets || []) : [];
          const union = unionBets(cloudBets, bets);
          tx.set(ref, { bets: union, updatedAt: new Date().toISOString() }, { merge: true });
          return union;
        });
        retryDelay = RETRY_MIN_MS;
        if (userRef.current?.uid !== owner) return; // signed out meanwhile
        cloudJsonRef.current = canonicalJson(saved);
        // Bring anything another device had added into this one too.
        setStore(prev => mergeStore(prev, owner, saved));
        maybeWriteDailySnapshot(owner, betStorageKeys(key, owner).snapshotDate, saved);
      } catch (err) {
        // Offline, or contention that outlasted Firestore's own retries. The
        // bets are safe on this device; try again with backoff.
        console.error('Error saving bets to Firestore:', err);
        saveAgain = false;
        schedule(retryDelay);
        retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
      } finally {
        saving = false;
        if (saveAgain) { saveAgain = false; schedule(); }
      }
    }

    return { save, schedule, hasPending };
  }, [key]);

  // Effect 1: load this account's cloud copy and keep listening for changes
  // from its other devices.
  useEffect(() => {
    hasLoadedFromFirestore.current = false;
    cloudJsonRef.current = null;
    if (!uid) return undefined;
    let active = true;
    const betsDocRef = doc(db, 'users', uid, 'data', 'bets');
    const keys = betStorageKeys(key, uid);

    getDoc(betsDocRef)
      .then(async (docSnap) => {
        // Pull every daily snapshot we've ever saved and merge them in too,
        // so a bad write to the live `bets` doc can't erase older data.
        const snapshotBets = await loadCloudSnapshots(uid);
        if (!active) return;
        const cloudBets = docSnap.exists() ? (docSnap.data().bets || defaultValue) : [];
        // Merge the latest in-memory state too (`prev`), so a bet added
        // before this read finished is kept. The device's live list and
        // archive are re-read in case another tab changed them.
        setStore(prev => mergeStore(prev, uid, readList(keys.live), readList(keys.archive), cloudBets, snapshotBets));
        cloudJsonRef.current = canonicalJson(cloudBets);
        hasLoadedFromFirestore.current = true;
        // If the merge holds anything the cloud copy lacks (including a
        // first-ever doc), save the union. Skipped when they already match.
        saver.schedule();
      })
      .catch(err => {
        console.error('Error loading bets from Firestore:', err);
        if (!active) return;
        // Saves merge with whatever the cloud holds, so syncing can start
        // even though this read failed.
        hasLoadedFromFirestore.current = true;
        saver.schedule();
      });

    // Other devices' saves arrive here. Always MERGE, never replace, so a bad
    // write elsewhere can't delete bets here. Intentional deletes still
    // propagate as `deleted: true` tombstones, which `mergePair` preserves.
    const unsubscribe = onSnapshot(
      betsDocRef,
      (docSnap) => {
        if (docSnap.metadata.hasPendingWrites) return;
        if (!active || !docSnap.exists() || !hasLoadedFromFirestore.current) return;
        const cloudBets = docSnap.data().bets || defaultValue;
        cloudJsonRef.current = canonicalJson(cloudBets);
        setStore(prev => mergeStore(prev, uid, cloudBets));
        // If this device holds bets that copy lacks, save the union back.
        saver.schedule();
      },
      (err) => {
        console.error('Firestore snapshot error:', err);
      }
    );

    return () => { active = false; unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, key, saver]); // defaultValue excluded: stable default ([] literal)

  // Durable setter: persist to this account's localStorage keys in the same
  // turn as the state update, so a bet survives even if the app unmounts
  // before React runs the persistence effect below.
  const setDurableState = useCallback((valueOrUpdater) => {
    setStore(prev => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev.bets) : valueOrUpdater;
      if (next === prev.bets) return prev;
      if (prev.owner) {
        const keys = betStorageKeys(key, prev.owner);
        writeList(keys.live, next);
        writeArchive(keys.archive, next);
      }
      return { owner: prev.owner, bets: next };
    });
  }, [key]);

  // Effect 2: mirror every state change (including merges from the cloud)
  // to this account's localStorage keys.
  useEffect(() => {
    if (!store.owner) return;
    const keys = betStorageKeys(key, store.owner);
    writeList(keys.live, store.bets);
    writeArchive(keys.archive, store.bets);
  }, [key, store]);

  // Effect 3: debounced cloud save after each change.
  useEffect(() => {
    if (!uid || store.owner !== uid || !hasLoadedFromFirestore.current) return;
    saver.schedule();
  }, [store, uid, saver]);

  // Leaving within the debounce window must not drop the cloud save.
  useEffect(() => () => {
    if (saver.hasPending()) saver.save();
  }, [saver]);

  // Effect 4: save on tab hide / page unload (browsers don't always run
  // unmount cleanup), and as soon as the connection comes back. `save`
  // writes only if something changed since the last save.
  useEffect(() => {
    const onHide = () => { saver.save(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    window.addEventListener('online', onHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      window.removeEventListener('online', onHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [saver]);

  return [state, setDurableState];
}

export default useCloudBets;
