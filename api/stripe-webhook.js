// api/stripe-webhook.js - Clean working version
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase
let db = null;
let firebaseInitialized = false;

try {
  if (getApps().length === 0 && process.env.FIREBASE_SERVICE_ACCOUNT) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    // Clean up the JSON
    const cleaned = raw
      .replace(/\\n/g, '\n')
      .replace(/\r/g, '');
    const serviceAccount = JSON.parse(cleaned);
    
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    
    initializeApp({ credential: cert(serviceAccount) });
    firebaseInitialized = true;
    db = getFirestore();
    console.log('Firebase initialized');
  }
} catch (e) {
  console.error('Firebase init error:', e.message);
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!firebaseInitialized || !db) {
    console.error('Firebase not ready');
    return res.status(500).json({ error: 'Database not ready' });
  }

  try {
    const rawBody = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });

    const sig = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!secret) {
      return res.status(500).json({ error: 'Missing webhook secret' });
    }

    const event = stripe.webhooks.constructEvent(rawBody, sig, secret);
    console.log('Event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.metadata?.firebaseUID || session.client_reference_id;
      
      if (uid) {
        await db.collection('users').doc(uid).set({
          tier: 'pro',
          stripeCustomerId: session.customer,
          subscriptionId: session.subscription,
          email: session.customer_email,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log('User upgraded:', uid);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
// Deployment trigger - $(date)
