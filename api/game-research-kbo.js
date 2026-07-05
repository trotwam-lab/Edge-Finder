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
const CACHE_TTL_MS = 10 * 60 * 1000;
let _pageCache = null; // { ts, text }

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

async function fetchPageText() {
  if (_pageCache && Date.now() - _pageCache.ts < CACHE_TTL_MS) return _pageCache.text;
  const res = await fetch(MYKBO_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EdgeFinderResearch/1.0)', Accept: 'text/html' },
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
