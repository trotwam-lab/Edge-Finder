// Trigger redeploy
// api/stripe-webhook.js - Supabase only
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
let supabaseReady = false;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    supabaseReady = true;
    console.log('✅ Supabase connected');
  } catch (e) {
    console.error('❌ Supabase error:', e.message);
  }
} else {
  console.error('❌ Missing Supabase credentials');
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  console.log(`🚀 Webhook: ${req.method} ${new Date().toISOString()}`);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseReady || !supabase) {
    console.error('❌ Supabase not ready');
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
    console.log(`✅ Event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const uid = session.metadata?.firebaseUID || session.client_reference_id;
      
      if (uid) {
        const { error } = await supabase
          .from('users')
          .upsert({
            id: uid,
            email: session.customer_email,
            stripe_customer_id: session.customer,
            subscription_tier: 'pro',
            subscription_status: 'active',
            updated_at: new Date().toISOString()
          });
        
        if (error) {
          console.error('❌ Supabase error:', error);
          throw error;
        }
        console.log(`✅ User ${uid} upgraded to Pro`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const uid = sub.metadata?.firebaseUID;
      
      if (uid) {
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq('id', uid);
        console.log(`⬇️ User ${uid} downgraded`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Error:', err.message);
    return res.status(400).json({ error: err.message });
  }
}
