import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

function fakeRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

const req = (query) => ({ method: 'GET', query, headers: { 'x-forwarded-for': '9.9.9.9' } });
const okJson = (data) => ({ ok: true, status: 200, json: async () => data });

describe('scores route', () => {
  let handler;
  beforeEach(async () => {
    vi.resetModules();
    process.env.ODDS_API_KEY = 'test-key';
    global.fetch = vi.fn(async () => okJson([{ id: 's1' }]));
    ({ default: handler } = await import('./scores.js'));
  });
  afterEach(() => { delete process.env.ODDS_API_KEY; });

  it('rejects values that could alter the upstream URL', async () => {
    for (const query of [{ sport: '../x' }, { sport: 'a&b=c' }, { sport: 'baseball_mlb', daysFrom: '99' }, { sport: 'baseball_mlb', daysFrom: '1&x=1' }]) {
      const res = fakeRes();
      await handler(req(query), res);
      expect(res.statusCode).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('serves a valid sport and lets the CDN cache it', async () => {
    const res = fakeRes();
    await handler(req({ sport: 'baseball_mlb' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.headers['Cache-Control']).toMatch(/s-maxage=30/);
  });
});

describe('injuries route', () => {
  let handler;
  beforeEach(async () => {
    vi.resetModules();
    global.fetch = vi.fn(async () => okJson({ injuries: [] }));
    ({ default: handler } = await import('./injuries.js'));
  });

  it('only accepts <sport>/<league> ESPN paths', async () => {
    for (const sport of ['../../etc', 'basketball/nba/../x', 'http://evil', 'nba']) {
      const res = fakeRes();
      await handler(req({ sport }), res);
      expect(res.statusCode).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
    const res = fakeRes();
    await handler(req({ sport: 'basketball/nba' }), res);
    expect(res.statusCode).toBe(200);
    expect(global.fetch.mock.calls[0][0]).toContain('/basketball/nba/injuries');
  });
});

describe('live-status route', () => {
  it('treats inherited object keys as unsupported sports', async () => {
    vi.resetModules();
    global.fetch = vi.fn();
    const { default: handler } = await import('./live-status.js');
    const res = fakeRes();
    await handler(req({ sport: 'constructor' }), res);
    expect(res.body).toMatchObject({ supported: false, events: [] });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('props route (Odds API path)', () => {
  let handler;
  beforeEach(async () => {
    vi.resetModules();
    process.env.ODDS_API_KEY = 'test-key';
    delete process.env.SPORTSGAMEODDS_ENABLED;
  });
  afterEach(() => { delete process.env.ODDS_API_KEY; });

  const eventOdds = (id) => okJson({
    bookmakers: [{
      key: 'fanduel', title: 'FanDuel',
      markets: [{ key: 'player_points', outcomes: [{ name: 'Over', description: `P${id}`, point: 20.5, price: -110 }] }],
    }],
  });

  it('gathers the complete daily slate, in event order, without scanning future dates', async () => {
    const firstStart = Date.parse('2026-10-21T23:00:00Z');
    const events = [
      ...Array.from({ length: 11 }, (_, i) => ({
        id: `e${i}`,
        home_team: 'H',
        away_team: 'A',
        commence_time: new Date(firstStart + i * 20 * 60 * 1000).toISOString(),
      })),
      { id: 'e11', home_team: 'H', away_team: 'A', commence_time: '2026-10-22T23:10:00Z' },
    ];
    global.fetch = vi.fn(async (url) => {
      if (String(url).endsWith(`/events?apiKey=test-key`)) return okJson(events);
      return eventOdds(String(url).match(/events\/(e\d+)\//)[1]);
    });
    ({ default: handler } = await import('./props.js'));
    const res = fakeRes();
    // Dev-only email fallback grants Pro here, so the free 3-player preview doesn't trim the board.
    process.env.ALLOW_EMAIL_TIER_FALLBACK = 'true';
    await handler({ ...req({ sport: 'basketball_nba' }), headers: { 'x-forwarded-for': '9.9.9.9', 'x-edgefinder-email': 'admin@edgefinderdaily.com' } }, res);
    delete process.env.ALLOW_EMAIL_TIER_FALLBACK;
    expect(res.statusCode).toBe(200);
    expect(res.body.map(p => p.gameId)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'e10']);
    expect(res.headers['X-EdgeFinder-Events-Available']).toBe('12');
    expect(res.headers['X-EdgeFinder-Events-Scanned']).toBe('11');
    expect(global.fetch).toHaveBeenCalledTimes(12);
  });

  it('retries transient 429s and still returns the complete slate', async () => {
    const events = Array.from({ length: 3 }, (_, i) => ({
      id: `e${i}`,
      home_team: 'H',
      away_team: 'A',
      commence_time: new Date(Date.parse('2026-10-21T23:00:00Z') + i * 20 * 60 * 1000).toISOString(),
    }));
    const attempts = new Map();
    global.fetch = vi.fn(async (url) => {
      if (String(url).endsWith(`/events?apiKey=test-key`)) return okJson(events);
      const id = String(url).match(/events\/(e\d+)\//)[1];
      const count = (attempts.get(id) || 0) + 1;
      attempts.set(id, count);
      if (count === 1) return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({ error_code: 'EXCEEDED_FREQ_LIMIT' }) };
      return eventOdds(id);
    });
    ({ default: handler } = await import('./props.js'));
    process.env.ALLOW_EMAIL_TIER_FALLBACK = 'true';
    const res = fakeRes();
    await handler({ ...req({ sport: 'basketball_nba' }), headers: { 'x-forwarded-for': '9.9.9.9', 'x-edgefinder-email': 'admin@edgefinderdaily.com' } }, res);
    delete process.env.ALLOW_EMAIL_TIER_FALLBACK;
    expect(res.statusCode).toBe(200);
    expect(res.body.map(p => p.gameId)).toEqual(['e0', 'e1', 'e2']);
    expect(res.headers['X-EdgeFinder-Scan-Complete']).toBe('true');
    expect([...attempts.values()]).toEqual([2, 2, 2]);
  });

  it('does not cache or return a partial board when quota is gone', async () => {
    const events = Array.from({ length: 12 }, (_, i) => ({
      id: `e${i}`,
      home_team: 'H',
      away_team: 'A',
      commence_time: new Date(Date.parse('2026-10-21T23:00:00Z') + i * 20 * 60 * 1000).toISOString(),
    }));
    global.fetch = vi.fn(async (url) => {
      if (String(url).endsWith(`/events?apiKey=test-key`)) return okJson(events);
      return { ok: false, status: 429, headers: { get: () => null }, json: async () => ({ error_code: 'OUT_OF_USAGE_CREDITS' }) };
    });
    ({ default: handler } = await import('./props.js'));
    const res = fakeRes();
    await handler(req({ sport: 'basketball_nba' }), res);
    expect(res.statusCode).toBe(503);
    expect(res.headers['X-EdgeFinder-Degraded']).toBe('quota-backoff');
    expect(res.body).toMatchObject({ error: 'Props temporarily unavailable' });
    // Events + at most the two in-flight event workers.
    expect(global.fetch.mock.calls.length).toBeLessThanOrEqual(3);
  });
});

describe('edges route (Odds API path)', () => {
  it('scans every in-season sport through the shared odds path and reuses the catalog', async () => {
    vi.resetModules();
    process.env.ODDS_API_KEY = 'test-key';
    delete process.env.SPORTSGAMEODDS_ENABLED;
    const catalog = [
      { key: 'basketball_nba', title: 'NBA', group: 'Basketball', active: true },
      { key: 'baseball_mlb', title: 'MLB', group: 'Baseball', active: true },
      { key: 'golf_masters', title: 'Masters', group: 'Golf', active: true, has_outrights: true },
    ];
    let inflight = 0;
    let peak = 0;
    global.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/v4/sports?')) return okJson(catalog);
      inflight += 1; peak = Math.max(peak, inflight);
      await new Promise(r => setTimeout(r, 5));
      inflight -= 1;
      return okJson([]);
    });
    const { default: handler } = await import('./edges.js');
    const first = fakeRes();
    await handler({ method: 'GET', query: {}, headers: { 'x-forwarded-for': '8.8.8.8' } }, first);
    expect(first.statusCode).toBe(200);
    const oddsCalls = global.fetch.mock.calls.filter(([u]) => String(u).includes('/odds?'));
    expect(oddsCalls.map(([u]) => String(u).match(/sports\/([a-z_]+)\/odds/)[1]).sort()).toEqual(['baseball_mlb', 'basketball_nba']);
    expect(peak).toBe(2); // overlapped, not one-by-one
    delete process.env.ODDS_API_KEY;
  });
});

describe('game-research route', () => {
  let handler;
  beforeEach(async () => {
    vi.resetModules();
    delete process.env.ODDS_API_KEY;
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    ({ default: handler } = await import('./game-research.js'));
  });

  it('rejects an unparseable commenceTime instead of crashing', async () => {
    const res = fakeRes();
    await handler(req({ homeTeam: 'A', awayTeam: 'B', sport: 'soccer_epl', commenceTime: 'not-a-date' }), res);
    expect(res.statusCode).toBe(400);
  });

  it('builds a matchup once and serves repeats from cache', async () => {
    const query = { homeTeam: 'Arsenal', awayTeam: 'Chelsea', sport: 'soccer_epl', commenceTime: '2026-10-10T15:00:00Z' };
    const a = fakeRes();
    await handler(req(query), a);
    const callsAfterFirst = global.fetch.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);
    const b = fakeRes();
    await handler(req({ ...query, homeTeam: ['arsenal', 'x'] }), b);
    expect(global.fetch.mock.calls.length).toBe(callsAfterFirst);
    expect(b.body).toEqual(a.body);
  });
});

describe('live-status batch mode', () => {
  it('answers several sports in one call and marks unmapped sports unsupported', async () => {
    vi.resetModules();
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ events: [] }) }));
    const { default: handler } = await import('./live-status.js');
    const res = fakeRes();
    await handler(req({ sports: 'basketball_nba,baseball_kbo,constructor' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.sports.basketball_nba).toMatchObject({ supported: true, events: [] });
    expect(res.body.sports.baseball_kbo).toMatchObject({ supported: false });
    expect(res.body.sports.constructor).toMatchObject({ supported: false });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(res.headers['Cache-Control']).toMatch(/s-maxage/);
  });

  it('rejects malformed lists', async () => {
    vi.resetModules();
    global.fetch = vi.fn();
    const { default: handler } = await import('./live-status.js');
    const res = fakeRes();
    await handler(req({ sports: 'a&b=c' }), res);
    expect(res.statusCode).toBe(400);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
