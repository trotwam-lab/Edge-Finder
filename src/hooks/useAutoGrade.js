import { useCallback, useEffect, useRef } from 'react';
import { isAutoGradeable } from '../utils/grading.js';
import { settleProfit, todayStr } from '../utils/bets.js';

// Auto-grades personal (self-reported) board bets from final scores, using
// the same server-side rules as the verified record. Verified bets are graded
// through the ledger instead (useVerifiedLedger), so they're skipped here.
const GRADE_AFTER_MS = 90 * 60 * 1000;
const GIVE_UP_MS = 3 * 24 * 60 * 60 * 1000;
const POLL_MS = 10 * 60 * 1000;

// Board bets store their game as "Away vs Home".
export function teamsFromGame(game) {
  const parts = String(game || '').split(' vs ');
  return parts.length === 2 && parts[0].trim() && parts[1].trim()
    ? { awayTeam: parts[0].trim(), homeTeam: parts[1].trim() }
    : { awayTeam: null, homeTeam: null };
}

export function gradeCandidates(bets, verifiedIds = new Set(), now = Date.now()) {
  return (bets || []).filter(bet => {
    if (!bet || bet.deleted || bet.status !== 'pending' || bet.type === 'Parlay' || bet.player) return false;
    if (verifiedIds.has(String(bet.id))) return false;
    if (!bet.sportKey || !bet.marketKey || !bet.outcomeName || !isAutoGradeable(bet)) return false;
    const start = Date.parse(bet.commenceTime || '');
    return Number.isFinite(start) && now - start >= GRADE_AFTER_MS && now - start <= GIVE_UP_MS;
  });
}

export function toGradeItem(bet) {
  return {
    key: String(bet.id),
    gameId: bet.gameId ?? null,
    sportKey: bet.sportKey,
    marketKey: bet.marketKey,
    outcomeName: bet.outcomeName,
    outcomePoint: bet.outcomePoint ?? null,
    commenceTime: bet.commenceTime,
    ...teamsFromGame(bet.game),
  };
}

export function useAutoGrade({ user, bets, setBets, verifiedIds }) {
  const betsRef = useRef(bets);
  betsRef.current = bets;
  const verifiedRef = useRef(verifiedIds);
  verifiedRef.current = verifiedIds;
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (!user || inFlight.current) return;
    const candidates = gradeCandidates(betsRef.current, verifiedRef.current).slice(0, 30);
    if (!candidates.length) return;
    inFlight.current = true;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/verified-bets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grade', bets: candidates.map(toGradeItem) }),
      });
      if (!res.ok) return;
      const { grades } = await res.json();
      if (!grades || !Object.keys(grades).length) return;
      setBets(prev => {
        let changed = false;
        const next = prev.map(bet => {
          const grade = grades[String(bet.id)];
          if (!grade || bet.deleted || bet.status !== 'pending') return bet; // never override the user
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
    } catch {
      // Network hiccup — the next poll retries.
    } finally {
      inFlight.current = false;
    }
  }, [user, setBets]);

  useEffect(() => {
    if (!user) return undefined;
    const first = setTimeout(run, 5000); // let the verified record load first
    const timer = setInterval(run, POLL_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [user, run]);
}
