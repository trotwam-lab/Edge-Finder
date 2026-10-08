import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeFirestore } from '../tests/helpers/fakeFirestore.js';
import { buildProbIndex } from './_consensus.js';
import { computeAnchor, ledgerIdFor, loadEvents, recordBet, sanitizeClaim } from './_ledger.js';
import { probIndexKey } from './_receipts.js';
import handler from './ledger-maintenance.js';

const NOW = Date.parse('2026-10-08T18:00:00Z');
const START = '2026-10-08T20:00:00Z';
const book = (key, home, away) => ({
  key, title: key,
  markets: [{ key: 'h2h', outcomes: [{ name: 'Boston Celtics', price: home }, { name: 'New York Knicks', price: away }] }],
});
const games = [{ id: 'g1', home_team: 'Boston Celtics', away_team: 'New York Knicks', commence_time: START,
  bookmakers: [book('draftkings', -150, 130), book('fanduel', -140, 120)] }];

const res = () => {
  const r = { headers: {}, statusCode: 200 };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  r.end = () => r;
  return r;
};
const req = (method, task, headers = {}) => ({ method, query: { task }, headers: { 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 200)}`, ...headers } });

afterEach(() => { vi.useRealTimers(); delete process.env.LEDGER_CRON_SECRET; });

describe('buildProbIndex', () => {
  it('builds the no-vig consensus for pregame games only', () => {
    const index = buildProbIndex(games, NOW);
    const home = index.get(probIndexKey('g1', 'h2h', 'Boston Celtics', null));
    const away = index.get(probIndexKey('g1', 'h2h', 'New York Knicks', null));
    expect(home.fairProb + away.fairProb).toBeCloseTo(1, 10);
    expect(home.bestPrice).toBe(-140);
    expect(buildProbIndex(games, Date.parse(START)).size).toBe(0);
    expect(buildProbIndex([{ ...games[0], bookmakers: [games[0].bookmakers[0]] }], NOW).size).toBe(0); // one book is not a consensus
  });
});

describe('ledger anchors', () => {
  async function seeded() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    const claim = (id, uid) => recordBet(db, uid, sanitizeClaim({ clientBetId: id, gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'Boston Celtics', odds: -140, wager: 10 }).claim, games);
    await claim('1', 'alice');
    await claim('2', 'alice');
    await claim('3', 'bob');
    return db;
  }

  it('fingerprints every ledger head under an opaque id', async () => {
    const db = await seeded();
    const anchor = await computeAnchor(db);
    expect(anchor.ledgers).toBe(2);
    expect(JSON.stringify(anchor)).not.toMatch(/alice|bob/);
    const aliceId = await ledgerIdFor('alice');
    const aliceEvents = await loadEvents(db, 'alice');
    expect(anchor.heads.find(h => h.ledgerId === aliceId)).toMatchObject({ seq: 2, headHash: aliceEvents[1].hash });
    expect((await computeAnchor(db)).anchor).toBe(anchor.anchor); // deterministic
  });

  it('serves the anchor publicly', async () => {
    const db = await seeded();
    const r = res();
    await handler(req('GET', 'anchor'), r, { db, noCache: true });
    expect(r.body).toMatchObject({ available: true, ledgers: 2 });
    expect(r.body.anchor).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('scheduled close capture', () => {
  it('captures closes for bets starting soon, and respects the secret', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    await recordBet(db, 'alice', sanitizeClaim({ clientBetId: '1', gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'Boston Celtics', odds: -140, wager: 10 }).claim, games);
    const loadSportOdds = vi.fn(async () => ({ ok: true, data: games }));

    process.env.LEDGER_CRON_SECRET = 'shh';
    const denied = res();
    await handler(req('POST', 'closes', { authorization: 'Bearer nope' }), denied, { db, loadSportOdds });
    expect(denied.statusCode).toBe(401);
    expect(loadSportOdds).not.toHaveBeenCalled();

    const ok = res();
    await handler(req('POST', 'closes', { authorization: 'Bearer shh' }), ok, { db, loadSportOdds });
    expect(ok.body).toMatchObject({ ok: true, sports: ['basketball_nba'], updated: 1 });
    expect(db.store.get('bet_ledger/alice/events/b_1').derived.close.fairProb).toBeGreaterThan(0.5);
  });

  it('does nothing (and fetches nothing) when no bets start soon', async () => {
    const db = createFakeFirestore();
    const loadSportOdds = vi.fn();
    const r = res();
    await handler(req('POST', 'closes'), r, { db, loadSportOdds });
    expect(r.body).toMatchObject({ ok: true, sports: [] });
    expect(loadSportOdds).not.toHaveBeenCalled();
  });
});
