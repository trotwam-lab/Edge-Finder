// api/live-status.js — ESPN scoreboard proxy for accurate live game status.
//
// The odds feed only tells us a game's scheduled start time, so the app could
// not tell "about to start" from "in the 7th" from "finished an hour ago". ESPN's
// public scoreboard carries real status (state, period, clock, inning detail),
// live scores, probable pitchers (MLB), and marquee headlines. We normalize all
// of that here so the client can render an honest LIVE / FINAL / start-time badge
// and surface a "Game of the Day" ticker.

import { ESPN_SITE_BASE, SPORT_PATHS } from './_espn-paths.js';
import { guardRequest } from './_http.js';

const TTL = 20 * 1000; // 20s — live status needs to stay fresh during games
const ERROR_TTL = 5 * 60 * 1000; // 5min — don't re-hammer a path ESPN is rejecting
const cache = new Map();
// Same payload for every caller; a short CDN window collapses simultaneous polls.
const PUBLIC_CACHE = 'public, s-maxage=10, stale-while-revalidate=20';

// Marquee detection — ordered by importance, first match wins.
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
];

function detectMarquee(event, competition) {
  const notes = (competition?.notes || []).map(n => n?.headline || n?.text || '').join(' ');
  const seasonName = event?.season?.type === 3 ? 'postseason playoff' : (event?.season?.slug || '');
  const hay = [event?.name, event?.shortName, notes, seasonName].filter(Boolean).join(' ');
  let best = null;
  for (const rule of MARQUEE_RULES) {
    if (rule.re.test(hay)) { best = { label: rule.label, weight: rule.weight }; break; }
  }
  // Postseason games without an explicit headline still deserve a flag.
  if (!best && event?.season?.type === 3) best = { label: 'PLAYOFFS', weight: 70 };
  if (!best) return null;
  return { ...best, isFeatured: best.weight >= 70, headline: notes || event?.name || null };
}

function playerHeadshot(athlete, sportPath) {
  if (athlete?.headshot?.href) return athlete.headshot.href;
  const sport = sportPath?.split('/')?.[1];
  return athlete?.id && sport
    ? `https://a.espncdn.com/i/headshots/${sport}/players/full/${athlete.id}.png`
    : null;
}

// MLB probable pitchers (the "Roto"-style confirmed starters).
function extractProbables(competition, sportPath) {
  const probables = competition?.probables;
  if (!Array.isArray(probables) || probables.length === 0) return null;
  const out = {};
  probables.forEach((p) => {
    const side = p?.homeAway;
    if (side !== 'home' && side !== 'away') return;
    const athlete = p?.athlete || p?.playerStats?.athlete || null;
    const statLine = (p?.statistics || [])
      .map(s => (s?.displayValue != null && s?.abbreviation ? `${s.displayValue} ${s.abbreviation}` : null))
      .filter(Boolean)
      .slice(0, 3)
      .join(' · ');
    out[side] = {
      name: athlete?.displayName || athlete?.fullName || p?.name || null,
      id: athlete?.id || p?.playerId || null,
      headshot: playerHeadshot(athlete, sportPath),
      summary: p?.statistics ? statLine : (p?.note || null),
      confirmed: true,
    };
  });
  return Object.keys(out).length ? out : null;
}

function normalizeEvent(event, sportKey, sportPath) {
  const competition = event?.competitions?.[0];
  if (!competition) return null;
  const competitors = competition.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home');
  const away = competitors.find(c => c.homeAway === 'away');
  if (!home?.team || !away?.team) return null;

  const status = competition.status || event.status || {};
  const type = status.type || {};
  const state = type.state || 'pre'; // 'pre' | 'in' | 'post'

  const num = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };

  return {
    espnId: event.id,
    sportKey,
    home_team: home.team.displayName,
    away_team: away.team.displayName,
    homeAbbr: home.team.abbreviation || null,
    awayAbbr: away.team.abbreviation || null,
    commence_time: event.date,
    state,
    completed: type.completed === true || state === 'post',
    detail: type.shortDetail || type.detail || type.description || null,
    period: status.period ?? null,
    clock: status.displayClock || null,
    homeScore: state === 'pre' ? null : num(home.score),
    awayScore: state === 'pre' ? null : num(away.score),
    venue: competition.venue?.fullName || null,
    broadcast: (competition.broadcasts?.[0]?.names || [])[0] || null,
    featured: detectMarquee(event, competition),
    probables: sportKey === 'baseball_mlb' ? extractProbables(competition, sportPath) : null,
  };
}

async function fetchScoreboard(sportPath) {
  const url = `${ESPN_SITE_BASE}/${sportPath}/scoreboard`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  return res.json();
}

const inflight = new Map();
const MAX_BATCH_SPORTS = 16;
const BATCH_CONCURRENCY = 4;
const SPORT_RE = /^[a-z0-9_]{2,64}$/;

// One sport's live-status payload, cached per instance. Concurrent asks for
// the same sport share one ESPN call. Returns { payload, cacheStatus }.
async function getLiveStatus(sport) {
  const sportPath = Object.hasOwn(SPORT_PATHS, sport) ? SPORT_PATHS[sport] : null;
  if (!sportPath) {
    // Not an ESPN-mapped sport — return empty so the client falls back cleanly.
    return { payload: { sport, supported: false, events: [] }, cacheStatus: 'NONE' };
  }

  const cacheKey = `live-${sport}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < (hit.ttl ?? TTL)) {
    return { payload: hit.data, cacheStatus: 'HIT' };
  }
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);

  const pending = (async () => {
    try {
      const data = await fetchScoreboard(sportPath);
      const events = (data?.events || [])
        .map(ev => normalizeEvent(ev, sport, sportPath))
        .filter(Boolean);
      const payload = { sport, supported: true, generatedAt: new Date().toISOString(), events };
      cache.set(cacheKey, { data: payload, ts: Date.now(), ttl: TTL });
      return { payload, cacheStatus: 'MISS' };
    } catch (err) {
      console.error(`live-status error: ${sport} (${sportPath}): ${err.message}`);
      // Transient blip with a previous good payload: keep serving it briefly so
      // live scores don't blank out mid-game.
      if (hit?.data?.events?.length) {
        cache.set(cacheKey, { data: hit.data, ts: Date.now(), ttl: 60 * 1000 });
        return { payload: hit.data, cacheStatus: 'STALE' };
      }
      // No good data (e.g. ESPN rejects this path outright): soft-fail with empty
      // events and cache the failure so the path isn't refetched every 20s.
      const payload = { sport, supported: true, error: err.message, events: [] };
      cache.set(cacheKey, { data: payload, ts: Date.now(), ttl: ERROR_TTL });
      return { payload, cacheStatus: 'ERROR' };
    }
  })().finally(() => inflight.delete(cacheKey));
  inflight.set(cacheKey, pending);
  return pending;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(runners);
  return results;
}

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'live-status' })) return;

  // Batch mode (?sports=a,b,c): one request for a whole slice of the board
  // instead of one function call per sport, with ESPN calls paced inside it.
  if (req.query?.sports != null) {
    const sports = [...new Set(String(req.query.sports).split(',').map(s => s.trim()).filter(Boolean))];
    if (!sports.length || sports.length > MAX_BATCH_SPORTS || !sports.every(s => SPORT_RE.test(s))) {
      return res.status(400).json({ error: `Invalid sports list (1-${MAX_BATCH_SPORTS} sport keys)` });
    }
    const results = await mapWithConcurrency(sports, BATCH_CONCURRENCY, getLiveStatus);
    const body = { sports: {} };
    sports.forEach((sport, i) => { body.sports[sport] = results[i].payload; });
    // Only let the CDN hold a batch when every sport in it is real data.
    if (results.every(r => r.cacheStatus === 'HIT' || r.cacheStatus === 'MISS' || r.cacheStatus === 'NONE')) {
      res.setHeader('Cache-Control', PUBLIC_CACHE);
    }
    return res.status(200).json(body);
  }

  const { sport = 'basketball_nba' } = req.query || {};
  const { payload, cacheStatus } = await getLiveStatus(String(sport));
  if (cacheStatus === 'HIT' || cacheStatus === 'MISS' || cacheStatus === 'STALE') res.setHeader('X-Cache', cacheStatus);
  if (cacheStatus === 'HIT' || cacheStatus === 'MISS') res.setHeader('Cache-Control', PUBLIC_CACHE);
  return res.status(200).json(payload);
}
