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
  'charlespenn1988@yahoo.com',
  'bobano350@gmail.com',
  'chrisbecappinn@gmail.com',
  'razorsharppicksllc@yahoo.com',
  'btrainbrizbane@gmail.com',
  'sosathelocksmith@gmail.com',
  'dutchboyfresh702@gmail.com',
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

    // Check ALL matching customers for active subscriptions
    // (a user might have multiple Stripe customer records from different checkouts)
    for (const customer of customers.data) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        limit: 10,
      });

      // Check for any active, trialing, or past_due subscription
      // - active: subscription is fully paid and current
      // - trialing: subscription is in a trial period
      // - past_due: payment failed but subscription is still technically active
      //   (user should retain access during grace period)
      const activeSub = subscriptions.data.find(sub =>
        sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due'
      );

      if (activeSub) {
        return res.status(200).json({
          tier: 'pro',
          subscriptionId: activeSub.id,
          status: activeSub.status,
        });
      }
    }

    // Also check for recent checkout sessions completed in the last hour
    // This handles the race condition where subscription hasn't propagated yet
    // but the customer has already paid
    for (const customer of customers.data) {
      try {
        const sessions = await stripe.checkout.sessions.list({
          customer: customer.id,
          limit: 5,
        });

        const recentPaid = sessions.data.find(session => {
          if (session.payment_status !== 'paid') return false;
          if (session.mode !== 'subscription') return false;
          // Check if the session was completed in the last hour
          const createdAt = new Date(session.created * 1000);
          const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
          return createdAt > oneHourAgo;
        });

        if (recentPaid) {
          return res.status(200).json({
            tier: 'pro',
            source: 'checkout_session',
            sessionId: recentPaid.id,
          });
        }
      } catch (e) {
        // Non-critical: if session check fails, continue with other checks
        console.warn('Checkout session check failed:', e.message);
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
