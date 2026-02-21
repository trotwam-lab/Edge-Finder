import React, { useState, useMemo } from 'react';
import { Search, Loader, Lock, ChevronDown, ChevronUp, Plus, X, Flame } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

// Free users see 3 player cards
const FREE_PLAYERS_LIMIT = 3;

// Book abbreviations for display
const BOOK_ABBREVIATIONS = {
  'FanDuel': 'FanDl',
  'DraftKings': 'DK',
  'BetMGM': 'MGM',
  'Caesars': 'Caes',
  'BetRivers': 'BR',
  'PointsBet': 'PB',
  'Bet365': 'B365',
  'WynnBET': 'Wynn',
  'Unibet': 'Uni',
  'Barstool': 'BAR'
};

// Map market keys to display names
const MARKET_DISPLAY_NAMES = {
  'player_points': 'POINTS',
  'player_rebounds': 'REBOUNDS',
  'player_assists': 'ASSISTS',
  'player_threes': 'THREES',
  'player_steals': 'STEALS',
  'player_blocks': 'BLOCKS',
  'player_turnovers': 'TURNOVERS'
};

function getBookAbbreviation(book) {
  return BOOK_ABBREVIATIONS[book] || book.slice(0, 4);
}

function getMarketDisplayName(market) {
  return MARKET_DISPLAY_NAMES[market] || market.replace('player_', '').toUpperCase();
}

function formatOdds(price) {
  return price > 0 ? `+${price}` : `${price}`;
}

// Find the best odds from an array of book odds
function findBestOdds(books) {
  return books.reduce((best, current) => {
    // For negative odds, the one closest to 0 is best
    // For positive odds, the highest is best
    if (best.price > 0 && current.price > 0) {
      return current.price > best.price ? current : best;
    }
    if (best.price < 0 && current.price < 0) {
      return current.price > best.price ? current : best;
    }
    // One positive, one negative - positive is better
    return current.price > 0 ? current : best;
  });
}

// Calculate average odds
function calculateAverageOdds(books) {
  if (books.length === 0) return 0;
  const sum = books.reduce((acc, b) => acc + b.price, 0);
  return sum / books.length;
}

// Check if odds represent significant value
function hasEdge(bestPrice, avgPrice) {
  // If best price is significantly better than average
  // -110 or better is good, much better than avg is edge
  if (bestPrice > 0) return bestPrice >= 105;
  return bestPrice >= -105 || (bestPrice > avgPrice + 15);
}

export default function PropsView({ playerProps, loading, propHistory }) {
  const { tier } = useAuth();
  const [propFilter, setPropFilter] = useState('ALL');
  const [propSearch, setPropSearch] = useState('');
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedMarket, setSelectedMarket] = useState(null);

  // Group props by player
  const players = useMemo(() => {
    const playersMap = {};
    
    playerProps.forEach(prop => {
      if (!playersMap[prop.player]) {
        playersMap[prop.player] = {
          name: prop.player,
          game: prop.game,
          markets: {}
        };
      }
      
      const marketKey = prop.market;
      if (!playersMap[prop.player].markets[marketKey]) {
        playersMap[prop.player].markets[marketKey] = {
          line: prop.line,
          outcome: prop.outcome,
          books: []
        };
      }
      
      playersMap[prop.player].markets[marketKey].books.push({
        book: prop.book,
        price: prop.price
      });
    });
    
    // Convert to array and sort by number of markets (most props first)
    return Object.values(playersMap).sort((a, b) => {
      const aMarkets = Object.keys(a.markets).length;
      const bMarkets = Object.keys(b.markets).length;
      return bMarkets - aMarkets;
    });
  }, [playerProps]);

  // Filter players based on search and market filter
  const filteredPlayers = useMemo(() => {
    let filtered = players;
    
    // Search filter
    if (propSearch) {
      const s = propSearch.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(s) || 
        p.game?.toLowerCase().includes(s)
      );
    }
    
    // Market filter - only show players with the selected market
    if (propFilter !== 'ALL') {
      const marketKey = `player_${propFilter.toLowerCase()}`;
      filtered = filtered.filter(p => p.markets[marketKey]);
    }
    
    return filtered;
  }, [players, propSearch, propFilter]);

  const togglePlayerExpand = (playerName) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerName)) {
        next.delete(playerName);
      } else {
        next.add(playerName);
      }
      return next;
    });
  };

  const handleAddToTracker = (player, marketKey) => {
    setSelectedPlayer(player);
    setSelectedMarket(marketKey);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    setSelectedPlayer(null);
    setSelectedMarket(null);
  };

  const confirmAddToTracker = () => {
    // TODO: Integrate with bet tracker
    console.log('Adding to tracker:', {
      player: selectedPlayer?.name,
      market: selectedMarket,
      ...selectedPlayer?.markets[selectedMarket]
    });
    closeModal();
  };

  // Get all book names for consistent column ordering
  const allBooks = useMemo(() => {
    const books = new Set();
    playerProps.forEach(p => books.add(p.book));
    return Array.from(books).sort();
  }, [playerProps]);

  // Calculate stats
  const stats = useMemo(() => ({
    totalPlayers: players.length,
    totalProps: playerProps.length,
    pointsProps: playerProps.filter(p => p.market?.includes('points')).length,
    reboundsProps: playerProps.filter(p => p.market?.includes('rebounds')).length,
    assistsProps: playerProps.filter(p => p.market?.includes('assists')).length
  }), [players, playerProps]);

  // Calculate trending props (most line movement)
  const trendingProps = useMemo(() => {
    return playerProps
      .filter(p => p.movement && p.movement.amount > 0)
      .sort((a, b) => b.movement.amount - a.movement.amount)
      .slice(0, 5);
  }, [playerProps]);

  if (loading) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading player props...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
          background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)',
          borderRadius: '8px', flex: '1', minWidth: '200px'
        }}>
          <Search size={14} color="#64748b" />
          <input 
            type="text" 
            placeholder="Search players or teams..." 
            value={propSearch}
            onChange={e => setPropSearch(e.target.value)}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              outline: 'none', 
              color: '#e2e8f0', 
              fontSize: '13px', 
              width: '100%',
              fontFamily: 'JetBrains Mono, monospace'
            }} 
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['ALL', 'POINTS', 'REBOUNDS', 'ASSISTS'].map(type => (
            <button 
              key={type} 
              onClick={() => setPropFilter(type)} 
              style={{
                padding: '8px 14px',
                background: propFilter === type ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.4)',
                border: propFilter === type ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(71,85,105,0.3)',
                borderRadius: '6px', 
                color: propFilter === type ? '#f8fafc' : '#94a3b8',
                fontSize: '11px', 
                fontWeight: 600, 
                cursor: 'pointer',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Players', value: stats.totalPlayers, color: '#06b6d4' },
          { label: 'Total Props', value: stats.totalProps, color: '#6366f1' },
          { label: 'Points', value: stats.pointsProps, color: '#f97316' },
          { label: 'Rebounds', value: stats.reboundsProps, color: '#22c55e' },
          { label: 'Assists', value: stats.assistsProps, color: '#3b82f6' },
        ].map((stat, i) => (
          <div key={i} style={{ 
            padding: '16px', 
            background: 'rgba(30,41,59,0.5)', 
            border: '1px solid rgba(71,85,105,0.2)', 
            borderRadius: '10px' 
          }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', fontFamily: 'JetBrains Mono, monospace' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Trending Props */}
      {trendingProps.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '12px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#f97316'
          }}>
            <Flame size={14} />
            TRENDING — Line Movement
          </div>
          <div style={{ 
            display: 'flex', 
            gap: '8px', 
            overflowX: 'auto',
            paddingBottom: '8px'
          }}>
            {trendingProps.map((prop, idx) => (
              <div 
                key={idx}
                style={{
                  flexShrink: 0,
                  padding: '12px 16px',
                  background: 'rgba(30,41,59,0.6)',
                  border: prop.movement.direction === 'up' 
                    ? '1px solid rgba(34,197,94,0.5)' 
                    : '1px solid rgba(239,68,68,0.5)',
                  borderRadius: '10px',
                  minWidth: '200px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setPropSearch(prop.player);
                }}
              >
                <div style={{ 
                  fontSize: '11px', 
                  color: '#64748b', 
                  marginBottom: '4px',
                  fontFamily: 'JetBrains Mono, monospace'
                }}>
                  {prop.player}
                </div>
                <div style={{ 
                  fontSize: '13px', 
                  fontWeight: 600, 
                  color: '#e2e8f0',
                  marginBottom: '4px'
                }}>
                  {getMarketDisplayName(prop.market)} {prop.line} {prop.outcome}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '11px'
                }}>
                  <span style={{
                    color: prop.movement.direction === 'up' ? '#22c55e' : '#ef4444',
                    fontWeight: 600
                  }}>
                    {prop.movement.direction === 'up' ? '↑' : '↓'} {prop.movement.amount}
                  </span>
                  <span style={{ color: '#64748b' }}>from {prop.movement.prevLine}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Player Cards */}
      {filteredPlayers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <p style={{ color: '#64748b' }}>No players found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {(tier === 'pro' ? filteredPlayers : filteredPlayers.slice(0, FREE_PLAYERS_LIMIT)).map(player => {
            const isExpanded = expandedPlayers.has(player.name);
            const marketKeys = Object.keys(player.markets);
            const visibleMarkets = propFilter === 'ALL' 
              ? marketKeys 
              : marketKeys.filter(k => k.includes(propFilter.toLowerCase()));

            return (
              <div 
                key={player.name}
                style={{
                  background: 'rgba(30,41,59,0.6)',
                  border: '1px solid rgba(71,85,105,0.2)',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}
              >
                {/* Player Header - Always Visible */}
                <div 
                  onClick={() => togglePlayerExpand(player.name)}
                  style={{
                    padding: '16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    background: isExpanded ? 'rgba(99,102,241,0.1)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '16px' }}>🏀</span>
                    <div>
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: '15px', 
                        color: '#e2e8f0',
                        fontFamily: 'JetBrains Mono, monospace'
                      }}>
                        {player.name}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {player.game}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      color: '#94a3b8',
                      background: 'rgba(71,85,105,0.3)',
                      padding: '4px 8px',
                      borderRadius: '4px'
                    }}>
                      {visibleMarkets.length} markets
                    </span>
                    {isExpanded ? (
                      <ChevronUp size={18} color="#94a3b8" />
                    ) : (
                      <ChevronDown size={18} color="#94a3b8" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px' }}>
                    {visibleMarkets.map(marketKey => {
                      const market = player.markets[marketKey];
                      const bestOdds = findBestOdds(market.books);
                      const avgOdds = calculateAverageOdds(market.books);
                      const isEdge = hasEdge(bestOdds.price, avgOdds);

                      return (
                        <div 
                          key={marketKey}
                          style={{
                            marginTop: '12px',
                            padding: '12px',
                            background: 'rgba(15,23,42,0.4)',
                            borderRadius: '8px'
                          }}
                        >
                          {/* Market Header */}
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            marginBottom: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ 
                                fontSize: '12px', 
                                fontWeight: 600, 
                                color: '#e2e8f0',
                                fontFamily: 'JetBrains Mono, monospace'
                              }}>
                                {getMarketDisplayName(marketKey)}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                O/U {market.line}
                              </span>
                              {isEdge && (
                                <span style={{
                                  fontSize: '9px',
                                  padding: '2px 6px',
                                  background: 'rgba(34,197,94,0.2)',
                                  borderRadius: '4px',
                                  color: '#22c55e',
                                  fontWeight: 700
                                }}>
                                  EDGE
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Book Comparison Table */}
                          <div style={{ 
                            overflowX: 'auto',
                            marginBottom: '8px'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              gap: '6px',
                              minWidth: 'max-content'
                            }}>
                              {allBooks.map(book => {
                                const bookData = market.books.find(b => b.book === book);
                                const isBest = bookData && bookData.price === bestOdds.price;

                                return (
                                  <div 
                                    key={book}
                                    style={{
                                      padding: '8px 10px',
                                      background: isBest ? 'rgba(34,197,94,0.15)' : 'rgba(30,41,59,0.6)',
                                      border: isBest ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(71,85,105,0.3)',
                                      borderRadius: '6px',
                                      textAlign: 'center',
                                      minWidth: '50px'
                                    }}
                                  >
                                    <div style={{ 
                                      fontSize: '9px', 
                                      color: '#64748b',
                                      marginBottom: '2px',
                                      fontFamily: 'JetBrains Mono, monospace'
                                    }}>
                                      {getBookAbbreviation(book)}
                                    </div>
                                    <div style={{ 
                                      fontSize: '12px', 
                                      fontWeight: isBest ? 700 : 500,
                                      color: isBest ? '#22c55e' : '#e2e8f0',
                                      fontFamily: 'JetBrains Mono, monospace'
                                    }}>
                                      {bookData ? (
                                        <>
                                          {formatOdds(bookData.price)}
                                          {isBest && <span style={{ marginLeft: '2px' }}>✓</span>}
                                        </>
                                      ) : (
                                        <span style={{ color: '#475569' }}>—</span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Add to Bet Tracker Button */}
                    <button
                      onClick={() => handleAddToTracker(player, visibleMarkets[0])}
                      style={{
                        marginTop: '16px',
                        width: '100%',
                        padding: '10px 16px',
                        background: 'rgba(99,102,241,0.2)',
                        border: '1px solid rgba(99,102,241,0.4)',
                        borderRadius: '8px',
                        color: '#818cf8',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontFamily: 'JetBrains Mono, monospace'
                      }}
                    >
                      <Plus size={14} />
                      Add to Bet Tracker
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Locked players overlay for free users */}
          {tier === 'free' && filteredPlayers.length > FREE_PLAYERS_LIMIT && (
            <>
              <div style={{
                position: 'relative',
                marginTop: '8px',
              }}>
                {/* Blurred preview of locked players */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  filter: 'blur(6px)', 
                  opacity: 0.4, 
                  pointerEvents: 'none',
                }}>
                  {filteredPlayers.slice(FREE_PLAYERS_LIMIT, FREE_PLAYERS_LIMIT + 2).map(player => (
                    <div key={player.name} style={{
                      padding: '16px', 
                      background: 'rgba(30,41,59,0.6)',
                      border: '1px solid rgba(71,85,105,0.3)', 
                      borderRadius: '12px',
                    }}>
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0' }}>{player.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{Object.keys(player.markets).length} markets</div>
                    </div>
                  ))}
                </div>

                {/* Lock overlay */}
                <div style={{
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0,
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'rgba(15, 23, 42, 0.6)',
                  borderRadius: '12px',
                }}>
                  <Lock size={28} color="#818cf8" style={{ marginBottom: '12px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>
                    +{filteredPlayers.length - FREE_PLAYERS_LIMIT} more players locked
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                    Upgrade to Pro to see all player props
                  </div>
                </div>
              </div>

              {/* ProBanner */}
              <div style={{ marginTop: '8px' }}>
                <ProBanner />
              </div>
            </>
          )}
        </div>
      )}

      {/* Add to Bet Tracker Modal */}
      {showAddModal && selectedPlayer && selectedMarket && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(30,41,59,0.95)',
            border: '1px solid rgba(71,85,105,0.4)',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, color: '#e2e8f0', fontSize: '16px', fontFamily: 'JetBrains Mono, monospace' }}>
                Add to Bet Tracker
              </h3>
              <button 
                onClick={closeModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={18} color="#94a3b8" />
              </button>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: '#e2e8f0', marginBottom: '4px', fontWeight: 600 }}>
                {selectedPlayer.name}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                {getMarketDisplayName(selectedMarket)} O/U {selectedPlayer.markets[selectedMarket]?.line}
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>
                Select Sportsbook
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedPlayer.markets[selectedMarket]?.books.map(bookData => (
                  <button
                    key={bookData.book}
                    style={{
                      padding: '8px 12px',
                      background: 'rgba(99,102,241,0.2)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      borderRadius: '6px',
                      color: '#818cf8',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'JetBrains Mono, monospace'
                    }}
                  >
                    {getBookAbbreviation(bookData.book)} {formatOdds(bookData.price)}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={closeModal}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'rgba(71,85,105,0.3)',
                  border: '1px solid rgba(71,85,105,0.5)',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmAddToTracker}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  background: 'rgba(99,102,241,0.3)',
                  border: '1px solid rgba(99,102,241,0.5)',
                  borderRadius: '8px',
                  color: '#818cf8',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'JetBrains Mono, monospace'
                }}
              >
                Add Bet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
