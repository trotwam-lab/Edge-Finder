import Stripe from 'stripe';
import { getAdminDb } from './_firebaseAdmin.js';
import { getVerifiedUser } from './_auth.js';

const ADMIN_EMAILS = ['admin@edgefinderdaily.com', 'wamelite@yahoo.com', 'wamclawd@gmail.com'];
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
    'ocean.jackson@gmail.com',
];

async function getTierFromFirestore(uid) {
  if (!uid) return null;
  const db = getAdminDb();
  if (!db) return null;

  const doc = await db.collection('users').doc(uid).get();
  if (!doc.exists) return null;

  const data = doc.data() || {};
  if (data.subscriptionTier === 'pro' && data.subscriptionStatus === 'active') {
    return { tier: 'pro', source: 'firestore' };
  }

  if (data.subscriptionTier === 'free') {
    return { tier: 'free', source: 'firestore' };
  }

  return null;
}

async function getTierFromStripe(email) {
  if (!email || !process.env.STRIPE_SECRET_KEY) return { tier: 'free', source: 'stripe-fallback' };

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const customers = await stripe.customers.list({ email, limit: 1 });

  if (customers.data.length === 0) {
    return { tier: 'free', source: 'stripe-fallback' };
  }

  const customer = customers.data[0];
  const subscriptions = await stripe.subscriptions.list({
    customer: customer.id,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length > 0) {
    return {
      tier: 'pro',
      subscriptionId: subscriptions.data[0].id,
      source: 'stripe-fallback',
    };
  }

  return { tier: 'free', source: 'stripe-fallback' };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    // SECURITY: identity comes from the verified token, never the query
    // string — otherwise this endpoint is a public oracle that reveals
    // whether any email address has an active subscription.
    const caller = await getVerifiedUser(req);
    if (!caller) {
      return res.status(401).json({ error: 'Sign in to check subscription tier.' });
    }
    const normalizedEmail = caller.email;
    const uid = caller.uid;

    if (normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail)) {
      return res.status(200).json({ tier: 'pro', admin: true });
    }

    if (normalizedEmail && FRIEND_EMAILS.includes(normalizedEmail)) {
      return res.status(200).json({ tier: 'pro', complimentary: true });
    }

    // Firestore requires valid service-account credentials; fall through to
    // Stripe rather than failing the whole tier check if they're broken.
    try {
      const firestoreTier = await getTierFromFirestore(uid);
      if (firestoreTier) {
        return res.status(200).json(firestoreTier);
      }
    } catch (firestoreError) {
      console.warn('Firestore tier lookup failed:', firestoreError.message);
    }

    const stripeTier = await getTierFromStripe(normalizedEmail);
    return res.status(200).json(stripeTier);
  } catch (error) {
    console.error('Error checking user tier:', error);
    return res.status(500).json({ error: 'Tier check failed. Please try again.' });
  }
}
