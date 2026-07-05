// api/_upstream.js — shared upstream fetch discipline for The Odds API routes.
//
// The plan's monthly credits are plentiful (see usage dashboard) but the API
// rate-limits bursts: when the client fans out over dozens of sports at once,
// simultaneous upstream calls come back 429 even with 88% of the quota unused.
// Two defenses, both scoped to a function instance:
//
//   1. Coalescing — concurrent requests for the same upstream URL share one
//      in-flight fetch instead of racing each other.
//   2. Burst backoff — after a 429, pause upstream calls briefly (bursts clear
//      in seconds, not minutes) and let callers serve stale cache.

const inflight = new Map();
let backoffUntil = 0;

export function burstBackoffActive() {
  return Date.now() < backoffUntil;
}

export function startBurstBackoff(ms = 30 * 1000) {
  backoffUntil = Math.max(backoffUntil, Date.now() + ms);
}

/**
 * Fetch JSON with coalescing. Returns { ok, status, data }.
 * A 429 automatically arms the burst backoff.
 */
export async function coalescedJson(url, timeoutMs = 10000) {
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (res.status === 429) startBurstBackoff();
    const data = res.ok ? await res.json() : null;
    return { ok: res.ok, status: res.status, data };
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}
