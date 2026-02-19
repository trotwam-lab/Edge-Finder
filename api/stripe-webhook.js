import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export const config = { api: { bodyParser: false } };

// Initialize Firebase Admin
if (getApps().length === 0) {
  const cfg = { projectId: 'edgefinder-9d42e' };
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      cfg.credential = cert(sa);
    } catch (e) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }
  initializeApp(cfg);
}

const db = getFirestore();

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = new Stripe(key);

  let event;
  try {
    const rawBody = await getRawBody(req);
    if (webhookSecret) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    console.log('Stripe event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const firebaseUID = s.client_reference_id || s.metadata?.firebaseUID;
      const email = s.customer_email || s.customer_details?.email;

      console.log('Checkout completed:', email, 'UID:', firebaseUID, 'Sub:', s.subscription);

      if (firebaseUID) {
        await db.collection('users').doc(firebaseUID).set({
          tier: 'pro',
          stripeCustomerId: s.customer,
          subscriptionId: s.subscription,
          email: email,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('User upgraded to Pro in Firestore:', firebaseUID);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const firebaseUID = sub.metadata?.firebaseUID;
      const customerId = sub.customer;
      
      // RETENTION: Check if this is Darryl (first customer - offer free month)
      if (sub.id === 'sub_1T2fWv3swfFjeUB1AyCHeyMG' || customerId === 'cus_U0gul94dvIyJk1') {
        console.log('🚨 RETENTION ALERT: First customer Darryl cancelled!');
        
        try {
          // Create retention coupon (100% off for 1 month)
          const coupon = await stripe.coupons.create({
            name: 'RETENTION_DARRYL_1MONTH_FREE',
            percent_off: 100,
            duration: 'once',
            metadata: { reason: 'Customer retention - first subscriber' }
          });
          console.log('Created retention coupon:', coupon.id);
          
          // Store retention offer in Firestore
          await db.collection('retention_offers').doc(customerId).set({
            customerId: customerId,
            email: 'darryljrice@gmail.com',
            subscriptionId: sub.id,
            couponId: coupon.id,
            status: 'pending',
            message: '1 FREE MONTH offer created - contact customer',
            createdAt: new Date().toISOString(),
          });
          console.log('Retention offer stored for Darryl');
          
        } catch (retentionErr) {
          console.error('Failed to create retention offer:', retentionErr.message);
        }
      }
      
      if (firebaseUID) {
        await db.collection('users').doc(firebaseUID).set({
          tier: 'free',
          subscriptionId: null,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('User downgraded to free:', firebaseUID);
      }
    } else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const firebaseUID = sub.metadata?.firebaseUID;
      if (firebaseUID) {
        const isActive = ['active', 'trialing'].includes(sub.status);
        await db.collection('users').doc(firebaseUID).set({
          tier: isActive ? 'pro' : 'free',
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('User subscription updated:', firebaseUID, sub.status);
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return res.status(500).json({ error: 'Handler failed' });
  }
}
