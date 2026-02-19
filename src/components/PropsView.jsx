import React, { useState, useMemo } from 'react';
import { Search, Loader, Lock } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

// FREE_PROPS_LIMIT — Free users can only see 5 prop groups, Pro sees all
const FREE_PROPS_LIMIT = 5;

// Format American odds with +/- sign
function formatOdds(price) {
  if (price === undefined || price === null) return '—';
  return price > 0 ? `+${price}` : `${price}`;
}

export default function PropsView({ playerProps, loading, propHistory }) {
  const { tier } = useAuth();
  const [propFilter, setPropFilter] = useState('ALL');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL'); // ALL, Over, Under
  const [propSearch, setPropSearch] = useState('');
  const [bestOddsOnly, setBestOddsOnly] = useState(false);

  // Group props by player + market, with Over/Under from each book
  const groupedProps = useMemo(() => {
    // First apply market + search filters
    let filtered = playerProps
      .filter(p => propFilter === 'ALL' || p.market?.includes(propFilter.toLowerCase()))
      .filter(p => {
        if (!propSearch) return true;
        const s = propSearch.toLowerCase();
        return p.player?.toLowerCase().includes(s) || p.game?.toLowerCase().includes(s);
      });

    // Apply outcome filter
    if (outcomeFilter !== 'ALL') {
      filtered = filtered.filter(p => p.outcome === outcomeFilter);
    }

    // Group by player + market
    const groups = {};
    filtered.forEach(prop => {
      const key = `${prop.player}-${prop.market}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          player: prop.player,
          market: prop.market,
          line: prop.line,
          game: prop.game,
          overs: [],
          unders: [],
        };
      }
      if (prop.outcome === 'Over') {
        groups[key].overs.push(prop);
      } else if (prop.outcome === 'Under') {
        groups[key].unders.push(prop);
      }
    });

    return Object.values(groups);
  }, [playerProps, propFilter, outcomeFilter, propSearch]);

  // Stats
  const stats = useMemo(() => ({
    total: playerProps.length,
    points: playerProps.filter(p => p.market?.includes('points')).length,
    rebounds: playerProps.filter(p => p.market?.includes('rebounds')).length,
    assists: playerProps.filter(p => p.market?.includes('assists')).length,
  }), [playerProps]);

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
      </div>

      {/* Market filters */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
        {['ALL', 'POINTS', 'REBOUNDS', 'ASSISTS'].map(type => (
          <button key={type} onClick={() => setPropFilter(type)} style={{
            padding: '8px 14px',
            background: propFilter === type ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.4)',
            border: propFilter === type ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(71,85,105,0.3)',
            borderRadius: '6px', color: propFilter === type ? '#f8fafc' : '#94a3b8',
            fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{type}</button>
        ))}
      </div>

      {/* Outcome filters + best odds toggle */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['ALL', 'Over', 'Under'].map(type => (
          <button key={type} onClick={() => setOutcomeFilter(type)} style={{
            padding: '8px 14px',
            background: outcomeFilter === type
              ? (type === 'Over' ? 'rgba(34,197,94,0.3)' : type === 'Under' ? 'rgba(239,68,68,0.3)' : 'rgba(99,102,241,0.3)')
              : 'rgba(30,41,59,0.4)',
            border: outcomeFilter === type
              ? (type === 'Over' ? '1px solid rgba(34,197,94,0.5)' : type === 'Under' ? '1px solid rgba(239,68,68,0.5)' : '1px solid rgba(99,102,241,0.5)')
              : '1px solid rgba(71,85,105,0.3)',
            borderRadius: '6px',
            color: outcomeFilter === type
              ? (type === 'Over' ? '#22c55e' : type === 'Under' ? '#f87171' : '#f8fafc')
              : '#94a3b8',
            fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
          }}>{type === 'ALL' ? 'BOTH SIDES' : type.toUpperCase()}</button>
        ))}
        <button onClick={() => setBestOddsOnly(!bestOddsOnly)} style={{
          padding: '8px 14px',
          background: bestOddsOnly ? 'rgba(234,179,8,0.3)' : 'rgba(30,41,59,0.4)',
          border: bestOddsOnly ? '1px solid rgba(234,179,8,0.5)' : '1px solid rgba(71,85,105,0.3)',
          borderRadius: '6px', color: bestOddsOnly ? '#eab308' : '#94a3b8',
          fontSize: '11px', fontWeight: 600, cursor: 'pointer',
          fontFamily: "'JetBrains Mono', monospace",
        }}>{bestOddsOnly ? '★ Best Odds Only' : 'All Books'}</button>
      </div>

      {/* Stats */}
      <div className="props-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Props', value: stats.total, color: '#06b6d4' },
          { label: 'Points', value: stats.points, color: '#f97316' },
          { label: 'Rebounds', value: stats.rebounds, color: '#22c55e' },
          { label: 'Assists', value: stats.assists, color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '16px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Props Grid */}
      {groupedProps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          {loading ? (
            <><Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} /><p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading player props...</p></>
          ) : <p style={{ color: '#64748b' }}>No player props found.</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Visible props (free users get first 5 groups) */}
          {(tier === 'pro' ? groupedProps : groupedProps.slice(0, FREE_PROPS_LIMIT)).map(group => {
            const bestOver = group.overs.length > 0
              ? group.overs.reduce((best, p) => p.price > best.price ? p : best)
              : null;
            const bestUnder = group.unders.length > 0
              ? group.unders.reduce((best, p) => p.price > best.price ? p : best)
              : null;

            // Get all unique books in this group
            const books = [...new Set([
              ...group.overs.map(p => p.book || p.bookTitle || p.bookKey),
              ...group.unders.map(p => p.book || p.bookTitle || p.bookKey),
            ])].sort();

            const marketLabel = group.market?.replace('player_', '').toUpperCase();
            const marketColor = group.market?.includes('points') ? '#f97316'
              : group.market?.includes('rebounds') ? '#22c55e' : '#3b82f6';

            return (
              <div key={group.key} style={{
                padding: '16px', background: 'rgba(30,41,59,0.6)',
                border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px',
              }}>
                {/* Header: Player name, market badge, line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#e2e8f0' }}>{group.player}</span>
                    <span style={{
                      marginLeft: '8px', padding: '3px 8px',
                      background: `${marketColor}20`, borderRadius: '4px',
                      fontSize: '10px', color: marketColor, fontWeight: 600,
                    }}>{marketLabel}</span>
                  </div>
                  <div style={{
                    fontSize: '22px', fontWeight: 800, color: '#f8fafc',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}>
                    {group.line}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '12px' }}>{group.game}</div>

                {/* Odds comparison table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px 6px', color: '#64748b', fontSize: '10px', fontWeight: 600, borderBottom: '1px solid rgba(71,85,105,0.3)' }}>BOOK</th>
                        {(outcomeFilter === 'ALL' || outcomeFilter === 'Over') && (
                          <th style={{ textAlign: 'center', padding: '8px 6px', borderBottom: '1px solid rgba(71,85,105,0.3)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#22c55e', background: 'rgba(34,197,94,0.15)', padding: '2px 8px', borderRadius: '4px' }}>OVER</span>
                          </th>
                        )}
                        {(outcomeFilter === 'ALL' || outcomeFilter === 'Under') && (
                          <th style={{ textAlign: 'center', padding: '8px 6px', borderBottom: '1px solid rgba(71,85,105,0.3)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: '4px' }}>UNDER</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(bestOddsOnly
                        ? (bestOver || bestUnder ? [{ book: 'Best', over: bestOver, under: bestUnder }] : [])
                        : books.map(book => ({
                            book,
                            over: group.overs.find(p => (p.book || p.bookTitle || p.bookKey) === book),
                            under: group.unders.find(p => (p.book || p.bookTitle || p.bookKey) === book),
                          }))
                      ).map(row => (
                        <tr key={row.book}>
                          <td style={{ padding: '6px', color: '#94a3b8', fontWeight: 500, borderBottom: '1px solid rgba(71,85,105,0.15)' }}>
                            {bestOddsOnly ? (row.over?.book || row.under?.book || '—') : row.book}
                          </td>
                          {(outcomeFilter === 'ALL' || outcomeFilter === 'Over') && (
                            <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid rgba(71,85,105,0.15)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {row.over ? (
                                <span style={bestOver && row.over.price === bestOver.price
                                  ? { color: '#22c55e', fontWeight: 700, background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: '4px' }
                                  : { color: '#f8fafc' }
                                }>
                                  {formatOdds(row.over.price)}
                                </span>
                              ) : <span style={{ color: '#475569' }}>—</span>}
                            </td>
                          )}
                          {(outcomeFilter === 'ALL' || outcomeFilter === 'Under') && (
                            <td style={{ textAlign: 'center', padding: '6px', borderBottom: '1px solid rgba(71,85,105,0.15)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {row.under ? (
                                <span style={bestUnder && row.under.price === bestUnder.price
                                  ? { color: '#22c55e', fontWeight: 700, background: 'rgba(34,197,94,0.1)', padding: '2px 6px', borderRadius: '4px' }
                                  : { color: '#f8fafc' }
                                }>
                                  {formatOdds(row.under.price)}
                                </span>
                              ) : <span style={{ color: '#475569' }}>—</span>}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Locked props overlay for free users */}
          {tier !== 'pro' && groupedProps.length > FREE_PROPS_LIMIT && (
            <div style={{ position: 'relative', marginTop: '8px' }}>
              {/* Blurred preview */}
              <div style={{ filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none' }}>
                {groupedProps.slice(FREE_PROPS_LIMIT, FREE_PROPS_LIMIT + 2).map(group => (
                  <div key={group.key} style={{
                    padding: '16px', background: 'rgba(30,41,59,0.6)',
                    border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px', marginBottom: '12px',
                  }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>{group.player}</div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#f8fafc' }}>{group.line}</div>
                  </div>
                ))}
              </div>
              {/* Lock overlay */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px',
              }}>
                <Lock size={28} color="#818cf8" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                  +{groupedProps.length - FREE_PROPS_LIMIT} more props locked
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                  Upgrade to Pro to see all player props with full odds comparison
                </div>
              </div>
            </div>
          )}

          {tier !== 'pro' && groupedProps.length > FREE_PROPS_LIMIT && (
            <div style={{ marginTop: '16px' }}>
              <ProBanner />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
