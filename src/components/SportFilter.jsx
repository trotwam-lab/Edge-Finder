import React from 'react';
import { Search } from 'lucide-react';
import { SPORTS } from '../constants.js';

export default function SportFilter({ filter, setFilter, searchTerm, setSearchTerm, enabledSports }) {
  const sports = ['ALL', ...Object.keys(SPORTS).filter(s => !enabledSports || enabledSports.includes(s))];
  return (
    <div className="sport-filter-bar" style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 14px',
        background: 'rgba(30, 41, 59, 0.6)',
        border: '1px solid rgba(56, 189, 248, 0.1)',
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
      <div className="sport-buttons" style={{
        display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px',
        flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch',
        msOverflowStyle: 'none', scrollbarWidth: 'none'
      }}>
        {sports.map(sport => (
          <button key={sport} onClick={() => setFilter(sport)} style={{
            padding: '8px 14px',
            background: filter === sport ? 'rgba(99, 102, 241, 0.3)' : 'rgba(30, 41, 59, 0.4)',
            border: filter === sport ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '6px',
            color: filter === sport ? '#f8fafc' : '#94a3b8',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0
          }}>{sport}</button>
        ))}
      </div>
    </div>
  );
}
