import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './theme.css'
import './mobile.css'
import { AuthProvider } from './AuthGate.jsx'
import AuthGate from './AuthGate.jsx'
import PWAUpdatePrompt from './PWAUpdatePrompt.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* Mounted outside the auth gate so the update toast reaches every screen,
        including the landing page and stale/comp accounts stuck on old builds. */}
    <PWAUpdatePrompt />
    <AuthProvider>
      <AuthGate>
        <App />
      </AuthGate>
    </AuthProvider>
  </React.StrictMode>,
)
