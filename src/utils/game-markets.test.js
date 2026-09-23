import { describe, expect, it } from 'vitest';
import { summarizeExtraMarkets } from './game-markets.js';

const game = {
  bookmakers: [
    { key: 'fanduel', title: 'FanDuel', markets: [
      { key: 'f5_spreads', outcomes: [{ name: 'Yankees', point: -0.5, price: -105 }, { name: 'Red Sox', point: 0.5, price: -115 }] },
      { key: 'team_totals', outcomes: [{ name: 'Yankees', side: 'over', point: 4.5, price: -110 }] },
      { key: 'nrfi', outcomes: [{ name: 'NRFI', side: 'no', price: -120 }] },
    ] },
    { key: 'draftkings', title: 'DraftKings', markets: [
      { key: 'f5_spreads', outcomes: [{ name: 'Yankees', point: -0.5, price: 100 }] },
      { key: 'nrfi', outcomes: [{ name: 'NRFI', side: 'no', price: -130 }] },
    ] },
    { key: 'bovada', title: 'Bovada', markets: [
      { key: 'nrfi', outcomes: [{ name: 'NRFI', side: 'no', price: -100 }] },
    ] },
  ],
};

describe('summarizeExtraMarkets', () => {
  it('keeps the best price per outcome across books', () => {
    const [f5, totals, nrfi] = summarizeExtraMarkets(game);
    expect(f5.key).toBe('f5_spreads');
    expect(f5.rows.find(r => r.outcome.name === 'Yankees')).toMatchObject({ price: 100, bookKey: 'draftkings', label: 'Yankees -0.5 (F5)' });
    expect(totals.rows[0].label).toBe('Yankees Over 4.5');
    expect(nrfi.rows[0]).toMatchObject({ price: -100, bookKey: 'bovada' });
  });

  it('respects the allowed-book filter and drops empty markets', () => {
    const markets = summarizeExtraMarkets(game, key => key === 'draftkings');
    expect(markets.map(m => m.key)).toEqual(['f5_spreads', 'nrfi']);
    expect(markets[1].rows[0].price).toBe(-130);
  });

  it('returns nothing for games without extra markets', () => {
    expect(summarizeExtraMarkets({ bookmakers: [{ key: 'x', markets: [{ key: 'h2h', outcomes: [] }] }] })).toEqual([]);
  });
});
