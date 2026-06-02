import Stripe from 'stripe';
import { getAdminDb } from './_firebaseAdmin.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getCustomerIdFromFirestore(userId) {
  if (!userId) return null;

  const db = getAdminDb();
  if (!db) return null;

  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) return null;

  const data = doc.data() || {};
  return data.stripeCustomerId || null;
}

async function getCustomerIdFromStripe(email) {
  if (!email) return null;

  const customers = await stripe.customers.list({
    email: email.toLowerCase(),
    limit: 10,
  });

  if (customers.data.length === 0) return null;

  for (const customer of customers.data) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 3,
    });

    const hasSubscription = subscriptions.data.some((subscription) =>
      ['active', 'trialing', 'past_due', 'unpaid'].includes(subscription.status)
    );

    if (hasSubscription) return customer.id;
  }

  return customers.data[0].id;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { userId, email } = req.body || {};

    if (!userId && !email) {
      return res.status(400).json({ error: 'Missing userId or email in request body.' });
    }

    const customerId =
      (await getCustomerIdFromFirestore(userId)) ||
      (await getCustomerIdFromStripe(email));

    if (!customerId) {
      return res.status(404).json({ error: 'No Stripe customer found for this account.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.STRIPE_PORTAL_RETURN_URL || 'https://www.edgefinderdaily.com/?billing=return',
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return res.status(500).json({ error: error.message });
  }
}
