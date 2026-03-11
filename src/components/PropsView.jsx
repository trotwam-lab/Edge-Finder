import React, { useState, useMemo } from 'react';
import { Search, Loader, Lock, ChevronDown, ChevronUp, X, Plus, Check, ShoppingCart } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

const FREE_PLAYERS_LIMIT = 3;

const BOOK_ABBREVIATIONS = {
  'FanDuel': 'FD', 'DraftKings': 'DK', 'BetMGM': 'MGM', 'Caesars': 'Csr',
  'BetRivers': 'BR', 'PointsBet': 'PB', 'Bet365': 'B365', 'WynnBET': 'Wynn',
  'Unibet': 'Uni', 'Barstool': 'BAR', 'ESPN BET': 'ESPN', 'Fanatics': 'Fan'
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

// ─── Confirmation Modal ───────────────────────────────────────────────────────
function QuickAddModal({ bet, onConfirm, onCancel }) {
  const [wager, setWager] = useState('');

  if (!bet) return null;

  const handleConfirm = () => {
    if (!wager || isNaN(Number(wager)) || Number(wager) <= 0) return;
    onConfirm({ ...bet, wager: Number(wager) });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: 'rgb(15,23,42)',
        border: '1px solid rgba(99,102,241,0.4)',
        borderRadius: '16px',
        padding: '28px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShoppingCart size={18} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Quick Add Bet</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Confirm and save to tracker</div>
            </div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>

        {/* Bet summary */}
        <div style={{
          background: 'rgba(30,41,59,0.7)',
          borderRadius: '10px',
          padding: '16px',
          marginBottom: '20px',
          border: '1px solid rgba(71,85,105,0.3)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Player', value: bet.player },
              { label: 'Bet Type', value: 'Player Prop' },
              { label: 'Pick', value: bet.pick },
              { label: 'Book', value: bet.book },
              { label: 'Odds', value: formatOdds(bet.odds), color: bet.odds > 0 ? '#22c55e' : '#f8fafc' },
              { label: 'Game', value: bet.game },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: color || '#e2e8f0' }}>{value || '—'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Wager input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>
            Wager Amount ($)
          </label>
          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(30,41,59,0.6)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: '8px',
            padding: '10px 14px',
            gap: '8px',
          }}>
            <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 700 }}>$</span>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 25"
              value={wager}
              onChange={e => setWager(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }}
              autoFocus
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: '#f8fafc', fontSize: '16px', fontWeight: 700,
                width: '100%', fontFamily: 'JetBrains Mono, monospace',
              }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '11px', borderRadius: '8px',
              background: 'rgba(71,85,105,0.2)', border: '1px solid rgba(71,85,105,0.3)',
              color: '#94a3b8', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!wager || Number(wager) <= 0}
            style={{
              flex: 2, padding: '11px', borderRadius: '8px',
              background: wager && Number(wager) > 0 ? 'rgba(99,102,241,0.8)' : 'rgba(99,102,241,0.3)',
              border: '1px solid rgba(99,102,241,0.5)',
              color: wager && Number(wager) > 0 ? '#fff' : '#64748b',
              fontSize: '13px', fontWeight: 700, cursor: wager && Number(wager) > 0 ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'all 0.15s',
            }}
          >
            <Check size={15} />
            Add to Tracker
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Clickable odds cell ──────────────────────────────────────────────────────
function OddsCell({ price, isBest, side, player, marketKey, line, book, game, onQuickAdd }) {
  const [hovered, setHovered] = useState(false);
  const hasPrice = price != null;
  const isOver = side === 'over';

  const baseColor = isOver ? '#22c55e' : '#ef4444';
  const bestBg = isOver ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  const hoverBg = isOver ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)';

  if (!hasPrice) {
    return (
      <td style={{ padding: '6px 8px', textAlign: 'center', color: '#334155', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>—</td>
    );
  }

  const handleClick = () => {
    const marketLabel = getMarketDisplayName(marketKey);
    const sideLabel = isOver ? `Over ${line}` : `Under ${line}`;
    onQuickAdd({
      player,
      game,
      book,
      odds: price,
      pick: `${player} ${marketLabel} ${sideLabel}`,
      type: 'Player Prop',
      date: new Date().toISOString(),
    });
  };

  return (
    <td
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Click to add: ${isOver ? 'Over' : 'Under'} ${line} @ ${formatOdds(price)} (${book})`}
      style={{
        padding: '6px 8px',
        textAlign: 'center',
        cursor: 'pointer',
        borderRadius: '5px',
        background: hovered ? hoverBg : isBest ? bestBg : 'transparent',
        transition: 'background 0.12s',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        position: 'relative',
      }}
    >
      <span style={{ color: isBest || hovered ? baseColor : '#e2e8f0', fontWeight: isBest || hovered ? 700 : 400 }}>
        {formatOdds(price)}
      </span>
      {isBest && !hovered && <span style={{ marginLeft: '2px', fontSize: '9px', color: baseColor }}>★</span>}
      {hovered && (
        <span style={{ marginLeft: '3px', fontSize: '9px', color: baseColor, verticalAlign: 'middle' }}>
          <Plus size={9} style={{ display: 'inline', verticalAlign: 'middle' }} />
        </span>
      )}
    </td>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PropsView({ playerProps, loading, propHistory, setPendingBet }) {
  const { tier } = useAuth();
  const [propFilter, setPropFilter] = useState('ALL');
  const [propSearch, setPropSearch] = useState('');
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const [pendingModal, setPendingModal] = useState(null); // bet being confirmed

  // ── Group props ────────────────────────────────────────────────────────────
  const players = useMemo(() => {
    const map = {};
    const lineVotes = {}; // track line frequency per player+market for consensus
    playerProps.forEach(prop => {
      const pk = prop.player;
      if (!pk) return;
      if (!map[pk]) map[pk] = { name: prop.player, game: prop.game, markets: {} };
      const mk = prop.market;
      if (!map[pk].markets[mk]) map[pk].markets[mk] = { line: null, over: {}, under: {}, books: new Set(), _lineVotes: {} };
      const mkt = map[pk].markets[mk];
      const book = prop.book || prop.bookTitle || prop.bookKey || 'Unknown';
      const propLine = prop.line;

      // Skip Bovada alternate lines that differ from the book's primary (lowest) line seen
      // We always keep the entry closest to the consensus, handled below via votes
      mkt.books.add(book);

      // Vote for this line to find consensus
      if (propLine != null) {
        const voteKey = `${pk}-${mk}-${propLine}`;
        lineVotes[voteKey] = (lineVotes[voteKey] || 0) + 1;
        mkt._lineVotes[propLine] = (mkt._lineVotes[propLine] || 0) + 1;
      }

      if (prop.outcome === 'Over') {
        // For a given book, keep the price for the line closest to consensus
        // Store per-line so we can pick the right one after voting
        if (!mkt._overByLine) mkt._overByLine = {};
        if (!mkt._overByLine[book]) mkt._overByLine[book] = {};
        if (propLine != null) mkt._overByLine[book][propLine] = prop.price;
      } else if (prop.outcome === 'Under') {
        if (!mkt._underByLine) mkt._underByLine = {};
        if (!mkt._underByLine[book]) mkt._underByLine[book] = {};
        if (propLine != null) mkt._underByLine[book][propLine] = prop.price;
      }
    });
    Object.values(map).forEach(p => {
      Object.values(p.markets).forEach(mkt => {
        // Compute consensus line (the line with the most votes across bookmakers)
        const votes = mkt._lineVotes || {};
        let consensusLine = null;
        let maxVotes = 0;
        Object.entries(votes).forEach(([line, count]) => {
          if (count > maxVotes || (count === maxVotes && consensusLine !== null && Number(line) < Number(consensusLine))) {
            maxVotes = count;
            consensusLine = Number(line);
          }
        });
        mkt.line = consensusLine;

        // Resolve over/under prices: prefer price at consensus line, fall back to closest line
        mkt.bookList = Array.from(mkt.books).sort();
        mkt.bookList.forEach(book => {
          const overByLine = mkt._overByLine?.[book] || {};
          const underByLine = mkt._underByLine?.[book] || {};

          if (consensusLine != null && overByLine[consensusLine] != null) {
            mkt.over[book] = overByLine[consensusLine];
          } else {
            // Fallback: pick the line closest to consensus
            const lines = Object.keys(overByLine).map(Number);
            if (lines.length) {
              const closest = lines.reduce((a, b) => Math.abs(b - (consensusLine || 0)) < Math.abs(a - (consensusLine || 0)) ? b : a);
              mkt.over[book] = overByLine[closest];
            }
          }

          if (consensusLine != null && underByLine[consensusLine] != null) {
            mkt.under[book] = underByLine[consensusLine];
          } else {
            const lines = Object.keys(underByLine).map(Number);
            if (lines.length) {
              const closest = lines.reduce((a, b) => Math.abs(b - (consensusLine || 0)) < Math.abs(a - (consensusLine || 0)) ? b : a);
              mkt.under[book] = underByLine[closest];
            }
          }
        });

        // Clean up temp data
        delete mkt.books;
        delete mkt._lineVotes;
        delete mkt._overByLine;
        delete mkt._underByLine;
      });
    });
    return Object.values(map).sort((a, b) => Object.keys(b.markets).length - Object.keys(a.markets).length);
  }, [playerProps]);

  const filteredPlayers = useMemo(() => {
    let f = players;
    if (propSearch) {
      const s = propSearch.toLowerCase();
      f = f.filter(p => p.name?.toLowerCase().includes(s) || p.game?.toLowerCase().includes(s));
    }
    if (propFilter !== 'ALL') {
      const mk = `player_${propFilter.toLowerCase()}`;
      f = f.filter(p => p.markets[mk]);
    }
    return f;
  }, [players, propSearch, propFilter]);

  const toggleExpand = name => setExpandedPlayers(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const stats = useMemo(() => ({
    totalPlayers: players.length,
    totalProps: playerProps.length,
    pointsProps: playerProps.filter(p => p.market?.includes('points')).length,
    reboundsProps: playerProps.filter(p => p.market?.includes('rebounds')).length,
    assistsProps: playerProps.filter(p => p.market?.includes('assists')).length,
  }), [players, playerProps]);

  // ── Quick-add handlers ─────────────────────────────────────────────────────
  const handleQuickAdd = (bet) => {
    setPendingModal(bet); // open confirmation modal
  };

  const handleConfirm = (betWithWager) => {
    if (setPendingBet) {
      setPendingBet({
        game: betWithWager.game || betWithWager.player,
        type: 'Player Prop',
        pick: betWithWager.pick,
        odds: betWithWager.odds,
        wager: betWithWager.wager,
        date: betWithWager.date || new Date().toISOString(),
      });
    }
    setPendingModal(null);
  };

  const handleCancel = () => setPendingModal(null);

  if (loading) {
    return (
      <div style={{ padding: '20px 24px', textAlign: 'center', paddingTop: '60px' }}>
        <Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading player props...</p>
      </div>
    );
  }

  return (
    <>
      {/* Confirmation modal (portal-like, fixed overlay) */}
      {pendingModal && (
        <QuickAddModal
          bet={pendingModal}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      <div style={{ padding: '20px 24px' }}>
        {/* Search and Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {/* Search - Pro only */}
          {tier === 'pro' ? (
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
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(30,41,59,0.3)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '8px', flex: '1', minWidth: '200px', opacity: 0.6 }}>
              <Lock size={14} color="#64748b" />
              <span style={{ color: '#64748b', fontSize: '13px' }}>Search (Pro only)</span>
            </div>
          )}
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

        {/* Click hint */}
        {filteredPlayers.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 14px', marginBottom: '16px',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '8px',
            fontSize: '11px', color: '#818cf8',
          }}>
            <ShoppingCart size={13} />
            Click any odds cell to quick-add to your Bet Tracker
          </div>
        )}


        {/* Bovada alternate lines disclaimer */}
        {filteredPlayers.some(p => Object.values(p.markets).some(m => m.bookList?.includes('Bovada'))) && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            padding: '9px 14px', marginBottom: '16px',
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: '8px',
            fontSize: '11px', color: '#ca8a04',
            lineHeight: '1.5',
          }}>
            <span style={{ fontSize: '13px', flexShrink: 0, marginTop: '1px' }}>⚠️</span>
            <span>
              <strong>Bovada note:</strong> Bovada posts multiple alternate lines for the same prop (e.g. Over 22.5 and Over 21.5).
              The odds shown may reflect a different line than the header displays. Always verify the exact line on Bovada before placing a bet.
            </span>
          </div>
        )}

        {/* Player cards */}
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
                  {/* Player header */}
                  <div
                    onClick={() => toggleExpand(player.name)}
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

                  {/* Expanded: O/U table per market — all cells clickable */}
                  {isExpanded && (
                    <div style={{ padding: '0 16px 16px' }}>
                      {visibleMarkets.map(marketKey => {
                        const mkt = player.markets[marketKey];
                        const books = mkt.bookList || [];
                        const overPrices  = Object.values(mkt.over).filter(p => p != null);
                        const underPrices = Object.values(mkt.under).filter(p => p != null);
                        const bestOver  = overPrices.length  ? Math.max(...overPrices)  : null;
                        const bestUnder = underPrices.length ? Math.max(...underPrices) : null;

                        return (
                          <div key={marketKey} style={{ marginTop: '12px', padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: '8px' }}>
                            {/* Market header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>
                                {getMarketDisplayName(marketKey)}
                              </span>
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>O/U {mkt.line}</span>
                              <span style={{ fontSize: '10px', color: '#64748b' }}>{books.length} book{books.length !== 1 ? 's' : ''}</span>
                              <span style={{
                                marginLeft: 'auto', fontSize: '9px', color: '#6366f1',
                                background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: '4px',
                              }}>
                                tap odds to add
                              </span>
                            </div>

                            {/* Over/Under table */}
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>
                                <thead>
                                  <tr>
                                    <td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600, width: '56px' }}>Side</td>
                                    {books.map(book => (
                                      <td key={book} style={{ padding: '4px 8px', color: '#64748b', textAlign: 'center', minWidth: '52px' }}>
                                        {getBookAbbreviation(book)}
                                      </td>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td style={{ padding: '6px 8px', color: '#22c55e', fontWeight: 700 }}>Over</td>
                                    {books.map(book => (
                                      <OddsCell
                                        key={book}
                                        price={mkt.over[book]}
                                        isBest={mkt.over[book] != null && mkt.over[book] === bestOver}
                                        side="over"
                                        player={player.name}
                                        marketKey={marketKey}
                                        line={mkt.line}
                                        book={book}
                                        game={player.game}
                                        onQuickAdd={handleQuickAdd}
                                      />
                                    ))}
                                  </tr>
                                  <tr>
                                    <td style={{ padding: '6px 8px', color: '#ef4444', fontWeight: 700 }}>Under</td>
                                    {books.map(book => (
                                      <OddsCell
                                        key={book}
                                        price={mkt.under[book]}
                                        isBest={mkt.under[book] != null && mkt.under[book] === bestUnder}
                                        side="under"
                                        player={player.name}
                                        marketKey={marketKey}
                                        line={mkt.line}
                                        book={book}
                                        game={player.game}
                                        onQuickAdd={handleQuickAdd}
                                      />
                                    ))}
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

            {/* Lock overlay for free tier */}
            {tier === 'free' && filteredPlayers.length > FREE_PLAYERS_LIMIT && (
              <>
                <div style={{ position: 'relative', marginTop: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none' }}>
                    {filteredPlayers.slice(FREE_PLAYERS_LIMIT, FREE_PLAYERS_LIMIT + 2).map(p => (
                      <div key={p.name} style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>{Object.keys(p.markets).length} markets</div>
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
    </>
  );
}
