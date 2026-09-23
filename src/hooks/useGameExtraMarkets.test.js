import { describe, expect, it } from 'vitest';
import { mergeBookmakers } from './useGameExtraMarkets.js';
import { summarizeExtraMarkets } from '../utils/game-markets.js';

describe('mergeBookmakers', () => {
  it('adds fetched markets to matching books and appends new books', () => {
    const base = [{ key: 'fanduel', title: 'FanDuel', markets: [{ key: 'h2h', outcomes: [] }] }];
    const extra = [
      { key: 'fanduel', title: 'FanDuel', markets: [{ key: 'nrfi', outcomes: [{ name: 'NRFI', side: 'under', point: 0.5, price: -120 }] }] },
      { key: 'betmgm', title: 'BetMGM', markets: [{ key: 'nrfi', outcomes: [{ name: 'NRFI', side: 'under', point: 0.5, price: -115 }] }] },
    ];
    const merged = mergeBookmakers(base, extra);
    expect(merged.find(b => b.key === 'fanduel').markets.map(m => m.key)).toEqual(['h2h', 'nrfi']);
    expect(merged.map(b => b.key)).toEqual(['fanduel', 'betmgm']);
    expect(base[0].markets).toHaveLength(1);
    expect(summarizeExtraMarkets({ bookmakers: merged })[0].rows[0]).toMatchObject({ price: -115, bookKey: 'betmgm' });
  });
});
