// BetTracker.jsx â Track your bets, see stats, and monitor your P&L
// This is the main Bet Tracker tab for Edge Finder
// It saves all bets to localStorage so they persist between sessions

import React, { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle, Trophy, XCircle, RotateCcw, TrendingUp,
  DollarSign, Target, BarChart3, Trash2, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { americanToDecimal } from '../utils/odds-math.js';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { usePersistentState } from '../hooks/useOdds.js';

// âââ Constants âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// These are the bet types a user can choose from in the dropdown
const BET_TYPES = ['Spread', 'Moneyline', 'Total', 'Prop', 'Future', 'Other'];

// Colors for the pie chart slices (one per bet type)
const PIE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#22c55e', '#f59e0b', '#64748b'];

// How many bets free users can track before hitting the paywall
const FREE_BET_LIMIT = 5;

// âââ Shared Styles âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
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

// âââ Helper: format a dollar amount with + or - sign âââââââââââââââââââââââââ
function formatMoney(val) {
  if (val === null || val === undefined) return 'â';
  const sign = val >= 0 ? '+' : '';
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

// âââ Helper: get today's date as YYYY-MM-DD string âââââââââââââââââââââââââââ
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// âââ Helper: format American odds with + or - sign âââââââââââââââââââââââââââ
function formatOdds(odds) {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// MAIN COMPONENT
// âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// pendingBet: pre-filled bet data from Games tab (or null)
// onBetConsumed: callback to clear the pending bet after it's used
export default function BetTracker({ pendingBet, onBetConsumed }) {
  // ââ Auth: check if user is free or pro ââ
  const { tier } = useAuth();
  const isPro = tier === 'pro';

  // ââ All bets stored in localStorage under key "edgefinder_bets" ââ
  // usePersistentState works like useState but auto-saves to localStorage
  const [bets, setBets] = usePersistentState('edgefinder_bets', []);

  // ââ Form state: these control the "Add a Bet" form inputs ââ
  const [game, setGame] = useState('');           // e.g. "Lakers vs Celtics"
  const [betType, setBetType] = useState('Spread'); // dropdown selection
  const [pick, setPick] = useState('');            // e.g. "Lakers -3.5"
  const [odds, setOdds] = useState('');            // American odds, e.g. -110
  const [wager, setWager] = useState('');          // dollar amount
  const [date, setDate] = useState(todayStr());    // defaults to today

  // ââ UI state ââ
  const [showForm, setShowForm] = useState(false);           // toggle the add-bet form
  const [historySortAsc, setHistorySortAsc] = useState(false); // sort direction for history
  const [showHistory, setShowHistory] = useState(true);       // toggle history section
  const [isPreFilled, setIsPreFilled] = useState(false);     // shows indicator when form was pre-filled

  // ââ Pre-fill from pendingBet (when user clicks odds in Games tab) ââ
  // useEffect runs whenever pendingBet changes. If it's not null, we fill the form.
  useEffect(() => {
    if (pendingBet) {
      setGame(pendingBet.game || '');
      setBetType(pendingBet.type || 'Spread');
      setPick(pendingBet.pick || '');
      setOdds(pendingBet.odds != null ? String(pendingBet.odds) : '');
      // Convert ISO date to YYYY-MM-DD for the date input
      setDate(pendingBet.date ? new Date(pendingBet.date).toISOString().split('T')[0] : todayStr());
      setShowForm(true);    // auto-open the form
      setIsPreFilled(true); // show the "pre-filled" indicator
    }
  }, [pendingBet]);

  // ââ Derived data: split bets into pending vs settled ââ
  // useMemo = only recalculate when `bets` changes (performance optimization)
  const pendingBets = useMemo(() => bets.filter(b => b.status === 'pending'), [bets]);
  const settledBets = useMemo(() => {
    // Sort settled bets by settledDate (most recent first, or oldest first)
    const settled = bets.filter(b => b.status !== 'pending');
    return settled.sort((a, b) => {
      const da = new Date(a.settledDate || a.date);
      const db = new Date(b.settledDate || b.date);
      return historySortAsc ? da - db : db - da;
    });
  }, [bets, historySortAsc]);

  // ââ Stats: calculated from settled bets ââ
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

  // ââ Chart data: cumulative P&L over time ââ
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

  // ââ Chart data: pie chart showing bet type breakdown ââ
  const pieData = useMemo(() => {
    const counts = {};
    bets.forEach(b => {
      counts[b.type] = (counts[b.type] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [bets]);

  // ââ Gating check: are we at the free limit? ââ
  const atLimit = !isPro && bets.length >= FREE_BET_LIMIT;

  // ââ Add a new bet ââ
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
    setPick('');
    setOdds('');
    setWager('');
    setDate(todayStr());
    setShowForm(false); // collapse the form after adding
    setIsPreFilled(false);
    // Tell the parent we consumed the pending bet so it clears the state
    if (onBetConsumed) onBetConsumed();
  }

  // ââ Settle a bet (Won, Lost, or Push) ââ
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

  // ââ Delete a bet completely ââ
  function deleteBet(id) {
    setBets(prev => prev.filter(b => b.id !== id));
  }

  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // RENDER
  // âââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  return (
    <div style={{ padding: '20px 24px', maxWidth: '800px', margin: '0 auto' }}>

      {/* ââ STATS DASHBOARD âââââââââââââââââââââââââââââââââââââââââââââââââââ */}
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

      {/* ââ CHARTS ROW ââââââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
      {/* Only show charts if we have enough data to make them useful */}
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
              ð Cumulative P&L
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
                {/* The line itself â green if profitable, red if not */}
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
                ð¯ Bet Types
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
                    {/* Each slice gets a different color from our PIE_COLORS array */}
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
              {/* Legend: shows which color = which bet type */}
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

      {/* ââ ADD A BET BUTTON / FORM âââââââââââââââââââââââââââââââââââââââââââ */}
      {/* If free user is at the limit, show the Pro upgrade banner instead */}
      {atLimit ? (
        <div style={{ ...cardStyle, textAlign: 'center' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px' }}>
            ð Free accounts can track up to {FREE_BET_LIMIT} bets.
            Upgrade to Pro for unlimited tracking!
          </div>
          <ProBanner />
        </div>
      ) : (
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

          {/* The actual form â only visible when showForm is true */}
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
              {/* Pre-filled indicator â lets user know the data came from a game */}
              {isPreFilled && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: '10px', padding: '8px 12px',
                  background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px',
                  fontSize: '11px', color: '#a78bfa', fontWeight: 600,
                }}>
                  <span>ð Pre-filled from Games â just add your wager!</span>
                  <button
                    type="button"
                    onClick={() => { setIsPreFilled(false); if (onBetConsumed) onBetConsumed(); }}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}
                  >Ã</button>
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
                ð² Place Bet
              </button>
            </form>
          )}
        </div>
      )}

      {/* ââ ACTIVE (PENDING) BETS âââââââââââââââââââââââââââââââââââââââââââââ */}
      {/* These are bets that haven't been settled yet */}
      {pendingBets.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ð¯ Active Bets ({pendingBets.length})
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
                    {bet.pick} â¢ {formatOdds(bet.odds)} â¢ ${Number(bet.wager).toFixed(2)}
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

              {/* Bottom row: Settle buttons â Won, Lost, Push */}
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
                  <Trophy size={13} /> Won â
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
                  <XCircle size={13} /> Lost â
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
                  <RotateCcw size={13} /> Push â©ï¸
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ââ BET HISTORY (SETTLED BETS) ââââââââââââââââââââââââââââââââââââââââ */}
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
              ð Bet History ({settledBets.length})
              {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showHistory && (
              <button
                onClick={() => setHistorySortAsc(!historySortAsc)}
                style={{
                  background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)',
                  borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                  color: '#94a3b8', fontSize: '10px', fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {historySortAsc ? 'Oldest First â' : 'Newest First â'}
              </button>
            )}
          </div>

          {/* The history table â each settled bet shown as a row */}
          {showHistory && (
            <div style={{ overflowX: 'auto' }}>
              {/* Running P&L tracker â we calculate as we render each row */}
              {(() => {
                // Sort by date ascending to compute running P&L correctly
                const chronological = [...settledBets].sort((a, b) =>
                  new Date(a.settledDate || a.date) - new Date(b.settledDate || b.date)
                );
                // Build a map of id â running P&L
                const runningMap = {};
                let running = 0;
                chronological.forEach(b => {
                  running += (b.profit || 0);
                  runningMap[b.id] = running;
                });

                // Now render in the user's chosen sort order
                return settledBets.map(bet => (
                  <div key={bet.id} style={{
                    ...cardStyle,
                    padding: '10px 14px',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '8px',
                    alignItems: 'center',
                  }}>
                    {/* Left side: bet details */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {/* Result badge: green/red/yellow */}
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                          background: bet.status === 'won' ? 'rgba(34,197,94,0.2)' :
                                     bet.status === 'lost' ? 'rgba(239,68,68,0.2)' :
                                     'rgba(234,179,8,0.2)',
                          color: bet.status === 'won' ? '#22c55e' :
                                 bet.status === 'lost' ? '#f87171' :
                                 '#eab308',
                          border: `1px solid ${
                            bet.status === 'won' ? 'rgba(34,197,94,0.4)' :
                            bet.status === 'lost' ? 'rgba(239,68,68,0.4)' :
                            'rgba(234,179,8,0.4)'
                          }`,
                          textTransform: 'uppercase',
                        }}>
                          {bet.status}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{bet.game}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {bet.date} â¢ {bet.type} â¢ {bet.pick} â¢ {formatOdds(bet.odds)} â¢ ${Number(bet.wager).toFixed(2)}
                      </div>
                    </div>
                    {/* Right side: profit and running P&L */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        fontSize: '14px', fontWeight: 700,
                        color: bet.profit > 0 ? '#22c55e' : bet.profit < 0 ? '#f87171' : '#eab308',
                      }}>
                        {formatMoney(bet.profit)}
                      </div>
                      <div style={{
                        fontSize: '10px',
                        color: runningMap[bet.id] >= 0 ? '#22c55e80' : '#f8717180',
                      }}>
                        P&L: {formatMoney(runningMap[bet.id])}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* ââ EMPTY STATE âââââââââââââââââââââââââââââââââââââââââââââââââââââââ */}
      {/* Show a friendly message when there are no bets at all */}
      {bets.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px', color: '#475569',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>ð</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>
            No bets tracked yet
          </div>
          <div style={{ fontSize: '12px', color: '#475569' }}>
            Tap "Add a Bet" above to start tracking your action!
          </div>
        </div>
      )}
    </div>
  );
}
