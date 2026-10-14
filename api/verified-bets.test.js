import { describe, expect, it } from 'vitest';
import handler from './verified-bets.js';
import { createFakeFirestore } from '../tests/helpers/fakeFirestore.js';

function response() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; },
  };
}

function request(query = {}) {
  return { method: 'GET', query, headers: { 'x-forwarded-for': '8.8.8.8' } };
}

describe('verified bets caching', () => {
  it('CDN-caches an explicitly shared public record', async () => {
    const db = createFakeFirestore();
    await db.collection('ledger_handles').doc('wam').set({ uid: 'u1', handle: 'wam', since: '2026-10-01T00:00:00.000Z' });
    await db.collection('bet_ledger').doc('u1').set({ sharing: { enabled: true, handle: 'wam', since: '2026-10-01T00:00:00.000Z' } });
    const res = response();

    await handler(request({ handle: 'wam' }), res, { db });

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ available: true, handle: 'wam', events: [] });
    expect(res.headers['cache-control']).toBe('public, s-maxage=60, stale-while-revalidate=300');
  });

  it('never shares the signed-in owner response through the CDN', async () => {
    const db = createFakeFirestore();
    const res = response();

    await handler(request(), res, { db, getVerifiedUser: async () => ({ uid: 'u1' }) });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
