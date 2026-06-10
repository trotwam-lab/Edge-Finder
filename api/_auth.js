import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb } from './_firebaseAdmin.js';
import Stripe from 'stripe';

const ADMIN_EMAILS = ['admin@edgefinderdaily.com', 'wamelite@yahoo.com'];
const FRIEND_EMAILS = [
  'mrxprofit@gmail.com',
  'diajdaley@gmail.com',
  'wb_sportstalk@yahoo.com',
  'darryljrice@gmail.com',
  'rcabang@gmail.com',
  'jimmythebag@hotmail.com',
  'jeremyahthompson00@gmail.com',
  'bobano350@gmail.com',
  'razorsharppicksllc@yahoo.com',
  'btrainbrizbane@gmail.com',
  'sosathelocksmith@gmail.com',
  'vchterry@gmail.com',
  'rnegron1105@icloud.com',
  'merobinson19@gmail.com',
  'theinleague317@gmail.com',
  'g5juan3@gmail.com',
  'dylanmedd2018@gmail.com',
  'iksnizol1@gmail.com',
  'domrici57@gmail.com',
  'ferencgary@yahoo.com',
  'dutchboyfresh702@gmail.com',
];

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  if (typeof header !== 'string') return '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

// SECURITY: the X-EdgeFinder-Email header is client-supplied and unverified —
// anyone can send it. It must NEVER grant Pro in production, or the full
// odds/edges/props payloads are one curl command away. It is only honored
// when ALLOW_EMAIL_TIER_FALLBACK=true is set explicitly (local dev /
// preview deployments without Firebase Admin credentials).
function getUnverifiedFallbackEmail(req) {
  if (process.env.ALLOW_EMAIL_TIER_FALLBACK !== 'true') return '';
  return normalizeEmail(req.headers['x-edgefinder-email'] || req.headers['X-EdgeFinder-Email']);
}

async function getTierFromFirestore(uid) {
  if (!uid) return null;
  const db = getAdminDb();
  if (!db) return null;

  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;

  const data = doc.data() || {};
  if (data.subscriptionTier === 'pro' && data.subscriptionStatus === 'active') {
    return { tier: 'pro', source: 'firestore', uid };
  }

  if (data.subscriptionTier === 'free') {
    return { tier: 'free', source: 'firestore', uid };
  }

  return null;
}

async function getTierFromStripe(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !process.env.STRIPE_SECRET_KEY) return null;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const customers = await stripe.customers.list({ email: normalizedEmail, limit: 1 });
    const customer = customers.data[0];
    if (!customer) return null;

    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10,
    });

    const activeSubscription = subscriptions.data.find(subscription =>
      ['active', 'trialing'].includes(subscription.status)
    );

    return activeSubscription
      ? { tier: 'pro', source: 'stripe', subscriptionId: activeSubscription.id }
      : null;
  } catch (error) {
    console.warn('Stripe tier fallback failed:', error.message);
    return null;
  }
}

export async function getRequestTier(req) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      const fallbackEmail = getUnverifiedFallbackEmail(req);
      if (fallbackEmail && ADMIN_EMAILS.includes(fallbackEmail)) {
        return { tier: 'pro', source: 'admin-email-fallback', email: fallbackEmail };
      }
      if (fallbackEmail && FRIEND_EMAILS.includes(fallbackEmail)) {
        return { tier: 'pro', source: 'complimentary-email-fallback', email: fallbackEmail };
      }
      return { tier: 'free', source: 'anonymous' };
    }

    const app = getAdminApp();
    if (!app) {
      const fallbackEmail = getUnverifiedFallbackEmail(req);
      if (fallbackEmail && ADMIN_EMAILS.includes(fallbackEmail)) {
        return { tier: 'pro', source: 'admin-email-fallback', email: fallbackEmail };
      }
      if (fallbackEmail && FRIEND_EMAILS.includes(fallbackEmail)) {
        return { tier: 'pro', source: 'complimentary-email-fallback', email: fallbackEmail };
      }
      return { tier: 'free', source: 'admin-not-configured' };
    }

    const decoded = await getAuth(app).verifyIdToken(token);
    const email = normalizeEmail(decoded.email);

    if (email && ADMIN_EMAILS.includes(email)) {
      return { tier: 'pro', source: 'admin', uid: decoded.uid, email };
    }

    if (email && FRIEND_EMAILS.includes(email)) {
      return { tier: 'pro', source: 'complimentary', uid: decoded.uid, email };
    }

    const firestoreTier = await getTierFromFirestore(decoded.uid);
    if (firestoreTier) return { ...firestoreTier, email };

    const stripeTier = await getTierFromStripe(email);
    if (stripeTier) return { ...stripeTier, uid: decoded.uid, email };

    return { tier: 'free', source: 'verified-free', uid: decoded.uid, email };
  } catch (error) {
    // A failed token verification must never fall back to the unverified
    // email header — an attacker would just send a garbage token plus a
    // known comp email. Failed verification is always free tier.
    console.warn('Auth tier check failed:', error.message);
    return { tier: 'free', source: 'auth-error' };
  }
}

export function isProTier(tierInfo) {
  return tierInfo?.tier === 'pro';
}
