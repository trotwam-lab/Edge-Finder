import { useEffect, useState } from 'react';

// Re-renders the calling component on a fixed cadence and returns the current
// timestamp. Keep this in small leaf components (countdowns, "updated Xs ago")
// so a ticking clock never forces the whole dashboard to re-render.
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer;
    // Align ticks to the interval boundary so every clock on screen (and the
    // minute-level "starts in 12m" labels) flips together instead of drifting.
    const schedule = () => {
      const delay = intervalMs - (Date.now() % intervalMs) + 5;
      timer = window.setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [intervalMs]);

  return now;
}
