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
      const candidate = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed?.bets) ? parsed.bets
        : null;
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
  // Track previous user state to detect login/logout
  const prevUserRef = useRef(null);

  // Helper to merge bets — union by id, preserving the most complete record.
  // Deletes propagate via tombstones (deleted:true) carried in mergePair.
  const mergeBets = useCallback((localBets, cloudBets) => {
    return unionBets(localBets, cloudBets);
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

        // Pull every daily snapshot we've ever saved and merge them in too,
        // so a bad write to the live `bets` doc can't erase older data.
        const snapshotBets = await loadCloudSnapshots(userId);

        if (docSnap.exists()) {
          const cloudBets = docSnap.data().bets || defaultValue;

          // Merge local, cloud, and every historical snapshot
          const mergedBets = unionBets(localBets, cloudBets, snapshotBets);

          setState(mergedBets);
          
          // If we merged new local bets into cloud, save back to Firestore
          const localIds = new Set(localBets.map(b => b.id));
          const cloudIds = new Set(cloudBets.map(b => b.id));
          const hasNewLocalBets = localBets.some(b => !cloudIds.has(b.id));
          
          if (hasNewLocalBets) {
            setDoc(betsDocRef, { bets: mergedBets, updatedAt: new Date().toISOString() }, { merge: true })
              .catch(err => console.error('Error saving merged bets to Firestore:', err));
          }
        } else {
          // No live doc yet. Seed from local + any historical snapshots so
          // a cleared live doc still recovers from the archive and snapshots.
          const seed = unionBets(localBets, snapshotBets);
          if (seed.length > 0) {
            setState(seed);
            setDoc(betsDocRef, { bets: seed, updatedAt: new Date().toISOString() }, { merge: true })
              .catch(err => console.error('Error saving initial bets to Firestore:', err));
          }
        }
        
        hasLoadedFromFirestore.current = true;
      })
      .catch(err => {
        console.error('Error loading bets from Firestore:', err);
        // Keep using localStorage data on error
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

  // Effect 3: Debounced save to Firestore
  useEffect(() => {
    if (!user) return; // Don't save to Firestore if not logged in
    if (!hasLoadedFromFirestore.current) return; // Don't save until we've loaded

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer - wait 2 seconds after last change before saving
    debounceTimer.current = setTimeout(() => {
      const userId = user.uid;
      const betsDocRef = doc(db, 'users', userId, 'data', 'bets');

      setDoc(betsDocRef, {
        bets: state,
        updatedAt: new Date().toISOString()
      }, { merge: true })
        .catch(err => console.error('Error saving bets to Firestore:', err));

      // Also write a daily point-in-time snapshot (at most once/day). These
      // snapshots live under a different path and are additive, so they can
      // never be clobbered by a bad write to the live `bets` doc.
      maybeWriteDailySnapshot(userId, key, state);
    }, 2000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [state, user, key]);

  return [state, setState];
}

export default useCloudBets;
