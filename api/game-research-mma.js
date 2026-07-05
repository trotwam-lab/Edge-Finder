/**
 * MMA Game Research Module
 * Tale-of-the-tape for a bout via ESPN's UFC API (structured JSON, no scraping).
 *
 * ESPN's MMA scoreboard lists cards (events) whose competitions are the
 * individual bouts; each competitor carries the fighter's record. We find the
 * bout matching the two fighter names on the card nearest the game date.
 */

const ESPN_MMA_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard';

const _cache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

async function cachedJson(url) {
  const hit = _cache.get(url);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      console.warn(`[MMA Research] HTTP ${res.status}: ${url}`);
      return null;
    }
    const data = await res.json();
    _cache.set(url, { ts: Date.now(), data });
    return data;
  } catch (err) {
    console.warn(`[MMA Research] fetch failed: ${url}`, err.message);
    return null;
  }
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Fighter names from the odds feed and ESPN usually match exactly; fall back
// to last-name equality ("Alexandre Pantoja" vs "A. Pantoja").
function fighterMatches(oddsName, espnName) {
  const a = norm(oddsName);
  const b = norm(espnName);
  if (!a || !b) return false;
  if (a === b) return true;
  const aLast = a.split(' ').pop();
  const bLast = b.split(' ').pop();
  return aLast.length > 2 && aLast === bLast;
}

function parseRecord(summary) {
  // "20-3-0" or "20-3-0 (1 NC)"
  const m = String(summary || '').match(/^(\d+)-(\d+)(?:-(\d+))?/);
  if (!m) return { wins: null, losses: null, draws: null };
  return { wins: Number(m[1]), losses: Number(m[2]), draws: m[3] != null ? Number(m[3]) : 0 };
}

function buildFighter(competitor) {
  const athlete = competitor?.athlete || {};
  const summary = competitor?.records?.[0]?.summary || null;
  return {
    name: athlete.displayName || athlete.fullName || null,
    record: summary,
    ...parseRecord(summary),
    headshot: athlete.headshot?.href || null,
  };
}

function findBout(events, homeFighter, awayFighter) {
  for (const ev of events || []) {
    for (const comp of ev.competitions || []) {
      const fighters = comp.competitors || [];
      if (fighters.length !== 2) continue;
      const names = fighters.map((f) => f.athlete?.displayName || f.athlete?.fullName || '');
      const direct = fighterMatches(homeFighter, names[0]) && fighterMatches(awayFighter, names[1]);
      const flipped = fighterMatches(homeFighter, names[1]) && fighterMatches(awayFighter, names[0]);
      if (!direct && !flipped) continue;
      const homeIdx = direct ? 0 : 1;
      return { event: ev, competition: comp, home: fighters[homeIdx], away: fighters[1 - homeIdx] };
    }
  }
  return null;
}

/**
 * @param {string} homeFighter — from the odds feed's home_team
 * @param {string} awayFighter — from the odds feed's away_team
 * @param {string} gameDate    — YYYY-MM-DD
 * @returns {Promise<object|null>} research payload, or null if the bout
 *          isn't on an ESPN card (caller falls back).
 */
export async function getMmaGameResearch(homeFighter, awayFighter, gameDate) {
  // The card date in ESPN terms can differ by a day from the odds feed's UTC
  // start (late PT main cards) — try the exact date, the surrounding days,
  // then the default current scoreboard.
  const urls = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(gameDate || '')) {
    const d = new Date(`${gameDate}T00:00:00Z`);
    for (const offset of [0, -1, 1]) {
      const dt = new Date(d.getTime() + offset * 24 * 60 * 60 * 1000);
      urls.push(`${ESPN_MMA_SCOREBOARD}?dates=${dt.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
  }
  urls.push(ESPN_MMA_SCOREBOARD);

  let bout = null;
  for (const url of urls) {
    const data = await cachedJson(url);
    bout = findBout(data?.events, homeFighter, awayFighter);
    if (bout) break;
  }
  if (!bout) return null;

  const comp = bout.competition;
  const ev = bout.event;
  return {
    sport: 'mma_mixed_martial_arts',
    gameDate,
    dataSource: 'ESPN MMA',
    card: {
      name: ev.name || null,
      date: ev.date || null,
      venue: comp.venue?.fullName || ev.competitions?.[0]?.venue?.fullName || null,
    },
    weightClass: comp.type?.text || comp.type?.abbreviation || null,
    home: { ...buildFighter(bout.home), name: buildFighter(bout.home).name || homeFighter },
    away: { ...buildFighter(bout.away), name: buildFighter(bout.away).name || awayFighter },
    generatedAt: new Date().toISOString(),
  };
}
