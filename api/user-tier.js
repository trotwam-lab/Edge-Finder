// ==============================================
// USER TIER CHECK — Vercel Serverless Function
// ==============================================
// This endpoint checks if a user has an active Pro subscription.
// Instead of storing tier info in our own database, we ask Stripe directly.
// Stripe is the "source of truth" for subscription status.
//
// Usage: GET /api/user-tier?email=user@example.com
// Returns: { tier: 'pro', subscriptionId: 'sub_xxx' } or { tier: 'free' }

import Stripe from 'stripe';

// Admin emails — always Pro, no Stripe subscription needed
const ADMIN_EMAILS = ['admin@edgefinderdaily.com', 'wamelite@yahoo.com'];

// Friends & Family — complimentary Pro access
const FRIEND_EMAILS = [
  'mrxprofit@gmail.com',
  'diajdaley@gmail.com',
  'Wb_sportstalk@yahoo.com',
];

export default async function handler(req, res) {
  // --- CORS HEADERS ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests (reading data FROM the server)
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    // Get the email from the URL query string (e.g., ?email=wam@example.com)
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Missing email query parameter.' });
    }

    // Check admin list first — skip Stripe entirely
    if (ADMIN_EMAILS.includes(email.toLowerCase())) {
      return res.status(200).json({ tier: 'pro', admin: true });
    }

    // Check friends & family list — complimentary Pro access
    if (FRIEND_EMAILS.includes(email.toLowerCase())) {
      return res.status(200).json({ tier: 'pro', complimentary: true });
    }

    // Initialize Stripe only when needed (after admin check)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Search Stripe for customers with this email address
    const customers = await stripe.customers.list({ email: email, limit: 1 });

    // If no customer found, they've never subscribed = free tier
    if (customers.data.length === 0) {
      return res.status(200).json({ tier: 'free' });
    }

    // Get the first matching customer
    const customer = customers.data[0];

    // Check if this customer has any ACTIVE subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    // If they have an active subscription, they're Pro!
    if (subscriptions.data.length > 0) {
      return res.status(200).json({
        tier: 'pro',
        subscriptionId: subscriptions.data[0].id,
      });
    }

    // No active subscription = free tier
    return res.status(200).json({ tier: 'free' });
  } catch (error) {
    console.error('Error checking user tier:', error);
    return res.status(500).json({ error: error.message });
  }
}
