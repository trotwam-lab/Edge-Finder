/**
 * Tennis Game Research Module
 * Player research for a match via ESPN's tennis scoreboards (ATP/WTA).
 *
 * Odds API tennis keys are per-tournament (tennis_atp_wimbledon,
 * tennis_wta_us_open, ...); the atp/wta segment picks the ESPN league. ESPN's
 * tennis scoreboard nests matches under tournament events, so we scan both
 * event.competitions and event.groupings[].competitions defensively.
 *
 * Recent form comes from the last week of scoreboards — during a slam that is
 * the player's run through the draw — and carries the withdrawal-watch
 * signal: retirements and walkovers are flagged from the match status.
 */

const ESPN_TENNIS_BASE = 'https://site.api.espn.com/apis/site/v2/sports/tennis';

const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function cachedJson(url) {
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[Tennis Research] HTTP ${res.status}: ${url}`);
      return null;
    }
    const data = await res.json();
    _cache.set(url, { ts: Date.now(), data });
    return data;
  } catch (err) {
    console.warn(`[Tennis Research] fetch failed: ${url}`, err.message);
    return null;
  }
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

function playerMatches(oddsName, espnName) {
  const a = norm(oddsName);
  const b = norm(espnName);
  if (!a || !b) return false;
  if (a === b) return true;
  const aLast = a.split(' ').pop();
  const bLast = b.split(' ').pop();
  return aLast.length > 2 && aLast === bLast;
}

function leagueFromSportKey(sportKey) {
  const m = String(sportKey || '').match(/^tennis_(atp|wta)_/);
  return m ? m[1] : null;
}

function* allCompetitions(events) {
  for (const ev of events || []) {
    for (const comp of ev.competitions || []) yield { tournament: ev, comp };
    for (const grouping of ev.groupings || []) {
      for (const comp of grouping.competitions || []) yield { tournament: ev, comp, grouping };
    }
  }
}

function competitorFor(comp, playerName) {
  return (comp.competitors || []).find((c) =>
    playerMatches(playerName, c.athlete?.displayName || c.athlete?.fullName || c.athlete?.shortName));
}

function setsLine(comp, self, opp) {
  const s = (self?.linescores || []).map((l) => l.value ?? l.displayValue).join('-');
  const o = (opp?.linescores || []).map((l) => l.value ?? l.displayValue).join('-');
  return s && o ? `${s} / ${o}` : null;
}

function statusFlags(comp) {
  const detail = [comp.status?.type?.shortDetail, comp.status?.type?.detail, comp.status?.type?.description]
    .filter(Boolean).join(' ');
  return {
    completed: comp.status?.type?.completed === true,
    retired: /\bret\b|retired/i.test(detail),
    walkover: /walkover|\bw\/?o\b/i.test(detail),
  };
}

function dateStamp(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

async function scoreboardFor(league, yyyymmdd) {
  return cachedJson(`${ESPN_TENNIS_BASE}/${league}/scoreboard?dates=${yyyymmdd}`);
}

/**
 * Recent completed matches for a player across the last `days` of
 * scoreboards. During a tournament this is their run through the draw.
 */
async function recentMatchesFor(league, playerName, fromDate, days = 7) {
  const out = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(fromDate.getTime() - i * 24 * 60 * 60 * 1000);
    const board = await scoreboardFor(league, dateStamp(d));
    for (const { comp } of allCompetitions(board?.events)) {
      const flags = statusFlags(comp);
      if (!flags.completed) continue;
      const self = competitorFor(comp, playerName);
      if (!self) continue;
      const opp = (comp.competitors || []).find((c) => c !== self);
      out.push({
        date: d.toISOString().slice(0, 10),
        opponent: opp?.athlete?.displayName || 'Unknown',
        result: self.winner === true ? 'W' : self.winner === false ? 'L' : 'T',
        score: setsLine(comp, self, opp),
        opponentScore: null,
        retired: flags.retired,
        walkover: flags.walkover,
        round: comp.round?.displayName || comp.notes?.[0]?.headline || null,
      });
    }
  }
  return out;
}

function playerCard(competitor, name, matches) {
  return {
    name: competitor?.athlete?.displayName || name,
    rank: competitor?.curatedRank?.current ?? competitor?.athlete?.rank ?? null,
    seed: competitor?.seed ?? null,
    last10: matches.map((m) => ({
      date: m.date, opponent: m.opponent, result: m.result,
      score: m.score, opponentScore: m.opponentScore,
    })),
    // Withdrawal-watch: losing a match marked RET means THIS player quit
    // hurt — the top fitness red flag. Winning by an opponent's retirement
    // says nothing about the winner.
    retirementFlag: matches.some((m) => m.retired && m.result === 'L'),
  };
}

/**
 * @param {string} homePlayer — odds feed home_team (a player name)
 * @param {string} awayPlayer — odds feed away_team
 * @param {string} sportKey  — e.g. tennis_atp_wimbledon
 * @param {string} gameDate  — YYYY-MM-DD
 * @returns {Promise<object|null>} research payload, or null (caller falls back)
 */
export async function getTennisGameResearch(homePlayer, awayPlayer, sportKey, gameDate) {
  const league = leagueFromSportKey(sportKey);
  if (!league) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDate || '')) return null;
  const matchDate = new Date(`${gameDate}T00:00:00Z`);

  // Locate the upcoming match (today or tomorrow's board) for rank/seed and
  // tournament context. Not finding it is fine — form still populates.
  let upcoming = null;
  for (const offset of [0, 1]) {
    const d = new Date(matchDate.getTime() + offset * 24 * 60 * 60 * 1000);
    const board = await scoreboardFor(league, dateStamp(d));
    for (const { tournament, comp } of allCompetitions(board?.events)) {
      const home = competitorFor(comp, homePlayer);
      const away = competitorFor(comp, awayPlayer);
      if (home && away && home !== away) {
        upcoming = { tournament, comp, home, away };
        break;
      }
    }
    if (upcoming) break;
  }

  const [homeMatches, awayMatches] = await Promise.all([
    recentMatchesFor(league, homePlayer, matchDate),
    recentMatchesFor(league, awayPlayer, matchDate),
  ]);

  if (!upcoming && homeMatches.length === 0 && awayMatches.length === 0) return null;

  return {
    sport: sportKey,
    gameDate,
    supported: true,
    dataSource: `ESPN Tennis (${league.toUpperCase()})`,
    tournament: upcoming?.tournament?.name || upcoming?.tournament?.shortName || null,
    round: upcoming?.comp?.round?.displayName || null,
    home: playerCard(upcoming?.home, homePlayer, homeMatches),
    away: playerCard(upcoming?.away, awayPlayer, awayMatches),
    generatedAt: new Date().toISOString(),
  };
}
