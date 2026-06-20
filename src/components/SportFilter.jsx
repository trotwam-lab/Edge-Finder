import React, { useEffect, useMemo, useRef } from 'react';
import { Search, Lock } from 'lucide-react';
import { SPORTS } from '../constants.js';
import { useAuth } from '../AuthGate.jsx';

// sport_key -> our short label (e.g. 'baseball_mlb' -> 'MLB'), for counts.
const NAME_BY_KEY = Object.fromEntries(Object.entries(SPORTS).map(([name, key]) => [key, name]));

export default function SportFilter({ filter, setFilter, searchTerm, setSearchTerm, enabledSports, games = [] }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';
  const stripRef = useRef(null);
  const activeRef = useRef(null);

  // How many games each enabled sport has right now.
  const counts = useMemo(() => {
    const c = {};
    games.forEach(g => {
      const name = NAME_BY_KEY[g.sport_key];
      if (name) c[name] = (c[name] || 0) + 1;
    });
    return c;
  }, [games]);

  // Chip order: ALL first, then sports that have games today, then the rest —
  // each group in its normal order so chips don't reshuffle on every refresh.
  // This puts the leagues you can actually bet right now at the front instead
  // of buried at the end of a long strip.
  const sports = useMemo(() => {
    const enabled = Object.keys(SPORTS).filter(s => !enabledSports || enabledSports.includes(s));
    const withGames = enabled.filter(s => counts[s]);
    const without = enabled.filter(s => !counts[s]);
    return ['ALL', ...withGames, ...without];
  }, [enabledSports, counts]);

  // Keep the selected chip visible (scrolls the strip only, never the page).
  useEffect(() => {
    const el = activeRef.current;
    const strip = stripRef.current;
    if (!el || !strip) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    const viewLeft = strip.scrollLeft;
    const viewRight = viewLeft + strip.clientWidth;
    if (left < viewLeft) strip.scrollTo({ left: Math.max(0, left - 12), behavior: 'smooth' });
    else if (right > viewRight) strip.scrollTo({ left: right - strip.clientWidth + 12, behavior: 'smooth' });
  }, [filter, sports]);

  const totalGames = games.length;

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
      <div className="sport-buttons" ref={stripRef} style={{ position: 'relative' }}>
        {sports.map(sport => {
          const active = filter === sport;
          const count = sport === 'ALL' ? totalGames : counts[sport];
          const hasCount = count > 0;
          return (
            <button
              key={sport}
              ref={active ? activeRef : null}
              onClick={() => setFilter(sport)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 13px',
                background: active ? 'rgba(20, 184, 166, 0.18)' : 'rgba(15, 23, 42, 0.55)',
                border: active ? '1px solid rgba(45, 212, 191, 0.42)' : '1px solid rgba(100, 116, 139, 0.24)',
                borderRadius: '6px',
                color: active ? '#ccfbf1' : hasCount ? '#cbd5e1' : '#64748b',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {sport}
              {hasCount && (
                <span style={{
                  minWidth: '16px', padding: '0 4px', borderRadius: '4px', textAlign: 'center',
                  background: active ? 'rgba(45,212,191,0.2)' : 'rgba(100,116,139,0.2)',
                  color: active ? '#5eead4' : '#94a3b8', fontSize: '9px', fontWeight: 700,
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
