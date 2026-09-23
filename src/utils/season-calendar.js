// src/utils/season-calendar.js
// Typical season windows for the headline sports, used by the welcome page to
// show what's in season on any given date. Dates are approximate month/day
// windows (leagues shift them a few days year to year), so copy that uses
// them should say "typical" rather than quote exact openers. /api/sports is
// the live source of truth for which odds boards are actually up.

// Phases are [startMonth, startDay, endMonth, endDay] (1-based months) and may
// wrap the new year (e.g. NFL playoffs run Jan–Feb).
export const SEASON_CALENDAR = [
  {
    key: 'americanfootball_nfl', label: 'NFL', icon: '🏈', props: true,
    phases: [
      { name: 'Preseason', range: [8, 1, 9, 3] },
      { name: 'Regular season', range: [9, 4, 1, 5] },
      { name: 'Playoffs', range: [1, 6, 2, 15] },
    ],
  },
  {
    key: 'americanfootball_ncaaf', label: 'College Football', icon: '🏈', props: false,
    phases: [
      { name: 'Regular season', range: [8, 23, 12, 14] },
      { name: 'Bowls & CFP', range: [12, 15, 1, 25] },
    ],
  },
  {
    key: 'baseball_mlb', label: 'MLB', icon: '⚾', props: true,
    phases: [
      { name: 'Spring training', range: [2, 20, 3, 24] },
      { name: 'Regular season', range: [3, 25, 9, 30] },
      { name: 'Postseason', range: [10, 1, 11, 5] },
    ],
  },
  {
    key: 'basketball_nba', label: 'NBA', icon: '🏀', props: true,
    phases: [
      { name: 'Preseason', range: [10, 1, 10, 20] },
      { name: 'Regular season', range: [10, 21, 4, 15] },
      { name: 'Playoffs', range: [4, 16, 6, 22] },
    ],
  },
  {
    key: 'icehockey_nhl', label: 'NHL', icon: '🏒', props: true,
    phases: [
      { name: 'Preseason', range: [9, 20, 10, 6] },
      { name: 'Regular season', range: [10, 7, 4, 18] },
      { name: 'Playoffs', range: [4, 19, 6, 25] },
    ],
  },
  {
    key: 'basketball_wnba', label: 'WNBA', icon: '🏀', props: true,
    phases: [
      { name: 'Regular season', range: [5, 15, 9, 12] },
      { name: 'Playoffs', range: [9, 13, 10, 20] },
    ],
  },
  {
    key: 'basketball_ncaab', label: 'College Hoops', icon: '🏀', props: false,
    phases: [
      { name: 'Regular season', range: [11, 3, 3, 15] },
      { name: 'March Madness', range: [3, 16, 4, 8] },
    ],
  },
  {
    key: 'soccer_epl', label: 'Premier League', icon: '⚽', props: false,
    phases: [{ name: 'Season', range: [8, 15, 5, 25] }],
  },
  {
    key: 'soccer_uefa_champs_league', label: 'Champions League', icon: '⚽', props: false,
    phases: [
      { name: 'League phase', range: [9, 15, 1, 31] },
      { name: 'Knockouts', range: [2, 1, 5, 31] },
    ],
  },
  {
    key: 'soccer_usa_mls', label: 'MLS', icon: '⚽', props: false,
    phases: [
      { name: 'Regular season', range: [2, 21, 10, 20] },
      { name: 'Playoffs', range: [10, 21, 12, 8] },
    ],
  },
  {
    key: 'mma_mixed_martial_arts', label: 'UFC / MMA', icon: '🥊', props: false,
    phases: [{ name: 'Fight cards weekly', range: [1, 1, 12, 31] }],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;
export const STARTING_SOON_DAYS = 21;

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Resolves a phase to concrete start/end dates around `today`, choosing the
// occurrence that contains today or else the next one to start.
function resolvePhase(range, today) {
  const [sm, sd, em, ed] = range;
  const year = today.getFullYear();
  const wraps = em < sm || (em === sm && ed < sd);
  const candidates = [year - 1, year, year + 1].map(startYear => ({
    start: new Date(startYear, sm - 1, sd),
    end: new Date(wraps ? startYear + 1 : startYear, em - 1, ed),
  }));
  return candidates.find(c => today >= c.start && today <= c.end)
    || candidates.filter(c => c.start > today).sort((a, b) => a.start - b.start)[0];
}

// Returns { state: 'live' | 'soon' | 'off', phase, daysUntil, startsOn, endsOn }.
export function getSeasonStatus(sport, now = new Date()) {
  const today = startOfDay(now);
  let upcoming = null;
  for (const phase of sport.phases) {
    const window = resolvePhase(phase.range, today);
    if (!window) continue;
    if (today >= window.start && today <= window.end) {
      return { state: 'live', phase: phase.name, endsOn: window.end, daysUntil: 0 };
    }
    if (!upcoming || window.start < upcoming.startsOn) {
      upcoming = { phase: phase.name, startsOn: window.start };
    }
  }
  if (!upcoming) return { state: 'off', phase: null, daysUntil: null };
  const daysUntil = Math.round((upcoming.startsOn - today) / DAY_MS);
  return {
    state: daysUntil <= STARTING_SOON_DAYS ? 'soon' : 'off',
    phase: upcoming.phase,
    startsOn: upcoming.startsOn,
    daysUntil,
  };
}

const STATE_ORDER = { live: 0, soon: 1, off: 2 };

// Calendar entries with status, in-season first, then soonest to start.
export function getSeasonBoard(now = new Date()) {
  return SEASON_CALENDAR
    .map((sport, index) => ({ ...sport, index, status: getSeasonStatus(sport, now) }))
    .sort((a, b) => (
      STATE_ORDER[a.status.state] - STATE_ORDER[b.status.state]
      || (a.status.state === 'live' ? a.index - b.index : (a.status.daysUntil ?? 999) - (b.status.daysUntil ?? 999))
    ));
}
