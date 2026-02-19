import Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  // We only need the Stripe SDK for webhook signature verification
  const stripe = new Stripe(key);
  let event;

  try {
    const rawBody = await getRawBody(req);

    if (webhookSecret) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    console.log('Stripe event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      console.log('Checkout completed:', s.customer_email, 'Customer:', s.customer, 'Sub:', s.subscription);
    } else if (event.type === 'customer.subscription.deleted') {
      console.log('Subscription cancelled:', event.data.object.id);
    } else if (event.type === 'customer.subscription.updated') {
      console.log('Subscription updated:', event.data.object.id, 'Status:', event.data.object.status);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return res.status(500).json({ error: 'Handler failed' });
  }
}
