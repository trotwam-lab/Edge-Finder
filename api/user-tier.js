const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) return res.json({ tier: 'free' });

    const subs = await stripe.subscriptions.list({
      customer: customers.data[0].id,
      status: 'active',
      limit: 1,
    });

    if (subs.data.length > 0) {
      return res.json({ tier: 'pro', subscriptionId: subs.data[0].id });
    }
    return res.json({ tier: 'free' });
  } catch (error) {
    console.error('user-tier error:', error.message);
    return res.status(500).json({ error: 'Failed to check tier', detail: error.message });
  }
};
