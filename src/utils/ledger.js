// src/utils/ledger.js
// The verified bet ledger: shared by the server (which writes it) and the
// browser (which independently re-checks it). Kept dependency-free so the
// exact same hashing and stats code runs in both places.
//
// Trust model, in plain terms:
//   * Only the server writes ledger events, from a collection clients can't
//     touch. The server stamps its own time and checks the game hadn't started
//     and that the price was really on the board.
//   * Events form a hash chain: each event's hash covers its contents plus the
//     previous event's hash. Editing, removing or reordering any past event
//     breaks every hash after it, and your browser re-verifies the whole chain.
//   * Results and closing lines are NOT part of the chain — they're derived
//     from public final scores and the public market, so anyone can recompute
//     them. Stats below are computed only from ledger data, never from the
//     editable personal tracker.

export const GENESIS_HASH = '0'.repeat(64);

// Deterministic JSON: object keys sorted, undefined dropped. The server and
// the browser must serialize an event byte-for-byte identically.
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(v => (v === undefined ? 'null' : canonicalJson(v))).join(',')}]`;
  }
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

// Everything except the event's own hash and the derived (recomputable)
// fields is covered by the hash.
export function hashedPart(event) {
  const { hash: _hash, derived: _derived, ...core } = event || {};
  return core;
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function computeEventHash(event) {
  return sha256Hex(canonicalJson(hashedPart(event)));
}

// Re-verifies a whole chain. Returns { valid, checked, brokenAtSeq, reason }.
export async function verifyChain(events) {
  const ordered = [...(events || [])].sort((a, b) => a.seq - b.seq);
  let prev = GENESIS_HASH;
  for (let i = 0; i < ordered.length; i += 1) {
    const event = ordered[i];
    if (event.seq !== i + 1) {
      return { valid: false, checked: i, brokenAtSeq: i + 1, reason: 'missing or reordered entry' };
    }
    if (event.prevHash !== prev) {
      return { valid: false, checked: i, brokenAtSeq: event.seq, reason: 'link to previous entry does not match' };
    }
    const expected = await computeEventHash(event);
    if (expected !== event.hash) {
      return { valid: false, checked: i, brokenAtSeq: event.seq, reason: 'entry contents were changed after recording' };
    }
    prev = event.hash;
  }
  return { valid: true, checked: ordered.length, brokenAtSeq: null, reason: null };
}

export function americanToDecimalOdds(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || (n > -100 && n < 100)) return null;
  return n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
}

// Closing-line value of a verified bet: EV of the recorded price measured
// against the no-vig market consensus at the close. +2.0 = the price was 2%
// better than the fair closing price.
export function closingEvPct(bet) {
  const decimal = americanToDecimalOdds(bet?.odds);
  const fair = Number(bet?.derived?.close?.fairProb);
  if (!decimal || !Number.isFinite(fair) || fair <= 0 || fair >= 1) return null;
  return Number(((decimal * fair - 1) * 100).toFixed(2));
}

// Bets still in the record: voided bets (voids are only allowed before the
// game starts, so they can't hide a loser) are listed but excluded from stats.
export function activeBets(events) {
  const voided = new Set((events || []).filter(e => e.type === 'void').map(e => e.betEventId));
  return (events || []).filter(e => e.type === 'bet').map(bet => ({ ...bet, voided: voided.has(bet.id) }));
}

const round = (n, d = 2) => Number(n.toFixed(d));

// Record stats computed from ledger data only.
// * Flat units: every bet counts as 1 unit, so stake sizing can't flatter it.
// * Expected units: what the bets were worth at the closing price (sum of
//   closing EV). Actual minus expected is variance — luck — not skill.
export function computeLedgerStats(events) {
  const bets = activeBets(events).filter(b => !b.voided);
  let wins = 0; let losses = 0; let pushes = 0; let pending = 0;
  let flatUnits = 0; let staked = 0; let stakeProfit = 0;
  let clvSum = 0; let clvCount = 0; let beatClose = 0;
  let expectedUnits = 0; let actualOnClvBets = 0; let clvGradedCount = 0;

  bets.forEach(bet => {
    const result = bet.derived?.grade?.result;
    const decimal = americanToDecimalOdds(bet.odds);
    const clv = closingEvPct(bet);
    if (clv != null) {
      clvSum += clv;
      clvCount += 1;
      if (clv > 0) beatClose += 1;
    }
    if (!result || !decimal) { pending += 1; return; }
    const unit = result === 'won' ? decimal - 1 : result === 'lost' ? -1 : 0;
    if (result === 'won') wins += 1;
    else if (result === 'lost') losses += 1;
    else pushes += 1;
    flatUnits += unit;
    const wager = Number(bet.wager) || 0;
    staked += wager;
    stakeProfit += wager * unit;
    if (clv != null) {
      expectedUnits += clv / 100;
      actualOnClvBets += unit;
      clvGradedCount += 1;
    }
  });

  const graded = wins + losses + pushes;
  return {
    total: bets.length,
    voided: activeBets(events).filter(b => b.voided).length,
    wins, losses, pushes, pending, graded,
    winPct: wins + losses ? round((wins / (wins + losses)) * 100, 1) : null,
    flatUnits: round(flatUnits),
    flatRoi: graded ? round((flatUnits / graded) * 100, 1) : null,
    stakeRoi: staked > 0 ? round((stakeProfit / staked) * 100, 1) : null,
    stakeProfit: round(stakeProfit),
    avgClv: clvCount ? round(clvSum / clvCount) : null,
    beatCloseRate: clvCount ? round((beatClose / clvCount) * 100, 1) : null,
    clvCount,
    expectedUnits: clvGradedCount ? round(expectedUnits) : null,
    actualUnitsOnClvBets: clvGradedCount ? round(actualOnClvBets) : null,
    luckUnits: clvGradedCount ? round(actualOnClvBets - expectedUnits) : null,
    clvGradedCount,
  };
}
