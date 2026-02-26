import { useState, useEffect, useCallback, useRef } from 'react';
import { SPORTS, BOOKMAKERS, SPORT_ESPN_MAP } from '../constants.js';

function usePersistentState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch { return defaultValue; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [key, state]);
  return [state, setState];
}

export { usePersistentState };

export function useOdds({ filter, enabledSports = null, refreshInterval: userInterval = 120 }) {
  const [games, setGames] = useState([]);
  const [playerProps, setPlayerProps] = useState([]);
  const [injuries, setInjuries] = useState({});
  const [historicOdds, setHistoricOdds] = usePersistentState('edgefinder_historic_openers', {});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isConnected, setIsConnected] = useState(true);
  const [sportLastUpdated, setSportLastUpdated] = useState({});
  const [propHistory, setPropHistory] = usePersistentState('edgefinder_prop_history', {});
  const [gameLineHistory, setGameLineHistory] = usePersistentState('edgefinder_game_lines', {});
  const rotationIndexRef = useRef(0);

  // Determine refresh interval: if any game is live and user hasn't set something faster, use 60s
  const hasLiveGame = games.some(g => new Date(g.commence_time) < new Date() && !g.completed);
  const liveInterval = hasLiveGame ? Math.min(60, userInterval) : userInterval;
  const refreshInterval = liveInterval;

  const [countdown, setCountdown] = useState(refreshInterval);

  // Keep countdown in sync when refreshInterval changes
  useEffect(() => {
    setCountdown(prev => Math.min(prev, refreshInterval));
  }, [refreshInterval]);

  // Fetch odds via serverless function
  const fetchOdds = useCallback(async (sport) => {
    const res = await fetch(`/api/odds?sport=${sport}&markets=h2h,spreads,totals`);
    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    return res.json();
  }, []);

  // Fetch scores via serverless function
  const fetchScores = useCallback(async (sport) => {
    try {
      const res = await fetch(`/api/scores?sport=${sport}`);
      if (!res.ok) return [];
      return res.json();
    } catch { return []; }
  }, []);

  // Fetch injuries via serverless function
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

  // Fetch player props via dedicated props endpoint
  const fetchPlayerProps = useCallback(async (sport) => {
    try {
      const res = await fetch(`/api/props?sport=${sport}`);
      if (!res.ok) return [];
      const allProps = await res.json();
      return allProps.map(prop => ({ ...prop, book: prop.bookTitle || prop.bookKey }));
    } catch { return []; }
  }, []);

  // Smart refresh: determine which sports to fetch
  const getSportsToFetch = useCallback(() => {
    const allSports = Object.entries(SPORTS).filter(([name]) => !enabledSports || enabledSports.includes(name));

    if (filter && filter !== 'ALL') {
      // Single sport selected — only fetch that one
      const sportKey = SPORTS[filter];
      if (sportKey) return [[filter, sportKey]];
      // Try to match by sport_key
      const match = allSports.find(([, v]) => v.includes(filter.toLowerCase()));
      if (match) return [match];
      return allSports.slice(0, 3);
    }

    // ALL selected — rotate through 3-4 sports per cycle
    const batchSize = 4;
    const start = rotationIndexRef.current % allSports.length;
    const batch = [];
    for (let i = 0; i < batchSize; i++) {
      batch.push(allSports[(start + i) % allSports.length]);
    }
    rotationIndexRef.current += batchSize;
    return batch;
  }, [filter, enabledSports]);

  // Load data
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setError(null);

    try {
      const sportsToFetch = isInitial
        ? Object.entries(SPORTS).filter(([name]) => !enabledSports || enabledSports.includes(name))
        : getSportsToFetch();

      const newGames = [];
      const allInjuryList = [];

      for (const [sportName, sportKey] of sportsToFetch) {
        try {
          const [oddsData, scoresData, injuryData] = await Promise.all([
            fetchOdds(sportKey),
            fetchScores(sportKey),
            fetchInjuries(sportKey),
          ]);

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
          allInjuryList.push(...injuryData);
          setSportLastUpdated(prev => ({ ...prev, [sportName]: Date.now() }));
        } catch (e) {
          console.warn(`Failed ${sportName}:`, e.message);
        }
      }

      // Fetch player props for major sports
      const propsSports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb'];
      const fetchedSportKeys = sportsToFetch.map(([, key]) => key);
      const propsToFetch = propsSports.filter(s => fetchedSportKeys.includes(s));

      if (propsToFetch.length > 0) {
        const allProps = [];
        for (const sportKey of propsToFetch) {
          const props = await fetchPlayerProps(sportKey);
          allProps.push(...props);
        }
        if (allProps.length > 0 || isInitial) {
          setPlayerProps(prev => isInitial ? allProps : [...prev.filter(p => !propsToFetch.some(s => p.id?.startsWith(s))), ...allProps]);
        }
      }

      // Merge new games with existing (replace by id, keep others)
      setGames(prev => {
        if (isInitial) return newGames;
        const updated = new Map(prev.map(g => [g.id, g]));
        newGames.forEach(g => updated.set(g.id, g));
        return Array.from(updated.values());
      });

      // Injuries - scoped by sport to avoid team name collisions
      const injuriesByTeam = {};
      allInjuryList.forEach(inj => {
        const keys = [inj.team, inj.team?.toLowerCase(), inj.teamShort, inj.teamShort?.toLowerCase()].filter(Boolean);
        keys.forEach(key => {
          if (!injuriesByTeam[key]) injuriesByTeam[key] = [];
          injuriesByTeam[key].push(inj);
        });
      });
      setInjuries(prev => isInitial ? injuriesByTeam : { ...prev, ...injuriesByTeam });

      // Auto-capture opening lines: first time we see a game, save its odds as the opener
      newGames.forEach(game => {
        setHistoricOdds(prev => {
          if (prev[game.id]) return prev; // Already have opener for this game
          const spread = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')?.outcomes?.find(o => o.name === game.home_team)?.point;
          const total = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals')?.outcomes?.[0]?.point;
          const h2h = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h')?.outcomes;
          if (spread == null && total == null) return prev;
          return {
            ...prev,
            [game.id]: {
              spread, total,
              h2h: h2h?.map(o => ({ name: o.name, price: o.price })) || [],
              capturedAt: new Date().toISOString(),
              book: game.bookmakers?.[0]?.title,
            }
          };
        });
      });

      // Track game line history — use consensus best line across all books for accuracy
      newGames.forEach(game => {
        // Use consensus across all bookmakers for more accurate line tracking
        const allSpreads = [];
        const allTotals = [];
        game.bookmakers?.forEach(book => {
          const spreadOutcome = book.markets?.find(m => m.key === 'spreads')?.outcomes?.find(o => o.name === game.home_team);
          if (spreadOutcome) allSpreads.push(spreadOutcome.point);
          const totalOutcome = book.markets?.find(m => m.key === 'totals')?.outcomes?.[0];
          if (totalOutcome) allTotals.push(totalOutcome.point);
        });

        // Use the median line for more accurate tracking (less susceptible to outlier books)
        const median = (arr) => {
          if (arr.length === 0) return undefined;
          const sorted = [...arr].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };

        const spreadMedian = median(allSpreads);
        const totalMedian = median(allTotals);

        if (spreadMedian !== undefined || totalMedian !== undefined) {
          setGameLineHistory(prev => {
            const history = prev[game.id] || [];
            const entry = {
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              timestamp: Date.now(),
              spread: spreadMedian,
              total: totalMedian,
              book: 'Consensus',
              numBooks: game.bookmakers?.length || 0,
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
  useEffect(() => { loadData(true); }, []);

  // Countdown + auto refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { loadData(false); return refreshInterval; }
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
    games, playerProps, injuries, historicOdds,
    loading, error, lastUpdate, isConnected, countdown,
    gameLineHistory, propHistory, sportLastUpdated,
    manualRefresh, setGameLineHistory,
  };
}
