import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const espnEvent = (id, home, away, date, hs, as, completed = true) => ({
  id, date,
  competitions: [{
    status: { type: { completed, state: completed ? 'post' : 'post' } },
    competitors: [
      { homeAway: 'home', score: hs, team: { displayName: home } },
      { homeAway: 'away', score: as, team: { displayName: away } },
    ],
  }],
});

describe('score sources', () => {
  let mod;
  beforeEach(async () => {
    vi.resetModules();
    process.env.ODDS_API_KEY = 'k';
    mod = await import('./_scores.js');
  });
  afterEach(() => { delete process.env.ODDS_API_KEY; });

  it('maps ESPN events and never treats postponed games as final', () => {
    expect(mod.espnEventToScoreRow(espnEvent('1', 'Boston Celtics', 'New York Knicks', '2026-10-08T23:00Z', '101', '99')))
      .toMatchObject({ id: 'espn:1', completed: true, scores: [{ name: 'Boston Celtics', score: '101' }, { name: 'New York Knicks', score: '99' }] });
    expect(mod.espnEventToScoreRow(espnEvent('2', 'A B', 'C D', '2026-10-08T23:00Z', '0', '0', false)).completed).toBe(false);
  });

  it('uses the fallback only for games the primary feed lacks', () => {
    const primary = [{ id: 'g1', home_team: 'Boston Celtics', away_team: 'New York Knicks', commence_time: '2026-10-08T23:00:00Z' }];
    const fallback = [
      { id: 'espn:1', home_team: 'Boston Celtics', away_team: 'New York Knicks', commence_time: '2026-10-08T23:10:00Z' },
      { id: 'espn:2', home_team: 'Miami Heat', away_team: 'Chicago Bulls', commence_time: '2026-10-08T23:00:00Z' },
    ];
    expect(mod.mergeScoreRows(primary, fallback).map(r => r.id)).toEqual(['g1', 'espn:2']);
    expect(mod.mergeScoreRows(null, fallback)).toHaveLength(2);
  });

  it('uses Eastern calendar days for scoreboards', () => {
    expect(mod.etDateKey('2026-10-09T02:30:00Z')).toBe('20261008'); // 10:30pm ET on the 8th
    expect(mod.etDateKey('nope')).toBeNull();
  });

  it('combines both sources and survives either one failing', async () => {
    global.fetch = vi.fn(async (url) => {
      if (String(url).includes('the-odds-api')) return { ok: false, status: 500, json: async () => null };
      return { ok: true, status: 200, json: async () => ({ events: [espnEvent('9', 'Miami Heat', 'Chicago Bulls', '2026-10-08T23:00Z', '110', '100')] }) };
    });
    const rows = await mod.fetchScoreRows('basketball_nba', { dates: ['20261008'] });
    expect(rows).toEqual([expect.objectContaining({ id: 'espn:9', source: 'ESPN final scores' })]);
    expect(String(global.fetch.mock.calls.find(c => String(c[0]).includes('espn'))[0])).toContain('scoreboard?dates=20261008');

    global.fetch = vi.fn(async () => ({ ok: false, status: 503, json: async () => null }));
    vi.resetModules();
    mod = await import('./_scores.js');
    expect(await mod.fetchScoreRows('basketball_nba', { dates: ['20261008'] })).toBeNull();
  });

  it('asks ESPN for all Division I games on college scoreboards', async () => {
    global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ events: [] }) }));
    await mod.fetchEspnScoreRows('americanfootball_ncaaf', ['20261010']);
    expect(String(global.fetch.mock.calls[0][0])).toContain('groups=80');
  });
});
