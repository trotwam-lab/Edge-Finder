import { describe, expect, it, vi } from 'vitest';

vi.mock('./_firebaseAdmin.js', () => {
  const day = (offset) => {
    const d = new Date(Date.now() + offset * 86400e3);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  };
  const past = '2026-01-01T00:00:00Z';
  const edge = (sport, market, flaggedPrice, closeFairProb) => ({
    sport, market, flaggedPrice, closeFairProb, commenceTime: past, lastSeenAt: past,
    gameId: `g-${sport}-${market}`, outcomeName: 'X', outcomePoint: null, game: 'A @ B', edge: 'e', book: 'DK', flaggedEv: 3,
  });
  const docs = [{
    date: day(-1),
    edges: {
      a: edge('NBA', 'h2h', 100, 0.55),   // +10% at close → beat
      b: edge('NBA', 'spreads', 100, 0.45), // -10% → missed
      c: edge('NHL', 'h2h', 100, 0.52),   // +4% → beat
    },
  }];
  const db = { collection: () => ({ where: () => ({ get: async () => ({ docs: docs.map(d => ({ data: () => d })) }) }) }) };
  return { getAdminDb: () => db };
});

describe('edge receipts', () => {
  it('breaks the 30-day record down by sport and market and identifies each line', async () => {
    const { default: handler } = await import('./edge-receipts.js');
    const res = { headers: {}, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await handler({ method: 'GET', headers: { 'x-forwarded-for': '7.7.7.7' } }, res);
    const { d30 } = res.body.rolling;
    expect(d30.bySport).toEqual([
      { key: 'NBA', graded: 2, beatRate: 50, avgClv: 0 },
      { key: 'NHL', graded: 1, beatRate: 100, avgClv: 4 },
    ]);
    expect(d30.byMarket.find(m => m.key === 'Moneyline')).toMatchObject({ graded: 2, beatRate: 100 });
    expect(res.body.yesterday.edges[0]).toMatchObject({ gameId: expect.any(String), market: expect.any(String), outcomeName: 'X' });
  });
});
