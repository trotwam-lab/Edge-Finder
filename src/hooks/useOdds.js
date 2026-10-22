import { useState, useEffect, useCallback, useRef } from 'react';
import { SPORTS, BOOKMAKERS, SPORT_ESPN_MAP } from '../constants.js';
import { auth } from '../firebase.js';
import { isGameLive } from '../utils/live-status.js';
import { appendPropHistory } from '../utils/props.js';
import { SNAPSHOT_VERSION, decodeBoard, encodeBoard } from '../utils/board-snapshot.js';

// ============================================================
// Persistent state — survives page refreshes via localStorage
// ============================================================
function usePersistentState(key, defaultValue) {
    const [state, setState] = useState(() => {
          try {
                  const saved = localStorage.getItem(key);
                  return saved ? JSON.parse(saved) : defaultValue;
          } catch {
                  return defaultValue;
          }
    });

  useEffect(() => {
        try {
                localStorage.setItem(key, JSON.stringify(state));
        } catch {}
  }, [key, state]);

  return [state, setState];
}

export { usePersistentState };

function normalizeName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function scoreMatchesGame(score, game) {
  if (!score || !game) return false;
  if (score.id && game.id && score.id === game.id) return true;

  const scoreHome = normalizeName(score.home_team);
  const scoreAway = normalizeName(score.away_team);
  const gameHome = normalizeName(game.home_team);
  const gameAway = normalizeName(game.away_team);
  if (!scoreHome || !scoreAway || !gameHome || !gameAway) return false;

  const sameTeams = scoreHome === gameHome && scoreAway === gameAway;
  const reversedTeams = scoreHome === gameAway && scoreAway === gameHome;
  if (!sameTeams && !reversedTeams) return false;

  const scoreTime = Date.parse(score.commence_time || score.start_time || score.date || '');
  const gameTime = Date.parse(game.commence_time || '');
  if (Number.isFinite(scoreTime) && Number.isFinite(gameTime)) {
    // Keep the fallback tight so doubleheaders/soccer cups do not cross-match.
    return Math.abs(scoreTime - gameTime) <= 12 * 60 * 60 * 1000;
  }
  return true;
}

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
      'X-EdgeFinder-Email': user.email || '',
    };
  } catch {
    return user?.email ? { 'X-EdgeFinder-Email': user.email } : {};
  }
}

function findScoreForGame(scoresData = [], game) {
  return scoresData.find(score => score?.id === game?.id) || scoresData.find(score => scoreMatchesGame(score, game));
}

// ESPN live-status events have no shared id with the odds feed, so match on
// normalized team names within a tight time window (mirrors scoreMatchesGame).
function liveStatusMatchesGame(evt, game) {
  if (!evt || !game) return false;
  const eHome = normalizeName(evt.home_team);
  const eAway = normalizeName(evt.away_team);
  const gHome = normalizeName(game.home_team);
  const gAway = normalizeName(game.away_team);
  if (!eHome || !eAway || !gHome || !gAway) return false;
  const same = eHome === gHome && eAway === gAway;
  const reversed = eHome === gAway && eAway === gHome;
  if (!same && !reversed) return false;
  const et = Date.parse(evt.commence_time || '');
  const gt = Date.parse(game.commence_time || '');
  if (Number.isFinite(et) && Number.isFinite(gt)) {
    return Math.abs(et - gt) <= 12 * 60 * 60 * 1000;
  }
  return true;
}

function findLiveStatusForGame(events = [], game) {
  return events.find(evt => liveStatusMatchesGame(evt, game)) || null;
}

function getTeamScore(scoreData, teamName) {
  if (!scoreData?.scores?.length || !teamName) return null;
  const target = normalizeName(teamName);
  const row = scoreData.scores.find(score => normalizeName(score.name) === target);
  return row?.score ?? null;
}

// ============================================================
// Board snapshot — the last board seen, saved so the next open paints
// instantly from disk while fresh odds load behind it. Tied to the signed-in
// user (so a Pro board is never shown to someone else on a shared device) and
// dropped once it is too old to be useful.
// ============================================================
const SNAPSHOT_KEY = 'edgefinder_board_snapshot';
const SNAPSHOT_MAX_AGE = 30 * 60 * 1000;
const SNAPSHOT_MAX_CHARS = 3 * 1024 * 1024;
const PROPS_REFRESH_MS = 5 * 60 * 1000;
// A props sport whose last fetch failed is retried on a later refresh, but
// never more often than this — each attempt is a full event scan upstream.
const PROPS_RETRY_MS = 60 * 1000;
// ...except right after a failure, when one quick retry is worth it.
const PROPS_FAILURE_RETRY_MS = 20 * 1000;

// Board loading discipline. The Odds API rejects bursts over ~30 requests a
// second, and the board covers ~70 sports: firing them all at once (plus
// scores and live status per sport) came back 429 for most of them, so games
// were missing until the next refresh. Sports now go out a few per request,
// majors first, with only a few requests in flight.
const ODDS_BATCH_SIZE = 4;
const ODDS_BATCH_CONCURRENCY = 3;
const SPORT_RETRY_DELAY_MS = 3000;

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function runPool(items, limit, worker) {
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

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Scores only exist once a game has started; asking for a sport whose games
// are all still upcoming costs an upstream call and returns nothing usable.
export function needsScores(games = [], now = Date.now()) {
  return games.some(game => {
    const start = Date.parse(game?.commence_time || '');
    return Number.isFinite(start) && start <= now;
  });
}

// After a full-board load, games still standing in from the saved board
// (`placeholders`: id -> sport key) are pruned: a sport that loaded keeps
// only what the feed returned, and a sport no longer on the board goes. A
// sport that failed to load keeps its saved games until it does, instead of
// vanishing from the board. Live games are never touched.
export function pruneSnapshotGames(games, { placeholders, liveIds, loadedKeys, attemptedKeys }) {
  return games.filter(game => {
    if (!placeholders.has(game.id) || liveIds.has(game.id)) return true;
    const sport = placeholders.get(game.id);
    return attemptedKeys.has(sport) && !loadedKeys.has(sport);
  });
}

function readBoardSnapshot() {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (snap?.uid !== uid || !Array.isArray(snap.games) || !snap.games.length) return null;
    if (!(Date.now() - snap.ts < SNAPSHOT_MAX_AGE)) return null;
    // v2 stores the compact encoding; older snapshots hold plain games.
    const games = snap.v === SNAPSHOT_VERSION ? decodeBoard(snap.games) : snap.games;
    return { ...snap, games };
  } catch {
    return null;
  }
}

function writeBoardSnapshot(games, injuries) {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid || !games.length) return;
    const raw = JSON.stringify({ v: SNAPSHOT_VERSION, uid, ts: Date.now(), games: encodeBoard(games), injuries });
    if (raw.length > SNAPSHOT_MAX_CHARS) {
      localStorage.removeItem(SNAPSHOT_KEY); // too big to keep; never leave a stale one behind
      return;
    }
    localStorage.setItem(SNAPSHOT_KEY, raw);
  } catch {
    // Quota full: drop the snapshot rather than leave an outdated one behind.
    try { localStorage.removeItem(SNAPSHOT_KEY); } catch {}
  }
}

export function useOdds({ filter, enabledSports = null, refreshInterval: defaultInterval = 120 }) {
    // Painted from the last session's board when there is one (see snapshot
    // helpers above); live data replaces it as soon as it arrives.
    const snapshotRef = useRef(undefined);
    if (snapshotRef.current === undefined) snapshotRef.current = readBoardSnapshot();
    const [games, setGames] = useState(() => snapshotRef.current?.games || []);
    // Saved-board games not yet confirmed by live data: id -> sport key.
    const placeholdersRef = useRef(null);
    if (placeholdersRef.current === null) {
      placeholdersRef.current = new Map((snapshotRef.current?.games || []).map(g => [g.id, g.sport_key]));
    }
    const [playerProps, setPlayerProps] = useState([]);
    // Props load in the background after game odds, so the Props tab needs
    // its own flag to tell "still loading" apart from "no props posted".
    const [propsLoading, setPropsLoading] = useState(true);
    // Prop price/line snapshots for movement signals. Session memory only:
    // persisting thousands of outcomes to localStorage was what made phones
    // janky before, and movement is a same-session signal anyway.
    const [propHistory, setPropHistory] = useState({});
    const [injuries, setInjuries] = useState(() => snapshotRef.current?.injuries || {});
    const [historicOdds, setHistoricOdds] = usePersistentState('edgefinder_historic_openers', {});
    const [loading, setLoading] = useState(() => !snapshotRef.current);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isConnected, setIsConnected] = useState(true);
    // Absolute time of the next auto-refresh. Exposing a timestamp instead of
    // a ticking "seconds left" counter means the app re-renders when data
    // changes, not once a second — the per-second re-render of every game card
    // was the single biggest source of jank on the board.
    const [nextRefreshAt, setNextRefreshAt] = useState(() => Date.now() + defaultInterval * 1000);
    // True while any odds load is in flight (initial, auto, manual or
    // filter-driven) so the UI can show refresh feedback without blanking.
    const [refreshing, setRefreshing] = useState(false);
    const inFlightRef = useRef(0);
    const [sportLastUpdated, setSportLastUpdated] = useState({});
    const [gameLineHistory, setGameLineHistory] = usePersistentState('edgefinder_game_lines', {});
    const rotationIndexRef = useRef(0);
    // Per props sport: when it last loaded, and when it was last attempted.
    const propsFetchRef = useRef({ success: {}, attempt: {} });
    const hasCompletedInitialLoadRef = useRef(false);

  // One-time storage hygiene. These maps are keyed by game id and games churn
  // daily, so without pruning they grow forever — every state change then
  // re-serializes the whole blob to localStorage, which is exactly the kind
  // of main-thread work that makes the app feel sluggish on phones.
  useEffect(() => {
        // Prop history now lives in memory only — drop the old persisted
        // blob instead of parsing it into memory on every boot.
        try { localStorage.removeItem('edgefinder_prop_history'); } catch {}

      const pruneMap = (setter, isFresh) => {
            setter(prev => {
                    const next = {};
                    let dropped = 0;
                    for (const [id, value] of Object.entries(prev || {})) {
                            if (isFresh(value)) next[id] = value;
                            else dropped += 1;
                    }
                    return dropped ? next : prev;
            });
      };

      const OPENER_MAX_AGE = 14 * 24 * 60 * 60 * 1000;
        pruneMap(setHistoricOdds, opener => {
              const ts = Date.parse(opener?.capturedAt || '');
              return Number.isFinite(ts) && Date.now() - ts < OPENER_MAX_AGE;
        });

      const LINES_MAX_AGE = 5 * 24 * 60 * 60 * 1000;
        pruneMap(setGameLineHistory, history => {
              const last = Array.isArray(history) ? history[history.length - 1] : null;
              return last?.timestamp && Date.now() - last.timestamp < LINES_MAX_AGE;
        });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine refresh interval: 30s if any game is genuinely live, 120s
  // otherwise. We now use the ESPN-backed status so finished games (which the
  // odds feed still lists with a past start time) don't pin us to fast refresh.
  const hasLiveGame = games.some(g => isGameLive(g));
    const refreshInterval = hasLiveGame ? 30 : defaultInterval;

  // ============================================================
  // Fetchers
  // ============================================================

  // The Odds API rotates seasonal keys (each tennis major is its own sport
  // key; cups come and go), so most of our catalog is inactive at any given
  // moment. /api/sports is quota-free and says what's in season — we skip the
  // rest instead of spending a paid odds request per dead key every refresh.
  // It also tells us about in-season game-market sports our static SPORTS map
  // doesn't list (e.g. NBA Summer League, preseason keys): the edge scanner
  // discovers those from the same catalog, so the Games tab must fetch them
  // too or an edge can point at a game that never appears on the board.
  const activeSportsRef = useRef(null);
  const getActiveCatalog = useCallback(async () => {
        if (activeSportsRef.current) return activeSportsRef.current;
        try {
                const res = await fetch('/api/sports');
                if (!res.ok) return null;
                const list = await res.json();
                if (!Array.isArray(list) || list.length === 0) return null;
                const known = new Set(Object.values(SPORTS));
                activeSportsRef.current = {
                        keys: new Set(list.map(s => s.key)),
                        // [displayName, sportKey] pairs, same shape as Object.entries(SPORTS).
                        extras: list
                          .filter(s => s.key && !s.has_outrights && s.group !== 'Politics' && !known.has(s.key))
                          .map(s => [s.title || s.key, s.key]),
                };
                return activeSportsRef.current;
        } catch {
                return null;
        }
  }, []);

  const fetchOdds = useCallback(async (sport) => {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/odds?sport=${sport}&markets=h2h,spreads,totals`, { headers });
        if (!res.ok) throw new Error(`Odds API Error: ${res.status}`);
        return res.json();
  }, []);

  // Several sports in one request. Resolves to { [sportKey]: result } where a
  // result is { games } or { error, retry?, single? }; throws when the request
  // itself fails.
  const fetchOddsBatch = useCallback(async (sportKeys) => {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/odds?sports=${sportKeys.join(',')}&markets=h2h,spreads,totals`, { headers });
        if (!res.ok) throw new Error(`Odds API Error: ${res.status}`);
        const body = await res.json();
        // A server without batch support answers with a single board; fall
        // back to one request per sport rather than misreading it.
        if (!body || Array.isArray(body) || typeof body.sports !== 'object') {
                return Object.fromEntries(sportKeys.map(key => [key, { error: 'no-batch', retry: true, single: true }]));
        }
        return body.sports;
  }, []);

  const fetchScores = useCallback(async (sport) => {
        try {
                const res = await fetch(`/api/scores?sport=${sport}`);
                if (!res.ok) return [];
                const data = await res.json();
                return Array.isArray(data) ? data : [];
        } catch {
                return [];
        }
  }, []);

  // ESPN-backed live status: real state/period/clock, live scores, marquee
  // headlines, and MLB probable pitchers. Soft-fails to [] so a hiccup never
  // blocks the odds board.
  const fetchLiveStatus = useCallback(async (sport) => {
        try {
                const res = await fetch(`/api/live-status?sport=${sport}`);
                if (!res.ok) return [];
                const data = await res.json();
                return Array.isArray(data?.events) ? data.events : [];
        } catch {
                return [];
        }
  }, []);

  // Live status for several sports in one call: { [sportKey]: events[] }.
  // Falls back to per-sport calls if the batch request fails.
  const fetchLiveStatusBatch = useCallback(async (sportKeys) => {
        if (!sportKeys.length) return {};
        try {
                const res = await fetch(`/api/live-status?sports=${sportKeys.join(',')}`);
                if (res.ok) {
                        const body = await res.json();
                        if (body?.sports && typeof body.sports === 'object') {
                                return Object.fromEntries(sportKeys.map(key => {
                                        const events = body.sports[key]?.events;
                                        return [key, Array.isArray(events) ? events : []];
                                }));
                        }
                }
        } catch {}
        const lists = await Promise.all(sportKeys.map(key => fetchLiveStatus(key)));
        return Object.fromEntries(sportKeys.map((key, i) => [key, lists[i]]));
  }, [fetchLiveStatus]);

  // Fetch injuries from our proxy (which normalizes the ESPN response)
  // Returns an array of flat injury objects with { playerName, team, teamShort, position, status, ... }
  // Fetch injuries via serverless function — raw ESPN pass-through
  const fetchInjuries = useCallback(async (sportKey) => {
    const espnSport = SPORT_ESPN_MAP[sportKey];
    if (!espnSport) return [];
    try {
      const res = await fetch(`/api/injuries?sport=${espnSport}`);
      if (!res.ok) return [];
      const data = await res.json();
      const allInjuries = [];
      data.injuries?.forEach(team => {
        const teamName = team.displayName;
        const teamShort = team.displayName?.split(' ')?.pop();
        team.injuries?.forEach(injury => {
          allInjuries.push({
            id: injury.id,
            name: injury.athlete?.displayName,
            team: teamName,
            teamShort,
            status: injury.status,
            injury: injury.details?.type || injury.shortComment,
          });
        });
      });
      return allInjuries;
    } catch { return []; }
  }, []);

  // Resolves to null (not []) when the request fails, so a network blip keeps
  // the sport's previous board instead of blanking it and its movement history.
  const fetchPlayerProps = useCallback(async (sport) => {
        try {
                const headers = await getAuthHeaders();
                const res = await fetch(`/api/props?sport=${sport}&limit=20&maxProps=2500`, { headers });
                if (!res.ok) return null;
                const allProps = await res.json();
                return Array.isArray(allProps) ? allProps.map(prop => ({ ...prop, book: prop.bookTitle || prop.bookKey })) : null;
        } catch {
                return null;
        }
  }, []);

  // ============================================================
  // Smart refresh: determine which sports to fetch this cycle
  // ============================================================
  const getSportsToFetch = useCallback(() => {
        const allSports = Object.entries(SPORTS).filter(([name]) =>
                !enabledSports || enabledSports.includes(name)
                                                            );
        if (allSports.length === 0) return [];

                                           if (filter && filter !== 'ALL') {
                                                   const sportKey = SPORTS[filter];
                                                   if (sportKey) return [[filter, sportKey]];
                                                   const match = allSports.find(([, v]) => v.includes(filter.toLowerCase()));
                                                   if (match) return [match];
                                                   return allSports.slice(0, 3);
                                           }

                                           // ALL selected means all enabled sports should stay active.
                                           // The dashboard depends on this to avoid looking like only a
                                           // four-sport board after onboarding.
                                           const batchSize = allSports.length;
        const start = rotationIndexRef.current % allSports.length;
        const batch = [];
        for (let i = 0; i < batchSize; i++) {
                batch.push(allSports[(start + i) % allSports.length]);
        }
        rotationIndexRef.current += batchSize;
        return batch;
  }, [filter, enabledSports]);

  // ============================================================
  // Main data loader
  // ============================================================
  // Replace games by id, keep the rest (a sport's odds arrive independently).
  const mergeGames = useCallback((incoming) => {
        setGames(prev => {
                const updated = new Map(prev.map(g => [g.id, g]));
                incoming.forEach(g => updated.set(g.id, g));
                return Array.from(updated.values());
        });
  }, []);

  const loadData = useCallback(async (isInitial = false) => {
        if (isInitial && !snapshotRef.current) setLoading(true);
        setError(null);
        inFlightRef.current += 1;
        setRefreshing(true);

                                   try {
                                           const allSports = Object.entries(SPORTS).filter(([name]) => !enabledSports || enabledSports.includes(name));
                                           const sportsToFetch = isInitial && (!filter || filter === 'ALL')
                                             ? allSports
                                             : isInitial
                                               ? allSports
                                               : getSportsToFetch();
                                           if (isInitial && (!filter || filter === 'ALL')) {
                                             rotationIndexRef.current = sportsToFetch.length;
                                           }

          // Out-of-season sports are skipped entirely (their odds request
          // would just 404). When the user explicitly filters to one sport we
          // fetch it regardless, so a stale catalog can never hide a chip the
          // user tapped. If /api/sports fails we fall back to fetching all.
          const catalog = await getActiveCatalog();
          const activeKeys = catalog?.keys ?? null;
          const isSpecificFilter = filter && filter !== 'ALL';
          const gatedSports = activeKeys && !isSpecificFilter
            ? sportsToFetch.filter(([, key]) => activeKeys.has(key))
            : sportsToFetch;

          // Cover catalog sports the static SPORTS map doesn't list, so the
          // Games tab always represents everything the edge scan can surface.
          const extraSports = catalog?.extras ?? [];
          let sportsToLoad = gatedSports;
          if (!isSpecificFilter) {
                  sportsToLoad = [...gatedSports, ...extraSports];
          } else if (!SPORTS[filter]) {
                  // The tapped chip may be a catalog-discovered sport (its chip
                  // label is the catalog title, e.g. "NBA Preseason").
                  const extraMatch = extraSports.find(([name]) => name.toLowerCase() === filter.toLowerCase());
                  if (extraMatch) sportsToLoad = [extraMatch];
          }

          // Props are independent of game odds, so they start now and load in
          // parallel with the board instead of waiting for the slowest sport.
          const refreshProps = async () => {
            const PROPS_SPORTS = ['basketball_nba', 'basketball_wnba', 'americanfootball_nfl', 'americanfootball_ncaaf', 'icehockey_nhl', 'baseball_mlb'];
            const PROPS_NAME_MAP = { basketball_nba: 'NBA', basketball_wnba: 'WNBA', americanfootball_nfl: 'NFL', americanfootball_ncaaf: 'NCAAF', icehockey_nhl: 'NHL', baseball_mlb: 'MLB' };
            const propsToFetch = PROPS_SPORTS.filter(s =>
              (!enabledSports || enabledSports.includes(PROPS_NAME_MAP[s])) &&
              (!activeKeys || activeKeys.has(s))
            );
            if (propsToFetch.length === 0) {
              setPlayerProps([]);
              setPropsLoading(false);
              return;
            }
            // Throttle per sport by its last SUCCESS: props are slower-moving
            // and expensive to scan, so a loaded sport waits 5 minutes — but a
            // sport whose scan failed (rate limit, partial slate) is retried on
            // a later refresh instead of staying empty for 5 minutes.
            const nowTs = Date.now();
            const { success, attempt } = propsFetchRef.current;
            const dueSports = isInitial
              ? propsToFetch
              : propsToFetch.filter(s => nowTs - (success[s] || 0) >= PROPS_REFRESH_MS
                && nowTs - (attempt[s] || 0) >= PROPS_RETRY_MS);
            if (dueSports.length === 0) return;

            // Fetches props for `sportKeys` and merges them in (or replaces the
            // whole board on the first load). Returns the sports that failed.
            const loadPropsFor = async (sportKeys, replaceAll) => {
              sportKeys.forEach(s => { attempt[s] = Date.now(); });
              const propsBySport = [];
              // Two leagues at a time prevents the client from multiplying
              // each route's event scan into a large provider burst.
              for (let index = 0; index < sportKeys.length; index += 2) {
                const batch = await Promise.all(sportKeys.slice(index, index + 2).map(async (sportKey) => {
                  try {
                    return await fetchPlayerProps(sportKey);
                  } catch (e) {
                    console.warn('Props fetch failed for ' + sportKey + ':', e.message);
                    return null;
                  }
                }));
                propsBySport.push(...batch);
              }
              // Sports whose request failed keep their previous props/history.
              const refreshedSports = sportKeys.filter((_, i) => Array.isArray(propsBySport[i]));
              refreshedSports.forEach(s => { success[s] = Date.now(); });
              const allProps = propsBySport.filter(Array.isArray).flat();
              setPropHistory(prev => appendPropHistory(prev, allProps, { refreshedSports }));
              setPlayerProps(prev =>
                replaceAll
                  ? allProps
                  : [
                      ...prev.filter(p => !refreshedSports.some(s => p.sport === s || p.id?.startsWith(s))),
                      ...allProps,
                    ]
              );
              return sportKeys.filter(s => !refreshedSports.includes(s));
            };

            // Only the first load shows a spinner; background refreshes keep
            // the current board on screen.
            if (isInitial) setPropsLoading(true);
            let failed = [];
            try {
              failed = await loadPropsFor(dueSports, isInitial);
            } finally {
              setPropsLoading(false);
            }
            // A failed scan (usually a provider rate limit) gets one quick
            // retry instead of waiting for the next board refresh; after that
            // the regular refreshes keep trying.
            if (failed.length) {
              setTimeout(() => { loadPropsFor(failed, false).catch(() => {}); }, PROPS_FAILURE_RETRY_MS);
            }
          };
          refreshProps();

          // Scores (only once a game has started), injuries and live status
          // for sports whose odds just arrived, then publish each sport so one
          // slow league never holds up the board.
          const enrichAndPublish = async (loaded) => {
                    const withGames = loaded.filter(item => item.games.length);
                    loaded.filter(item => !item.games.length).forEach(({ entry: [sportName] }) => {
                              setSportLastUpdated(prev => ({ ...prev, [sportName]: Date.now() }));
                    });
                    if (!withGames.length) return;

                    // First paint: show the odds as soon as this sport has
                    // them; scores/injuries/live status fill in right after.
                    // Only games that haven't started: a started game needs its
                    // ESPN status first or it could flash a wrong LIVE badge.
                    // (Refreshes skip this so live scores never blink off.)
                    if (isInitial) {
                              const now = Date.now();
                              const upcoming = withGames.flatMap(item => item.games.filter(g => Date.parse(g.commence_time) > now));
                              if (upcoming.length) {
                                        mergeGames(upcoming);
                                        setLoading(false);
                              }
                    }

                    const [liveBySport, perSport] = await Promise.all([
                              fetchLiveStatusBatch(withGames.map(item => item.entry[1])),
                              Promise.all(withGames.map(({ entry: [, sportKey], games: sportGames }) => Promise.all([
                                        needsScores(sportGames) ? fetchScores(sportKey) : [],
                                        fetchInjuries(sportKey),
                              ]))),
                    ]);

                    withGames.forEach(({ entry: [sportName, sportKey], games: oddsData }, index) => {
                              // One sport with odd data must never take the rest down.
                              try {
                              const [scoresData, injuryList] = perSport[index];
                              const liveEvents = liveBySport[sportKey] || [];
                              const gamesWithScores = oddsData.map(game => {
                                        const scoreData = findScoreForGame(scoresData, game);
                                        const liveStatus = findLiveStatusForGame(liveEvents, game);
                                        return {
                                                  ...game,
                                                  scores: scoreData?.scores?.length ? scoreData.scores : null,
                                                  // ESPN is authoritative for completion when present.
                                                  completed: liveStatus ? liveStatus.completed : (scoreData?.completed || false),
                                                  homeScore: getTeamScore(scoreData, game.home_team) ?? liveStatus?.homeScore ?? null,
                                                  awayScore: getTeamScore(scoreData, game.away_team) ?? liveStatus?.awayScore ?? null,
                                                  liveStatus: liveStatus || null,
                                        };
                              });

                              const sportInjuriesByTeam = {};
                              injuryList.forEach(inj => {
                                        const sportPrefix = sportKey.split('_')[0]; // 'basketball', 'americanfootball', etc.
                                        const fullKey = `${sportPrefix}:${inj.team}`;
                                        const shortKey = `${sportPrefix}:${inj.teamShort}`;
                                        [fullKey, fullKey.toLowerCase(), shortKey, shortKey.toLowerCase(), inj.team, inj.team?.toLowerCase()]
                                                  .filter(Boolean)
                                                  .forEach(key => {
                                                            if (!sportInjuriesByTeam[key]) sportInjuriesByTeam[key] = [];
                                                            sportInjuriesByTeam[key].push(inj);
                                                  });
                              });
                              setSportLastUpdated(prev => ({ ...prev, [sportName]: Date.now() }));
                              mergeGames(gamesWithScores);
                              setInjuries(prev => ({ ...prev, ...sportInjuriesByTeam }));
                              markLoaded(sportKey, gamesWithScores);
                              } catch (e) {
                                        console.warn(`Failed to load ${sportName}:`, e.message);
                                        outcomes.set(sportKey, { status: 'failed' });
                              }
                    });
                    setLoading(false);
          };

          // Outcome per sport: 'ok' (with its final games), 'retry' (try again
          // shortly), 'single' (fetch on its own) or 'failed'.
          const outcomes = new Map();
          const enrichments = [];
          const markLoaded = (sportKey, finalGames) => { outcomes.set(sportKey, { status: 'ok', games: finalGames }); };

          const loadBatch = async (batch) => {
                    let results;
                    try {
                              results = await fetchOddsBatch(batch.map(([, key]) => key));
                    } catch (e) {
                              console.warn(`Failed to load ${batch.map(([name]) => name).join(', ')}:`, e.message);
                              batch.forEach(([, key]) => outcomes.set(key, { status: 'retry' }));
                              return;
                    }
                    const loaded = [];
                    batch.forEach(entry => {
                              const result = results?.[entry[1]];
                              if (Array.isArray(result?.games)) {
                                        loaded.push({ entry, games: result.games });
                                        if (!result.games.length) outcomes.set(entry[1], { status: 'ok', games: [] });
                              } else {
                                        outcomes.set(entry[1], { status: result?.single ? 'single' : result?.retry ? 'retry' : 'failed' });
                              }
                    });
                    // Scores/live status for this slice run alongside the next
                    // odds batches instead of holding the queue up.
                    enrichments.push(enrichAndPublish(loaded).catch(e => {
                              console.warn('Failed to finish loading a batch:', e.message);
                              loaded.forEach(({ entry }) => { if (outcomes.get(entry[1])?.status !== 'ok') outcomes.set(entry[1], { status: 'failed' }); });
                    }));
          };

          const loadSingle = async (entry) => {
                    try {
                              const oddsData = await fetchOdds(entry[1]);
                              const sportGames = Array.isArray(oddsData) ? oddsData : [];
                              if (!sportGames.length) outcomes.set(entry[1], { status: 'ok', games: [] });
                              await enrichAndPublish([{ entry, games: sportGames }]);
                    } catch (e) {
                              console.warn(`Failed to load ${entry[0]}:`, e.message);
                              outcomes.set(entry[1], { status: 'failed' });
                    }
          };

          await runPool(chunk(sportsToLoad, ODDS_BATCH_SIZE), ODDS_BATCH_CONCURRENCY, loadBatch);
          await Promise.all(enrichments.splice(0));

          // Follow-ups: sports too big for a shared response load on their
          // own; sports that hit a rate limit or a blip get one more try after
          // a short pause, so a burst doesn't leave them off the board until
          // the next refresh.
          const pending = (status) => sportsToLoad.filter(([, key]) => outcomes.get(key)?.status === status);
          const singles = pending('single');
          if (singles.length) await runPool(singles, 2, loadSingle);
          const retries = pending('retry');
          if (retries.length) {
                    await wait(SPORT_RETRY_DELAY_MS);
                    await runPool(chunk(retries, ODDS_BATCH_SIZE), 2, loadBatch);
                    await Promise.all(enrichments.splice(0));
                    const tooBig = pending('single');
                    if (tooBig.length) await runPool(tooBig, 2, loadSingle);
          }

          const loadedKeys = new Set(sportsToLoad.map(([, key]) => key).filter(key => outcomes.get(key)?.status === 'ok'));
          const newGames = sportsToLoad.flatMap(([, key]) => (outcomes.get(key)?.status === 'ok' ? outcomes.get(key).games : []));

          // The saved board was only a placeholder: once a full-board load is
          // in, drop its games that are no longer on the feed — but keep a
          // sport that failed to load until it does, instead of blanking it.
          const placeholders = placeholdersRef.current;
          if (placeholders.size && loadedKeys.size && !isSpecificFilter) {
                  const liveIds = new Set(newGames.map(g => g.id));
                  const attemptedKeys = new Set(sportsToLoad.map(([, key]) => key));
                  const pruneArgs = { placeholders: new Map(placeholders), liveIds, loadedKeys, attemptedKeys };
                  setGames(prev => pruneSnapshotGames(prev, pruneArgs));
                  for (const [id, sport] of placeholders) {
                          if (liveIds.has(id) || loadedKeys.has(sport) || !attemptedKeys.has(sport)) placeholders.delete(id);
                  }
                  if (!placeholders.size) snapshotRef.current = null;
          }

          // Auto-capture opening lines + line history in ONE state update
          // each. The old per-game setState loops created a fresh copy of the
          // whole persisted map for every game on every refresh — O(games²)
          // object churn plus repeated full-blob localStorage serialization,
          // which is what phones feel as jank.
          if (newGames.length) {
                    const nowIso = new Date().toISOString();
                    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const nowTs = Date.now();
                    const lineOf = (game) => ({
                              spread: game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')
                                ?.outcomes?.find(o => o.name === game.home_team)?.point,
                              total: game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals')
                                ?.outcomes?.[0]?.point,
                              book: game.bookmakers?.[0]?.title,
                    });

                    setHistoricOdds(prev => {
                              let changed = false;
                              const next = { ...prev };
                              newGames.forEach(game => {
                                        if (next[game.id]) return;
                                        const { spread, total, book } = lineOf(game);
                                        if (spread == null && total == null) return;
                                        const h2h = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h')?.outcomes;
                                        next[game.id] = {
                                                  spread,
                                                  total,
                                                  h2h: h2h?.map(o => ({ name: o.name, price: o.price })) || [],
                                                  capturedAt: nowIso,
                                                  book,
                                        };
                                        changed = true;
                              });
                              return changed ? next : prev;
                    });

                    // Last 20 snapshots per game.
                    setGameLineHistory(prev => {
                              let changed = false;
                              const next = { ...prev };
                              newGames.forEach(game => {
                                        const { spread, total, book } = lineOf(game);
                                        if (spread === undefined && total === undefined) return;
                                        const entry = { time: timeLabel, timestamp: nowTs, spread, total, book };
                                        next[game.id] = [...(next[game.id] || []), entry].slice(-20);
                                        changed = true;
                              });
                              return changed ? next : prev;
                    });
          }

          setLastUpdate(new Date());
                                           setIsConnected(true);
                                           setNextRefreshAt(Date.now() + refreshInterval * 1000);
                                   } catch (err) {
                                           setError(err.message);
                                           setIsConnected(false);
                                           setPropsLoading(false);
                                   } finally {
                                           setLoading(false);
                                           inFlightRef.current = Math.max(0, inFlightRef.current - 1);
                                           if (inFlightRef.current === 0) setRefreshing(false);
                                   }
  }, [mergeGames, fetchOdds, fetchOddsBatch, fetchScores, fetchInjuries, fetchLiveStatusBatch, fetchPlayerProps, getSportsToFetch, getActiveCatalog, filter, enabledSports, refreshInterval, setGameLineHistory, setHistoricOdds]);

  // Save the board for the next open. Debounced and skipped until live data has
  // loaded, so a placeholder is never written back and serialization stays off
  // the critical path.
  useEffect(() => {
        if (!lastUpdate || !games.length) return undefined;
        let idleId = null;
        const timer = setTimeout(() => {
                // Encoding a full board is real work; do it when the page is idle.
                if (typeof window.requestIdleCallback === 'function') {
                        idleId = window.requestIdleCallback(() => writeBoardSnapshot(games, injuries), { timeout: 5000 });
                } else {
                        writeBoardSnapshot(games, injuries);
                }
        }, 2000);
        return () => {
                clearTimeout(timer);
                if (idleId != null) window.cancelIdleCallback?.(idleId);
        };
  }, [games, injuries, lastUpdate]);

  // Initial load
  useEffect(() => {
        loadData(true).finally(() => {
                hasCompletedInitialLoadRef.current = true;
        });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch immediately when the user changes sport filters/settings. Previously
  // the page waited for the 60-120s countdown, so clicking MMA/Boxing/Tennis
  // could show an empty state even while the API had games.
  useEffect(() => {
        if (!hasCompletedInitialLoadRef.current) return;
        loadData(false);
        setNextRefreshAt(Date.now() + refreshInterval * 1000);
  }, [filter, enabledSports]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh: one timer aimed at nextRefreshAt. The next deadline is set
  // before loading (and again when a load succeeds), so a failed refresh still
  // retries on the normal cadence instead of looping.
  useEffect(() => {
        const delay = Math.max(0, nextRefreshAt - Date.now());
        const timer = setTimeout(() => {
                setNextRefreshAt(Date.now() + refreshInterval * 1000);
                // Slow networks: don't stack a timed refresh on one still running.
                if (inFlightRef.current > 0) return;
                loadData(false);
        }, delay);
        return () => clearTimeout(timer);
  }, [nextRefreshAt, refreshInterval, loadData]);

  // When a game goes live the cadence tightens — pull the next refresh in
  // rather than waiting out the slower pregame countdown.
  useEffect(() => {
        setNextRefreshAt(prev => Math.min(prev, Date.now() + refreshInterval * 1000));
  }, [refreshInterval]);

  // Coming back to the app (phone unlocked, tab refocused, network restored):
  // if a refresh came due while we were away, run it now so the board is
  // never showing stale prices the moment the user looks at it.
  const nextRefreshAtRef = useRef(nextRefreshAt);
  nextRefreshAtRef.current = nextRefreshAt;
  useEffect(() => {
        const refreshIfDue = () => {
                if (document.visibilityState !== 'visible') return;
                if (Date.now() >= nextRefreshAtRef.current) setNextRefreshAt(Date.now());
        };
        const refreshNow = () => setNextRefreshAt(Date.now());
        document.addEventListener('visibilitychange', refreshIfDue);
        window.addEventListener('online', refreshNow);
        return () => {
                document.removeEventListener('visibilitychange', refreshIfDue);
                window.removeEventListener('online', refreshNow);
        };
  }, []);

  const manualRefresh = useCallback(() => {
        loadData(false);
        setNextRefreshAt(Date.now() + refreshInterval * 1000);
  }, [loadData, refreshInterval]);

  return {
        games,
        playerProps,
        propsLoading,
        injuries,
        historicOdds,
        loading,
        error,
        lastUpdate,
        isConnected,
        nextRefreshAt,
        refreshInterval,
        refreshing,
        gameLineHistory,
        propHistory,
        sportLastUpdated,
        manualRefresh,
        setGameLineHistory,
  };
}
