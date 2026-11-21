// ==============================================
// CREATE CHECKOUT SESSION — Vercel Serverless Function
// ==============================================
// When a user clicks "Subscribe to Pro", the frontend calls this endpoint.
// It creates a Stripe Checkout page and returns the URL to redirect the user to.

import Stripe from 'stripe';
import { getVerifiedUser } from './_auth.js';
import { getAdminDb } from './_firebaseAdmin.js';
import { guardRequest } from './_http.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// The Stripe customer already linked to this account, if any. Reusing it
// keeps one account's subscriptions under one customer, so a resubscribe
// can't leave a live subscription on a second customer nobody checks.
async function linkedCustomerId(uid) {
  try {
    const db = getAdminDb();
    if (!db) return null;
    const doc = await db.collection('users').doc(uid).get();
    return (doc.exists && doc.data()?.stripeCustomerId) || null;
  } catch (error) {
    console.warn('Customer lookup failed:', error.message);
    return null;
  }
}

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'create-checkout', methods: ['POST'], rateLimit: 20 })) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // SECURITY: the checkout session binds a firebaseUID to the resulting
    // subscription, so identity must come from a verified token — not the
    // request body, or an attacker could mint sessions that grant Pro to
    // their own UID under someone else's email.
    const caller = await getVerifiedUser(req);
    if (!caller || !caller.email) {
      return res.status(401).json({ error: 'Please sign in again to subscribe.' });
    }
    const userId = caller.uid;
    const email = caller.email;

    // Create a Stripe Checkout Session
    // Trim the price ID to remove any accidental whitespace/newlines
    const priceId = process.env.STRIPE_PRICE_ID?.trim();
    
    if (!priceId) {
      return res.status(500).json({ error: 'STRIPE_PRICE_ID not configured' });
    }
    
    const params = {
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://www.edgefinderdaily.com/?checkout=success',
      cancel_url: 'https://www.edgefinderdaily.com/?checkout=cancel',
      client_reference_id: userId,
      metadata: { firebaseUID: userId },
      subscription_data: { metadata: { firebaseUID: userId } },
    };
    const customerId = await linkedCustomerId(userId);
    let session;
    try {
      session = await stripe.checkout.sessions.create(customerId ? { ...params, customer: customerId } : { ...params, customer_email: email });
    } catch (error) {
      // The linked customer was deleted in Stripe: start fresh by email.
      if (!customerId || error?.code !== 'resource_missing') throw error;
      session = await stripe.checkout.sessions.create({ ...params, customer_email: email });
    }

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
}
