// useAlerts — in-app alert engine.
// Detects events while the app is open (no server push yet): watchlist line
// moves, slate-wide steam, and the daily report becoming available. Alerts
// persist in localStorage and dedupe by key so refresh cycles don't spam.

import { useCallback, useEffect } from 'react';
import { usePersistentState } from './useOdds.js';
import { getSpreadMoveSignal } from '../utils/odds-math.js';

const MAX_ALERTS = 30;

export function useAlerts({ games = [], watchlist = [], gameLineHistory = {}, historicOdds = {}, tier = 'free' }) {
  const [alerts, setAlerts] = usePersistentState('edgefinder_alerts', []);
  const [notifyEnabled, setNotifyEnabled] = usePersistentState('edgefinder_browser_notify', false);

  const pushAlerts = useCallback((candidates) => {
    if (!candidates.length) return;
    setAlerts(prev => {
      const known = new Set(prev.map(a => a.key));
      const fresh = candidates.filter(a => a?.key && !known.has(a.key));
      if (!fresh.length) return prev;
      if (notifyEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        fresh.slice(0, 3).forEach(a => {
          try { new Notification('EdgeFinder', { body: a.message }); } catch {}
        });
      }
      return [
        ...fresh.map(a => ({ ...a, read: false, ts: Date.now() })),
        ...prev,
      ].slice(0, MAX_ALERTS);
    });
  }, [notifyEnabled, setAlerts]);

  // Daily report ready — once per day for Pro users.
  useEffect(() => {
    if (tier !== 'pro') return;
    const day = new Date().toISOString().slice(0, 10);
    pushAlerts([{
      key: `report-${day}`,
      type: 'report',
      message: 'Your Daily Pro Report is ready — start with the edge board.',
      tab: 'REPORT',
    }]);
  }, [tier, pushAlerts]);

  // Line-move alerts, evaluated on every odds refresh. Watchlist games alert
  // at a 1-point move; anything else needs a 2-point steam move. Keys include
  // the current number so a line that keeps moving re-alerts at each new spread.
  useEffect(() => {
    if (!games.length) return;
    const candidates = [];
    games.forEach(game => {
      if (!game?.commence_time || Date.parse(game.commence_time) < Date.now() - 3 * 60 * 60 * 1000) return;
      const history = gameLineHistory?.[game.id] || [];
      const opener = historicOdds?.[game.id]?.spread ?? history[0]?.spread ?? null;
      const current = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')
        ?.outcomes?.find(o => o.name === game.home_team)?.point ?? null;
      const signal = getSpreadMoveSignal(game, history, opener, current);
      if (!signal) return;

      if (watchlist.includes(game.id) && signal.moveAbs >= 1) {
        candidates.push({
          key: `watch-${game.id}-${current}`,
          type: 'watchlist',
          message: `Watchlist: ${game.away_team} @ ${game.home_team} spread moved ${signal.detail}, toward ${signal.team}.`,
          tab: 'GAMES',
        });
      } else if (signal.moveAbs >= 2) {
        candidates.push({
          key: `steam-${game.id}-${current}`,
          type: 'steam',
          message: `Steam: ${game.away_team} @ ${game.home_team} spread ${signal.detail} since open.`,
          tab: 'GAMES',
        });
      }
    });
    pushAlerts(candidates);
  }, [games, watchlist, gameLineHistory, historicOdds, pushAlerts]);

  const unreadCount = alerts.filter(a => !a.read).length;

  const markAllRead = useCallback(() => {
    setAlerts(prev => prev.some(a => !a.read) ? prev.map(a => a.read ? a : { ...a, read: true }) : prev);
  }, [setAlerts]);

  const clearAlerts = useCallback(() => setAlerts([]), [setAlerts]);

  const requestBrowserNotifications = useCallback(async () => {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') {
      setNotifyEnabled(true);
      return true;
    }
    try {
      const permission = await Notification.requestPermission();
      const granted = permission === 'granted';
      setNotifyEnabled(granted);
      return granted;
    } catch {
      return false;
    }
  }, [setNotifyEnabled]);

  return { alerts, unreadCount, markAllRead, clearAlerts, notifyEnabled, requestBrowserNotifications };
}
