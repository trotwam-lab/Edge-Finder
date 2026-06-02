import { useState, useEffect, useCallback, useRef } from 'react';
import { SPORTS, BOOKMAKERS, SPORT_ESPN_MAP } from '../constants.js';
import { auth } from '../firebase.js';

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

function getTeamScore(scoreData, teamName) {
  if (!scoreData?.scores?.length || !teamName) return null;
  const target = normalizeName(teamName);
  const row = scoreData.scores.find(score => normalizeName(score.name) === target);
  return row?.score ?? null;
}

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
    const [propHistory, setPropHistory] = usePersistentState('edgefinder_prop_history', {});
    const [gameLineHistory, setGameLineHistory] = usePersistentState('edgefinder_game_lines', {});
    const rotationIndexRef = useRef(0);
    const hasCompletedInitialLoadRef = useRef(false);

  // Determine refresh interval: 60s if any game is live, 120s otherwise
  const hasLiveGame = games.some(g =>
        new Date(g.commence_time) < new Date() && !g.completed
                                   );
    const refreshInterval = hasLiveGame ? 60 : defaultInterval;

  // ============================================================
  // Fetchers
  // ============================================================

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

                                           if (filter && filter !== 'ALL') {
                                                   const sportKey = SPORTS[filter];
                                                   if (sportKey) return [[filter, sportKey]];
                                                   const match = allSports.find(([, v]) => v.includes(filter.toLowerCase()));
                                                   if (match) return [match];
                                                   return allSports.slice(0, 3);
                                           }

                                           // ALL selected — rotate through sports in batches of 4
                                           const batchSize = 4;
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
                                           // Initial ALL view used to only fetch the four major US leagues,
                                           // which made available combat/tennis markets look missing until
                                           // the slow rotation eventually reached them. Keep the first paint
                                           // useful without fetching every configured sport at once.
                                           const priorityNames = ['NBA', 'NFL', 'NHL', 'MLB', 'MMA', 'Boxing', 'ATP Italian', 'WTA Italian'];
                                           const sportsToFetch = isInitial && (!filter || filter === 'ALL')
                                             ? allSports.filter(([name]) => priorityNames.includes(name))
                                             : isInitial
                                               ? allSports
                                               : getSportsToFetch();
                                           if (isInitial && (!filter || filter === 'ALL')) {
                                             rotationIndexRef.current = sportsToFetch.length;
                                           }

          const sportResults = await Promise.all(sportsToFetch.map(async ([sportName, sportKey]) => {
                    try {
                                const [oddsData, scoresData, injuryList] = await Promise.all([
                                              fetchOdds(sportKey),
                                              fetchScores(sportKey),
                                              fetchInjuries(sportKey),
                                            ]);

                      const gamesWithScores = oddsData.map(game => {
                                    const scoreData = findScoreForGame(scoresData, game);
                                    return {
                                                    ...game,
                                                    scores: scoreData?.scores?.length ? scoreData.scores : null,
                                                    completed: scoreData?.completed || false,
                                                    homeScore: getTeamScore(scoreData, game.home_team),
                                                    awayScore: getTeamScore(scoreData, game.away_team),
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
            const PROPS_SPORTS = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb'];
            const PROPS_NAME_MAP = { basketball_nba: 'NBA', americanfootball_nfl: 'NFL', icehockey_nhl: 'NHL', baseball_mlb: 'MLB' };
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

          // Auto-capture opening lines (first time we see a game)
          newGames.forEach(game => {
                    setHistoricOdds(prev => {
                                if (prev[game.id]) return prev;
                                const spread = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')
                                  ?.outcomes?.find(o => o.name === game.home_team)?.point;
                                const total = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals')
                                  ?.outcomes?.[0]?.point;
                                const h2h = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h')?.outcomes;
                                if (spread == null && total == null) return prev;
                                return {
                                              ...prev,
                                              [game.id]: {
                                                              spread,
                                                              total,
                                                              h2h: h2h?.map(o => ({ name: o.name, price: o.price })) || [],
                                                              capturedAt: new Date().toISOString(),
                                                              book: game.bookmakers?.[0]?.title,
                                              },
                                };
                    });
          });

          // Track game line history (last 20 snapshots per game)
          newGames.forEach(game => {
                    const spread = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')
                      ?.outcomes?.find(o => o.name === game.home_team)?.point;
                    const total = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals')
                      ?.outcomes?.[0]?.point;
                    if (spread !== undefined || total !== undefined) {
                                setGameLineHistory(prev => {
                                              const history = prev[game.id] || [];
                                              const entry = {
                                                              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                              timestamp: Date.now(),
                                                              spread,
                                                              total,
                                                              book: game.bookmakers?.[0]?.title,
                                              };
                                              return { ...prev, [game.id]: [...history, entry].slice(-20) };
                                });
                    }
          });

          setLastUpdate(new Date());
                                           setIsConnected(true);
                                           setCountdown(refreshInterval);
                                   } catch (err) {
                                           setError(err.message);
                                           setIsConnected(false);
                                   } finally {
                                           setLoading(false);
                                   }
  }, [fetchOdds, fetchScores, fetchInjuries, fetchPlayerProps, getSportsToFetch, filter, enabledSports, refreshInterval, setGameLineHistory, setHistoricOdds]);

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
        propHistory,
        sportLastUpdated,
        manualRefresh,
        setGameLineHistory,
  };
}
