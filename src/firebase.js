// ==============================================
// FIREBASE CONFIG â The central setup file for Firebase
// ==============================================
// Firebase gives us: Authentication (login) and Firestore (database).
// This file initializes both and exports them for use throughout the app.

import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
// Firestore = Firebase's database. We use it to store user data.
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// Your Firebase project config (from Firebase Console â Project Settings)
const firebaseConfig = {
  apiKey: "AIzaSyBGKVFcZm8rurc9XXYoQ6uWkx7IGhXR6m4",
  authDomain: "edgefinder-betting.firebaseapp.com",
  projectId: "edgefinder-betting",
  storageBucket: "edgefinder-betting.firebasestorage.app",
  messagingSenderId: "665349381911",
  appId: "1:665349381911:web:faf37ffdc535459399e152",
  measurementId: "G-DWHYZXCS3G"
};

// Initialize the Firebase app
const app = initializeApp(firebaseConfig);

// Auth â handles user login/signup
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore â our database for storing user data (like subscription tier)
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
