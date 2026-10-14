// api/_sharedCache.js — optional cross-instance response cache in Firestore.
//
// Each serverless instance keeps its own in-memory cache, so cold starts and
// parallel instances each paid for their own upstream odds call. This stores
// the last good upstream payload (gzipped) in Firestore so every instance can
// reuse it. It is deliberately OPT-IN: normal board polling can easily spend
// the free Firestore read quota, and the verified-bet ledger shares that same
// database. When disabled, route-local memory and CDN caches continue to work.
// Enable only on a Firestore project with billing/quota sized for cache traffic
// by setting FIRESTORE_SHARED_CACHE_ENABLED=true.

import { gzipSync, gunzipSync } from 'node:zlib';
import { getAdminDb } from './_firebaseAdmin.js';

const COLLECTION = 'api_cache';
const MAX_BYTES = 900 * 1024; // Firestore documents cap at 1 MiB
const WRITE_TIMEOUT_MS = 1500;
const READ_TIMEOUT_MS = 800;

function docId(key) {
  return String(key).replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 400);
}

// A malformed service account makes getAdminDb() throw; treat that like
// "no shared cache" instead of failing the request.
function resolveDb(options) {
  if (options && 'db' in options) return options.db;
  if (process.env.FIRESTORE_SHARED_CACHE_ENABLED !== 'true') return null;
  try {
    return getAdminDb();
  } catch (error) {
    console.warn('Shared cache disabled:', error.message);
    return null;
  }
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]);
}

export function encodeEntry(entry) {
  const payload = gzipSync(Buffer.from(JSON.stringify(entry.data)));
  if (payload.length > MAX_BYTES) return null;
  return { payload, ts: entry.ts, ttl: entry.ttl ?? null };
}

export function decodeEntry(doc) {
  if (!doc?.payload || !Number.isFinite(doc.ts)) return null;
  const buffer = Buffer.isBuffer(doc.payload) ? doc.payload : Buffer.from(doc.payload.toUint8Array?.() ?? doc.payload);
  return { data: JSON.parse(gunzipSync(buffer).toString('utf8')), ts: doc.ts, ttl: doc.ttl ?? undefined };
}

// Returns { data, ts, ttl } or null. Never throws.
export async function readSharedCache(key, options) {
  const db = resolveDb(options);
  if (!db) return null;
  try {
    const snap = await withTimeout(db.collection(COLLECTION).doc(docId(key)).get(), READ_TIMEOUT_MS);
    if (!snap?.exists) return null;
    return decodeEntry(snap.data());
  } catch (error) {
    console.warn('Shared cache read failed:', error.message);
    return null;
  }
}

// Stores { data, ts, ttl }. Never throws; skips payloads too large to store.
export async function writeSharedCache(key, entry, options) {
  const db = resolveDb(options);
  if (!db) return false;
  try {
    const encoded = encodeEntry(entry);
    if (!encoded) return false;
    await withTimeout(db.collection(COLLECTION).doc(docId(key)).set(encoded), WRITE_TIMEOUT_MS);
    return true;
  } catch (error) {
    console.warn('Shared cache write failed:', error.message);
    return false;
  }
}

// Reconciles the per-instance cache with the shared one: returns whichever
// entry is newer (and stores it locally), or the local entry when the shared
// cache has nothing better.
export async function freshestEntry(localCache, key, options) {
  const local = localCache[key];
  const shared = await readSharedCache(key, options);
  if (shared && (!local || shared.ts > local.ts)) {
    localCache[key] = shared;
    return shared;
  }
  return local || null;
}

export function isFresh(entry, defaultTtl, now = Date.now()) {
  return Boolean(entry) && now - entry.ts < (entry.ttl ?? defaultTtl);
}
