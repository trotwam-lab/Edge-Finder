// api/push.js — device subscriptions for background line-move alerts.
//
// GET  ?task=key                         → { enabled, publicKey }
// POST { action: 'subscribe', subscription, watch } → register this device
// POST { action: 'sync', watch }         → update watched games
// POST { action: 'unsubscribe', endpoint } → remove this device
//
// Identity comes from the verified Firebase ID token. Alerts are sent by the
// scheduled job (api/ledger-maintenance.js?task=alerts).

import { getVerifiedUser } from './_auth.js';
import { getAdminDb } from './_firebaseAdmin.js';
import { guardRequest } from './_http.js';
import { MAX_DEVICES, PUSH_COLLECTION, pushConfig, sanitizeSubscription, sanitizeWatch } from './_alerts.js';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export default async function handler(req, res, deps = {}) {
  if (guardRequest(req, res, { route: 'push', methods: ['GET', 'POST'], rateLimit: 30 })) return;
  res.setHeader('Cache-Control', 'no-store');
  const config = pushConfig();

  if (req.method === 'GET' && req.query?.task === 'key') {
    return res.status(200).json(config ? { enabled: true, publicKey: config.publicKey } : { enabled: false });
  }
  if (req.method !== 'POST') return res.status(400).json({ error: 'Unknown request' });
  if (!config) return res.status(200).json({ enabled: false });

  const user = await (deps.getVerifiedUser || getVerifiedUser)(req);
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });
  const db = 'db' in deps ? deps.db : getAdminDb();
  if (!db) return res.status(200).json({ enabled: false });

  const body = parseBody(req);
  const ref = db.collection(PUSH_COLLECTION).doc(user.uid);
  try {
    if (body.action === 'subscribe') {
      const subscription = sanitizeSubscription(body.subscription);
      if (!subscription) return res.status(400).json({ error: 'Invalid subscription.' });
      const snap = await ref.get();
      const existing = snap.exists ? (snap.data().subscriptions || []) : [];
      const subscriptions = [...existing.filter(s => s.endpoint !== subscription.endpoint), subscription].slice(-MAX_DEVICES);
      await ref.set({ subscriptions, watch: sanitizeWatch(body.watch), updatedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ ok: true, devices: subscriptions.length });
    }
    if (body.action === 'sync') {
      await ref.set({ watch: sanitizeWatch(body.watch), updatedAt: new Date().toISOString() }, { merge: true });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'unsubscribe') {
      const snap = await ref.get();
      if (snap.exists) {
        const subscriptions = (snap.data().subscriptions || []).filter(s => s.endpoint !== body.endpoint);
        await ref.set({ subscriptions }, { merge: true });
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('push route failed:', error.message);
    return res.status(500).json({ error: 'Could not update alerts.' });
  }
}
