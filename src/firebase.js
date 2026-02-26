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
    return data.tier || 'free';
  } catch (err) {
    console.error('Error fetching user tier:', err);
    return 'free'; // Default to free if anything goes wrong
  }
}

// Helper: check tier with retries — used after Stripe checkout redirect
// Stripe can take a few seconds to finalize the subscription, so if the first
// check returns 'free', we retry up to 3 times with increasing delays.
export async function getUserTierWithRetry(email, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const tier = await getUserTier(email);
    if (tier === 'pro') return 'pro';

    // If not pro yet and we have retries left, wait and try again
    if (attempt < maxRetries) {
      const delay = (attempt + 1) * 2000; // 2s, 4s, 6s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return 'free';
}
