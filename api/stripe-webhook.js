// api/stripe-webhook.js â Vercel serverless function
// Stripe sends events here when payments happen (checkout completed, subscription canceled, etc.)
//
// HOW WEBHOOKS WORK:
// 1. User pays on Stripe â Stripe sends a POST to this URL
// 2. We read the event type (e.g., "checkout completed")
// 3. We update the user's tier in Firestore (our database)
//
// IMPORTANT: In production, you MUST verify the Stripe signature to prevent fake events.
// For sandbox/testing, we skip verification.

import Stripe from 'stripe';
// Firebase Admin SDK â server-side access to Firestore (different from client SDK)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin (only once â getApps() prevents double-init)
if (getApps().length === 0) {
  initializeApp({
    projectId: 'edgefinder-betting',
    // In production, use a service account key. For now, using project ID only
    // works if Firestore rules allow or if running with proper credentials
  });
}

const db = getFirestore();

// Vercel config: we need the raw body for Stripe signature verification
// This tells Vercel not to parse the body as JSON automatically
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);

    // TODO: In production, verify the webhook signature like this:
    // const sig = req.headers['stripe-signature'];
    // event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    
    // For sandbox testing, we just parse the JSON directly (no signature check)
    event = JSON.parse(rawBody.toString());
  } catch (err) {
    console.error('Webhook parsing error:', err);
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  try {
    // Handle different event types from Stripe
    switch (event.type) {
      // User completed checkout â they just paid! Set them to Pro
      case 'checkout.session.completed': {
        const session = event.data.object;
        const firebaseUID = session.metadata?.firebaseUID;
        
        if (firebaseUID) {
          // Update user's Firestore document to Pro tier
          await db.collection('users').doc(firebaseUID).set({
            tier: 'pro',
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
            updatedAt: new Date().toISOString(),
          }, { merge: true }); // merge: true = don't overwrite other fields
          
          console.log(`â User ${firebaseUID} upgraded to Pro!`);
        }
        break;
      }

      // Subscription was canceled â downgrade to free
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        
        if (firebaseUID) {
          await db.collection('users').doc(firebaseUID).set({
            tier: 'free',
            subscriptionId: null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          
          console.log(`â¬ï¸ User ${firebaseUID} downgraded to free`);
        }
        break;
      }

      // Subscription was updated (e.g., payment failed, reactivated)
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        
        if (firebaseUID) {
          // Check if the subscription is still active
          const isActive = ['active', 'trialing'].includes(subscription.status);
          
          await db.collection('users').doc(firebaseUID).set({
            tier: isActive ? 'pro' : 'free',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          
          console.log(`ð User ${firebaseUID} subscription status: ${subscription.status}`);
        }
        break;
      }

      default:
        // We don't handle this event type â that's fine
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Always return 200 to Stripe so it knows we received the event
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
