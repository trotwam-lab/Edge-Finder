// api/verified-bets.js — the signed-in user's verified bet record.
//
// GET                              → your ledger events, server chain check, stats
// POST { action: 'record', bet }   → verify a bet against the live market and record it
// POST { action: 'void', clientBetId } → void a verified bet (pregame only)
//
// Identity always comes from the verified Firebase ID token. See
// api/_ledger.js for the rules that make the record trustworthy.

import { getVerifiedUser } from './_auth.js';
import { getAdminDb } from './_firebaseAdmin.js';
import { guardRequest } from './_http.js';
import { coalescedJson } from './_upstream.js';
import { loadSportOdds } from './_oddsFeed.js';
import {
  LedgerRejection,
  gradePendingEvents,
  loadEvents,
  recordBet,
  sanitizeClaim,
  voidBet,
} from './_ledger.js';
import { computeLedgerStats, verifyChain } from '../src/utils/ledger.js';

const SPORT_RE = /^[a-z0-9_]{2,64}$/;
const scoresCache = new Map();
const SCORES_TTL = 2 * 60 * 1000;

async function fetchScoreRows(sport) {
  if (!SPORT_RE.test(sport)) return null;
  const cached = scoresCache.get(sport);
  if (cached && Date.now() - cached.ts < SCORES_TTL) return cached.data;
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return null;
  const result = await coalescedJson(`https://api.the-odds-api.com/v4/sports/${sport}/scores?apiKey=${apiKey}&daysFrom=3`);
  if (!result.ok || !Array.isArray(result.data)) return null;
  scoresCache.set(sport, { data: result.data, ts: Date.now() });
  return result.data;
}

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
      return res.status(200).json({
        available: true,
        events,
        chain,
        stats: computeLedgerStats(events),
        serverTime: new Date().toISOString(),
      });
    }

    const body = parseBody(req);
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
