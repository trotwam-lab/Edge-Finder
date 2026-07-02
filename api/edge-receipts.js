// api/edge-receipts.js — Public, auto-graded track record of the edge scan.
//
// GET returns yesterday's edges graded against their closing lines plus
// rolling 7/30-day stats. Deliberately public and ungated: yesterday's board
// can't be bet anymore, so full transparency on it is the proof that today's
// (Pro) edges are worth paying for.

import { getAdminDb } from './_firebaseAdmin.js';
import { etDateString, summarizeDay } from './_receipts.js';

const cache = { data: null, ts: 0 };
const TTL = 2 * 60 * 1000; // 2 minutes — this data changes slowly

const COLLECTION = 'edge_receipts';

function publicEdge(entry) {
  return {
    sport: entry.sport,
    emoji: entry.emoji,
    game: entry.game,
    edge: entry.edge,
    book: entry.book,
    flaggedPrice: entry.flaggedPrice,
    flaggedEv: entry.flaggedEv,
    confidence: entry.confidence,
    commenceTime: entry.commenceTime,
    closingEv: entry.grade?.closingEv ?? null,
    beatClose: entry.grade?.beatClose ?? null,
  };
}

function rollingStats(docs) {
  let beat = 0;
  let missed = 0;
  const clvValues = [];
  docs.forEach(doc => {
    const summary = summarizeDay(doc);
    beat += summary.beat;
    missed += summary.missed;
    summary.graded.forEach(entry => {
      if (entry.grade) clvValues.push(entry.grade.closingEv);
    });
  });
  const graded = beat + missed;
  return {
    beat,
    missed,
    graded,
    beatRate: graded ? Math.round((beat / graded) * 100) : null,
    avgClv: clvValues.length
      ? parseFloat((clvValues.reduce((a, b) => a + b, 0) / clvValues.length).toFixed(1))
      : null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (cache.data && Date.now() - cache.ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache.data);
  }

  const db = getAdminDb();
  if (!db) {
    // No Firestore credentials (e.g. local dev) — the client hides the card.
    return res.status(200).json({ available: false });
  }

  try {
    const yesterdayId = etDateString(-1);
    const d7Id = etDateString(-7);
    const d30Id = etDateString(-30);
    const todayId = etDateString(0);

    // Doc ids are YYYY-MM-DD so lexicographic range == date range. Grab the
    // last 30 days once and slice locally for the 7-day window.
    const snap = await db.collection(COLLECTION)
      .where('date', '>=', d30Id)
      .get();

    const docs = snap.docs.map(d => d.data());
    const yesterdayDoc = docs.find(d => d.date === yesterdayId) || null;
    const todayDoc = docs.find(d => d.date === todayId) || null;
    // Rolling windows exclude today: those edges are still open.
    const pastDocs = docs.filter(d => d.date !== todayId);
    const last7 = pastDocs.filter(d => d.date >= d7Id);

    const yesterdaySummary = yesterdayDoc ? summarizeDay(yesterdayDoc) : null;

    const payload = {
      available: true,
      yesterday: yesterdaySummary
        ? {
            date: yesterdayId,
            beat: yesterdaySummary.beat,
            missed: yesterdaySummary.missed,
            pending: yesterdaySummary.pending,
            avgClv: yesterdaySummary.avgClv,
            edges: yesterdaySummary.graded
              .sort((a, b) => (b.grade?.closingEv ?? -Infinity) - (a.grade?.closingEv ?? -Infinity))
              .map(publicEdge),
          }
        : null,
      rolling: {
        d7: rollingStats(last7),
        d30: rollingStats(pastDocs),
      },
      todayCount: todayDoc ? Object.keys(todayDoc.edges || {}).length : 0,
    };

    cache.data = payload;
    cache.ts = Date.now();
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (e) {
    console.error('edge-receipts failed:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
