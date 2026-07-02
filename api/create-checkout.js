// ==============================================
// CREATE CHECKOUT SESSION — Vercel Serverless Function
// ==============================================
// When a user clicks "Subscribe to Pro", the frontend calls this endpoint.
// It creates a Stripe Checkout page and returns the URL to redirect the user to.

import Stripe from 'stripe';
import { getVerifiedUser } from './_auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    
    const session = await stripe.checkout.sessions.create({
            line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://www.edgefinderdaily.com/?checkout=success',
      cancel_url: 'https://www.edgefinderdaily.com/?checkout=cancel',
      client_reference_id: userId,
      customer_email: email,
              metadata: { firebaseUID: userId },
              subscription_data: { metadata: { firebaseUID: userId } },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Could not start checkout. Please try again.' });
  }
}
