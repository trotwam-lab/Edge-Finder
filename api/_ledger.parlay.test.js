import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeFirestore } from '../tests/helpers/fakeFirestore.js';
import {
  gradePendingEvents, loadEvents, recordParlay, sanitizeParlayClaim, updateLedgerCloses, voidBet,
} from './_ledger.js';
import { probIndexKey } from './_receipts.js';
import { closingEvPct, computeLedgerStats, verifyChain } from '../src/utils/ledger.js';
import handler from './verified-bets.js';

const NOW = Date.parse('2026-10-08T18:00:00Z');
const game = (id, home, away, start, homeMl, awayMl, spread = -3.5) => ({
  id, home_team: home, away_team: away, commence_time: start,
  bookmakers: ['draftkings', 'fanduel'].map((key, i) => ({
    key, title: key,
    markets: [
      { key: 'h2h', outcomes: [{ name: home, price: homeMl + i * 5 }, { name: away, price: awayMl - i * 5 }] },
      { key: 'spreads', outcomes: [{ name: home, point: spread, price: -110 }, { name: away, point: -spread, price: -110 }] },
    ],
  })),
});
const nba = [
  game('g1', 'Boston Celtics', 'New York Knicks', '2026-10-08T23:00:00Z', -150, 130),
  game('g2', 'Miami Heat', 'Chicago Bulls', '2026-10-09T00:00:00Z', 120, -140),
];
const nhl = [game('h1', 'Boston Bruins', 'Toronto Maple Leafs', '2026-10-08T23:30:00Z', -120, 100, -1.5)];
const gamesBySport = new Map([['basketball_nba', nba], ['icehockey_nhl', nhl]]);

const legs = [
  { gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'Boston Celtics', odds: -145 },
  { gameId: 'g2', sportKey: 'basketball_nba', marketKey: 'spreads', outcomeName: 'Chicago Bulls', outcomePoint: 3.5, odds: -110 },
  { gameId: 'h1', sportKey: 'icehockey_nhl', marketKey: 'h2h', outcomeName: 'Toronto Maple Leafs', odds: 100 },
];
const claim = (over = {}) => sanitizeParlayClaim({ clientBetId: '5001', wager: 20, legs, ...over });

async function recorded() {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const db = createFakeFirestore();
  await recordParlay(db, 'u1', claim().claim, gamesBySport);
  return db;
}

afterEach(() => vi.useRealTimers());

describe('parlay claims', () => {
  it('needs 2–10 valid legs from different games', () => {
    expect(claim({ legs: [legs[0]] }).error).toMatch(/2–10 legs/);
    expect(claim({ legs: [legs[0], { ...legs[0], outcomeName: 'New York Knicks' }] }).error).toMatch(/Same-game/);
    expect(claim({ legs: [legs[0], { ...legs[1], outcomePoint: null }] }).error).toMatch(/^Leg 2:/);
    expect(claim({ legs: [legs[0], { ...legs[1], sportKey: 'soccer_epl' }] }).error).toMatch(/^Leg 2:/);
    expect(claim().claim.legs).toHaveLength(3);
  });
});

describe('recording parlays', () => {
  it('checks every leg, prices the parlay itself, and indexes each leg', async () => {
    const db = await recorded();
    const [event] = await loadEvents(db, 'u1');
    expect(event).toMatchObject({ type: 'parlay', commenceTime: '2026-10-08T23:00:00.000Z' });
    // Leg 1 claimed -145, but the best on the board is -145 (fanduel): kept.
    expect(event.legs.map(l => l.odds)).toEqual([-145, -110, 100]);
    expect(event.parlayDecimal).toBeCloseTo(1.6897 * 1.9091 * 2, 3);
    expect(event.odds).toBe(545);
    expect(event.private.stake.wager).toBe(20);
    for (let i = 0; i < 3; i += 1) expect(db.store.has(`ledger_open/u1__b_5001~${i}`)).toBe(true);
    expect(await verifyChain(await loadEvents(db, 'u1'))).toMatchObject({ valid: true });
  });

  it('records a too-good leg price at the market price', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    const { event } = await recordParlay(db, 'u1', claim({ legs: [{ ...legs[0], odds: 300 }, legs[1]] }).claim, gamesBySport);
    expect(event.legs[0]).toMatchObject({ odds: -145, claimedOdds: 300, priceAdjusted: true });
  });

  it('rejects the whole parlay when any leg is off the board or started', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    await expect(recordParlay(db, 'u1', claim({ legs: [legs[0], { ...legs[1], outcomePoint: 7.5 }] }).claim, gamesBySport))
      .rejects.toMatchObject({ reason: 'line_not_offered', message: expect.stringMatching(/^Leg 2:/) });
    vi.setSystemTime(Date.parse('2026-10-08T23:10:00Z')); // g1 has started
    await expect(recordParlay(db, 'u1', claim().claim, gamesBySport)).rejects.toMatchObject({ reason: 'game_started' });
    expect(await loadEvents(db, 'u1')).toHaveLength(0);
  });

  it('voids (pregame, within 10 minutes) and stops tracking every leg', async () => {
    const db = await recorded();
    await voidBet(db, 'u1', '5001');
    for (let i = 0; i < 3; i += 1) expect(db.store.has(`ledger_open/u1__b_5001~${i}`)).toBe(false);
    const events = await loadEvents(db, 'u1');
    expect(events[1]).toMatchObject({ type: 'void', legCount: 3 });
    expect(computeLedgerStats(events)).toMatchObject({ total: 0, voided: 1 });
  });
});

describe('parlay closes and grading', () => {
  it('records a no-vig close per leg and values the parlay at the close', async () => {
    const db = await recorded();
    const index = new Map([
      [probIndexKey('g1', 'h2h', 'Boston Celtics', null), { fairProb: 0.6, bestPrice: -145 }],
      [probIndexKey('g2', 'spreads', 'Chicago Bulls', 3.5), { fairProb: 0.5, bestPrice: -110 }],
      [probIndexKey('h1', 'h2h', 'Toronto Maple Leafs', null), { fairProb: 0.45, bestPrice: 100 }],
    ]);
    expect(await updateLedgerCloses(db, index, NOW)).toMatchObject({ updated: 3 });
    const [event] = await loadEvents(db, 'u1');
    expect(Object.keys(event.derived.legCloses)).toHaveLength(3);
    expect(closingEvPct(event)).toBeCloseTo((1.6897 * 0.6 * 1.9091 * 0.5 * 2 * 0.45 - 1) * 100, 1);
  });

  const row = (id, home, away, start, hs, as) => ({ id, home_team: home, away_team: away, commence_time: start, completed: true, scores: [{ name: home, score: String(hs) }, { name: away, score: String(as) }] });

  it('loses as soon as one leg loses', async () => {
    const db = await recorded();
    const rows = { basketball_nba: [row('g1', 'Boston Celtics', 'New York Knicks', '2026-10-08T23:00:00Z', 90, 100)], icehockey_nhl: [] };
    const fetchRows = async sport => rows[sport];
    await gradePendingEvents(db, 'u1', await loadEvents(db, 'u1'), fetchRows, Date.parse('2026-10-09T02:00:00Z'));
    const [event] = await loadEvents(db, 'u1');
    expect(event.derived.legGrades[0].result).toBe('lost');
    expect(event.derived.grade).toMatchObject({ result: 'lost' });
    expect(computeLedgerStats([event])).toMatchObject({ losses: 1, flatUnits: -1 });
  });

  it('pays the reduced price when a leg pushes, once every leg is final', async () => {
    const db = await recorded();
    const rows = {
      basketball_nba: [
        row('g1', 'Boston Celtics', 'New York Knicks', '2026-10-08T23:00:00Z', 110, 100),
        row('g2', 'Miami Heat', 'Chicago Bulls', '2026-10-09T00:00:00Z', 103, 100), // Bulls +3.5 cover
      ],
      icehockey_nhl: [],
    };
    const fetchRows = async sport => rows[sport];
    const t1 = Date.parse('2026-10-09T03:00:00Z');
    await gradePendingEvents(db, 'u1', await loadEvents(db, 'u1'), fetchRows, t1);
    let [event] = await loadEvents(db, 'u1');
    expect(event.derived.legGrades[0].result).toBe('won');
    expect(event.derived.grade).toBeUndefined(); // hockey leg still undecided

    rows.icehockey_nhl = [row('h1', 'Boston Bruins', 'Toronto Maple Leafs', '2026-10-08T23:30:00Z', 2, 2)]; // tie → push
    await gradePendingEvents(db, 'u1', await loadEvents(db, 'u1'), fetchRows, t1);
    [event] = await loadEvents(db, 'u1');
    expect(event.derived.legGrades[2].result).toBe('push');
    expect(event.derived.grade).toMatchObject({ result: 'won' });
    expect(event.derived.grade.effectiveDecimal).toBeCloseTo(1.6897 * 1.9091, 3);
    expect(computeLedgerStats([event]).flatUnits).toBeCloseTo(1.6897 * 1.9091 - 1, 2);
  });
});

describe('verified-bets route with parlays', () => {
  it('records a parlay through the API', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    const r = { headers: {}, statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, end() { return this; } };
    const loadSportOdds = vi.fn(async sport => ({ ok: true, data: gamesBySport.get(sport) }));
    await handler(
      { method: 'POST', query: {}, body: { action: 'record', bet: { clientBetId: '7', wager: 10, legs } }, headers: { 'x-forwarded-for': '10.9.9.9' } },
      r,
      { db, getVerifiedUser: async () => ({ uid: 'u1' }), loadSportOdds, fetchScoreRows: async () => [] },
    );
    expect(r.statusCode).toBe(200);
    expect(r.body).toMatchObject({ verified: true, event: { type: 'parlay', odds: 545 } });
    expect(loadSportOdds).toHaveBeenCalledTimes(2); // one fetch per sport
  });
});
