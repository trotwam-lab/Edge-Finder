import React, { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, FileText, Flame, Star, Trash2 } from 'lucide-react';

const TYPE_ICONS = {
  report: { Icon: FileText, color: '#a78bfa' },
  watchlist: { Icon: Star, color: '#fbbf24' },
  steam: { Icon: Flame, color: '#f97316' },
};

function timeAgo(ts) {
  if (!ts) return '';
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AlertsBell({
  alerts = [],
  unreadCount = 0,
  markAllRead = () => {},
  clearAlerts = () => {},
  notifyEnabled = false,
  requestBrowserNotifications = () => {},
  onNavigate = () => {},
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Opening the panel marks everything read; clicking outside closes it.
  useEffect(() => {
    if (!open) return;
    markAllRead();
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, markAllRead]);

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Alerts"
        aria-label={`Alerts${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        style={{
          padding: '6px 12px',
          background: unreadCount ? 'rgba(245,158,11,0.14)' : 'rgba(15,23,42,0.45)',
          border: `1px solid ${unreadCount ? 'rgba(245,158,11,0.34)' : 'rgba(100,116,139,0.24)'}`,
          borderRadius: '6px',
          color: unreadCount ? '#fbbf24' : '#94a3b8',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex', alignItems: 'center',
        }}
      >
        {unreadCount ? <BellRing size={12} /> : <Bell size={12} />}
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-6px',
            minWidth: '16px', height: '16px', padding: '0 4px',
            borderRadius: '8px', background: '#f59e0b', color: '#0b1120',
            fontSize: '9px', fontWeight: 800, lineHeight: '16px', textAlign: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 300,
          width: 'min(340px, calc(100vw - 24px))',
          background: 'rgba(10,18,32,0.98)',
          border: '1px solid rgba(71,85,105,0.4)',
          borderRadius: '12px',
          boxShadow: '0 18px 50px rgba(2,6,23,0.6)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 14px', borderBottom: '1px solid rgba(71,85,105,0.3)',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc' }}>Alerts</span>
            {alerts.length > 0 && (
              <button onClick={clearAlerts} title="Clear all" style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#64748b',
                display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                <Trash2 size={12} /> Clear
              </button>
            )}
          </div>

          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '20px 14px', fontSize: '11px', color: '#64748b', lineHeight: 1.6 }}>
                No alerts yet. Star games on Home and we&apos;ll flag it here when their lines move.
              </div>
            ) : (
              alerts.map(alert => {
                const meta = TYPE_ICONS[alert.type] || TYPE_ICONS.steam;
                const { Icon } = meta;
                return (
                  <button
                    key={alert.key}
                    onClick={() => { onNavigate(alert.tab || 'HOME'); setOpen(false); }}
                    style={{
                      width: '100%', display: 'flex', gap: '10px', alignItems: 'flex-start',
                      padding: '11px 14px', background: 'none', textAlign: 'left',
                      border: 'none', borderBottom: '1px solid rgba(71,85,105,0.18)',
                      cursor: 'pointer',
                    }}
                  >
                    <Icon size={14} color={meta.color} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      <span style={{ display: 'block', fontSize: '11px', color: '#e2e8f0', lineHeight: 1.5 }}>{alert.message}</span>
                      <span style={{ display: 'block', fontSize: '9px', color: '#475569', marginTop: '3px' }}>{timeAgo(alert.ts)}</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(71,85,105,0.3)' }}>
            {!notifyEnabled && typeof Notification !== 'undefined' && (
              <button onClick={requestBrowserNotifications} style={{
                width: '100%', padding: '8px', marginBottom: '8px', borderRadius: '6px',
                background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.3)',
                color: '#a5b4fc', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                fontFamily: '"JetBrains Mono", monospace',
              }}>
                Enable browser notifications
              </button>
            )}
            <div style={{ fontSize: '9px', color: '#475569', lineHeight: 1.5 }}>
              Alerts are detected while EdgeFinder is open. Push alerts that reach you anywhere are on the roadmap.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
