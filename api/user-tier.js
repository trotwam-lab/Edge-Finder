// ==============================================
// USER TIER CHECK — Vercel Serverless Function
// ==============================================
// This endpoint checks if a user has an active Pro subscription.
// Stripe is the source of truth for subscription status.
//
// Usage: GET /api/user-tier?email=user@example.com
// Returns: { tier: 'pro', subscriptionId: 'sub_xxx' } or { tier: 'free' }

import Stripe from 'stripe';

// Admin emails — always Pro, no Stripe subscription needed
// All stored lowercase for case-insensitive matching
const ADMIN_EMAILS = ['admin@edgefinderdaily.com', 'wamelite@yahoo.com'];

// Friends & Family — complimentary Pro access
// All stored lowercase for case-insensitive matching
const FRIEND_EMAILS = [
  'mrxprofit@gmail.com',
  'diajdaley@gmail.com',
  'wb_sportstalk@yahoo.com',
  'darryljrice@gmail.com',
  'rcabang@gmail.com',
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

    const emailLower = email.toLowerCase().trim();

    // Check admin list first — skip Stripe entirely
    if (ADMIN_EMAILS.includes(emailLower)) {
      return res.status(200).json({ tier: 'pro', admin: true });
    }

    // Check friends & family list — complimentary Pro access
    if (FRIEND_EMAILS.includes(emailLower)) {
      return res.status(200).json({ tier: 'pro', complimentary: true });
    }

    // Initialize Stripe only when needed (after admin check)
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Search Stripe for customers with this email address
    const customers = await stripe.customers.list({ email: emailLower, limit: 5 });

    // If no customer found, they've never subscribed = free tier
    if (customers.data.length === 0) {
      return res.status(200).json({ tier: 'free' });
    }

    // Check ALL matching customers for active or trialing subscriptions
    // (a user might have multiple Stripe customer records from different checkouts)
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 5,
      });

      // Check for any active or trialing subscription
      const activeSub = subscriptions.data.find(sub =>
        sub.status === 'active' || sub.status === 'trialing'
      );

      if (activeSub) {
        return res.status(200).json({
          tier: 'pro',
          subscriptionId: activeSub.id,
          status: activeSub.status,
        });
      }
    }

    // No active subscription found across any customer record = free tier
    return res.status(200).json({ tier: 'free' });
  } catch (error) {
    console.error('Error checking user tier:', error);
    // On Stripe error, don't lock users out — return free gracefully
    return res.status(200).json({ tier: 'free', error: 'tier_check_failed' });
  }
}
