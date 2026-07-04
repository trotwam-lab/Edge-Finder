import { useState, useEffect, useCallback, useRef } from 'react';
import { SPORTS, BOOKMAKERS, SPORT_ESPN_MAP } from '../constants.js';
import { auth } from '../firebase.js';
import { isGameLive } from '../utils/live-status.js';

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

const EMPTY_PROP_HISTORY = {};

export function useOdds({ filter, enabledSports = null, refreshInterval: defaultInterval = 120 }) {
    const [games, setGames] = useState([]);
    const [playerProps, setPlayerProps] = useState([]);
    const [injuries, setInjuries] = useState({});
    const [historicOdds, setHistoricOdds] = usePersistentState('edgefinder_historic_openers', {});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [isConnected, setIsConnected] = useState(true);
    const [countdown, setCountdown] = useState(defaultInterval);
    const [sportLastUpdated, setSportLastUpdated] = useState({});
    const [gameLineHistory, setGameLineHistory] = usePersistentState('edgefinder_game_lines', {});
    const rotationIndexRef = useRef(0);
    const hasCompletedInitialLoadRef = useRef(false);

  // One-time storage hygiene. These maps are keyed by game id and games churn
  // daily, so without pruning they grow forever — every state change then
  // re-serializes the whole blob to localStorage, which is exactly the kind
  // of main-thread work that makes the app feel sluggish on phones.
  useEffect(() => {
        // Nothing has written prop history for several versions — drop the
        // stale blob instead of parsing it into memory on every boot.
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

  const fetchPlayerProps = useCallback(async (sport) => {
        try {
                const headers = await getAuthHeaders();
                const res = await fetch(`/api/props?sport=${sport}`, { headers });
                if (!res.ok) return [];
                const allProps = await res.json();
                return Array.isArray(allProps) ? allProps.map(prop => ({ ...prop, book: prop.bookTitle || prop.bookKey })) : [];
        } catch {
                return [];
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
  const loadData = useCallback(async (isInitial = false) => {
        if (isInitial) setLoading(true);
        setError(null);

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

          const sportResults = await Promise.all(sportsToLoad.map(async ([sportName, sportKey]) => {
                    try {
                                const oddsData = await fetchOdds(sportKey);
                                if (!Array.isArray(oddsData) || oddsData.length === 0) {
                                        // No games listed — skip scores/injuries/live-status so an
                                        // idle sport costs one request instead of four.
                                        setSportLastUpdated(prev => ({ ...prev, [sportName]: Date.now() }));
                                        return { games: [], injuriesByTeam: {} };
                                }
                                const [scoresData, injuryList, liveEvents] = await Promise.all([
                                              fetchScores(sportKey),
                                              fetchInjuries(sportKey),
                                              fetchLiveStatus(sportKey),
                                            ]);

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
                      return { games: gamesWithScores, injuriesByTeam: sportInjuriesByTeam };
                    } catch (e) {
                                console.warn(`Failed to load ${sportName}:`, e.message);
                                return { games: [], injuriesByTeam: {} };
                    }
          }));

          const newGames = sportResults.flatMap(result => result.games);
          const injuriesByTeam = sportResults.reduce((acc, result) => ({ ...acc, ...result.injuriesByTeam }), {});

          // Fetch player props in the background so the Games tab can render as soon as game odds are ready.
          const refreshProps = async () => {
            const PROPS_SPORTS = ['basketball_nba', 'basketball_wnba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb'];
            const PROPS_NAME_MAP = { basketball_nba: 'NBA', basketball_wnba: 'WNBA', americanfootball_nfl: 'NFL', icehockey_nhl: 'NHL', baseball_mlb: 'MLB' };
            const propsToFetch = PROPS_SPORTS.filter(s =>
              !enabledSports || enabledSports.includes(PROPS_NAME_MAP[s])
            );
            if (propsToFetch.length === 0) return;
            const propsBySport = await Promise.all(propsToFetch.map(async (sportKey) => {
              try {
                return await fetchPlayerProps(sportKey);
              } catch (e) {
                console.warn('Props fetch failed for ' + sportKey + ':', e.message);
                return [];
              }
            }));
            const allProps = propsBySport.flat();
            setPlayerProps(prev =>
              isInitial
                ? allProps
                : [
                    ...prev.filter(p => !propsToFetch.some(s => p.sport === s || p.id?.startsWith(s))),
                    ...allProps,
                  ]
            );
          };
          refreshProps();

          // Merge new games with existing (replace by id, keep others)
          setGames(prev => {
                    if (isInitial) return newGames;
                    const updated = new Map(prev.map(g => [g.id, g]));
                    newGames.forEach(g => updated.set(g.id, g));
                    return Array.from(updated.values());
          });

          // Merge injuries
          setInjuries(prev => isInitial ? injuriesByTeam : { ...prev, ...injuriesByTeam });

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
                                           setCountdown(refreshInterval);
                                   } catch (err) {
                                           setError(err.message);
                                           setIsConnected(false);
                                   } finally {
                                           setLoading(false);
                                   }
  }, [fetchOdds, fetchScores, fetchInjuries, fetchLiveStatus, fetchPlayerProps, getSportsToFetch, getActiveCatalog, filter, enabledSports, refreshInterval, setGameLineHistory, setHistoricOdds]);

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
        setCountdown(refreshInterval);
  }, [filter, enabledSports]); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown + auto-refresh
  useEffect(() => {
        const interval = setInterval(() => {
                setCountdown(prev => {
                          if (prev <= 1) {
                                      loadData(false);
                                      return refreshInterval;
                          }
                          return prev - 1;
                });
        }, 1000);
        return () => clearInterval(interval);
  }, [refreshInterval, loadData]);

  const manualRefresh = useCallback(() => {
        loadData(false);
        setCountdown(refreshInterval);
  }, [loadData, refreshInterval]);

  return {
        games,
        playerProps,
        injuries,
        historicOdds,
        loading,
        error,
        lastUpdate,
        isConnected,
        countdown,
        gameLineHistory,
        // Prop history has no writer anymore; keep the field so consumers'
        // prop types stay stable, but never load the old blob into memory.
        propHistory: EMPTY_PROP_HISTORY,
        sportLastUpdated,
        manualRefresh,
        setGameLineHistory,
  };
}
