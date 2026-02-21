import React from 'react';
import { Target, Wifi, WifiOff, RefreshCw, LogOut, Users, Calculator, TrendingUp } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';

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
      padding: '16px 24px',
      borderBottom: '1px solid rgba(56, 189, 248, 0.1)',
      background: 'rgba(15, 23, 42, 0.9)',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div className="header-inner" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '12px'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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

        {/* Tab Switcher */}
        <div className="header-tabs" style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setActiveTab('GAMES')} style={{
            padding: '8px 16px',
            background: activeTab === 'GAMES' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(30, 41, 59, 0.4)',
            border: activeTab === 'GAMES' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '6px',
            color: activeTab === 'GAMES' ? '#f8fafc' : '#94a3b8',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer'
          }}>Games ({games.length})</button>
          <button onClick={() => setActiveTab('PROPS')} style={{
            padding: '8px 16px',
            background: activeTab === 'PROPS' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(30, 41, 59, 0.4)',
            border: activeTab === 'PROPS' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '6px',
            color: activeTab === 'PROPS' ? '#f8fafc' : '#94a3b8',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}><Users size={14} /> Props ({playerProps.length})</button>
          <button onClick={() => setActiveTab('EV CALC')} style={{
            padding: '8px 16px',
            background: activeTab === 'EV CALC' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(30, 41, 59, 0.4)',
            border: activeTab === 'EV CALC' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '6px',
            color: activeTab === 'EV CALC' ? '#f8fafc' : '#94a3b8',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}><Calculator size={14} /> EV Calc</button>
          <button onClick={() => setActiveTab('TRACKER')} style={{
            padding: '8px 16px',
            background: activeTab === 'TRACKER' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(30, 41, 59, 0.4)',
            border: activeTab === 'TRACKER' ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '6px',
            color: activeTab === 'TRACKER' ? '#f8fafc' : '#94a3b8',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}><TrendingUp size={14} /> Tracker</button>
        </div>

        {/* Status - Compact inline with header */}
        <div className="header-status" style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px',
            background: isConnected ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${isConnected ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            borderRadius: '4px', fontSize: '10px', fontWeight: 600,
            color: isConnected ? '#10b981' : '#ef4444'
          }}>
            {isConnected ? <Wifi size={10} /> : <WifiOff size={10} />}
            {isConnected ? 'LIVE' : 'OFFLINE'}
          </div>
          <div style={{ fontSize: '10px', color: '#64748b' }}>
            {loading ? '...' : lastUpdatedText || `${countdown}s`}
          </div>
          <button onClick={onRefresh} disabled={loading} style={{
            padding: '4px 8px',
            background: 'rgba(99, 102, 241, 0.3)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            borderRadius: '4px', color: '#f8fafc',
            fontSize: '10px', cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            <RefreshCw size={10} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {/* Pro badge or Upgrade link */}
          {tier === 'pro' ? (
            <span style={{
              padding: '3px 6px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '4px', fontSize: '10px', fontWeight: 700, color: '#c4b5fd',
              display: 'flex', alignItems: 'center', gap: '2px',
            }}>
              PRO
            </span>
          ) : (
            <button onClick={() => setActiveTab('SETTINGS')} style={{
              padding: '3px 6px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '4px', fontSize: '10px', color: '#818cf8',
              cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
            }}>
              UPGRADE
            </button>
          )}

          <button onClick={logout} title={user?.email || 'Sign Out'} style={{
            padding: '4px 8px',
            background: 'rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '4px', color: '#f87171',
            fontSize: '10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <LogOut size={10} />
          </button>
        </div>
      </div>
    </header>
  );
}
