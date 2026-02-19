// Create checkout using raw fetch instead of Stripe SDK
const STRIPE_API = 'https://api.stripe.com/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });

  try {
    const { userId, email } = req.body;
    if (!userId || !email) return res.status(400).json({ error: 'Missing userId or email' });

    const params = new URLSearchParams({
      'line_items[0][price]': 'price_1T215u3swfFjeUB1wzDerK1u',
      'line_items[0][quantity]': '1',
      'mode': 'subscription',
      'success_url': 'https://edgefinderdaily.com/?checkout=success',
      'cancel_url': 'https://edgefinderdaily.com/?checkout=cancel',
      'client_reference_id': userId,
      'customer_email': email,
      'metadata[firebaseUID]': userId,
    });

    const sessionRes = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await sessionRes.json();

    if (!sessionRes.ok) {
      console.error('Stripe error:', session);
      return res.status(500).json({ error: 'Stripe error', detail: session.error?.message });
    }

    return res.json({ url: session.url });
  } catch (error) {
    console.error('create-checkout error:', error);
    return res.status(500).json({ error: 'Failed to create checkout', detail: error.message });
  }
}
