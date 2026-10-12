// ==============================================
// FIREBASE CONFIG — The central setup file for Firebase
// ==============================================
// Firebase gives us Authentication here. Firestore lives in firestore.js so
// the main app does not load database code until tracker-style features need it.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Firebase web configuration is public by design, but keeping it in deployment
// environment variables avoids committing provider-shaped keys and makes
// rotation/restriction changes independent of source releases.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const requiredFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([key]) => key !== 'measurementId');
const missingFirebaseConfig = requiredFirebaseConfig
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missingFirebaseConfig.length) {
  throw new Error(`Missing Firebase web configuration: ${missingFirebaseConfig.join(', ')}`);
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Helper: check a user's subscription tier by calling our API endpoint.
// The server derives identity from the verified ID token — the endpoint no
// longer accepts an email/uid from the caller (that made it a public oracle
// for whether any email had an active subscription).
export async function getUserTier() {
  try {
    const user = auth.currentUser;
    if (!user) return 'free';
    const token = await user.getIdToken();
    const response = await fetch('/api/user-tier', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return data.tier || 'free';
  } catch (err) {
    console.error('Error fetching user tier:', err);
    return 'free';
  }
}
