import React, { useState, useMemo } from 'react';
import { Search, Loader, Lock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

const FREE_PLAYERS_LIMIT = 3;

const BOOK_ABBREVIATIONS = {
  'FanDuel': 'FD', 'DraftKings': 'DK', 'BetMGM': 'MGM', 'Caesars': 'Csr',
  'BetRivers': 'BR', 'PointsBet': 'PB', 'Bet365': 'B365', 'WynnBET': 'Wynn',
  'Unibet': 'Uni', 'Barstool': 'BAR', 'ESPN BET': 'ESPN', 'Fanatics': 'Fan',
};

const MARKET_DISPLAY_NAMES = {
  'player_points': 'PTS', 'player_rebounds': 'REB', 'player_assists': 'AST',
  'player_threes': '3PM', 'player_steals': 'STL', 'player_blocks': 'BLK',
  'player_turnovers': 'TO',
};

const MARKET_FILTER_OPTIONS = ['ALL', 'POINTS', 'REBOUNDS', 'ASSISTS', 'THREES', 'STEALS', 'BLOCKS'];

function getBookAbbreviation(book) { return BOOK_ABBREVIATIONS[book] || book?.slice(0, 4) || '?'; }
function getMarketDisplayName(market) { return MARKET_DISPLAY_NAMES[market] || market?.replace('player_', '').toUpperCase() || market; }
function formatOdds(price) {
  if (price == null) return '—';
  return price > 0 ? `+${price}` : `${price}`;
}

export default function PropsView({ playerProps, loading, propHistory }) {
  const { tier } = useAuth();
  const [propFilter, setPropFilter] = useState('ALL');
  const [propSearch, setPropSearch] = useState('');
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());

  // ============================================================
  // Group props by player → market → { line, over: {book→price}, under: {book→price} }
  // ============================================================
  const players = useMemo(() => {
    const playersMap = {};
    playerProps.forEach(prop => {
      const playerKey = prop.player;
      if (!playerKey) return;
      if (!playersMap[playerKey]) {
        playersMap[playerKey] = { name: prop.player, game: prop.game, markets: {} };
      }
      const marketKey = prop.market;
      if (!playersMap[playerKey].markets[marketKey]) {
        playersMap[playerKey].markets[marketKey] = { line: prop.line, over: {}, under: {}, books: new Set() };
      }
      const mkt = playersMap[playerKey].markets[marketKey];
      const bookName = prop.book || prop.bookTitle || prop.bookKey || 'Unknown';
      mkt.books.add(bookName);
      if (prop.outcome === 'Over') {
        if (mkt.over[bookName] == null || prop.price > mkt.over[bookName]) mkt.over[bookName] = prop.price;
      } else if (prop.outcome === 'Under') {
        if (mkt.under[bookName] == null || prop.price > mkt.under[bookName]) mkt.under[bookName] = prop.price;
      }
      if (prop.line != null) mkt.line = prop.line;
    });
    Object.values(playersMap).forEach(player => {
      Object.values(player.markets).forEach(mkt => {
        mkt.bookList = Array.from(mkt.books).sort();
        delete mkt.books;
      });
    });
    return Object.values(playersMap).sort((a, b) => Object.keys(b.markets).length - Object.keys(a.markets).length);
  }, [playerProps]);

  const filteredPlayers = useMemo(() => {
    let filtered = players;
    if (propSearch) {
      const s = propSearch.toLowerCase();
      filtered = filtered.filter(p => p.name?.toLowerCase().includes(s) || p.game?.toLowerCase().includes(s));
    }
    if (propFilter !== 'ALL') {
      const marketKey = `player_${propFilter.toLowerCase()}`;
      filtered = filtered.filter(p => p.markets[marketKey]);
    }
    return filtered;
  }, [players, propSearch, propFilter]);

  const togglePlayerExpand = (name) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const stats = useMemo(() => ({
    totalPlayers: players.length,
    totalProps: playerProps.length,
    pointsProps: playerProps.filter(p => p.market?.includes('points')).length,
    reboundsProps: playerProps.filter(p => p.market?.includes('rebounds')).length,
    assistsProps: playerProps.filter(p => p.market?.includes('assists')).length,
  }), [players, playerProps]);

  if (loading) {
    return (
      <div style={{ padding: '20px 24px', textAlign: 'center', paddingTop: '60px' }}>
        <Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading player props...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '8px', flex: '1', minWidth: '200px' }}>
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="Search player or team..."
            value={propSearch}
            onChange={e => setPropSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '13px', width: '100%', fontFamily: 'JetBrains Mono, monospace' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {MARKET_FILTER_OPTIONS.map(type => (
            <button
              key={type}
              onClick={() => setPropFilter(type)}
              style={{ padding: '8px 12px', background: propFilter === type ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.4)', border: propFilter === type ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(71,85,105,0.3)', borderRadius: '6px', color: propFilter === type ? '#f8fafc' : '#94a3b8', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace' }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Players', value: stats.totalPlayers, color: '#06b6d4' },
          { label: 'Total Lines', value: stats.totalProps, color: '#6366f1' },
          { label: 'Points', value: stats.pointsProps, color: '#f97316' },
          { label: 'Rebounds', value: stats.reboundsProps, color: '#22c55e' },
          { label: 'Assists', value: stats.assistsProps, color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} style={{ padding: '14px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '10px' }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{stat.label}</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Player Cards */}
      {filteredPlayers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          No props available. Props load for upcoming games only.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(tier === 'pro' ? filteredPlayers : filteredPlayers.slice(0, FREE_PLAYERS_LIMIT)).map(player => {
            const isExpanded = expandedPlayers.has(player.name);
            const marketKeys = Object.keys(player.markets);
            const visibleMarkets = propFilter === 'ALL' ? marketKeys : marketKeys.filter(k => k.includes(propFilter.toLowerCase()));
            return (
              <div key={player.name} style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
                {/* Player Header */}
                <div
                  onClick={() => togglePlayerExpand(player.name)}
                  style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.08)' : 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '16px' }}>🏀</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{player.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{player.game}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', background: 'rgba(71,85,105,0.3)', padding: '3px 8px', borderRadius: '4px' }}>
                      {visibleMarkets.length} market{visibleMarkets.length !== 1 ? 's' : ''}
                    </span>
                    {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                  </div>
                </div>

                {/* Expanded: Over/Under table per market */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px' }}>
                    {visibleMarkets.map(marketKey => {
                      const mkt = player.markets[marketKey];
                      const books = mkt.bookList || [];
                      const overPrices = Object.values(mkt.over).filter(p => p != null);
                      const underPrices = Object.values(mkt.under).filter(p => p != null);
                      const bestOver = overPrices.length ? Math.max(...overPrices) : null;
                      const bestUnder = underPrices.length ? Math.max(...underPrices) : null;
                      return (
                        <div key={marketKey} style={{ marginTop: '12px', padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                              {getMarketDisplayName(marketKey)}
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>O/U {mkt.line}</span>
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{books.length} book{books.length !== 1 ? 's' : ''}</span>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                              <thead>
                                <tr>
                                  <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600, width: '60px' }}>Side</td>
                                  {books.map(book => (
                                    <td key={book} style={{ padding: '4px 8px', color: '#64748b', textAlign: 'center', minWidth: '48px' }}>
                                      {getBookAbbreviation(book)}
                                    </td>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td style={{ padding: '6px 8px', color: '#22c55e', fontWeight: 700 }}>Over</td>
                                  {books.map(book => {
                                    const price = mkt.over[book];
                                    const isBest = price != null && price === bestOver;
                                    return (
                                      <td key={book} style={{ padding: '6px 8px', textAlign: 'center', color: isBest ? '#22c55e' : price != null ? '#e2e8f0' : '#475569', fontWeight: isBest ? 700 : 400, background: isBest ? 'rgba(34,197,94,0.1)' : 'transparent', borderRadius: isBest ? '4px' : '0' }}>
                                        {price != null ? formatOdds(price) : '—'}
                                        {isBest && <span style={{ marginLeft: '2px', fontSize: '9px' }}>★</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                                <tr>
                                  <td style={{ padding: '6px 8px', color: '#ef4444', fontWeight: 700 }}>Under</td>
                                  {books.map(book => {
                                    const price = mkt.under[book];
                                    const isBest = price != null && price === bestUnder;
                                    return (
                                      <td key={book} style={{ padding: '6px 8px', textAlign: 'center', color: isBest ? '#22c55e' : price != null ? '#e2e8f0' : '#475569', fontWeight: isBest ? 700 : 400, background: isBest ? 'rgba(34,197,94,0.1)' : 'transparent', borderRadius: isBest ? '4px' : '0' }}>
                                        {price != null ? formatOdds(price) : '—'}
                                        {isBest && <span style={{ marginLeft: '2px', fontSize: '9px' }}>★</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {/* Lock overlay for free users */}
          {tier === 'free' && filteredPlayers.length > FREE_PLAYERS_LIMIT && (
            <>
              <div style={{ position: 'relative', marginTop: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none' }}>
                  {filteredPlayers.slice(FREE_PLAYERS_LIMIT, FREE_PLAYERS_LIMIT + 2).map(player => (
                    <div key={player.name} style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{player.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{Object.keys(player.markets).length} markets</div>
                    </div>
                  ))}
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', borderRadius: '12px' }}>
                  <Lock size={28} color="#818cf8" style={{ marginBottom: '12px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                    +{filteredPlayers.length - FREE_PLAYERS_LIMIT} more players locked
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                    Upgrade to Pro for all player props
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '8px' }}><ProBanner /></div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
