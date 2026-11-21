import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeFirestore } from '../tests/helpers/fakeFirestore.js';
import { entitlementFrom, reconcileSubscriptions } from './_subscriptions.js';
import webhook from './stripe-webhook.js';
import maintenance from './ledger-maintenance.js';

// Stripe as it is *now* — what the code must trust, whatever an event says.
function fakeStripe(subsByCustomer) {
  return {
    calls: 0,
    webhooks: {
      constructEvent: (body, sig) => {
        if (sig !== 'valid') throw new Error('No signatures found matching the expected signature');
        return JSON.parse(body);
      },
    },
    subscriptions: {
      async list({ customer }) { this.calls += 1; return { data: subsByCustomer[customer] || [] }; },
    },
  };
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

const sub = (id, customer, status, over = {}) => ({ id, customer, status, created: 1, metadata: {}, ...over });
const user = (db, uid) => db.store.get(`users/${uid}`);

async function deliver(db, stripe, event) {
  const res = fakeRes();
  await webhook({ method: 'POST', headers: { 'stripe-signature': 'valid' } }, res, { db, stripe, rawBody: JSON.stringify(event) });
  return res;
}

describe('entitlementFrom', () => {
  it('keeps Pro while Stripe is retrying a failed renewal, drops it when Stripe gives up', () => {
    expect(entitlementFrom([sub('s', 'c', 'active')]).tier).toBe('pro');
    expect(entitlementFrom([sub('s', 'c', 'trialing')]).tier).toBe('pro');
    expect(entitlementFrom([sub('s', 'c', 'past_due')]).tier).toBe('pro');
    for (const status of ['unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused']) {
      expect(entitlementFrom([sub('s', 'c', status)])).toMatchObject({ tier: 'free', status });
    }
    expect(entitlementFrom([])).toMatchObject({ tier: 'free', status: 'none' });
  });

  it('a cancelled duplicate never hides a live subscription', () => {
    expect(entitlementFrom([sub('old', 'c', 'canceled', { created: 9 }), sub('new', 'c', 'active')]))
      .toMatchObject({ tier: 'pro', subscriptionId: 'new' });
  });
});

describe('stripe webhook', () => {
  let db;
  beforeEach(() => {
    db = createFakeFirestore();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('rejects events with a bad signature', async () => {
    const res = fakeRes();
    await webhook({ method: 'POST', headers: { 'stripe-signature': 'forged' } }, res, { db, stripe: fakeStripe({}), rawBody: '{}' });
    expect(res.statusCode).toBe(400);
  });

  it('checkout grants Pro from the live subscription and links the customer', async () => {
    const stripe = fakeStripe({ cus_1: [sub('sub_1', 'cus_1', 'active', { metadata: { firebaseUID: 'u1' } })] });
    const res = await deliver(db, stripe, {
      type: 'checkout.session.completed',
      data: { object: { mode: 'subscription', customer: 'cus_1', customer_email: 'a@example.com', metadata: { firebaseUID: 'u1' } } },
    });
    expect(res.statusCode).toBe(200);
    expect(user(db, 'u1')).toMatchObject({ subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_1', email: 'a@example.com' });
  });

  it('downgrades a subscription that lapsed to unpaid, even without uid metadata', async () => {
    // An older subscription: no firebaseUID metadata, account found by customer.
    db.store.set('users/u2', { subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_2' });
    const lapsed = sub('sub_2', 'cus_2', 'unpaid');
    await deliver(db, fakeStripe({ cus_2: [lapsed] }), { type: 'customer.subscription.updated', data: { object: lapsed } });
    expect(user(db, 'u2')).toMatchObject({ subscriptionTier: 'free', subscriptionStatus: 'unpaid', stripeStatus: 'unpaid' });
  });

  it('downgrades on deletion when the subscription has no uid metadata', async () => {
    db.store.set('users/u3', { subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_3' });
    const ended = sub('sub_3', 'cus_3', 'canceled');
    await deliver(db, fakeStripe({ cus_3: [ended] }), { type: 'customer.subscription.deleted', data: { object: ended } });
    expect(user(db, 'u3')).toMatchObject({ subscriptionTier: 'free', subscriptionStatus: 'canceled' });
  });

  it('trusts Stripe\'s current state over a late, out-of-order event', async () => {
    db.store.set('users/u4', { subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_4' });
    // The 'incomplete' update arrives after the subscription already became active.
    const stale = sub('sub_4', 'cus_4', 'incomplete', { metadata: { firebaseUID: 'u4' } });
    await deliver(db, fakeStripe({ cus_4: [{ ...stale, status: 'active' }] }), { type: 'customer.subscription.updated', data: { object: stale } });
    expect(user(db, 'u4').subscriptionTier).toBe('pro');
  });

  it('keeps Pro when an old duplicate is deleted but another subscription is live', async () => {
    db.store.set('users/u5', { subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_5b' });
    const old = sub('sub_old', 'cus_5a', 'canceled', { metadata: { firebaseUID: 'u5' } });
    const stripe = fakeStripe({ cus_5a: [old], cus_5b: [sub('sub_new', 'cus_5b', 'active', { metadata: { firebaseUID: 'u5' } })] });
    await deliver(db, stripe, { type: 'customer.subscription.deleted', data: { object: old } });
    expect(user(db, 'u5')).toMatchObject({ subscriptionTier: 'pro', stripeCustomerId: 'cus_5b' });
  });

  it('asks Stripe to retry when the account can\'t be updated', async () => {
    const stripe = fakeStripe({});
    stripe.subscriptions.list = async () => { throw new Error('Stripe is down'); };
    db.store.set('users/u6', { stripeCustomerId: 'cus_6' });
    const res = await deliver(db, stripe, { type: 'customer.subscription.updated', data: { object: sub('s', 'cus_6', 'active') } });
    expect(res.statusCode).toBe(500);
  });
});

describe('daily subscription reconcile', () => {
  it('fixes accounts a webhook missed and leaves manual grants alone', async () => {
    const db = createFakeFirestore();
    db.store.set('users/lapsed', { subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_a' });
    db.store.set('users/paying', { subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_b' });
    db.store.set('users/missed', { subscriptionTier: 'free', subscriptionStatus: 'canceled', stripeCustomerId: 'cus_c' });
    db.store.set('users/manual', { subscriptionTier: 'pro', subscriptionStatus: 'active' }); // no Stripe customer
    const stripe = fakeStripe({
      cus_a: [sub('a', 'cus_a', 'canceled')],
      cus_b: [sub('b', 'cus_b', 'active')],
      cus_c: [sub('c', 'cus_c', 'active')],
    });
    const summary = await reconcileSubscriptions({ stripe, db });
    expect(summary).toEqual({ checked: 3, downgraded: 1, upgraded: 1, failed: 0 });
    expect(user(db, 'lapsed').subscriptionTier).toBe('free');
    expect(user(db, 'paying').subscriptionTier).toBe('pro');
    expect(user(db, 'missed').subscriptionTier).toBe('pro');
    expect(user(db, 'manual')).toEqual({ subscriptionTier: 'pro', subscriptionStatus: 'active' });
  });

  it('runs from ledger-maintenance only with the cron secret', async () => {
    process.env.LEDGER_CRON_SECRET = 'cron-secret';
    const db = createFakeFirestore();
    db.store.set('users/lapsed', { subscriptionTier: 'pro', subscriptionStatus: 'active', stripeCustomerId: 'cus_a' });
    const stripe = fakeStripe({ cus_a: [sub('a', 'cus_a', 'unpaid')] });
    const call = async (headers) => {
      const res = fakeRes();
      await maintenance({ method: 'POST', query: { task: 'subscriptions' }, headers: { 'x-forwarded-for': '5.5.5.5', ...headers } }, res, { db, stripe });
      return res;
    };
    expect((await call({})).statusCode).toBe(401);
    expect(user(db, 'lapsed').subscriptionTier).toBe('pro');
    const ok = await call({ authorization: 'Bearer cron-secret' });
    expect(ok.body).toMatchObject({ ok: true, checked: 1, downgraded: 1 });
    expect(user(db, 'lapsed').subscriptionTier).toBe('free');
    delete process.env.LEDGER_CRON_SECRET;
  });
});
