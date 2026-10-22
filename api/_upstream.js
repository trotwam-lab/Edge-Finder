// api/_upstream.js — shared upstream fetch discipline for The Odds API routes.
//
// The plan's monthly credits are plentiful (see usage dashboard) but the API
// rate-limits bursts (about 30 requests/second): when the client fans out over
// dozens of sports at once, simultaneous upstream calls come back 429 even
// with most of the quota unused. Three defenses, all scoped to a function
// instance:
//
//   1. Coalescing — concurrent requests for the same upstream URL share one
//      in-flight fetch instead of racing each other.
//   2. Retry — a 429 is a "slow down", not "no data": the provider's own
//      guidance is to retry after a moment, so each call gets two jittered
//      retries before giving up. Without this a burst left whole sports
//      missing from the board until the next refresh.
//   3. Burst backoff — if the retries still 429, pause upstream calls briefly
//      (bursts clear in seconds, not minutes) and let callers serve stale cache.

const inflight = new Map();
let backoffUntil = 0;

// Delays before each retry. Jitter spreads simultaneous retries from parallel
// instances so they don't re-collide on the same second.
const RETRY_DELAYS_MS = [700, 1500];
const MAX_RETRY_AFTER_MS = 3000;

export function burstBackoffActive() {
  return Date.now() < backoffUntil;
}

export function startBurstBackoff(ms = 30 * 1000) {
  backoffUntil = Math.max(backoffUntil, Date.now() + ms);
}

export function resetUpstreamState() {
  inflight.clear();
  backoffUntil = 0;
}

function retryDelay(res, attempt, delays) {
  const retryAfter = Number(res.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
  const base = delays[attempt] ?? delays[delays.length - 1] ?? 0;
  return base + Math.floor(Math.random() * base * 0.5);
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// The provider also answers 429 when the plan's credits are used up; retrying
// that only burns time, so those stop immediately.
async function isQuotaExhausted(res) {
  try {
    const body = await res.clone().json();
    return /usage|credit|quota/i.test(String(body?.error_code || body?.code || ''));
  } catch {
    return false;
  }
}

/**
 * Fetch JSON with coalescing and 429 retries. Returns { ok, status, data }.
 * A 429 that survives the retries arms the burst backoff.
 */
export async function coalescedJson(url, timeoutMs = 10000, { retryDelays = RETRY_DELAYS_MS } = {}) {
  if (inflight.has(url)) return inflight.get(url);
  const p = (async () => {
    let res;
    for (let attempt = 0; ; attempt += 1) {
      res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.status !== 429 || attempt >= retryDelays.length) break;
      if (await isQuotaExhausted(res)) break;
      await wait(retryDelay(res, attempt, retryDelays));
    }
    if (res.status === 429) startBurstBackoff();
    const data = res.ok ? await res.json() : null;
    return { ok: res.ok, status: res.status, data };
  })().finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}
