import React from 'react';
import { Target, Wifi, WifiOff, RefreshCw, LogOut, Users, Calculator, TrendingUp, Zap, Activity, DollarSign, Settings } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';

// All 8 tabs — same order as mobile nav for consistency
const DESKTOP_TABS = [
  { key: 'GAMES', label: 'Games', icon: Target, getExtra: (p) => p.games?.length ? ` (${p.games.length})` : '' },
  { key: 'EDGES', label: 'Edges', icon: Zap },
  { key: 'LINES', label: 'Lines', icon: Activity },
  { key: 'PROPS', label: 'Props', icon: Users, getExtra: (p) => p.playerProps?.length ? ` (${p.playerProps.length})` : '' },
  { key: 'EV CALC', label: 'EV Calc', icon: Calculator },
  { key: 'KELLY', label: 'Kelly', icon: DollarSign },
  { key: 'TRACKER', label: 'Tracker', icon: TrendingUp },
  { key: 'SETTINGS', label: 'Settings', icon: Settings },
];

export default function Header({
  activeTab, setActiveTab, games, playerProps,
  isConnected, injuries, loading, countdown,
  onRefresh, lastUpdate, sportLastUpdated
}) {
  const { user, tier, logout } = useAuth();

  // "Last updated X seconds ago"
  const lastUpdatedText = lastUpdate
    ? `Updated ${Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago`
    : '';

  return (
    <header style={{
      padding: '12px 24px',
      borderBottom: '1px solid rgba(56, 189, 248, 0.1)',
      background: 'rgba(15, 23, 42, 0.95)',
      backdropFilter: 'blur(20px)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div className="header-inner" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '10px'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Target size={20} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>EDGE</span>
              <span style={{ fontSize: '18px', fontWeight: 300, color: '#64748b' }}>FINDER</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>LIVE ODDS & PROPS</div>
          </div>
        </div>

        {/* Tab Switcher — all tabs on desktop, hidden on mobile */}
        <div className="header-tabs" style={{
          display: 'flex', gap: '4px', flexWrap: 'wrap',
          flex: '1 1 auto', justifyContent: 'center',
        }}>
          {DESKTOP_TABS.map(({ key, label, icon: Icon, getExtra }) => {
            const isActive = activeTab === key;
            const extra = getExtra ? getExtra({ games, playerProps }) : '';
            return (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                padding: '6px 12px',
                background: isActive ? 'rgba(99, 102, 241, 0.3)' : 'rgba(30, 41, 59, 0.4)',
                border: isActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(71, 85, 105, 0.3)',
                borderRadius: '6px',
                color: isActive ? '#f8fafc' : '#94a3b8',
                fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '5px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                <Icon size={13} />
                {label}{extra}
              </button>
            );
          })}
        </div>

        {/* Status + Actions */}
        <div className="header-status" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 10px',
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '6px', fontSize: '11px',
            color: isConnected ? '#10b981' : '#ef4444'
          }}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            {loading ? 'Updating...' : lastUpdatedText || `${countdown}s`}
          </div>
          <button onClick={onRefresh} disabled={loading} style={{
            padding: '5px 10px',
            background: 'rgba(99, 102, 241, 0.3)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            borderRadius: '6px', color: '#f8fafc',
            fontSize: '11px', cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {/* Pro badge or Upgrade link */}
          {tier === 'pro' ? (
            <span style={{
              padding: '4px 10px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#c4b5fd',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              PRO
            </span>
          ) : (
            <button onClick={() => setActiveTab('SETTINGS')} style={{
              padding: '4px 10px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '6px', fontSize: '11px', color: '#818cf8',
              cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
            }}>
              Upgrade
            </button>
          )}

          <button onClick={logout} title={user?.email || 'Sign Out'} style={{
            padding: '5px 10px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '6px', color: '#f87171',
            fontSize: '11px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <LogOut size={12} /> Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
