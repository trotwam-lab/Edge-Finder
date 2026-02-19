const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { userId, email } = req.body;
    if (!userId || !email) return res.status(400).json({ error: 'Missing userId or email' });

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: 'price_1T215u3swfFjeUB1wzDerK1u', quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://edgefinderdaily.com/?checkout=success',
      cancel_url: 'https://edgefinderdaily.com/?checkout=cancel',
      client_reference_id: userId,
      customer_email: email,
      metadata: { firebaseUID: userId },
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error('create-checkout error:', error.message);
    return res.status(500).json({ error: 'Failed to create checkout', detail: error.message });
  }
};
