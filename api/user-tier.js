// User tier check using raw fetch instead of Stripe SDK
const STRIPE_API = 'https://api.stripe.com/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });

  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'Missing email' });

    // Lifetime Pro accounts (owner/admin)
    const LIFETIME_PRO = ['wamelite@yahoo.com', 'mrxprofit@gmail.com', 'wb_sportstalk@yahoo.com', 'diajdaley@gmail.com', 'Jimmyjgo@yahoo.com'];
    if (LIFETIME_PRO.includes(email.toLowerCase())) {
      return res.json({ tier: 'pro', lifetime: true });
    }

    // Get customer by email
    const customersRes = await fetch(`${STRIPE_API}/customers?email=${encodeURIComponent(email)}&limit=1`, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const customers = await customersRes.json();

    if (!customers.data || customers.data.length === 0) {
      return res.json({ tier: 'free' });
    }

    // Get subscriptions
    const subsRes = await fetch(`${STRIPE_API}/subscriptions?customer=${customers.data[0].id}&status=active&limit=1`, {
      headers: { 'Authorization': `Bearer ${key}` }
    });
    const subs = await subsRes.json();

    if (subs.data && subs.data.length > 0) {
      return res.json({ tier: 'pro', subscriptionId: subs.data[0].id });
    }
    return res.json({ tier: 'free' });
  } catch (error) {
    console.error('user-tier error:', error);
    return res.status(500).json({ error: 'Failed to check tier', detail: error.message });
  }
}
