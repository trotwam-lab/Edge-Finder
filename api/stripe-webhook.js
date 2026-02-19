// api/stripe-webhook.js — Vercel serverless function
// Stripe sends events here when payments happen

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin with service account if available
if (getApps().length === 0) {
  const config = { projectId: 'edgefinder-betting' };
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      config.credential = cert(serviceAccount);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }
  
  initializeApp(config);
}

const db = getFirestore();

export const config = {
  api: {
    bodyParser: false,
  },
};

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

    // Verify webhook signature if secret is configured (REQUIRED for production)
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      // Fallback for development only — NOT SECURE
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const firebaseUID = session.client_reference_id || session.metadata?.firebaseUID;
        
        if (firebaseUID) {
          await db.collection('users').doc(firebaseUID).set({
            tier: 'pro',
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
            email: session.customer_email || session.customer_details?.email,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          
          console.log(`✅ User ${firebaseUID} upgraded to Pro!`);
        } else {
          console.warn('checkout.session.completed but no firebaseUID found in metadata or client_reference_id');
        }
        break;
      }

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

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
