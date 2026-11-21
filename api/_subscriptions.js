// api/_subscriptions.js — keeps each account's plan (users/{uid}) in step
// with Stripe.
//
// The plan is always worked out from the account's subscriptions as Stripe
// reports them *now*, never from an event's payload, so webhook events that
// arrive late, twice or out of order can't leave a stale plan behind. Used by
// the Stripe webhook and by a daily reconcile run (ledger-maintenance
// ?task=subscriptions) that catches anything a webhook missed.
//
// Fields written to users/{uid} (Admin SDK only; clients can't write it):
//   subscriptionTier    'pro' | 'free'      ← what the API checks (_auth.js)
//   subscriptionStatus  'active' when Pro, else Stripe's status (e.g. 'canceled')
//   stripeStatus        Stripe's own status of the deciding subscription
//   stripeCustomerId, stripeSubscriptionId, subscriptionUpdatedAt

// Statuses that keep Pro. `past_due` means a renewal payment failed and
// Stripe is still retrying it; access continues through those retries and
// ends when Stripe gives up (the subscription becomes `canceled` or
// `unpaid`, depending on the Stripe billing settings). Drop 'past_due' here
// to cut access at the first failed payment instead.
export const PRO_STATUSES = ['active', 'trialing', 'past_due'];
const RANK = { active: 3, trialing: 2, past_due: 1 };

export const customerIdOf = (sub) => (typeof sub?.customer === 'string' ? sub.customer : sub?.customer?.id) || null;

// Pure: the plan a set of Stripe subscriptions grants.
export function entitlementFrom(subscriptions = []) {
  const live = subscriptions
    .filter(s => PRO_STATUSES.includes(s?.status))
    .sort((a, b) => RANK[b.status] - RANK[a.status] || (b.created || 0) - (a.created || 0));
  if (live.length) {
    return { tier: 'pro', status: live[0].status, subscriptionId: live[0].id, customerId: customerIdOf(live[0]) };
  }
  const latest = [...subscriptions].sort((a, b) => (b.created || 0) - (a.created || 0))[0];
  return {
    tier: 'free',
    status: latest?.status || 'none',
    subscriptionId: latest?.id || null,
    customerId: latest ? customerIdOf(latest) : null,
  };
}

async function listSubscriptions(stripe, customerId) {
  const page = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
  return page?.data || [];
}

// The account a Stripe object belongs to: the firebaseUID that checkout puts
// in the metadata, or else the account already linked to that customer
// (subscriptions from before the metadata existed).
export async function resolveUid(db, { metadataUid, customerId }) {
  if (typeof metadataUid === 'string' && metadataUid) return metadataUid;
  if (!customerId) return null;
  const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
  return snap.docs[0]?.id || null;
}

/**
 * Re-read an account's subscriptions from Stripe and record its plan.
 * `customerIds` are the customers the triggering event names; the customer
 * already linked to the account is always checked too, so a cancelled
 * duplicate subscription can't hide a live one. Returns the plan, or null
 * when the account has no Stripe customer at all (left untouched — that's a
 * complimentary/manual grant, not a lapsed subscription).
 */
export async function syncUserSubscription({ stripe, db, uid, customerIds = [], email = null, now = new Date() }) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const current = (snap.exists ? snap.data() : null) || {};
  const ids = [...new Set([...customerIds, current.stripeCustomerId].filter(Boolean))];
  if (!ids.length) return null;

  const subscriptions = (await Promise.all(ids.map(id => listSubscriptions(stripe, id))))
    .flat()
    // A subscription tagged for a different account never counts here.
    .filter(sub => !sub?.metadata?.firebaseUID || sub.metadata.firebaseUID === uid);
  const plan = entitlementFrom(subscriptions);

  const fields = {
    subscriptionTier: plan.tier,
    subscriptionStatus: plan.tier === 'pro' ? 'active' : (plan.status === 'none' ? 'canceled' : plan.status),
    stripeStatus: plan.status,
    stripeSubscriptionId: plan.subscriptionId,
    stripeCustomerId: plan.customerId || current.stripeCustomerId || ids[0],
    subscriptionUpdatedAt: now.toISOString(),
  };
  if (email) fields.email = email;
  await ref.set(fields, { merge: true });
  return { uid, ...plan };
}

// Run `worker` over `items`, at most `limit` at a time.
async function mapLimit(items, limit, worker) {
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }));
  return results;
}

/**
 * Daily safety net: re-check every account that has a Stripe customer
 * against Stripe. Downgrades subscriptions that lapsed without a webhook
 * (or before the webhook handled lapses), and restores any paying account
 * a missed webhook left on Free.
 */
export async function reconcileSubscriptions({ stripe, db, limit = 1000, concurrency = 5 }) {
  const [pro, free] = await Promise.all(['pro', 'free'].map(tier =>
    db.collection('users').where('subscriptionTier', '==', tier).limit(limit).get()));
  const docs = [...pro.docs, ...free.docs].filter(d => d.data()?.stripeCustomerId);
  const summary = { checked: 0, downgraded: 0, upgraded: 0, failed: 0 };
  await mapLimit(docs, concurrency, async (doc) => {
    const before = doc.data().subscriptionTier;
    try {
      const plan = await syncUserSubscription({ stripe, db, uid: doc.id });
      summary.checked += 1;
      if (before === 'pro' && plan?.tier === 'free') summary.downgraded += 1;
      if (before === 'free' && plan?.tier === 'pro') summary.upgraded += 1;
    } catch (error) {
      summary.failed += 1;
      console.warn(`Subscription check failed for ${doc.id}:`, error.message);
    }
  });
  return summary;
}
