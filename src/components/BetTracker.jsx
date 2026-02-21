// BetTracker.jsx ★ Track your bets, see stats, and monitor your P&L
// This is the main Bet Tracker tab for Edge Finder
// It saves all bets to localStorage so they persist between sessions

import React, { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle, Trophy, XCircle, RotateCcw, TrendingUp,
  DollarSign, Target, BarChart3, Trash2, ChevronDown, ChevronUp,
  Search
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { americanToDecimal } from '../utils/odds-math.js';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { usePersistentState } from '../hooks/useOdds.js';

// ★★★ Constants ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// These are the bet types a user can choose from in the dropdown
const BET_TYPES = ['Spread', 'Moneyline', 'Total', 'Prop', 'Future', 'Other'];

// Colors for the pie chart slices (one per bet type)
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#22c55e', '#f59e0b', '#64748b'];

// How many bets free users can track before hitting the paywall
const FREE_BET_LIMIT = 5;

// ★★★ Sport Tabs Configuration ★★★
const SPORTS = [
  { key: 'ALL', label: 'All', emoji: '🏆' },
  { key: 'NBA', label: 'NBA', emoji: '🏀' },
  { key: 'NFL', label: 'NFL', emoji: '🏈' },
  { key: 'UFC', label: 'UFC', emoji: '🥊' },
  { key: 'NHL', label: 'NHL', emoji: '🏒' },
  { key: 'MLB', label: 'MLB', emoji: '⚾' },
  { key: 'OTHER', label: 'Other', emoji: '🎯' },
];

// ★★★ Time Range Options ★★★
const TIME_RANGES = [
  { key: '3', label: 'Last 3' },
  { key: '7', label: 'Last 7 Days' },
  { key: '30', label: 'Last 30 Days' },
  { key: '90', label: 'Last 90 Days' },
  { key: 'all', label: 'All Time' },
];

// ★★★ Status Filter Options ★★★
const STATUS_FILTERS = [
  { key: 'ALL', label: 'All Bets' },
  { key: 'pending', label: 'Pending' },
  { key: 'settled', label: 'Settled' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
];

// ★★★ Shared Styles ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// Reusable style objects so we don't repeat ourselves everywhere
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
  fontFamily: "'JetBrains Mono', monospace",
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#94a3b8',
  marginBottom: '4px',
  display: 'block',
};

// ★★★ Helper: format a dollar amount with + or - sign ★★★★★★★★★★★★★★★★★★★★★★★★★
function formatMoney(val) {
  if (val === null || val === undefined) return '★';
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

// ★★★ Helper: get today's date as YYYY-MM-DD string ★★★★★★★★★★★★★★★★★★★★★★★★★★★
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// ★★★ Helper: format American odds with + or - sign ★★★★★★★★★★★★★★★★★★★★★★★★★★★
function formatOdds(odds) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

// ★★★ Helper: detect sport from bet ★★★
function getSportFromBet(bet) {
  // First check if sport is explicitly stored
  if (bet.sport) return bet.sport;
  
  // Fallback to detecting from game name
  if (!bet.game) return 'OTHER';
  const g = bet.game.toLowerCase();
  if (g.includes('ufc') || g.includes('mma')) return 'UFC';
  if (g.includes('nba') || g.includes('basketball')) return 'NBA';
  if (g.includes('nfl') || g.includes('football')) return 'NFL';
  if (g.includes('nhl') || g.includes('hockey')) return 'NHL';
  if (g.includes('mlb') || g.includes('baseball')) return 'MLB';
  return 'OTHER';
}

// ★★★ Helper: format date label (Today, Yesterday, or date) ★★★
function formatDateLabel(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const diffTime = today - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  
  return date.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Source options for tracking personal vs pro bets
const SOURCE_OPTIONS = [
  { key: 'ALL', label: 'All Sources' },
  { key: 'personal', label: 'Personal 🎯' },
  { key: 'pro', label: 'Pro Telegram 💎' },
];

// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// MAIN COMPONENT
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
// pendingBet: pre-filled bet data from Games tab (or null)
// onBetConsumed: callback to clear the pending bet after it's used
export default function BetTracker({ pendingBet, onBetConsumed }) {
  // ★★ Auth: check if user is free or pro ★★
  const { tier } = useAuth();
  const isPro = tier === 'pro';

  // ★★ All bets stored in localStorage under key "edgefinder_bets" ★★
  // usePersistentState works like useState but auto-saves to localStorage
  const [bets, setBets] = usePersistentState('edgefinder_bets', []);

  // ★★ Form state: these control the "Add a Bet" form inputs ★★
  const [game, setGame] = useState('');           // e.g. "Lakers vs Celtics"
  const [sport, setSport] = useState('NBA');      // sport selection
  const [source, setSource] = useState('personal'); // 'personal' or 'pro'
  const [betType, setBetType] = useState('Spread'); // dropdown selection
  const [pick, setPick] = useState('');            // e.g. "Lakers -3.5"
  const [odds, setOdds] = useState('');            // American odds, e.g. -110
  const [wager, setWager] = useState('');          // dollar amount
  const [date, setDate] = useState(todayStr());    // defaults to today

  // ★★ UI state ★★
  const [showForm, setShowForm] = useState(false);           // toggle the add-bet form
  const [historySortAsc, setHistorySortAsc] = useState(false); // sort direction for history
  const [showHistory, setShowHistory] = useState(true);       // toggle history section
  const [isPreFilled, setIsPreFilled] = useState(false);     // shows indicator when form was pre-filled
  
  // ★★ NEW: Filter states ★★
  const [selectedSport, setSelectedSport] = useState('ALL');  // filter by sport tab
  const [selectedSource, setSelectedSource] = useState('ALL'); // filter by source (personal/pro)
  const [timeRange, setTimeRange] = useState('all');          // filter by time range
  const [statusFilter, setStatusFilter] = useState('ALL');    // filter by bet status
  const [searchQuery, setSearchQuery] = useState('');         // search bets

  // ★★ Pre-fill from pendingBet (when user clicks odds in Games tab) ★★
  // useEffect runs whenever pendingBet changes. If it's not null, we fill the form.
  useEffect(() => {
    if (pendingBet) {
      setGame(pendingBet.game || '');
      setSport(pendingBet.sport || 'NBA');
      setBetType(pendingBet.type || 'Spread');
      setPick(pendingBet.pick || '');
      setOdds(pendingBet.odds != null ? String(pendingBet.odds) : '');
      // Convert ISO date to YYYY-MM-DD for the date input
      setDate(pendingBet.date ? new Date(pendingBet.date).toISOString().split('T')[0] : todayStr());
      setShowForm(true);    // auto-open the form
      setIsPreFilled(true); // show the "pre-filled" indicator
    }
  }, [pendingBet]);

  // ★★ Filter bets based on selected criteria ★★
  const filteredBets = useMemo(() => {
    return bets.filter(bet => {
      // Source filter (personal vs pro)
      if (selectedSource !== 'ALL') {
        const betSource = bet.source || 'personal'; // default to personal for old bets
        if (betSource !== selectedSource) return false;
      }
      
      // Sport filter
      if (selectedSport !== 'ALL') {
        const betSport = getSportFromBet(bet);
        if (selectedSport === 'OTHER') {
          if (['NBA', 'NFL', 'UFC', 'NHL', 'MLB'].includes(betSport)) return false;
        } else if (betSport !== selectedSport) {
          return false;
        }
      }
      
      // Time range filter
      if (timeRange !== 'all') {
        const days = parseInt(timeRange);
        const betDate = new Date(bet.date);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        if (betDate < cutoffDate) return false;
      }
      
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'pending' && bet.status !== 'pending') return false;
        if (statusFilter === 'settled' && bet.status === 'pending') return false;
        if (statusFilter === 'won' && bet.status !== 'won') return false;
        if (statusFilter === 'lost' && bet.status !== 'lost') return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = `${bet.game} ${bet.pick} ${bet.type}`.toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      
      return true;
    });
  }, [bets, selectedSource, selectedSport, timeRange, statusFilter, searchQuery]);

  // ★★ Derived data: split filtered bets into pending vs settled ★★
  const pendingBets = useMemo(() => filteredBets.filter(b => b.status === 'pending'), [filteredBets]);
  const settledBets = useMemo(() => {
    // Sort settled bets by settledDate (most recent first, or oldest first)
    const settled = filteredBets.filter(b => b.status !== 'pending');
    return settled.sort((a, b) => {
      const da = new Date(a.settledDate || a.date);
      const db = new Date(b.settledDate || b.date);
      return historySortAsc ? da - db : db - da;
    });
  }, [filteredBets, historySortAsc]);

  // ★★ Stats: calculated from settled bets ★★
  const stats = useMemo(() => {
    const wins = settledBets.filter(b => b.status === 'won').length;
    const losses = settledBets.filter(b => b.status === 'lost').length;
    const pushes = settledBets.filter(b => b.status === 'push').length;
    const total = settledBets.length;
    const totalWagered = settledBets.reduce((sum, b) => sum + Number(b.wager), 0);
    const netPL = settledBets.reduce((sum, b) => sum + (b.profit || 0), 0);
    const winPct = total > 0 ? ((wins / (wins + losses)) * 100) : 0; // pushes don't count
    const roi = totalWagered > 0 ? ((netPL / totalWagered) * 100) : 0;

    return { wins, losses, pushes, total, totalWagered, netPL, winPct, roi };
  }, [settledBets]);

  // ★★ Chart data: cumulative P&L over time ★★
  const plChartData = useMemo(() => {
    // Sort all settled bets by date, then compute running total
    const sorted = [...settledBets].sort((a, b) =>
      new Date(a.settledDate || a.date) - new Date(b.settledDate || b.date)
    );
    let cumulative = 0;
    return sorted.map(b => {
      cumulative += (b.profit || 0);
      return {
        date: (b.settledDate || b.date).slice(5), // "MM-DD" format for chart labels
        pnl: Number(cumulative.toFixed(2)),
      };
    });
  }, [settledBets]);

  // ★★ Chart data: pie chart showing bet type breakdown ★★
  const pieData = useMemo(() => {
    const counts = {};
    bets.forEach(b => {
      counts[b.type] = (counts[b.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [bets]);

  // ★★ Gating check: are we at the free limit? ★★
  const atLimit = !isPro && bets.length >= FREE_BET_LIMIT;

  // ★★ Add a new bet ★★
  function handleAddBet(e) {
    e.preventDefault(); // prevent page reload on form submit

    // Don't allow if at free limit
    if (atLimit) return;

    // Validate: all fields must be filled
    if (!game || !pick || !odds || !wager) return;

    // Create the bet object with a unique ID (timestamp)
    const newBet = {
      id: Date.now(),                    // unique identifier
      game,                               // "Lakers vs Celtics"
      sport,                              // "NBA", "NFL", etc.
      source,                             // "personal" or "pro"
      type: betType,                      // "Spread", "Moneyline", etc.
      pick,                               // "Lakers -3.5"
      odds: Number(odds),                 // -110 (American format)
      wager: Number(wager),               // dollar amount
      date,                               // "2026-02-17"
      status: 'pending',                  // starts as unsettled
      profit: null,                       // calculated when settled
      settledDate: null,                  // filled when settled
    };

    // Add to the bets array (new bet goes to the front)
    setBets(prev => [newBet, ...prev]);

    // Reset the form fields so user can enter another bet
    setGame('');
    setSport('NBA');
    setSource('personal');
    setPick('');
    setOdds('');
    setWager('');
    setDate(todayStr());
    setShowForm(false); // collapse the form after adding
    setIsPreFilled(false);
    // Tell the parent we consumed the pending bet so it clears the state
    if (onBetConsumed) onBetConsumed();
  }

  // ★★ Settle a bet (Won, Lost, or Push) ★★
  function settleBet(id, result) {
    setBets(prev => prev.map(bet => {
      if (bet.id !== id) return bet; // skip bets that don't match

      // Calculate profit based on result
      let profit = 0;
      if (result === 'won') {
        // Convert American odds to decimal, then: profit = wager Ã (decimal - 1)
        const decimal = americanToDecimal(bet.odds);
        profit = Number((bet.wager * (decimal - 1)).toFixed(2));
      } else if (result === 'lost') {
        // You lose your entire wager
        profit = -bet.wager;
      }
      // Push = profit stays 0 (you get your money back)

      return {
        ...bet,
        status: result,
        profit,
        settledDate: todayStr(),
      };
    }));
  }

  // ★★ Delete a bet completely ★★
  function deleteBet(id) {
    setBets(prev => prev.filter(b => b.id !== id));
  }

  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  // RENDER
  // ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★
  return (
    <div style={{ padding: '20px 24px', maxWidth: '800px', margin: '0 auto' }}>

      {/* ★★ STATS DASHBOARD ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      {/* Shows key metrics at the top like a sports betting dashboard */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '10px',
        marginBottom: '16px',
      }}>
        {/* Each stat card */}
        {[
          { label: 'Total Bets', value: stats.total, icon: <Target size={14} />, color: '#818cf8' },
          { label: 'Record', value: `${stats.wins}-${stats.losses}-${stats.pushes}`, icon: <Trophy size={14} />, color: '#c4b5fd' },
          { label: 'Win %', value: `${stats.winPct.toFixed(1)}%`, icon: <TrendingUp size={14} />, color: stats.winPct >= 50 ? '#22c55e' : '#f87171' },
          { label: 'Wagered', value: `$${stats.totalWagered.toFixed(0)}`, icon: <DollarSign size={14} />, color: '#94a3b8' },
          { label: 'Net P&L', value: formatMoney(stats.netPL), icon: <BarChart3 size={14} />, color: stats.netPL >= 0 ? '#22c55e' : '#f87171' },
          { label: 'ROI', value: `${stats.roi.toFixed(1)}%`, icon: <TrendingUp size={14} />, color: stats.roi >= 0 ? '#22c55e' : '#f87171' },
        ].map((s, i) => (
          <div key={i} style={{
            ...cardStyle,
            marginBottom: 0,
            padding: '12px',
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', marginBottom: '4px' }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ★★ SPORT TABS ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      <div style={{
        display: 'flex',
        gap: '6px',
        overflowX: 'auto',
        marginBottom: '12px',
        paddingBottom: '4px',
      }}>
        {SPORTS.map(sport => (
          <button
            key={sport.key}
            onClick={() => setSelectedSport(sport.key)}
            style={{
              padding: '8px 14px',
              borderRadius: '20px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: "'JetBrains Mono', monospace",
              background: selectedSport === sport.key 
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4))'
                : 'rgba(30, 41, 59, 0.6)',
              color: selectedSport === sport.key ? '#f8fafc' : '#94a3b8',
              border: `1px solid ${selectedSport === sport.key ? 'rgba(99, 102, 241, 0.5)' : 'rgba(71, 85, 105, 0.3)'}`,
            }}
          >
            {sport.emoji} {sport.label}
          </button>
        ))}
      </div>

      {/* ★★ FILTER BAR ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Time Range Dropdown */}
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
          }}
        >
          {TIME_RANGES.map(range => (
            <option key={range.key} value={range.key}>{range.label}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
          }}
        >
          {STATUS_FILTERS.map(status => (
            <option key={status.key} value={status.key}>{status.label}</option>
          ))}
        </select>

        {/* Source Filter (Personal vs Pro) */}
        <select
          value={selectedSource}
          onChange={(e) => setSelectedSource(e.target.value)}
          style={{
            padding: '8px 12px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '12px',
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
          }}
        >
          {SOURCE_OPTIONS.map(src => (
            <option key={src.key} value={src.key}>{src.label}</option>
          ))}
        </select>

        {/* Search */}
        <div style={{
          flex: 1,
          minWidth: '150px',
          position: 'relative',
        }}>
          <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search bets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              ...inputStyle,
              paddingLeft: '32px',
              fontSize: '12px',
            }}
          />
        </div>
      </div>

      {/* ★★ ADD A BET BUTTON / FORM ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      {/* If free user is at the limit, show the Pro upgrade banner instead */}
      {atLimit && (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
            🏆 Free accounts can track up to {FREE_BET_LIMIT} bets.
            Upgrade to Pro for unlimited tracking!
          </div>
          <ProBanner />
        </div>
      )}

      {/* ★★ ACTIVE (PENDING) BETS ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      {/* These are bets that haven't been settled yet */}
      {pendingBets.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏆¯ Active Bets ({pendingBets.length})
          </div>
          {pendingBets.map(bet => (
            <div key={bet.id} style={{
              ...cardStyle,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              {/* Top row: game name, type badge, and delete button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{bet.game}</div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                    {/* Show all the bet details in a compact line */}
                    <span style={{
                      background: 'rgba(99, 102, 241, 0.2)',
                      border: '1px solid rgba(99, 102, 241, 0.3)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      marginRight: '6px',
                      fontSize: '10px',
                      color: '#818cf8',
                    }}>{bet.type}</span>
                    {bet.pick} ★¢ {formatOdds(bet.odds)} ★¢ ${Number(bet.wager).toFixed(2)}
                  </div>
                </div>
                {/* Delete button (trash icon) */}
                <button
                  onClick={() => deleteBet(bet.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px' }}
                  title="Delete bet"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Bottom row: Settle buttons ★ Won, Lost, Push */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => settleBet(bet.id, 'won')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                    background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.4)',
                    color: '#22c55e', fontSize: '12px', fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}
                >
                  <Trophy size={13} /> Won ★
                </button>
                <button
                  onClick={() => settleBet(bet.id, 'lost')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                    background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#f87171', fontSize: '12px', fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}
                >
                  <XCircle size={13} /> Lost ★
                </button>
                <button
                  onClick={() => settleBet(bet.id, 'push')}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '6px', cursor: 'pointer',
                    background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.4)',
                    color: '#eab308', fontSize: '12px', fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  }}
                >
                  <RotateCcw size={13} /> Push
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ★★ BET HISTORY (SETTLED BETS) ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      {settledBets.length > 0 && (
        <div>
          {/* Section header with toggle and sort controls */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: '10px',
          }}>
            <button
              onClick={() => setShowHistory(!showHistory)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#f8fafc',
                fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: "'JetBrains Mono', monospace", padding: 0,
              }}
            >
              📊 Bet History ({settledBets.length})
              {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {showHistory && (
              <button
                onClick={() => setHistorySortAsc(!historySortAsc)}
                style={{
                  background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)',
                  borderRadius: '6px', padding: '6px 12px', cursor: 'pointer',
                  color: '#94a3b8', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {historySortAsc ? 'Oldest First' : 'Newest First'}
              </button>
            )}
          </div>

          {/* The history table ★ grouped by date */}
          {showHistory && (
            <div>
              {(() => {
                // Group bets by date
                const grouped = {};
                settledBets.forEach(bet => {
                  const dateKey = bet.date;
                  if (!grouped[dateKey]) grouped[dateKey] = [];
                  grouped[dateKey].push(bet);
                });
                
                // Sort dates
                const sortedDates = Object.keys(grouped).sort((a, b) => {
                  return historySortAsc 
                    ? new Date(a) - new Date(b)
                    : new Date(b) - new Date(a);
                });
                
                return sortedDates.map(date => {
                  const label = formatDateLabel(date);
                  const dateBets = grouped[date];
                  
                  return (
                    <div key={date} style={{ marginBottom: '16px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        color: label === 'Today' ? '#22c55e' : label === 'Yesterday' ? '#818cf8' : '#64748b',
                        marginBottom: '8px',
                        paddingLeft: '8px',
                        borderLeft: `3px solid ${label === 'Today' ? '#22c55e' : label === 'Yesterday' ? '#818cf8' : '#475569'}`,
                      }}>
                        {label}
                      </div>
                      
                      {dateBets.map(bet => (
                        <div key={bet.id} style={{
                          ...cardStyle,
                          padding: '12px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderLeft: `3px solid ${
                            bet.status === 'won' ? '#22c55e' : 
                            bet.status === 'lost' ? '#ef4444' : '#eab308'
                          }`,
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px',
                                background: bet.status === 'won' ? 'rgba(34,197,94,0.2)' :
                                           bet.status === 'lost' ? 'rgba(239,68,68,0.2)' :
                                           'rgba(234,179,8,0.2)',
                                color: bet.status === 'won' ? '#22c55e' :
                                       bet.status === 'lost' ? '#f87171' :
                                       '#eab308',
                                textTransform: 'uppercase',
                              }}>
                                {bet.status}
                              </span>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>
                                {bet.game}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                              {bet.type} · {bet.pick} · {formatOdds(bet.odds)} · ${Number(bet.wager).toFixed(0)}
                            </div>
                          </div>
                          
                          <div style={{ textAlign: 'right' }}>
                            <div style={{
                              fontSize: '15px', fontWeight: 700,
                              color: bet.profit > 0 ? '#22c55e' : bet.profit < 0 ? '#f87171' : '#eab308',
                            }}>
                              {formatMoney(bet.profit)}
                            </div>
                            <button
                              onClick={() => deleteBet(bet.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', marginTop: '4px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* ★★ CHARTS ROW ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      {/* Charts moved to bottom so bets are visible first */}
      {settledBets.length >= 2 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: pieData.length > 0 ? '2fr 1fr' : '1fr',
          gap: '12px',
          marginBottom: '16px',
        }}>
          {/* Cumulative P&L line chart */}
          <div style={cardStyle}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
              Cumulative P&L
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={plChartData}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={45} />
                <Tooltip
                  contentStyle={{
                    background: '#1e293b', border: '1px solid #334155',
                    borderRadius: '8px', fontSize: '11px', color: '#e2e8f0',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  formatter={(val) => [`$${val}`, 'P&L']}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke={stats.netPL >= 0 ? '#22c55e' : '#f87171'}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Bet type breakdown pie chart */}
          {pieData.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                Bet Types
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#1e293b', border: '1px solid #334155',
                      borderRadius: '8px', fontSize: '11px', color: '#e2e8f0',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', justifyContent: 'center' }}>
                {pieData.map((d, i) => (
                  <span key={i} style={{ fontSize: '9px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length], display: 'inline-block' }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ★★ ADD A BET BUTTON (MOVED TO BOTTOM) ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      <div style={cardStyle}>
        {/* Toggle button to show/hide the form */}
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            width: '100%',
            padding: '10px',
            background: showForm ? 'rgba(99, 102, 241, 0.15)' : 'linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3))',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            borderRadius: '8px',
            color: '#c4b5fd',
            fontSize: '13px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <PlusCircle size={16} />
          {showForm ? 'Cancel' : 'Add a Bet'}
        </button>

        {/* The actual form ★ only visible when showForm is true */}
        {showForm && (
          <form onSubmit={handleAddBet} style={{
            marginTop: '12px',
            // Subtle indigo glow when the form was pre-filled from the Games tab
            ...(isPreFilled ? {
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '10px',
              padding: '12px',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.15)',
            } : {}),
          }}>
            {/* Pre-filled indicator ★ lets user know the data came from a game */}
            {isPreFilled && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '10px', padding: '8px 12px',
                background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px',
                fontSize: '11px', color: '#a78bfa', fontWeight: 600,
              }}>
                <span>🏆 Pre-filled from Games ★ just add your wager!</span>
                <button
                  type="button"
                  onClick={() => { setIsPreFilled(false); if (onBetConsumed) onBetConsumed(); }}
                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
                >×</button>
              </div>
            )}
            {/* Two-column grid for the form fields (stacks on mobile) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '10px',
            }}>
              {/* Game/Event input */}
              <div>
                <label style={labelStyle}>Game / Event</label>
                <input
                  type="text"
                  placeholder="Lakers vs Celtics"
                  value={game}
                  onChange={e => setGame(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Sport dropdown */}
              <div>
                <label style={labelStyle}>Sport</label>
                <select
                  value={sport}
                  onChange={e => setSport(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {SPORTS.filter(s => s.key !== 'ALL').map(s => (
                    <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                  ))}
                </select>
              </div>

              {/* Source dropdown */}
              <div>
                <label style={labelStyle}>Source</label>
                <select
                  value={source}
                  onChange={e => setSource(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  <option value="personal">🎯 Personal</option>
                  <option value="pro">💎 Pro Telegram</option>
                </select>
              </div>

              {/* Bet Type dropdown */}
              <div>
                <label style={labelStyle}>Bet Type</label>
                <select
                  value={betType}
                  onChange={e => setBetType(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {BET_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Pick/Selection input */}
              <div>
                <label style={labelStyle}>Pick / Selection</label>
                <input
                  type="text"
                  placeholder="Lakers -3.5"
                  value={pick}
                  onChange={e => setPick(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Odds input (American format) */}
              <div>
                <label style={labelStyle}>Odds (American)</label>
                <input
                  type="number"
                  placeholder="-110"
                  value={odds}
                  onChange={e => setOdds(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Wager amount */}
              <div>
                <label style={labelStyle}>Wager ($)</label>
                <input
                  type="number"
                  placeholder="100"
                  min="0"
                  step="0.01"
                  value={wager}
                  onChange={e => setWager(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Date picker (defaults to today) */}
              <div>
                <label style={labelStyle}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '12px',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              🏆 Place Bet
            </button>
          </form>
        )}
      </div>

      {/* ★★ EMPTY STATE ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★ */}
      {/* Show a friendly message when there are no bets at all */}
      {bets.length === 0 && !showForm && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: '#475569',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏆</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
            No bets tracked yet
          </div>
          <div style={{ fontSize: '12px', color: '#475569' }}>
            Tap "Add a Bet" below to start tracking your action!
          </div>
        </div>
      )}
    </div>
  );
}
