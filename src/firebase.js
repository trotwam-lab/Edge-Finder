// ==============================================
// FIREBASE CONFIG — The central setup file for Firebase
// ==============================================
// Firebase gives us Authentication here. Firestore lives in firestore.js so
// the main app does not load database code until tracker-style features need it.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

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
export const app = initializeApp(firebaseConfig);

// Auth — handles user login/signup
export const auth = getAuth(app);

// Helper: check a user's subscription tier by calling our API endpoint
// This asks Stripe (via our serverless function) if the user is Pro or Free
export async function getUserTier({ email, uid }) {
  try {
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (uid) params.set('uid', uid);
    const response = await fetch(`/api/user-tier?${params.toString()}`);
    const data = await response.json();
    return data.tier || 'free';
  } catch (err) {
    console.error('Error fetching user tier:', err);
    return 'free'; // Default to free if anything goes wrong
  }
}
