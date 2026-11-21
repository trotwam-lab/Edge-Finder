import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = { firestoreDoc: null, subscriptionStatus: null };

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    verifyIdToken: async (token) => {
      if (token === 'bad') throw new Error('bad token');
      return { uid: `uid-${token}`, email: `${token}@example.com`, email_verified: true };
    },
  }),
}));

vi.mock('./_firebaseAdmin.js', () => ({
  getAdminApp: () => ({}),
  getTokenVerifierApp: () => ({}),
  getAdminDb: () => ({
    collection: () => ({ doc: () => ({ get: async () => ({ exists: Boolean(state.firestoreDoc), data: () => state.firestoreDoc }) }) }),
  }),
}));

vi.mock('stripe', () => ({
  default: class {
    constructor() {
      this.customers = { list: async () => ({ data: [{ id: 'c1' }] }) };
      // Honors the status filter like Stripe does ('all' = no filter).
      this.subscriptions = {
        list: async ({ status = 'all' } = {}) => ({
          data: state.subscriptionStatus && (status === 'all' || status === state.subscriptionStatus)
            ? [{ id: 's1', status: state.subscriptionStatus }]
            : [],
        }),
      };
    }
  },
}));

function fakeRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}
const req = (token) => ({ method: 'GET', query: {}, headers: { 'x-forwarded-for': '7.7.7.7', ...(token ? { authorization: `Bearer ${token}` } : {}) } });

describe('/api/user-tier', () => {
  let handler;
  let auth;
  beforeEach(async () => {
    Object.assign(state, { firestoreDoc: null, subscriptionStatus: null });
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    ({ default: handler } = await import('./user-tier.js'));
    auth = await import('./_auth.js');
    auth.resetTierCache();
    (await import('./_http.js')).resetRateLimits();
  });

  it('requires a valid sign-in', async () => {
    for (const token of [null, 'bad']) {
      const res = fakeRes();
      await handler(req(token), res);
      expect(res.statusCode).toBe(401);
    }
  });

  it('agrees with the data routes on a trialing subscription', async () => {
    state.subscriptionStatus = 'trialing';
    const res = fakeRes();
    await handler(req('tia'), res);
    expect(res.body.tier).toBe('pro');
    expect((await auth.getRequestTier(req('tia'))).tier).toBe('pro');
  });

  it('sees an upgrade right away, even if the data routes remembered Free', async () => {
    // A data route caches "free" just before checkout…
    expect((await auth.getRequestTier(req('ben'))).tier).toBe('free');
    // …then the Stripe webhook marks the account Pro.
    state.firestoreDoc = { subscriptionTier: 'pro', subscriptionStatus: 'active' };
    const res = fakeRes();
    await handler(req('ben'), res);
    expect(res.body.tier).toBe('pro');
    // The fresh check also refreshed what the data routes remember.
    expect((await auth.getRequestTier(req('ben'))).tier).toBe('pro');
  });
});
