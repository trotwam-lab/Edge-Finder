// api/edges.js — Edge Detection API
// Fetches odds from The Odds API, finds +EV edges and arbitrage across bookmakers.
// Uses no-vig consensus probability to calculate true EV (not simplified approximation).
// Caches results for 60 seconds to save API credits while keeping edges fresh.

import { getRequestTier, isProTier } from './_auth.js';
import { getAdminDb } from './_firebaseAdmin.js';
import { probIndexKey, updateReceiptsSnapshot } from './_receipts.js';
import { updateLedgerCloses } from './_ledger.js';
import {
  fetchSportsGameOddsEvents,
  isSportsGameOddsEnabled,
  sgoScannableSports,
  transformSgoEventToOddsApiGame,
} from './_sportsgameodds.js';
import { guardRequest } from './_http.js';
import { ODDS_TTL, loadSportOdds } from './_oddsFeed.js';

const cache = { data: null, ts: 0 };
const TTL = 60 * 1000; // 60 seconds

// The scan discovers what to cover at runtime: The Odds API's /v4/sports
// catalog (quota-free) lists every sport key currently in season, so seasonal
// events — each tennis major is its own key, cups come and go — are picked up
// automatically. Outright-only keys (golf winners, futures) carry no
// h2h/spreads/totals market and are filtered out, as is the Politics group.
// TRACKED_SPORTS is only the fallback if the catalog call itself fails.
const TRACKED_SPORTS = [
    'soccer_fifa_world_cup',
    'basketball_nba',
    'basketball_wnba',
    'basketball_ncaab',
    'basketball_wncaab',
    'americanfootball_nfl',
    'americanfootball_ncaaf',
    'icehockey_nhl',
    'baseball_mlb',
    'mma_mixed_martial_arts',
    'boxing_boxing',
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_france_ligue_one',
    'soccer_uefa_champs_league',
    'soccer_usa_mls',
    'soccer_mexico_ligamx',
    'tennis_atp_wimbledon',
    'tennis_wta_wimbledon',
    'aussierules_afl',
    'rugbyleague_nrl',
  ];

// The catalog only changes when a season starts or ends, so it is reused
// across scans instead of being re-fetched every 60s. A failed lookup is not
// cached, and the last good catalog keeps serving if a later refresh fails.
const CATALOG_TTL = 30 * 60 * 1000;
let catalogCache = { data: null, ts: 0 };

async function getScannableSports(apiKey) {
    if (catalogCache.data && Date.now() - catalogCache.ts < CATALOG_TTL) return catalogCache.data;
    try {
          const res = await fetch(`https://api.the-odds-api.com/v4/sports?apiKey=${apiKey}`, {
                  signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) return catalogCache.data;
          const catalog = await res.json();
          if (!Array.isArray(catalog)) return catalogCache.data;
          const scannable = catalog.filter(s =>
                  s?.active && !s.has_outrights && s.group !== 'Politics'
          );
          if (!scannable.length) return catalogCache.data;
          catalogCache = { data: scannable, ts: Date.now() };
          return scannable;
    } catch {
          return catalogCache.data;
    }
}

// Run `worker` over `items` with at most `limit` in flight, keeping results in
// input order so the scan stays deterministic.
async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
          while (next < items.length) {
                const i = next++;
                results[i] = await worker(items[i], i);
          }
    });
    await Promise.all(runners);
    return results;
}

const SPORT_LABELS = {
    soccer_fifa_world_cup: 'World Cup',
    basketball_nba: 'NBA',
    basketball_wnba: 'WNBA',
    basketball_ncaab: 'NCAAB',
    basketball_wncaab: 'WNCAAB',
    americanfootball_nfl: 'NFL',
    americanfootball_ncaaf: 'NCAAF',
    icehockey_nhl: 'NHL',
    baseball_mlb: 'MLB',
    mma_mixed_martial_arts: 'UFC',
    boxing_boxing: 'Boxing',
    soccer_epl: 'EPL',
    soccer_spain_la_liga: 'La Liga',
    soccer_italy_serie_a: 'Serie A',
    soccer_germany_bundesliga: 'Bundesliga',
    soccer_france_ligue_one: 'Ligue 1',
    soccer_uefa_champs_league: 'UCL',
    soccer_usa_mls: 'MLS',
    soccer_mexico_ligamx: 'Liga MX',
    soccer_uefa_europa_league: 'Europa League',
    tennis_atp_wimbledon: 'ATP Wimbledon',
    tennis_wta_wimbledon: 'WTA Wimbledon',
    tennis_atp_us_open: 'ATP US Open',
    tennis_wta_us_open: 'WTA US Open',
    tennis_atp_french_open: 'ATP French Open',
    tennis_wta_french_open: 'WTA French Open',
    tennis_atp_aus_open_singles: 'ATP Aus Open',
    tennis_wta_aus_open_singles: 'WTA Aus Open',
    aussierules_afl: 'AFL',
    rugbyleague_nrl: 'NRL',
};

const SPORT_EMOJI = {
    'World Cup': '🏆',
    NBA: '🏀', WNBA: '🏀', NCAAB: '🏀', WNCAAB: '🏀',
    NFL: '🏈', NCAAF: '🏈', NHL: '🏒', MLB: '⚾',
    UFC: '🥊', Boxing: '🥊',
    EPL: '⚽', 'La Liga': '⚽', 'Serie A': '⚽', Bundesliga: '⚽',
    'Ligue 1': '⚽', UCL: '⚽', MLS: '⚽', 'Liga MX': '⚽',
    AFL: '🏉', NRL: '🏉',
};

// Catalog-discovered sports fall back to an emoji by their Odds API group.
const GROUP_EMOJI = {
    Soccer: '⚽', Tennis: '🎾', Cricket: '🏏', Basketball: '🏀',
    'American Football': '🏈', 'Ice Hockey': '🏒', Baseball: '⚾',
    Boxing: '🥊', 'Mixed Martial Arts': '🥊',
    'Rugby League': '🏉', 'Rugby Union': '🏉', 'Aussie Rules': '🏉',
    Lacrosse: '🥍', Golf: '⛳',
};

// Minimum EV threshold — below this isn't worth flagging
const MIN_EV_THRESHOLD = 2.0;
// Maximum realistic EV — anything higher is likely stale/erroneous odds
const MAX_EV_THRESHOLD = 15.0;
// Minimum books required to calculate consensus (2 is enough for spreads/totals)
const MIN_BOOKS = 2;
const FREE_EDGE_PREVIEW_LIMIT = 3;
const SGO_EDGE_EVENT_LIMIT = 20;
const EDGE_LOOKAHEAD_DAYS = Number(process.env.EDGE_LOOKAHEAD_DAYS || 14);

function buildFreeEdgesPreview(edges = []) {
  return edges.slice(0, FREE_EDGE_PREVIEW_LIMIT).map(edge => ({
    sport: edge.sport,
    emoji: edge.emoji,
    game: edge.game,
    commenceTime: edge.commenceTime,
    confidence: edge.confidence,
    evDisplay: edge.evDisplay,
    preview: true,
    message: 'Upgrade to Pro to unlock the exact book, line, fair probability, and full edge board.',
  }));
}

function isNearTermPregame(commenceTime) {
  const start = Date.parse(commenceTime);
  if (!Number.isFinite(start) || start <= Date.now()) return false;
  return start - Date.now() <= EDGE_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
}

// ============================================================
// Math helpers
// ============================================================

function americanToDecimal(american) {
    if (american > 0) return american / 100 + 1;
    return 100 / Math.abs(american) + 1;
}

function impliedProbability(american) {
    if (american > 0) return 100 / (american + 100);
    return Math.abs(american) / (Math.abs(american) + 100);
}

// Remove the bookmaker's vig from a set of probabilities
// so they sum to exactly 1.0 (fair/true probabilities)
function removeVig(probs) {
    const total = probs.reduce((sum, p) => sum + p, 0);
    if (total <= 0) return probs;
    return probs.map(p => p / total);
}

// EV% = (decimalOdds × fairProbability - 1) × 100
// Positive = profitable bet over the long run
function calculateEV(decimalOdds, fairProbability) {
    return (decimalOdds * fairProbability - 1) * 100;
}

// ============================================================
// Consensus fair probability calculation
// Averages the no-vig implied probability across all books
// for a specific outcome key, then returns the consensus map.
// ============================================================
function getConsensusProbabilities(bookmakers, marketKey) {
    const probSums = new Map();
    const probCounts = new Map();

  for (const book of bookmakers) {
        const market = book.markets.find(m => m.key === marketKey);
        if (!market || market.outcomes.length < 2) continue;

      // Remove vig from this book's market
      const rawProbs = market.outcomes.map(o => impliedProbability(o.price));
        const fairProbs = removeVig(rawProbs);

      market.outcomes.forEach((outcome, i) => {
              // Key includes point so Over 220.5 and Over 221 are separate outcomes
                                    const key = outcome.point !== undefined
                ? `${outcome.name}|${outcome.point}`
                                              : outcome.name;
              probSums.set(key, (probSums.get(key) || 0) + fairProbs[i]);
              probCounts.set(key, (probCounts.get(key) || 0) + 1);
      });
  }

  if (probSums.size === 0) return null;

  // Average across books
  const consensus = new Map();
    for (const [key, sum] of probSums) {
          consensus.set(key, sum / probCounts.get(key));
    }
    return consensus;
}

// ============================================================
// Edge detection for a single game
// ============================================================
// `probIndex` (optional Map) collects the consensus fair probability and best
// price for EVERY priced outcome — not just +EV ones — so the receipts
// tracker can keep observing an edge's closing line after its EV fades.
// `sport` is a catalog entry: { key, title, group } — title/group let
// discovered sports label themselves without a hardcoded map entry.
function findEdges(game, sport, probIndex = null) {
    const edges = [];
    const sportName = SPORT_LABELS[sport.key] || sport.title || sport.key.toUpperCase();
    const emoji = SPORT_EMOJI[sportName] || GROUP_EMOJI[sport.group] || '🎯';
    const home = game.home_team;
    const away = game.away_team;
    const gameName = `${away} @ ${home}`;

  for (const marketKey of ['h2h', 'spreads', 'totals']) {
        // Need at least MIN_BOOKS covering this market
      const booksWithMarket = game.bookmakers.filter(b =>
              b.markets.some(m => m.key === marketKey)
                                                         );
        if (booksWithMarket.length < MIN_BOOKS) continue;

      const consensusProbs = getConsensusProbabilities(booksWithMarket, marketKey);
        if (!consensusProbs) continue;

      // Check each book's odds against the consensus fair probability
      for (const bookmaker of booksWithMarket) {
              const market = bookmaker.markets.find(m => m.key === marketKey);
              if (!market) continue;

          for (const outcome of market.outcomes) {
                    const key = outcome.point !== undefined
                      ? `${outcome.name}|${outcome.point}`
                                : outcome.name;
                    const fairProb = consensusProbs.get(key);
                    if (!fairProb) continue;

                if (probIndex) {
                        const pKey = probIndexKey(game.id, marketKey, outcome.name, outcome.point ?? null);
                        const existing = probIndex.get(pKey);
                        if (!existing) {
                            probIndex.set(pKey, { fairProb, bestPrice: outcome.price, commenceTime: game.commence_time });
                        } else if (outcome.price > existing.bestPrice) {
                            existing.bestPrice = outcome.price;
                        }
                }

                const decimal = americanToDecimal(outcome.price);
                    const ev = calculateEV(decimal, fairProb);

                if (ev >= MIN_EV_THRESHOLD && ev <= MAX_EV_THRESHOLD) {
                            let edgeDesc = '';
                            if (marketKey === 'h2h') {
                                          edgeDesc = `Moneyline: ${outcome.name} @ ${outcome.price > 0 ? '+' : ''}${outcome.price}`;
                            } else if (marketKey === 'spreads') {
                                          edgeDesc = `Spread: ${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point} @ ${outcome.price > 0 ? '+' : ''}${outcome.price}`;
                            } else if (marketKey === 'totals') {
                                          edgeDesc = `Total: ${outcome.name} ${outcome.point} @ ${outcome.price > 0 ? '+' : ''}${outcome.price}`;
                            }

                      const confidence = ev >= 5 ? 'HIGH' : ev >= 3 ? 'MEDIUM' : 'LOW';

                      edges.push({
                                    sport: sportName,
                                    emoji,
                                    game: gameName,
                                    gameId: game.id,
                                    sportKey: sport.key,
                                    homeTeam: home,
                                    awayTeam: away,
                                    commenceTime: game.commence_time,
                                    edge: edgeDesc,
                                    ev: parseFloat(ev.toFixed(1)),
                                    evDisplay: `+${ev.toFixed(1)}%`,
                                    book: bookmaker.title,
                                    bookKey: bookmaker.key,
                                    market: marketKey,
                                    outcomeName: outcome.name,
                                    outcomePoint: outcome.point ?? null,
                                    price: outcome.price,
                                    confidence,
                                    fairProbability: parseFloat((fairProb * 100).toFixed(1)),
                                    timestamp: new Date().toISOString(),
                      });
                }
          }
      }
  }

  return edges.sort((a, b) => b.ev - a.ev);
}

// ============================================================
// Handler
// ============================================================
export default async function handler(req, res) {
  if (guardRequest(req, res, { route: 'edges', rateLimit: 60 })) return;
  const tierInfo = await getRequestTier(req);
  const isPro = isProTier(tierInfo);

    // Return cached data if still fresh
  if (cache.data && Date.now() - cache.ts < TTL) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-EdgeFinder-Tier', isPro ? 'pro' : 'free');
        return res.status(200).json(isPro ? cache.data : buildFreeEdgesPreview(cache.data));
  }

  const apiKey = process.env.ODDS_API_KEY;
  const useSportsGameOdds = isSportsGameOddsEnabled();
    if (!apiKey && !useSportsGameOdds) return res.status(500).json({ error: 'ODDS_API_KEY not configured' });

  try {
        const allEdges = [];
        const probIndex = new Map();

      if (useSportsGameOdds) {
        for (const sport of sgoScannableSports()) {
          try {
            const result = await fetchSportsGameOddsEvents({
              leagueID: sport.title,
              includeAltLines: true,
              limit: SGO_EDGE_EVENT_LIMIT,
            });
            if (!result.ok) {
              console.warn(`SportsGameOdds edge scan failed for ${sport.title}: ${result.status}`);
              continue;
            }

            for (const event of result.data) {
              const game = transformSgoEventToOddsApiGame(event);
              if (!isNearTermPregame(game.commence_time)) continue;
              const edges = findEdges(game, sport, probIndex);
              allEdges.push(...edges);
            }
          } catch (e) {
            console.warn(`SportsGameOdds edge scan failed for ${sport.title}:`, e.message);
          }
        }
      } else {
      // Scan every in-season game-market sport; fall back to the static
      // list only if the catalog call fails.
      const sportsToScan = (await getScannableSports(apiKey))
        || TRACKED_SPORTS.map(key => ({ key, title: SPORT_LABELS[key] || key, group: '' }));

      // Odds come through the same shared cache the board uses, fetched a few
      // sports at a time: the old one-by-one loop made the scan as slow as the
      // sum of every upstream call, and each instance re-paid for data the
      // board had already pulled. 30s matches the board's freshness, which
      // keeps closing-line observations as current as before.
      const SCAN_CONCURRENCY = 4;
      const scanned = await mapWithConcurrency(sportsToScan, SCAN_CONCURRENCY, async (sport) => {
              try {
                        const result = await loadSportOdds(sport.key, { maxAgeMs: ODDS_TTL });
                        if (!result.ok) {
                                    console.warn(`Odds API error for ${sport.key}: ${result.status}`);
                                    return [];
                        }
                        return Array.isArray(result.data) ? result.data : [];
              } catch (e) {
                        console.warn(`Edge scan failed for ${sport.key}:`, e.message);
                        return [];
              }
      });

      sportsToScan.forEach((sport, i) => {
              try {
                        for (const game of scanned[i]) {
                                    // Pregame only. In-play lines move faster than the 60s scan
                                    // refreshes, so a stale book mid-game reads as a big edge
                                    // that is already gone. Skipping live games here also keeps
                                    // live numbers out of the receipts probIndex, so a stored
                                    // edge's "closing line" is always the last PREGAME price.
                                    if (!isNearTermPregame(game.commence_time)) continue;
                                    const edges = findEdges(game, sport, probIndex);
                                    allEdges.push(...edges);
                        }
              } catch (e) {
                        console.warn(`Edge scan failed for ${sport.key}:`, e.message);
              }
      });
      }

      // Sort all edges by EV descending
      allEdges.sort((a, b) => b.ev - a.ev);

      // Record today's edges + refresh closing lines for the public track
      // record ("Yesterday's Receipts") and for verified bets (the same
      // no-vig consensus becomes their closing line). The two touch different
      // collections, so they run together. Bookkeeping only — never allowed
      // to break the edge feed itself.
      const db = getAdminDb();
      await Promise.all([
        updateReceiptsSnapshot(db, allEdges, probIndex).catch(e => {
          console.warn('Receipts snapshot failed:', e.message);
        }),
        updateLedgerCloses(db, probIndex).catch(e => {
          console.warn('Ledger close update failed:', e.message);
        }),
      ]);

      cache.data = allEdges;
        cache.ts = Date.now();

      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-EdgeFinder-Tier', isPro ? 'pro' : 'free');
        return res.status(200).json(isPro ? allEdges : buildFreeEdgesPreview(allEdges));
  } catch (e) {
        return res.status(500).json({ error: e.message });
  }
}
