import { describe, expect, it } from 'vitest';
import { isVerifiableBet } from './useVerifiedLedger.js';

const NOW = Date.parse('2026-10-08T18:00:00Z');
const bet = (over = {}) => ({
  id: NOW - 60 * 1000, status: 'pending', gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'spreads',
  outcomeName: 'Boston Celtics', outcomePoint: -4.5, odds: -110, wager: 50,
  commenceTime: '2026-10-08T23:00:00Z', ...over,
});

describe('isVerifiableBet', () => {
  it('accepts a fresh pregame game-line bet logged from the board', () => {
    expect(isVerifiableBet(bet(), NOW)).toBe(true);
  });

  it('never verifies old, imported, started, hand-entered or unsupported bets', () => {
    expect(isVerifiableBet(bet({ id: NOW - 20 * 60 * 1000 }), NOW)).toBe(false); // logged long ago / imported
    expect(isVerifiableBet(bet({ commenceTime: '2026-10-08T17:00:00Z' }), NOW)).toBe(false);
    expect(isVerifiableBet(bet({ gameId: null }), NOW)).toBe(false); // typed in by hand
    expect(isVerifiableBet(bet({ player: 'J. Tatum', marketKey: 'player_points' }), NOW)).toBe(false);
    expect(isVerifiableBet(bet({ sportKey: 'soccer_epl' }), NOW)).toBe(false);
    expect(isVerifiableBet(bet({ outcomePoint: null }), NOW)).toBe(false);
    expect(isVerifiableBet(bet({ status: 'won' }), NOW)).toBe(false);
    expect(isVerifiableBet(bet({ deleted: true }), NOW)).toBe(false);
  });
});

describe('isVerifiableBet — parlays', () => {
  const leg = (over = {}) => ({ gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'Boston Celtics', odds: -150, commenceTime: '2026-10-08T23:00:00Z', ...over });
  const parlay = (over = {}) => ({
    id: NOW - 60 * 1000, type: 'Parlay', status: 'pending', wager: 10,
    legs: [leg(), leg({ gameId: 'g2', outcomeName: 'Miami Heat', marketKey: 'spreads', outcomePoint: -2.5, odds: -110 })],
    ...over,
  });

  it('accepts a fresh board-only parlay across different games', () => {
    expect(isVerifiableBet(parlay(), NOW)).toBe(true);
  });

  it('rejects typed-in legs, same-game legs, started legs and bad sizes', () => {
    expect(isVerifiableBet(parlay({ legs: [leg(), { label: 'Lakers -3', odds: -110, manual: true }] }), NOW)).toBe(false);
    expect(isVerifiableBet(parlay({ legs: [leg(), leg({ outcomeName: 'New York Knicks' })] }), NOW)).toBe(false);
    expect(isVerifiableBet(parlay({ legs: [leg({ commenceTime: '2026-10-08T17:00:00Z' }), leg({ gameId: 'g2' })] }), NOW)).toBe(false);
    expect(isVerifiableBet(parlay({ legs: [leg()] }), NOW)).toBe(false);
    expect(isVerifiableBet(parlay({ legs: [leg(), leg({ gameId: 'g2', sportKey: 'soccer_epl' })] }), NOW)).toBe(false);
  });
});
