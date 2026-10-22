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

describe('odds route', () => {
  let handler;
  beforeEach(async () => {
    vi.resetModules();
    process.env.ODDS_API_KEY = 'test-key';
    delete process.env.SPORTSGAMEODDS_ENABLED;
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ id: 'g1', bookmakers: [{ key: 'fanduel' }, { key: 'bovada' }, { key: 'pinnacle' }, { key: 'draftkings' }] }],
    }));
    ({ default: handler } = await import('./odds.js'));
  });
  afterEach(() => { delete process.env.ODDS_API_KEY; });

  it('rejects market lists that could pull extra paid markets or inject params', async () => {
    for (const query of [{ sport: 'baseball_mlb', markets: 'h2h&apiKey=x' }, { sport: '../x' }, { sport: 'baseball_mlb', markets: 'a,b,c,d,e,f,g' }]) {
      const res = fakeRes();
      await handler(req(query), res);
      expect(res.statusCode).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches once, then serves the cached board, trimmed for free users', async () => {
    const first = fakeRes();
    await handler(req({ sport: 'baseball_mlb' }), first);
    expect(first.headers['X-Cache']).toBe('MISS');
    expect(first.body[0].bookmakers.map(b => b.key)).toEqual(['fanduel', 'draftkings']);

    const second = fakeRes();
    await handler(req({ sport: 'baseball_mlb' }), second);
    expect(second.headers['X-Cache']).toBe('HIT');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('odds route — degraded and batch responses', () => {
  let handler;
  const okJson = (data) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => data });
  const status = (code) => ({ ok: false, status: code, headers: { get: () => null }, json: async () => ({}), clone() { return this; } });

  beforeEach(async () => {
    vi.resetModules();
    process.env.ODDS_API_KEY = 'test-key';
    delete process.env.SPORTSGAMEODDS_ENABLED;
  });
  afterEach(() => { delete process.env.ODDS_API_KEY; });

  const load = async () => {
    ({ default: handler } = await import('./odds.js'));
    // Keep retries instant in tests.
    vi.useFakeTimers({ toFake: ['setTimeout'] });
  };
  const run = async (query) => {
    const res = fakeRes();
    const pending = handler(req(query), res);
    await vi.runAllTimersAsync();
    await pending;
    return res;
  };
  afterEach(() => vi.useRealTimers());

  it('answers 503 (retry) instead of an empty board when rate limited with nothing cached', async () => {
    global.fetch = vi.fn(async () => status(429));
    await load();
    const res = await run({ sport: 'baseball_mlb' });
    expect(res.statusCode).toBe(503);
    expect(res.headers['Retry-After']).toBe('3');
  });

  it('still answers an empty board for a sport the provider does not know', async () => {
    global.fetch = vi.fn(async () => status(404));
    await load();
    const res = await run({ sport: 'baseball_mlb' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('serves several sports in one request, flagging the ones to retry', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('/baseball_mlb/')) return okJson([{ id: 'm1', bookmakers: [{ key: 'fanduel' }, { key: 'pinnacle' }] }]);
      if (String(url).includes('/icehockey_nhl/')) return status(429);
      return okJson([]);
    });
    await load();
    const res = await run({ sports: 'baseball_mlb,icehockey_nhl,boxing_boxing' });
    expect(res.statusCode).toBe(200);
    expect(res.body.sports.baseball_mlb.games.map(g => g.id)).toEqual(['m1']);
    // Free tier gets the same trimmed books as the single-sport route.
    expect(res.body.sports.baseball_mlb.games[0].bookmakers.map(b => b.key)).toEqual(['fanduel']);
    expect(res.body.sports.icehockey_nhl).toMatchObject({ error: 'unavailable', retry: true });
    expect(res.body.sports.boxing_boxing).toEqual({ games: [], cache: 'MISS' });
  });

  it('rejects malformed or oversized sport lists without calling upstream', async () => {
    global.fetch = vi.fn();
    await load();
    for (const sports of ['', 'a&b', Array.from({ length: 13 }, (_, i) => `sport_${i}`).join(',')]) {
      const res = await run({ sports });
      expect(res.statusCode).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('keeps at most two upstream calls in flight per batch', async () => {
    let inflight = 0;
    let peak = 0;
    global.fetch = vi.fn(async () => {
      inflight += 1; peak = Math.max(peak, inflight);
      await Promise.resolve();
      inflight -= 1;
      return okJson([]);
    });
    await load();
    await run({ sports: 'a_one,b_two,c_three,d_four,e_five' });
    expect(global.fetch).toHaveBeenCalledTimes(5);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
