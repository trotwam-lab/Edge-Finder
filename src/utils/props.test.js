import { describe, expect, it } from 'vitest';
import {
  aggregatePlayerProps, priceEdgeCents, formatPropPick, getPropSideLabel,
  getMarketDisplayName, getBookAbbreviation, getBookDisplayName, buildPropAlerts,
  scorePropCandidate,
} from './props.js';

const base = { sport: 'americanfootball_nfl', game: 'Bills @ Dolphins', gameId: 'g1', player: 'Josh Allen', market: 'passing_yards' };
const row = (book, outcome, line, price, extra = {}) => ({ ...base, book, outcome, line, price, ...extra });

describe('priceEdgeCents', () => {
  it('measures edge across the +/-100 boundary in cents', () => {
    expect(priceEdgeCents(105, -105)).toBe(10);
    expect(priceEdgeCents(-105, -110)).toBe(5);
    expect(priceEdgeCents(120, 110)).toBe(10);
    expect(priceEdgeCents(null, -110)).toBeNull();
  });
});

describe('aggregatePlayerProps', () => {
  const [player] = aggregatePlayerProps([
    row('Fanduel', 'Over', 245.5, -115), row('Fanduel', 'Under', 245.5, -105),
    row('Draftkings', 'Over', 245.5, 105), row('Draftkings', 'Under', 245.5, -125),
    row('Betmgm', 'Over', 249.5, -110), row('Betmgm', 'Under', 249.5, -110),
    // An alt-ladder rung FanDuel prices far from a coin flip.
    row('Fanduel', 'Over', 199.5, -400),
  ]);
  const mkt = player.markets.passing_yards;

  it('picks the consensus line from each book\'s balanced main line', () => {
    expect(mkt.line).toBe(245.5);
    expect(mkt.mainLines.sort()).toEqual([245.5, 245.5, 249.5]);
    expect(mkt.insights.lineRange).toBe(4);
  });

  it('keeps off-consensus prices out of best price and fair value', () => {
    expect(mkt.over).toEqual({ Draftkings: 105, Fanduel: -115 });
    expect(mkt.cells.over.Betmgm).toEqual({ price: -110, line: 249.5, alt: true });
    expect(mkt.insights.bestOver).toBe(105);
    expect(mkt.insights.bestOverBook).toBe('Draftkings');
  });

  it('supports lineless Yes/No markets', () => {
    const [p] = aggregatePlayerProps([
      row('Fanduel', 'Yes', null, 150, { market: 'touchdowns' }),
      row('Draftkings', 'Yes', undefined, 160, { market: 'touchdowns' }),
      row('Draftkings', 'No', undefined, -200, { market: 'touchdowns' }),
    ]);
    const td = p.markets.touchdowns;
    expect(td.yesNo).toBe(true);
    expect(td.line).toBeNull();
    expect(td.over).toEqual({ Draftkings: 160, Fanduel: 150 });
    expect(formatPropPick(td, 'over')).toBe('Yes');
    expect(getPropSideLabel(td, 'under')).toBe('No');
  });

  it('ignores rows without a usable side or price', () => {
    expect(aggregatePlayerProps([row('Fanduel', 'Prop', 1, -110), row('Fanduel', 'Over', 1, null)])).toEqual([]);
  });
});

describe('labels', () => {
  it('formats market names including period-scoped markets', () => {
    expect(getMarketDisplayName('player_points')).toBe('PTS');
    expect(getMarketDisplayName('points_1q')).toBe('PTS 1Q');
    expect(getMarketDisplayName('threePointersMade')).toBe('3PM');
    expect(getMarketDisplayName('foo_barBaz')).toBe('FOO BAR BAZ');
  });

  it('resolves book names across API spellings', () => {
    expect(getBookAbbreviation('Fanduel')).toBe('FD');
    expect(getBookAbbreviation('FanDuel')).toBe('FD');
    expect(getBookAbbreviation('hardrockbet')).toBe('HRB');
    expect(getBookDisplayName('Draftkings')).toBe('DraftKings');
    expect(getBookDisplayName('Some Book')).toBe('Some Book');
  });

  it('formats picks with and without a line', () => {
    expect(formatPropPick({ yesNo: false, line: 24.5 }, 'over')).toBe('Over 24.5');
    expect(formatPropPick({ yesNo: false, line: 24.5 }, 'under', 23.5)).toBe('Under 23.5');
  });
});

describe('ranking and alerts', () => {
  it('scores a well-covered market with a price edge', () => {
    const rows = ['A', 'B', 'C', 'D', 'E'].flatMap(book => [row(book, 'Over', 20.5, -110), row(book, 'Under', 20.5, -110)]);
    rows.push(row('F', 'Over', 20.5, 125), row('F', 'Under', 20.5, -145));
    const [p] = aggregatePlayerProps(rows);
    const result = scorePropCandidate({ marketKey: 'passing_yards', mkt: p.markets.passing_yards, timing: { key: 'pregame' } });
    expect(result.side).toBe('over');
    expect(result.bestPrice).toBe(125);
    expect(result.score).toBeGreaterThanOrEqual(20);

    const alerts = buildPropAlerts([{ ...p, sportMeta: { label: 'NFL' } }]);
    expect(alerts.some(a => a.type === 'value' && a.book === 'F')).toBe(true);
  });
});
