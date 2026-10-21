// api/props.js — Player Props Endpoint
// Markets are sport-aware — basketball markets for NBA, football for NFL, etc.

import { getRequestTier, isProTier } from './_auth.js';
import {
  fetchSportsGameOddsEvents,
  isSportsGameOddsEnabled,
  leagueIdForOddsSport,
  transformSgoEventToProps,
} from './_sportsgameodds.js';
import { guardRequest } from './_http.js';
import { freshestEntry, isFresh, writeSharedCache } from './_sharedCache.js';

const cache = {};
const TTL = 5 * 60 * 1000;         // props move slower than core game lines
const EMPTY_TTL = 10 * 60 * 1000;  // 10 minutes when a sport has no events (off-season)
const BACKOFF_MS = 5 * 60 * 1000;  // pause upstream calls after a 429 (quota exhausted)
let quotaBackoffUntil = 0;
const FREE_BOOKS = new Set(['fanduel', 'draftkings', 'betmgm']);
const FREE_PLAYER_LIMIT = 3;
// One US region covers the books displayed by the app and halves the
// per-market cost of the Odds API fallback.
const ODDS_REGIONS = 'us';
const DEFAULT_EVENT_LIMIT = 20;
const MAX_EVENT_LIMIT = 24;
const SGO_DEFAULT_PROP_LIMIT = 1200;
const SGO_MAX_PROP_LIMIT = 2500;

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

function clampInt(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

const DAILY_SLATE_SPORTS = new Set([
  'basketball_nba',
  'basketball_wnba',
  'basketball_ncaab',
  'basketball_wncaab',
  'icehockey_nhl',
  'baseball_mlb',
]);
const DAILY_SLATE_WINDOW_MS = 18 * 60 * 60 * 1000;

function selectPropEvents(events, sport, limit) {
  const chronological = [...events].sort((a, b) => {
    const aTime = Date.parse(a.commence_time);
    const bTime = Date.parse(b.commence_time);
    if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return 0;
    return aTime - bTime;
  });

  if (!DAILY_SLATE_SPORTS.has(sport) || chronological.length === 0) {
    return chronological.slice(0, limit);
  }

  const firstStart = Date.parse(chronological[0].commence_time);
  if (!Number.isFinite(firstStart)) return chronological.slice(0, limit);
  return chronological
    .filter(event => Date.parse(event.commence_time) <= firstStart + DAILY_SLATE_WINDOW_MS)
    .slice(0, limit);
}

export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'props', rateLimit: 120 })) return;

  const { sport = 'basketball_nba' } = req.query;
  if (!/^[a-z0-9_]{2,64}$/.test(String(sport))) return res.status(400).json({ error: 'Invalid sport' });
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);
  const API_KEY = process.env.ODDS_API_KEY;
  const useSportsGameOdds = isSportsGameOddsEnabled() && leagueIdForOddsSport(sport);

  if (!API_KEY && !useSportsGameOdds) return res.status(500).json({ error: 'API key not configured' });

  const eventLimit = clampInt(req.query.limit, DEFAULT_EVENT_LIMIT, MAX_EVENT_LIMIT);
  const propLimit = useSportsGameOdds
    ? clampInt(req.query.maxProps, SGO_DEFAULT_PROP_LIMIT, SGO_MAX_PROP_LIMIT)
    : null;
  const cacheKey = `props-v2-${useSportsGameOdds ? `sgo-${eventLimit}-${propLimit}` : `oddsapi-${eventLimit}`}-${sport}`;
  let cached = cache[cacheKey];
  if (!isFresh(cached, TTL)) cached = await freshestEntry(cache, cacheKey);
  if (isFresh(cached, TTL)) {
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
    if (useSportsGameOdds) {
      const result = await fetchSportsGameOddsEvents({
        leagueID: leagueIdForOddsSport(sport),
        includeAltLines: true,
        limit: eventLimit,
      });
      if (!result.ok) {
        console.warn(`SportsGameOdds props fetch failed for ${sport}: ${result.status}`);
        return serveDegraded(`sportsgameodds-${result.status}`);
      }

      const allProps = result.data.flatMap(transformSgoEventToProps).slice(0, propLimit);
      const ttl = allProps.length === 0 ? EMPTY_TTL : TTL;
      cache[cacheKey] = { data: allProps, ts: Date.now(), ttl };
      await writeSharedCache(cacheKey, cache[cacheKey]);
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-EdgeFinder-Upstream', 'sportsgameodds');
      res.setHeader('X-EdgeFinder-Events-Scanned', String(result.data.length));
      res.setHeader('X-EdgeFinder-Props-Total', String(allProps.length));
      setTierHeaders(res, tierInfo);
      return res.json(isPro ? allProps : buildFreePropsPreview(allProps));
    }

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
      await writeSharedCache(cacheKey, cache[cacheKey]);
      setTierHeaders(res, tierInfo);
      return res.json([]);
    }

    const allProps = [];
    let quotaHit = false;

    // Step 2: fetch the complete current slate. Daily leagues are bounded to
    // the earliest game's 18-hour window so future dates do not burn prop
    // quota, while the event limit still protects serverless execution.
    const PROP_BATCH_SIZE = 4;
    const upcoming = selectPropEvents(events, sport, eventLimit);
    const fetchEventProps = async (event) => {
      const eventProps = [];
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
          }
          return eventProps;
        }
        const oddsData = await oddsRes.json();
        if (!oddsData.bookmakers?.length) return eventProps;

        oddsData.bookmakers.forEach(bookmaker => {
          markets.forEach(marketKey => {
            const market = bookmaker.markets?.find(m => m.key === marketKey);
            if (!market?.outcomes) return;
            market.outcomes.forEach(outcome => {
              if (!outcome.description) return;
              eventProps.push({
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
      return eventProps;
    };

    for (let i = 0; i < upcoming.length && !quotaHit; i += PROP_BATCH_SIZE) {
      const batch = await Promise.all(upcoming.slice(i, i + PROP_BATCH_SIZE).map(fetchEventProps));
      batch.forEach(eventProps => allProps.push(...eventProps));
    }

    // Quota died before any props landed: keep the previous board alive
    // rather than caching an empty one over it.
    if (quotaHit && allProps.length === 0) {
      return serveDegraded('quota-backoff');
    }

    cache[cacheKey] = { data: allProps, ts: Date.now(), ttl: TTL };
    await writeSharedCache(cacheKey, cache[cacheKey]);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-EdgeFinder-Events-Available', String(events.length));
    res.setHeader('X-EdgeFinder-Events-Scanned', String(upcoming.length));
    res.setHeader('X-EdgeFinder-Props-Total', String(allProps.length));
    setTierHeaders(res, tierInfo);
    return res.json(isPro ? allProps : buildFreePropsPreview(allProps));
  } catch (err) {
    // Network failure/timeout — same degraded path as an upstream error code.
    console.error('Props API error:', err);
    return serveDegraded('upstream-unreachable');
  }
}
