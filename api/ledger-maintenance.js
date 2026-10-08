// api/ledger-maintenance.js — scheduled upkeep for the verified bet ledger.
//
// GET  ?task=anchor  → public: today's fingerprint over every ledger's latest
//                      entry (see computeAnchor). A GitHub workflow commits it
//                      to the public repo once a day.
// POST ?task=closes  → records closing lines for verified bets starting soon,
//                      without waiting for someone to load the dashboard.
//                      Only fetches odds for sports that actually have such
//                      bets. Protected by LEDGER_CRON_SECRET when it is set.

import { timingSafeEqual } from 'node:crypto';
import { getAdminDb } from './_firebaseAdmin.js';
import { guardRequest } from './_http.js';
import { loadSportOdds } from './_oddsFeed.js';
import { buildProbIndex } from './_consensus.js';
import { computeAnchor, sportsNeedingCloses, updateLedgerCloses } from './_ledger.js';

const MAX_SPORTS_PER_RUN = 10;
const anchorCache = { data: null, ts: 0 };
const ANCHOR_TTL = 5 * 60 * 1000;

function authorized(req) {
  const secret = process.env.LEDGER_CRON_SECRET;
  if (!secret) return true; // capturing a close is idempotent and cheap to repeat
  const header = req.headers?.authorization || '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : req.headers?.['x-cron-secret'];
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res, deps = {}) {
  if (guardRequest(req, res, { route: 'ledger-maintenance', methods: ['GET', 'POST'], rateLimit: 30 })) return;
  res.setHeader('Cache-Control', 'no-store');
  const db = 'db' in deps ? deps.db : getAdminDb();
  const task = req.query?.task;

  if (task === 'anchor' && req.method === 'GET') {
    if (!db) return res.status(200).json({ available: false });
    try {
      if (!anchorCache.data || Date.now() - anchorCache.ts > ANCHOR_TTL || deps.noCache) {
        anchorCache.data = await computeAnchor(db);
        anchorCache.ts = Date.now();
      }
      return res.status(200).json({ available: true, ...anchorCache.data });
    } catch (error) {
      console.error('anchor failed:', error.message);
      return res.status(500).json({ error: 'Could not compute the anchor.' });
    }
  }

  if (task === 'closes' && req.method === 'POST') {
    if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized' });
    if (!db) return res.status(200).json({ available: false });
    const loadOdds = deps.loadSportOdds || loadSportOdds;
    try {
      const sports = (await sportsNeedingCloses(db)).slice(0, MAX_SPORTS_PER_RUN);
      const games = [];
      for (const sport of sports) {
        const odds = await loadOdds(sport, { maxAgeMs: 60 * 1000 });
        if (odds.ok && Array.isArray(odds.data)) games.push(...odds.data);
      }
      const result = await updateLedgerCloses(db, buildProbIndex(games));
      return res.status(200).json({ ok: true, sports, ...result });
    } catch (error) {
      console.error('ledger closes failed:', error.message);
      return res.status(500).json({ error: 'Close capture failed.' });
    }
  }

  return res.status(400).json({ error: 'Unknown task' });
}
