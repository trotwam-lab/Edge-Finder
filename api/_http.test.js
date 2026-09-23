import { describe, expect, it, beforeEach } from 'vitest';
import { guardRequest, isAllowedOrigin, resetRateLimits } from './_http.js';

function fakeRes() {
  const res = { headers: {}, statusCode: 200, body: null, ended: false };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => { res.ended = true; return res; };
  return res;
}

beforeEach(() => resetRateLimits());

describe('isAllowedOrigin', () => {
  it('allows EdgeFinder sites, previews and local dev only', () => {
    expect(isAllowedOrigin('https://www.edgefinderdaily.com')).toBe(true);
    expect(isAllowedOrigin('https://edge-finder-git-main-wambots-projects.vercel.app')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    expect(isAllowedOrigin('capacitor://localhost')).toBe(true);
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin('https://edgefinderdaily.com.evil.example')).toBe(false);
    expect(isAllowedOrigin(undefined)).toBe(false);
  });
});

describe('guardRequest', () => {
  const req = (extra = {}) => ({ method: 'GET', headers: { 'x-forwarded-for': '1.2.3.4', ...extra.headers }, ...extra });

  it('echoes allowed origins and omits CORS for others', () => {
    const ok = fakeRes();
    expect(guardRequest(req({ headers: { origin: 'https://www.edgefinderdaily.com' } }), ok)).toBe(false);
    expect(ok.headers['Access-Control-Allow-Origin']).toBe('https://www.edgefinderdaily.com');

    const other = fakeRes();
    guardRequest(req({ headers: { origin: 'https://evil.example' } }), other);
    expect(other.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('answers preflight requests', () => {
    const res = fakeRes();
    expect(guardRequest(req({ method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }), res)).toBe(true);
    expect(res.statusCode).toBe(204);
  });

  it('rate limits per route and IP', () => {
    for (let i = 0; i < 3; i += 1) expect(guardRequest(req(), fakeRes(), { route: 'r', rateLimit: 3 })).toBe(false);
    const limited = fakeRes();
    expect(guardRequest(req(), limited, { route: 'r', rateLimit: 3 })).toBe(true);
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers['Retry-After'])).toBeGreaterThan(0);
    // A different IP or route has its own window.
    expect(guardRequest(req({ headers: { 'x-forwarded-for': '5.6.7.8' } }), fakeRes(), { route: 'r', rateLimit: 3 })).toBe(false);
    expect(guardRequest(req(), fakeRes(), { route: 'other', rateLimit: 3 })).toBe(false);
  });
});
