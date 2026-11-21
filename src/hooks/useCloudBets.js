import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, getDocs, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firestore.js';
import { useAuth } from '../AuthGate.jsx';
import { canonicalJson } from '../utils/ledger.js';

const SAVE_DEBOUNCE_MS = 1500;

/**
 * useCloudBets - A hook that syncs bets to Firebase Firestore while keeping localStorage as a fast cache.
 *
 * This is a drop-in replacement for usePersistentState that:
 * 1. On mount (when user is logged in): Loads bets from Firestore doc at users/{userId}/data/bets
 * 2. When bets change: Saves to both localStorage AND Firestore
 * 3. When user logs in: Merges any localStorage bets with Firestore bets (so offline bets aren't lost)
 * 4. When user logs out: Keeps localStorage bets (they'll merge when they log back in)
 *
 * Usage: const [bets, setBets] = useCloudBets('edgefinder_bets', []);
 */

// Archive of every bet we have ever seen locally. Writes are append-only
// (deduped by id) so a bad cloud snapshot or a concurrent-write race can never
// make a bet permanently disappear from the user's device.
const archiveKey = (key) => `${key}_archive`;

function readArchive(key) {
  try {
    const saved = localStorage.getItem(archiveKey(key));
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
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

function writeArchive(key, bets) {
  try {
    const existing = readArchive(key);
    const map = new Map();
    existing.forEach(b => { if (b?.id != null) map.set(b.id, b); });
    bets.forEach(b => {
      if (b?.id == null) return;
      map.set(b.id, mergePair(map.get(b.id), b));
    });
    // Cap archive to the 500 most recent bets by id (ids are Date.now()).
    const all = Array.from(map.values()).sort((x, y) => (y.id || 0) - (x.id || 0)).slice(0, 500);
    localStorage.setItem(archiveKey(key), JSON.stringify(all));
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

// Heuristic: does this value look like a bet? Bets always carry an id and at
// least one of the common tracking fields. Used when scanning localStorage for
// anything that might be recoverable bet data under an unexpected key.
function looksLikeBet(x) {
  if (!x || typeof x !== 'object' || x.id == null) return false;
  const keys = ['team','market','stake','odds','pick','sport','wager','selection','sportKey','result'];
  return keys.some(k => x[k] !== undefined);
}

// Walk every localStorage entry looking for arrays of bet-like records.
// Returns the union of everything found. Safe to call repeatedly.
export function scanLocalStorageForBets() {
  const found = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
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

const snapshotDateKey = (key) => `${key}_snapshot_date`;

// Write today's snapshot at most once per day (keyed in localStorage) to a
// date-stamped Firestore doc. Each day gets its own doc so snapshots are
// additive — today's bad write can never overwrite yesterday's snapshot.
async function maybeWriteDailySnapshot(userId, key, bets) {
  try {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const last = localStorage.getItem(snapshotDateKey(key));
    if (last === today) return;
    const ref = doc(db, 'users', userId, 'bets_snapshots', today);
    await setDoc(ref, { bets, savedAt: new Date().toISOString() }, { merge: true });
    localStorage.setItem(snapshotDateKey(key), today);
  } catch (err) {
    console.error('Daily snapshot failed:', err);
  }
}

export function useCloudBets(key, defaultValue = []) {
  const { user } = useAuth();
  const [state, setState] = useState(() => {
    // On first mount, hydrate from localStorage AND the local archive, so
    // any bets that were previously saved but lost from the "live" list
    // (e.g., due to a prior overwrite bug) come back automatically.
    try {
      const saved = localStorage.getItem(key);
      const liveList = saved ? JSON.parse(saved) : defaultValue;
      const archive = readArchive(key);
      return unionBets(archive, liveList);
    } catch {
      return defaultValue;
    }
  });

  // Track if we've done the initial Firestore load
  const hasLoadedFromFirestore = useRef(false);

  // Debounce timer for Firestore writes
  const debounceTimer = useRef(null);

  // Canonical JSON of the bets Firestore is known to hold: what we loaded,
  // last received from another device, or last wrote. A save is skipped when
  // the current list matches it, so nothing is written unless something
  // actually changed.
  const cloudJsonRef = useRef(null);

  // Always-current snapshot of state, so cleanup handlers can flush the
  // latest data even if React's closure is stale.
  const latestStateRef = useRef(state);
  useEffect(() => { latestStateRef.current = state; }, [state]);

  // Stable ref to the user so flush handlers can access the userId.
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // Track previous user state to detect login/logout
  const prevUserRef = useRef(null);

  // Write the latest bets to Firestore now, unless the cloud already has
  // exactly this data. Also used by unmount and pagehide paths so a tab
  // switch or page close never loses a freshly-added bet.
  const saveNow = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    const u = userRef.current;
    if (!u || !hasLoadedFromFirestore.current) return;
    const bets = latestStateRef.current;
    const json = canonicalJson(bets);
    if (json === cloudJsonRef.current) return;
    cloudJsonRef.current = json;
    try {
      // Fire-and-forget; this may run from synchronous unmount paths.
      setDoc(doc(db, 'users', u.uid, 'data', 'bets'), {
        bets,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => {
        console.error('Error saving bets to Firestore:', err);
        // Not saved after all: let the next change or tab hide retry.
        if (cloudJsonRef.current === json) cloudJsonRef.current = null;
      });
      maybeWriteDailySnapshot(u.uid, key, bets);
    } catch (err) {
      console.error('Error saving bets to Firestore:', err);
      cloudJsonRef.current = null;
    }
  }, [key]);

  const scheduleSave = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }, [saveNow]);

  // Effect 1: Load from Firestore when user logs in
  useEffect(() => {
    // If no user, reset the load flag but keep localStorage data
    if (!user) {
      hasLoadedFromFirestore.current = false;
      cloudJsonRef.current = null;
      prevUserRef.current = null;
      return;
    }

    // If user just logged in (was null, now has value)
    const justLoggedIn = !prevUserRef.current && user;
    prevUserRef.current = user;

    if (!justLoggedIn && hasLoadedFromFirestore.current) {
      return; // Already loaded
    }

    const userId = user.uid;
    const betsDocRef = doc(db, 'users', userId, 'data', 'bets');

    // First, try to get the data once
    getDoc(betsDocRef)
      .then(async (docSnap) => {
        const localBets = (() => {
          try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : defaultValue;
          } catch {
            return defaultValue;
          }
        })();
        // Also pull the local archive so any bet ever seen on this device
        // survives the initial cloud merge, even if it isn't in the live
        // localStorage list yet.
        const archiveBets = readArchive(key);

        // Pull every daily snapshot we've ever saved and merge them in too,
        // so a bad write to the live `bets` doc can't erase older data.
        const snapshotBets = await loadCloudSnapshots(userId);

        const cloudBets = docSnap.exists() ? (docSnap.data().bets || defaultValue) : [];

        // Merge the latest in-memory state too. This prevents a race where a
        // user adds a bet immediately after opening the tracker, but before
        // the first Firestore read finishes; without `prev`, that fresh bet
        // can be overwritten by an older local/cloud snapshot. Including the
        // archive and snapshots also protects against old truncation bugs.
        setState(prev => mergeInto(prev, localBets, archiveBets, cloudBets, snapshotBets));
        cloudJsonRef.current = canonicalJson(cloudBets);
        hasLoadedFromFirestore.current = true;

        // If the merge holds anything the cloud copy lacks (including a
        // first-ever doc), write the union back so other devices and future
        // loads see it. saveNow skips the write when they already match.
        scheduleSave();
      })
      .catch(err => {
        console.error('Error loading bets from Firestore:', err);
        // Even if the cloud load failed, mark hydration as complete so
        // subsequent local writes can sync up to Firestore once available.
        hasLoadedFromFirestore.current = true;
      });

    // Set up real-time listener for updates from other devices. We always
    // MERGE cloud state into local state rather than replacing — this way
    // a bad write from another device can't silently delete bets. Intentional
    // deletes still propagate because they ride along as `deleted: true`
    // tombstones, which `mergePair` preserves.
    const unsubscribe = onSnapshot(
      betsDocRef,
      (docSnap) => {
        // Our own writes echo back at once as a local snapshot. They hold
        // nothing new, and reacting to them is what turned every save into
        // the next save.
        if (docSnap.metadata.hasPendingWrites) return;
        if (!docSnap.exists() || !hasLoadedFromFirestore.current) return;
        const cloudBets = docSnap.data().bets || defaultValue;
        cloudJsonRef.current = canonicalJson(cloudBets);
        setState(prev => mergeInto(prev, cloudBets));
        // Another device's copy may be missing bets this one has; if so,
        // write the union back (skipped when they match).
        scheduleSave();
      },
      (err) => {
        console.error('Firestore snapshot error:', err);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key, scheduleSave]); // defaultValue excluded: stable default ([] literal) to prevent infinite re-renders

  // Durable setter: persist to localStorage/archive in the same turn as the
  // state update. This prevents the "bet shows, then disappears when I switch
  // tabs" bug, which can happen if the component unmounts before React has a
  // chance to run the post-render persistence effect.
  const setDurableState = useCallback((valueOrUpdater) => {
    setState(prev => {
      const next = typeof valueOrUpdater === 'function' ? valueOrUpdater(prev) : valueOrUpdater;
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch (err) {
        console.error('Error saving to localStorage:', err);
      }
      writeArchive(key, next);
      return next;
    });
  }, [key]);

  // Effect 2: Mirror current state to localStorage as a safety net too.
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
    writeArchive(key, state);
  }, [key, state]);

  // Effect 3: Debounced save to Firestore. Changes inside the debounce window
  // just push the timer back; they must not flush, or every edit is written
  // twice (the stale list first, then the new one).
  useEffect(() => {
    if (!user || !hasLoadedFromFirestore.current) return;
    scheduleSave();
  }, [state, user, scheduleSave]);

  // Hard guarantee that a pending write is flushed when the component
  // unmounts. Without it, leaving within the debounce window would silently
  // drop the cloud write and the bet would appear to vanish on return.
  useEffect(() => () => {
    if (debounceTimer.current) saveNow();
  }, [saveNow]);

  // Effect 4: Flush on tab hide / page unload. Browsers don't always fire
  // unmount cleanup before tearing down the page, so we listen for
  // visibilitychange and pagehide as a belt-and-suspenders safeguard.
  // saveNow writes only if something changed since the last save.
  useEffect(() => {
    const onHide = () => saveNow();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') onHide();
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [saveNow]);

  return [state, setDurableState];
}

export default useCloudBets;
