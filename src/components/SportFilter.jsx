import React from 'react';
import { Search, Lock } from 'lucide-react';
import { SPORTS } from '../constants.js';
import { useAuth } from '../AuthGate.jsx';

export default function SportFilter({ filter, setFilter, searchTerm, setSearchTerm, enabledSports }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';
  const sports = ['ALL', ...Object.keys(SPORTS).filter(s => !enabledSports || enabledSports.includes(s))];

  return (
    <div className="sport-filter-bar" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
      {/* Search bar - Pro only */}
      {isPro ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px',
          background: 'rgba(15, 23, 42, 0.72)',
          border: '1px solid rgba(100, 116, 139, 0.24)',
          borderRadius: '8px', flex: '1', minWidth: '200px'
        }}>
          <Search size={14} color="#64748b" />
          <input
            type="text" placeholder="Search teams..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: '13px', width: '100%'
            }}
          />
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 14px',
          background: 'rgba(15, 23, 42, 0.42)',
          border: '1px solid rgba(71, 85, 105, 0.3)',
          borderRadius: '8px', flex: '1', minWidth: '200px',
          opacity: 0.6, cursor: 'not-allowed'
        }}>
          <Lock size={14} color="#64748b" />
          <span style={{ color: '#64748b', fontSize: '13px' }}>Search (Pro only)</span>
        </div>
      )}
      <div className="sport-buttons" style={{
        display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
        flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none', scrollbarWidth: 'none'
      }}>
        {sports.map(sport => (
          <button key={sport} onClick={() => setFilter(sport)} style={{
            padding: '8px 14px',
            background: filter === sport ? 'rgba(20, 184, 166, 0.18)' : 'rgba(15, 23, 42, 0.55)',
            border: filter === sport ? '1px solid rgba(45, 212, 191, 0.42)' : '1px solid rgba(100, 116, 139, 0.24)',
            borderRadius: '6px',
            color: filter === sport ? '#ccfbf1' : '#94a3b8',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
          }}>{sport}</button>
        ))}
      </div>
    </div>
  );
}
