// api/stripe-webhook.js — Vercel serverless function
// Stripe sends events here when payments happen (checkout completed, subscription canceled, etc.)

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------------------------------------------------------------------
// Firebase Admin init — handle FIREBASE_SERVICE_ACCOUNT env var quirks.
// Vercel can store the JSON with literal newline chars inside the private_key,
// which makes JSON.parse throw "Bad control character". We strip those out
// and re-escape them so parsing succeeds.
// ---------------------------------------------------------------------------
function parseServiceAccount(raw) {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  // Replace literal newlines inside JSON string values with \n so JSON.parse works
  // This covers both actual \n bytes and doubly-escaped \\n sequences.
  const sanitized = raw
    .replace(/\r/g, '')                         // strip carriage returns
    .replace(/([^\\])\n/g, '$1\\n');        // real newline → escaped \n
  return JSON.parse(sanitized);
}

if (getApps().length === 0) {
  try {
    const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    // Also normalize the private_key field itself (double-escaped \\n → real \n)
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    initializeApp({ credential: cert(serviceAccount) });
  } catch (e) {
    console.error('Firebase Admin init error:', e.message);
  }
}

const db = getFirestore();

// Vercel config: disable body parser so we can verify the raw Stripe signature
export const config = {
  api: {
    bodyParser: false,
  },
};

// Read raw body bytes from request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.Stripe_Webhook_Key;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Webhook parsing error:', err);
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  try {
    switch (event.type) {
      // User completed checkout — upgrade to Pro
      case 'checkout.session.completed': {
        const session = event.data.object;
        const firebaseUID = session.metadata?.firebaseUID || session.client_reference_id;
        if (firebaseUID) {
          await db.collection('users').doc(firebaseUID).set({
            tier: 'pro',
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`✅ User ${firebaseUID} upgraded to Pro`);
        } else {
          console.warn('checkout.session.completed: no firebaseUID in metadata or client_reference_id');
        }
        break;
      }

      // Subscription canceled — downgrade to free
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        if (firebaseUID) {
          await db.collection('users').doc(firebaseUID).set({
            tier: 'free',
            subscriptionId: null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`⬇️ User ${firebaseUID} downgraded to free`);
        }
        break;
      }

      // Subscription updated
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        if (firebaseUID) {
          const isActive = ['active', 'trialing'].includes(subscription.status);
          await db.collection('users').doc(firebaseUID).set({
            tier: isActive ? 'pro' : 'free',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`🔄 User ${firebaseUID} subscription status: ${subscription.status}`);
        }
        break;
      }

      // Invoice paid — keep Pro
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        if (customerId && invoice.subscription) {
          const snap = await db.collection('users')
            .where('stripeCustomerId', '==', customerId)
            .limit(1).get();
          if (!snap.empty) {
            await snap.docs[0].ref.set({
              tier: 'pro',
              subscriptionId: invoice.subscription,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            console.log(`✅ Invoice paid - user ${snap.docs[0].id} remains Pro`);
          }
        }
        break;
      }

      // Invoice payment failed
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        if (customerId) {
          const snap = await db.collection('users')
            .where('stripeCustomerId', '==', customerId)
            .limit(1).get();
          if (!snap.empty) {
            await snap.docs[0].ref.set({
              paymentFailed: true,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            console.warn(`⚠️ Payment failed for customer ${customerId}`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
