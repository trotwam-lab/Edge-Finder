import Stripe from 'stripe';
import { getAdminDb } from './_firebaseAdmin.js';
import { customerIdOf, resolveUid, syncUserSubscription } from './_subscriptions.js';

let stripeClient = null;
function getStripe() {
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

export const config = { api: { bodyParser: false } };

// Every change to a subscription's state. Each one re-reads the account's
// subscriptions from Stripe (see _subscriptions.js), so a renewal that fails
// for good (canceled / unpaid), a pause or a cancellation downgrades the
// account, and a resume or reactivation restores it. Before this, only
// checkout and deletion were handled — and deletion only for subscriptions
// carrying the uid in their metadata — so lapsed accounts could keep Pro.
const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
]);

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res, deps = {}) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Missing webhook secret' });
  }

  const stripe = deps.stripe || getStripe();
  let event;
  try {
    const rawBody = deps.rawBody ?? await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], secret);
  } catch (err) {
    console.error('Stripe webhook signature check failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const db = 'db' in deps ? deps.db : getAdminDb();
    if (!db) throw new Error('Firebase admin not configured');

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.metadata?.firebaseUID || session.client_reference_id;
      const customerId = customerIdOf(session);
      if (uid && customerId && (!session.mode || session.mode === 'subscription')) {
        await syncUserSubscription({
          stripe, db, uid, customerIds: [customerId],
          email: session.customer_email || session.customer_details?.email || null,
        });
      }
    } else if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const sub = event.data.object;
      const customerId = customerIdOf(sub);
      const uid = await resolveUid(db, { metadataUid: sub.metadata?.firebaseUID, customerId });
      if (uid) {
        await syncUserSubscription({ stripe, db, uid, customerIds: [customerId] });
      } else {
        console.warn(`Stripe ${event.type}: no EdgeFinder account for customer ${customerId}`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    // 500 so Stripe retries the event later.
    console.error('Stripe webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}
