import { describe, expect, it, vi, beforeEach } from 'vitest';

function fakeRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}
const req = (query) => ({ method: 'GET', query, headers: { 'x-forwarded-for': '7.7.7.7' } });

describe('game-markets route', () => {
  let handler;
  beforeEach(async () => {
    vi.resetModules();
    process.env.ODDS_API_KEY = 'k';
    global.fetch = vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ bookmakers: [
        { key: 'fanduel', title: 'FanDuel', markets: [{ key: 'totals_1st_1_innings', outcomes: [{ name: 'Under', point: 0.5, price: -125 }] }] },
        { key: 'bovada', title: 'Bovada', markets: [{ key: 'totals_1st_1_innings', outcomes: [{ name: 'Under', point: 0.5, price: -110 }] }] },
      ] }),
    }));
    ({ default: handler } = await import('./game-markets.js'));
  });

  it('rejects unsupported sports and malformed event ids', async () => {
    for (const q of [{ sport: 'basketball_nba', eventId: 'abcdef123456' }, { sport: 'baseball_mlb', eventId: '../x' }]) {
      const res = fakeRes();
      await handler(req(q), res);
      expect(res.statusCode).toBe(400);
    }
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('requests only the three extra markets, caches, and trims books for free users', async () => {
    const first = fakeRes();
    await handler(req({ sport: 'baseball_mlb', eventId: 'abcdef1234567890' }), first);
    const url = global.fetch.mock.calls[0][0];
    expect(url).toContain('/events/abcdef1234567890/odds');
    expect(url).toContain('markets=spreads_1st_5_innings,team_totals,totals_1st_1_innings');
    expect(first.body.bookmakers.map(b => b.key)).toEqual(['fanduel']);

    const second = fakeRes();
    await handler(req({ sport: 'baseball_mlb', eventId: 'abcdef1234567890' }), second);
    expect(second.headers['X-Cache']).toBe('HIT');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
