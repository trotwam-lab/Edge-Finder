import { describe, expect, it } from 'vitest';
import {
  GENESIS_HASH, canonicalJson, closingEvPct, computeEventHash, computeLedgerStats, verifyChain,
} from './ledger.js';

async function chain(specs) {
  const events = [];
  let prev = GENESIS_HASH;
  for (let i = 0; i < specs.length; i += 1) {
    const event = { ...specs[i], seq: i + 1, prevHash: prev, recordedAt: `2026-10-0${i + 1}T12:00:00.000Z` };
    event.hash = await computeEventHash(event);
    prev = event.hash;
    events.push(event);
  }
  return events;
}

describe('canonicalJson', () => {
  it('is independent of key order and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, null], c: 'x' }, z: undefined }))
      .toBe(canonicalJson({ a: { c: 'x', d: [1, null] }, b: 1 }));
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});

describe('verifyChain', () => {
  const specs = [
    { id: 'b_1', type: 'bet', odds: -110, wager: 100 },
    { id: 'b_2', type: 'bet', odds: 150, wager: 50 },
    { id: 'v_2', type: 'void', betEventId: 'b_2' },
  ];

  it('accepts an untouched chain, ignoring derived results', async () => {
    const events = await chain(specs);
    events[0].derived = { grade: { result: 'won' } };
    expect(await verifyChain(events)).toMatchObject({ valid: true, checked: 3 });
  });

  it('detects an edited entry', async () => {
    const events = await chain(specs);
    events[0].odds = 200;
    expect(await verifyChain(events)).toMatchObject({ valid: false, brokenAtSeq: 1 });
  });

  it('detects a deleted entry', async () => {
    const events = await chain(specs);
    expect(await verifyChain([events[0], events[2]])).toMatchObject({ valid: false, brokenAtSeq: 2 });
  });

  it('detects a rebuilt entry that no longer links to its predecessor', async () => {
    const events = await chain(specs);
    const forged = { ...events[1], odds: 500 };
    forged.hash = await computeEventHash(forged); // re-hashed, but the next link breaks
    expect(await verifyChain([events[0], forged, events[2]])).toMatchObject({ valid: false, brokenAtSeq: 3 });
  });
});

describe('computeLedgerStats', () => {
  const bet = (id, odds, result, fairProb, wager = 100) => ({
    id, type: 'bet', odds, wager,
    derived: {
      ...(result ? { grade: { result } } : {}),
      ...(fairProb != null ? { close: { fairProb } } : {}),
    },
  });

  it('uses flat units, excludes voids, and splits results from closing value', () => {
    const events = [
      bet('b_1', 100, 'won', 0.55),   // +1u, CLV +10%
      bet('b_2', 100, 'lost', 0.45),  // -1u, CLV -10%
      bet('b_3', -200, 'push', null),
      bet('b_4', 150, null, 0.5),     // pending, CLV +25%
      bet('b_5', 300, 'won', null, 1000),
      { id: 'v_5', type: 'void', betEventId: 'b_5' },
    ];
    const stats = computeLedgerStats(events);
    expect(stats).toMatchObject({ total: 4, voided: 1, wins: 1, losses: 1, pushes: 1, pending: 1, flatUnits: 0, winPct: 50 });
    expect(stats.flatRoi).toBe(0);
    expect(stats.avgClv).toBeCloseTo(8.33, 2);
    expect(stats.beatCloseRate).toBeCloseTo(66.7, 1);
    expect(stats.expectedUnits).toBe(0);
    expect(stats.luckUnits).toBe(0);
  });

  it('computes closing EV from the recorded price and the no-vig close', () => {
    expect(closingEvPct({ odds: 100, derived: { close: { fairProb: 0.55 } } })).toBe(10);
    expect(closingEvPct({ odds: -110, derived: {} })).toBeNull();
  });
});
