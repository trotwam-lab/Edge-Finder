// api/_alerts.js — line-move alerts for watchlisted games, delivered by web
// push so they arrive even when EdgeFinder is closed.
//
// Off until VAPID keys are configured (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// VAPID_SUBJECT). Storage is Admin-only: push_subscriptions/{uid} holds the
// user's device subscriptions, their watched games and the last line we
// alerted on for each.

import webpush from 'web-push';

export const PUSH_COLLECTION = 'push_subscriptions';
export const MAX_DEVICES = 5;
export const MAX_WATCH = 50;
const SPREAD_STEP = 1;     // points
const TOTAL_STEP = 1.5;    // points
const ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/;
const SPORT_RE = /^[a-z0-9_]{2,64}$/;

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@edgefinderdaily.com';
  return publicKey && privateKey ? { publicKey, privateKey, subject } : null;
}

// ---- Validation ----------------------------------------------------------
export function sanitizeSubscription(input) {
  const endpoint = typeof input?.endpoint === 'string' ? input.endpoint : '';
  const p256dh = input?.keys?.p256dh;
  const auth = input?.keys?.auth;
  if (!/^https:\/\/[^\s]{8,1000}$/.test(endpoint)) return null;
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint, keys: { p256dh, auth } };
}

export function sanitizeWatch(input) {
  const seen = new Set();
  return (Array.isArray(input) ? input : [])
    .map(w => ({ gameId: String(w?.gameId ?? ''), sportKey: String(w?.sportKey ?? '') }))
    .filter(w => ID_RE.test(w.gameId) && SPORT_RE.test(w.sportKey) && !seen.has(w.gameId) && seen.add(w.gameId))
    .slice(0, MAX_WATCH);
}

// ---- Detection (pure) ----------------------------------------------------
function median(values) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// The market's current line for a game: median home spread and median total
// across books, so one book's stray number can't trigger an alert.
export function lineSnapshot(game) {
  const spreads = [];
  const totals = [];
  (game?.bookmakers || []).forEach(book => {
    const sp = book.markets?.find(m => m.key === 'spreads')?.outcomes?.find(o => o.name === game.home_team)?.point;
    const tot = book.markets?.find(m => m.key === 'totals')?.outcomes?.find(o => o.name === 'Over')?.point;
    if (Number.isFinite(sp)) spreads.push(sp);
    if (Number.isFinite(tot)) totals.push(tot);
  });
  return { spread: median(spreads), total: median(totals) };
}

export function detectMoves(prev, curr) {
  const moves = [];
  if (prev?.spread != null && curr?.spread != null && Math.abs(curr.spread - prev.spread) >= SPREAD_STEP) {
    moves.push({ kind: 'spread', from: prev.spread, to: curr.spread });
  }
  if (prev?.total != null && curr?.total != null && Math.abs(curr.total - prev.total) >= TOTAL_STEP) {
    moves.push({ kind: 'total', from: prev.total, to: curr.total });
  }
  return moves;
}

const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

export function buildAlert(game, moves) {
  const parts = moves.map(m => (m.kind === 'spread'
    ? `${game.home_team} ${signed(m.from)} → ${signed(m.to)}`
    : `total ${m.from} → ${m.to}`));
  return {
    title: `Line move: ${game.away_team} @ ${game.home_team}`,
    body: `${parts.join(' · ')}. Tap to compare books before it moves again.`,
    tag: `move-${game.id}`,
    url: '/',
  };
}

// ---- Run (called by the scheduled job) ------------------------------------
// For every subscriber: refresh the line of each watched pregame game, send
// one notification per game whose line moved past the threshold since the
// last alert (the first look only records a baseline), and drop expired
// device subscriptions.
export async function runLineAlerts(db, { loadSportOdds, send = defaultSend, now = Date.now() } = {}) {
  const config = pushConfig();
  if (!config || !db) return { enabled: false };
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const snap = await db.collection(PUSH_COLLECTION).limit(500).get();
  const docs = snap.docs.map(d => ({ ref: d.ref, data: d.data() })).filter(d => d.data.subscriptions?.length && d.data.watch?.length);
  const sports = [...new Set(docs.flatMap(d => d.data.watch.map(w => w.sportKey)))].slice(0, 12);
  const games = new Map();
  for (const sport of sports) {
    const odds = await loadSportOdds(sport, { maxAgeMs: 2 * 60 * 1000 });
    (odds.ok ? odds.data : []).forEach(g => games.set(g.id, g));
  }

  let sent = 0;
  let removed = 0;
  for (const doc of docs) {
    const lines = { ...(doc.data.lines || {}) };
    const alerts = [];
    doc.data.watch.forEach(({ gameId }) => {
      const game = games.get(gameId);
      if (!game || Date.parse(game.commence_time) <= now) return;
      const curr = lineSnapshot(game);
      const prev = lines[gameId];
      const moves = detectMoves(prev, curr);
      if (!prev || moves.length) lines[gameId] = { ...curr, at: new Date(now).toISOString() };
      if (moves.length) alerts.push(buildAlert(game, moves));
    });

    let subscriptions = doc.data.subscriptions;
    for (const alert of alerts.slice(0, 5)) {
      const keep = [];
      for (const sub of subscriptions) {
        const outcome = await send(sub, alert);
        if (outcome === 'gone') removed += 1;
        else keep.push(sub);
        if (outcome === 'ok') sent += 1;
      }
      subscriptions = keep;
    }
    // Forget games that are over (keeps the doc small).
    Object.keys(lines).forEach(id => { if (!doc.data.watch.some(w => w.gameId === id)) delete lines[id]; });
    await doc.ref.set({ lines, subscriptions, checkedAt: new Date(now).toISOString() }, { merge: true });
  }
  return { enabled: true, users: docs.length, sent, removed };
}

async function defaultSend(subscription, alert) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(alert), { TTL: 60 * 60 });
    return 'ok';
  } catch (error) {
    // 404/410: the browser dropped this subscription — stop sending to it.
    if (error?.statusCode === 404 || error?.statusCode === 410) return 'gone';
    console.warn('push send failed:', error?.statusCode || error?.message);
    return 'error';
  }
}
