// BetTracker.jsx — Redesigned with Option 3: Tab + Dropdown Hybrid
// Sport tabs at top, filter dropdowns, date-grouped bet list

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  PlusCircle, Trophy, XCircle, RotateCcw, TrendingUp,
  DollarSign, Target, BarChart3, Trash2, ChevronDown, ChevronUp,
  Search, Calendar, Filter, Clock, Edit3, Check, Download, Upload, Archive
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { americanToDecimal, americanToImplied } from '../utils/odds-math.js';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { scanLocalStorageForBets, loadCloudSnapshots } from '../hooks/useCloudBets.js';
import WeeklyRecap from './WeeklyRecap.jsx';

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
  if (odds === null || odds === undefined || Number.isNaN(Number(odds))) return '—';
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatPoint(point) {
  if (point === null || point === undefined || Number.isNaN(Number(point))) return '—';
  const n = Number(point);
  return n > 0 ? `+${n}` : `${n}`;
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

function getBetPoint(bet) {
  return bet?.betPoint ?? bet?.outcomePoint ?? bet?.openingPoint ?? null;
}

function getPointCLV(bet, closingPoint = bet?.closingPoint) {
  const betPoint = getBetPoint(bet);
  if (betPoint == null || closingPoint == null) return null;
  const placed = Number(betPoint);
  const close = Number(closingPoint);
  if (Number.isNaN(placed) || Number.isNaN(close)) return null;
  const marketKey = bet?.marketKey || '';
  const outcome = String(bet?.outcomeName || bet?.pick || '').toLowerCase();

  if (marketKey === 'spreads' || bet?.type === 'Spread') {
    return Number((placed - close).toFixed(2));
  }
  if (marketKey === 'totals' || marketKey.includes('player_') || bet?.type === 'Total' || bet?.type === 'Prop' || bet?.type === 'Player Prop') {
    if (outcome.includes('under')) return Number((placed - close).toFixed(2));
    if (outcome.includes('over')) return Number((close - placed).toFixed(2));
  }
  return null;
}

function getOpenerPointEdge(bet) {
  const betPoint = getBetPoint(bet);
  if (betPoint == null || bet?.openingPoint == null) return null;
  return getPointCLV({ ...bet, closingPoint: bet.openingPoint }, bet.openingPoint);
}

function getTimingValue(bet) {
  const pointClv = getPointCLV(bet);
  const priceClv = calculateCLV(bet?.odds, bet?.closingOdds);
  if (pointClv != null) return { type: 'point', value: pointClv };
  if (priceClv != null) return { type: 'price', value: priceClv };
  return null;
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

function gradeLineTiming(pointClv) {
  if (pointClv == null) return { label: '—', color: '#64748b', bg: 'rgba(100,116,139,0.15)' };
  if (pointClv >= 1.5) return { label: 'Sharp', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' };
  if (pointClv >= 0.5) return { label: 'Good', color: '#84cc16', bg: 'rgba(132,204,22,0.15)' };
  if (pointClv > -0.5) return { label: 'Neutral', color: '#eab308', bg: 'rgba(234,179,8,0.15)' };
  if (pointClv > -1.5) return { label: 'Late', color: '#f97316', bg: 'rgba(249,115,22,0.15)' };
  return { label: 'Chased', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' };
}

function gradePortfolioTiming(beatCloseRate, recordedBets) {
  if (!recordedBets) return { label: 'Needs Data', color: '#64748b', bg: 'rgba(100,116,139,0.14)' };
  if (beatCloseRate >= 60) return { label: 'Sharp Timing', color: '#22c55e', bg: 'rgba(34,197,94,0.14)' };
  if (beatCloseRate >= 52) return { label: 'Positive Timing', color: '#84cc16', bg: 'rgba(132,204,22,0.14)' };
  if (beatCloseRate >= 45) return { label: 'Neutral Timing', color: '#eab308', bg: 'rgba(234,179,8,0.14)' };
  return { label: 'Chasing Numbers', color: '#ef4444', bg: 'rgba(239,68,68,0.14)' };
}

function formatTimingValue(timing) {
  if (!timing) return '—';
  const sign = timing.value >= 0 ? '+' : '';
  return timing.type === 'point'
    ? `${sign}${timing.value.toFixed(2)} pts`
    : `${sign}${timing.value.toFixed(2)}%`;
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

// Bets state lives in App (useCloudBets) so closing-line auto-capture keeps
// running app-wide even when this tab isn't mounted; see useClosingLineCapture.
export default function BetTracker({ pendingBet, onBetConsumed, bets, setBets }) {
  const { tier, user } = useAuth();
  const isPro = tier === 'pro';
  
  // Form state
  const [game, setGame] = useState('');
  const [betType, setBetType] = useState('Spread');
  const [pick, setPick] = useState('');
  const [odds, setOdds] = useState('');
  const [wager, setWager] = useState('');
  const [date, setDate] = useState(todayStr());
  const [openingOdds, setOpeningOdds] = useState('');
  const [closingOdds, setClosingOdds] = useState('');
  const [openingPoint, setOpeningPoint] = useState('');
  const [closingPoint, setClosingPoint] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isPreFilled, setIsPreFilled] = useState(false);
  
  // Filter states
  const [activeSport, setActiveSport] = useState('All');
  const [timeFilter, setTimeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showDataPanel, setShowDataPanel] = useState(false);
  const [dataPanelStatus, setDataPanelStatus] = useState('');
  const consumedAutoSaveRef = useRef(new Set());
  const consumedPendingBetRef = useRef(null);

  function buildBetFromInput(source = pendingBet) {
    return {
      id: Date.now(),
      updatedAt: Date.now(),
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
      betPoint: source?.outcomePoint ?? (openingPoint === '' ? null : Number(openingPoint)),
      openingPoint: openingPoint === '' ? source?.openingPoint ?? source?.outcomePoint ?? null : Number(openingPoint),
      closingPoint: closingPoint === '' ? source?.closingPoint ?? null : Number(closingPoint),
      gameId: source?.gameId ?? null,
      sportKey: source?.sportKey ?? null,
      marketKey: source?.marketKey ?? null,
      outcomeName: source?.outcomeName ?? null,
      outcomePoint: source?.outcomePoint ?? null,
      commenceTime: source?.commenceTime ?? null,
      book: source?.book ?? null,
      player: source?.player ?? null,
    };
  }

  useEffect(() => {
    if (pendingBet) {
      if (!pendingBet.autoSave && consumedPendingBetRef.current === pendingBet) return;
      consumedPendingBetRef.current = pendingBet;

      setGame(pendingBet.game || '');
      setBetType(pendingBet.type || 'Spread');
      setPick(pendingBet.pick || '');
      setOdds(pendingBet.odds != null ? String(pendingBet.odds) : '');
      setWager(pendingBet.wager != null ? String(pendingBet.wager) : '');
      setDate(pendingBet.date ? new Date(pendingBet.date).toISOString().split('T')[0] : todayStr());
      setOpeningOdds(pendingBet.openingOdds != null ? String(pendingBet.openingOdds) : '');
      setClosingOdds(pendingBet.closingOdds != null ? String(pendingBet.closingOdds) : '');
      setOpeningPoint(pendingBet.openingPoint != null ? String(pendingBet.openingPoint) : pendingBet.outcomePoint != null ? String(pendingBet.outcomePoint) : '');
      setClosingPoint(pendingBet.closingPoint != null ? String(pendingBet.closingPoint) : '');
      if (pendingBet.autoSave && pendingBet.wager != null && pendingBet.odds != null && pendingBet.pick) {
        const autoKey = [pendingBet.game, pendingBet.pick, pendingBet.odds, pendingBet.wager, pendingBet.date].join('::');
        if (!consumedAutoSaveRef.current.has(autoKey)) {
          consumedAutoSaveRef.current.add(autoKey);
          const autoBet = {
            id: Date.now(),
            updatedAt: Date.now(),
            game: pendingBet.game || pendingBet.player || '',
            type: pendingBet.type || 'Player Prop',
            pick: pendingBet.pick || '',
            odds: Number(pendingBet.odds),
            wager: Number(pendingBet.wager),
            date: pendingBet.date ? new Date(pendingBet.date).toISOString().split('T')[0] : todayStr(),
            status: 'pending',
            profit: null,
            settledDate: null,
            openingOdds: pendingBet.openingOdds ?? null,
            closingOdds: pendingBet.closingOdds ?? null,
            betPoint: pendingBet.outcomePoint ?? null,
            openingPoint: pendingBet.openingPoint ?? pendingBet.outcomePoint ?? null,
            closingPoint: pendingBet.closingPoint ?? null,
            gameId: pendingBet.gameId ?? null,
            sportKey: pendingBet.sportKey ?? null,
            marketKey: pendingBet.marketKey ?? null,
            outcomeName: pendingBet.outcomeName ?? null,
            outcomePoint: pendingBet.outcomePoint ?? null,
            commenceTime: pendingBet.commenceTime ?? null,
            book: pendingBet.book ?? null,
            player: pendingBet.player ?? null,
          };
          setBets(prev => prev.some(b => !b.deleted && b.game === autoBet.game && b.pick === autoBet.pick && b.odds === autoBet.odds && b.wager === autoBet.wager && b.date === autoBet.date) ? prev : [autoBet, ...prev]);
        }
        setShowForm(false);
        setIsPreFilled(false);
        if (onBetConsumed) onBetConsumed();
        return;
      }

      setShowForm(true);
      setIsPreFilled(true);
    }
  }, [pendingBet, setBets, onBetConsumed]);

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
      // Hide soft-deleted tombstones from every view.
      if (bet.deleted) return false;
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
    // Spreads/totals/props use point CLV first; moneylines and same-line
    // price moves use implied-probability CLV.
    const timedEntries = filteredBets
      .map(b => ({ bet: b, timing: getTimingValue(b) }))
      .filter(item => item.timing);
    const timedBets = timedEntries.map(item => item.bet);

    const priceClvValues = filteredBets
      .map(b => calculateCLV(b.odds, b.closingOdds))
      .filter(v => v != null);
    const avgCLV = priceClvValues.length
      ? Number((priceClvValues.reduce((a, b) => a + b, 0) / priceClvValues.length).toFixed(2))
      : null;

    const lineClvValues = filteredBets
      .map(b => getPointCLV(b))
      .filter(v => v != null);
    const avgLineCLV = lineClvValues.length
      ? Number((lineClvValues.reduce((a, b) => a + b, 0) / lineClvValues.length).toFixed(2))
      : null;

    const beatClose = timedEntries.filter(item => item.timing.value > 0).length;
    const beatCloseRate = timedEntries.length ? (beatClose / timedEntries.length) * 100 : 0;
    const portfolioGrade = gradePortfolioTiming(beatCloseRate, timedEntries.length);
    const sortedTiming = [...timedEntries].sort((a, b) => b.timing.value - a.timing.value);
    const bestTiming = sortedTiming[0] || null;
    const worstTiming = sortedTiming[sortedTiming.length - 1] || null;
    const pendingNeedsClose = filteredBets.filter(b => (
      b.status === 'pending' &&
      (b.marketKey || b.gameId || getBetPoint(b) != null || b.odds != null) &&
      getTimingValue(b) == null
    )).length;
    const coverageRate = filteredBets.length ? (timedEntries.length / filteredBets.length) * 100 : 0;

    const openerPriceBets = filteredBets.filter(b => b.openingOdds != null);
    const openerValues = openerPriceBets
      .map(b => calculateOpenerEdge(b.odds, b.openingOdds))
      .filter(v => v != null);
    const avgOpenerEdge = openerValues.length
      ? Number((openerValues.reduce((a, b) => a + b, 0) / openerValues.length).toFixed(2))
      : null;

    const openerPointValues = filteredBets
      .map(b => getOpenerPointEdge(b))
      .filter(v => v != null);
    const avgOpenerPointEdge = openerPointValues.length
      ? Number((openerPointValues.reduce((a, b) => a + b, 0) / openerPointValues.length).toFixed(2))
      : null;

    // CLV units: aggregate timing edge using point CLV where possible and
    // price CLV otherwise. Flat 1u per bet keeps the metric wager-agnostic.
    const clvUnits = timedEntries.length
      ? Number(timedEntries.reduce((sum, item) => sum + item.timing.value, 0).toFixed(2))
      : 0;

    return {
      wins, losses, pushes, total, totalWagered, netPL, winPct, roi, units, avgWager, sportBreakdown,
      timing: {
        recordedBets: timedBets.length,
        totalBets: filteredBets.length,
        avgCLV,
        avgLineCLV,
        beatClose,
        beatCloseRate,
        portfolioGrade,
        avgOpenerEdge,
        avgOpenerPointEdge,
        openerRecorded: new Set([
          ...openerPriceBets.map(b => b.id),
          ...filteredBets.filter(b => b.openingPoint != null).map(b => b.id),
        ]).size,
        lineRecorded: lineClvValues.length,
        priceRecorded: priceClvValues.length,
        clvUnits,
        pendingNeedsClose,
        coverageRate,
        bestTiming,
        worstTiming,
      },
    };
  }, [filteredBets]);
  
  const atLimit = !isPro && bets.filter(b => !b.deleted).length >= FREE_BET_LIMIT;
  
  function handleAddBet(e) {
    e.preventDefault();
    if (atLimit) return;
    if (!game || !pick || !odds || !wager) return;
    
    const newBet = buildBetFromInput();

    setBets(prev => [newBet, ...prev]);
    setGame('');
    setPick('');
    setOdds('');
    setWager('');
    setDate(todayStr());
    setOpeningOdds('');
    setClosingOdds('');
    setOpeningPoint('');
    setClosingPoint('');
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
      return { ...bet, status: result, profit, settledDate: todayStr(), updatedAt: Date.now() };
    }));
  }
  
  // Soft delete: bets are marked with a tombstone instead of being removed
  // outright. This lets deletes propagate across devices without the additive
  // cloud merge ever "resurrecting" a deleted bet, and it preserves the record
  // in the local archive so the user can always recover it if needed.
  function deleteBet(id) {
    setBets(prev => prev.map(b => b.id === id ? { ...b, deleted: true, deletedAt: Date.now(), updatedAt: Date.now() } : b));
  }

  function mergeBetLists(existingBets, incoming, { overwriteDeleted = false } = {}) {
    let added = 0;
    let merged = 0;
    let restored = 0;
    const map = new Map();
    existingBets.forEach(b => { if (b?.id != null) map.set(b.id, b); });
    incoming.forEach(b => {
      if (!b || b.id == null) return;
      const existing = map.get(b.id);
      if (!existing) {
        map.set(b.id, b);
        added += 1;
        return;
      }

      const filled = { ...existing };
      let changed = false;
      Object.keys(b).forEach(k => {
        if (filled[k] == null && b[k] != null) {
          filled[k] = b[k];
          changed = true;
        }
      });
      if (overwriteDeleted && existing.deleted && !b.deleted) {
        filled.deleted = false;
        filled.deletedAt = null;
        filled.restoredAt = Date.now();
        changed = true;
        restored += 1;
      }
      if (changed) {
        filled.updatedAt = Date.now();
        map.set(b.id, filled);
        merged += 1;
      }
    });
    return {
      next: Array.from(map.values()).sort((a, c) => (c.id || 0) - (a.id || 0)),
      added,
      merged,
      restored,
    };
  }

  function mergeIncomingBets(incoming, { overwriteDeleted = false } = {}) {
    const result = mergeBetLists(bets, incoming, { overwriteDeleted });
    setBets(result.next);
    return result;
  }

  // Export all bets (including soft-deleted tombstones) as a JSON file so
  // users can keep their own backup or move data between browsers.
  function exportBets() {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        source: 'EdgeFinder',
        bets,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edgefinder-bets-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDataPanelStatus(`Export started: ${bets.length} bet record(s) in the JSON backup.`);
    } catch (err) {
      const message = 'Export failed: ' + err.message;
      setDataPanelStatus(message);
      alert(message);
    }
  }

  // Merge imported bets into the current list by id. Never overwrites or
  // drops an existing bet — we only fill in fields that are empty on the
  // current copy, so local edits are preserved.
  function importBets(fileOrText) {
    const handle = (text) => {
      try {
        const parsed = JSON.parse(text);
        const incoming = Array.isArray(parsed) ? parsed : (parsed.bets || []);
        if (!Array.isArray(incoming) || incoming.length === 0) {
          setDataPanelStatus('No bets found in that backup file.');
          return;
        }
        const { added, merged, restored } = mergeIncomingBets(incoming, { overwriteDeleted: true });
        const message = `Import complete: ${added} new, ${merged} updated, ${restored} restored.`;
        setDataPanelStatus(message);
      } catch (err) {
        const message = 'Could not parse backup file: ' + err.message;
        setDataPanelStatus(message);
        alert(message);
      }
    };

    if (typeof fileOrText === 'string') {
      handle(fileOrText);
    } else if (fileOrText?.text) {
      fileOrText.text().then(handle).catch(err => {
        const message = 'Could not read backup file: ' + err.message;
        setDataPanelStatus(message);
        alert(message);
      });
    } else if (fileOrText instanceof File) {
      const reader = new FileReader();
      reader.onload = e => handle(String(e.target.result || ''));
      reader.onerror = () => {
        const message = 'Could not read backup file.';
        setDataPanelStatus(message);
        alert(message);
      };
      reader.readAsText(fileOrText);
    } else {
      setDataPanelStatus('No backup file selected.');
    }
  }

  // Last-ditch recovery: scan every localStorage key on this device plus every
  // historical cloud snapshot doc, then additively merge anything bet-shaped
  // back in. Only ever adds — never overwrites or removes.
  async function scanAndRecover() {
    try {
      const local = scanLocalStorageForBets();
      const cloud = user?.uid ? await loadCloudSnapshots(user.uid) : [];
      const knownIds = new Set(bets.map(b => b.id));
      const incoming = [...local, ...cloud].filter(b => b && b.id != null);
      const newOnes = incoming.filter(b => !knownIds.has(b.id));
      if (newOnes.length === 0) {
        setDataPanelStatus('Scan complete. No additional bets found on this device or in cloud snapshots.');
        return;
      }
      const { added, merged, restored } = mergeIncomingBets(incoming, { overwriteDeleted: true });
      setDataPanelStatus(`Recovered ${added} missing bet(s), updated ${merged}, restored ${restored}.`);
    } catch (err) {
      const message = 'Scan failed: ' + err.message;
      setDataPanelStatus(message);
      alert(message);
    }
  }

  function setTimingOdds(id, { openingOdds, closingOdds, openingPoint, closingPoint }) {
    setBets(prev => prev.map(bet => {
      if (bet.id !== id) return bet;
      const next = { ...bet };
      if (openingOdds !== undefined) next.openingOdds = openingOdds === null || openingOdds === '' ? null : Number(openingOdds);
      if (closingOdds !== undefined) next.closingOdds = closingOdds === null || closingOdds === '' ? null : Number(closingOdds);
      if (openingPoint !== undefined) {
        next.openingPoint = openingPoint === null || openingPoint === '' ? null : Number(openingPoint);
        next.betPoint = next.openingPoint;
      }
      if (closingPoint !== undefined) next.closingPoint = closingPoint === null || closingPoint === '' ? null : Number(closingPoint);
      // Recency stamp so the cloud/archive merge knows this manual edit beats
      // any older copy of the bet — without it, edits reverted on reload.
      next.updatedAt = Date.now();
      return next;
    }));
  }
  
  return (
    <div style={{ padding: '20px 24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* WEEKLY RECAP */}
      <WeeklyRecap bets={bets} getTimingValue={getTimingValue} />

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

      {/* EV TIMING ANALYTICS PANEL — Edge Finder V2.5 */}
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
            }}>V2.5</span>
          </div>
          <div style={{ fontSize: '10px', color: '#475569' }}>
            {stats.timing.recordedBets}/{stats.timing.totalBets} bets tracked
          </div>
        </div>

        {stats.timing.recordedBets === 0 ? (
          <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '16px 0' }}>
            Bets added from the Games tab capture the bet line and closing line automatically once the game kicks off. You can also enter the close manually.
          </div>
        ) : (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '8px',
              marginBottom: '10px',
            }}>
              <div style={{
                padding: '12px',
                borderRadius: '8px',
                background: stats.timing.portfolioGrade.bg,
                border: `1px solid ${stats.timing.portfolioGrade.color}55`,
              }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>CLV HEALTH</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: stats.timing.portfolioGrade.color }}>{stats.timing.portfolioGrade.label}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', lineHeight: 1.45 }}>
                  {stats.timing.beatCloseRate.toFixed(0)}% beat-close rate across {stats.timing.recordedBets} tracked bet{stats.timing.recordedBets === 1 ? '' : 's'}.
                </div>
              </div>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(15,23,42,0.5)' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>TRACKING COVERAGE</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: stats.timing.coverageRate >= 70 ? '#22c55e' : '#eab308' }}>
                  {stats.timing.coverageRate.toFixed(0)}%
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>of visible bets have CLV data</div>
              </div>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(15,23,42,0.5)' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>NEEDS CLOSE</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: stats.timing.pendingNeedsClose ? '#f59e0b' : '#22c55e' }}>
                  {stats.timing.pendingNeedsClose}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>pending bet{stats.timing.pendingNeedsClose === 1 ? '' : 's'} waiting</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '10px' }}>
              {[
                {
                  label: 'Line CLV',
                  value: stats.timing.avgLineCLV != null ? `${stats.timing.avgLineCLV >= 0 ? '+' : ''}${stats.timing.avgLineCLV.toFixed(2)} pts` : '—',
                  sub: `${stats.timing.lineRecorded} spread/total/prop`,
                  color: stats.timing.avgLineCLV == null ? '#64748b' : stats.timing.avgLineCLV >= 0 ? '#22c55e' : '#ef4444',
                },
                {
                  label: 'Beat Close',
                  value: `${stats.timing.beatCloseRate.toFixed(0)}%`,
                  sub: `${stats.timing.beatClose} of ${stats.timing.recordedBets} bets`,
                  color: stats.timing.beatCloseRate >= 55 ? '#22c55e' : stats.timing.beatCloseRate >= 45 ? '#eab308' : '#ef4444',
                },
                {
                  label: 'Timing Edge',
                  value: `${stats.timing.clvUnits >= 0 ? '+' : ''}${stats.timing.clvUnits.toFixed(2)}`,
                  sub: 'points or price edge',
                  color: stats.timing.clvUnits >= 0 ? '#22c55e' : '#ef4444',
                },
                {
                  label: 'Price CLV',
                  value: stats.timing.avgCLV != null ? `${stats.timing.avgCLV >= 0 ? '+' : ''}${stats.timing.avgCLV.toFixed(2)}%` : '—',
                  sub: `${stats.timing.priceRecorded} odds close(s)`,
                  color: stats.timing.avgCLV == null ? '#64748b' : stats.timing.avgCLV >= 0 ? '#22c55e' : '#ef4444',
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
            {(stats.timing.bestTiming || stats.timing.worstTiming) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '8px',
                marginBottom: '10px',
              }}>
                {stats.timing.bestTiming && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.22)' }}>
                    <div style={{ fontSize: '10px', color: '#22c55e', fontWeight: 800, marginBottom: '5px' }}>BEST NUMBER BEAT</div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>{stats.timing.bestTiming.bet.game}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                      {stats.timing.bestTiming.bet.pick} · {formatTimingValue(stats.timing.bestTiming.timing)}
                    </div>
                  </div>
                )}
                {stats.timing.worstTiming && stats.timing.worstTiming !== stats.timing.bestTiming && (
                  <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.20)' }}>
                    <div style={{ fontSize: '10px', color: '#ef4444', fontWeight: 800, marginBottom: '5px' }}>WORST CHASE</div>
                    <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>{stats.timing.worstTiming.bet.game}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>
                      {stats.timing.worstTiming.bet.pick} · {formatTimingValue(stats.timing.worstTiming.timing)}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '6px',
              fontSize: '9px', color: '#64748b',
              paddingTop: '8px', borderTop: '1px solid rgba(71, 85, 105, 0.2)',
            }}>
              <span>Line grade:</span>
              {[
                { label: 'Sharp', color: '#22c55e', range: '≥ +1.5 pts' },
                { label: 'Good', color: '#84cc16', range: '+0.5 to +1.5' },
                { label: 'Neutral', color: '#eab308', range: '±0.5' },
                { label: 'Late', color: '#f97316', range: '-0.5 to -1.5' },
                { label: 'Chased', color: '#ef4444', range: '< -1.5' },
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

      {/* DATA BACKUP PANEL — export/import so nothing is ever truly lost */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.45)',
        border: '1px solid rgba(71, 85, 105, 0.25)',
        borderRadius: '12px',
        marginBottom: '12px',
        overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setShowDataPanel(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '10px 14px', background: 'transparent', border: 'none',
            cursor: 'pointer', color: '#94a3b8',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
            <Archive size={13} /> DATA BACKUP &amp; RESTORE
            <span style={{
              fontSize: '9px', padding: '2px 6px',
              background: 'rgba(34, 197, 94, 0.15)', borderRadius: '4px',
              color: '#22c55e', fontWeight: 700,
            }}>
              {bets.filter(b => !b.deleted).length} live · {bets.filter(b => b.deleted).length} deleted
            </span>
          </span>
          {showDataPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showDataPanel && (
          <div style={{ padding: '0 14px 14px 14px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '10px', lineHeight: 1.5 }}>
              Export every bet (including deleted) to a JSON file, or import a previous backup. Imports merge by ID — nothing on this device is overwritten, and no duplicates are created.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={exportBets}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px',
                  background: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '8px',
                  color: '#22c55e', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
              >
                <Download size={14} /> Export JSON
              </button>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                borderRadius: '8px',
                color: '#818cf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}>
                <Upload size={14} /> Import JSON
                <input
                  type="file"
                  accept="application/json,.json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importBets(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {bets.some(b => b.deleted) && (
                <button
                  onClick={() => {
                    const ids = bets.filter(b => b.deleted).map(b => b.id);
                    if (!confirm(`Restore ${ids.length} deleted bet(s)?`)) return;
                    const now = Date.now();
                    setBets(prev => prev.map(b => ids.includes(b.id) ? { ...b, deleted: false, deletedAt: null, restoredAt: now, updatedAt: now } : b));
                    setDataPanelStatus(`Restored ${ids.length} deleted bet(s).`);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 14px',
                    background: 'rgba(234, 179, 8, 0.15)',
                    border: '1px solid rgba(234, 179, 8, 0.4)',
                    borderRadius: '8px',
                    color: '#eab308', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={14} /> Restore all deleted
                </button>
              )}
              <button
                onClick={scanAndRecover}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px',
                  background: 'rgba(14, 165, 233, 0.15)',
                  border: '1px solid rgba(14, 165, 233, 0.4)',
                  borderRadius: '8px',
                  color: '#38bdf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                }}
                title="Scan this device's localStorage and all cloud snapshots for any missing bets"
              >
                <Search size={14} /> Scan &amp; recover
              </button>
            </div>
            <div style={{ fontSize: '10px', color: '#475569', marginTop: '8px', lineHeight: 1.5 }}>
              Scan &amp; recover pulls from every localStorage key on this device and every daily cloud snapshot. Only adds — never overwrites.
            </div>
            {dataPanelStatus && (
              <div style={{
                marginTop: '8px',
                padding: '8px 10px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(71, 85, 105, 0.35)',
                borderRadius: '6px',
                color: '#cbd5e1',
                fontSize: '11px',
                lineHeight: 1.4,
              }}>
                {dataPanelStatus}
              </div>
            )}
          </div>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} /> Bet Line <span style={{ color: '#475569' }}>(auto)</span>
                </label>
                <input type="number" value={openingPoint} onChange={(e) => setOpeningPoint(e.target.value)} placeholder="-3.5" style={inputStyle} />
              </div>
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
              <div>
                <label style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} /> Closing Line <span style={{ color: '#475569' }}>(optional)</span>
                </label>
                <input type="number" value={closingPoint} onChange={(e) => setClosingPoint(e.target.value)} placeholder="-5" style={inputStyle} />
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
  const [openPointDraft, setOpenPointDraft] = useState(bet.openingPoint ?? getBetPoint(bet) ?? '');
  const [closePointDraft, setClosePointDraft] = useState(bet.closingPoint ?? '');

  const clv = calculateCLV(bet.odds, bet.closingOdds);
  const pointClv = getPointCLV(bet);
  const grade = pointClv != null ? gradeLineTiming(pointClv) : gradeTiming(clv);
  const hasTiming = bet.openingOdds != null || bet.closingOdds != null || bet.openingPoint != null || bet.closingPoint != null || getBetPoint(bet) != null;

  function saveTiming() {
    onSetTimingOdds?.(bet.id, {
      openingOdds: openDraft === '' ? null : openDraft,
      closingOdds: closeDraft === '' ? null : closeDraft,
      openingPoint: openPointDraft === '' ? null : openPointDraft,
      closingPoint: closePointDraft === '' ? null : closePointDraft,
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
            {(pointClv != null || clv != null) && (
              <span style={{
                fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                background: grade.bg, color: grade.color, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: '3px',
              }}>
                <Clock size={9} />
                {pointClv != null
                  ? `${grade.label} ${pointClv >= 0 ? '+' : ''}${pointClv.toFixed(2)} pts`
                  : `${grade.label} ${clv >= 0 ? '+' : ''}${clv.toFixed(2)}%`}
              </span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>
            {bet.pick} @ {formatOdds(bet.odds)} • ${bet.wager}
          </div>
          {hasTiming && !editingTiming && (
            <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {getBetPoint(bet) != null && <span>Bet line: {formatPoint(getBetPoint(bet))}</span>}
              {bet.closingPoint != null && <span>Close line: {formatPoint(bet.closingPoint)}</span>}
              {bet.openingOdds != null && <span>Open: {formatOdds(bet.openingOdds)}</span>}
              {bet.closingOdds != null && <span>Close: {formatOdds(bet.closingOdds)}</span>}
              {clv != null && pointClv != null && <span>Price CLV: {clv >= 0 ? '+' : ''}{clv.toFixed(2)}%</span>}
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
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Bet Line</label>
            <input
              type="number" value={openPointDraft} onChange={(e) => setOpenPointDraft(e.target.value)}
              placeholder="-3.5"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Close Line</label>
            <input
              type="number" value={closePointDraft} onChange={(e) => setClosePointDraft(e.target.value)}
              placeholder="-5"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Open Odds</label>
            <input
              type="number" value={openDraft} onChange={(e) => setOpenDraft(e.target.value)}
              placeholder="-105"
              style={{ ...inputStyle, width: '80px', padding: '6px 8px', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>Close Odds</label>
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
          <button onClick={() => {
            setEditingTiming(false);
            setOpenDraft(bet.openingOdds ?? '');
            setCloseDraft(bet.closingOdds ?? '');
            setOpenPointDraft(bet.openingPoint ?? getBetPoint(bet) ?? '');
            setClosePointDraft(bet.closingPoint ?? '');
          }} style={{
            padding: '6px 10px', background: 'transparent',
            border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '6px',
            color: '#94a3b8', fontSize: '11px', cursor: 'pointer',
          }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
