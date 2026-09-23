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
