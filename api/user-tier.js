// ==============================================
// USER TIER CHECK — Vercel Serverless Function
// ==============================================
// Checks if a user has an active Pro subscription via Stripe.
// Usage: GET /api/user-tier?email=user@example.com
// Returns: { tier: 'pro', subscriptionId: 'sub_xxx' } or { tier: 'free' }

import Stripe from 'stripe';
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Missing email query parameter.' });
    }

    const customers = await stripeClient.customers.list({ email: email, limit: 1 });

    if (customers.data.length === 0) {
      return res.status(200).json({ tier: 'free' });
    }

    const customer = customers.data[0];

    const subscriptions = await stripeClient.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length > 0) {
      return res.status(200).json({
        tier: 'pro',
        subscriptionId: subscriptions.data[0].id,
      });
    }

    return res.status(200).json({ tier: 'free' });
  } catch (error) {
    console.error('Error checking user tier:', error);
    return res.status(500).json({ error: 'Failed to check user tier' });
  }
}
