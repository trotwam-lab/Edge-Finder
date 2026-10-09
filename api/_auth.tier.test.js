import { describe, expect, it, vi, beforeEach } from 'vitest';

const state = { firestoreReads: 0, firestoreDoc: null, firestoreError: null, stripeCalls: 0, stripeFails: false, subscribed: false };

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
    collection: () => ({
      doc: () => ({
        get: async () => {
          state.firestoreReads += 1;
          if (state.firestoreError) throw new Error(state.firestoreError);
          return { exists: Boolean(state.firestoreDoc), data: () => state.firestoreDoc };
        },
      }),
    }),
  }),
}));

vi.mock('stripe', () => ({
  default: class {
    constructor() {
      this.customers = { list: async () => { state.stripeCalls += 1; if (state.stripeFails) throw new Error('down'); return { data: [{ id: 'c1' }] }; } };
      this.subscriptions = { list: async () => ({ data: state.subscribed ? [{ id: 's1', status: 'active' }] : [] }) };
    }
  },
}));

const authed = (token) => ({ headers: { authorization: `Bearer ${token}` } });

describe('getRequestTier plan lookup caching', () => {
  let auth;
  beforeEach(async () => {
    Object.assign(state, { firestoreReads: 0, firestoreDoc: null, firestoreError: null, stripeCalls: 0, stripeFails: false, subscribed: false });
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    auth = await import('./_auth.js');
    auth.resetTierCache();
  });

  it('looks a signed-in user up once, not once per request', async () => {
    state.firestoreDoc = { subscriptionTier: 'free' };
    for (let i = 0; i < 5; i += 1) {
      expect((await auth.getRequestTier(authed('amy'))).tier).toBe('free');
    }
    expect(state.firestoreReads).toBe(1);
  });

  it('still verifies the token on every request', async () => {
    state.firestoreDoc = { subscriptionTier: 'pro', subscriptionStatus: 'active' };
    expect((await auth.getRequestTier(authed('amy'))).tier).toBe('pro');
    expect((await auth.getRequestTier(authed('bad'))).source).toBe('auth-error');
  });

  it('keeps users separate', async () => {
    state.firestoreDoc = { subscriptionTier: 'pro', subscriptionStatus: 'active' };
    await auth.getRequestTier(authed('amy'));
    state.firestoreDoc = { subscriptionTier: 'free' };
    expect((await auth.getRequestTier(authed('bob'))).tier).toBe('free');
    expect((await auth.getRequestTier(authed('amy'))).tier).toBe('pro');
  });

  it('falls back to Stripe and remembers the answer', async () => {
    state.subscribed = true;
    expect((await auth.getRequestTier(authed('amy'))).tier).toBe('pro');
    expect((await auth.getRequestTier(authed('amy'))).tier).toBe('pro');
    expect(state.stripeCalls).toBe(1);
  });

  it('does not remember a failed Stripe check, so a paying user recovers immediately', async () => {
    state.subscribed = true;
    state.stripeFails = true;
    expect((await auth.getRequestTier(authed('amy'))).tier).toBe('free');
    state.stripeFails = false;
    expect((await auth.getRequestTier(authed('amy'))).tier).toBe('pro');
  });

  it('does not remember a failed Firestore read', async () => {
    state.firestoreError = 'unavailable';
    await auth.getRequestTier(authed('amy'));
    state.firestoreError = null;
    state.firestoreDoc = { subscriptionTier: 'pro', subscriptionStatus: 'active' };
    expect((await auth.getRequestTier(authed('amy'))).tier).toBe('pro');
  });
});
