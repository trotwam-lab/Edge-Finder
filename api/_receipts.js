// api/_receipts.js — Edge Receipts: snapshot + grading logic.
//
// "Yesterday's Receipts" is the public, auto-graded track record of the edge
// scan. Every time the edge scan runs on fresh odds (api/edges.js), we:
//   1. snapshot today's top edges the first time each is flagged, and
//   2. refresh the no-vig consensus ("closing") probability for every edge
//      still pregame, so the last observation before tip-off becomes the
//      closing line.
// Grading happens at read time: an edge "beat the close" when the price we
// flagged still clears the market's final fair probability (positive EV at
// close) — the standard closing-line-value test.
//
// Storage: Firestore collection `edge_receipts`, one doc per ET date
// (YYYY-MM-DD). Only the Admin SDK touches it; client rules deny access.

// Max edges snapshotted per day — enough to be a real record, small enough
// to read cheaply and render as a card.
const MAX_EDGES_PER_DAY = 12;

const COLLECTION = 'edge_receipts';

// US sports days roll over on Eastern Time. Get today's ET calendar date
// first, then shift in pure calendar space — shifting the timestamp by
// 24h-per-day before formatting mislabels the hour after a DST transition,
// which would file edges under the wrong day in a date-keyed ledger.
export function etDateString(offsetDays = 0) {
  const etToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (!offsetDays) return etToday;
  const [y, m, d] = etToday.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + offsetDays)).toISOString().slice(0, 10);
}

function americanToDecimal(american) {
  if (american > 0) return american / 100 + 1;
  return 100 / Math.abs(american) + 1;
}

// Firestore map keys must not contain '.' or other field-path characters.
export function receiptKey(edge) {
  const raw = `${edge.gameId}|${edge.market}|${edge.outcomeName}|${edge.outcomePoint ?? ''}`;
  return raw.replace(/[^\w-]/g, '_');
}

export function probIndexKey(gameId, market, outcomeName, outcomePoint) {
  return `${gameId}|${market}|${outcomeName}|${outcomePoint ?? ''}`;
}

// Games starting inside this window grade out by the next morning. Books
// post soft lines on games weeks or months ahead (NFL openers in July) that
// show big EV, but a receipt that stays PENDING for two months proves
// nothing — near-term games get the day's slots first.
const NEAR_TERM_WINDOW_MS = 36 * 60 * 60 * 1000;

// Dedupe to one edge per outcome (the best price already wins on EV sort),
// prefer edges whose game starts soon, and cap the day at MAX_EDGES_PER_DAY.
// Far-out lines only fill whatever slots the near-term slate leaves empty.
function pickSnapshotEdges(edges) {
  const seen = new Set();
  const nearTerm = [];
  const futures = [];
  const cutoff = Date.now() + NEAR_TERM_WINDOW_MS;
  for (const edge of edges) {
    if (edge.outcomeName == null) continue;
    const key = receiptKey(edge);
    if (seen.has(key)) continue;
    seen.add(key);
    const start = Date.parse(edge.commenceTime);
    if (Number.isFinite(start) && start <= cutoff) {
      nearTerm.push(edge);
    } else {
      futures.push(edge);
    }
    if (nearTerm.length >= MAX_EDGES_PER_DAY) break;
  }
  return nearTerm.concat(futures).slice(0, MAX_EDGES_PER_DAY);
}

// Called from the edge scan after every fresh odds fetch.
// `edges`: today's flagged edges (EV desc). `probIndex`: Map of
// probIndexKey -> { fairProb, bestPrice, commenceTime } for EVERY outcome we
// saw this scan (not just +EV ones), so previously-flagged edges keep getting
// closing updates after their EV fades.
export async function updateReceiptsSnapshot(db, edges, probIndex) {
  if (!db) return;
  const today = etDateString(0);
  const yesterday = etDateString(-1);
  const nowIso = new Date().toISOString();

  const [todaySnap, yesterdaySnap] = await Promise.all([
    db.collection(COLLECTION).doc(today).get(),
    db.collection(COLLECTION).doc(yesterday).get(),
  ]);

  const todayDoc = todaySnap.exists ? todaySnap.data() : { date: today, edges: {} };
  todayDoc.edges = todayDoc.edges || {};
  const yesterdayDoc = yesterdaySnap.exists ? yesterdaySnap.data() : null;
  let touchedToday = false;

  const isNearTerm = (commenceTime) => {
    const start = Date.parse(commenceTime);
    return Number.isFinite(start) && start <= Date.now() + NEAR_TERM_WINDOW_MS;
  };

  // 1. Snapshot new edges flagged today (first-seen price is the record).
  for (const edge of pickSnapshotEdges(edges)) {
    const key = receiptKey(edge);
    if (todayDoc.edges[key]) continue;
    if (Object.keys(todayDoc.edges).length >= MAX_EDGES_PER_DAY) {
      // Day is full. Near-term slates often post after morning scans have
      // already stored far-out lines, so a near-term edge may displace the
      // weakest far-future entry — it would sit PENDING for weeks anyway.
      // Nothing near-term (gradeable tomorrow) is ever evicted.
      if (!isNearTerm(edge.commenceTime)) continue;
      const evictKey = Object.entries(todayDoc.edges)
        .filter(([, entry]) => !isNearTerm(entry.commenceTime))
        .sort(([, a], [, b]) => (a.flaggedEv ?? 0) - (b.flaggedEv ?? 0))[0]?.[0];
      if (!evictKey) continue;
      delete todayDoc.edges[evictKey];
    }
    touchedToday = true;
    todayDoc.edges[key] = {
      sport: edge.sport,
      emoji: edge.emoji,
      game: edge.game,
      gameId: edge.gameId,
      commenceTime: edge.commenceTime,
      edge: edge.edge,
      book: edge.book,
      market: edge.market,
      outcomeName: edge.outcomeName,
      outcomePoint: edge.outcomePoint ?? null,
      flaggedPrice: edge.price,
      flaggedEv: edge.ev,
      confidence: edge.confidence,
      firstSeenAt: nowIso,
      closeFairProb: null,
      closeBestPrice: null,
      lastSeenAt: null,
    };
  }

  // 2. Refresh closing observations for every stored edge still pregame.
  let touchedYesterday = false;
  const refresh = (doc) => {
    let touched = false;
    for (const entry of Object.values(doc.edges || {})) {
      const started = Date.parse(entry.commenceTime) <= Date.now();
      if (started && entry.lastSeenAt) continue; // close already locked in
      const probKey = probIndexKey(entry.gameId, entry.market, entry.outcomeName, entry.outcomePoint);
      const current = probIndex.get(probKey);
      if (!current) continue;
      entry.closeFairProb = current.fairProb;
      entry.closeBestPrice = current.bestPrice;
      entry.lastSeenAt = nowIso;
      touched = true;
    }
    return touched;
  };

  if (refresh(todayDoc)) touchedToday = true;
  if (yesterdayDoc) touchedYesterday = refresh(yesterdayDoc);

  // Only write what actually changed — this runs every scan (~1/min), and
  // idle days would otherwise burn ~1,440 no-op Firestore writes.
  const writes = [];
  if (touchedToday) {
    todayDoc.updatedAt = nowIso;
    writes.push(db.collection(COLLECTION).doc(today).set(todayDoc));
  }
  if (touchedYesterday) {
    yesterdayDoc.updatedAt = nowIso;
    writes.push(db.collection(COLLECTION).doc(yesterday).set(yesterdayDoc));
  }
  if (writes.length) await Promise.all(writes);
}

// Grade a stored edge against its last pregame observation.
// Returns null while the game hasn't started or we never re-observed it.
export function gradeEdge(entry) {
  const started = Date.parse(entry.commenceTime) <= Date.now();
  if (!started || entry.closeFairProb == null || entry.flaggedPrice == null) return null;
  const closingEv = (americanToDecimal(entry.flaggedPrice) * entry.closeFairProb - 1) * 100;
  return {
    closingEv: parseFloat(closingEv.toFixed(1)),
    beatClose: closingEv > 0,
  };
}

export function summarizeDay(doc) {
  const entries = Object.values(doc?.edges || {});
  let beat = 0;
  let missed = 0;
  let pending = 0;
  const clvValues = [];
  const graded = entries.map(entry => {
    const grade = gradeEdge(entry);
    if (!grade) {
      pending += 1;
    } else if (grade.beatClose) {
      beat += 1;
      clvValues.push(grade.closingEv);
    } else {
      missed += 1;
      clvValues.push(grade.closingEv);
    }
    return { ...entry, grade };
  });
  const avgClv = clvValues.length
    ? parseFloat((clvValues.reduce((a, b) => a + b, 0) / clvValues.length).toFixed(1))
    : null;
  return { beat, missed, pending, avgClv, graded };
}
