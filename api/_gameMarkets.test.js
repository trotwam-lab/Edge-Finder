import { describe, expect, it } from 'vitest';
import { transformEventMarkets } from './_gameMarkets.js';
import { summarizeExtraMarkets } from '../src/utils/game-markets.js';

const event = {
  bookmakers: [
    { key: 'fanduel', title: 'FanDuel', markets: [
      { key: 'spreads_1st_5_innings', outcomes: [{ name: 'Los Angeles Dodgers', point: -0.5, price: -120 }, { name: 'San Diego Padres', point: 0.5, price: 100 }] },
      { key: 'team_totals', outcomes: [
        { name: 'Over', description: 'Los Angeles Dodgers', point: 4.5, price: -105 },
        { name: 'Under', description: 'Los Angeles Dodgers', point: 4.5, price: -115 },
      ] },
      { key: 'totals_1st_1_innings', outcomes: [{ name: 'Over', point: 0.5, price: 105 }, { name: 'Under', point: 0.5, price: -130 }] },
    ] },
    { key: 'bovada', title: 'Bovada', markets: [
      { key: 'totals_1st_1_innings', outcomes: [{ name: 'Under', point: 1.5, price: -300 }] },
    ] },
  ],
};

describe('transformEventMarkets', () => {
  it('maps Odds API baseball markets onto the app market keys', () => {
    const { bookmakers } = transformEventMarkets(event);
    expect(bookmakers).toHaveLength(1);
    const markets = Object.fromEntries(bookmakers[0].markets.map(m => [m.key, m.outcomes]));
    expect(markets.f5_spreads).toEqual([
      { name: 'Los Angeles Dodgers', point: -0.5, price: -120 },
      { name: 'San Diego Padres', point: 0.5, price: 100 },
    ]);
    expect(markets.team_totals[1]).toEqual({ name: 'Los Angeles Dodgers', side: 'under', point: 4.5, price: -115 });
    expect(markets.nrfi).toEqual([{ name: 'NRFI', side: 'under', point: 0.5, price: -130 }]);
  });

  it('drops non-NRFI first-inning lines and books with nothing usable', () => {
    expect(transformEventMarkets({ bookmakers: [event.bookmakers[1]] }).bookmakers).toEqual([]);
    expect(transformEventMarkets(null).bookmakers).toEqual([]);
  });

  it('feeds the same panel summary as the SportsGameOdds markets', () => {
    const summary = summarizeExtraMarkets(transformEventMarkets(event));
    expect(summary.map(m => m.key)).toEqual(['f5_spreads', 'team_totals', 'nrfi']);
    expect(summary[2].rows[0].label).toBe('NRFI (Under 0.5 1st inn)');
    expect(summary[1].rows.map(r => r.label)).toEqual(['Los Angeles Dodgers Over 4.5', 'Los Angeles Dodgers Under 4.5']);
  });
});
