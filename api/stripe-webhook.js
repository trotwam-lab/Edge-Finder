// api/stripe-webhook.js — Vercel serverless function
// Stripe sends events here when payments happen (checkout completed, subscription canceled, etc.)
//
// HOW IT WORKS:
// 1. User pays on Stripe -> Stripe sends a POST to this URL
// 2. We verify the signature, read the event type
// 3. We update the user's tier in Firestore
// 4. The frontend's user-tier API checks Stripe directly as the primary source of truth,
//    so even if the webhook fails, users still get Pro access on next page load.
//    Firestore is a fast-cache / backup — not the only path.

import Stripe from 'stripe';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin (only once — getApps() prevents double-init)
if (getApps().length === 0) {
  initializeApp({
    projectId: 'edgefinder-9d42e',
  });
}

const db = getFirestore();

// Vercel config: we need the raw body for Stripe signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to read raw body from request stream
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Helper: get the customer email from Stripe when we only have a customer ID
async function getCustomerEmail(customerId) {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    return customer.email || null;
  } catch {
    return null;
  }
}

// Helper: write tier to Firestore using whatever identifier we have
// Tries firebaseUID first, falls back to email-based document
async function writeTier(tier, { firebaseUID, email, customerId, subscriptionId }) {
  const data = {
    tier,
    updatedAt: new Date().toISOString(),
    ...(customerId && { stripeCustomerId: customerId }),
    ...(subscriptionId && { subscriptionId }),
    ...(email && { email }),
  };

  // If we have a firebaseUID, write to users/{uid}
  if (firebaseUID) {
    await db.collection('users').doc(firebaseUID).set(data, { merge: true });
    console.log(`[webhook] users/${firebaseUID} -> tier: ${tier}`);
    return;
  }

  // Fallback: write to users_by_email/{email} so we have a record
  if (email) {
    const emailKey = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await db.collection('users_by_email').doc(emailKey).set(data, { merge: true });
    console.log(`[webhook] users_by_email/${emailKey} -> tier: ${tier}`);
    return;
  }

  console.warn('[webhook] No firebaseUID or email — cannot write tier');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);

    // Verify the webhook signature for security
    const sig = req.headers['stripe-signature'];
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || process.env.Stripe_Webhook_Key
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Webhook parsing error:', err);
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  console.log(`[Firebase webhook] Received event: ${event.type} (id: ${event.id})`);

  try {
    switch (event.type) {
      // User completed checkout — they just paid! Set them to Pro
      case 'checkout.session.completed': {
        const session = event.data.object;
        const firebaseUID = session.metadata?.firebaseUID || session.client_reference_id;
        const email = session.metadata?.email || session.customer_email || session.customer_details?.email;

        console.log(`[Firebase webhook] Checkout completed — email: ${email}, uid: ${firebaseUID}, customer: ${session.customer}`);

        await writeTier('pro', {
          firebaseUID,
          email,
          customerId: session.customer,
          subscriptionId: session.subscription,
        });
        break;
      }

      // Subscription was canceled — downgrade to free
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        const email = subscription.metadata?.email || await getCustomerEmail(subscription.customer);

        console.log(`[Firebase webhook] Subscription deleted — email: ${email}, uid: ${firebaseUID}, sub: ${subscription.id}`);

        await writeTier('free', {
          firebaseUID,
          email,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
        });
        break;
      }

      // Subscription was updated (e.g., payment failed, reactivated)
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        const email = subscription.metadata?.email || await getCustomerEmail(subscription.customer);
        const isActive = ['active', 'trialing'].includes(subscription.status);

        console.log(`[Firebase webhook] Subscription updated — email: ${email}, uid: ${firebaseUID}, status: ${subscription.status}, active: ${isActive}`);

        await writeTier(isActive ? 'pro' : 'free', {
          firebaseUID,
          email,
          customerId: subscription.customer,
          subscriptionId: subscription.id,
        });
        break;
      }

      // Payment failed on renewal — downgrade
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const email = invoice.customer_email || await getCustomerEmail(invoice.customer);

        console.log(`[Firebase webhook] Invoice payment failed — email: ${email}, customer: ${invoice.customer}`);

        if (email) {
          await writeTier('free', {
            email,
            customerId: invoice.customer,
          });
        } else {
          console.warn('[Firebase webhook] Payment failed but no email found — cannot update tier');
        }
        break;
      }

      default:
        console.log(`[Firebase webhook] Unhandled event type: ${event.type}`);
    }

    // Always return 200 to Stripe so it knows we received the event
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Firebase webhook] Handler error:', err);
    // Still return 200 — we don't want Stripe to keep retrying if Firestore write fails.
    // The user-tier API checks Stripe directly as the primary source of truth anyway.
    return res.status(200).json({ received: true, warning: 'handler_error' });
  }
}
