import { useEffect, useState } from 'react';
import { auth } from '../firebase.js';

const EXTRA_KEYS = ['f5_spreads', 'team_totals', 'nrfi'];
const SUPPORTED_SPORTS = new Set(['baseball_mlb']);

function feedHasExtras(game) {
  return (game?.bookmakers || []).some(book => book.markets?.some(m => EXTRA_KEYS.includes(m.key)));
}

// Loads first-five run lines, team totals and NRFI for an opened MLB game
// when the main odds feed doesn't carry them (The Odds API only serves them
// per event). Returns { game, status } where `game` has the extra markets
// merged into its bookmakers and status is idle | loading | done | error.
export function useGameExtraMarkets(game) {
  const needsFetch = SUPPORTED_SPORTS.has(game?.sport_key) && Boolean(game?.id) && !feedHasExtras(game);
  const [state, setState] = useState({ id: null, bookmakers: [], status: 'idle' });

  useEffect(() => {
    if (!needsFetch) return undefined;
    let cancelled = false;
    setState({ id: game.id, bookmakers: [], status: 'loading' });
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken?.().catch(() => null);
        const res = await fetch(
          `/api/game-markets?sport=${encodeURIComponent(game.sport_key)}&eventId=${encodeURIComponent(game.id)}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        );
        const json = res.ok ? await res.json() : null;
        if (!cancelled) setState({ id: game.id, bookmakers: json?.bookmakers || [], status: res.ok ? 'done' : 'error' });
      } catch {
        if (!cancelled) setState({ id: game.id, bookmakers: [], status: 'error' });
      }
    })();
    return () => { cancelled = true; };
  }, [needsFetch, game?.id, game?.sport_key]);

  if (!needsFetch) return { game, status: feedHasExtras(game) ? 'done' : 'idle' };
  if (state.id !== game.id || state.status === 'loading') return { game, status: 'loading' };
  return { game: { ...game, bookmakers: mergeBookmakers(game.bookmakers || [], state.bookmakers) }, status: state.status };
}

// Adds fetched markets onto matching books, appending books the feed lacks.
export function mergeBookmakers(base, extra) {
  const merged = base.map(book => ({ ...book, markets: [...(book.markets || [])] }));
  extra.forEach(book => {
    const target = merged.find(b => b.key === book.key);
    if (target) target.markets.push(...(book.markets || []));
    else merged.push({ ...book, markets: [...(book.markets || [])] });
  });
  return merged;
}
