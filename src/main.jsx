import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './theme.css'
import './mobile.css'
import { AuthProvider } from './AuthGate.jsx'
import AuthGate from './AuthGate.jsx'
import PWAUpdatePrompt from './PWAUpdatePrompt.jsx'
import PublicReceipts from './components/PublicReceipts.jsx'

// /receipts is the public, shareable track-record page — no login wall.
// It still mounts AuthProvider (components read tier from context; logged-out
// visitors resolve to 'free') but skips AuthGate entirely.
const isPublicReceipts = window.location.pathname.replace(/\/+$/, '') === '/receipts'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Mounted outside the auth gate so the update toast reaches every screen,
        including the landing page and stale/comp accounts stuck on old builds. */}
    <PWAUpdatePrompt />
    <AuthProvider>
      {isPublicReceipts ? (
        <PublicReceipts />
      ) : (
        <AuthGate>
          <App />
        </AuthGate>
      )}
    </AuthProvider>
  </React.StrictMode>,
)
