// api/stripe-webhook.js — Vercel serverless function
// Saves to BOTH Firebase AND Supabase

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createClient } from '@supabase/supabase-js';

// Check required env vars
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET'
];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase
let db;
let firebaseInitialized = false;

if (getApps().length === 0 && process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccount = JSON.parse(raw.replace(/\r/g, '').replace(/([^\\])\n/g, '$1\\n'));
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized');
    firebaseInitialized = true;
  } catch (e) {
    console.error('❌ Firebase init error:', e.message);
  }
}

if (firebaseInitialized) {
  try {
    db = getFirestore();
    console.log('✅ Firestore connected');
  } catch (e) {
    console.error('❌ Firestore error:', e.message);
  }
}

// Initialize Supabase
let supabase = null;
let supabaseInitialized = false;

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    console.log('✅ Supabase initialized');
    supabaseInitialized = true;
  } catch (e) {
    console.error('❌ Supabase init error:', e.message);
  }
}

// Helper to save to both databases
async function saveToBoth(userId, data) {
  const results = { firebase: null, supabase: null };
  
  if (firebaseInitialized && db) {
    try {
      await db.collection('users').doc(userId).set(data, { merge: true });
      results.firebase = 'success';
    } catch (e) {
      results.firebase = 'error';
      console.error('Firebase save error:', e.message);
    }
  }
  
  if (supabaseInitialized && supabase) {
    try {
      const { error } = await supabase.from('users').upsert({
        id: userId,
        ...data,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;
      results.supabase = 'success';
    } catch (e) {
      results.supabase = 'error';
      console.error('Supabase save error:', e.message);
    }
  }
  
  return results;
}

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  console.log(`🚀 Webhook: ${req.method} ${new Date().toISOString()}`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!firebaseInitialized && !supabaseInitialized) {
    console.error('❌ No database available');
    return res.status(500).json({ error: 'No database connection' });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.Stripe_Webhook_Key;
    
    if (!webhookSecret) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    console.log(`✅ Event: ${event.type}`);
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    return res.status(400).json({ error: 'Invalid webhook' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata?.firebaseUID || session.client_reference_id;
        
        if (uid) {
          const results = await saveToBoth(uid, {
            tier: 'pro',
            stripeCustomerId: session.customer,
            subscriptionId: session.subscription,
            email: session.customer_email,
            updatedAt: new Date().toISOString()
          });
          console.log(`✅ Checkout: ${uid} (FB: ${results.firebase}, SB: ${results.supabase})`);
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const uid = sub.metadata?.firebaseUID;
        
        if (uid) {
          const results = await saveToBoth(uid, {
            tier: 'free',
            subscriptionId: null,
            updatedAt: new Date().toISOString()
          });
          console.log(`⬇️ Canceled: ${uid} (FB: ${results.firebase}, SB: ${results.supabase})`);
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const uid = sub.metadata?.firebaseUID;
        
        if (uid) {
          const isActive = ['active', 'trialing'].includes(sub.status);
          const results = await saveToBoth(uid, {
            tier: isActive ? 'pro' : 'free',
            updatedAt: new Date().toISOString()
          });
          console.log(`🔄 Updated: ${uid} = ${sub.status} (FB: ${results.firebase}, SB: ${results.supabase})`);
        }
        break;
      }
      
      default:
        console.log(`ℹ️ Unhandled: ${event.type}`);
    }
    
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
