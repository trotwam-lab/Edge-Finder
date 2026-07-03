// utils/live-status.js — accurate game status + "game of the day" helpers.
//
// The app historically treated any game whose commence_time was in the past as
// "LIVE", which left finished games glowing red for hours. This module derives
// an honest status from the richer ESPN scoreboard feed (merged onto each game
// as `game.liveStatus`) and falls back to safe heuristics when that feed has no
// row for a game (e.g. tennis/MMA, which we don't map to ESPN).

// Our odds-API sport keys -> ESPN scoreboard paths. Only the sports ESPN
// actually covers are listed; everything else degrades gracefully to time-based
// status with no inning/quarter detail.
export const SPORT_ESPN_SCOREBOARD = {
  basketball_nba: 'basketball/nba',
  basketball_wnba: 'basketball/wnba',
  basketball_ncaab: 'basketball/mens-college-basketball',
  basketball_wncaab: 'basketball/womens-college-basketball',
  americanfootball_nfl: 'football/nfl',
  americanfootball_ncaaf: 'football/college-football',
  icehockey_nhl: 'hockey/nhl',
  baseball_mlb: 'baseball/mlb',
  soccer_fifa_world_cup: 'soccer/fifa.world',
  soccer_epl: 'soccer/eng.1',
  soccer_spain_la_liga: 'soccer/esp.1',
  soccer_italy_serie_a: 'soccer/ita.1',
  soccer_germany_bundesliga: 'soccer/ger.1',
  soccer_france_ligue_one: 'soccer/fra.1',
  soccer_uefa_champs_league: 'soccer/uefa.champions',
  soccer_usa_mls: 'soccer/usa.1',
  soccer_mexico_ligamx: 'soccer/mex.1',
};

const HOUR = 60 * 60 * 1000;

function parseTime(value) {
  const t = Date.parse(value || '');
  return Number.isFinite(t) ? t : null;
}

function formatClockTime(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Human friendly start time: "7:05 PM" today, "Sat 1:00 PM" another day.
export function formatStartTime(value) {
  const t = parseTime(value);
  if (t == null) return 'TBD';
  const date = new Date(t);
  const sameDay = new Date().toDateString() === date.toDateString();
  return sameDay
    ? formatClockTime(date)
    : date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

// Short countdown for games starting very soon ("12m", "1h 5m").
export function formatCountdown(value) {
  const t = parseTime(value);
  if (t == null) return null;
  const diff = t - Date.now();
  if (diff <= 0) return null;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`;
}

/**
 * Derive an honest status object for a game.
 * Prefers the ESPN-backed `game.liveStatus`, then the odds-API scores feed,
 * then a conservative time-based guess.
 *
 * @returns {{
 *   state: 'pre'|'in'|'post',
 *   isLive: boolean, isFinal: boolean, isUpcoming: boolean,
 *   label: string, detail: string|null,
 *   period: number|null, clock: string|null,
 *   homeScore: (number|string|null), awayScore: (number|string|null),
 *   confident: boolean
 * }}
 */
export function getGameStatus(game) {
  const ls = game?.liveStatus || null;
  const commence = parseTime(game?.commence_time);
  const now = Date.now();

  // 1) ESPN scoreboard truth — has period/clock/inning detail.
  if (ls && ls.state) {
    const isLive = ls.state === 'in';
    const isFinal = ls.state === 'post' || ls.completed === true;
    const isUpcoming = ls.state === 'pre' && !isFinal;
    return {
      state: isFinal ? 'post' : ls.state,
      isLive,
      isFinal,
      isUpcoming,
      label: isLive ? 'LIVE' : isFinal ? 'FINAL' : formatStartTime(game.commence_time),
      detail: ls.detail || (isFinal ? 'Final' : isLive ? 'In progress' : null),
      period: ls.period ?? null,
      clock: ls.clock ?? null,
      homeScore: ls.homeScore ?? game?.homeScore ?? null,
      awayScore: ls.awayScore ?? game?.awayScore ?? null,
      confident: true,
    };
  }

  // 2) odds-API scores feed (no period/clock, but tells us completed vs not).
  const hasScores = Array.isArray(game?.scores) && game.scores.length > 0;
  if (game?.completed) {
    return {
      state: 'post', isLive: false, isFinal: true, isUpcoming: false,
      label: 'FINAL', detail: 'Final', period: null, clock: null,
      homeScore: game.homeScore ?? null, awayScore: game.awayScore ?? null,
      confident: true,
    };
  }
  if (hasScores && commence != null && commence <= now) {
    return {
      state: 'in', isLive: true, isFinal: false, isUpcoming: false,
      label: 'LIVE', detail: 'In progress', period: null, clock: null,
      homeScore: game.homeScore ?? null, awayScore: game.awayScore ?? null,
      confident: true,
    };
  }

  // 3) Time-based fallback. Crucially, a past start time with NO score
  // evidence is NOT treated as a confident LIVE — that was the old bug.
  if (commence == null) {
    return {
      state: 'pre', isLive: false, isFinal: false, isUpcoming: true,
      label: 'TBD', detail: null, period: null, clock: null,
      homeScore: null, awayScore: null, confident: false,
    };
  }
  if (commence > now) {
    return {
      state: 'pre', isLive: false, isFinal: false, isUpcoming: true,
      label: formatStartTime(game.commence_time), detail: null, period: null, clock: null,
      homeScore: null, awayScore: null, confident: true,
    };
  }
  // Started, no score data. Assume in-progress for a few hours, then stale.
  const likelyOver = now - commence > 5 * HOUR;
  return {
    state: likelyOver ? 'post' : 'in',
    isLive: false, // not confident enough to flash red
    isFinal: false,
    isUpcoming: false,
    label: likelyOver ? 'ENDED' : 'IN PROGRESS',
    detail: likelyOver ? null : 'Started',
    period: null, clock: null,
    homeScore: game?.homeScore ?? null, awayScore: game?.awayScore ?? null,
    confident: false,
  };
}

export function isGameLive(game) {
  return getGameStatus(game).isLive;
}
export function isGameFinal(game) {
  return getGameStatus(game).isFinal;
}
// Upcoming = not started and within the next window (used for "starting soon").
export function isGameUpcoming(game) {
  const s = getGameStatus(game);
  return s.isUpcoming;
}

// ── Game of the Day / featured ticker ──────────────────────────────────────

// Client-side marquee keyword scan as a backstop to the server's detection,
// so the ticker still lights up even before ESPN tags a headline.
const MARQUEE_RULES = [
  { re: /super bowl/i, label: 'SUPER BOWL', weight: 100 },
  { re: /world series/i, label: 'WORLD SERIES', weight: 100 },
  { re: /stanley cup/i, label: 'STANLEY CUP', weight: 100 },
  { re: /world cup/i, label: 'WORLD CUP', weight: 100 },
  { re: /champions league final|ucl final/i, label: 'UCL FINAL', weight: 98 },
  { re: /nba finals|the finals/i, label: 'FINALS', weight: 96 },
  { re: /national championship/i, label: 'NATIONAL CHAMPIONSHIP', weight: 95 },
  { re: /final four/i, label: 'FINAL FOUR', weight: 92 },
  { re: /\bel cl[aá]sico\b/i, label: 'EL CLÁSICO', weight: 90 },
  { re: /\bgame 7\b/i, label: 'GAME 7', weight: 88 },
  { re: /conference (final|championship)/i, label: 'CONFERENCE FINAL', weight: 84 },
  { re: /\bfinal\b/i, label: 'FINAL', weight: 82 },
  { re: /championship/i, label: 'CHAMPIONSHIP', weight: 80 },
  { re: /playoff|postseason/i, label: 'PLAYOFFS', weight: 70 },
  { re: /all-?star/i, label: 'ALL-STAR', weight: 66 },
  { re: /opening day/i, label: 'OPENING DAY', weight: 64 },
  { re: /rivalry|derby|clasico/i, label: 'RIVALRY', weight: 60 },
];

function clientMarquee(game) {
  const hay = [game?.sport_title, game?.home_team, game?.away_team]
    .filter(Boolean)
    .join(' ');
  for (const rule of MARQUEE_RULES) {
    if (rule.re.test(hay)) return { label: rule.label, weight: rule.weight };
  }
  return null;
}

function isToday(value) {
  const t = parseTime(value);
  if (t == null) return false;
  return new Date(t).toDateString() === new Date().toDateString();
}

/**
 * Rank today's slate to find the marquee "Game of the Day" and a list of the
 * most relevant upcoming/live games for the ticker.
 *
 * @param {Array} games merged games (may carry `liveStatus`)
 * @param {{ maxTicker?: number }} [opts]
 */
export function buildFeaturedEvents(games = [], opts = {}) {
  const maxTicker = opts.maxTicker ?? 12;
  const now = Date.now();

  const scored = games.map((game) => {
    const status = getGameStatus(game);
    const serverFeatured = game?.liveStatus?.featured || null;
    const localFeatured = clientMarquee(game);
    const marquee = serverFeatured && (!localFeatured || serverFeatured.weight >= localFeatured.weight)
      ? serverFeatured
      : localFeatured;

    const bookCount = game?.bookmakers?.length || 0;
    const commence = parseTime(game?.commence_time) ?? now;
    // Soonness: peaks for games tipping in the next few hours.
    const hoursOut = (commence - now) / HOUR;
    let soonness = 0;
    if (status.isUpcoming) soonness = Math.max(0, 14 - Math.abs(hoursOut));
    const weight =
      (marquee?.weight || 0) +
      (status.isLive ? 28 : 0) +
      (status.isFinal ? -40 : 0) +
      Math.min(bookCount, 12) +
      soonness;

    return { game, status, marquee, weight, commence };
  });

  // Candidates for "game of the day": today's games that aren't long over.
  const todays = scored.filter(s =>
    (isToday(s.game?.commence_time) || s.status.isLive) && !(s.status.isFinal && !s.marquee)
  );
  const pool = todays.length ? todays : scored.filter(s => !s.status.isFinal);
  const gameOfDay = [...pool].sort((a, b) => b.weight - a.weight)[0] || null;

  // Ticker: live games first, then soonest upcoming, then the rest of today.
  const live = scored.filter(s => s.status.isLive)
    .sort((a, b) => b.weight - a.weight);
  const upcoming = scored.filter(s => s.status.isUpcoming)
    .sort((a, b) => a.commence - b.commence);
  const seen = new Set();
  const ticker = [];
  [...live, ...upcoming].forEach(s => {
    if (ticker.length >= maxTicker) return;
    if (seen.has(s.game?.id)) return;
    seen.add(s.game?.id);
    ticker.push(s);
  });

  return {
    gameOfDay,
    ticker,
    liveCount: live.length,
    upcomingCount: upcoming.length,
  };
}
