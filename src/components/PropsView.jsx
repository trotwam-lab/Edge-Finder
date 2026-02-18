import React, { useState, useMemo } from 'react';
import { Search, Loader, Lock } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

// FREE_PROPS_LIMIT â Free users can only see 5 props, Pro sees all
const FREE_PROPS_LIMIT = 5;

export default function PropsView({ playerProps, loading, propHistory }) {
  const { tier } = useAuth(); // Get subscription tier
  const [propFilter, setPropFilter] = useState('ALL');
  const [propSearch, setPropSearch] = useState('');
  const [showValueOnly, setShowValueOnly] = useState(true);

  const filteredProps = useMemo(() => {
    let filtered = playerProps
      .filter(p => propFilter === 'ALL' || p.market?.includes(propFilter.toLowerCase()))
      .filter(p => {
        if (!propSearch) return true;
        const s = propSearch.toLowerCase();
        return p.player?.toLowerCase().includes(s) || p.game?.toLowerCase().includes(s);
      });
    if (showValueOnly) {
      const grouped = {};
      filtered.forEach(prop => {
        const key = `${prop.player}-${prop.market}`;
        if (!grouped[key] || prop.price > grouped[key].price) grouped[key] = prop;
      });
      filtered = Object.values(grouped);
    }
    return filtered;
  }, [playerProps, propFilter, propSearch, showValueOnly]);

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
          background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(56,189,248,0.1)',
          borderRadius: '8px', flex: '1', minWidth: '200px'
        }}>
          <Search size={14} color="#64748b" />
          <input type="text" placeholder="Search players or teams..." value={propSearch}
            onChange={e => setPropSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '13px', width: '100%' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'POINTS', 'REBOUNDS', 'ASSISTS'].map(type => (
            <button key={type} onClick={() => setPropFilter(type)} style={{
              padding: '8px 14px',
              background: propFilter === type ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.4)',
              border: propFilter === type ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(71,85,105,0.3)',
              borderRadius: '6px', color: propFilter === type ? '#f8fafc' : '#94a3b8',
              fontSize: '11px', fontWeight: 600, cursor: 'pointer'
            }}>{type}</button>
          ))}
        </div>
        <button onClick={() => setShowValueOnly(!showValueOnly)} style={{
          padding: '8px 14px',
          background: showValueOnly ? 'rgba(34,197,94,0.3)' : 'rgba(30,41,59,0.4)',
          border: showValueOnly ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(71,85,105,0.3)',
          borderRadius: '6px', color: showValueOnly ? '#22c55e' : '#94a3b8',
          fontSize: '11px', fontWeight: 600, cursor: 'pointer'
        }}>{showValueOnly ? 'â Best Odds Only' : 'All Books'}</button>
      </div>

      {/* Stats */}
      <div className="props-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Props', value: playerProps.length, color: '#06b6d4' },
          { label: 'Points', value: playerProps.filter(p => p.market?.includes('points')).length, color: '#f97316' },
          { label: 'Rebounds', value: playerProps.filter(p => p.market?.includes('rebounds')).length, color: '#22c55e' },
          { label: 'Assists', value: playerProps.filter(p => p.market?.includes('assists')).length, color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Props Grid */}
      {filteredProps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          {loading ? (
            <><Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} /><p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading player props...</p></>
          ) : <p style={{ color: '#64748b' }}>No player props found.</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {/* Free users: show first 5 props, then a blurred lock overlay + upgrade banner */}
          {(tier === 'pro' ? filteredProps : filteredProps.slice(0, FREE_PROPS_LIMIT)).map(prop => (
            <div key={prop.id} style={{
              padding: '16px', background: 'rgba(30,41,59,0.6)',
              border: prop.movement
                ? (prop.movement.direction === 'up' ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(239,68,68,0.5)')
                : '1px solid rgba(71,85,105,0.3)',
              borderRadius: '12px', position: 'relative', overflow: 'hidden'
            }}>
              {prop.movement && (
                <div style={{
                  position: 'absolute', top: 0, right: 0, padding: '2px 8px',
                  background: prop.movement.direction === 'up' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
                  borderBottomLeftRadius: '8px', fontSize: '9px', fontWeight: 700,
                  color: prop.movement.direction === 'up' ? '#22c55e' : '#ef4444',
                  display: 'flex', alignItems: 'center', gap: '2px'
                }}>{prop.movement.direction === 'up' ? 'â²' : 'â¼'} {prop.movement.amount} from {prop.movement.prevLine}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0' }}>{prop.player}</span>
                <span style={{
                  padding: '3px 8px',
                  background: prop.market?.includes('points') ? 'rgba(249,115,22,0.2)' : prop.market?.includes('rebounds') ? 'rgba(34,197,94,0.2)' : 'rgba(59,130,246,0.2)',
                  borderRadius: '4px', fontSize: '10px',
                  color: prop.market?.includes('points') ? '#f97316' : prop.market?.includes('rebounds') ? '#22c55e' : '#3b82f6'
                }}>{prop.market?.replace('player_', '').toUpperCase()}</span>
              </div>
              <div style={{
                fontSize: '24px', fontWeight: 700,
                color: prop.movement ? (prop.movement.direction === 'up' ? '#22c55e' : '#ef4444') : '#f8fafc',
                marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                {prop.line} {prop.outcome}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  color: prop.price >= -110 && prop.price <= 100 ? '#22c55e' : '#f8fafc',
                  fontWeight: prop.price >= -110 && prop.price <= 100 ? 600 : 400
                }}>{prop.price > 0 ? '+' : ''}{prop.price}</span>
                @ {prop.book}
                {prop.price >= -110 && prop.price <= 100 && (
                  <span style={{ fontSize: '9px', padding: '1px 4px', background: 'rgba(34,197,94,0.2)', borderRadius: '3px', color: '#22c55e' }}>VALUE</span>
                )}
              </div>
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>{prop.game}</div>
            </div>
          ))}

          {/* Locked props overlay for free users */}
          {tier === 'free' && filteredProps.length > FREE_PROPS_LIMIT && (
            <div style={{
              gridColumn: '1 / -1', // Span full width
              position: 'relative',
              marginTop: '8px',
            }}>
              {/* Blurred preview of locked props */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px',
                filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none',
              }}>
                {filteredProps.slice(FREE_PROPS_LIMIT, FREE_PROPS_LIMIT + 3).map(prop => (
                  <div key={prop.id} style={{
                    padding: '16px', background: 'rgba(30,41,59,0.6)',
                    border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px',
                  }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>{prop.player}</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc' }}>{prop.line} {prop.outcome}</div>
                  </div>
                ))}
              </div>

              {/* Lock overlay */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15, 23, 42, 0.5)',
                borderRadius: '12px',
              }}>
                <Lock size={28} color="#818cf8" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  +{filteredProps.length - FREE_PROPS_LIMIT} more props locked
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                  Upgrade to Pro to see all player props
                </div>
              </div>
            </div>
          )}

          {/* Full ProBanner below locked props */}
          {tier === 'free' && filteredProps.length > FREE_PROPS_LIMIT && (
            <div style={{ gridColumn: '1 / -1', marginTop: '16px' }}>
              <ProBanner />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
