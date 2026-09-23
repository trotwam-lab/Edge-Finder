import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';

function formatWhen(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
}

// Settings card: account timestamps, email status, and "sign out of all
// devices" (revokes every session server-side, then signs this device out).
export default function AccountSecurity() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState('idle'); // idle | working | error

  if (!user) return null;

  const signOutEverywhere = async () => {
    if (!confirm('Sign out of EdgeFinder on every device, including this one? Your bets stay saved to your account.')) return;
    setStatus('working');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/revoke-sessions', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await logout();
    } catch {
      setStatus('error');
    }
  };

  const rows = [
    ['Email', `${user.email || '—'}${user.email ? (user.emailVerified ? ' · verified' : ' · not verified') : ''}`],
    ['Account created', formatWhen(user.metadata?.creationTime)],
    ['Last sign-in', formatWhen(user.metadata?.lastSignInTime)],
  ];

  return (
    <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '10px' }}>
        <ShieldCheck size={15} color="#22c55e" />Account security
      </div>
      <div style={{ display: 'grid', gap: '6px', marginBottom: '12px' }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px' }}>
            <span style={{ color: '#64748b' }}>{label}</span>
            <span style={{ color: '#cbd5e1', textAlign: 'right', overflowWrap: 'anywhere' }}>{value}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
        Don't recognize the last sign-in? Sign out everywhere, then reset your password from the sign-in screen.
      </div>
      <button onClick={signOutEverywhere} disabled={status === 'working'} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: status === 'working' ? 'wait' : 'pointer' }}>
        {status === 'working' ? 'Signing out…' : 'Sign out of all devices'}
      </button>
      {status === 'error' && <div style={{ fontSize: '11px', color: '#f87171', marginTop: '8px' }}>Could not sign out other devices. Please try again.</div>}
    </div>
  );
}
