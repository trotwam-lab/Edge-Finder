import { useState, useEffect, useCallback, useRef } from 'react';
import { SPORTS, BOOKMAKERS, SPORT_ESPN_MAP } from '../constants.js';

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

  // Determine refresh interval: 60s if any game is live, 120s otherwise
  const hasLiveGame = games.some(g =>
        new Date(g.commence_time) < new Date() && !g.completed
                                   );
    const refreshInterval = hasLiveGame ? 60 : defaultInterval;

  // ============================================================
  // Fetchers
  // ============================================================

  const fetchOdds = useCallback(async (sport) => {
        const res = await fetch(`/api/odds?sport=${sport}&markets=h2h,spreads,totals`);
        if (!res.ok) throw new Error(`Odds API Error: ${res.status}`);
        return res.json();
  }, []);

  const fetchScores = useCallback(async (sport) => {
        try {
                const res = await fetch(`/api/scores?sport=${sport}`);
                if (!res.ok) return [];
                return res.json();
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
                const res = await fetch(`/api/props?sport=${sport}`);
                if (!res.ok) return [];
                const allProps = await res.json();
                return allProps.map(prop => ({ ...prop, book: prop.bookTitle || prop.bookKey }));
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
                                           const sportsToFetch = isInitial
                                             ? Object.entries(SPORTS).filter(([name]) => !enabledSports || enabledSports.includes(name))
                                                     : getSportsToFetch();

          const newGames = [];
                                           // Collect all injuries with sport prefix to avoid cross-league team name collisions
          const injuriesByTeam = {};

          for (const [sportName, sportKey] of sportsToFetch) {
                    try {
                                const [oddsData, scoresData, injuryList] = await Promise.all([
                                              fetchOdds(sportKey),
                                              fetchScores(sportKey),
                                              fetchInjuries(sportKey),
                                            ]);

                      // Merge scores into games
                      const gamesWithScores = oddsData.map(game => {
                                    const scoreData = scoresData.find(s => s.id === game.id);
                                    return {
                                                    ...game,
                                                    scores: scoreData?.scores || null,
                                                    completed: scoreData?.completed || false,
                                                    homeScore: scoreData?.scores?.find(s => s.name === game.home_team)?.score || null,
                                                    awayScore: scoreData?.scores?.find(s => s.name === game.away_team)?.score || null,
                                    };
                      });
                                newGames.push(...gamesWithScores);

          // Build injury lookup — keyed by sport prefix + team name to avoid cross-league collisions
          const injuriesByTeam = {};
          injuryList.forEach(inj => {
            const sportPrefix = sportKey.split('_')[0]; // 'basketball', 'americanfootball', etc.
            const fullKey = `${sportPrefix}:${inj.team}`;
            const shortKey = `${sportPrefix}:${inj.teamShort}`;
            [fullKey, fullKey.toLowerCase(), shortKey, shortKey.toLowerCase(), inj.team, inj.team?.toLowerCase()]
              .filter(Boolean)
              .forEach(key => {
                if (!injuriesByTeam[key]) injuriesByTeam[key] = [];
                injuriesByTeam[key].push(inj);
              });
          });
          setInjuries(prev => isInitial ? injuriesByTeam : { ...prev, ...injuriesByTeam });
                      setSportLastUpdated(prev => ({ ...prev, [sportName]: Date.now() }));
                    } catch (e) {
                                console.warn(`Failed to load ${sportName}:`, e.message);
                    }
          }

          // Fetch player props — all major sports every cycle, decoupled from odds rotation
          const PROPS_SPORTS = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb'];
          const PROPS_NAME_MAP = { basketball_nba: 'NBA', americanfootball_nfl: 'NFL', icehockey_nhl: 'NHL', baseball_mlb: 'MLB' };
          const propsToFetch = PROPS_SPORTS.filter(s =>
            !enabledSports || enabledSports.includes(PROPS_NAME_MAP[s])
          );
          if (propsToFetch.length > 0) {
            const allProps = [];
            for (const sportKey of propsToFetch) {
              try {
                const props = await fetchPlayerProps(sportKey);
                allProps.push(...props);
              } catch (e) {
                console.warn('Props fetch failed for ' + sportKey + ':', e.message);
              }
            }
            setPlayerProps(prev =>
              isInitial
                ? allProps
                : [
                    ...prev.filter(p => !propsToFetch.some(s => p.sport === s || p.id?.startsWith(s))),
                    ...allProps,
                  ]
            );
          }

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
  }, [fetchOdds, fetchScores, fetchInjuries, fetchPlayerProps, getSportsToFetch, enabledSports, refreshInterval, setGameLineHistory, setHistoricOdds]);

  // Initial load
  useEffect(() => {
        loadData(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
