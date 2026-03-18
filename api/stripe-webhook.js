import Stripe from 'stripe';
import { getAdminDb } from './_firebaseAdmin.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function upsertUserSubscription({ uid, email = null, stripeCustomerId = null, tier, status }) {
  const db = getAdminDb();
  if (!db) {
    throw new Error('Firebase admin not configured');
  }

  const userRef = db.collection('users').doc(uid);
  await userRef.set({
    subscriptionTier: tier,
    subscriptionStatus: status,
    stripeCustomerId,
    email,
    subscriptionUpdatedAt: new Date().toISOString(),
  }, { merge: true });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      return res.status(500).json({ error: 'Missing webhook secret' });
    }

    const event = stripe.webhooks.constructEvent(rawBody, sig, secret);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.metadata?.firebaseUID || session.client_reference_id;

      if (uid) {
        await upsertUserSubscription({
          uid,
          email: session.customer_email || null,
          stripeCustomerId: session.customer || null,
          tier: 'pro',
          status: 'active',
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const uid = sub.metadata?.firebaseUID;

      if (uid) {
        await upsertUserSubscription({
          uid,
          stripeCustomerId: sub.customer || null,
          tier: 'free',
          status: 'canceled',
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err);
    return res.status(400).json({ error: err.message });
  }
}
