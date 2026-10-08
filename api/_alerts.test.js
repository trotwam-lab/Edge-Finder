import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeFirestore } from '../tests/helpers/fakeFirestore.js';
import { buildAlert, detectMoves, lineSnapshot, runLineAlerts, sanitizeSubscription, sanitizeWatch } from './_alerts.js';
import pushHandler from './push.js';

const NOW = Date.parse('2026-10-08T18:00:00Z');
const game = (spreads, total = 220.5) => ({
  id: 'g1', home_team: 'Boston Celtics', away_team: 'New York Knicks', commence_time: '2026-10-08T23:00:00Z',
  bookmakers: spreads.map((sp, i) => ({ key: `b${i}`, markets: [
    { key: 'spreads', outcomes: [{ name: 'Boston Celtics', point: sp, price: -110 }, { name: 'New York Knicks', point: -sp, price: -110 }] },
    { key: 'totals', outcomes: [{ name: 'Over', point: total, price: -110 }, { name: 'Under', point: total, price: -110 }] },
  ] })),
});
const sub = { endpoint: 'https://push.example.com/abc123', keys: { p256dh: 'p', auth: 'a' } };

beforeEach(() => {
  process.env.VAPID_PUBLIC_KEY = 'BPub';
  process.env.VAPID_PRIVATE_KEY = 'priv';
});
afterEach(() => { delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; });

vi.mock('web-push', () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));

describe('line move detection', () => {
  it('uses the median across books so one stray book cannot trigger it', () => {
    expect(lineSnapshot(game([-4.5, -4.5, -9]))).toEqual({ spread: -4.5, total: 220.5 });
    expect(lineSnapshot(game([-4, -5]))).toEqual({ spread: -4.5, total: 220.5 });
  });
  it('alerts on 1+ point spread or 1.5+ point total moves only', () => {
    expect(detectMoves({ spread: -4.5, total: 220.5 }, { spread: -5, total: 221.5 })).toEqual([]);
    expect(detectMoves({ spread: -4.5, total: 220.5 }, { spread: -6, total: 222 })).toEqual([
      { kind: 'spread', from: -4.5, to: -6 }, { kind: 'total', from: 220.5, to: 222 },
    ]);
    expect(detectMoves(undefined, { spread: -6 })).toEqual([]);
    expect(buildAlert(game([-6]), [{ kind: 'spread', from: -4.5, to: -6 }]).body).toMatch(/Boston Celtics -4.5 → -6/);
  });
});

describe('validation', () => {
  it('accepts only https push endpoints and sane watch lists', () => {
    expect(sanitizeSubscription(sub)).toEqual(sub);
    expect(sanitizeSubscription({ ...sub, endpoint: 'http://x.com/abcdefgh' })).toBeNull();
    expect(sanitizeSubscription({ endpoint: sub.endpoint })).toBeNull();
    expect(sanitizeWatch([{ gameId: 'g1', sportKey: 'basketball_nba' }, { gameId: 'g1', sportKey: 'basketball_nba' }, { gameId: '../x', sportKey: 'nba' }])).toEqual([{ gameId: 'g1', sportKey: 'basketball_nba' }]);
  });
});

describe('runLineAlerts', () => {
  it('records a baseline, alerts once a line moves, and drops dead devices', async () => {
    const db = createFakeFirestore();
    const dead = { ...sub, endpoint: 'https://push.example.com/dead999' };
    db.store.set('push_subscriptions/u1', { subscriptions: [sub, dead], watch: [{ gameId: 'g1', sportKey: 'basketball_nba' }] });
    let current = game([-4.5, -4.5]);
    const loadSportOdds = async () => ({ ok: true, data: [current] });
    const send = vi.fn(async (s) => (s.endpoint === dead.endpoint ? 'gone' : 'ok'));

    expect(await runLineAlerts(db, { loadSportOdds, send, now: NOW })).toMatchObject({ enabled: true, sent: 0 });
    expect(db.store.get('push_subscriptions/u1').lines.g1).toMatchObject({ spread: -4.5 });

    current = game([-6, -6]);
    expect(await runLineAlerts(db, { loadSportOdds, send, now: NOW })).toMatchObject({ sent: 1, removed: 1 });
    expect(send.mock.calls[0][1].title).toBe('Line move: New York Knicks @ Boston Celtics');
    expect(db.store.get('push_subscriptions/u1').subscriptions).toEqual([sub]);

    send.mockClear();
    await runLineAlerts(db, { loadSportOdds, send, now: NOW }); // no further move → no repeat
    expect(send).not.toHaveBeenCalled();
  });

  it('is off without VAPID keys and skips started games', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(await runLineAlerts(createFakeFirestore(), { loadSportOdds: async () => ({ ok: true, data: [] }) })).toEqual({ enabled: false });
    process.env.VAPID_PRIVATE_KEY = 'priv';
    const db = createFakeFirestore();
    db.store.set('push_subscriptions/u1', { subscriptions: [sub], watch: [{ gameId: 'g1', sportKey: 'basketball_nba' }], lines: { g1: { spread: -4.5, total: 220.5 } } });
    const send = vi.fn();
    await runLineAlerts(db, { loadSportOdds: async () => ({ ok: true, data: [game([-8])] }), send, now: Date.parse('2026-10-09T00:00:00Z') });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('push route', () => {
  const res = () => ({ headers: {}, statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } });
  const req = (method, body, query = {}) => ({ method, body, query, headers: { 'x-forwarded-for': `10.4.0.${Math.floor(Math.random() * 200)}` } });

  it('publishes the public key, and stores devices per signed-in user', async () => {
    const key = res();
    await pushHandler(req('GET', undefined, { task: 'key' }), key);
    expect(key.body).toEqual({ enabled: true, publicKey: 'BPub' });

    const db = createFakeFirestore();
    const deps = { db, getVerifiedUser: async () => ({ uid: 'u1' }) };
    const r = res();
    await pushHandler(req('POST', { action: 'subscribe', subscription: sub, watch: [{ gameId: 'g1', sportKey: 'basketball_nba' }] }), r, deps);
    expect(r.body).toEqual({ ok: true, devices: 1 });
    await pushHandler(req('POST', { action: 'subscribe', subscription: sub }), res(), deps); // same device again
    expect(db.store.get('push_subscriptions/u1').subscriptions).toHaveLength(1);
    await pushHandler(req('POST', { action: 'unsubscribe', endpoint: sub.endpoint }), res(), deps);
    expect(db.store.get('push_subscriptions/u1').subscriptions).toHaveLength(0);

    const anon = res();
    await pushHandler(req('POST', { action: 'sync', watch: [] }), anon, { db, getVerifiedUser: async () => null });
    expect(anon.statusCode).toBe(401);
  });
});
