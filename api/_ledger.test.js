import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeFirestore } from '../tests/helpers/fakeFirestore.js';
import {
  LedgerRejection, checkClaimAgainstMarket, gradePendingEvents, loadEvents, loadPublicRecord, recordBet,
  sanitizeClaim, setSharing, toPublicEvent, updateLedgerCloses, voidBet,
} from './_ledger.js';
import { GENESIS_HASH, computeEventHash } from '../src/utils/ledger.js';
import { probIndexKey } from './_receipts.js';
import { verifyChain, computeLedgerStats } from '../src/utils/ledger.js';
import handler from './verified-bets.js';

const NOW = Date.parse('2026-10-08T18:00:00Z');
const START = '2026-10-08T23:00:00Z';

const book = (key, homeMl, awayMl, homeSpread = -4.5) => ({
  key, title: key.toUpperCase(),
  markets: [
    { key: 'h2h', outcomes: [{ name: 'Boston Celtics', price: homeMl }, { name: 'New York Knicks', price: awayMl }] },
    { key: 'spreads', outcomes: [{ name: 'Boston Celtics', point: homeSpread, price: -110 }, { name: 'New York Knicks', point: -homeSpread, price: -110 }] },
    { key: 'totals', outcomes: [{ name: 'Over', point: 220.5, price: -110 }, { name: 'Under', point: 220.5, price: -110 }] },
  ],
});
const games = [{
  id: 'g1', home_team: 'Boston Celtics', away_team: 'New York Knicks', commence_time: START,
  bookmakers: [book('draftkings', -160, 140), book('fanduel', -150, 130), book('betmgm', -155, 135, -5)],
}];
const claim = (over = {}) => sanitizeClaim({
  clientBetId: '1001', gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'h2h',
  outcomeName: 'Boston Celtics', odds: -150, wager: 100, ...over,
}).claim;

afterEach(() => vi.useRealTimers());

describe('sanitizeClaim', () => {
  it('rejects anything that is not a clean full-game claim', () => {
    expect(sanitizeClaim({}).error).toBeTruthy();
    expect(sanitizeClaim({ ...claim(), marketKey: 'player_points' }).error).toMatch(/moneyline/);
    expect(sanitizeClaim({ ...claim(), sportKey: 'soccer_epl' }).error).toMatch(/basketball/);
    expect(sanitizeClaim({ ...claim(), odds: 50 }).error).toMatch(/odds/);
    expect(sanitizeClaim({ ...claim(), odds: -110.5 }).error).toMatch(/odds/);
    expect(sanitizeClaim({ ...claim(), wager: -5 }).error).toMatch(/stake/);
    expect(sanitizeClaim({ ...claim(), clientBetId: '../x' }).error).toMatch(/id/);
    expect(sanitizeClaim({ ...claim(), marketKey: 'spreads', outcomePoint: null }).error).toMatch(/line/);
    expect(sanitizeClaim({ ...claim(), outcomePoint: 3 }).claim.outcomePoint).toBeNull(); // h2h has no point
  });
});

describe('checkClaimAgainstMarket', () => {
  it('refuses bets once the game has started', () => {
    expect(() => checkClaimAgainstMarket(claim(), games, Date.parse(START))).toThrow(LedgerRejection);
  });

  it('refuses games that are not on the board', () => {
    expect(() => checkClaimAgainstMarket(claim({ gameId: 'nope' }), games, NOW)).toThrow(/no longer on the board/);
  });

  it('keeps a real price and attributes it to the closest book', () => {
    const rec = checkClaimAgainstMarket(claim({ odds: -155 }), games, NOW);
    expect(rec).toMatchObject({ odds: -155, priceAdjusted: false, bookKey: 'betmgm', bestPriceAtRecord: -150 });
  });

  it('never records a price better than the market offered', () => {
    const rec = checkClaimAgainstMarket(claim({ odds: 200 }), games, NOW);
    expect(rec).toMatchObject({ odds: -150, claimedOdds: 200, priceAdjusted: true, bookKey: 'fanduel' });
    const atBook = checkClaimAgainstMarket(claim({ odds: -150, bookKey: 'draftkings' }), games, NOW);
    expect(atBook).toMatchObject({ odds: -160, priceAdjusted: true, bookKey: 'draftkings' });
  });

  it('rejects a line that is not posted and says where it moved', () => {
    try {
      checkClaimAgainstMarket(claim({ marketKey: 'spreads', outcomePoint: -3.5, odds: -110 }), games, NOW);
      throw new Error('expected rejection');
    } catch (e) {
      expect(e.reason).toBe('line_not_offered');
      expect(e.details.currentPoints).toEqual([-5, -4.5]);
    }
    const ok = checkClaimAgainstMarket(claim({ marketKey: 'spreads', outcomePoint: -5, odds: -110 }), games, NOW);
    expect(ok).toMatchObject({ bookKey: 'betmgm', outcomePoint: -5 });
  });
});

describe('ledger writes', () => {
  it('records chained, idempotent events and indexes them for closing lines', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    const first = await recordBet(db, 'u1', claim(), games);
    const again = await recordBet(db, 'u1', claim(), games);
    expect(again.duplicate).toBe(true);
    await recordBet(db, 'u1', claim({ clientBetId: '1002', outcomeName: 'New York Knicks', odds: 130 }), games);

    const events = await loadEvents(db, 'u1');
    expect(events.map(e => [e.seq, e.type])).toEqual([[1, 'bet'], [2, 'bet']]);
    expect(events[1].prevHash).toBe(first.event.hash);
    expect(await verifyChain(events)).toMatchObject({ valid: true, checked: 2 });
    expect(db.store.get('ledger_open/u1__b_1001')).toMatchObject({ gameId: 'g1', marketKey: 'h2h' });
    expect(db.store.get('bet_ledger/u1')).toMatchObject({ seq: 2, dayCount: 2 });
  });

  it('voids only shortly after logging and before kick-off, as a permanent chained entry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    await recordBet(db, 'u1', claim(), games);
    await recordBet(db, 'u1', claim({ clientBetId: '1002' }), games);
    await voidBet(db, 'u1', '1001');
    expect(db.store.has('ledger_open/u1__b_1001')).toBe(false);

    await recordBet(db, 'u1', claim({ clientBetId: '1004' }), games);
    vi.setSystemTime(NOW + 11 * 60 * 1000);
    await expect(voidBet(db, 'u1', '1004')).rejects.toMatchObject({ reason: 'void_window_closed' });

    vi.setSystemTime(Date.parse(START) + 1000);
    await expect(voidBet(db, 'u1', '1002')).rejects.toMatchObject({ reason: 'game_started' });
    await expect(recordBet(db, 'u1', claim({ clientBetId: '1003' }), games)).rejects.toMatchObject({ reason: 'game_started' });

    const events = await loadEvents(db, 'u1');
    expect(events.map(e => e.type)).toEqual(['bet', 'bet', 'void', 'bet']);
    expect(await verifyChain(events)).toMatchObject({ valid: true });
    expect(computeLedgerStats(events)).toMatchObject({ total: 2, voided: 1 });
  });

  it('a tampered stored entry is caught by the chain check', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    await recordBet(db, 'u1', claim(), games);
    const path = 'bet_ledger/u1/events/b_1001';
    db.store.set(path, { ...db.store.get(path), odds: 250 });
    expect(await verifyChain(await loadEvents(db, 'u1'))).toMatchObject({ valid: false, brokenAtSeq: 1 });
  });
});

describe('closing lines and grading', () => {
  it('tracks the no-vig close until kick-off, then stops', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    await recordBet(db, 'u1', claim(), games);
    const probIndex = new Map([[probIndexKey('g1', 'h2h', 'Boston Celtics', null), { fairProb: 0.62, bestPrice: -150 }]]);

    expect(await updateLedgerCloses(db, probIndex, NOW)).toMatchObject({ updated: 1 });
    expect(await updateLedgerCloses(db, probIndex, NOW + 60 * 1000)).toMatchObject({ updated: 0 }); // throttled
    probIndex.get(probIndexKey('g1', 'h2h', 'Boston Celtics', null)).fairProb = 0.64;
    await updateLedgerCloses(db, probIndex, NOW + 6 * 60 * 1000);
    expect(db.store.get('bet_ledger/u1/events/b_1001').derived.close.fairProb).toBe(0.64);

    expect(await updateLedgerCloses(db, probIndex, Date.parse(START) + 1)).toMatchObject({ closed: 1 });
    expect(db.store.has('ledger_open/u1__b_1001')).toBe(false);
    // The close does not affect the chain.
    expect(await verifyChain(await loadEvents(db, 'u1'))).toMatchObject({ valid: true });
  });

  it('grades finished games once from public scores', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    await recordBet(db, 'u1', claim(), games);
    const later = Date.parse(START) + 3 * 60 * 60 * 1000;
    const rows = [{ id: 'g1', home_team: 'Boston Celtics', away_team: 'New York Knicks', commence_time: START, completed: true,
      scores: [{ name: 'Boston Celtics', score: '101' }, { name: 'New York Knicks', score: '99' }] }];
    const fetchRows = vi.fn(async () => rows);

    const events = await loadEvents(db, 'u1');
    expect(await gradePendingEvents(db, 'u1', events, fetchRows, Date.parse(START) + 30 * 60 * 1000)).toBe(0); // too early
    expect(await gradePendingEvents(db, 'u1', events, fetchRows, later)).toBe(1);
    expect(db.store.get('bet_ledger/u1/events/b_1001').derived.grade).toMatchObject({ result: 'won', homeScore: 101 });
    expect(await gradePendingEvents(db, 'u1', await loadEvents(db, 'u1'), fetchRows, later)).toBe(0); // never re-graded
  });
});

describe('verified-bets route', () => {
  const res = () => {
    const r = { headers: {}, statusCode: 200 };
    r.setHeader = (k, v) => { r.headers[k] = v; };
    r.status = (c) => { r.statusCode = c; return r; };
    r.json = (b) => { r.body = b; return r; };
    r.end = () => r;
    return r;
  };
  const req = (method, body) => ({ method, body, query: {}, headers: { 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 200)}` } });
  const user = async () => ({ uid: 'u1' });

  it('requires a verified user', async () => {
    const r = res();
    await handler(req('GET'), r, { getVerifiedUser: async () => null, db: createFakeFirestore() });
    expect(r.statusCode).toBe(401);
  });

  it('reports unavailable without server credentials', async () => {
    const r = res();
    await handler(req('GET'), r, { getVerifiedUser: user, db: null });
    expect(r.body).toEqual({ available: false });
  });

  it('records, rejects and lists through the API', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    const deps = { getVerifiedUser: user, db, loadSportOdds: async () => ({ ok: true, data: games }), fetchScoreRows: async () => [] };
    const bet = { clientBetId: '1001', gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'Boston Celtics', odds: -150, wager: 100 };

    const ok = res();
    await handler(req('POST', { action: 'record', bet }), ok, deps);
    expect(ok.statusCode).toBe(200);
    expect(ok.body).toMatchObject({ verified: true, event: { seq: 1, odds: -150 } });

    const moved = res();
    await handler(req('POST', { action: 'record', bet: { ...bet, clientBetId: '1002', marketKey: 'spreads', outcomePoint: -2 } }), moved, deps);
    expect(moved.statusCode).toBe(422);
    expect(moved.body.reason).toBe('line_not_offered');

    const down = res();
    await handler(req('POST', { action: 'record', bet: { ...bet, clientBetId: '1003' } }), down, { ...deps, loadSportOdds: async () => ({ ok: false }) });
    expect(down.statusCode).toBe(503);

    const list = res();
    await handler(req('GET'), list, deps);
    expect(list.body).toMatchObject({ available: true, chain: { valid: true, checked: 1 }, stats: { total: 1 } });
    expect(list.headers['Cache-Control']).toBe('no-store');
  });

  it('shares a record publicly without sign-in and without stakes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    const deps = { getVerifiedUser: user, db, loadSportOdds: async () => ({ ok: true, data: games }), fetchScoreRows: async () => [] };
    const bet = { clientBetId: '1001', gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'Boston Celtics', odds: -150, wager: 100 };
    await handler(req('POST', { action: 'record', bet }), res(), deps);

    const hidden = res();
    await handler({ ...req('GET'), query: { handle: 'sharp_sam' } }, hidden, { ...deps, getVerifiedUser: async () => null });
    expect(hidden.statusCode).toBe(404);

    const share = res();
    await handler(req('POST', { action: 'share', enabled: true, handle: 'sharp_sam' }), share, deps);
    expect(share.body).toMatchObject({ ok: true, sharing: { enabled: true, handle: 'sharp_sam' } });

    const pub = res();
    await handler({ ...req('GET'), query: { handle: 'SHARP_SAM' } }, pub, { ...deps, getVerifiedUser: async () => null });
    expect(pub.statusCode).toBe(200);
    expect(pub.body).toMatchObject({ available: true, handle: 'sharp_sam', stats: { total: 1 } });
    expect(JSON.stringify(pub.body)).not.toMatch(/salt|"wager"|"private"/);

    const owner = res();
    await handler(req('GET'), owner, deps);
    expect(owner.body.sharing).toMatchObject({ enabled: true, handle: 'sharp_sam' });

    const taken = res();
    await handler(req('POST', { action: 'share', enabled: true, handle: 'x' }), taken, deps);
    expect(taken.statusCode).toBe(422);
  });
});

describe('stakes and public sharing', () => {
  async function seeded() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const db = createFakeFirestore();
    await recordBet(db, 'u1', claim(), games);
    await recordBet(db, 'u1', claim({ clientBetId: '1002', wager: 25.5 }), games);
    return db;
  }

  it('commits to the stake without putting it in the hashed contents', async () => {
    const db = await seeded();
    const [first] = await loadEvents(db, 'u1');
    expect(first.v).toBe(2);
    expect(first.wager).toBeUndefined();
    expect(first.private.stake.wager).toBe(100);
    expect(first.stakeCommit).toMatch(/^[0-9a-f]{64}$/);
    expect(computeLedgerStats(await loadEvents(db, 'u1'))).toMatchObject({ total: 2 });
  });

  it('catches a stake changed after recording', async () => {
    const db = await seeded();
    const path = 'bet_ledger/u1/events/b_1001';
    const stored = db.store.get(path);
    db.store.set(path, { ...stored, private: { stake: { ...stored.private.stake, wager: 5000 } } });
    expect(await verifyChain(await loadEvents(db, 'u1'))).toMatchObject({ valid: false, brokenAtSeq: 1, reason: 'stake was changed after recording' });
  });

  it('shares only by opt-in, never exposes stakes, and stays verifiable', async () => {
    const db = await seeded();
    expect(await loadPublicRecord(db, 'sharp_sam')).toBeNull();
    await setSharing(db, 'u1', { enabled: true, handle: 'Sharp_Sam' });
    const record = await loadPublicRecord(db, 'sharp_sam');
    expect(record.handle).toBe('sharp_sam');
    expect(JSON.stringify(record.events)).not.toMatch(/"private"|"salt"|"wager"/);
    expect(await verifyChain(record.events)).toMatchObject({ valid: true, checked: 2, linkedOnly: 0 });
    expect(computeLedgerStats(record.events)).toMatchObject({ total: 2, stakeRoi: null });

    await setSharing(db, 'u1', { enabled: false });
    expect(await loadPublicRecord(db, 'sharp_sam')).toBeNull();
  });

  it('enforces unique, valid handles and releases a changed one', async () => {
    const db = await seeded();
    await setSharing(db, 'u1', { enabled: true, handle: 'first_name' });
    await expect(setSharing(db, 'u2', { enabled: true, handle: 'first_name' })).rejects.toMatchObject({ reason: 'handle_taken' });
    await expect(setSharing(db, 'u2', { enabled: true, handle: 'no' })).rejects.toMatchObject({ reason: 'invalid_handle' });
    await expect(setSharing(db, 'u2', { enabled: true, handle: 'bad name!' })).rejects.toMatchObject({ reason: 'invalid_handle' });
    await setSharing(db, 'u1', { enabled: true, handle: 'second_name' });
    expect(db.store.has('ledger_handles/first_name')).toBe(false);
    await setSharing(db, 'u2', { enabled: true, handle: 'first_name' });
    expect(db.store.get('ledger_handles/first_name').uid).toBe('u2');
  });

  it('shares older v1 entries redacted and still checks their links', async () => {
    const v1 = { id: 'b_9', type: 'bet', v: 1, seq: 1, prevHash: GENESIS_HASH, wager: 100, odds: -110, recordedAt: '2026-10-08T11:40:00.000Z' };
    v1.hash = await computeEventHash(v1);
    const pub = toPublicEvent(v1);
    expect(pub).toMatchObject({ redacted: true });
    expect(pub.wager).toBeUndefined();
    expect(await verifyChain([pub])).toMatchObject({ valid: true, linkedOnly: 1 });
    expect(await verifyChain([{ ...pub, prevHash: 'f'.repeat(64) }])).toMatchObject({ valid: false });
  });
});

describe('grading personal bets', () => {
  it('grades valid items only and writes nothing', async () => {
    const { sanitizeGradeRequest, gradeUnverified } = await import('./_ledger.js');
    const items = sanitizeGradeRequest([
      { key: '1', gameId: 'g1', sportKey: 'basketball_nba', marketKey: 'spreads', outcomeName: 'Boston Celtics', outcomePoint: -4.5, commenceTime: START, homeTeam: 'Boston Celtics', awayTeam: 'New York Knicks' },
      { key: '2', sportKey: 'soccer_epl', marketKey: 'h2h', outcomeName: 'Arsenal', commenceTime: START },
      { key: '../x', sportKey: 'basketball_nba', marketKey: 'h2h', outcomeName: 'x', commenceTime: START },
      { key: '3', sportKey: 'basketball_nba', marketKey: 'player_points', outcomeName: 'x', commenceTime: START },
    ]);
    expect(items.map(i => i.key)).toEqual(['1', '2']);
    const rows = [{ id: 'other', home_team: 'Boston Celtics', away_team: 'New York Knicks', commence_time: START, completed: true,
      scores: [{ name: 'Boston Celtics', score: '110' }, { name: 'New York Knicks', score: '100' }], source: 'ESPN final scores' }];
    const grades = await gradeUnverified(items, async () => rows, Date.parse(START) + 3 * 3600e3);
    expect(grades).toEqual({ 1: expect.objectContaining({ result: 'won', homeScore: 110, scoreSource: 'ESPN final scores' }) });
  });
});
