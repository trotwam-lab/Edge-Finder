import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import './mobile.css'
import { AuthProvider, AuthLoadingScreen, hasSessionHint } from './AuthGate.jsx'
import AuthGate from './AuthGate.jsx'
import PWAUpdatePrompt from './PWAUpdatePrompt.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { recoverFromStaleBuild } from './utils/chunk-recovery.js'

// Vite fires this when a code file can't be preloaded (stale build after a
// deploy, dropped connection). Self-heal once instead of leaving a dead screen.
window.addEventListener('vite:preloadError', () => {
  recoverFromStaleBuild()
})

// The signed-in dashboard (and Firestore with it) is its own chunk, so the
// landing page never pays to parse it. Returning users start fetching it right
// away — in parallel with Firebase restoring their session — and everyone
// else warms it in idle time so signing in feels instant.
const loadApp = () => import('./App.jsx')
const App = lazy(loadApp)
const PublicRecord = lazy(() => import('./components/PublicRecord.jsx'))

// Public verified-record pages (/r/<handle>) need no sign-in and none of the
// dashboard, so they get their own lightweight tree.
const publicRecordMatch = window.location.pathname.match(/^\/r\/([a-z0-9_]{3,20})\/?$/i)

if (publicRecordMatch) {
  // nothing to warm: the visitor isn't using the dashboard
} else if (hasSessionHint()) {
  loadApp()
} else if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => loadApp(), { timeout: 6000 })
} else {
  window.setTimeout(loadApp, 3000)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  publicRecordMatch ? (
    <React.StrictMode>
      <Suspense fallback={<AuthLoadingScreen label="Loading record…" />}>
        <PublicRecord handle={publicRecordMatch[1].toLowerCase()} />
      </Suspense>
    </React.StrictMode>
  ) : (
  <React.StrictMode>
    {/* Mounted outside the auth gate so the update toast reaches every screen,
        including the landing page and stale/comp accounts stuck on old builds. */}
    <PWAUpdatePrompt />
    <AuthProvider>
      <AuthGate>
        <ErrorBoundary fullScreen>
          <Suspense fallback={<AuthLoadingScreen label="Loading your board…" />}>
            <App />
          </Suspense>
        </ErrorBoundary>
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>
  ),
)
