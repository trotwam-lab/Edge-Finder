// api/_ledger.js — the verified bet ledger (server side).
//
// A bet logged from the board is checked against the live market and written
// here by the server, never by the client:
//   * time is the SERVER's clock, and the game must not have started;
//   * the line (team / side / point) must be on the board right now, and the
//     recorded price can never be better than the best price actually offered
//     (a better claimed price is recorded at the market price instead);
//   * entries are append-only and hash-chained (src/utils/ledger.js), so any
//     later edit, deletion or reordering is detectable by anyone;
//   * a bet can be voided only within 10 minutes of recording AND before its
//     game starts (an undo for mistakes, not a way to hide bad bets), and the
//     void itself is a permanent, chained entry;
//   * the closing line comes from the edge scan's no-vig consensus, and the
//     result from public final scores — neither can be typed in by a user.
//
// Storage (Admin SDK only — the security rules deny all client access to
// these top-level collections):
//   bet_ledger/{uid}                 { seq, headHash, dayKey, dayCount }
//   bet_ledger/{uid}/events/{id}     chained events (+ derived.close/grade)
//   ledger_open/{uid}__{id}          index of bets still awaiting a close

import { webcrypto } from 'node:crypto';
import { GENESIS_HASH, americanToDecimalOdds, computeEventHash } from '../src/utils/ledger.js';
import { findScoreRow, gradeBet, isAutoGradeable, readFinalScore } from '../src/utils/grading.js';
import { probIndexKey } from './_receipts.js';

// The shared hashing code uses Web Crypto (same in browsers and Node 19+).
// Older Node runtimes only expose it as crypto.webcrypto.
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

export const LEDGER_COLLECTION = 'bet_ledger';
export const OPEN_COLLECTION = 'ledger_open';
export const DAILY_RECORD_LIMIT = 200;
export const LEDGER_VERSION = 1;
// Voids exist to undo a mis-tap, not to curate a record: a longer window
// would let someone quietly void every bet the line moved against.
export const VOID_WINDOW_MS = 10 * 60 * 1000;

const SPORT_RE = /^[a-z0-9_]{2,64}$/;
const ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const BOOK_RE = /^[a-z0-9_]{1,40}$/;
const MARKETS = new Set(['h2h', 'spreads', 'totals']);

export class LedgerRejection extends Error {
  constructor(reason, message, details) {
    super(message);
    this.reason = reason;
    this.details = details;
  }
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

// Validate and normalize the client's claim. Returns { claim } or { error }.
export function sanitizeClaim(input) {
  const bet = input && typeof input === 'object' ? input : {};
  const clientBetId = String(bet.clientBetId ?? '');
  const gameId = String(bet.gameId ?? '');
  const sportKey = String(bet.sportKey ?? '');
  const marketKey = String(bet.marketKey ?? '');
  const outcomeName = typeof bet.outcomeName === 'string' ? bet.outcomeName.trim() : '';
  const outcomePoint = finiteOrNull(bet.outcomePoint);
  const odds = Number(bet.odds);
  const wager = Number(bet.wager);
  const bookKey = bet.bookKey == null || bet.bookKey === '' ? null : String(bet.bookKey).toLowerCase();

  if (!CLIENT_ID_RE.test(clientBetId)) return { error: 'Invalid bet id.' };
  if (!ID_RE.test(gameId)) return { error: 'This bet is not linked to a game on the board.' };
  if (!SPORT_RE.test(sportKey)) return { error: 'Unknown sport.' };
  if (!MARKETS.has(marketKey)) return { error: 'Only moneyline, spread and total bets can be verified.' };
  if (!outcomeName || outcomeName.length > 80) return { error: 'Missing pick.' };
  // Only sports we can grade from final scores — a verified bet must be able
  // to resolve on its own, without anyone typing in the result.
  if (!isAutoGradeable({ sportKey, marketKey, outcomeName })) {
    return { error: 'Verification covers basketball, football, baseball and hockey game lines for now.' };
  }
  if (Number.isNaN(outcomePoint) || (outcomePoint != null && Math.abs(outcomePoint) > 1000)) return { error: 'Invalid line.' };
  if (marketKey !== 'h2h' && outcomePoint == null) return { error: 'Spread and total bets need a line.' };
  if (!Number.isInteger(odds) || Math.abs(odds) < 100 || Math.abs(odds) > 100000) return { error: 'Invalid odds.' };
  if (!Number.isFinite(wager) || wager <= 0 || wager > 10_000_000) return { error: 'Invalid stake.' };
  if (bookKey != null && !BOOK_RE.test(bookKey)) return { error: 'Unknown sportsbook.' };

  return {
    claim: {
      clientBetId,
      gameId,
      sportKey,
      marketKey,
      outcomeName,
      outcomePoint: marketKey === 'h2h' ? null : outcomePoint,
      odds,
      wager: Math.round(wager * 100) / 100,
      bookKey,
    },
  };
}

// Check a claim against the current market. Pure: `games` is the odds feed
// for the claim's sport, `now` the server time. Returns the fields to record,
// or throws LedgerRejection.
export function checkClaimAgainstMarket(claim, games, now = Date.now()) {
  const game = (games || []).find(g => g?.id === claim.gameId);
  if (!game) {
    throw new LedgerRejection('game_not_on_board', 'This game is no longer on the board, so the bet can\'t be verified.');
  }
  if (typeof game.home_team !== 'string' || typeof game.away_team !== 'string') {
    throw new LedgerRejection('game_not_on_board', 'This game is missing team details, so the bet can\'t be verified.');
  }
  const start = Date.parse(game.commence_time || '');
  if (!Number.isFinite(start)) {
    throw new LedgerRejection('no_start_time', 'This game has no confirmed start time yet.');
  }
  if (now >= start) {
    throw new LedgerRejection('game_started', 'This game has already started — only pregame bets can be verified.');
  }

  const books = (game.bookmakers || []).filter(b => !claim.bookKey || String(b?.key).toLowerCase() === claim.bookKey);
  if (!books.length) {
    throw new LedgerRejection('book_not_on_board', 'That sportsbook isn\'t posting this game right now.');
  }

  const offers = [];
  const pointsSeen = new Set();
  books.forEach(book => {
    const market = book.markets?.find(m => m.key === claim.marketKey);
    market?.outcomes?.forEach(outcome => {
      if (outcome?.name !== claim.outcomeName) return;
      const decimal = americanToDecimalOdds(outcome.price);
      if (!decimal) return;
      if (claim.marketKey !== 'h2h') {
        const point = Number(outcome.point);
        if (Number.isFinite(point)) pointsSeen.add(point);
        if (point !== claim.outcomePoint) return;
      }
      offers.push({ bookKey: book.key, bookTitle: book.title || book.key, price: outcome.price, decimal });
    });
  });

  if (!offers.length) {
    const current = [...pointsSeen].sort((a, b) => a - b);
    throw new LedgerRejection(
      'line_not_offered',
      current.length
        ? `The line moved — ${claim.outcomeName} is now ${current.map(p => (p > 0 ? `+${p}` : `${p}`)).join(' / ')}. Log it again at the current number.`
        : 'That line isn\'t on the board right now.',
      { currentPoints: current },
    );
  }

  const claimDecimal = americanToDecimalOdds(claim.odds);
  const best = offers.reduce((a, b) => (b.decimal > a.decimal ? b : a));
  // Most plausible book: the one whose price is closest to (but not worse
  // than) the claim. A claim better than every book is recorded at the best
  // available price instead — the record can't be better than the market.
  const atOrBetter = offers.filter(o => o.decimal + 1e-9 >= claimDecimal).sort((a, b) => a.decimal - b.decimal);
  const priceAdjusted = atOrBetter.length === 0;
  const book = priceAdjusted ? best : atOrBetter[0];

  return {
    game: `${game.away_team} @ ${game.home_team}`,
    homeTeam: game.home_team,
    awayTeam: game.away_team,
    commenceTime: new Date(start).toISOString(),
    sportKey: claim.sportKey,
    gameId: claim.gameId,
    marketKey: claim.marketKey,
    outcomeName: claim.outcomeName,
    outcomePoint: claim.outcomePoint,
    odds: priceAdjusted ? best.price : claim.odds,
    claimedOdds: claim.odds,
    priceAdjusted,
    bookKey: book.bookKey,
    bookTitle: book.bookTitle,
    bookPriceAtRecord: book.price,
    bestPriceAtRecord: best.price,
    wager: claim.wager,
  };
}

const eventsCol = (db, uid) => db.collection(LEDGER_COLLECTION).doc(uid).collection('events');
const openDocId = (uid, eventId) => `${uid}__${eventId}`;
const betEventId = (clientBetId) => `b_${clientBetId}`;
const voidEventId = (clientBetId) => `v_${clientBetId}`;

function dayKeyOf(iso) {
  return iso.slice(0, 10);
}

// Append one event inside a transaction. `build(head, existing)` returns the
// event fields (without seq/prevHash/hash/recordedAt) or throws a rejection.
// Idempotent per event id: retrying returns the already-recorded event.
async function appendEvent(db, uid, eventId, build, { onWrite } = {}) {
  const headRef = db.collection(LEDGER_COLLECTION).doc(uid);
  const eventRef = eventsCol(db, uid).doc(eventId);
  return db.runTransaction(async (tx) => {
    const [headSnap, existingSnap] = await Promise.all([tx.get(headRef), tx.get(eventRef)]);
    if (existingSnap.exists) return { event: existingSnap.data(), duplicate: true };

    const head = headSnap.exists ? headSnap.data() : {};
    const recordedAt = new Date().toISOString();
    const dayKey = dayKeyOf(recordedAt);
    const dayCount = head.dayKey === dayKey ? (head.dayCount || 0) : 0;
    if (dayCount >= DAILY_RECORD_LIMIT) {
      throw new LedgerRejection('daily_limit', 'Daily verification limit reached. Try again tomorrow.');
    }

    const fields = await build(tx, recordedAt);
    const event = {
      ...fields,
      id: eventId,
      v: LEDGER_VERSION,
      seq: (head.seq || 0) + 1,
      prevHash: head.headHash || GENESIS_HASH,
      recordedAt,
    };
    event.hash = await computeEventHash(event);

    tx.set(eventRef, event);
    tx.set(headRef, { seq: event.seq, headHash: event.hash, dayKey, dayCount: dayCount + 1, updatedAt: recordedAt }, { merge: true });
    if (onWrite) onWrite(tx, event);
    return { event, duplicate: false };
  });
}

// Record a verified bet. `games` is the server's current odds feed for the sport.
export async function recordBet(db, uid, claim, games) {
  const eventId = betEventId(claim.clientBetId);
  return appendEvent(db, uid, eventId, async (_tx, recordedAt) => {
    // Re-check with the timestamp we're about to write, so a bet recorded a
    // moment after kick-off can never slip through.
    const fields = checkClaimAgainstMarket(claim, games, Date.parse(recordedAt));
    return { type: 'bet', clientBetId: claim.clientBetId, ...fields };
  }, {
    onWrite: (tx, event) => {
      tx.set(db.collection(OPEN_COLLECTION).doc(openDocId(uid, event.id)), {
        uid,
        eventId: event.id,
        gameId: event.gameId,
        sportKey: event.sportKey,
        marketKey: event.marketKey,
        outcomeName: event.outcomeName,
        outcomePoint: event.outcomePoint,
        commenceTime: event.commenceTime,
        lastObservedAt: null,
      });
    },
  });
}

// Void a bet — only within VOID_WINDOW_MS of recording and before kick-off.
export async function voidBet(db, uid, clientBetId) {
  if (!CLIENT_ID_RE.test(String(clientBetId ?? ''))) throw new LedgerRejection('invalid', 'Invalid bet id.');
  const betRef = eventsCol(db, uid).doc(betEventId(clientBetId));
  return appendEvent(db, uid, voidEventId(clientBetId), async (tx, recordedAt) => {
    const betSnap = await tx.get(betRef);
    if (!betSnap.exists) throw new LedgerRejection('not_found', 'That bet isn\'t in your verified record.');
    const bet = betSnap.data();
    if (Date.parse(recordedAt) >= Date.parse(bet.commenceTime)) {
      throw new LedgerRejection('game_started', 'The game has started — verified bets can only be voided before kick-off.');
    }
    if (Date.parse(recordedAt) - Date.parse(bet.recordedAt) > VOID_WINDOW_MS) {
      throw new LedgerRejection('void_window_closed', 'Verified bets can only be voided within 10 minutes of logging them.');
    }
    return { type: 'void', clientBetId: String(clientBetId), betEventId: bet.id, game: bet.game };
  }, {
    onWrite: (tx, event) => tx.delete(db.collection(OPEN_COLLECTION).doc(openDocId(uid, event.betEventId))),
  });
}

export async function loadEvents(db, uid) {
  const snap = await eventsCol(db, uid).orderBy('seq').get();
  return snap.docs.map(d => d.data());
}

// ---- Closing lines -------------------------------------------------------
// Called from the edge scan (api/edges.js) with its no-vig consensus index.
// While a bet's game is pregame we keep overwriting its close with the
// latest observation; the last one before kick-off is the closing line.
const CLOSE_REFRESH_MS = 5 * 60 * 1000;
const CLOSE_REFRESH_NEAR_START_MS = 60 * 1000;
const NEAR_START_MS = 30 * 60 * 1000;

export function shouldRefreshClose(open, now) {
  const start = Date.parse(open.commenceTime);
  if (!Number.isFinite(start) || start <= now) return false;
  if (!open.lastObservedAt) return true;
  const since = now - Date.parse(open.lastObservedAt);
  return since >= (start - now <= NEAR_START_MS ? CLOSE_REFRESH_NEAR_START_MS : CLOSE_REFRESH_MS);
}

export async function updateLedgerCloses(db, probIndex, now = Date.now()) {
  if (!db || !probIndex?.size) return { updated: 0, closed: 0 };
  const horizon = new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString();
  const snap = await db.collection(OPEN_COLLECTION).where('commenceTime', '<=', horizon).limit(1000).get();
  let batch = db.batch();
  let ops = 0;
  let updated = 0;
  let closed = 0;
  const commits = [];
  const queue = (fn) => {
    fn(batch);
    ops += 1;
    if (ops >= 400) { commits.push(batch.commit()); batch = db.batch(); ops = 0; }
  };

  snap.docs.forEach(doc => {
    const open = doc.data();
    const start = Date.parse(open.commenceTime);
    if (!Number.isFinite(start) || start <= now) {
      // Kick-off: whatever we last observed is the close. Stop tracking.
      queue(b => b.delete(doc.ref));
      closed += 1;
      return;
    }
    if (!shouldRefreshClose(open, now)) return;
    const current = probIndex.get(probIndexKey(open.gameId, open.marketKey, open.outcomeName, open.outcomePoint));
    if (!current || !Number.isFinite(current.fairProb)) return;
    const observedAt = new Date(now).toISOString();
    const eventRef = eventsCol(db, open.uid).doc(open.eventId);
    queue(b => b.update(eventRef, {
      'derived.close': {
        fairProb: Number(current.fairProb.toFixed(6)),
        bestPrice: current.bestPrice ?? null,
        observedAt,
        source: 'no-vig consensus across books',
      },
    }));
    queue(b => b.update(doc.ref, { lastObservedAt: observedAt }));
    updated += 1;
  });

  if (ops) commits.push(batch.commit());
  await Promise.all(commits);
  return { updated, closed };
}

// ---- Grading -------------------------------------------------------------
const GRADE_AFTER_MS = 90 * 60 * 1000;       // no game is final sooner
const GRADE_GIVE_UP_MS = 3 * 24 * 60 * 60 * 1000; // scores feed covers 3 days

// Grade any of this user's finished, ungraded bets. `fetchScoreRows(sport)`
// returns Odds-API-style score rows. Results are written once and never
// changed; anything we can't grade safely is left for the user to settle.
export async function gradePendingEvents(db, uid, events, fetchScoreRows, now = Date.now()) {
  const voided = new Set(events.filter(e => e.type === 'void').map(e => e.betEventId));
  const due = events.filter(e => {
    if (e.type !== 'bet' || voided.has(e.id) || e.derived?.grade || !isAutoGradeable(e)) return false;
    const start = Date.parse(e.commenceTime);
    return Number.isFinite(start) && now - start >= GRADE_AFTER_MS && now - start <= GRADE_GIVE_UP_MS;
  });
  if (!due.length) return 0;

  const sports = [...new Set(due.map(e => e.sportKey))].slice(0, 8);
  const rowsBySport = new Map();
  await Promise.all(sports.map(async sport => {
    try { rowsBySport.set(sport, await fetchScoreRows(sport)); } catch { rowsBySport.set(sport, null); }
  }));

  const gradedAt = new Date(now).toISOString();
  const writes = [];
  due.forEach(event => {
    const rows = rowsBySport.get(event.sportKey);
    if (!rows) return;
    const row = findScoreRow(rows, event);
    const final = readFinalScore(row);
    const result = gradeBet(event, final);
    if (!result) return;
    const grade = {
      result,
      homeTeam: final.homeTeam,
      awayTeam: final.awayTeam,
      homeScore: final.home,
      awayScore: final.away,
      scoreSource: 'The Odds API final scores',
      scoreEventId: row?.id ?? null,
      gradedAt,
    };
    event.derived = { ...(event.derived || {}), grade };
    writes.push(eventsCol(db, uid).doc(event.id).update({ 'derived.grade': grade }));
  });
  await Promise.all(writes);
  return writes.length;
}
