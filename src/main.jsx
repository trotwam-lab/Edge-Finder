import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import './theme.css'
import './mobile.css'
import { AuthProvider, AuthLoadingScreen, hasSessionHint } from './AuthGate.jsx'
import AuthGate from './AuthGate.jsx'
import PWAUpdatePrompt from './PWAUpdatePrompt.jsx'

// The signed-in dashboard (and Firestore with it) is its own chunk, so the
// landing page never pays to parse it. Returning users start fetching it right
// away — in parallel with Firebase restoring their session — and everyone
// else warms it in idle time so signing in feels instant.
const loadApp = () => import('./App.jsx')
const App = lazy(loadApp)

if (hasSessionHint()) {
  loadApp()
} else if ('requestIdleCallback' in window) {
  window.requestIdleCallback(() => loadApp(), { timeout: 6000 })
} else {
  window.setTimeout(loadApp, 3000)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Mounted outside the auth gate so the update toast reaches every screen,
        including the landing page and stale/comp accounts stuck on old builds. */}
    <PWAUpdatePrompt />
    <AuthProvider>
      <AuthGate>
        <Suspense fallback={<AuthLoadingScreen label="Loading your board…" />}>
          <App />
        </Suspense>
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>,
)
