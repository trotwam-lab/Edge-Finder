import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeLedgerStats, verifyChain } from '../utils/ledger.js';
import { settleProfit, todayStr } from '../utils/bets.js';
import { isAutoGradeable } from '../utils/grading.js';

// Bets logged from the board are sent here for server verification. Only
// fresh bets qualify (logged in the last 15 minutes): verifying an old bet
// "now" would stamp it with today's time and market, which isn't what the
// user actually did.
const FRESH_WINDOW_MS = 15 * 60 * 1000;
const RETRY_DELAYS_MS = [30 * 1000, 2 * 60 * 1000];
const VERIFIABLE_MARKETS = new Set(['h2h', 'spreads', 'totals']);

export function isVerifiableBet(bet, now = Date.now()) {
  if (!bet || bet.deleted || bet.status !== 'pending') return false;
  if (!bet.gameId || !bet.sportKey || !VERIFIABLE_MARKETS.has(bet.marketKey) || !bet.outcomeName) return false;
  if (!isAutoGradeable(bet)) return false;
  if (bet.player) return false;
  if (!Number.isFinite(Number(bet.odds)) || !(Number(bet.wager) > 0)) return false;
  if (bet.marketKey !== 'h2h' && bet.outcomePoint == null) return false;
  const created = Number(bet.id);
  if (!Number.isFinite(created) || now - created > FRESH_WINDOW_MS || created > now + 60 * 1000) return false;
  const start = Date.parse(bet.commenceTime || '');
  return !Number.isFinite(start) || start > now;
}

const STALE_VERIFYING_MS = 60 * 1000;

function needsAttempt(bet, now) {
  const v = bet.verification;
  if (!v) return true;
  if (v.status === 'retry') return Number(v.nextAt) <= now;
  // Interrupted mid-request (reload, closed tab): safe to resend — the
  // server records each bet id at most once.
  if (v.status === 'verifying') return now - Number(v.startedAt || 0) > STALE_VERIFYING_MS;
  return false;
}

async function authedFetch(user, method, body) {
  const token = await user.getIdToken();
  const res = await fetch('/api/verified-bets', {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

/**
 * useVerifiedLedger — the user's server-verified bet record.
 *
 * Nothing here trusts the personal tracker: the record, its stats and the
 * "Verified" badges all come from the server ledger, and the hash chain is
 * re-checked in this browser. The personal tracker only receives two things
 * back: a cosmetic verification status, and results for bets it still shows
 * as pending.
 */
export function useVerifiedLedger({ user, bets, setBets }) {
  const [state, setState] = useState({ status: 'idle', events: [], chain: null, error: null });
  const [retryTick, setRetryTick] = useState(0);
  const inFlight = useRef(new Set());
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || loadingRef.current) return;
    loadingRef.current = true;
    setState(prev => ({ ...prev, status: prev.events.length ? 'refreshing' : 'loading', error: null }));
    try {
      const { status, data } = await authedFetch(user, 'GET');
      if (status === 200 && data?.available === false) {
        setState({ status: 'unavailable', events: [], chain: null, error: null });
        return;
      }
      if (status !== 200 || !Array.isArray(data?.events)) throw new Error(data?.error || `HTTP ${status}`);
      // Independent check in this browser — we don't take the server's word.
      const chain = await verifyChain(data.events);
      setState({ status: 'ready', events: data.events, chain, sharing: data.sharing || null, ledgerId: data.ledgerId || null, error: null, serverTime: data.serverTime });
    } catch (error) {
      setState(prev => ({ ...prev, status: 'error', error: error.message || 'Could not load your verified record.' }));
    } finally {
      loadingRef.current = false;
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
    else setState({ status: 'idle', events: [], chain: null, error: null });
  }, [user, refresh]);

  const patchBet = useCallback((id, patch) => {
    setBets(prev => prev.map(b => (b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b)));
  }, [setBets]);

  // Auto-verify freshly logged board bets.
  useEffect(() => {
    if (!user || state.status === 'unavailable') return undefined;
    const now = Date.now();
    const due = (bets || []).filter(b => isVerifiableBet(b, now) && needsAttempt(b, now) && !inFlight.current.has(b.id));
    if (!due.length) {
      // Wake up for the next scheduled retry, if any.
      const nextAt = Math.min(...(bets || [])
        .filter(b => isVerifiableBet(b, now) && ['retry', 'verifying'].includes(b.verification?.status))
        .map(b => (b.verification.status === 'retry'
          ? Number(b.verification.nextAt)
          : Number(b.verification.startedAt || 0) + STALE_VERIFYING_MS + 1000)));
      if (!Number.isFinite(nextAt)) return undefined;
      const timer = setTimeout(() => setRetryTick(t => t + 1), Math.max(1000, nextAt - now));
      return () => clearTimeout(timer);
    }

    due.forEach(async bet => {
      inFlight.current.add(bet.id);
      patchBet(bet.id, { verification: { ...(bet.verification || {}), status: 'verifying', startedAt: Date.now() } });
      try {
        const { status, data } = await authedFetch(user, 'POST', {
          action: 'record',
          bet: {
            clientBetId: String(bet.id),
            gameId: bet.gameId,
            sportKey: bet.sportKey,
            marketKey: bet.marketKey,
            outcomeName: bet.outcomeName,
            outcomePoint: bet.outcomePoint ?? null,
            odds: Number(bet.odds),
            wager: Number(bet.wager),
            bookKey: bet.bookKey || null,
          },
        });
        if (status === 200 && data?.verified) {
          patchBet(bet.id, {
            verification: {
              status: 'verified',
              recordedAt: data.event?.recordedAt ?? null,
              recordedOdds: data.event?.odds ?? null,
              priceAdjusted: Boolean(data.event?.priceAdjusted),
            },
          });
          refresh();
        } else if (status === 200 && data?.available === false) {
          patchBet(bet.id, { verification: { status: 'unavailable' } });
          setState(prev => ({ ...prev, status: 'unavailable' }));
        } else if (status === 422 || status === 400) {
          patchBet(bet.id, { verification: { status: 'rejected', reason: data?.reason || 'invalid', message: data?.message || 'Could not verify this bet.' } });
        } else {
          throw new Error(data?.message || `HTTP ${status}`);
        }
      } catch {
        const attempts = (bet.verification?.attempts || 0) + 1;
        patchBet(bet.id, {
          verification: attempts > RETRY_DELAYS_MS.length
            ? { status: 'failed', attempts, message: 'The verification service was unreachable.' }
            : { status: 'retry', attempts, nextAt: Date.now() + RETRY_DELAYS_MS[attempts - 1] },
        });
      } finally {
        inFlight.current.delete(bet.id);
      }
    });
    return undefined;
  }, [bets, user, state.status, retryTick, patchBet, refresh]);

  // Bring server results into the personal tracker for bets it still shows
  // as pending. Never overrides a result the user already set.
  useEffect(() => {
    if (state.status !== 'ready') return;
    const voided = new Set(state.events.filter(e => e.type === 'void').map(e => e.betEventId));
    const results = new Map(state.events
      .filter(e => e.type === 'bet' && !voided.has(e.id) && e.derived?.grade?.result)
      .map(e => [String(e.clientBetId), e.derived.grade]));
    if (!results.size) return;
    setBets(prev => {
      let changed = false;
      const next = prev.map(bet => {
        const grade = results.get(String(bet.id));
        if (!grade || bet.deleted || bet.status !== 'pending') return bet;
        changed = true;
        return {
          ...bet,
          status: grade.result,
          profit: settleProfit(bet, grade.result),
          settledDate: todayStr(),
          gradedBy: 'auto',
          gradeDetail: `${grade.awayTeam} ${grade.awayScore} @ ${grade.homeTeam} ${grade.homeScore}`,
          updatedAt: Date.now(),
        };
      });
      return changed ? next : prev;
    });
  }, [state.status, state.events, setBets]);

  // While verified bets are waiting on a result, check back every 10 minutes.
  useEffect(() => {
    if (state.status !== 'ready') return undefined;
    const now = Date.now();
    const waiting = state.events.some(e => e.type === 'bet' && !e.derived?.grade && Date.parse(e.commenceTime) < now);
    if (!waiting) return undefined;
    const timer = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [state.status, state.events, refresh]);

  const voidVerifiedBet = useCallback(async (clientBetId) => {
    if (!user) return { ok: false, message: 'Please sign in again.' };
    try {
      const { status, data } = await authedFetch(user, 'POST', { action: 'void', clientBetId: String(clientBetId) });
      if (status === 200 && data?.voided) {
        refresh();
        return { ok: true };
      }
      return { ok: false, message: data?.message || 'Could not void this bet.' };
    } catch {
      return { ok: false, message: 'Could not reach the verification service.' };
    }
  }, [user, refresh]);

  const updateSharing = useCallback(async ({ enabled, handle }) => {
    if (!user) return { ok: false, message: 'Please sign in again.' };
    try {
      const { status, data } = await authedFetch(user, 'POST', { action: 'share', enabled: Boolean(enabled), handle });
      if (status === 200 && data?.ok) {
        setState(prev => ({ ...prev, sharing: data.sharing }));
        return { ok: true };
      }
      return { ok: false, message: data?.message || data?.error || 'Could not update sharing.' };
    } catch {
      return { ok: false, message: 'Could not reach the server. Try again.' };
    }
  }, [user]);

  const derived = useMemo(() => {
    const voided = new Set(state.events.filter(e => e.type === 'void').map(e => e.betEventId));
    const byClientId = new Map(state.events
      .filter(e => e.type === 'bet')
      .map(e => [String(e.clientBetId), { ...e, voided: voided.has(e.id) }]));
    return { byClientId, stats: computeLedgerStats(state.events) };
  }, [state.events]);

  return { ...state, ...derived, refresh, voidVerifiedBet, updateSharing };
}
