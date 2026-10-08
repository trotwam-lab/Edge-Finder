// api/verified-bets.js — the signed-in user's verified bet record.
//
// GET                              → your ledger events, server chain check, stats
// GET ?handle=name                 → a publicly shared record (no sign-in; no stakes)
// POST { action: 'share', enabled, handle } → turn public sharing on/off
// POST { action: 'grade', bets: [...] }  → grade personal board bets (no writes)
// POST { action: 'record', bet }   → verify a bet against the live market and record it
// POST { action: 'void', clientBetId } → void a verified bet (pregame only)
//
// Identity always comes from the verified Firebase ID token. See
// api/_ledger.js for the rules that make the record trustworthy.

import { getVerifiedUser } from './_auth.js';
import { getAdminDb } from './_firebaseAdmin.js';
import { guardRequest } from './_http.js';
import { fetchScoreRows } from './_scores.js';
import { loadSportOdds } from './_oddsFeed.js';
import {
  LedgerRejection,
  getSharing,
  gradePendingEvents,
  gradeUnverified,
  ledgerIdFor,
  sanitizeGradeRequest,
  loadEvents,
  loadPublicRecord,
  recordParlay,
  sanitizeParlayClaim,
  setSharing,
  recordBet,
  sanitizeClaim,
  voidBet,
} from './_ledger.js';
import { computeLedgerStats, verifyChain } from '../src/utils/ledger.js';

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

function rejection(res, error) {
  return res.status(422).json({ verified: false, reason: error.reason, message: error.message, details: error.details ?? null });
}

export default async function handler(req, res, deps = {}) {
  if (guardRequest(req, res, { route: 'verified-bets', methods: ['GET', 'POST'], rateLimit: 60 })) return;
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  // Public, read-only view of a record its owner chose to share.
  if (req.method === 'GET' && req.query?.handle != null) {
    const publicDb = 'db' in deps ? deps.db : getAdminDb();
    if (!publicDb) return res.status(200).json({ available: false });
    try {
      const record = await loadPublicRecord(publicDb, req.query.handle);
      if (!record) return res.status(404).json({ error: 'No public record with that name.' });
      return res.status(200).json({
        available: true,
        handle: record.handle,
        since: record.since,
        ledgerId: record.ledgerId,
        events: record.events,
        stats: computeLedgerStats(record.events),
        serverTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('public record failed:', error.message);
      return res.status(500).json({ error: 'Could not load this record.' });
    }
  }

  const user = await (deps.getVerifiedUser || getVerifiedUser)(req);
  if (!user) return res.status(401).json({ error: 'Please sign in again.' });

  const db = 'db' in deps ? deps.db : getAdminDb();
  if (!db) return res.status(200).json({ available: false });

  const loadOdds = deps.loadSportOdds || loadSportOdds;
  const scores = deps.fetchScoreRows || fetchScoreRows;

  try {
    if (req.method === 'GET') {
      const events = await loadEvents(db, user.uid);
      try {
        await gradePendingEvents(db, user.uid, events, scores);
      } catch (error) {
        console.warn('Ledger grading skipped:', error.message);
      }
      const chain = await verifyChain(events);
      const sharing = await getSharing(db, user.uid);
      return res.status(200).json({
        available: true,
        sharing,
        ledgerId: await ledgerIdFor(user.uid),
        events,
        chain,
        stats: computeLedgerStats(events),
        serverTime: new Date().toISOString(),
      });
    }

    const body = parseBody(req);
    if (body.action === 'record' && Array.isArray(body.bet?.legs)) {
      const { claim, error } = sanitizeParlayClaim(body.bet);
      if (error) return res.status(400).json({ verified: false, reason: 'invalid', message: error });
      const gamesBySport = new Map();
      for (const sport of new Set(claim.legs.map(l => l.sportKey))) {
        const odds = await loadOdds(sport, { maxAgeMs: 60 * 1000 });
        if (!odds.ok) {
          return res.status(503).json({ verified: false, reason: 'market_unavailable', message: 'Couldn\'t reach the odds feed to verify this parlay. It\'s saved to your tracker — try again in a minute.' });
        }
        gamesBySport.set(sport, odds.data);
      }
      const { event, duplicate } = await recordParlay(db, user.uid, claim, gamesBySport);
      return res.status(200).json({ verified: true, duplicate, event });
    }

    if (body.action === 'record') {
      const { claim, error } = sanitizeClaim(body.bet);
      if (error) return res.status(400).json({ verified: false, reason: 'invalid', message: error });
      const odds = await loadOdds(claim.sportKey, { maxAgeMs: 60 * 1000 });
      if (!odds.ok) {
        return res.status(503).json({ verified: false, reason: 'market_unavailable', message: 'Couldn\'t reach the odds feed to verify this bet. It\'s saved to your tracker — try verifying again in a minute.' });
      }
      const { event, duplicate } = await recordBet(db, user.uid, claim, odds.data);
      return res.status(200).json({ verified: true, duplicate, event });
    }

    if (body.action === 'grade') {
      const items = sanitizeGradeRequest(body.bets);
      const grades = await gradeUnverified(items, scores);
      return res.status(200).json({ grades });
    }

    if (body.action === 'share') {
      const sharing = await setSharing(db, user.uid, { enabled: body.enabled === true, handle: body.handle });
      return res.status(200).json({ ok: true, sharing });
    }

    if (body.action === 'void') {
      const { event, duplicate } = await voidBet(db, user.uid, body.clientBetId);
      return res.status(200).json({ voided: true, duplicate, event });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    if (error instanceof LedgerRejection) return rejection(res, error);
    console.error('verified-bets failed:', error.message);
    return res.status(500).json({ error: 'Verification service error. Your bet is still saved in your tracker.' });
  }
}
