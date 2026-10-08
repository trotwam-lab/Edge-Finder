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

import { randomBytes, webcrypto } from 'node:crypto';
import {
  GENESIS_HASH, americanToDecimalOdds, canonicalJson, computeEventHash, sha256Hex, stakeCommitInput,
} from '../src/utils/ledger.js';
import { findScoreRow, gradeBet, isAutoGradeable, readFinalScore } from '../src/utils/grading.js';
import {
  MAX_PARLAY_LEGS, MIN_PARLAY_LEGS, combinedDecimal, decimalToAmerican, settleParlay,
} from '../src/utils/parlay.js';
import { probIndexKey } from './_receipts.js';

// The shared hashing code uses Web Crypto (same in browsers and Node 19+).
// Older Node runtimes only expose it as crypto.webcrypto.
if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;

export const LEDGER_COLLECTION = 'bet_ledger';
export const OPEN_COLLECTION = 'ledger_open';
export const DAILY_RECORD_LIMIT = 200;
// v2: the stake is committed by hash (stakeCommit) instead of stored in the
// hashed part, so a record can be shared publicly without revealing stakes.
export const LEDGER_VERSION = 2;
export const HANDLE_COLLECTION = 'ledger_handles';
const HANDLE_RE = /^[a-z0-9_]{3,20}$/;
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

// Validate a parlay claim: 2–10 legs, each a valid game-line claim, and no
// two legs from the same game (same-game parlays are priced differently by
// books, so their combined price can't be checked from the board).
export function sanitizeParlayClaim(input) {
  const bet = input && typeof input === 'object' ? input : {};
  const rawLegs = Array.isArray(bet.legs) ? bet.legs : [];
  if (rawLegs.length < MIN_PARLAY_LEGS || rawLegs.length > MAX_PARLAY_LEGS) {
    return { error: `Parlays need ${MIN_PARLAY_LEGS}–${MAX_PARLAY_LEGS} legs.` };
  }
  const legs = [];
  for (let i = 0; i < rawLegs.length; i += 1) {
    const { claim, error } = sanitizeClaim({ ...rawLegs[i], clientBetId: bet.clientBetId, wager: bet.wager });
    if (error) return { error: `Leg ${i + 1}: ${error}` };
    legs.push(claim);
  }
  if (new Set(legs.map(l => l.gameId)).size !== legs.length) {
    return { error: 'Same-game parlays can\'t be verified — books price them differently from separate games.' };
  }
  const { clientBetId, wager } = legs[0];
  return {
    claim: {
      clientBetId,
      wager,
      legs: legs.map(({ clientBetId: _c, wager: _w, ...leg }) => leg),
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
    const { wager, ...fields } = checkClaimAgainstMarket(claim, games, Date.parse(recordedAt));
    const salt = randomBytes(16).toString('hex');
    return {
      type: 'bet',
      clientBetId: claim.clientBetId,
      ...fields,
      stakeCommit: await sha256Hex(stakeCommitInput(wager, salt)),
      private: { stake: { wager, salt } },
    };
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

// Record a verified parlay. `gamesBySport` maps each leg's sport to the
// server's current odds feed. Every leg is checked exactly like a single bet;
// the combined price is computed here from the recorded leg prices.
export async function recordParlay(db, uid, claim, gamesBySport) {
  const eventId = betEventId(claim.clientBetId);
  return appendEvent(db, uid, eventId, async (_tx, recordedAt) => {
    const now = Date.parse(recordedAt);
    const legs = claim.legs.map((leg, i) => {
      try {
        const fields = checkClaimAgainstMarket(
          { ...leg, clientBetId: claim.clientBetId, wager: claim.wager },
          gamesBySport.get(leg.sportKey) || [],
          now,
        );
        delete fields.wager; // the stake belongs to the parlay, committed below
        return fields;
      } catch (error) {
        if (error instanceof LedgerRejection) {
          throw new LedgerRejection(error.reason, `Leg ${i + 1}: ${error.message}`, error.details);
        }
        throw error;
      }
    });
    const parlayDecimal = combinedDecimal(legs.map(l => l.odds));
    const salt = randomBytes(16).toString('hex');
    const firstStart = Math.min(...legs.map(l => Date.parse(l.commenceTime)));
    return {
      type: 'parlay',
      clientBetId: claim.clientBetId,
      game: legs.map(l => l.game).join(' + '),
      commenceTime: new Date(firstStart).toISOString(),
      legs,
      parlayDecimal,
      odds: decimalToAmerican(parlayDecimal),
      stakeCommit: await sha256Hex(stakeCommitInput(claim.wager, salt)),
      private: { stake: { wager: claim.wager, salt } },
    };
  }, {
    onWrite: (tx, event) => {
      event.legs.forEach((leg, legIndex) => {
        tx.set(db.collection(OPEN_COLLECTION).doc(openDocId(uid, `${event.id}~${legIndex}`)), {
          uid,
          eventId: event.id,
          legIndex,
          gameId: leg.gameId,
          sportKey: leg.sportKey,
          marketKey: leg.marketKey,
          outcomeName: leg.outcomeName,
          outcomePoint: leg.outcomePoint,
          commenceTime: leg.commenceTime,
          lastObservedAt: null,
        });
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
    const fields = { type: 'void', clientBetId: String(clientBetId), betEventId: bet.id, game: bet.game };
    if (bet.type === 'parlay') fields.legCount = bet.legs.length;
    return fields;
  }, {
    onWrite: (tx, event) => {
      if (event.legCount) {
        for (let i = 0; i < event.legCount; i += 1) {
          tx.delete(db.collection(OPEN_COLLECTION).doc(openDocId(uid, `${event.betEventId}~${i}`)));
        }
      } else {
        tx.delete(db.collection(OPEN_COLLECTION).doc(openDocId(uid, event.betEventId)));
      }
    },
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
    const field = Number.isInteger(open.legIndex) ? `derived.legCloses.${open.legIndex}` : 'derived.close';
    queue(b => b.update(eventRef, {
      [field]: {
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
  const isDue = (market) => {
    if (!isAutoGradeable(market)) return false;
    const start = Date.parse(market.commenceTime);
    return Number.isFinite(start) && now - start >= GRADE_AFTER_MS && now - start <= GRADE_GIVE_UP_MS;
  };
  // Work items: whole single bets, or individual ungraded legs of a parlay.
  const items = [];
  events.forEach(e => {
    if (voided.has(e.id) || e.derived?.grade) return;
    if (e.type === 'bet' && isDue(e)) items.push({ event: e, market: e, legIndex: null });
    if (e.type === 'parlay' && Array.isArray(e.legs)) {
      e.legs.forEach((leg, legIndex) => {
        if (!e.derived?.legGrades?.[legIndex] && isDue(leg)) items.push({ event: e, market: leg, legIndex });
      });
    }
  });
  if (!items.length) return 0;

  const sports = [...new Set(items.map(item => item.market.sportKey))].slice(0, 8);
  const rowsBySport = new Map();
  await Promise.all(sports.map(async sport => {
    try { rowsBySport.set(sport, await fetchScoreRows(sport)); } catch { rowsBySport.set(sport, null); }
  }));

  const gradedAt = new Date(now).toISOString();
  const updates = new Map(); // event id -> { event, fields }
  const addUpdate = (event, field, value) => {
    if (!updates.has(event.id)) updates.set(event.id, { event, fields: {} });
    updates.get(event.id).fields[field] = value;
  };

  items.forEach(({ event, market, legIndex }) => {
    const rows = rowsBySport.get(market.sportKey);
    if (!rows) return;
    const row = findScoreRow(rows, market);
    const final = readFinalScore(row);
    const result = gradeBet(market, final);
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
    if (legIndex == null) {
      event.derived = { ...(event.derived || {}), grade };
      addUpdate(event, 'derived.grade', grade);
    } else {
      event.derived = { ...(event.derived || {}), legGrades: { ...(event.derived?.legGrades || {}), [legIndex]: grade } };
      addUpdate(event, `derived.legGrades.${legIndex}`, grade);
    }
  });

  // A parlay is graded once its legs decide it (any loss decides it at once).
  updates.forEach(({ event }) => {
    if (event.type !== 'parlay') return;
    const results = event.legs.map((_, i) => event.derived?.legGrades?.[i]?.result ?? null);
    const settled = settleParlay(results, event.legs.map(l => l.odds));
    if (!settled) return;
    const grade = { result: settled.result, effectiveDecimal: settled.effectiveDecimal, gradedAt };
    event.derived = { ...event.derived, grade };
    addUpdate(event, 'derived.grade', grade);
  });

  const writes = [...updates.values()].map(({ event, fields }) => eventsCol(db, uid).doc(event.id).update(fields));
  await Promise.all(writes);
  return writes.length;
}

// ---- Public sharing ------------------------------------------------------
// Opt-in. A handle maps to one user (ledger_handles/{handle} → uid). The
// public view never includes stakes: v2 entries drop their private stake
// reveal (the stake commitment keeps them verifiable); older v1 entries,
// whose stake is inside the hash, are sent redacted and verified by linkage.

export function normalizeHandle(value) {
  const handle = String(value ?? '').trim().toLowerCase();
  return HANDLE_RE.test(handle) ? handle : null;
}

export async function setSharing(db, uid, { enabled, handle: rawHandle }) {
  const headRef = db.collection(LEDGER_COLLECTION).doc(uid);
  return db.runTransaction(async (tx) => {
    const headSnap = await tx.get(headRef);
    const head = headSnap.exists ? headSnap.data() : {};
    const current = head.sharing || {};

    if (!enabled) {
      if (current.handle) tx.delete(db.collection(HANDLE_COLLECTION).doc(current.handle));
      tx.set(headRef, { sharing: { enabled: false, handle: null, since: null } }, { merge: true });
      return { enabled: false, handle: null };
    }

    const handle = normalizeHandle(rawHandle);
    if (!handle) {
      throw new LedgerRejection('invalid_handle', 'Handles are 3–20 characters: lowercase letters, numbers and underscores.');
    }
    const handleRef = db.collection(HANDLE_COLLECTION).doc(handle);
    const owner = await tx.get(handleRef);
    if (owner.exists && owner.data().uid !== uid) {
      throw new LedgerRejection('handle_taken', 'That handle is taken. Try another one.');
    }
    if (current.handle && current.handle !== handle) {
      tx.delete(db.collection(HANDLE_COLLECTION).doc(current.handle));
    }
    const since = current.enabled && current.handle === handle && current.since ? current.since : new Date().toISOString();
    tx.set(handleRef, { uid, handle, since });
    tx.set(headRef, { sharing: { enabled: true, handle, since } }, { merge: true });
    return { enabled: true, handle, since };
  });
}

export async function getSharing(db, uid) {
  const snap = await db.collection(LEDGER_COLLECTION).doc(uid).get();
  const sharing = snap.exists ? snap.data().sharing : null;
  return sharing?.enabled ? { enabled: true, handle: sharing.handle, since: sharing.since } : { enabled: false, handle: null };
}

// Only the private stake reveal is withheld. Everything else, including
// clientBetId, is part of the hashed contents and must stay for viewers to
// verify each entry.
export function toPublicEvent(event) {
  const out = { ...event };
  delete out.private;
  if ('wager' in out) {
    // v1 entry: the stake is part of the hashed contents. Drop it and mark the
    // entry so viewers verify it by its chain links instead.
    delete out.wager;
    out.redacted = true;
  }
  return out;
}

// Returns { handle, since, events } for a public handle, or null.
export async function loadPublicRecord(db, rawHandle) {
  const handle = normalizeHandle(rawHandle);
  if (!handle) return null;
  const mapping = await db.collection(HANDLE_COLLECTION).doc(handle).get();
  if (!mapping.exists) return null;
  const { uid } = mapping.data();
  const sharing = await getSharing(db, uid);
  if (!sharing.enabled || sharing.handle !== handle) return null;
  const events = await loadEvents(db, uid);
  return { handle, since: sharing.since, ledgerId: await ledgerIdFor(uid), events: events.map(toPublicEvent) };
}

// ---- Public anchors ------------------------------------------------------
// A daily fingerprint over every ledger's latest entry, published outside
// EdgeFinder (committed to the public GitHub repo by a scheduled workflow).
// Once a day's anchor is out, nobody — EdgeFinder included — can rewrite any
// record's history before that point without the mismatch being visible.
// Ledgers are listed by an opaque id, never by user id.

export async function ledgerIdFor(uid) {
  return sha256Hex(`edgefinder-ledger:${uid}`);
}

export async function computeAnchor(db, now = Date.now()) {
  const snap = await db.collection(LEDGER_COLLECTION).get();
  const heads = [];
  for (const doc of snap.docs) {
    const head = doc.data();
    if (!head?.headHash || !Number.isInteger(head.seq)) continue;
    heads.push({ ledgerId: await ledgerIdFor(doc.id), seq: head.seq, headHash: head.headHash });
  }
  heads.sort((a, b) => (a.ledgerId < b.ledgerId ? -1 : 1));
  return {
    version: 1,
    generatedAt: new Date(now).toISOString(),
    ledgers: heads.length,
    anchor: await sha256Hex(canonicalJson(heads)),
    heads,
  };
}

// Sports with verified bets starting within `windowMs` — the only odds a
// scheduled close capture needs to fetch.
export async function sportsNeedingCloses(db, now = Date.now(), windowMs = 4 * 60 * 60 * 1000) {
  const snap = await db.collection(OPEN_COLLECTION)
    .where('commenceTime', '<=', new Date(now + windowMs).toISOString())
    .limit(1000)
    .get();
  const sports = new Set();
  snap.docs.forEach(doc => {
    const open = doc.data();
    if (Date.parse(open.commenceTime) > now) sports.add(open.sportKey);
  });
  return [...sports];
}
