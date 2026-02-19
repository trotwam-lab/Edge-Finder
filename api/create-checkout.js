// ==============================================
// CREATE CHECKOUT SESSION — Vercel Serverless Function
// ==============================================
// Creates a Stripe Checkout page when user clicks "Subscribe to Pro"

import Stripe from 'stripe';
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://edgefinderdaily.com';

    const session = await stripeClient.checkout.sessions.create({
      line_items: [{ price: 'price_1T215u3swfFjeUB1wzDerK1u', quantity: 1 }],
      mode: 'subscription',
      success_url: `${baseUrl}/?checkout=success`,
      cancel_url: `${baseUrl}/?checkout=cancel`,
      client_reference_id: userId,
      customer_email: email,
      metadata: {
        firebaseUID: userId,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
}
