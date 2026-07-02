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
    return 'free'; // Default to free if anything goes wrong
  }
}
