import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb, getTokenVerifierApp } from './_firebaseAdmin.js';
import Stripe from 'stripe';

export const ADMIN_EMAILS = ['admin@edgefinderdaily.com', 'wamelite@yahoo.com', 'wamclawd@gmail.com'];
export const FRIEND_EMAILS = [
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
  'ocean.jackson@gmail.com',
  'wmchapmanfernandez@gmail.com',
];

// Email-based grants (admin/friend lists, Stripe lookup by email) must only
// trust an email the caller actually owns. Firebase password sign-up does not
// verify addresses, so an unverified account could claim a listed friend's or
// a subscriber's email. Accounts created before this rule shipped keep their
// access; newer accounts need a verified email.
export const EMAIL_TRUST_CUTOFF = Date.parse('2026-09-24T00:00:00Z');
const creationTimeCache = new Map();

async function getAccountCreatedAt(uid) {
  if (creationTimeCache.has(uid)) return creationTimeCache.get(uid);
  const app = getAdminApp();
  if (!app) return undefined;
  const user = await getAuth(app).getUser(uid);
  const createdAt = Date.parse(user?.metadata?.creationTime || '');
  const value = Number.isFinite(createdAt) ? createdAt : undefined;
  creationTimeCache.set(uid, value);
  return value;
}

export async function isEmailTrusted(decoded, { lookupCreatedAt = getAccountCreatedAt } = {}) {
  if (!decoded?.email) return false;
  if (decoded.email_verified === true) return true;
  try {
    const createdAt = await lookupCreatedAt(decoded.uid);
    // No admin credentials to check with: keep the previous behaviour rather
    // than demoting every existing complimentary/Stripe account.
    if (createdAt === undefined) return true;
    return createdAt < EMAIL_TRUST_CUTOFF;
  } catch (error) {
    console.warn('Account creation lookup failed:', error.message);
    return true;
  }
}

export function normalizeEmail(email) {
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

function getClientEmailHeader(req) {
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

    // Verify against the client app's Firebase project, never the service
    // account's project — those can differ, and a mismatch used to demote
    // every signed-in user (including Pro) to the free tier.
    const decoded = await getAuth(getTokenVerifierApp()).verifyIdToken(token);
    const tokenEmail = normalizeEmail(decoded.email);
    const email = tokenEmail && await isEmailTrusted(decoded) ? tokenEmail : '';

    if (email && ADMIN_EMAILS.includes(email)) {
      return { tier: 'pro', source: 'admin', uid: decoded.uid, email };
    }

    if (email && FRIEND_EMAILS.includes(email)) {
      return { tier: 'pro', source: 'complimentary', uid: decoded.uid, email };
    }

    // Firestore needs real service-account credentials; if those are broken
    // we still want the verified Stripe lookup below to run.
    try {
      const firestoreTier = await getTierFromFirestore(decoded.uid);
      if (firestoreTier) return { ...firestoreTier, email: tokenEmail };
    } catch (firestoreError) {
      console.warn('Firestore tier lookup failed:', firestoreError.message);
    }

    const stripeTier = await getTierFromStripe(email);
    if (stripeTier) return { ...stripeTier, uid: decoded.uid, email };

    return { tier: 'free', source: 'verified-free', uid: decoded.uid, email: tokenEmail };
  } catch (error) {
    // SECURITY: when token verification fails, the X-EdgeFinder-Email header
    // is the only identity left and it is attacker-controlled — recovering
    // Pro from it would let anyone unlock the paywall by sending a garbage
    // Bearer token plus any subscriber's email. Like the other email
    // fallbacks, it is only honored behind ALLOW_EMAIL_TIER_FALLBACK
    // (local dev / previews). Real clients recover by refreshing the token.
    if (process.env.ALLOW_EMAIL_TIER_FALLBACK === 'true') {
      const headerStripeTier = await getTierFromStripe(getClientEmailHeader(req));
      if (headerStripeTier) {
        return { ...headerStripeTier, source: 'stripe-email-header-auth-error' };
      }
    }

    console.warn('Auth tier check failed:', error.message);
    return { tier: 'free', source: 'auth-error' };
  }
}

// Verify the request's Firebase ID token and return the caller's identity,
// or null. Endpoints that act on an account (billing portal, checkout, tier
// lookup) must derive uid/email from THIS — never from the request body or
// query string, which anyone can spoof.
export async function getVerifiedUser(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    const decoded = await getAuth(getTokenVerifierApp()).verifyIdToken(token);
    const email = normalizeEmail(decoded.email);
    return { uid: decoded.uid, email, emailTrusted: Boolean(email) && await isEmailTrusted(decoded) };
  } catch (error) {
    console.warn('Token verification failed:', error.message);
    return null;
  }
}

export function isProTier(tierInfo) {
  return tierInfo?.tier === 'pro';
}
