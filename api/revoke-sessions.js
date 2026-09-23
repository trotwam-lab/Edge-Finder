// api/revoke-sessions.js — "Sign out of all devices".
// Revokes every refresh token for the verified caller, so other devices are
// signed out the next time their ID token refreshes (within an hour). The
// calling device signs itself out right after this returns.
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp } from './_firebaseAdmin.js';
import { getVerifiedUser } from './_auth.js';
import { guardRequest } from './_http.js';

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'revoke-sessions', methods: ['POST'], rateLimit: 10 })) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  const caller = await getVerifiedUser(req);
  if (!caller) return res.status(401).json({ error: 'Please sign in again.' });

  const app = getAdminApp();
  if (!app) return res.status(503).json({ error: 'Account service unavailable. Try again later.' });

  try {
    await getAuth(app).revokeRefreshTokens(caller.uid);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Revoke sessions failed:', error.message);
    return res.status(500).json({ error: 'Could not sign out other devices. Please try again.' });
  }
}
