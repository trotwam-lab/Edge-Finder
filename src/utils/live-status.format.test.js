import { describe, expect, it } from 'vitest';
import { formatStartTime } from './live-status.js';

// The original implementation, kept here as the reference output.
function reference(value) {
  const t = Date.parse(value || '');
  if (!Number.isFinite(t)) return 'TBD';
  const date = new Date(t);
  return new Date().toDateString() === date.toDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

describe('formatStartTime', () => {
  it('matches the toLocale* output exactly, today and on other days', () => {
    const now = Date.now();
    const samples = [0, 5, 59, 61, 3 * 60, 11 * 60, 23 * 60, 26 * 60, 3 * 24 * 60, -90]
      .map(mins => new Date(now + mins * 60000).toISOString());
    samples.forEach(value => {
      expect(formatStartTime(value)).toBe(reference(value));
      expect(formatStartTime(value)).toBe(reference(value)); // cached path too
    });
  });

  it('keeps TBD for missing or bad times', () => {
    expect(formatStartTime(null)).toBe('TBD');
    expect(formatStartTime('not a date')).toBe('TBD');
  });
});

describe('getPropTimingState start label', () => {
  it('matches the old toLocaleString output for games more than 6 hours out', async () => {
    const { getPropTimingState } = await import('./props.js');
    [7, 30, 72].forEach(hours => {
      const commenceTime = new Date(Date.now() + hours * 3600e3).toISOString();
      const expected = new Date(commenceTime).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      expect(getPropTimingState({ commenceTime }).detail).toBe(expected);
    });
  });
  it('still says "Starts in" for games about to begin', async () => {
    const { getPropTimingState } = await import('./props.js');
    expect(getPropTimingState({ commenceTime: new Date(Date.now() + 20 * 60e3).toISOString() }).detail).toMatch(/^Starts in \d+m$/);
  });
});
