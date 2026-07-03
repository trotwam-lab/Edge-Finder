// api/live-status.js — ESPN scoreboard proxy for accurate live game status.
//
// The odds feed only tells us a game's scheduled start time, so the app could
// not tell "about to start" from "in the 7th" from "finished an hour ago". ESPN's
// public scoreboard carries real status (state, period, clock, inning detail),
// live scores, probable pitchers (MLB), and marquee headlines. We normalize all
// of that here so the client can render an honest LIVE / FINAL / start-time badge
// and surface a "Game of the Day" ticker.

const ESPN_SITE_BASE = 'https://site.api.espn.com/apis/site/v2/sports';
const TTL = 20 * 1000; // 20s — live status needs to stay fresh during games
const cache = new Map();

// our odds-API sport key -> ESPN scoreboard path
const SPORT_PATHS = {
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

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

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

export default async function handler(req, res) {
  sendCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sport = 'basketball_nba' } = req.query || {};
  const sportPath = SPORT_PATHS[sport];
  if (!sportPath) {
    // Not an ESPN-mapped sport — return empty so the client falls back cleanly.
    return res.status(200).json({ sport, supported: false, events: [] });
  }

  const cacheKey = `live-${sport}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(hit.data);
  }

  try {
    const data = await fetchScoreboard(sportPath);
    const events = (data?.events || [])
      .map(ev => normalizeEvent(ev, sport, sportPath))
      .filter(Boolean);
    const payload = { sport, supported: true, generatedAt: new Date().toISOString(), events };
    cache.set(cacheKey, { data: payload, ts: Date.now() });
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('live-status error:', err.message);
    // Soft-fail: empty events keep the UI on its time-based fallback.
    return res.status(200).json({ sport, supported: true, error: err.message, events: [] });
  }
}
