// api/stripe-webhook.js — Vercel serverless function
// Stripe sends events here when payments happen (checkout completed, subscription canceled, etc.)
//
// HOW WEBHOOKS WORK:
// 1. User pays on Stripe → Stripe sends a POST to this URL
// 2. We read the event type (e.g., "checkout completed")
// 3. We update the user's tier in Firestore (our database)
//
// SECURITY: Stripe signature verification is enforced in production.
// The raw body must be read before parsing to verify the HMAC signature.

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize Firebase Admin SDK only once (Vercel may reuse instances)
if (getApps().length === 0) {
       const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
       initializeApp({ credential: cert(serviceAccount) });
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
                             // Prefer metadata.firebaseUID; fall back to client_reference_id (set in create-checkout.js)
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

             // Subscription updated (payment failure, reactivation, etc.)
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

             // Payment succeeded on an existing subscription invoice
                case 'invoice.payment_succeeded': {
                             const invoice = event.data.object;
                             const customerId = invoice.customer;
                             // Look up user by stripeCustomerId
                             if (customerId && invoice.subscription) {
                                            const snap = await db.collection('users')
                                              .where('stripeCustomerId', '==', customerId)
                                              .limit(1)
                                              .get();
                                            if (!snap.empty) {
                                                             const userDoc = snap.docs[0];
                                                             await userDoc.ref.set({
                                                                                tier: 'pro',
                                                                                subscriptionId: invoice.subscription,
                                                                                updatedAt: new Date().toISOString(),
                                                             }, { merge: true });
                                                             console.log(`✅ Invoice paid - user ${userDoc.id} remains Pro`);
                                            }
                             }
                             break;
                }

             // Payment failed — optionally flag the account
                case 'invoice.payment_failed': {
                             const invoice = event.data.object;
                             const customerId = invoice.customer;
                             if (customerId) {
                                            const snap = await db.collection('users')
                                              .where('stripeCustomerId', '==', customerId)
                                              .limit(1)
                                              .get();
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

         // Always return 200 to Stripe so it knows we received the event
         return res.status(200).json({ received: true });
  } catch (err) {
           console.error('Webhook handler error:', err);
           return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
