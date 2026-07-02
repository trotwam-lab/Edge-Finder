import React, { Suspense, createContext, lazy, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { auth, getUserTier } from './firebase';

const WelcomePage = lazy(() => import('./components/WelcomePage.jsx'));

// --- Auth Context ---
// This context provides { user, tier, loading, logout } to the whole app
// "tier" is either "free" or "pro" — it controls what features are visible
const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tier, setTier] = useState('free'); // Default to free tier
  const [loading, setLoading] = useState(true);

  // refreshTier — re-fetches the user's tier from the API
  // Call this after a successful Stripe checkout to update the UI
  const refreshTier = async () => {
    if (user?.email || user?.uid) {
      const userTier = await getUserTier();
      setTier(userTier);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // User is logged in — check their subscription tier using Firebase UID first, then email fallback
        const userTier = await getUserTier();
        setTier(userTier);
      } else {
        // User logged out — reset to free
        setTier('free');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = () => signOut(auth);

  // Provide tier + refreshTier alongside user so any component can check subscription status
  return (
    <AuthContext.Provider value={{ user, tier, loading, logout, refreshTier }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Auth Gate ---
export default function AuthGate({ children }) {
  const { user, loading } = useAuth();
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setAuthTimedOut(false);
      return undefined;
    }

    // Native iOS WebViews can occasionally stall while Firebase restores the
    // previous session. Do not trap the user on a forever spinner — after a
    // short grace period, show the normal sign-in screen and let auth finish in
    // the background if it recovers.
    const timer = window.setTimeout(() => setAuthTimedOut(true), 5000);
    return () => window.clearTimeout(timer);
  }, [loading]);

  if (loading && !authTimedOut) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '14px',
        padding: '24px',
        paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: '#818cf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <div style={{ color: '#94a3b8', fontSize: '12px', fontFamily: "'JetBrains Mono', monospace" }}>
          Restoring sign-in…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={null}>
        <WelcomePage />
      </Suspense>
    );
  }

  return children;
}
