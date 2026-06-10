import React from 'react';
import { Home, Target, Wifi, WifiOff, RefreshCw, LogOut, Users, TrendingUp, Settings, FileText, Wrench } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import AlertsBell from './AlertsBell.jsx';

export default function Header({
  activeTab, setActiveTab, games, playerProps,
  isConnected, injuries, loading, countdown,
  onRefresh, lastUpdate, sportLastUpdated, alertsApi
}) {
  const { user, tier, logout } = useAuth();
  const isPro = tier === 'pro';

  // "Last updated X seconds ago"
  const lastUpdatedText = lastUpdate
    ? `Updated ${Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago`
    : '';

  // Tab definitions: { key, label, icon, proOnly }
  const TABS = [
    { key: 'HOME',         label: 'Home',                         icon: Home,        proOnly: false },
    { key: 'GAMES',        label: 'Games',                        count: games.length, icon: Target,      proOnly: false },
    { key: 'PROPS',        label: 'Props',                        count: playerProps.length, icon: Users,       proOnly: false },
    { key: 'PRO_TOOLS',    label: 'Pro Tools',                    icon: Wrench,      proOnly: true  },
    { key: 'REPORT',       label: 'Daily Report',                 icon: FileText,    proOnly: true  },
    { key: 'TRACKER',      label: 'Tracker',                      icon: TrendingUp,  proOnly: false },
    { key: 'SETTINGS',     label: 'Settings',                     icon: Settings,    proOnly: false },
  ];

  return (
    <header className="edge-header" style={{
      padding: '12px 24px',
      borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
      background: 'rgba(7, 17, 31, 0.88)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(18px)',
    }}>
      <div className="header-inner" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #0f766e, #38bdf8)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Target size={20} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>EDGE</span>
              <span style={{ fontSize: '18px', fontWeight: 300, color: '#94a3b8' }}>FINDER</span>
            </div>
            <div style={{ fontSize: '10px', color: '#64748b' }}>MARKET INTELLIGENCE</div>
          </div>
        </div>

        {/* Tab Switcher — desktop only (hidden on mobile via CSS) */}
        <div className="header-tabs" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {TABS.map(({ key, label, count, icon: Icon, proOnly }) => {
            const isLocked = proOnly && !isPro;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => isLocked ? setActiveTab('SETTINGS') : setActiveTab(key)}
                title={isLocked ? `${label} — Pro only` : label}
                style={{
                  padding: '8px 11px',
                  background: isActive
                    ? 'rgba(20, 184, 166, 0.18)'
                    : isLocked
                      ? 'rgba(30, 41, 59, 0.25)'
                      : 'rgba(15, 23, 42, 0.45)',
                  border: isActive
                    ? '1px solid rgba(45, 212, 191, 0.42)'
                    : '1px solid rgba(100, 116, 139, 0.24)',
                  borderRadius: '6px',
                  color: isActive ? '#f8fafc' : isLocked ? '#475569' : '#94a3b8',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontFamily: "'JetBrains Mono', monospace",
                  position: 'relative',
                }}
              >
                <Icon size={12} />
                {label}
                {count !== undefined && (
                  <span style={{
                    minWidth: '18px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(45,212,191,0.18)' : 'rgba(100,116,139,0.18)',
                    color: isActive ? '#5eead4' : '#94a3b8',
                    fontSize: '9px',
                    textAlign: 'center',
                  }}>{count}</span>
                )}
                {isLocked && (
                  <span style={{ fontSize: '8px', color: '#fbbf24', marginLeft: '1px' }}>PRO</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status bar */}
        <div className="header-status" style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px',
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '6px',
            fontSize: '11px',
            color: isConnected ? '#10b981' : '#ef4444'
          }}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            {loading ? 'Updating...' : lastUpdatedText || `${countdown}s`}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: 'rgba(20, 184, 166, 0.14)',
              border: '1px solid rgba(45, 212, 191, 0.35)',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          {alertsApi && <AlertsBell {...alertsApi} onNavigate={setActiveTab} />}

          {/* Pro badge or Upgrade link */}
          {tier === 'pro' ? (
            <span style={{
              padding: '5px 10px',
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.34)',
              borderRadius: '6px',
              fontSize: '11px', fontWeight: 700,
              color: '#fbbf24',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              PRO
            </span>
          ) : (
            <button
              onClick={() => setActiveTab('SETTINGS')}
              style={{
                padding: '5px 10px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.28)',
                borderRadius: '6px',
                fontSize: '11px',
                color: '#fbbf24',
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Upgrade
            </button>
          )}

          <button
            onClick={logout}
            title={user?.email || 'Sign Out'}
            style={{
              padding: '6px 12px',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <LogOut size={12} />
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
