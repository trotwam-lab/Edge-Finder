import { describe, expect, it } from 'vitest';
import { edgeToPendingBet, explainEdge, kellyStake } from './edgeMath.js';

describe('explainEdge', () => {
  it('compares the offered price with the no-vig fair price', () => {
    const why = explainEdge({ price: 110, fairProbability: 50 });
    expect(why).toEqual({ impliedPct: 47.6, fairPct: 50, fairAmerican: 100, evPct: 5, gapPct: 2.4 });
    expect(explainEdge({ price: 110, fairProbability: null })).toBeNull();
  });
});

describe('kellyStake', () => {
  it('suggests a capped fraction of full Kelly', () => {
    // +110 at 50%: b = 1.1, f* = (0.55 - 0.5) / 1.1 = 4.545%
    expect(kellyStake({ price: 110, fairProb: 0.5, bankroll: 1000 })).toEqual({ fullKellyPct: 4.55, sharePct: 1.14, stake: 11, capped: false });
    expect(kellyStake({ price: 300, fairProb: 0.5, bankroll: 1000 })).toMatchObject({ sharePct: 5, stake: 50, capped: true });
    expect(kellyStake({ price: -110, fairProb: 0.5, bankroll: 1000 })).toEqual({ fullKellyPct: 0, stake: 0, capped: false });
    expect(kellyStake({ price: 110, fairProb: 0.5 })).toMatchObject({ stake: null });
  });
});

describe('edgeToPendingBet', () => {
  it('carries everything needed to verify the bet', () => {
    const bet = edgeToPendingBet({
      game: 'Knicks @ Celtics', homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks', price: -105, market: 'spreads',
      outcomeName: 'Boston Celtics', outcomePoint: -4.5, gameId: 'g1', sportKey: 'basketball_nba', commenceTime: 'T', book: 'FanDuel', bookKey: 'fanduel',
    }, 25);
    expect(bet).toMatchObject({ game: 'New York Knicks vs Boston Celtics', type: 'Spread', pick: 'Boston Celtics -4.5', odds: -105, wager: 25, marketKey: 'spreads', bookKey: 'fanduel', sportKey: 'basketball_nba' });
  });
});
