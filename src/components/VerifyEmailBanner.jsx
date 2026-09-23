import React, { useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { MailCheck, X } from 'lucide-react';
import { readJSON, writeJSON } from '../utils/storage.js';

const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const snoozeKey = (uid) => `edgefinder_verify_email_snooze_${uid}`;

// Nudge for password accounts whose email isn't verified yet. Nothing is
// blocked; verifying just proves the address belongs to this account, which
// email-based access (complimentary lists, Stripe lookup) requires for new
// accounts.
export default function VerifyEmailBanner({ user }) {
  const [dismissed, setDismissed] = useState(() => {
    const until = user?.uid ? readJSON(snoozeKey(user.uid), 0) : 0;
    return Number(until) > Date.now();
  });
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error | verified

  if (!user || user.emailVerified || dismissed || status === 'verified') return null;
  const isPasswordAccount = user.providerData?.some(p => p?.providerId === 'password');
  if (!isPasswordAccount) return null;

  const resend = async () => {
    setStatus('sending');
    try {
      await sendEmailVerification(user);
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  const recheck = async () => {
    try {
      await user.reload();
      if (user.emailVerified) {
        await user.getIdToken(true);
        setStatus('verified');
      }
    } catch {}
  };

  const message = {
    idle: `Verify ${user.email} to secure your account.`,
    sending: 'Sending verification email…',
    sent: `Verification email sent to ${user.email}. Check your inbox and spam folder.`,
    error: 'Could not send the email right now. Try again in a minute.',
  }[status];

  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '10px auto 0', maxWidth: '1180px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,200,255,0.08)', border: '1px solid rgba(0,200,255,0.25)', color: '#bae6fd', fontSize: '12px' }}>
      <MailCheck size={15} />
      <span style={{ flex: '1 1 220px' }}>{message}</span>
      {status !== 'sending' && (
        <button onClick={resend} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(0,200,255,0.4)', background: 'transparent', color: '#7dd3fc', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
          {status === 'sent' ? 'Resend' : 'Send verification email'}
        </button>
      )}
      <button onClick={recheck} style={{ padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(71,85,105,0.4)', background: 'transparent', color: '#cbd5e1', fontSize: '11px', cursor: 'pointer' }}>
        I've verified
      </button>
      <button onClick={() => { writeJSON(snoozeKey(user.uid), Date.now() + SNOOZE_MS); setDismissed(true); }} aria-label="Dismiss for a week" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: 2 }}>
        <X size={14} />
      </button>
    </div>
  );
}
