import React, { useEffect, useState } from 'react';

// Self-ticking one-second clock. The odds hook exposes `nextRefreshAt` as a
// timestamp instead of a ticking counter, so the per-second re-render lives
// only inside these tiny text components — not the whole app tree.
function useNowTick(enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

// Header status text: "Updating..." | "Updated 12s ago" | "45s".
export function HeaderStatusText({ lastUpdate, nextRefreshAt, loading }) {
  const now = useNowTick(!loading);
  if (loading) return <>Updating...</>;
  if (lastUpdate) {
    const ago = Math.max(0, Math.round((now - lastUpdate.getTime()) / 1000));
    return <>Updated {ago}s ago</>;
  }
  const secs = Math.max(0, Math.ceil(((nextRefreshAt ?? now) - now) / 1000));
  return <>{secs}s</>;
}

// Bare seconds-remaining number for the Settings auto-refresh card.
export function RefreshCountdownSeconds({ nextRefreshAt }) {
  const now = useNowTick();
  return <>{Math.max(0, Math.ceil(((nextRefreshAt ?? now) - now) / 1000))}</>;
}
