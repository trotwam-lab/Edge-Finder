import React, { useState, useMemo, useEffect } from 'react';
import {
  PlusCircle, Trophy, Trash2, ChevronDown,
  Search, Calendar, Filter, TrendingUp, TrendingDown, Minus, Target,
  BarChart3, DollarSign, Scale, Activity
} from 'lucide-react';
import { americanToDecimal } from '../utils/odds-math.js';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { useCloudBets } from '../hooks/useCloudBets.js';
import { createPropHistoryKey, getMarketDisplayName, normalizePersonName } from '../utils/props.js';

const BET_TYPES = ['Spread', 'Moneyline', 'Total', 'Prop', 'Player Prop', 'Future', 'Other'];
const FREE_BET_LIMIT = 5;
const DEFAULT_SPORTS = ['All', 'NBA', 'NFL', 'UFC', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];

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

function formatMoney(val) {
  if (val === null || val === undefined) return '—';
  const sign = val >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function formatOdds(odds) {
  if (odds === null || odds === undefined || Number.isNaN(Number(odds))) return '—';
  const value = Number(odds);
  return value > 0 ? `+${value}` : `${value}`;
}

function formatLine(line) {
  if (line === null || line === undefined || Number.isNaN(Number(line))) return '—';
  const value = Number(line);
  return value > 0 ? `+${value}` : `${value}`;
}

function formatLineDelta(delta) {
  if (delta === null || delta === undefined || Number.isNaN(Number(delta))) return '—';
  const value = Number(delta);
  return `${value > 0 ? '+' : ''}${value.toFixed(Math.abs(value) % 1 === 0 ? 0 : 1)}`;
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

function normalizeText(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function getSportFromGame(gameStr) {
  if (!gameStr) return 'Other';
  const game = gameStr.toLowerCase();
  if (game.includes('lakers') || game.includes('celtics') || game.includes('nba')) return 'NBA';
  if (game.includes('chiefs') || game.includes('eagles') || game.includes('nfl')) return 'NFL';
  if (game.includes('ufc') || game.includes('fight')) return 'UFC';
  if (game.includes('yankees') || game.includes('mlb')) return 'MLB';
  if (game.includes('nhl') || game.includes('rangers') || game.includes('bruins')) return 'NHL';
  if (game.includes('ncaab')) return 'NCAAB';
  if (game.includes('ncaaf')) return 'NCAAF';
  return 'Other';
}

function splitGameTeams(game) {
  if (!game) return [];
  return String(game)
    .split(/\s+vs\s+|\s+@\s+/i)
    .map(part => part.trim())
    .filter(Boolean);
}

function getGameMarket(game, key) {
  const primaryBook = game?.bookmakers?.[0];
  return primaryBook?.markets?.find(m => m.key === key) || null;
}

function getSpreadOutcome(game, teamName) {
  return getGameMarket(game, 'spreads')?.outcomes?.find(outcome => normalizeText(outcome.name) === normalizeText(teamName)) || null;
}

function getH2HOutcome(game, teamName) {
  return getGameMarket(game, 'h2h')?.outcomes?.find(outcome => normalizeText(outcome.name) === normalizeText(teamName)) || null;
}

function getTotalOutcome(game, side) {
  return getGameMarket(game, 'totals')?.outcomes?.find(outcome => normalizeText(outcome.name) === normalizeText(side)) || null;
}

function findMatchingGame(bet, games = []) {
  const teams = splitGameTeams(bet.game);
  if (teams.length < 2) return null;
  return games.find(game => {
    const home = normalizeText(game.home_team);
    const away = normalizeText(game.away_team);
    return teams.every(team => {
      const normalized = normalizeText(team);
      return home.includes(normalized) || away.includes(normalized) || normalized.includes(home) || normalized.includes(away);
    });
  }) || null;
}

function parseSpreadPick(pick) {
  const match = String(pick || '').match(/^(.*)\s([+-]\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return { team: match[1].trim(), line: Number(match[2]) };
}

function parseTotalPick(pick) {
  const match = String(pick || '').match(/^(Over|Under)\s(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  return { side: match[1][0].toUpperCase() + match[1].slice(1).toLowerCase(), line: Number(match[2]) };
}

function parseMoneylinePick(pick) {
  const match = String(pick || '').match(/^(.*)\s([+-]\d+)$/);
  if (!match) return null;
  return { team: match[1].trim(), price: Number(match[2]) };
}

function parsePropPick(pick) {
  const text = String(pick || '');
  const match = text.match(/^(.*?)\s([A-Z0-9+\- ]+?)\s(Over|Under)\s([0-9]+(?:\.[0-9]+)?)$/i);
  if (!match) return null;
  return {
    player: match[1].trim(),
    marketLabel: match[2].trim(),
    side: match[3][0].toUpperCase() + match[3].slice(1).toLowerCase(),
    line: Number(match[4]),
  };
}

function getLineDesirability(betKind, side, line) {
  if (line === null || line === undefined || Number.isNaN(Number(line))) return null;
  const value = Number(line);
  if (betKind === 'total') return side === 'Over' ? -value : value;
  if (betKind === 'prop') return side === 'Over' ? -value : value;
  return value;
}

function compareValues(entryValue, targetValue) {
  if (entryValue === null || entryValue === undefined || targetValue === null || targetValue === undefined) return null;
  if (entryValue > targetValue) return 'beat';
  if (entryValue < targetValue) return 'missed';
  return 'push';
}

function buildClvData(bet, games, playerProps, propClosingLines, gameLineHistory) {
  const type = String(bet.type || '').toLowerCase();

  if (type === 'spread') {
    const parsed = parseSpreadPick(bet.pick);
    const game = findMatchingGame(bet, games);
    if (!parsed || !game) return null;
    const currentOutcome = getSpreadOutcome(game, parsed.team);
    const history = gameLineHistory?.[game.id] || [];
    const latestSnapshot = history[history.length - 1] || null;
    const currentLine = currentOutcome?.point ?? null;
    const currentPrice = currentOutcome?.price ?? null;
    const closingLine = latestSnapshot?.spread ?? (new Date(game.commence_time).getTime() <= Date.now() ? currentLine : null);
    const lineResult = compareValues(
      getLineDesirability('spread', null, parsed.line),
      getLineDesirability('spread', null, closingLine ?? currentLine)
    );
    const priceResult = compareValues(Number(bet.odds), closingLine == null && currentPrice != null ? Number(currentPrice) : null);
    return {
      entryLine: parsed.line,
      entryPrice: Number(bet.odds),
      currentLine,
      currentPrice,
      closingLine,
      closingPrice: null,
      book: game.bookmakers?.[0]?.title || null,
      lineDelta: closingLine != null ? Number((closingLine - parsed.line).toFixed(2)) : currentLine != null ? Number((currentLine - parsed.line).toFixed(2)) : null,
      priceDelta: currentPrice != null ? Number(currentPrice) - Number(bet.odds) : null,
      result: closingLine != null ? lineResult : (lineResult ?? priceResult),
      comparisonLabel: closingLine != null ? 'vs close' : currentLine != null ? 'vs current' : null,
      measurableBy: closingLine != null || currentLine != null ? 'line' : currentPrice != null ? 'price' : null,
      source: game,
    };
  }

  if (type === 'moneyline') {
    const parsed = parseMoneylinePick(bet.pick);
    const game = findMatchingGame(bet, games);
    if (!parsed || !game) return null;
    const currentOutcome = getH2HOutcome(game, parsed.team);
    const currentPrice = currentOutcome?.price ?? null;
    const result = compareValues(Number(bet.odds), currentPrice);
    return {
      entryLine: null,
      entryPrice: Number(bet.odds),
      currentLine: null,
      currentPrice,
      closingLine: null,
      closingPrice: null,
      book: game.bookmakers?.[0]?.title || null,
      lineDelta: null,
      priceDelta: currentPrice != null ? Number(currentPrice) - Number(bet.odds) : null,
      result,
      comparisonLabel: currentPrice != null ? 'vs current' : null,
      measurableBy: currentPrice != null ? 'price' : null,
      source: game,
    };
  }

  if (type === 'total') {
    const parsed = parseTotalPick(bet.pick);
    const game = findMatchingGame(bet, games);
    if (!parsed || !game) return null;
    const currentOutcome = getTotalOutcome(game, parsed.side);
    const history = gameLineHistory?.[game.id] || [];
    const latestSnapshot = history[history.length - 1] || null;
    const currentLine = currentOutcome?.point ?? null;
    const currentPrice = currentOutcome?.price ?? null;
    const closingLine = latestSnapshot?.total ?? (new Date(game.commence_time).getTime() <= Date.now() ? currentLine : null);
    const lineResult = compareValues(
      getLineDesirability('total', parsed.side, parsed.line),
      getLineDesirability('total', parsed.side, closingLine ?? currentLine)
    );
    return {
      entryLine: parsed.line,
      entryPrice: Number(bet.odds),
      currentLine,
      currentPrice,
      closingLine,
      closingPrice: null,
      book: game.bookmakers?.[0]?.title || null,
      lineDelta: closingLine != null ? Number((closingLine - parsed.line).toFixed(2)) : currentLine != null ? Number((currentLine - parsed.line).toFixed(2)) : null,
      priceDelta: currentPrice != null ? Number(currentPrice) - Number(bet.odds) : null,
      result: closingLine != null ? lineResult : lineResult,
      comparisonLabel: closingLine != null ? 'vs close' : currentLine != null ? 'vs current' : null,
      measurableBy: closingLine != null || currentLine != null ? 'line' : currentPrice != null ? 'price' : null,
      source: game,
    };
  }

  if (type === 'player prop' || type === 'prop') {
    const parsed = parsePropPick(bet.pick);
    if (!parsed) return null;
    const matchedProps = (playerProps || []).filter(prop => {
      const propSide = normalizeText(prop.outcome);
      const playerMatch = normalizePersonName(prop.player) === normalizePersonName(parsed.player);
      const marketMatch = normalizeText(getMarketDisplayName(prop.market)) === normalizeText(parsed.marketLabel);
      const sideMatch = propSide === normalizeText(parsed.side);
      return playerMatch && marketMatch && sideMatch;
    });
    if (!matchedProps.length) return null;
    const currentProp = matchedProps[0];
    const currentLine = currentProp.line ?? null;
    const currentPrice = currentProp.price ?? null;
    const closeCandidates = matchedProps.map(prop => propClosingLines?.[createPropHistoryKey(prop)]).filter(Boolean);
    const closing = closeCandidates.sort((a, b) => new Date(b?.capturedAt || 0) - new Date(a?.capturedAt || 0))[0] || null;
    const closingLine = closing?.closingLine ?? null;
    const closingPrice = closing?.closingPrice ?? null;
    const lineResult = compareValues(
      getLineDesirability('prop', parsed.side, parsed.line),
      getLineDesirability('prop', parsed.side, closingLine ?? currentLine)
    );
    const priceResult = compareValues(Number(bet.odds), closingPrice ?? currentPrice);
    return {
      entryLine: parsed.line,
      entryPrice: Number(bet.odds),
      currentLine,
      currentPrice,
      closingLine,
      closingPrice,
      book: currentProp.book || currentProp.bookTitle || currentProp.bookKey || null,
      lineDelta: closingLine != null ? Number((closingLine - parsed.line).toFixed(2)) : currentLine != null ? Number((currentLine - parsed.line).toFixed(2)) : null,
      priceDelta: (closingPrice ?? currentPrice) != null ? Number(closingPrice ?? currentPrice) - Number(bet.odds) : null,
      result: closingLine != null ? lineResult : (lineResult ?? priceResult),
      comparisonLabel: closingLine != null ? 'vs close' : currentLine != null || currentPrice != null ? 'vs current' : null,
      measurableBy: closingLine != null || currentLine != null ? 'line' : ((closingPrice ?? currentPrice) != null ? 'price' : null),
      source: currentProp,
    };
  }

  return null;
}

function getResultMeta(result) {
  if (result === 'beat') return { label: 'Beat Close', color: '#22c55e', bg: 'rgba(34,197,94,0.14)', icon: <TrendingUp size={12} /> };
  if (result === 'missed') return { label: 'Missed Close', color: '#ef4444', bg: 'rgba(239,68,68,0.14)', icon: <TrendingDown size={12} /> };
  if (result === 'push') return { label: 'Flat', color: '#94a3b8', bg: 'rgba(148,163,184,0.14)', icon: <Minus size={12} /> };
  return { label: 'Unmeasured', color: '#64748b', bg: 'rgba(100,116,139,0.12)', icon: <Activity size={12} /> };
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

export default function BetTracker({ pendingBet, onBetConsumed, games = [], playerProps = [], propClosingLines = {}, gameLineHistory = {}, historicOdds = {} }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';
  const [bets, setBets] = useCloudBets('edgefinder_bets', []);
  const [pendingMeta, setPendingMeta] = useState({});

  const [game, setGame] = useState('');
  const [betType, setBetType] = useState('Spread');
  const [pick, setPick] = useState('');
  const [odds, setOdds] = useState('');
  const [wager, setWager] = useState('');
  const [date, setDate] = useState(todayStr());
  const [showForm, setShowForm] = useState(false);
  const [isPreFilled, setIsPreFilled] = useState(false);

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
      setWager(pendingBet.wager != null ? String(pendingBet.wager) : '');
      setDate(pendingBet.date ? new Date(pendingBet.date).toISOString().split('T')[0] : todayStr());
      setPendingMeta({
        sourceBook: pendingBet.book || pendingBet.sourceBook || null,
        sourceLine: pendingBet.line ?? null,
        sourceGameId: pendingBet.gameId || null,
        sourceSport: pendingBet.sport || null,
      });
      setShowForm(true);
      setIsPreFilled(true);
    }
  }, [pendingBet]);

  const detectedSports = useMemo(() => {
    const sports = new Set(['All']);
    bets.forEach(bet => sports.add(getSportFromGame(bet.game)));
    return Array.from(sports);
  }, [bets]);

  const sportsTabs = detectedSports.length > 1 ? detectedSports : DEFAULT_SPORTS;

  const filteredBets = useMemo(() => bets.filter(bet => {
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
  }), [bets, activeSport, timeFilter, statusFilter, searchQuery]);

  const enrichedBets = useMemo(() => filteredBets.map(bet => {
    const clv = buildClvData(bet, games, playerProps, propClosingLines, gameLineHistory);
    return { ...bet, clv, opener: historicOdds?.[clv?.source?.id] || null };
  }), [filteredBets, games, playerProps, propClosingLines, gameLineHistory, historicOdds]);

  const pendingBets = useMemo(() => enrichedBets.filter(b => b.status === 'pending').sort((a, b) => new Date(b.date) - new Date(a.date)), [enrichedBets]);
  const settledBets = useMemo(() => enrichedBets.filter(b => b.status !== 'pending').sort((a, b) => new Date(b.settledDate || b.date) - new Date(a.settledDate || b.date)), [enrichedBets]);

  const groupedBets = useMemo(() => {
    const groups = {};
    settledBets.forEach(bet => {
      const dateLabel = getRelativeDate(bet.settledDate || bet.date);
      if (!groups[dateLabel]) groups[dateLabel] = [];
      groups[dateLabel].push(bet);
    });
    return groups;
  }, [settledBets]);

  const stats = useMemo(() => {
    const settled = enrichedBets.filter(b => b.status !== 'pending');
    const wins = settled.filter(b => b.status === 'won').length;
    const losses = settled.filter(b => b.status === 'lost').length;
    const pushes = settled.filter(b => b.status === 'push').length;
    const total = settled.length;
    const totalWagered = settled.reduce((s, b) => s + (Number(b.wager) || 0), 0);
    const netPL = settled.reduce((s, b) => s + (Number(b.profit) || 0), 0);
    const decidedBets = wins + losses;
    const winPct = decidedBets > 0 ? (wins / decidedBets) * 100 : 0;
    const roi = totalWagered > 0 ? (netPL / totalWagered) * 100 : 0;
    const avgWager = total > 0 ? totalWagered / total : 100;
    const units = avgWager > 0 ? netPL / avgWager : 0;

    const measurable = enrichedBets.filter(b => b.clv?.result);
    const beat = measurable.filter(b => b.clv.result === 'beat').length;
    const missed = measurable.filter(b => b.clv.result === 'missed').length;
    const flat = measurable.filter(b => b.clv.result === 'push').length;
    const lineMeasured = measurable.filter(b => b.clv?.measurableBy === 'line' && b.clv?.lineDelta != null);
    const priceMeasured = enrichedBets.filter(b => b.clv?.priceDelta != null);
    const beatPct = measurable.length ? (beat / measurable.length) * 100 : 0;
    const avgLineDelta = lineMeasured.length ? lineMeasured.reduce((sum, b) => sum + (Number(b.clv.lineDelta) || 0), 0) / lineMeasured.length : null;
    const avgPriceDelta = priceMeasured.length ? priceMeasured.reduce((sum, b) => sum + (Number(b.clv.priceDelta) || 0), 0) / priceMeasured.length : null;

    const sportBreakdown = {};
    settled.forEach(b => {
      const sport = (b.sport || getSportFromGame(b.game || '')) || 'Other';
      if (!sportBreakdown[sport]) sportBreakdown[sport] = { wagered: 0, profit: 0, bets: 0 };
      sportBreakdown[sport].wagered += Number(b.wager) || 0;
      sportBreakdown[sport].profit += Number(b.profit) || 0;
      sportBreakdown[sport].bets += 1;
    });

    return { wins, losses, pushes, total, totalWagered, netPL, winPct, roi, units, avgWager, sportBreakdown, measurable: measurable.length, beat, missed, flat, beatPct, avgLineDelta, avgPriceDelta };
  }, [enrichedBets]);

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
      ...pendingMeta,
    };

    setBets(prev => [newBet, ...prev]);
    setGame('');
    setPick('');
    setOdds('');
    setWager('');
    setDate(todayStr());
    setPendingMeta({});
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
    <div style={{ padding: '20px 24px', maxWidth: '980px', margin: '0 auto' }}>
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

      <div style={{
        background: 'linear-gradient(135deg, rgba(15,23,42,0.78), rgba(30,41,59,0.68))',
        border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: '14px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Scale size={15} color="#818cf8" />
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#cbd5e1', letterSpacing: '0.04em' }}>BEAT THE CLOSE</div>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>Uses current live lines plus locally captured pregame snapshots when available.</div>
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{stats.measurable} measurable • {stats.beat} beat • {stats.missed} missed</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '10px' }}>
          {[
            { label: 'Tracked', value: filteredBets.length, sub: `${pendingBets.length} pending`, color: '#e2e8f0' },
            { label: 'Beat Close %', value: stats.measurable ? `${stats.beatPct.toFixed(0)}%` : '—', sub: stats.measurable ? `${stats.beat}/${stats.measurable} measurable` : 'Need measurable lines', color: stats.beatPct >= 50 ? '#22c55e' : '#f59e0b' },
            { label: 'Avg Line Move', value: stats.avgLineDelta != null ? `${stats.avgLineDelta > 0 ? '+' : ''}${stats.avgLineDelta.toFixed(2)}` : '—', sub: 'close/current minus entry', color: stats.avgLineDelta != null ? (stats.avgLineDelta <= 0 ? '#22c55e' : '#ef4444') : '#94a3b8' },
            { label: 'Avg Price Move', value: stats.avgPriceDelta != null ? `${stats.avgPriceDelta > 0 ? '+' : ''}${stats.avgPriceDelta.toFixed(0)}` : '—', sub: 'market price delta', color: stats.avgPriceDelta != null ? (stats.avgPriceDelta <= 0 ? '#22c55e' : '#ef4444') : '#94a3b8' },
          ].map((item, idx) => (
            <div key={idx} style={{ background: 'rgba(15,23,42,0.52)', border: '1px solid rgba(71,85,105,0.24)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>{item.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: item.color }}>{item.value}</div>
              <div style={{ fontSize: '10px', color: '#475569', marginTop: '4px' }}>{item.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {stats.total > 0 && (
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', padding: '16px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px' }}>ROI &amp; UNITS BREAKDOWN</div>
            <div style={{ fontSize: '10px', color: '#475569' }}>1u = ${stats.avgWager.toFixed(0)} avg wager</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'Net P/L', value: `${stats.netPL >= 0 ? '+' : ''}${formatMoney(stats.netPL)}`, sub: `on ${formatMoney(stats.totalWagered)} wagered`, color: stats.netPL >= 0 ? '#22c55e' : '#ef4444' },
              { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(2)}%`, sub: 'Net Profit / Total Wagered', color: stats.roi >= 0 ? '#22c55e' : '#ef4444' },
              { label: 'Units Won', value: `${stats.units >= 0 ? '+' : ''}${stats.units.toFixed(2)}u`, sub: `${stats.total} settled bets`, color: stats.units >= 0 ? '#22c55e' : '#ef4444' },
            ].map((item, i) => (
              <div key={i} style={{ background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>{item.label}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: item.color, fontFamily: "'JetBrains Mono', monospace" }}>{item.value}</div>
                <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
        {sportsTabs.map(sport => (
          <button
            key={sport}
            onClick={() => setActiveSport(sport)}
            style={{
              padding: '8px 16px', borderRadius: '20px',
              background: activeSport === sport ? 'rgba(99, 102, 241, 0.2)' : 'rgba(30, 41, 59, 0.5)',
              color: activeSport === sport ? '#818cf8' : '#64748b',
              fontSize: '13px', fontWeight: activeSport === sport ? 700 : 500,
              cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${activeSport === sport ? 'rgba(99, 102, 241, 0.5)' : 'rgba(71, 85, 105, 0.2)'}`,
            }}
          >
            {sport}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowTimeDropdown(!showTimeDropdown)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
            <Calendar size={14} />
            {TIME_FILTERS.find(t => t.key === timeFilter)?.label}
            <ChevronDown size={14} />
          </button>
          {showTimeDropdown && <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px', padding: '4px', zIndex: 100, minWidth: '140px' }}>
            {TIME_FILTERS.map(t => <button key={t.key} onClick={() => { setTimeFilter(t.key); setShowTimeDropdown(false); }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: timeFilter === t.key ? 'rgba(99, 102, 241, 0.2)' : 'transparent', border: 'none', borderRadius: '4px', color: timeFilter === t.key ? '#818cf8' : '#94a3b8', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}>{t.label}</button>)}
          </div>}
        </div>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowStatusDropdown(!showStatusDropdown)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>
            <Filter size={14} />
            {STATUS_FILTERS.find(s => s.key === statusFilter)?.label}
            <ChevronDown size={14} />
          </button>
          {showStatusDropdown && <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px', padding: '4px', zIndex: 100, minWidth: '120px' }}>
            {STATUS_FILTERS.map(s => <button key={s.key} onClick={() => { setStatusFilter(s.key); setShowStatusDropdown(false); }} style={{ display: 'block', width: '100%', padding: '8px 12px', background: statusFilter === s.key ? 'rgba(99, 102, 241, 0.2)' : 'transparent', border: 'none', borderRadius: '4px', color: statusFilter === s.key ? '#818cf8' : '#94a3b8', fontSize: '12px', textAlign: 'left', cursor: 'pointer' }}>{s.label}</button>)}
          </div>}
        </div>

        <div style={{ flex: 1, minWidth: '150px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '8px' }}>
            <Search size={14} color="#64748b" />
            <input type="text" placeholder="Search bets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flex: 1, background: 'transparent', border: 'none', color: '#e2e8f0', fontSize: '12px', outline: 'none' }} />
          </div>
        </div>

        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.5)', borderRadius: '8px', color: '#818cf8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
          <PlusCircle size={16} />
          Add Bet
        </button>
      </div>

      {showForm && (
        <div style={cardStyle}>
          {isPreFilled && <div style={{ padding: '8px 12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', marginBottom: '12px', fontSize: '12px', color: '#818cf8' }}>✓ Pre-filled from live market</div>}
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
                <input type="text" value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Lakers -3.5 or LeBron James PTS Over 27.5" style={inputStyle} />
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
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(71, 85, 105, 0.3)', borderRadius: '6px', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" disabled={atLimit || !game || !pick || !odds || !wager} style={{ padding: '8px 16px', background: atLimit ? 'rgba(71, 85, 105, 0.3)' : 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.5)', borderRadius: '6px', color: atLimit ? '#64748b' : '#818cf8', fontSize: '12px', fontWeight: 600, cursor: atLimit ? 'not-allowed' : 'pointer' }}>{atLimit ? 'Free Limit Reached' : 'Add Bet'}</button>
            </div>
          </form>
        </div>
      )}

      {!isPro && <ProBanner />}

      {pendingBets.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#f59e0b', marginBottom: '8px', letterSpacing: '0.5px' }}>PENDING ({pendingBets.length})</div>
          {pendingBets.map(bet => <BetCard key={bet.id} bet={bet} onSettle={settleBet} onDelete={deleteBet} isPending />)}
        </div>
      )}

      {Object.keys(groupedBets).length > 0 ? Object.entries(groupedBets).map(([dateLabel, bets]) => (
        <div key={dateLabel} style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', letterSpacing: '0.5px' }}>{dateLabel}</div>
          {bets.map(bet => <BetCard key={bet.id} bet={bet} onSettle={settleBet} onDelete={deleteBet} />)}
        </div>
      )) : filteredBets.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
          <Trophy size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div style={{ fontSize: '14px', marginBottom: '4px' }}>No bets found</div>
          <div style={{ fontSize: '12px' }}>Try adjusting your filters or add a new bet</div>
        </div>
      ) : null}
    </div>
  );
}

function BetCard({ bet, onSettle, onDelete, isPending }) {
  const statusColors = { pending: '#f59e0b', won: '#22c55e', lost: '#ef4444', push: '#64748b' };
  const clvMeta = getResultMeta(bet.clv?.result);
  const detailRows = [
    { label: 'Entry', line: bet.clv?.entryLine, price: bet.clv?.entryPrice },
    { label: 'Current', line: bet.clv?.currentLine, price: bet.clv?.currentPrice },
    { label: 'Close', line: bet.clv?.closingLine, price: bet.clv?.closingPrice },
  ].filter(row => row.line != null || row.price != null || row.label === 'Entry');

  return (
    <div style={{ ...cardStyle, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc' }}>{bet.game}</span>
            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '4px', color: '#818cf8' }}>{bet.type}</span>
            <span style={{ fontSize: '10px', padding: '3px 7px', borderRadius: '999px', background: clvMeta.bg, color: clvMeta.color, display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>{clvMeta.icon}{clvMeta.label}</span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: bet.clv ? '10px' : 0 }}>{bet.pick} @ {formatOdds(bet.odds)} • ${bet.wager}</div>

          {bet.clv && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: '8px', marginBottom: '8px' }}>
              {detailRows.map(row => (
                <div key={row.label} style={{ background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '8px', padding: '8px' }}>
                  <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>{row.label.toUpperCase()}</div>
                  <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>{row.line != null ? formatLine(row.line) : '—'}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{row.price != null ? formatOdds(row.price) : '—'}</div>
                </div>
              ))}
            </div>
          )}

          {bet.clv && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', padding: '5px 8px', borderRadius: '999px', background: 'rgba(15,23,42,0.45)' }}>
                Move: {bet.clv.lineDelta != null ? formatLineDelta(bet.clv.lineDelta) : '—'} pts
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', padding: '5px 8px', borderRadius: '999px', background: 'rgba(15,23,42,0.45)' }}>
                Price: {bet.clv.priceDelta != null ? `${bet.clv.priceDelta > 0 ? '+' : ''}${bet.clv.priceDelta}` : '—'}
              </div>
              {bet.clv.comparisonLabel && <div style={{ fontSize: '10px', color: '#64748b' }}>{bet.clv.comparisonLabel}{bet.clv.book ? ` • ${bet.clv.book}` : ''}</div>}
            </div>
          )}
        </div>

        <div style={{ textAlign: 'right', minWidth: '110px' }}>
          {isPending ? (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={() => onSettle(bet.id, 'won')} style={{ padding: '6px 12px', background: 'rgba(34, 197, 94, 0.2)', border: '1px solid rgba(34, 197, 94, 0.5)', borderRadius: '6px', color: '#22c55e', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Won</button>
              <button onClick={() => onSettle(bet.id, 'lost')} style={{ padding: '6px 12px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Lost</button>
              <button onClick={() => onSettle(bet.id, 'push')} style={{ padding: '6px 12px', background: 'rgba(100, 116, 139, 0.2)', border: '1px solid rgba(100, 116, 139, 0.5)', borderRadius: '6px', color: '#64748b', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Push</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: bet.profit >= 0 ? '#22c55e' : '#ef4444' }}>{bet.profit > 0 ? '+' : ''}{formatMoney(bet.profit)}</div>
              <div style={{ fontSize: '10px', padding: '2px 6px', background: `rgba(${bet.status === 'won' ? '34, 197, 94' : bet.status === 'lost' ? '239, 68, 68' : '100, 116, 139'}, 0.15)`, borderRadius: '4px', color: statusColors[bet.status], display: 'inline-block' }}>{bet.status.toUpperCase()}</div>
            </div>
          )}

          <button onClick={() => onDelete(bet.id)} style={{ marginLeft: '12px', marginTop: '10px', padding: '6px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
