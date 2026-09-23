// api/_http.js — shared request guard for the public API routes.
//
// CORS: browsers only get cross-origin access from EdgeFinder's own sites
// (production, Vercel previews, localhost dev, the Capacitor shell). Same-
// origin calls from the web app never needed CORS, so they are unaffected.
// Extra origins can be allowed with ALLOWED_ORIGINS (comma separated).
//
// Rate limit: a per-instance, per-IP fixed window. It will not stop a
// determined distributed scraper, but it stops a single client from looping
// on a route and burning the upstream odds quota.

const DEFAULT_ORIGIN_PATTERNS = [
  /^https:\/\/(www\.)?edgefinderdaily\.com$/,
  /^https:\/\/[a-z0-9-]+-wambots-projects\.vercel\.app$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^capacitor:\/\/localhost$/,
];

const WINDOW_MS = 60 * 1000;
const buckets = new Map();

function extraOrigins() {
  return String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (extraOrigins().includes(origin)) return true;
  return DEFAULT_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

export function clientIp(req) {
  const forwarded = req.headers?.['x-forwarded-for'];
  const first = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  return first || req.headers?.['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

// Returns { allowed, remaining, retryAfterSeconds }.
export function takeRateLimit(key, limit, now = Date.now()) {
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= WINDOW_MS) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (now - b.start >= WINDOW_MS) buckets.delete(k);
  }
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.start + WINDOW_MS - now) / 1000),
  };
}

export function resetRateLimits() {
  buckets.clear();
}

/**
 * Apply CORS + rate limiting. Returns true when it already answered the
 * request (preflight or 429) and the handler should return immediately.
 */
export function guardRequest(req, res, {
  route = 'api',
  methods = ['GET'],
  headers = ['Content-Type', 'Authorization', 'X-EdgeFinder-Email'],
  rateLimit = 300,
} = {}) {
  const origin = req.headers?.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
    res.setHeader('Access-Control-Allow-Headers', headers.join(', '));
  }
  if (req.method === 'OPTIONS') {
    res.status(isAllowedOrigin(origin) ? 204 : 403).end();
    return true;
  }

  const result = takeRateLimit(`${route}:${clientIp(req)}`, rateLimit);
  res.setHeader('X-RateLimit-Limit', String(rateLimit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    res.status(429).json({ error: 'Too many requests. Please slow down.' });
    return true;
  }
  return false;
}
