// ==============================================
// USER TIER CHECK â Vercel Serverless Function
// ==============================================
// This endpoint checks if a user has an active Pro subscription.
// Instead of storing tier info in our own database, we ask Stripe directly.
// Stripe is the "source of truth" for subscription status.
//
// Usage: GET /api/user-tier?email=user@example.com
// Returns: { tier: 'pro', subscriptionId: 'sub_xxx' } or { tier: 'free' }

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
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

    // Search Stripe for customers with this email address
    // A customer is created when someone makes their first payment
    const customers = await stripe.customers.list({ email: email, limit: 1 });

    // If no customer found, they've never subscribed = free tier
    if (customers.data.length === 0) {
      return res.status(200).json({ tier: 'free' });
    }

    // Get the first matching customer
    const customer = customers.data[0];

    // Check if this customer has any ACTIVE subscriptions
    // Status 'active' means they're currently paying
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
};
