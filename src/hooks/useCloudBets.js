import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
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
export function useCloudBets(key, defaultValue = []) {
  const { user } = useAuth();
  const [state, setState] = useState(() => {
    // Always start with localStorage value for immediate UI
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
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

  // Helper to merge bets (avoiding duplicates by id)
  const mergeBets = useCallback((localBets, cloudBets) => {
    const betMap = new Map();
    
    // Add cloud bets first (they're the "source of truth")
    cloudBets.forEach(bet => {
      if (bet && bet.id) {
        betMap.set(bet.id, bet);
      }
    });
    
    // Add local bets, but don't overwrite cloud bets unless local is newer
    localBets.forEach(bet => {
      if (bet && bet.id) {
        const existing = betMap.get(bet.id);
        if (!existing) {
          // Local bet not in cloud, add it
          betMap.set(bet.id, bet);
        }
        // If bet exists in both, keep cloud version (it's the source of truth)
      }
    });
    
    // Convert back to array, sorted by date (newest first)
    return Array.from(betMap.values()).sort((a, b) => {
      const dateA = a.id || 0;
      const dateB = b.id || 0;
      return dateB - dateA;
    });
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
      .then((docSnap) => {
        const localBets = (() => {
          try {
            const saved = localStorage.getItem(key);
            return saved ? JSON.parse(saved) : defaultValue;
          } catch {
            return defaultValue;
          }
        })();

        if (docSnap.exists()) {
          const cloudBets = docSnap.data().bets || defaultValue;
          
          // Merge local and cloud bets
          const mergedBets = mergeBets(localBets, cloudBets);
          
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
          // No cloud data yet, save local bets to Firestore
          if (localBets.length > 0) {
            setDoc(betsDocRef, { bets: localBets, updatedAt: new Date().toISOString() }, { merge: true })
              .catch(err => console.error('Error saving initial bets to Firestore:', err));
          }
        }
        
        hasLoadedFromFirestore.current = true;
      })
      .catch(err => {
        console.error('Error loading bets from Firestore:', err);
        // Keep using localStorage data on error
      });

    // Set up real-time listener for updates from other devices
    const unsubscribe = onSnapshot(
      betsDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const cloudBets = docSnap.data().bets || defaultValue;
          // Only update if we didn't just save (avoid flickering)
          // This is a simple check - in production you might want version numbers
          setState(prev => {
            // Only update if cloud has different data
            const prevIds = new Set(prev.map(b => b.id));
            const cloudIds = new Set(cloudBets.map(b => b.id));
            const isDifferent = prev.length !== cloudBets.length || 
                              prev.some(b => !cloudIds.has(b.id)) ||
                              cloudBets.some(b => !prevIds.has(b.id));
            
            if (isDifferent && hasLoadedFromFirestore.current) {
              return cloudBets;
            }
            return prev;
          });
        }
      },
      (err) => {
        console.error('Firestore snapshot error:', err);
      }
    );

    return () => unsubscribe();
  }, [user, key, defaultValue, mergeBets]);

  // Effect 2: Save to localStorage on every change (fast)
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (err) {
      console.error('Error saving to localStorage:', err);
    }
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
    }, 2000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [state, user]);

  return [state, setState];
}

export default useCloudBets;
