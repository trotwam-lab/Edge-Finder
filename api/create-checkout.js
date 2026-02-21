// ==============================================
// CREATE CHECKOUT SESSION — Vercel Serverless Function
// ==============================================
// When a user clicks "Subscribe to Pro", the frontend calls this endpoint.
// It creates a Stripe Checkout page and returns the URL to redirect the user to.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { userId, email } = req.body;

    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing userId or email in request body.' });
    }

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: 'price_1T1qX14BRKqfJjuBAkGUEmmv', quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://www.edgefinderdaily.com/?checkout=success',
      cancel_url: 'https://www.edgefinderdaily.com/?checkout=cancel',
      client_reference_id: userId,
      customer_email: email,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
}
