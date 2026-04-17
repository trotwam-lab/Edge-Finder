// BetTracker.jsx — Redesigned with Option 3: Tab + Dropdown Hybrid
// Sport tabs at top, filter dropdowns, date-grouped bet list

import React, { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle, Trophy, XCircle, RotateCcw, TrendingUp,
  DollarSign, Target, BarChart3, Trash2, ChevronDown, ChevronUp,
  Search, Calendar, Filter, Clock, Edit3, Check
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { americanToDecimal, americanToImplied } from '../utils/odds-math.js';
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

// CLV (Closing Line Value) — compares the price you got to the closing price.
// Positive CLV means you beat the close (good timing); negative means the market
// moved against you. Measured in implied-probability points for accuracy.
function calculateCLV(placedOdds, closingOdds) {
  if (placedOdds == null || closingOdds == null) return null;
  const pPlaced = americanToImplied(Number(placedOdds));
  const pClose = americanToImplied(Number(closingOdds));
  if (!pPlaced || !pClose) return null;
  // A lower implied prob at the time of bet = better price than close.
  // CLV = (close - placed) * 100 in percentage points.
  return Number(((pClose - pPlaced) * 100).toFixed(2));
}

// Opening-line edge — how much better/worse the price you got was vs
// the opening number. Positive = you got the opener value, negative = late.
function calculateOpenerEdge(placedOdds, openingOdds) {
  if (placedOdds == null || openingOdds == null) return null;
  const pPlaced = americanToImplied(Number(placedOdds));
  const pOpen = americanToImplied(Number(openingOdds));
  if (!pPlaced || !pOpen) return null;
  return Number(((pOpen - pPlaced) * 100).toFixed(2));
}

// Classify a bet's timing into a grade so users can see at a glance how
// sharp their bet-placement was vs the market's eventual resolution.
function gradeTiming(clv) {
  if (clv == null) return { label: '—', color: '#64748b', bg: 'rgba(100,116,139,0.15)' };
  if (clv >= 3)  return { label: 'Sharp',     color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
  if (clv >= 1)  return { label: 'Good',      color: '#84cc16', bg: 'rgba(132,204,22,0.15)' };
  if (clv > -1)  return { label: 'Neutral',   color: '#eab308', bg: 'rgba(234,179,8,0.15)' };
  if (clv > -3)  return { label: 'Late',      color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  return           { label: 'Chased',    color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
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

// Find the current live price for a bet's market/outcome in the games feed.
// Returns null if anything is missing — callers use the result only if truthy.
function findLivePrice(games, bet) {
  if (!bet?.gameId || !bet?.marketKey || !bet?.outcomeName) return null;
  const game = games?.find(g => g.id === bet.gameId);
  if (!game) return null;
  const book = game.bookmakers?.[0];
  const market = book?.markets?.find(m => m.key === bet.marketKey);
  if (!market) return null;
  const outcome = market.outcomes?.find(o => {
    if (o.name !== bet.outcomeName) return false;
    if (bet.outcomePoint != null && o.point != null) return o.point === bet.outcomePoint;
    return true;
  });
  return outcome?.price ?? null;
}

export default function BetTracker({ pendingBet, onBetConsumed, games = [], historicOdds = {} }) {
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
  const [openingOdds, setOpeningOdds] = useState('');
  const [closingOdds, setClosingOdds] = useState('');
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
      setOpeningOdds(pendingBet.openingOdds != null ? String(pendingBet.openingOdds) : '');
      setShowForm(true);
      setIsPreFilled(true);
    }
  }, [pendingBet]);

  // Auto-capture CLV: for every pending bet whose market we can identify,
  // track the latest live price and, once the game starts, snapshot it as
  // the closing line. Also backfill opening odds from historicOdds when seen.
  useEffect(() => {
    if (!games?.length) return;
    const now = Date.now();
    let dirty = false;
    const next = bets.map(bet => {
      if (!bet.gameId || !bet.marketKey) return bet;
      let updated = bet;

      // Backfill opening odds from historicOdds once we have a capture.
      if (updated.openingOdds == null && updated.marketKey === 'h2h' && updated.outcomeName) {
        const opener = historicOdds?.[updated.gameId]?.h2h?.find(o => o.name === updated.outcomeName);
        if (opener?.price != null) {
          updated = { ...updated, openingOdds: opener.price };
          dirty = true;
        }
      }

      // Only close-out bets that are still pending.
      if (updated.closingOdds != null || updated.status !== 'pending') return updated;
      const livePrice = findLivePrice(games, updated);
      const commence = updated.commenceTime ? new Date(updated.commenceTime).getTime() : null;
      const gameStillListed = games.some(g => g.id === updated.gameId);

      if (livePrice != null && commence && now < commence) {
        // Pre-game: roll the "last seen" price forward.
        if (updated.lastPreGameOdds !== livePrice) {
          updated = { ...updated, lastPreGameOdds: livePrice, lastPreGameAt: now };
          dirty = true;
        }
      } else if (commence && now >= commence) {
        // Post-kickoff: lock in the closing line from the last pre-game snapshot,
        // or from whatever the book still shows if we never snapshotted.
        const closing = updated.lastPreGameOdds ?? livePrice;
        if (closing != null) {
          updated = { ...updated, closingOdds: closing, closingCapturedAt: now };
          dirty = true;
        }
      } else if (!gameStillListed && updated.lastPreGameOdds != null) {
        // Game dropped off the board before we saw commence_time pass — use
        // the last snapshot we have as closing.
        updated = { ...updated, closingOdds: updated.lastPreGameOdds, closingCapturedAt: now };
        dirty = true;
      }

      return updated;
    });
    if (dirty) setBets(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [games, historicOdds]);
  
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
    const wins    = settled.filter(b => b.status === 'won').length;
    const losses  = settled.filter(b => b.status === 'lost').length;
    const pushes  = settled.filter(b => b.status === 'push').length;
    const total   = settled.length;

    const totalWagered = settled.reduce((s, b) => s + (Number(b.wager) || 0), 0);
    const netPL = settled.reduce((s, b) => s + (Number(b.profit) || 0), 0);

    // Win% excludes pushes from denominator
    const decidedBets = wins + losses;
    const winPct = decidedBets > 0 ? (wins / decidedBets) * 100 : 0;

    // ROI = Net Profit ÷ Total Amount Wagered × 100
    const roi = totalWagered > 0 ? (netPL / totalWagered) * 100 : 0;

    // Units: 1 unit = average wager size across all settled bets
    const avgWager = total > 0 ? totalWagered / total : 100;
    const units = avgWager > 0 ? netPL / avgWager : 0;

    // Per-sport breakdown for ROI panel
    const sportBreakdown = {};
    settled.forEach(b => {
      const sport = (b.sport || getSportFromGame(b.game || '')) || 'Other';
      if (!sportBreakdown[sport]) sportBreakdown[sport] = { wagered: 0, profit: 0, bets: 0 };
      sportBreakdown[sport].wagered += Number(b.wager) || 0;
      sportBreakdown[sport].profit  += Number(b.profit) || 0;
      sportBreakdown[sport].bets    += 1;
    });

    // ===== EV Timing Analytics (CLV) =====
    // For every bet with a closingOdds value recorded, compute CLV%.
    // We surface: average CLV, % of bets that beat the close, and
    // an opening-line edge (how many bets got the opening number).
    const timedBets = filteredBets.filter(b => b.closingOdds != null);
    const clvValues = timedBets
      .map(b => calculateCLV(b.odds, b.closingOdds))
      .filter(v => v != null);
    const avgCLV = clvValues.length
      ? Number((clvValues.reduce((a, b) => a + b, 0) / clvValues.length).toFixed(2))
      : null;
    const beatClose = clvValues.filter(v => v > 0).length;
    const beatCloseRate = clvValues.length ? (beatClose / clvValues.length) * 100 : 0;

    const openerBets = filteredBets.filter(b => b.openingOdds != null);
    const openerValues = openerBets
      .map(b => calculateOpenerEdge(b.odds, b.openingOdds))
      .filter(v => v != null);
    const avgOpenerEdge = openerValues.length
      ? Number((openerValues.reduce((a, b) => a + b, 0) / openerValues.length).toFixed(2))
      : null;

    // CLV units: implied profit over the close across all timed bets.
    // Using a flat 1u stake per bet to keep the metric wager-agnostic.
    const clvUnits = clvValues.length
      ? Number(clvValues.reduce((a, b) => a + b, 0).toFixed(2))
      : 0;

    return {
      wins, losses, pushes, total, totalWagered, netPL, winPct, roi, units, avgWager, sportBreakdown,
      timing: {
        recordedBets: timedBets.length,
        totalBets: filteredBets.length,
        avgCLV,
        beatClose,
        beatCloseRate,
        avgOpenerEdge,
        openerRecorded: openerBets.length,
        clvUnits,
      },
    };
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
      openingOdds: openingOdds === '' ? null : Number(openingOdds),
      closingOdds: closingOdds === '' ? null : Number(closingOdds),
      // Identifiers let the auto-capture effect match this bet back to the
      // live odds feed and backfill its closing price after the game starts.
      gameId: pendingBet?.gameId ?? null,
      sportKey: pendingBet?.sportKey ?? null,
      marketKey: pendingBet?.marketKey ?? null,
      outcomeName: pendingBet?.outcomeName ?? null,
      outcomePoint: pendingBet?.outcomePoint ?? null,
      commenceTime: pendingBet?.commenceTime ?? null,
    };

    setBets(prev => [newBet, ...prev]);
    setGame('');
    setPick('');
    setOdds('');
    setWager('');
    setDate(todayStr());
    setOpeningOdds('');
    setClosingOdds('');
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

  function setTimingOdds(id, { openingOdds, closingOdds }) {
    setBets(prev => prev.map(bet => {
      if (bet.id !== id) return bet;
      const next = { ...bet };
      if (openingOdds !== undefined) next.openingOdds = openingOdds === null || openingOdds === '' ? null : Number(openingOdds);
      if (closingOdds !== undefined) next.closingOdds = closingOdds === null || closingOdds === '' ? null : Number(closingOdds);
      return next;
    }));
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
          { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`, icon: <BarChart3 size={14} />, color: stats.roi >= 0 ? '#22c55e' : '#f87171' },
          { label: 'Units', value: `${stats.units >= 0 ? '+' : ''}${stats.units.toFixed(2)}u`, icon: <DollarSign size={14} />, color: stats.units >= 0 ? '#22c55e' : '#f87171' },
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
      
      {/* ROI BREAKDOWN PANEL */}
      {stats.total > 0 && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(71, 85, 105, 0.2)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>
              ROI &amp; UNITS BREAKDOWN
            </div>
            <div style={{ fontSize: '10px', color: '#475569' }}>
              1u = ${stats.avgWager.toFixed(0)} avg wager
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              {
                label: 'Net P/L',
                value: `${stats.netPL >= 0 ? '+' : ''}${formatMoney(stats.netPL)}`,
                sub: `on ${formatMoney(stats.totalWagered)} wagered`,
                color: stats.netPL >= 0 ? '#22c55e' : '#ef4444',
              },
              {
                label: 'ROI',
                value: `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(2)}%`,
                sub: 'Net Profit / Total Wagered',
                color: stats.roi >= 0 ? '#22c55e' : '#ef4444',
              },
              {
                label: 'Units Won',
                value: `${stats.units >= 0 ? '+' : ''}${stats.units.toFixed(2)}u`,
                sub: `${stats.total} settled bets`,
                color: stats.units >= 0 ? '#22c55e' : '#ef4444',
              },
            ].map((item, i) => (
              <div key={i} style={{
                background: 'rgba(30, 41, 59, 0.5)',
                borderRadius: '8px',
                padding: '10px 12px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
                <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Per-sport breakdown */}
          {Object.keys(stats.sportBreakdown).length > 0 && (
            <div>
              <div style={{ fontSize: '10px', color: '#475569', fontWeight: 600, marginBottom: '8px' }}>BY SPORT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {Object.entries(stats.sportBreakdown)
                  .sort((a, b) => b[1].profit - a[1].profit)
                  .map(([sport, data]) => {
                    const sportRoi = data.wagered > 0 ? (data.profit / data.wagered) * 100 : 0;
                    const sportUnits = stats.avgWager > 0 ? data.profit / stats.avgWager : 0;
                    return (
                      <div key={sport} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 8px',
                        background: 'rgba(15, 23, 42, 0.4)',
                        borderRadius: '6px',
                      }}>
                        <div style={{ flex: 1, fontSize: '11px', color: '#e2e8f0', fontWeight: 600 }}>{sport}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{data.bets}b</div>
                        <div style={{
                          fontSize: '11px', fontWeight: 700,
                          color: sportRoi >= 0 ? '#22c55e' : '#ef4444',
                          minWidth: '52px', textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {sportRoi >= 0 ? '+' : ''}{sportRoi.toFixed(1)}%
                        </div>
                        <div style={{
                          fontSize: '10px',
                          color: sportUnits >= 0 ? '#22c55e' : '#ef4444',
                          minWidth: '44px', textAlign: 'right',
                          fontFamily: "'JetBrains Mono', monospace",
                        }}>
                          {sportUnits >= 0 ? '+' : ''}{sportUnits.toFixed(2)}u
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EV TIMING ANALYTICS PANEL — Edge Finder V2.4 */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.08))',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} color="#818cf8" />
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#c4b5fd', letterSpacing: '0.5px' }}>
              EV TIMING ANALYTICS
            </div>
            <span style={{
              fontSize: '9px', padding: '2px 6px',
              background: 'rgba(99, 102, 241, 0.2)',
              borderRadius: '4px', color: '#a5b4fc', fontWeight: 700,
            }}>V2.4</span>
          </div>
          <div style={{ fontSize: '10px', color: '#475569' }}>
            {stats.timing.recordedBets}/{stats.timing.totalBets} bets tracked
          </div>
        </div>

        {stats.timing.recordedBets === 0 ? (
          <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
            Bets added from the Games tab capture closing odds automatically once the game kicks off. You can also enter opening/closing odds manually.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              {[
                {
                  label: 'Avg CLV',
                  value: stats.timing.avgCLV != null ? `${stats.timing.avgCLV >= 0 ? '+' : ''}${stats.timing.avgCLV.toFixed(2)}%` : '—',
                  sub: 'vs closing line',
                  color: stats.timing.avgCLV == null ? '#64748b' : stats.timing.avgCLV >= 0 ? '#22c55e' : '#ef4444',
                },
                {
                  label: 'Beat Close',
                  value: `${stats.timing.beatCloseRate.toFixed(0)}%`,
                  sub: `${stats.timing.beatClose} of ${stats.timing.recordedBets} bets`,
                  color: stats.timing.beatCloseRate >= 55 ? '#22c55e' : stats.timing.beatCloseRate >= 45 ? '#eab308' : '#ef4444',
                },
                {
                  label: 'CLV Units',
                  value: `${stats.timing.clvUnits >= 0 ? '+' : ''}${stats.timing.clvUnits.toFixed(2)}`,
                  sub: 'total edge earned',
                  color: stats.timing.clvUnits >= 0 ? '#22c55e' : '#ef4444',
                },
                {
                  label: 'Vs Opener',
                  value: stats.timing.avgOpenerEdge != null ? `${stats.timing.avgOpenerEdge >= 0 ? '+' : ''}${stats.timing.avgOpenerEdge.toFixed(2)}%` : '—',
                  sub: stats.timing.openerRecorded > 0 ? `${stats.timing.openerRecorded} opener(s)` : 'none tracked',
                  color: stats.timing.avgOpenerEdge == null ? '#64748b' : stats.timing.avgOpenerEdge >= 0 ? '#22c55e' : '#f97316',
                },
              ].map((m, i) => (
                <div key={i} style={{
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: '8px', padding: '10px 12px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>{m.label}</div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: m.color, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
                  <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{m.sub}</div>
                </div>
              ))}
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px',
              fontSize: '9px', color: '#64748b',
              paddingTop: '8px', borderTop: '1px solid rgba(71, 85, 105, 0.2)',
            }}>
              <span>Timing grade:</span>
              {[
                { label: 'Sharp', color: '#22c55e', range: '≥ +3%' },
                { label: 'Good', color: '#84cc16', range: '+1 to +3%' },
                { label: 'Neutral', color: '#eab308', range: '±1%' },
                { label: 'Late', color: '#f97316', range: '-1 to -3%' },
                { label: 'Chased', color: '#ef4444', range: '< -3%' },
              ].map(g => (
                <span key={g.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: g.color }} />
                  <span style={{ color: g.color, fontWeight: 600 }}>{g.label}</span>
                  <span>{g.range}</span>
                </span>
              ))}
            </div>
          </>
        )}
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
            {/* Optional timing fields power the EV Timing Analytics panel.
                Users can leave them blank at entry and fill in the close later. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} /> Opening Odds <span style={{ color: '#475569' }}>(optional)</span>
                </label>
                <input type="number" value={openingOdds} onChange={(e) => setOpeningOdds(e.target.value)} placeholder="-105" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} /> Closing Odds <span style={{ color: '#475569' }}>(optional)</span>
                </label>
                <input type="number" value={closingOdds} onChange={(e) => setClosingOdds(e.target.value)} placeholder="-115" style={inputStyle} />
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
            <BetCard key={bet.id} bet={bet} onSettle={settleBet} onDelete={deleteBet} onSetTimingOdds={setTimingOdds} isPending />
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
              <BetCard key={bet.id} bet={bet} onSettle={settleBet} onDelete={deleteBet} onSetTimingOdds={setTimingOdds} />
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
function BetCard({ bet, onSettle, onDelete, onSetTimingOdds, isPending }) {
  const statusColors = {
    pending: '#f59e0b', won: '#22c55e', lost: '#ef4444', push: '#64748b',
  };

  const [editingTiming, setEditingTiming] = useState(false);
  const [openDraft, setOpenDraft] = useState(bet.openingOdds ?? '');
  const [closeDraft, setCloseDraft] = useState(bet.closingOdds ?? '');

  const clv = calculateCLV(bet.odds, bet.closingOdds);
  const grade = gradeTiming(clv);
  const hasTiming = bet.openingOdds != null || bet.closingOdds != null;

  function saveTiming() {
    onSetTimingOdds?.(bet.id, {
      openingOdds: openDraft === '' ? null : openDraft,
      closingOdds: closeDraft === '' ? null : closeDraft,
    });
    setEditingTiming(false);
  }

  return (
    <div style={{ ...cardStyle, padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{bet.game}</span>
            <span style={{
              fontSize: '10px', padding: '2px 6px',
              background: 'rgba(99, 102, 241, 0.15)', borderRadius: '4px', color: '#818cf8',
            }}>{bet.type}</span>
            {clv != null && (
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                background: grade.bg, color: grade.color, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: '3px',
              }}>
                <Clock size={9} />
                {grade.label} {clv >= 0 ? '+' : ''}{clv.toFixed(2)}%
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {bet.pick} @ {formatOdds(bet.odds)} • ${bet.wager}
          </div>
          {hasTiming && !editingTiming && (
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '8px' }}>
              {bet.openingOdds != null && <span>Open: {formatOdds(bet.openingOdds)}</span>}
              {bet.closingOdds != null && <span>Close: {formatOdds(bet.closingOdds)}</span>}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
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

        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {onSetTimingOdds && (
            <button
              onClick={() => setEditingTiming(v => !v)}
              title="Edit opening/closing odds for CLV tracking"
              style={{
                padding: '6px', background: editingTiming ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: 'none', borderRadius: '4px',
                color: editingTiming ? '#818cf8' : '#64748b', cursor: 'pointer',
              }}>
              <Edit3 size={14} />
            </button>
          )}
          <button onClick={() => onDelete(bet.id)} style={{
            padding: '6px', background: 'transparent', border: 'none',
            color: '#64748b', cursor: 'pointer',
          }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {editingTiming && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          marginTop: '10px', paddingTop: '10px',
          borderTop: '1px solid rgba(71, 85, 105, 0.2)',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Open</label>
            <input
              type="number" value={openDraft} onChange={(e) => setOpenDraft(e.target.value)}
              placeholder="-105"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Close</label>
            <input
              type="number" value={closeDraft} onChange={(e) => setCloseDraft(e.target.value)}
              placeholder="-115"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <button onClick={saveTiming} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '6px 10px',
            background: 'rgba(34, 197, 94, 0.2)',
            border: '1px solid rgba(34, 197, 94, 0.5)', borderRadius: '6px',
            color: '#22c55e', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
          }}>
            <Check size={12} /> Save
          </button>
          <button onClick={() => { setEditingTiming(false); setOpenDraft(bet.openingOdds ?? ''); setCloseDraft(bet.closingOdds ?? ''); }} style={{
            padding: '6px 10px', background: 'transparent',
            border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '6px',
            color: '#94a3b8', fontSize: '11px', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
