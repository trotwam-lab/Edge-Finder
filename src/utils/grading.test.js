import { describe, expect, it } from 'vitest';
import { findScoreRow, gradeBet, isAutoGradeable, readFinalScore } from './grading.js';

const final = (home, away) => ({ homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks', home, away, completed: true });
const bet = (over) => ({ sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'Boston Celtics', ...over });

describe('isAutoGradeable', () => {
  it('only grades full-game markets in sports that settle on the final score', () => {
    expect(isAutoGradeable(bet())).toBe(true);
    expect(isAutoGradeable(bet({ sportKey: 'icehockey_nhl', marketKey: 'totals', outcomeName: 'Over' }))).toBe(true);
    expect(isAutoGradeable(bet({ sportKey: 'soccer_epl' }))).toBe(false); // 90-minute markets
    expect(isAutoGradeable(bet({ sportKey: 'mma_mixed_martial_arts' }))).toBe(false);
    expect(isAutoGradeable(bet({ marketKey: 'player_points' }))).toBe(false);
    expect(isAutoGradeable(bet({ marketKey: 'h2h_1st_5_innings', sportKey: 'baseball_mlb' }))).toBe(false);
  });
});

describe('gradeBet', () => {
  it('grades moneylines, including ties as a push', () => {
    expect(gradeBet(bet(), final(110, 100))).toBe('won');
    expect(gradeBet(bet(), final(99, 100))).toBe('lost');
    expect(gradeBet(bet({ outcomeName: 'New York Knicks' }), final(99, 100))).toBe('won');
    expect(gradeBet(bet({ sportKey: 'americanfootball_nfl' }), { ...final(20, 20) })).toBe('push');
  });

  it('grades spreads from the picked side, with exact margins pushing', () => {
    const fav = bet({ marketKey: 'spreads', outcomePoint: -4.5 });
    expect(gradeBet(fav, final(105, 100))).toBe('won');
    expect(gradeBet(fav, final(104, 100))).toBe('lost');
    const dog = bet({ marketKey: 'spreads', outcomeName: 'New York Knicks', outcomePoint: 3 });
    expect(gradeBet(dog, final(103, 100))).toBe('push');
    expect(gradeBet(dog, final(102, 100))).toBe('won');
  });

  it('grades totals over, under and push', () => {
    const over = bet({ marketKey: 'totals', outcomeName: 'Over', outcomePoint: 210.5 });
    expect(gradeBet(over, final(110, 101))).toBe('won');
    expect(gradeBet(over, final(105, 100))).toBe('lost');
    expect(gradeBet(bet({ marketKey: 'totals', outcomeName: 'Under', outcomePoint: 205 }), final(105, 100))).toBe('push');
  });

  it('refuses to grade anything it is unsure about', () => {
    expect(gradeBet(bet(), { ...final(110, 100), completed: false })).toBeNull();
    expect(gradeBet(bet(), null)).toBeNull();
    expect(gradeBet(bet({ outcomeName: 'Draw' }), final(1, 1))).toBeNull();
    expect(gradeBet(bet({ outcomeName: 'Some Other Team' }), final(1, 0))).toBeNull();
    expect(gradeBet(bet({ marketKey: 'spreads', outcomePoint: null }), final(1, 0))).toBeNull();
  });
});

describe('score matching', () => {
  const row = (over) => ({
    id: 'evt1', home_team: 'Boston Celtics', away_team: 'New York Knicks',
    commence_time: '2026-10-08T23:00:00Z', completed: true,
    scores: [{ name: 'Boston Celtics', score: '110' }, { name: 'New York Knicks', score: '100' }],
    ...over,
  });
  const target = { gameId: 'other-id', homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks', commenceTime: '2026-10-08T23:05:00Z' };

  it('reads string scores only from completed games', () => {
    expect(readFinalScore(row())).toMatchObject({ home: 110, away: 100 });
    expect(readFinalScore(row({ completed: false }))).toBeNull();
    expect(readFinalScore(row({ scores: null }))).toBeNull();
  });

  it('matches by id, then by teams and start time', () => {
    expect(findScoreRow([row()], { ...target, gameId: 'evt1' })?.id).toBe('evt1');
    expect(findScoreRow([row()], target)?.id).toBe('evt1');
    expect(findScoreRow([row({ commence_time: '2026-10-10T23:00:00Z' })], target)).toBeNull();
  });

  it('returns nothing when two games could match (doubleheaders)', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b', commence_time: '2026-10-09T03:00:00Z' })];
    expect(findScoreRow(rows, target)).toBeNull();
  });
});
