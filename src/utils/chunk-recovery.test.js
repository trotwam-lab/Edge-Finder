import { describe, expect, it, vi } from 'vitest';
import { importWithRetry, isChunkLoadError } from './chunk-recovery.js';

describe('chunk recovery', () => {
  it('recognises stale-build and dropped-connection import failures', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: /a.js'))).toBe(true);
    expect(isChunkLoadError(new Error('error loading dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
  });

  it('retries a failed import once, then succeeds', async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: 'ok' });
    await expect(importWithRetry(loader, 1)).resolves.toEqual({ default: 'ok' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not retry unrelated errors', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(importWithRetry(loader, 1)).rejects.toThrow('boom');
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
