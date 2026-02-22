// BetTracker.jsx — Redesigned with Option 3: Tab + Dropdown Hybrid
// Sport tabs at top, filter dropdowns, date-grouped bet list

import React, { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle, Trophy, XCircle, RotateCcw, TrendingUp,
  DollarSign, Target, BarChart3, Trash2, ChevronDown, ChevronUp,
  Search, Calendar, Filter
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { americanToDecimal } from '../utils/odds-math.js';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { useCloudBets } from '../hooks/useCloudBets.js';

// Constants
const BET_TYPES = ['Spread', 'Moneyline', 'Total', 'Prop', 'Future', 'Other'];
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#22c55e', '#f59e0b', '#64748b'];
const FREE_BET_LIMIT = 5;

// Sports for tabs
const DEFAULT_SPORTS = ['All', 'NBA', 'NFL', 'UFC', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];

// Filter options
const TIME_FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: '7days', label: 'Last 7 Days' },
  { key: '30days', label: 'Last 30 Days' },
  { key: '90days', label: 'Last 90 Days' },
];

const STATUS_FILTERS = [
  { key: 'all', label: 'All Bets' },
  { key: 'pending', label: 'Pending' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'push', label: 'Push' },
];

// Helpers
function formatMoney(val) {
  if (val === null || val === undefined) return '—';
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatOdds(odds) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function getRelativeDate(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const betDate = new Date(date);
  betDate.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((today - betDate) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

function getSportFromGame(gameStr) {
  if (!gameStr) return 'Other';
  const game = gameStr.toLowerCase();
  if (game.includes('lakers') || game.includes('celtics') || game.includes('nba')) return 'NBA';
  if (game.includes('chiefs') || game.includes('eagles') || game.includes('nfl')) return 'NFL';
  if (game.includes('ufc') || game.includes('fight')) return 'UFC';
  if (game.includes('yankees') || game.includes('mlb')) return 'MLB';
  return 'Other';
}

const cardStyle = {
  background: 'rgba(30, 41, 59, 0.6)',
  border: '1px solid rgba(71, 85, 105, 0.2)',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '12px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  background: 'rgba(15, 23, 42, 0.8)',
  border: '1px solid rgba(71, 85, 105, 0.4)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function BetTracker({ pendingBet, onBetConsumed }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';
  const [bets, setBets] = useCloudBets('edgefinder_bets', []);
  
  // Form state
  const [game, setGame] = useState('');
  const [betType, setBetType] = useState('Spread');
  const [pick, setPick] = useState('');
  const [odds, setOdds] = useState('');
  const [wager, setWager] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showForm, setShowForm] = useState(false);
  const [isPreFilled, setIsPreFilled] = useState(false);
  
  // Filter states
  const [activeSport, setActiveSport] = useState('All');
  const [timeFilter, setTimeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  
  useEffect(() => {
    if (pendingBet) {
      setGame(pendingBet.game || '');
      setBetType(pendingBet.type || 'Spread');
      setPick(pendingBet.pick || '');
      setOdds(pendingBet.odds != null ? String(pendingBet.odds) : '');
      setDate(pendingBet.date ? new Date(pendingBet.date).toISOString().split('T')[0] : todayStr());
      setShowForm(true);
      setIsPreFilled(true);
    }
  }, [pendingBet]);
  
  // Auto-detect sports
  const detectedSports = useMemo(() => {
    const sports = new Set(['All']);
    bets.forEach(bet => {
      const sport = getSportFromGame(bet.game);
      if (sport) sports.add(sport);
    });
    return Array.from(sports);
  }, [bets]);
  
  const sportsTabs = detectedSports.length > 1 ? detectedSports : DEFAULT_SPORTS;
  
  // Filter bets
  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      if (activeSport !== 'All') {
        const betSport = getSportFromGame(bet.game);
        if (betSport !== activeSport) return false;
      }
      
      if (timeFilter !== 'all') {
        const betDate = new Date(bet.date);
        const now = new Date();
        const daysDiff = (now - betDate) / (1000 * 60 * 60 * 24);
        if (timeFilter === '7days' && daysDiff > 7) return false;
        if (timeFilter === '30days' && daysDiff > 30) return false;
        if (timeFilter === '90days' && daysDiff > 90) return false;
      }
      
      if (statusFilter !== 'all' && bet.status !== statusFilter) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return bet.game?.toLowerCase().includes(query) || bet.pick?.toLowerCase().includes(query);
      }
      
      return true;
    });
  }, [bets, activeSport, timeFilter, statusFilter, searchQuery]);
  
  const pendingBets = useMemo(() => 
    filteredBets.filter(b => b.status === 'pending').sort((a, b) => new Date(b.date) - new Date(a.date)),
    [filteredBets]
  );
  
  const settledBets = useMemo(() => 
    filteredBets.filter(b => b.status !== 'pending').sort((a, b) => new Date(b.settledDate || b.date) - new Date(a.settledDate || b.date)),
    [filteredBets]
  );
  
  // Group by date
  const groupedBets = useMemo(() => {
    const groups = {};
    settledBets.forEach(bet => {
      const dateLabel = getRelativeDate(bet.settledDate || bet.date);
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(bet);
    });
    return groups;
  }, [settledBets]);
  
  // Stats
  const stats = useMemo(() => {
    const settled = filteredBets.filter(b => b.status !== 'pending');
    const wins = settled.filter(b => b.status === 'won').length;
    const losses = settled.filter(b => b.status === 'lost').length;
    const pushes = settled.filter(b => b.status === 'push').length;
    const total = settled.length;
    const totalWagered = settled.reduce((sum, b) => sum + Number(b.wager), 0);
    const netPL = settled.reduce((sum, b) => sum + (b.profit || 0), 0);
    const winPct = total > 0 ? ((wins / (wins + losses)) * 100) : 0;
    const roi = totalWagered > 0 ? ((netPL / totalWagered) * 100) : 0;
    return { wins, losses, pushes, total, totalWagered, netPL, winPct, roi };
  }, [filteredBets]);
  
  const atLimit = !isPro && bets.length >= FREE_BET_LIMIT;
  
  function handleAddBet(e) {
    e.preventDefault();
    if (atLimit) return;
    if (!game || !pick || !odds || !wager) return;
    
    const newBet = {
      id: Date.now(),
      game,
      type: betType,
      pick,
      odds: Number(odds),
      wager: Number(wager),
      date,
      status: 'pending',
      profit: null,
      settledDate: null,
    };
    
    setBets(prev => [newBet, ...prev]);
    setGame('');
    setPick('');
    setOdds('');
    setWager('');
    setDate(todayStr());
    setShowForm(false);
    setIsPreFilled(false);
    if (onBetConsumed) onBetConsumed();
  }
  
  function settleBet(id, result) {
    setBets(prev => prev.map(bet => {
      if (bet.id !== id) return bet;
      let profit = 0;
      if (result === 'won') {
        const decimal = americanToDecimal(bet.odds);
        profit = Number((bet.wager * (decimal - 1)).toFixed(2));
      } else if (result === 'lost') {
        profit = -bet.wager;
      }
      return { ...bet, status: result, profit, settledDate: todayStr() };
    }));
  }
  
  function deleteBet(id) {
    setBets(prev => prev.filter(b => b.id !== id));
  }
  
  return (
    <div style={{ padding: '20px 24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* STATS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
        gap: '10px',
        marginBottom: '16px',
      }}>
        {[
          { label: 'Total Bets', value: filteredBets.length, icon: <Target size={14} />, color: '#818cf8' },
          { label: 'Record', value: `${stats.wins}-${stats.losses}-${stats.pushes}`, icon: <Trophy size={14} />, color: '#c4b5fd' },
          { label: 'Win %', value: `${stats.winPct.toFixed(1)}%`, icon: <TrendingUp size={14} />, color: stats.winPct >= 50 ? '#22c55e' : '#f87171' },
          { label: 'Net P&L', value: formatMoney(stats.netPL), icon: <BarChart3 size={14} />, color: stats.netPL >= 0 ? '#22c55e' : '#f87171' },
        ].map((s, i) => (
          <div key={i} style={{ ...cardStyle, marginBottom: 0, padding: '12px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>
      
      {/* SPORT TABS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
        {sportsTabs.map(sport => (
          <button
            key={sport}
            onClick={() => setActiveSport(sport)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: activeSport === sport ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.5)',
              color: activeSport === sport ? '#818cf8' : '#64748b',
              fontSize: '13px',
              fontWeight: activeSport === sport ? 700 : 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              border: `1px solid ${activeSport === sport ? 'rgba(99, 102, 241, 0.5)' : 'rgba(71, 85, 105, 0.2)'}`,
            }}
          >
            {sport}
          </button>
        ))}
      </div>
      
      {/* FILTER BAR */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Time Filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: '8px',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <Calendar size={14} />
            {TIME_FILTERS.find(t => t.key === timeFilter)?.label}
            <ChevronDown size={14} />
          </button>
          {showTimeDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '4px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: '8px', padding: '4px', zIndex: 100, minWidth: '140px',
            }}>
              {TIME_FILTERS.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTimeFilter(t.key); setShowTimeDropdown(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 12px',
                    background: timeFilter === t.key ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    border: 'none', borderRadius: '4px',
                    color: timeFilter === t.key ? '#818cf8' : '#94a3b8',
                    fontSize: '12px', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Status Filter */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: '8px',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <Filter size={14} />
            {STATUS_FILTERS.find(s => s.key === statusFilter)?.label}
            <ChevronDown size={14} />
          </button>
          {showStatusDropdown && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, marginTop: '4px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: '8px', padding: '4px', zIndex: 100, minWidth: '120px',
            }}>
              {STATUS_FILTERS.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setStatusFilter(s.key); setShowStatusDropdown(false); }}
                  style={{
                    display: 'block', width: '100%', padding: '8px 12px',
                    background: statusFilter === s.key ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                    border: 'none', borderRadius: '4px',
                    color: statusFilter === s.key ? '#818cf8' : '#94a3b8',
                    fontSize: '12px', textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Search */}
        <div style={{ flex: 1, minWidth: '150px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 12px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px',
          }}>
            <Search size={14} color="#64748b" />
            <input
              type="text"
              placeholder="Search bets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1, background: 'transparent', border: 'none',
                color: '#e2e8f0', fontSize: '12px', outline: 'none',
              }}
            />
          </div>
        </div>
        
        {/* Add Bet */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px',
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid rgba(99, 102, 241, 0.5)',
            borderRadius: '8px',
            color: '#818cf8',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <PlusCircle size={16} />
          Add Bet
        </button>
      </div>
      
      {/* ADD BET FORM */}
      {showForm && (
        <div style={cardStyle}>
          {isPreFilled && (
            <div style={{
              padding: '8px 12px', background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: '6px', marginBottom: '12px',
              fontSize: '12px', color: '#818cf8',
            }}>
              ✓ Pre-filled from Games tab
            </div>
          )}
          <form onSubmit={handleAddBet} style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>Game</label>
                <input type="text" value={game} onChange={(e) => setGame(e.target.value)} placeholder="Lakers vs Celtics" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>Bet Type</label>
                <select value={betType} onChange={(e) => setBetType(e.target.value)} style={inputStyle}>
                  {BET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>Pick</label>
                <input type="text" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Lakers -3.5" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>Odds</label>
                <input type="number" value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="-110" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block' }}>Wager</label>
                <input type="number" value={wager} onChange={(e) => setWager(e.target.value)} placeholder="100" style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowForm(false)} style={{
                padding: '8px 16px', background: 'transparent',
                border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '6px',
                color: '#94a3b8', fontSize: '12px', cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button type="submit" disabled={atLimit || !game || !pick || !odds || !wager} style={{
                padding: '8px 16px',
                background: atLimit ? 'rgba(71, 85, 105, 0.3)' : 'rgba(99, 102, 241, 0.2)',
                border: '1px solid rgba(99, 102, 241, 0.5)', borderRadius: '6px',
                color: atLimit ? '#64748b' : '#818cf8', fontSize: '12px', fontWeight: 600,
                cursor: atLimit ? 'not-allowed' : 'pointer',
              }}>
                {atLimit ? 'Free Limit Reached' : 'Add Bet'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {!isPro && <ProBanner />}
      
      {/* PENDING BETS */}
      {pendingBets.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 700, color: '#f59e0b',
            marginBottom: '8px', letterSpacing: '0.5px',
          }}>
            PENDING ({pendingBets.length})
          </div>
          {pendingBets.map(bet => (
            <BetCard key={bet.id} bet={bet} onSettle={settleBet} onDelete={deleteBet} isPending />
          ))}
        </div>
      )}
      
      {/* GROUPED SETTLED BETS */}
      {Object.keys(groupedBets).length > 0 ? (
        Object.entries(groupedBets).map(([dateLabel, bets]) => (
          <div key={dateLabel} style={{ marginBottom: '20px' }}>
            <div style={{
              fontSize: '11px', fontWeight: 700, color: '#64748b',
              marginBottom: '8px', letterSpacing: '0.5px',
            }}>
              {dateLabel}
            </div>
            {bets.map(bet => (
              <BetCard key={bet.id} bet={bet} onSettle={settleBet} onDelete={deleteBet} />
            ))}
          </div>
        ))
      ) : filteredBets.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <Trophy size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div style={{ fontSize: '14px', marginBottom: '4px' }}>No bets found</div>
          <div style={{ fontSize: '12px' }}>Try adjusting your filters or add a new bet</div>
        </div>
      ) : null}
    </div>
  );
}

// Bet Card Component
function BetCard({ bet, onSettle, onDelete, isPending }) {
  const statusColors = {
    pending: '#f59e0b', won: '#22c55e', lost: '#ef4444', push: '#64748b',
  };
  
  return (
    <div style={{
      ...cardStyle,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 16px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{bet.game}</span>
          <span style={{
            fontSize: '10px', padding: '2px 6px',
            background: 'rgba(99, 102, 241, 0.15)', borderRadius: '4px', color: '#818cf8',
          }}>{bet.type}</span>
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          {bet.pick} @ {formatOdds(bet.odds)} • ${bet.wager}
        </div>
      </div>
      
      <div style={{ textAlign: 'right' }}>
        {isPending ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => onSettle(bet.id, 'won')} style={{
              padding: '6px 12px', background: 'rgba(34, 197, 94, 0.2)',
              border: '1px solid rgba(34, 197, 94, 0.5)', borderRadius: '6px',
              color: '#22c55e', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}>Won</button>
            <button onClick={() => onSettle(bet.id, 'lost')} style={{
              padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px',
              color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}>Lost</button>
            <button onClick={() => onSettle(bet.id, 'push')} style={{
              padding: '6px 12px', background: 'rgba(100, 116, 139, 0.2)',
              border: '1px solid rgba(100, 116, 139, 0.5)', borderRadius: '6px',
              color: '#64748b', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}>Push</button>
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: '12px', fontWeight: 700,
              color: bet.profit >= 0 ? '#22c55e' : '#ef4444',
            }}>
              {bet.profit > 0 ? '+' : ''}{formatMoney(bet.profit)}
            </div>
            <div style={{
              fontSize: '10px', padding: '2px 6px',
              background: `rgba(${bet.status === 'won' ? '34, 197, 94' : bet.status === 'lost' ? '239, 68, 68' : '100, 116, 139'}, 0.15)`,
              borderRadius: '4px', color: statusColors[bet.status], display: 'inline-block',
            }}>
              {bet.status.toUpperCase()}
            </div>
          </div>
        )}
      </div>
      
      <button onClick={() => onDelete(bet.id)} style={{
        marginLeft: '12px', padding: '6px',
        background: 'transparent', border: 'none',
        color: '#64748b', cursor: 'pointer',
      }}>
        <Trash2 size={16} />
      </button>
    </div>
  );
}
