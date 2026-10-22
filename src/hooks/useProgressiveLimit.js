import { useCallback, useEffect, useState } from 'react';

// Long lists (the games board, the props board) render in chunks: the first
// screen paints immediately and the rest is added over the next frames, so
// opening a tab never freezes on hundreds of cards. Every item still renders —
// this only staggers when. `resetKey` restarts the stagger (new tab, new
// filter); data refreshes keep the current count so nothing collapses under
// the user's scroll position.
//
// Returns [limit, ensure]: render items [0, limit); call ensure(n) to make
// sure the first n are rendered right away (e.g. to scroll to one).
export function useProgressiveLimit(total, resetKey, { first = 24, step = 24 } = {}) {
  const [limit, setLimit] = useState(first);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    // Reset during render so the new view never paints the old full list.
    setKey(resetKey);
    setLimit(first);
  }

  useEffect(() => {
    if (limit >= total) return undefined;
    const grow = () => setLimit(current => current + step);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(grow, { timeout: 120 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(grow, 16);
    return () => window.clearTimeout(id);
  }, [limit, total, step]);

  const ensure = useCallback((count) => setLimit(current => Math.max(current, count)), []);
  return [Math.min(limit, total), ensure];
}
