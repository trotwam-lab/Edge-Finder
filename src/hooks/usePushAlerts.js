import { useCallback, useEffect, useRef, useState } from 'react';

// Background line-move alerts (web push) for starred games. The server sends
// them on a schedule, so they arrive even when EdgeFinder is closed.
const FLAG = 'edgefinder_push_enabled';

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

function supported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function registration() {
  // navigator.serviceWorker.ready never settles without a service worker
  // (e.g. local dev), so give up after a few seconds.
  return Promise.race([navigator.serviceWorker.ready, new Promise(resolve => setTimeout(() => resolve(null), 5000))]);
}

async function post(user, body) {
  const token = await user.getIdToken();
  const res = await fetch('/api/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

export function usePushAlerts({ user, watch }) {
  const [status, setStatus] = useState('checking'); // checking | unsupported | unavailable | denied | off | on | working
  const [error, setError] = useState('');
  const keyRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supported()) { setStatus('unsupported'); return; }
      try {
        const res = await fetch('/api/push?task=key');
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (!data?.enabled) { setStatus('unavailable'); return; }
        keyRef.current = data.publicKey;
        if (Notification.permission === 'denied') { setStatus('denied'); return; }
        const reg = await registration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        let flagged = false;
        try { flagged = localStorage.getItem(FLAG) === '1'; } catch {}
        if (!cancelled) setStatus(sub && flagged ? 'on' : 'off');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const enable = useCallback(async () => {
    if (!user || !keyRef.current) return;
    setError('');
    setStatus('working');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setStatus(permission === 'denied' ? 'denied' : 'off'); return; }
      const reg = await registration();
      if (!reg) throw new Error('Alerts need the installed app. Reload EdgeFinder and try again.');
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(keyRef.current) });
      const result = await post(user, { action: 'subscribe', subscription: sub.toJSON(), watch });
      if (!result?.ok) throw new Error('Could not turn on alerts. Try again.');
      try { localStorage.setItem(FLAG, '1'); } catch {}
      setStatus('on');
    } catch (err) {
      setError(err.message || 'Could not turn on alerts.');
      setStatus('off');
    }
  }, [user, watch]);

  const disable = useCallback(async () => {
    setError('');
    setStatus('working');
    try {
      const reg = await registration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        if (user) await post(user, { action: 'unsubscribe', endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
    } catch {
      // Turning off locally still stops alerts on this device.
    }
    try { localStorage.removeItem(FLAG); } catch {}
    setStatus('off');
  }, [user]);

  // Keep the server's copy of the watchlist current while alerts are on.
  const watchKey = JSON.stringify(watch);
  useEffect(() => {
    if (status !== 'on' || !user) return undefined;
    const timer = setTimeout(() => { post(user, { action: 'sync', watch: JSON.parse(watchKey) }).catch(() => {}); }, 2000);
    return () => clearTimeout(timer);
  }, [status, user, watchKey]);

  return { status, error, enable, disable };
}
