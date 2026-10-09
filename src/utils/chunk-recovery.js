// src/utils/chunk-recovery.js
// After a deploy, a phone holding the previous build asks for tab code files
// that no longer exist, and a flaky connection can drop a code file mid-load.
// Either way the dynamic import() rejects. These helpers retry once, then heal
// by refreshing the app's cached files and reloading — at most once per
// window, so a genuinely broken build can never put the app in a reload loop.

const CHUNK_ERROR_RE = /dynamically imported module|importing a module script failed|loading (css )?chunk .* failed|unable to preload css|failed to fetch dynamically/i;
const RELOAD_KEY = 'edgefinder_chunk_reload_at';
const RELOAD_WINDOW_MS = 60 * 1000;

export function isChunkLoadError(error) {
  return CHUNK_ERROR_RE.test(String(error?.message || error || ''));
}

// import() with one quick retry for transient network failures.
export function importWithRetry(loader, delayMs = 600) {
  return loader().catch(async (error) => {
    if (!isChunkLoadError(error)) throw error;
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return loader();
  });
}

function recentlyReloaded(now = Date.now()) {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_KEY));
    return Number.isFinite(at) && at > 0 && now - at < RELOAD_WINDOW_MS;
  } catch {
    return true; // can't remember → don't risk a loop
  }
}

// Drops the service worker + its caches (they may be pinning the old build),
// then reloads. Returns false when a reload already happened moments ago.
export async function recoverFromStaleBuild() {
  if (recentlyReloaded()) return false;
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch {}
  const cleanup = (async () => {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((registrations || []).map(r => r.unregister()));
      const keys = await globalThis.caches?.keys?.();
      await Promise.all((keys || []).map(k => globalThis.caches.delete(k)));
    } catch {}
  })();
  // Never let cleanup hold the reload hostage.
  await Promise.race([cleanup, new Promise(resolve => setTimeout(resolve, 1500))]);
  window.location.reload();
  return true;
}
