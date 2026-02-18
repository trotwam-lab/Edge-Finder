import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut
} from 'firebase/auth';
import { auth, googleProvider, getUserTier } from './firebase';

// --- Auth Context ---
// This context provides { user, tier, loading, logout } to the whole app
// "tier" is either "free" or "pro" â it controls what features are visible
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

  // refreshTier â re-fetches the user's tier from the API
  // Call this after a successful Stripe checkout to update the UI
  const refreshTier = async () => {
    if (user?.email) {
      const userTier = await getUserTier(user.email);
      setTier(userTier);
    }
  };

  useEffect(() => {
    // Handle redirect result (for mobile/in-app browsers)
    getRedirectResult(auth).catch(() => {});
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // User is logged in â check their subscription tier via email
        const userTier = await getUserTier(u.email);
        setTier(userTier);
      } else {
        // User logged out â reset to free
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

// --- Login Page ---
function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detect in-app browsers where Google redirect won't work
  const isInAppBrowser = /Telegram|Instagram|FBAN|FBAV|Line|Twitter|Snapchat/i.test(navigator.userAgent);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      // Use redirect for mobile/in-app browsers, popup for desktop
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
        /Telegram|Instagram|FBAN|FBAV/i.test(navigator.userAgent);
      if (isMobile) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err) {
      // If popup blocked, fall back to redirect
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, googleProvider);
      } else {
        setError(err.message.replace('Firebase: ', ''));
      }
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '16px',
        padding: '40px 32px',
        backdropFilter: 'blur(20px)'
      }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            background: 'linear-gradient(135deg, #818cf8, #38bdf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '8px'
          }}>
            EdgeFinder
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', letterSpacing: '2px', textTransform: 'uppercase' }}>
            Smart Betting Analytics
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            fontSize: '12px',
            marginBottom: '16px'
          }}>
            {error}
          </div>
        )}

        {/* Email / Password Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              padding: '12px 14px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none'
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{
              padding: '12px 14px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px',
              color: '#e2e8f0',
              fontSize: '13px',
              fontFamily: "'JetBrains Mono', monospace",
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: '12px',
              background: 'linear-gradient(135deg, #6366f1, #818cf8)',
              border: 'none',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              marginTop: '4px'
            }}
          >
            {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        {/* Divider + Google (hidden in in-app browsers) */}
        {!isInAppBrowser && <>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          margin: '20px 0',
          color: '#475569',
          fontSize: '11px'
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(99, 102, 241, 0.2)' }} />
          OR
          <div style={{ flex: 1, height: '1px', background: 'rgba(99, 102, 241, 0.2)' }} />
        </div>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogle}
          style={{
            width: '100%',
            padding: '12px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '13px',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
        </>}

        {/* Toggle sign-up / sign-in */}
        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#64748b' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <span
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            style={{ color: '#818cf8', cursor: 'pointer' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Auth Gate ---
export default function AuthGate({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(99, 102, 241, 0.2)',
          borderTopColor: '#818cf8',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return children;
}
