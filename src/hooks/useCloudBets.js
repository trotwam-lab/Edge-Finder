import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, getDocs, setDoc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../AuthGate.jsx';

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
  // Uses settledDate (YYYY-MM-DD) as a proxy for "last meaningful update",
  // falling back to id (Date.now() at creation) for a deterministic order.
  const aTime = Date.parse(a.settledDate || '') || 0;
  const bTime = Date.parse(b.settledDate || '') || 0;
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
  // Deleted tombstones sync both ways — later deletedAt wins.
  const aDel = a.deletedAt || 0;
  const bDel = b.deletedAt || 0;
  if (aDel || bDel) {
    out.deleted = (aDel >= bDel ? a.deleted : b.deleted) || false;
    out.deletedAt = Math.max(aDel, bDel) || null;
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
function unionBets(...lists) {
  const map = new Map();
  lists.forEach(list => (list || []).forEach(bet => {
    if (!bet || bet.id == null) return;
    map.set(bet.id, mergePair(map.get(bet.id), bet));
  }));
  return Array.from(map.values()).sort((a, b) => (b.id || 0) - (a.id || 0));
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

  // Always-current snapshot of state, so cleanup handlers can flush the
  // latest data even if React's closure is stale.
  const latestStateRef = useRef(state);
  useEffect(() => { latestStateRef.current = state; }, [state]);

  // Stable ref to the user so flush handlers can access the userId.
  const userRef = useRef(null);
  useEffect(() => { userRef.current = user; }, [user]);

  // Track previous user state to detect login/logout
  const prevUserRef = useRef(null);

  // Helper to merge bets — union by id, preserving the most complete record.
  // Deletes propagate via tombstones (deleted:true) carried in mergePair.
  const mergeBets = useCallback((localBets, cloudBets) => {
    return unionBets(localBets, cloudBets);
  }, []);

  // Synchronously flush whatever is in latestStateRef to Firestore. Used by
  // unmount cleanup and pagehide handlers so a tab switch or page close
  // never loses a freshly-added bet.
  const flushToFirestore = useCallback(() => {
    const u = userRef.current;
    if (!u) return;
    if (!hasLoadedFromFirestore.current) return;
    try {
      const userId = u.uid;
      const betsDocRef = doc(db, 'users', userId, 'data', 'bets');
      // Fire-and-forget; we don't await because this may be called from
      // synchronous unmount paths.
      setDoc(betsDocRef, {
        bets: latestStateRef.current,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(err => console.error('Flush write failed:', err));
    } catch (err) {
      console.error('Flush failed:', err);
    }
  }, []);

  // Effect 1: Load from Firestore when user logs in
  useEffect(() => {
    // If no user, reset the load flag but keep localStorage data
    if (!user) {
      hasLoadedFromFirestore.current = false;
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

        // CRITICAL race fix: use the functional setState form so any bet the
        // user added DURING the cloud load is preserved. Previously we
        // unconditionally replaced state — a bet placed before getDoc
        // resolved lives only in React state (the localStorage write is
        // debounced via Effect 2), so it would be wiped by the merge.
        // Including `prev` and the local archive prevents that.
        let mergedBets = [];
        setState(prev => {
          mergedBets = unionBets(prev, archiveBets, localBets, cloudBets, snapshotBets);
          return mergedBets;
        });

        // If the merge produced bets the cloud doesn't have yet, write back
        // so other devices and future loads see the union.
        const cloudIds = new Set(cloudBets.map(b => b.id));
        const hasNewBets = mergedBets.some(b => !cloudIds.has(b.id));
        if ((hasNewBets || !docSnap.exists()) && mergedBets.length > 0) {
          setDoc(betsDocRef, {
            bets: mergedBets,
            updatedAt: new Date().toISOString()
          }, { merge: true })
            .catch(err => console.error('Error saving merged bets to Firestore:', err));
        }

        hasLoadedFromFirestore.current = true;
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
        if (!docSnap.exists() || !hasLoadedFromFirestore.current) return;
        const cloudBets = docSnap.data().bets || defaultValue;
        setState(prev => unionBets(prev, cloudBets));
      },
      (err) => {
        console.error('Firestore snapshot error:', err);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, key, mergeBets]); // defaultValue excluded: stable default ([] literal) to prevent infinite re-renders

  // Effect 2: Save to localStorage on every change (fast), and mirror every
  // bet we've ever seen into the local archive so it can be restored if the
  // live list ever gets truncated.
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
    writeArchive(key, state);
  }, [key, state]);

  // Effect 3: Debounced save to Firestore, with a hard guarantee that any
  // pending write is flushed when the component unmounts (e.g. user switches
  // tabs in the app) or the tab is hidden / page is being unloaded. Without
  // this flush, a tab switch within the 2s debounce window would silently
  // drop the cloud write and the bet would appear to vanish on return.
  useEffect(() => {
    if (!user) return;
    if (!hasLoadedFromFirestore.current) return;

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      const userId = user.uid;
      const betsDocRef = doc(db, 'users', userId, 'data', 'bets');

      setDoc(betsDocRef, {
        bets: state,
        updatedAt: new Date().toISOString()
      }, { merge: true })
        .catch(err => console.error('Error saving bets to Firestore:', err));

      maybeWriteDailySnapshot(userId, key, state);
      debounceTimer.current = null;
    }, 1500);

    return () => {
      // If a debounced write is still pending when this effect tears down
      // (state changed, or component is unmounting), flush it immediately
      // using the latest state. This is the core fix for "bet disappears
      // when I switch tabs right after logging it" — the previous code
      // simply cleared the timer and never wrote to Firestore.
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
        flushToFirestore();
      }
    };
  }, [state, user, key, flushToFirestore]);

  // Effect 4: Flush on tab hide / page unload. Browsers don't always fire
  // unmount cleanup before tearing down the page, so we listen for
  // visibilitychange and pagehide as a belt-and-suspenders safeguard.
  useEffect(() => {
    const onHide = () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      flushToFirestore();
    };
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
  }, [flushToFirestore]);

  return [state, setState];
}

export default useCloudBets;
