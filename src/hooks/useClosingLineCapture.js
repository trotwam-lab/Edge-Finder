import { useEffect } from 'react';

// Find the current live quote for a bet's market/outcome in the games feed.
// Returns null if anything is missing. We match line markets by outcome name
// first so a moved spread/total can still be captured as CLV.
function findLiveQuote(games, bet) {
  if (!bet?.gameId || !bet?.marketKey || !bet?.outcomeName) return null;
  const game = games?.find(g => g.id === bet.gameId);
  if (!game) return null;
  const book = bet.book
    ? game.bookmakers?.find(b => b.key === bet.book) || game.bookmakers?.[0]
    : game.bookmakers?.[0];
  const market = book?.markets?.find(m => m.key === bet.marketKey);
  if (!market) return null;
  const outcome = market.outcomes?.find(o => o.name === bet.outcomeName);
  if (!outcome) return null;
  return {
    price: outcome.price ?? null,
    point: outcome.point ?? null,
    book: book?.key ?? null,
    capturedAt: Date.now(),
  };
}

/**
 * useClosingLineCapture — app-level CLV auto-capture.
 *
 * For every pending bet whose market we can identify, track the latest
 * pre-game price on each odds refresh and, once the game starts (or drops off
 * the feed), snapshot the last seen pre-game number as the closing line. Also
 * backfills opening odds from historicOdds when a capture exists.
 *
 * This used to live inside BetTracker, which meant it only ran while the
 * Tracker tab was mounted — if the user was on any other tab (or away) when a
 * game kicked off, the close was never captured. Running it here, off the same
 * odds feed the whole app shares, captures closes no matter which tab is open.
 */
export function useClosingLineCapture(bets, setBets, games, historicOdds) {
  useEffect(() => {
    if (!games?.length || !bets?.length) return;
    const now = Date.now();
    // Build a patch map keyed by bet id. We apply it via a functional setBets
    // so we never overwrite a newer bets array (e.g. a bet the user just added
    // while the odds feed was refreshing).
    const patches = new Map();
    bets.forEach(bet => {
      if (bet.deleted) return;
      if (!bet.gameId || !bet.marketKey) return;
      const patch = {};

      // Backfill opening odds from historicOdds once we have a capture.
      if (bet.openingOdds == null && bet.marketKey === 'h2h' && bet.outcomeName) {
        const opener = historicOdds?.[bet.gameId]?.h2h?.find(o => o.name === bet.outcomeName);
        if (opener?.price != null) patch.openingOdds = opener.price;
      }

      if ((bet.closingOdds == null || bet.closingPoint == null) && bet.status === 'pending') {
        const liveQuote = findLiveQuote(games, bet);
        const commence = bet.commenceTime ? new Date(bet.commenceTime).getTime() : null;
        const gameStillListed = games.some(g => g.id === bet.gameId);

        if (liveQuote && commence && now < commence) {
          if (liveQuote.price != null && bet.lastPreGameOdds !== liveQuote.price) {
            patch.lastPreGameOdds = liveQuote.price;
            patch.lastPreGameAt = now;
          }
          if (liveQuote.point != null && bet.lastPreGamePoint !== liveQuote.point) {
            patch.lastPreGamePoint = liveQuote.point;
            patch.lastPreGameAt = now;
          }
        } else if (commence && now >= commence) {
          const closingOdds = bet.lastPreGameOdds ?? liveQuote?.price;
          const closingPoint = bet.lastPreGamePoint ?? liveQuote?.point;
          if (closingOdds != null && bet.closingOdds == null) {
            patch.closingOdds = closingOdds;
            patch.closingCapturedAt = now;
          }
          if (closingPoint != null && bet.closingPoint == null) {
            patch.closingPoint = closingPoint;
            patch.closingCapturedAt = now;
          }
        } else if (!gameStillListed && (bet.lastPreGameOdds != null || bet.lastPreGamePoint != null)) {
          if (bet.closingOdds == null) patch.closingOdds = bet.lastPreGameOdds;
          if (bet.closingPoint == null && bet.lastPreGamePoint != null) patch.closingPoint = bet.lastPreGamePoint;
          if (patch.closingOdds != null || patch.closingPoint != null) patch.closingCapturedAt = now;
        }
      }

      if (Object.keys(patch).length) patches.set(bet.id, patch);
    });

    if (patches.size === 0) return;
    setBets(prev => {
      let changed = false;
      const next = prev.map(b => {
        const patch = patches.get(b.id);
        if (!patch) return b;
        const merged = { ...b };
        let touched = false;
        for (const [k, v] of Object.entries(patch)) {
          // A closing/opening number the user has filled in since this patch
          // was computed always wins over the auto-capture.
          if ((k === 'closingOdds' || k === 'closingPoint' || k === 'openingOdds') && merged[k] != null) continue;
          if (merged[k] !== v) { merged[k] = v; touched = true; }
        }
        if (!touched) return b;
        merged.updatedAt = now;
        changed = true;
        return merged;
      });
      return changed ? next : prev;
    });
    // `bets` is intentionally not a dependency: patches are recomputed on each
    // odds refresh from the render-fresh closure, and depending on `bets`
    // would re-run the effect on its own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, historicOdds]);
}

export default useClosingLineCapture;
