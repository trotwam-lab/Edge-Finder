import React from 'react';
import { Home, Target, Wifi, WifiOff, RefreshCw, LogOut, Users, TrendingUp, Settings, FileText, Wrench } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import { NAV_TABS } from '../constants.js';
import AlertsBell from './AlertsBell.jsx';
import Logo from './Logo.jsx';

const TAB_ICONS = { Home, Target, Users, Wrench, FileText, TrendingUp, Settings };

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

  const tabCounts = { GAMES: games.length, PROPS: playerProps.length };

  return (
    <header className="edge-header" style={{
      padding: '12px 24px',
      borderBottom: '1px solid var(--ef-border)',
      background: 'rgba(7, 11, 20, 0.86)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(18px)',
      WebkitBackdropFilter: 'blur(18px)',
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
        <Logo size={36} tagline="Market Intelligence" />

        {/* Tab Switcher — desktop only (hidden on mobile via CSS) */}
        <div className="header-tabs" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {NAV_TABS.map(({ key, label, icon, proOnly }) => {
            const Icon = TAB_ICONS[icon];
            const count = tabCounts[key];
            const isLocked = proOnly && !isPro;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => isLocked ? setActiveTab('SETTINGS') : setActiveTab(key)}
                title={isLocked ? `${label} — Pro only` : label}
                style={{
                  padding: '8px 12px',
                  background: isActive ? 'var(--ef-accent-soft)' : 'transparent',
                  border: isActive
                    ? '1px solid var(--ef-accent-border)'
                    : '1px solid transparent',
                  borderRadius: '8px',
                  color: isActive ? 'var(--ef-text)' : isLocked ? 'var(--ef-text-dim)' : 'var(--ef-text-muted)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--ef-font-body)',
                  position: 'relative',
                  transition: 'color 140ms ease, background 140ms ease',
                }}
              >
                <Icon size={13} color={isActive ? 'var(--ef-cyan)' : 'currentColor'} />
                {label}
                {count !== undefined && (
                  <span className="ef-mono" style={{
                    minWidth: '18px',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    background: isActive ? 'rgba(0,200,255,0.16)' : 'rgba(125,141,168,0.14)',
                    color: isActive ? 'var(--ef-cyan)' : 'var(--ef-text-muted)',
                    fontSize: '10px',
                    textAlign: 'center',
                  }}>{count}</span>
                )}
                {isLocked && (
                  <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--ef-amber)', marginLeft: '1px' }}>PRO</span>
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
            background: isConnected ? 'var(--ef-green-soft)' : 'var(--ef-red-soft)',
            border: `1px solid ${isConnected ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 68, 102, 0.3)'}`,
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 700,
            color: isConnected ? 'var(--ef-green)' : 'var(--ef-red)'
          }}>
            {isConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div className="ef-mono" style={{ fontSize: '11px', color: 'var(--ef-text-dim)' }}>
            {loading ? 'Updating...' : lastUpdatedText || `${countdown}s`}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh odds"
            style={{
              padding: '6px 12px',
              background: 'var(--ef-accent-soft)',
              border: '1px solid var(--ef-accent-border)',
              borderRadius: '8px',
              color: 'var(--ef-cyan)',
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
              padding: '5px 12px',
              background: 'var(--ef-violet-soft)',
              border: '1px solid var(--ef-violet-border)',
              borderRadius: '8px',
              fontSize: '11px', fontWeight: 800,
              color: '#a78bfa',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              PRO
            </span>
          ) : (
            <button
              onClick={() => setActiveTab('SETTINGS')}
              style={{
                padding: '6px 14px',
                background: 'var(--ef-gradient)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#fff',
                cursor: 'pointer',
                fontFamily: 'var(--ef-font-body)',
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
              background: 'transparent',
              border: '1px solid var(--ef-border)',
              borderRadius: '8px',
              color: 'var(--ef-text-muted)',
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
