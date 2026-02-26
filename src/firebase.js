// ==============================================
// FIREBASE CONFIG — The central setup file for Firebase
// ==============================================
// Firebase gives us: Authentication (login) and Firestore (database).
// This file initializes both and exports them for use throughout the app.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Firestore = Firebase's database. We use it to store user data.
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDjJdLghs8ycbkQZhUVIuvnQ92IyhM3xmQ",
  authDomain: "edgefinder-9d42e.firebaseapp.com",
  projectId: "edgefinder-9d42e",
  storageBucket: "edgefinder-9d42e.firebasestorage.app",
  messagingSenderId: "245989656973",
  appId: "1:245989656973:web:61aeb07f555ecfa3b215c4",
  measurementId: "G-7YFFZ71VN6"
};

// Initialize the Firebase app
const app = initializeApp(firebaseConfig);

// Auth — handles user login/signup
export const auth = getAuth(app);

// Firestore — our database for storing user data (like subscription tier)
export const db = getFirestore(app);

// Helper: check a user's subscription tier by calling our API endpoint
// This asks Stripe (via our serverless function) if the user is Pro or Free
export async function getUserTier(email) {
  try {
    const response = await fetch(`/api/user-tier?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    const tier = data.tier || 'free';

    // Cache the tier in Firestore so we have a persistent fallback
    // This also helps with the race condition after Stripe checkout
    if (tier === 'pro' && auth.currentUser) {
      try {
        await setDoc(doc(db, 'users', auth.currentUser.uid, 'data', 'tier'), {
          tier: 'pro',
          email,
          checkedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (e) {
        // Non-critical: Firestore write failure shouldn't block the tier check
      }
    }

    return tier;
  } catch (err) {
    console.error('Error fetching user tier:', err);

    // Fallback: check Firestore cache if API call fails
    if (auth.currentUser) {
      try {
        const cached = await getDoc(doc(db, 'users', auth.currentUser.uid, 'data', 'tier'));
        if (cached.exists() && cached.data()?.tier === 'pro') {
          // Verify the cache isn't stale (within last 7 days)
          const checkedAt = new Date(cached.data().checkedAt);
          const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          if (checkedAt > sevenDaysAgo) {
            return 'pro';
          }
        }
      } catch (e) {
        // Firestore also failed — truly offline
      }
    }

    return 'free';
  }
}

// Helper: check tier with retries — used after Stripe checkout redirect
// Stripe can take several seconds to finalize the subscription, so we
// retry with exponential backoff: 2s, 4s, 6s, 8s, 10s (up to 30s total wait)
export async function getUserTierWithRetry(email, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const tier = await getUserTier(email);
    if (tier === 'pro') return 'pro';

    // If not pro yet and we have retries left, wait and try again
    if (attempt < maxRetries) {
      const delay = (attempt + 1) * 2000; // 2s, 4s, 6s, 8s, 10s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return 'free';
}
