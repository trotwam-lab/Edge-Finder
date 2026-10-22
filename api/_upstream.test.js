import { describe, expect, it, vi, beforeEach } from 'vitest';
import { burstBackoffActive, coalescedJson, resetUpstreamState } from './_upstream.js';

const json = (status, body, headers = {}) => {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
  res.clone = () => res;
  return res;
};

describe('coalescedJson', () => {
  beforeEach(() => resetUpstreamState());

  it('retries a burst 429 and returns the data instead of failing the sport', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(json(429, { error_code: 'EXCEEDED_FREQ_LIMIT' }))
      .mockResolvedValueOnce(json(200, [{ id: 'g1' }]));
    const result = await coalescedJson('https://x/odds', 1000, { retryDelays: [1, 1] });
    expect(result).toEqual({ ok: true, status: 200, data: [{ id: 'g1' }] });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(burstBackoffActive()).toBe(false);
  });

  it('gives up after the retries and arms the burst backoff', async () => {
    global.fetch = vi.fn(async () => json(429, { error_code: 'EXCEEDED_FREQ_LIMIT' }));
    const result = await coalescedJson('https://x/odds', 1000, { retryDelays: [1, 1] });
    expect(result.status).toBe(429);
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(burstBackoffActive()).toBe(true);
  });

  it('does not retry when the plan is out of credits', async () => {
    global.fetch = vi.fn(async () => json(429, { error_code: 'OUT_OF_USAGE_CREDITS' }));
    await coalescedJson('https://x/odds', 1000, { retryDelays: [1, 1] });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('shares one in-flight call between concurrent callers', async () => {
    global.fetch = vi.fn(async () => json(200, []));
    await Promise.all([coalescedJson('https://x/a'), coalescedJson('https://x/a')]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
