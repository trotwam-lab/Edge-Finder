import { defineConfig } from 'vitest/config';

// Bet dates are calendar days in the user's timezone; pin a US zone so the
// tests exercise the UTC-vs-local edge that used to shift bets a day.
process.env.TZ = 'America/New_York';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'api/**/*.test.js'],
  },
});
