import { describe, expect, it } from 'vitest';
import { gradeCandidates, teamsFromGame, toGradeItem } from './useAutoGrade.js';

const NOW = Date.parse('2026-10-09T03:00:00Z');
const bet = (over = {}) => ({
  id: 1, status: 'pending', game: 'New York Knicks vs Boston Celtics', gameId: 'g1', sportKey: 'basketball_nba',
  marketKey: 'spreads', outcomeName: 'Boston Celtics', outcomePoint: -4.5, commenceTime: '2026-10-08T23:00:00Z', ...over,
});

describe('useAutoGrade helpers', () => {
  it('reads teams from the board format only', () => {
    expect(teamsFromGame('New York Knicks vs Boston Celtics')).toEqual({ awayTeam: 'New York Knicks', homeTeam: 'Boston Celtics' });
    expect(teamsFromGame('Knicks @ Celtics')).toEqual({ awayTeam: null, homeTeam: null });
  });

  it('picks finished, gradeable, unverified board bets only', () => {
    expect(gradeCandidates([bet()], new Set(), NOW)).toHaveLength(1);
    expect(gradeCandidates([bet()], new Set(['1']), NOW)).toHaveLength(0); // verified → ledger handles it
    expect(gradeCandidates([bet({ commenceTime: '2026-10-09T02:00:00Z' })], new Set(), NOW)).toHaveLength(0); // too soon
    expect(gradeCandidates([bet({ status: 'won' })], new Set(), NOW)).toHaveLength(0);
    expect(gradeCandidates([bet({ sportKey: 'soccer_epl' })], new Set(), NOW)).toHaveLength(0);
    expect(gradeCandidates([bet({ type: 'Parlay' })], new Set(), NOW)).toHaveLength(0);
    expect(gradeCandidates([bet({ gameId: null, sportKey: null })], new Set(), NOW)).toHaveLength(0); // typed in
  });

  it('builds a grade request item', () => {
    expect(toGradeItem(bet())).toMatchObject({ key: '1', homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks', outcomePoint: -4.5 });
  });
});
