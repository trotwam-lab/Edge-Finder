/**
 * game-research.js
 * EdgeFinder game research router.
 *
 * Routes to sport-specific modules:
 *   - MLB  -> game-research-baseball.js
 *   - NBA  -> game-research-basketball.js
 *   - NHL  -> game-research-hockey.js   (icehockey_nhl)
 *   - else -> generic last-10 fallback
 */

import { getBaseballResearch } from './game-research-baseball.js';
import { getBasketballGameResearch } from './game-research-basketball.js';
import { getHockeyGameResearch } from './game-research-hockey.js';
import { getMmaGameResearch } from './game-research-mma.js';
import { getKboProbables, getKboRecentForm } from './game-research-kbo.js';
import { ESPN_SITE_BASE, SPORT_PATHS } from './_espn-paths.js';

// ────────────────────────────────────────────────────────────────
// Generic fallback: last-10 games via ESPN
// ────────────────────────────────────────────────────────────────

// Research that couldn't be assembled is a degraded 200, never a 500 — the
// client renders "No data" rows and the rest of the game card stays useful.
function degradedResearch(homeTeam, awayTeam, sport, gameDate, note) {
  return {
    sport,
    gameDate,
    supported: false,
    note,
    home: { name: homeTeam, id: null, last10: [] },
    away: { name: awayTeam, id: null, last10: [] },
    generatedAt: new Date().toISOString(),
  };
}

// Leagues ESPN doesn't carry (KBO, NPB, cricket, ...) still have recent
// results in the Odds API scores feed we already pay for — daysFrom=3 covers
// ~3 games per team in a daily league. Cached 5 minutes per sport.
const _scoresCache = new Map();
const SCORES_TTL = 5 * 60 * 1000;

async function getOddsApiRecentForm(homeTeam, awayTeam, sport, gameDate) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;
  try {
    let games;
    const hit = _scoresCache.get(sport);
    if (hit && Date.now() - hit.ts < SCORES_TTL) {
      games = hit.games;
    } else {
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=3`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return null;
      games = await res.json();
      _scoresCache.set(sport, { games, ts: Date.now() });
    }

    const recentFor = (teamName) => (games || [])
      .filter((g) => g.completed && (g.home_team === teamName || g.away_team === teamName))
      .sort((a, b) => new Date(b.commence_time) - new Date(a.commence_time))
      .map((g) => {
        const opponent = g.home_team === teamName ? g.away_team : g.home_team;
        const self = Number(g.scores?.find((s) => s.name === teamName)?.score);
        const opp = Number(g.scores?.find((s) => s.name === opponent)?.score);
        if (!Number.isFinite(self) || !Number.isFinite(opp)) return null;
        return {
          date: (g.commence_time || '').split('T')[0],
          opponent,
          result: self > opp ? 'W' : self < opp ? 'L' : 'T',
          score: String(self),
          opponentScore: String(opp),
        };
      })
      .filter(Boolean);

    const home = recentFor(homeTeam);
    const away = recentFor(awayTeam);
    if (home.length === 0 && away.length === 0) return null;

    return {
      sport,
      gameDate,
      supported: true,
      dataSource: 'Recent results (last 3 days)',
      home: { name: homeTeam, id: null, last10: home },
      away: { name: awayTeam, id: null, last10: away },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[generic] odds-scores fallback failed for ${sport}:`, err.message);
    return null;
  }
}

async function getGenericGameResearch(homeTeam, awayTeam, sport, gameDate) {
  // Sport keys are Odds API keys ("soccer_epl") — ESPN needs its own path
  // ("soccer/eng.1"). An unmapped key means ESPN has no coverage: fall back
  // to the Odds API's own scores feed before degrading.
  const espnPath = SPORT_PATHS[sport] || (String(sport).includes('/') ? sport : null);
  if (!espnPath) {
    const oddsForm = await getOddsApiRecentForm(homeTeam, awayTeam, sport, gameDate);
    if (oddsForm) return oddsForm;
    return degradedResearch(
      homeTeam, awayTeam, sport, gameDate,
      'Recent-form data is not available for this league.'
    );
  }

  const ESPN_BASE = `${ESPN_SITE_BASE}/${espnPath}`;

  async function safeFetch(url) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data;
    } catch (err) {
      console.error(`[generic] fetch failed: ${url}`, err.message);
      return null;
    }
  }

  async function resolveTeamId(teamName) {
    const normalized = teamName.toLowerCase().trim();
    const teamsData = await safeFetch(`${ESPN_BASE}/teams`);
    if (!teamsData || !Array.isArray(teamsData.sports?.[0]?.leagues?.[0]?.teams)) {
      return null;
    }
    const teams = teamsData.sports[0].leagues[0].teams;
    for (const entry of teams) {
      const t = entry.team;
      const candidates = [
        t.id,
        t.name?.toLowerCase(),
        t.abbreviation?.toLowerCase(),
        t.displayName?.toLowerCase(),
        t.shortDisplayName?.toLowerCase(),
        t.nickname?.toLowerCase(),
        t.location?.toLowerCase(),
      ];
      if (candidates.includes(normalized)) return String(t.id);
    }
    return null;
  }

  async function getLast10(teamId) {
    const schedule = await safeFetch(`${ESPN_BASE}/teams/${teamId}/schedule`);
    const events = schedule?.events || [];
    const completed = events
      .filter((e) => e.competitions?.[0]?.status?.type?.completed)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10);

    return completed.map((e) => {
      const comp = e.competitions[0];
      const opponent = comp.competitors.find((c) => String(c.team?.id) !== String(teamId));
      const self = comp.competitors.find((c) => String(c.team?.id) === String(teamId));
      return {
        date: e.date.split('T')[0],
        opponent: opponent?.team?.displayName || 'Unknown',
        result: self?.winner === true ? 'W' : self?.winner === false ? 'L' : 'T',
        score: self?.score?.displayValue || null,
        opponentScore: opponent?.score?.displayValue || null,
      };
    });
  }

  const [homeId, awayId] = await Promise.all([
    resolveTeamId(homeTeam),
    resolveTeamId(awayTeam),
  ]);

  if (!homeId || !awayId) {
    const oddsForm = await getOddsApiRecentForm(homeTeam, awayTeam, sport, gameDate);
    if (oddsForm) return oddsForm;
    return degradedResearch(
      homeTeam, awayTeam, sport, gameDate,
      'Could not match these teams to a recent-form source.'
    );
  }

  const [homeGames, awayGames] = await Promise.all([
    getLast10(homeId),
    getLast10(awayId),
  ]);

  return {
    sport,
    gameDate,
    home: { name: homeTeam, id: homeId, last10: homeGames },
    away: { name: awayTeam, id: awayId, last10: awayGames },
    generatedAt: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────────
// Main Router
// ────────────────────────────────────────────────────────────────

/**
 * Fetch game research for a matchup.
 * @param {string} homeTeam
 * @param {string} awayTeam
 * @param {string} sport       — e.g. 'baseball_mlb', 'basketball_nba', 'icehockey_nhl'
 * @param {string} gameDate    — YYYY-MM-DD
 * @returns {Promise<object>}
 */
export async function getGameResearch(homeTeam, awayTeam, sport, gameDate) {
  const key = (sport || '').toLowerCase().trim();

  if (key === 'baseball_mlb') {
    return getBaseballResearch(homeTeam, awayTeam, gameDate);
  }

  if (key === 'basketball_nba' || key === 'basketball_wnba') {
    return getBasketballGameResearch(homeTeam, awayTeam, gameDate, key);
  }

  if (key === 'icehockey_nhl') {
    return getHockeyGameResearch(homeTeam, awayTeam, gameDate);
  }

  if (key === 'mma_mixed_martial_arts') {
    try {
      const tape = await getMmaGameResearch(homeTeam, awayTeam, gameDate);
      if (tape) return tape;
    } catch (err) {
      console.warn('[MMA Research] failed, falling back:', err.message);
    }
    // Bout not on an ESPN card — fall through to the generic fallback chain.
  }

  if (key === 'baseball_kbo') {
    let form = null;
    try {
      form = await getKboRecentForm(homeTeam, awayTeam, gameDate);
    } catch (err) {
      console.warn('[KBO Research] recent form failed:', err.message);
    }
    if (!form) form = await getGenericGameResearch(homeTeam, awayTeam, sport, gameDate);
    try {
      const probables = await getKboProbables(homeTeam, awayTeam);
      if (probables) {
        if (form.home && probables.home) form.home.probablePitcher = probables.home;
        if (form.away && probables.away) form.away.probablePitcher = probables.away;
        form.probablesSource = probables.source;
      }
    } catch (err) {
      console.warn('[KBO Research] probables failed:', err.message);
    }
    return form;
  }

  return getGenericGameResearch(homeTeam, awayTeam, sport, gameDate);
}

// Vercel serverless handler
export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  try {
    const {
      homeTeam,
      awayTeam,
      sport = 'basketball_nba',
      commenceTime,
    } = req.query || {};

    if (!homeTeam || !awayTeam) {
      return res.status(400).json({ error: 'Missing homeTeam or awayTeam query parameter.' });
    }

    // The generic fallback interpolates `sport` into an ESPN URL path —
    // restrict it to a sane sport-key shape so callers can't smuggle in
    // extra path segments or query strings.
    if (!/^[a-z0-9_]+(\/[a-z0-9.-]+)?$/i.test(String(sport))) {
      return res.status(400).json({ error: 'Invalid sport parameter.' });
    }

    const gameDate = commenceTime
      ? new Date(commenceTime).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    const data = await getGameResearch(homeTeam, awayTeam, sport, gameDate);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Game research API error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch game research' });
  }
}
