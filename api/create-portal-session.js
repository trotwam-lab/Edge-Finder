import Stripe from 'stripe';
import { getAdminDb } from './_firebaseAdmin.js';
import { getVerifiedUser } from './_auth.js';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // SECURITY: the billing portal exposes payment method, invoices, and
    // cancel controls. Identity comes ONLY from a verified Firebase ID
    // token — a body-supplied userId/email would let anyone open the portal
    // for any subscriber they can name.
    const caller = await getVerifiedUser(req);
    if (!caller) {
      return res.status(401).json({ error: 'Please sign in again to manage your subscription.' });
    }

    const customerId =
      (await getCustomerIdFromFirestore(caller.uid)) ||
      (await getCustomerIdFromStripe(caller.email));

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
    return res.status(500).json({ error: 'Could not open the billing portal. Please try again.' });
  }
}
