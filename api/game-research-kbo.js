/**
 * KBO Research Module — starting-pitcher (probables) scrape from MyKBO Stats.
 *
 * There is no structured English KBO API: ESPN dropped KBO coverage, and
 * mykbostats.com is HTML-only. This scraper is deliberately paranoid — it
 * works on de-tagged text, matches games by team nicknames, and extracts
 * romanized player-name candidates near the matchup. Anything it can't parse
 * degrades to null; the caller ships the research without probables.
 */

const MYKBO_URL = 'https://mykbostats.com/';
// TheSportsDB free API (test key 123) — structured JSON and datacenter-
// friendly, unlike MyKBO (Cloudflare 403s serverless IPs) and the Odds API
// scores feed (carries only upcoming KBO games, never completed). The league
// feed (eventspastleague) only exposes the current round, so recent form
// comes from per-team lookups: resolve the team id once, then eventslast
// returns that team's last 5 finished games with scores.
const SPORTSDB = 'https://www.thesportsdb.com/api/v1/json/123';
const SPORTSDB_KBO_TEAMS = `${SPORTSDB}/search_all_teams.php?l=Korean%20KBO%20League`;
const CACHE_TTL_MS = 10 * 60 * 1000;
const TEAMS_TTL_MS = 24 * 60 * 60 * 1000;
let _pageCache = null;   // { ts, text }  (MyKBO)
let _teamsCache = null;  // { ts, teams } (TheSportsDB league roster)
const _lastEventsCache = new Map(); // teamId -> { ts, results }

// Odds-feed team name -> nickname token used to locate the game on the page
const KBO_NICKNAMES = [
  'bears', 'twins', 'tigers', 'lions', 'giants',
  'landers', 'heroes', 'eagles', 'dinos', 'wiz',
];

const NAME_STOPWORDS = new Set([
  'starting', 'pitchers', 'pitcher', 'today', 'yesterday', 'results', 'games',
  'game', 'schedule', 'standings', 'stats', 'league', 'kbo', 'live', 'final',
  'postponed', 'canceled', 'cancelled', 'doubleheader', 'stadium', 'park',
  'doosan', 'bears', 'lg', 'twins', 'kia', 'tigers', 'samsung', 'lions',
  'lotte', 'giants', 'ssg', 'landers', 'kiwoom', 'heroes', 'hanwha', 'eagles',
  'nc', 'dinos', 'kt', 'wiz',
]);

function teamMatches(eventTeam, oddsTeam) {
  const a = String(eventTeam || '').toLowerCase().trim();
  const b = String(oddsTeam || '').toLowerCase().trim();
  if (!a || !b) return false;
  if (a === b) return true;
  // "Kia Tigers" vs "KIA Tigers", "kt wiz" vs "KT Wiz" — nickname equality
  return a.split(/\s+/).pop() === b.split(/\s+/).pop();
}

async function sdbJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`TheSportsDB HTTP ${res.status}`);
  return res.json();
}

async function lookupKboTeamId(teamName) {
  if (!_teamsCache || Date.now() - _teamsCache.ts > TEAMS_TTL_MS) {
    const data = await sdbJson(SPORTSDB_KBO_TEAMS);
    _teamsCache = { ts: Date.now(), teams: Array.isArray(data?.teams) ? data.teams : [] };
  }
  const match = _teamsCache.teams.find(
    (t) => teamMatches(t.strTeam, teamName) || teamMatches(t.strTeamAlternate, teamName)
  );
  return match?.idTeam || null;
}

async function lastEventsForTeam(teamId) {
  const hit = _lastEventsCache.get(teamId);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.results;
  const data = await sdbJson(`${SPORTSDB}/eventslast.php?id=${teamId}`);
  const results = Array.isArray(data?.results) ? data.results : [];
  _lastEventsCache.set(teamId, { ts: Date.now(), results });
  return results;
}

function formFromEvents(events, teamName) {
  return (events || [])
    .filter((e) => e.intHomeScore != null && e.intAwayScore != null)
    .sort((a, b) => new Date(b.dateEvent || 0) - new Date(a.dateEvent || 0))
    .slice(0, 10)
    .map((e) => {
      const isHome = teamMatches(e.strHomeTeam, teamName);
      const self = Number(isHome ? e.intHomeScore : e.intAwayScore);
      const opp = Number(isHome ? e.intAwayScore : e.intHomeScore);
      return {
        date: e.dateEvent || null,
        opponent: isHome ? e.strAwayTeam : e.strHomeTeam,
        result: self > opp ? 'W' : self < opp ? 'L' : 'T',
        score: String(self),
        opponentScore: String(opp),
      };
    });
}

/**
 * Recent form for a KBO matchup from TheSportsDB's per-team last-5 feeds.
 * Returns a generic-research-shaped payload, or null if the source is down
 * or neither team resolves (caller falls back).
 */
export async function getKboRecentForm(homeTeam, awayTeam, gameDate) {
  try {
    const [homeId, awayId] = await Promise.all([
      lookupKboTeamId(homeTeam),
      lookupKboTeamId(awayTeam),
    ]);
    if (!homeId && !awayId) {
      const roster = (_teamsCache?.teams || []).map((t) => t.strTeam).join(', ');
      console.warn(`[KBO Research] TheSportsDB: no team match for ${awayTeam} @ ${homeTeam} (roster: ${roster || 'empty'})`);
      return null;
    }

    const [homeEvents, awayEvents] = await Promise.all([
      homeId ? lastEventsForTeam(homeId) : [],
      awayId ? lastEventsForTeam(awayId) : [],
    ]);
    const home = formFromEvents(homeEvents, homeTeam);
    const away = formFromEvents(awayEvents, awayTeam);
    if (home.length === 0 && away.length === 0) {
      console.warn(`[KBO Research] TheSportsDB: teams resolved but no finished games (${awayTeam} @ ${homeTeam})`);
      return null;
    }

    return {
      sport: 'baseball_kbo',
      gameDate,
      supported: true,
      dataSource: 'TheSportsDB',
      home: { name: homeTeam, id: homeId, last10: home },
      away: { name: awayTeam, id: awayId, last10: away },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[KBO Research] TheSportsDB fetch failed:', err.message);
    return null;
  }
}

async function fetchPageText() {
  if (_pageCache && Date.now() - _pageCache.ts < CACHE_TTL_MS) return _pageCache.text;
  const res = await fetch(MYKBO_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`MyKBO HTTP ${res.status}`);
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&amp;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ');
  _pageCache = { ts: Date.now(), text };
  return text;
}

function nickname(teamName) {
  const last = String(teamName || '').trim().split(/\s+/).pop().toLowerCase();
  return KBO_NICKNAMES.includes(last) ? last : null;
}

// Romanized names on MyKBO: "Casey Kelly", "Won-tae Choi", "Chan-Ho Park".
const NAME_RE = /\b[A-Z][a-z]+(?:-[A-Za-z][a-z]*)?\s[A-Z][a-z]+(?:-[A-Za-z][a-z]*)?\b/g;

function extractNames(windowText) {
  const seen = new Set();
  const out = [];
  for (const m of windowText.matchAll(NAME_RE)) {
    const candidate = m[0];
    const words = candidate.toLowerCase().split(/[\s-]+/);
    if (words.some((w) => NAME_STOPWORDS.has(w))) continue;
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    out.push(candidate);
    if (out.length >= 2) break;
  }
  return out;
}

/**
 * Best-effort starting pitchers for one KBO matchup.
 * @returns {Promise<{home: string|null, away: string|null, source: string}|null>}
 */
export async function getKboProbables(homeTeam, awayTeam) {
  const homeNick = nickname(homeTeam);
  const awayNick = nickname(awayTeam);
  if (!homeNick || !awayNick || homeNick === awayNick) return null;

  let text;
  try {
    text = await fetchPageText();
  } catch (err) {
    console.warn('[KBO Research] MyKBO fetch failed:', err.message);
    return null;
  }

  const lower = text.toLowerCase();
  // Find the closest co-occurrence of the two nicknames — that's this game's
  // card on the page. MyKBO lists matchups as "Away @/at Home".
  let best = null;
  let from = 0;
  while (true) {
    const a = lower.indexOf(awayNick, from);
    if (a === -1) break;
    // nearest home-nickname occurrence after (or shortly before) the away one
    const h = lower.indexOf(homeNick, Math.max(0, a - 60));
    if (h !== -1) {
      const span = Math.abs(h - a);
      if (span < 200 && (!best || span < best.span)) best = { start: Math.min(a, h), end: Math.max(a, h), span };
    }
    from = a + awayNick.length;
  }
  if (!best) return null;

  // Pitchers are printed with/after the matchup — scan a window around it.
  const windowText = text.slice(Math.max(0, best.start - 40), best.end + 300);
  const names = extractNames(windowText);
  if (names.length === 0) {
    console.warn(`[KBO Research] matchup found but no pitcher names parsed (${awayTeam} @ ${homeTeam})`);
    return null;
  }

  // MyKBO convention: away listed first, home second.
  return {
    away: names[0] || null,
    home: names[1] || null,
    source: 'MyKBO Stats',
  };
}
