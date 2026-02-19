const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Disable body parsing so we can get raw body for signature verification
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let event;
  try {
    const rawBody = await getRawBody(req);

    if (process.env.STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      console.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification');
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook verification error:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('Checkout completed for:', session.customer_email, 'Sub:', session.subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        console.log('Subscription cancelled:', sub.id);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        console.log('Subscription updated:', sub.id, 'Status:', sub.status);
        break;
      }
      default:
        console.log('Unhandled event:', event.type);
    }

    return res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err.message);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
};
