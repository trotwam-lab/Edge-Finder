// api/mlb-statsapi.js — authoritative MLB probables + lineups via the MLB Stats API.
//
// ESPN's scoreboard does not reliably expose probable pitchers, so the research
// module used to fall back to a rotation *guess*. MLB's own Stats API
// (statsapi.mlb.com, free, no key) is the source of truth that powers MLB.com:
// official probable starters, posted lineups, and per-pitcher season + game-log
// stats. We use it as the primary source and let ESPN remain a fallback.

const STATSAPI = 'https://statsapi.mlb.com/api/v1';

async function safeJson(url, timeout = 9000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[mlb-statsapi] fetch failed: ${url} — ${err.message}`);
    return null;
  }
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Tolerant team match: exact normalized, or one name contains the other
// ("Athletics" vs "Oakland Athletics"). Avoids the "Red Sox / White Sox"
// last-word collision that a nickname-only match would cause.
function teamMatches(apiName, ourName) {
  const a = norm(apiName);
  const b = norm(ourName);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function shiftDate(ymd, deltaDays) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

function headshot(id) {
  return id ? `https://midfield.mlbstatic.com/v1/people/${id}/spots/120` : null;
}

// Fetch a probable pitcher's season line + last 3 starts from the Stats API.
async function enrichPitcher(prob, season) {
  if (!prob?.id) return null;
  const base = {
    name: prob.fullName || null,
    id: prob.id,
    headshot: headshot(prob.id),
    confirmed: true,
    source: 'mlb-statsapi',
  };

  const hydrate = encodeURIComponent(`stats(group=[pitching],type=[season,gameLog],season=${season})`);
  const data = await safeJson(`${STATSAPI}/people/${prob.id}?hydrate=${hydrate}`);
  const groups = data?.people?.[0]?.stats || [];

  const seasonStat = groups.find(g => /season/i.test(g.type?.displayName || ''))?.splits?.[0]?.stat;
  if (seasonStat) {
    base.era = seasonStat.era != null ? Number(seasonStat.era) : null;
    base.whip = seasonStat.whip != null ? Number(seasonStat.whip) : null;
    base.wins = seasonStat.wins ?? 0;
    base.losses = seasonStat.losses ?? 0;
    base.record = `${base.wins}-${base.losses}`;
    base.strikeouts = seasonStat.strikeOuts ?? 0;
    base.inningsPitched = seasonStat.inningsPitched ?? null;
    base.gamesStarted = seasonStat.gamesStarted ?? 0;
    base.era2 = seasonStat.era; // raw display
  }

  const log = groups.find(g => /gamelog/i.test(g.type?.displayName || ''));
  base.last3Starts = (log?.splits || [])
    .filter(sp => Number(sp.stat?.gamesStarted) === 1)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3)
    .map(sp => ({
      date: sp.date,
      opponent: sp.opponent?.name || null,
      inningsPitched: sp.stat?.inningsPitched ?? null,
      earnedRuns: sp.stat?.earnedRuns ?? null,
      hits: sp.stat?.hits ?? null,
      walks: sp.stat?.baseOnBalls ?? null,
      strikeouts: sp.stat?.strikeOuts ?? null,
    }));

  return base;
}

function mapLineup(players) {
  return (players || []).map(p => ({
    id: p.id,
    name: p.fullName || p.person?.fullName || null,
    pos: p.primaryPosition?.abbreviation || p.position?.abbreviation || null,
  })).filter(p => p.name);
}

/**
 * Get authoritative probable pitchers + lineups for a matchup.
 * @returns {Promise<null | {
 *   source:'mlb-statsapi', gamePk:number, status:string,
 *   home: object|null, away: object|null,
 *   confirmedHome: boolean, confirmedAway: boolean,
 *   lineups: { home: Array, away: Array }|null, lineupsPosted: boolean
 * }>}
 */
export async function getMlbProbablesAndLineups(homeTeam, awayTeam, gameDate) {
  const ymd = (gameDate && /^\d{4}-\d{2}-\d{2}/.test(gameDate)) ? gameDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const season = ymd.slice(0, 4);
  const start = shiftDate(ymd, -1);
  const end = shiftDate(ymd, 1);

  const hydrate = encodeURIComponent('probablePitcher,lineups,team');
  const sched = await safeJson(`${STATSAPI}/schedule?sportId=1&startDate=${start}&endDate=${end}&hydrate=${hydrate}`);
  const games = (sched?.dates || []).flatMap(d => d.games || []);
  if (games.length === 0) return null;

  // Match the game by both teams (either orientation), nearest to the target date.
  const target = Date.parse(`${ymd}T18:00:00Z`);
  const matches = games.filter(g => {
    const h = g.teams?.home?.team?.name;
    const a = g.teams?.away?.team?.name;
    return (teamMatches(h, homeTeam) && teamMatches(a, awayTeam)) ||
           (teamMatches(h, awayTeam) && teamMatches(a, homeTeam));
  });
  if (matches.length === 0) return null;
  const game = matches.sort((x, y) =>
    Math.abs(Date.parse(x.gameDate) - target) - Math.abs(Date.parse(y.gameDate) - target)
  )[0];

  // Orient MLB's home/away to OUR home/away.
  const homeSideIsHome = teamMatches(game.teams?.home?.team?.name, homeTeam);
  const homeSide = homeSideIsHome ? game.teams.home : game.teams.away;
  const awaySide = homeSideIsHome ? game.teams.away : game.teams.home;
  const homeLineupKey = homeSideIsHome ? 'homePlayers' : 'awayPlayers';
  const awayLineupKey = homeSideIsHome ? 'awayPlayers' : 'homePlayers';

  const [homePitcher, awayPitcher] = await Promise.all([
    enrichPitcher(homeSide?.probablePitcher, season),
    enrichPitcher(awaySide?.probablePitcher, season),
  ]);

  const lineups = game.lineups ? {
    home: mapLineup(game.lineups[homeLineupKey]),
    away: mapLineup(game.lineups[awayLineupKey]),
  } : null;
  const lineupsPosted = !!(lineups && (lineups.home.length || lineups.away.length));

  return {
    source: 'mlb-statsapi',
    gamePk: game.gamePk,
    status: game.status?.detailedState || null,
    home: homePitcher,
    away: awayPitcher,
    confirmedHome: !!homeSide?.probablePitcher?.id,
    confirmedAway: !!awaySide?.probablePitcher?.id,
    lineups,
    lineupsPosted,
  };
}

export default getMlbProbablesAndLineups;
