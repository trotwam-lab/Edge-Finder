import Stripe from 'stripe';
import { getAdminDb } from './_firebaseAdmin.js';

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
  'austinstraley@gmail.com',
  'theinleague317@gmail.com',
  'g5juan3@gmail.com',
    'dylanmedd2018@gmail.com',
    'iksnizol1@gmail.com',
    'domrici57@gmail.com',
    'ferencgary@yahoo.com',
    'dutchboyfresh702@gmail.com',
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
  if (!email) return { tier: 'free', source: 'stripe-fallback' };

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const { email, uid } = req.query;
    const normalizedEmail = typeof email === 'string' ? email.toLowerCase() : '';

    if (!normalizedEmail && !uid) {
      return res.status(400).json({ error: 'Missing email or uid query parameter.' });
    }

    if (normalizedEmail && ADMIN_EMAILS.includes(normalizedEmail)) {
      return res.status(200).json({ tier: 'pro', admin: true });
    }

    if (normalizedEmail && FRIEND_EMAILS.includes(normalizedEmail)) {
      return res.status(200).json({ tier: 'pro', complimentary: true });
    }

    const firestoreTier = await getTierFromFirestore(uid);
    if (firestoreTier) {
      return res.status(200).json(firestoreTier);
    }

    const stripeTier = await getTierFromStripe(normalizedEmail);
    return res.status(200).json(stripeTier);
  } catch (error) {
    console.error('Error checking user tier:', error);
    return res.status(500).json({ error: error.message });
  }
}
