// api/props.js — Player Props Endpoint
// Markets are sport-aware — basketball markets for NBA, football for NFL, etc.

import { getRequestTier, isProTier } from './_auth.js';

const cache = {};
const TTL = 60 * 1000;             // 1 minute for live prop boards
const EMPTY_TTL = 10 * 60 * 1000;  // 10 minutes when a sport has no events (off-season)
const BACKOFF_MS = 5 * 60 * 1000;  // pause upstream calls after a 429 (quota exhausted)
let quotaBackoffUntil = 0;
const FREE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm']);
const FREE_PLAYER_LIMIT = 3;
const ODDS_REGIONS = 'us,us2';

// Sport-specific prop markets supported by the Odds API
const MARKETS_BY_SPORT = {
  basketball_nba:    ['player_points','player_rebounds','player_assists','player_threes','player_steals','player_blocks'],
  basketball_wnba:   ['player_points','player_rebounds','player_assists','player_threes'],
  basketball_ncaab:  ['player_points','player_rebounds','player_assists','player_threes'],
  basketball_wncaab: ['player_points','player_rebounds','player_assists'],
  americanfootball_nfl:  ['player_pass_yds','player_rush_yds','player_reception_yds','player_anytime_td','player_pass_tds','player_pass_completions','player_receptions'],
  americanfootball_ncaaf: ['player_pass_yds','player_rush_yds','player_reception_yds','player_anytime_td'],
  icehockey_nhl: ['player_points','player_shots_on_goal','player_blocked_shots','player_assists','player_goals'],
  baseball_mlb: ['batter_hits','batter_total_bases','batter_rbis','batter_runs_scored','batter_home_runs','pitcher_strikeouts','pitcher_hits_allowed'],
  soccer_epl: ['player_shots_on_target','player_to_score'],
};

const DEFAULT_MARKETS = ['player_points','player_rebounds','player_assists'];

function getMarkets(sport) {
  return MARKETS_BY_SPORT[sport] || DEFAULT_MARKETS;
}

function buildFreePropsPreview(props = []) {
  return propsPreviewForBooks(props, FREE_BOOKS) || propsPreviewForBooks(props);
}

function propsPreviewForBooks(props = [], allowedBooks = null) {
  const visiblePlayers = new Set();
  const preview = [];
  for (const prop of props) {
    if (allowedBooks && !allowedBooks.has(prop.bookKey)) continue;
    if (!visiblePlayers.has(prop.player)) {
      if (visiblePlayers.size >= FREE_PLAYER_LIMIT) continue;
      visiblePlayers.add(prop.player);
    }
    preview.push(prop);
  }

  return preview.length ? preview : null;
}

function setTierHeaders(res, tierInfo) {
  res.setHeader('X-EdgeFinder-Tier', isProTier(tierInfo) ? 'pro' : 'free');
  res.setHeader('X-EdgeFinder-Tier-Source', tierInfo?.source || 'unknown');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sport = 'basketball_nba' } = req.query;
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const API_KEY = process.env.ODDS_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const cacheKey = `props-oddsapi-${sport}`;
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < (cached.ttl ?? TTL)) {
    res.setHeader('X-Cache', 'HIT');
    setTierHeaders(res, tierInfo);
    return res.json(isPro ? cached.data : buildFreePropsPreview(cached.data));
  }

  // Serve the last good board instead of an error when the upstream is
  // unavailable — slightly old props beat an empty tab.
  const serveDegraded = (reason) => {
    setTierHeaders(res, tierInfo);
    res.setHeader('X-EdgeFinder-Degraded', reason);
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.json(isPro ? cached.data : buildFreePropsPreview(cached.data));
    }
    return res.json([]);
  };

  // The Odds API quota is shared across every route; once it 429s, more calls
  // only burn the budget further. Sit out the backoff window on cache/stale.
  if (Date.now() < quotaBackoffUntil) {
    return serveDegraded('quota-backoff');
  }

  try {
    const markets = getMarkets(sport);

    // Step 1: Get upcoming events for this sport
    const eventsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${API_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!eventsRes.ok) {
      if (eventsRes.status === 429) quotaBackoffUntil = Date.now() + BACKOFF_MS;
      console.error(`Props events fetch failed for ${sport}: ${eventsRes.status}`);
      return serveDegraded(`upstream-${eventsRes.status}`);
    }
    const events = await eventsRes.json();
    if (!events || events.length === 0) {
      // Off-season/idle sports get a long TTL so they stop draining quota.
      cache[cacheKey] = { data: [], ts: Date.now(), ttl: EMPTY_TTL };
      setTierHeaders(res, tierInfo);
      return res.json([]);
    }

    const allProps = [];
    let quotaHit = false;

    // Step 2: Fetch props for up to 8 upcoming events
    for (const event of events.slice(0, 8)) {
      try {
        const oddsRes = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${API_KEY}&regions=${ODDS_REGIONS}&markets=${markets.join(',')}&oddsFormat=american`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!oddsRes.ok) {
          console.warn(`Props failed for ${event.id}: ${oddsRes.status}`);
          if (oddsRes.status === 429) {
            // Quota is gone — every remaining event would 429 too.
            quotaBackoffUntil = Date.now() + BACKOFF_MS;
            quotaHit = true;
            break;
          }
          continue;
        }
        const oddsData = await oddsRes.json();
        if (!oddsData.bookmakers?.length) continue;

        oddsData.bookmakers.forEach(bookmaker => {
          markets.forEach(marketKey => {
            const market = bookmaker.markets?.find(m => m.key === marketKey);
            if (!market?.outcomes) return;
            market.outcomes.forEach(outcome => {
              if (!outcome.description) return;
              allProps.push({
                id: `${event.id}-${bookmaker.key}-${marketKey}-${outcome.description}-${outcome.name}-${outcome.point}`,
                player:     outcome.description,
                market:     marketKey,
                line:       outcome.point,
                outcome:    outcome.name,
                price:      outcome.price,
                bookKey:    bookmaker.key,
                bookTitle:  bookmaker.title,
                book:       bookmaker.title,
                game:       `${event.away_team} @ ${event.home_team}`,
                gameId:     event.id,
                sport,
                commence_time: event.commence_time,
              });
            });
          });
        });
      } catch (err) {
        console.warn(`Error fetching props for ${event.id}:`, err.message);
      }
    }

    // Quota died before any props landed: keep the previous board alive
    // rather than caching an empty one over it.
    if (quotaHit && allProps.length === 0) {
      return serveDegraded('quota-backoff');
    }

    cache[cacheKey] = { data: allProps, ts: Date.now(), ttl: TTL };
    res.setHeader('X-Cache', 'MISS');
    setTierHeaders(res, tierInfo);
    return res.json(isPro ? allProps : buildFreePropsPreview(allProps));
  } catch (err) {
    // Network failure/timeout — same degraded path as an upstream error code.
    console.error('Props API error:', err);
    return serveDegraded('upstream-unreachable');
  }
}
