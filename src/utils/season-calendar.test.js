import { describe, expect, it } from 'vitest';
import { getSeasonBoard, getSeasonStatus, SEASON_CALENDAR } from './season-calendar.js';

const at = (iso) => new Date(`${iso}T12:00:00`);
const sport = (key) => SEASON_CALENDAR.find(s => s.key === key);

describe('season calendar', () => {
  it('finds phases that wrap the new year', () => {
    expect(getSeasonStatus(sport('americanfootball_nfl'), at('2026-01-10'))).toMatchObject({ state: 'live', phase: 'Playoffs' });
    expect(getSeasonStatus(sport('americanfootball_nfl'), at('2026-12-31'))).toMatchObject({ state: 'live', phase: 'Regular season' });
  });

  it('flags a season starting within three weeks as soon', () => {
    expect(getSeasonStatus(sport('basketball_nba'), at('2026-09-22'))).toMatchObject({ state: 'soon', phase: 'Preseason', daysUntil: 9 });
  });

  it('marks off-season sports with their return date', () => {
    const status = getSeasonStatus(sport('americanfootball_nfl'), at('2026-03-15'));
    expect(status.state).toBe('off');
    expect(status.startsOn.getMonth()).toBe(7);
  });

  it('orders in-season sports first', () => {
    const board = getSeasonBoard(at('2026-09-22'));
    const firstOff = board.findIndex(s => s.status.state !== 'live');
    expect(board.slice(0, firstOff).every(s => s.status.state === 'live')).toBe(true);
    expect(board[0].key).toBe('americanfootball_nfl');
  });
});
