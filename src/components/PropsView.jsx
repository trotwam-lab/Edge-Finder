import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader, Lock, ChevronDown, ChevronUp, X, Plus, Check, ShoppingCart, ArrowUpDown, Zap } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import BestProps from './BestProps.jsx';
import {
  getBookAbbreviation,
  getMarketDisplayName,
  formatOdds,
  normalizeMarketFilterLabel,
  getSportMeta,
  SPORT_SORT_ORDER,
  buildTeamVisuals,
  getPlayerInitials,
  normalizeTeamKey,
  buildMarketInsights,
  buildPropAlerts,
  getPropTimingState,
} from '../utils/props.js';
import { getSportVisual } from '../utils/team-logos.js';

const FREE_PLAYERS_LIMIT = 3;
const SORT_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'edge', label: 'Best price edge' },
  { value: 'books', label: 'Most books' },
  { value: 'movement', label: 'Strongest movement' },
  { value: 'markets', label: 'Most markets' },
];

function QuickAddModal({ bet, onConfirm, onCancel }) {
  const [wager, setWager] = useState('');
  if (!bet) return null;
  const handleConfirm = () => {
    if (!wager || isNaN(Number(wager)) || Number(wager) <= 0) return;
    onConfirm({ ...bet, wager: Number(wager) });
  };
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={{ background: 'rgb(15,23,42)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px', boxShadow: '0 25px 60px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingCart size={18} color="#818cf8" /></div>
            <div><div style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>Quick Add Bet</div><div style={{ fontSize: '11px', color: '#64748b' }}>Confirm and save to tracker</div></div>
          </div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}><X size={18} /></button>
        </div>
        <div style={{ background: 'rgba(30,41,59,0.7)', borderRadius: '10px', padding: '16px', marginBottom: '20px', border: '1px solid rgba(71,85,105,0.3)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Player', value: bet.player },
              { label: 'Bet Type', value: 'Player Prop' },
              { label: 'Pick', value: bet.pick },
              { label: 'Book', value: bet.book },
              { label: 'Odds', value: formatOdds(bet.odds), color: bet.odds > 0 ? '#22c55e' : '#f8fafc' },
              { label: 'Game', value: bet.game },
            ].map(({ label, value, color }) => <div key={label}><div style={{ fontSize: '10px', color: '#64748b', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div><div style={{ fontSize: '13px', fontWeight: 600, color: color || '#e2e8f0' }}>{value || '—'}</div></div>)}
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>Wager Amount ($)</label>
          <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '8px', padding: '10px 14px', gap: '8px' }}>
            <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 700 }}>$</span>
            <input type="number" min="1" step="1" placeholder="e.g. 25" value={wager} onChange={e => setWager(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); }} autoFocus style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f8fafc', fontSize: '16px', fontWeight: 700, width: '100%', fontFamily: 'JetBrains Mono, monospace' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: '8px', background: 'rgba(71,85,105,0.2)', border: '1px solid rgba(71,85,105,0.3)', color: '#94a3b8', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleConfirm} disabled={!wager || Number(wager) <= 0} style={{ flex: 2, padding: '11px', borderRadius: '8px', background: wager && Number(wager) > 0 ? 'rgba(99,102,241,0.8)' : 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.5)', color: wager && Number(wager) > 0 ? '#fff' : '#64748b', fontSize: '13px', fontWeight: 700, cursor: wager && Number(wager) > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}><Check size={15} />Add to Tracker</button>
        </div>
      </div>
    </div>
  );
}

function TeamBadge({ team }) {
  if (!team) return null;
  return (
    <div title={team.name} style={{ width: 26, height: 26, borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.2)', background: 'rgba(15,23,42,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: '10px', fontWeight: 700 }}>
      {team.logo ? <img src={team.logo} alt={team.name} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : team.initials}
    </div>
  );
}

function PlayerBadge({ name, photo }) {
  return (
    <div style={{ width: 36, height: 36, borderRadius: '999px', background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(14,165,233,0.25))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc', fontWeight: 800, fontSize: '12px', flexShrink: 0, overflow: 'hidden', border: '1px solid rgba(148,163,184,0.15)' }}>
      {photo ? <img src={photo} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : getPlayerInitials(name)}
    </div>
  );
}

function OddsCell({ price, isBest, side, player, marketKey, line, book, game, onQuickAdd }) {
  const [hovered, setHovered] = useState(false);
  const hasPrice = price != null;
  const isOver = side === 'over';
  const baseColor = isOver ? '#22c55e' : '#ef4444';
  const bestBg = isOver ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
  const hoverBg = isOver ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)';
  if (!hasPrice) return <td style={{ padding: '6px 8px', textAlign: 'center', color: '#334155', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}>—</td>;
  const handleClick = () => onQuickAdd({ player, game, book, odds: price, pick: `${player} ${getMarketDisplayName(marketKey)} ${isOver ? `Over ${line}` : `Under ${line}`}`, type: 'Player Prop', date: new Date().toISOString() });
  return (
    <td onClick={handleClick} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} title={`Click to add: ${isOver ? 'Over' : 'Under'} ${line} @ ${formatOdds(price)} (${book})`} style={{ padding: '6px 8px', textAlign: 'center', cursor: 'pointer', borderRadius: '5px', background: hovered ? hoverBg : isBest ? bestBg : 'transparent', transition: 'background 0.12s', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', position: 'relative' }}>
      <span style={{ color: isBest || hovered ? baseColor : '#e2e8f0', fontWeight: isBest || hovered ? 700 : 400 }}>{formatOdds(price)}</span>
      {isBest && !hovered && <span style={{ marginLeft: '2px', fontSize: '9px', color: baseColor }}>★</span>}
      {hovered && <span style={{ marginLeft: '3px', fontSize: '9px', color: baseColor, verticalAlign: 'middle' }}><Plus size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /></span>}
    </td>
  );
}

export default function PropsView({ playerProps, games = [], loading, propHistory, propClosingLines, setPendingBet }) {
  const { tier } = useAuth();
  const [propFilter, setPropFilter] = useState('ALL');
  const [sportFilter, setSportFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('default');
  const [propSearch, setPropSearch] = useState('');
  // Browse All is the primary discovery view — default to it so users land
  // on the full grid of props by sport, then can toggle to Best Props.
  const [viewMode, setViewMode] = useState('all');
  const [expandedPlayers, setExpandedPlayers] = useState(new Set());
  const [pendingModal, setPendingModal] = useState(null);
  const [logoMap, setLogoMap] = useState({});
  const [teamIndexMap, setTeamIndexMap] = useState({});
  const [playerHeadshots, setPlayerHeadshots] = useState({});

  useEffect(() => {
    const sports = Array.from(new Set(playerProps.map(prop => prop.sport).filter(Boolean)));
    sports.forEach(async (sport) => {
      const meta = getSportMeta(sport);
      if (!meta.espnPath || (logoMap[sport] && teamIndexMap[sport])) return;
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${meta.espnPath}/teams`);
        if (!res.ok) return;
        const data = await res.json();
        const teams = data?.sports?.[0]?.leagues?.[0]?.teams || [];
        const nextLogos = {};
        const nextTeams = {};
        teams.forEach(entry => {
          const team = entry.team;
          if (!team?.id) return;
          const logo = team.logos?.[0]?.href || (team.abbreviation && meta.logoSport ? `https://a.espncdn.com/i/teamlogos/${meta.logoSport}/500/${team.abbreviation.toLowerCase()}.png` : null);
          [team.displayName, team.shortDisplayName, team.location, team.name, team.abbreviation].filter(Boolean).forEach(name => {
            const key = normalizeTeamKey(name);
            nextLogos[key] = logo;
            nextTeams[key] = { id: team.id, abbreviation: team.abbreviation, sport };
          });
        });
        setLogoMap(prev => ({ ...prev, [sport]: nextLogos }));
        setTeamIndexMap(prev => ({ ...prev, [sport]: nextTeams }));
      } catch {}
    });
  }, [playerProps, logoMap, teamIndexMap]);

  useEffect(() => {
    const rosterTargets = [];
    const seen = new Set();
    playerProps.forEach(prop => {
      const sportTeams = teamIndexMap[prop.sport] || {};
      const teams = String(prop.game || '').split(' @ ').map(name => name.trim()).filter(Boolean);
      teams.forEach(teamName => {
        const match = sportTeams[normalizeTeamKey(teamName)];
        if (!match) return;
        const key = `${prop.sport}::${match.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        rosterTargets.push({ sport: prop.sport, teamId: match.id, espnPath: getSportMeta(prop.sport).espnPath });
      });
    });

    rosterTargets.forEach(async ({ sport, teamId, espnPath }) => {
      try {
        const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${espnPath}/teams/${teamId}/roster`);
        if (!res.ok) return;
        const data = await res.json();
        const athletes = [
          ...(data?.athletes || []),
          ...((data?.athletes || []).flatMap(group => group?.items || [])),
        ];
        if (!athletes.length) return;
        setPlayerHeadshots(prev => {
          const next = { ...prev };
          athletes.forEach(athlete => {
            const person = athlete?.athlete || athlete;
            const displayName = person?.displayName || person?.fullName;
            const headshot = person?.headshot?.href || person?.image?.href || null;
            if (!displayName || !headshot) return;
            next[`${sport}::${String(displayName).toLowerCase()}`] = headshot;
          });
          return next;
        });
      } catch {}
    });
  }, [playerProps, teamIndexMap]);

  const gameStatusMap = useMemo(() => {
    const map = {};
    games.forEach(game => {
      if (!game?.id) return;
      const started = !!game.commence_time && Date.parse(game.commence_time) <= Date.now();
      map[game.id] = {
        started,
        completed: !!game.completed,
        live: started && !game.completed,
        commenceTime: game.commence_time || null,
      };
    });
    return map;
  }, [games]);

  const players = useMemo(() => {
    const map = {};
    playerProps.forEach(prop => {
      const sport = prop.sport || 'unknown';
      const pk = `${sport}::${prop.player}`;
      if (!prop.player) return;
      if (!map[pk]) map[pk] = { key: pk, sport, sportMeta: getSportMeta(sport), name: prop.player, game: prop.game, gameId: prop.gameId, commenceTime: prop.commence_time, markets: {} };
      const mk = prop.market;
      if (!map[pk].markets[mk]) map[pk].markets[mk] = { line: null, over: {}, under: {}, books: new Set(), _lineVotes: {}, _overByLine: {}, _underByLine: {}, historyKeys: { over: {}, under: {} } };
      const mkt = map[pk].markets[mk];
      const book = prop.book || prop.bookTitle || prop.bookKey || 'Unknown';
      mkt.books.add(book);
      if (prop.line != null) mkt._lineVotes[prop.line] = (mkt._lineVotes[prop.line] || 0) + 1;
      if (prop.outcome === 'Over') {
        if (!mkt._overByLine[book]) mkt._overByLine[book] = {};
        if (prop.line != null) mkt._overByLine[book][prop.line] = prop.price;
        mkt.historyKeys.over[book] = [prop.sport, prop.gameId, prop.player, prop.market, prop.outcome, book].join('::');
      } else if (prop.outcome === 'Under') {
        if (!mkt._underByLine[book]) mkt._underByLine[book] = {};
        if (prop.line != null) mkt._underByLine[book][prop.line] = prop.price;
        mkt.historyKeys.under[book] = [prop.sport, prop.gameId, prop.player, prop.market, prop.outcome, book].join('::');
      }
    });

    return Object.values(map).map(player => {
      Object.entries(player.markets).forEach(([marketKey, mkt]) => {
        const votes = mkt._lineVotes || {};
        let consensusLine = null; let maxVotes = 0;
        Object.entries(votes).forEach(([line, count]) => { if (count > maxVotes || (count === maxVotes && consensusLine !== null && Number(line) < Number(consensusLine))) { maxVotes = count; consensusLine = Number(line); } });
        mkt.line = consensusLine;
        mkt.bookList = Array.from(mkt.books).sort();
        mkt.bookList.forEach(book => {
          const overByLine = mkt._overByLine?.[book] || {};
          const underByLine = mkt._underByLine?.[book] || {};
          if (consensusLine != null && overByLine[consensusLine] != null) mkt.over[book] = overByLine[consensusLine];
          else {
            const lines = Object.keys(overByLine).map(Number);
            if (lines.length) {
              const closest = lines.reduce((a, b) => Math.abs(b - (consensusLine || 0)) < Math.abs(a - (consensusLine || 0)) ? b : a);
              mkt.over[book] = overByLine[closest];
            }
          }
          if (consensusLine != null && underByLine[consensusLine] != null) mkt.under[book] = underByLine[consensusLine];
          else {
            const lines = Object.keys(underByLine).map(Number);
            if (lines.length) {
              const closest = lines.reduce((a, b) => Math.abs(b - (consensusLine || 0)) < Math.abs(a - (consensusLine || 0)) ? b : a);
              mkt.under[book] = underByLine[closest];
            }
          }
        });
        mkt.insights = buildMarketInsights(mkt, propHistory);
        mkt.sortScore = mkt.insights.sortEdge > -999 ? mkt.insights.sortEdge : -999;
        mkt.marketKey = marketKey;
      });
      const marketEntries = Object.values(player.markets);
      const topMarket = marketEntries.sort((a, b) => (b.insights.sortEdge - a.insights.sortEdge) || (b.insights.sortBooks - a.insights.sortBooks))[0];
      player.timing = getPropTimingState({ gameStatus: gameStatusMap[player.gameId], commenceTime: player.commenceTime });
      player.visuals = buildTeamVisuals(player.game, player.sport, logoMap);
      player.playerBadge = getPlayerInitials(player.name);
      player.photo = playerHeadshots[`${player.sport}::${String(player.name).toLowerCase()}`] || null;
      player.topInsight = topMarket?.insights || null;
      player.summaryMetrics = {
        markets: Object.keys(player.markets).length,
        books: Math.max(0, ...marketEntries.map(m => m.insights.sortBooks || 0)),
        edge: Math.max(-999, ...marketEntries.map(m => m.insights.sortEdge || -999)),
        movement: Math.max(0, ...marketEntries.map(m => m.insights.sortMovement || 0)),
      };
      return player;
    }).sort((a, b) => {
      const aIndex = SPORT_SORT_ORDER.indexOf(a.sport);
      const bIndex = SPORT_SORT_ORDER.indexOf(b.sport);
      if (aIndex !== bIndex) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return Object.keys(b.markets).length - Object.keys(a.markets).length;
    });
  }, [playerProps, propHistory, logoMap, playerHeadshots, gameStatusMap]);

  const propAlerts = useMemo(() => buildPropAlerts(players, propHistory, propClosingLines), [players, propHistory, propClosingLines]);

  const marketFilterOptions = useMemo(() => ['ALL', ...Array.from(new Map(playerProps.filter(p => p.market).map(p => [p.market, (playerProps.filter(x => x.market === p.market).length)])).entries()).sort((a, b) => b[1] - a[1] || getMarketDisplayName(a[0]).localeCompare(getMarketDisplayName(b[0]))).map(([market]) => market)], [playerProps]);

  const sportOptions = useMemo(() => ['ALL', ...Array.from(new Set(playerProps.map(prop => prop.sport).filter(Boolean))).sort((a, b) => {
    const aIndex = SPORT_SORT_ORDER.indexOf(a); const bIndex = SPORT_SORT_ORDER.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1; if (bIndex === -1) return -1; return aIndex - bIndex;
  })], [playerProps]);

  const filteredPlayers = useMemo(() => {
    let filtered = players;
    if (sportFilter !== 'ALL') filtered = filtered.filter(player => player.sport === sportFilter);
    if (propSearch) {
      const s = propSearch.toLowerCase();
      filtered = filtered.filter(player => player.name?.toLowerCase().includes(s) || player.game?.toLowerCase().includes(s) || player.sportMeta.label.toLowerCase().includes(s));
    }
    if (propFilter !== 'ALL') filtered = filtered.filter(player => player.markets[propFilter]);
    const sorted = [...filtered];
    if (sortBy === 'edge') sorted.sort((a, b) => b.summaryMetrics.edge - a.summaryMetrics.edge || b.summaryMetrics.books - a.summaryMetrics.books);
    else if (sortBy === 'books') sorted.sort((a, b) => b.summaryMetrics.books - a.summaryMetrics.books || b.summaryMetrics.markets - a.summaryMetrics.markets);
    else if (sortBy === 'movement') sorted.sort((a, b) => b.summaryMetrics.movement - a.summaryMetrics.movement || b.summaryMetrics.edge - a.summaryMetrics.edge);
    else if (sortBy === 'markets') sorted.sort((a, b) => b.summaryMetrics.markets - a.summaryMetrics.markets || b.summaryMetrics.books - a.summaryMetrics.books);
    return sorted;
  }, [players, propSearch, propFilter, sportFilter, sortBy]);

  const playersBySport = useMemo(() => filteredPlayers.reduce((acc, player) => { if (!acc[player.sport]) acc[player.sport] = []; acc[player.sport].push(player); return acc; }, {}), [filteredPlayers]);
  const toggleExpand = key => setExpandedPlayers(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next; });
  const stats = useMemo(() => ({ totalPlayers: players.length, totalProps: playerProps.length, totalSports: Object.keys(playersBySport).length, topMarketLabel: marketFilterOptions[1] && marketFilterOptions[1] !== 'ALL' ? getMarketDisplayName(marketFilterOptions[1]) : '—', hockeyProps: playerProps.filter(p => p.sport === 'icehockey_nhl').length }), [players, playerProps, playersBySport, marketFilterOptions]);
  const handleConfirm = (betWithWager) => { if (setPendingBet) setPendingBet({ game: betWithWager.game || betWithWager.player, type: 'Player Prop', pick: betWithWager.pick, odds: betWithWager.odds, wager: betWithWager.wager, date: betWithWager.date || new Date().toISOString() }); setPendingModal(null); };

  if (loading) return <div style={{ padding: '20px 24px', textAlign: 'center', paddingTop: '60px' }}><Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} /><p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading player props...</p></div>;

  return (<>
    {pendingModal && <QuickAddModal bet={pendingModal} onConfirm={handleConfirm} onCancel={() => setPendingModal(null)} />}
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {tier === 'pro' ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '8px', flex: '1', minWidth: '200px' }}><Search size={14} color="#64748b" /><input type="text" placeholder="Search player, team, or sport..." value={propSearch} onChange={e => setPropSearch(e.target.value)} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#e2e8f0', fontSize: '13px', width: '100%', fontFamily: 'JetBrains Mono, monospace' }} /></div> : <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: 'rgba(30,41,59,0.3)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '8px', flex: '1', minWidth: '200px', opacity: 0.6 }}><Lock size={14} color="#64748b" /><span style={{ color: '#64748b', fontSize: '13px' }}>Search (Pro only)</span></div>}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{sportOptions.map(sport => {
          const meta = getSportMeta(sport);
          const active = sportFilter === sport;
          const accent = sport === 'ALL' ? '#6366f1' : getSportVisual(sport).color;
          return (
            <button key={sport} onClick={() => setSportFilter(sport)} style={{
              padding: '8px 12px',
              background: active ? `${accent}30` : 'rgba(30,41,59,0.4)',
              border: active ? `1px solid ${accent}80` : '1px solid rgba(71,85,105,0.3)',
              borderLeft: active ? `3px solid ${accent}` : '1px solid rgba(71,85,105,0.3)',
              borderRadius: '6px',
              color: active ? '#f8fafc' : '#94a3b8',
              fontSize: '11px', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'JetBrains Mono, monospace',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              {sport === 'ALL' ? 'ALL SPORTS' : <><span>{meta.icon}</span><span>{meta.label}</span></>}
            </button>
          );
        })}</div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '18px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>{marketFilterOptions.map(type => { const active = propFilter === type; return <button key={type} onClick={() => setPropFilter(type)} style={{ padding: '8px 12px', background: active ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.4)', border: active ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(71,85,105,0.3)', borderRadius: '6px', color: active ? '#f8fafc' : '#94a3b8', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-line' }}>{type === 'ALL' ? 'ALL MARKETS' : normalizeMarketFilterLabel(type)}</button>; })}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '8px' }}><ArrowUpDown size={14} color="#94a3b8" /><select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ background: 'transparent', color: '#e2e8f0', border: 'none', outline: 'none', fontSize: '12px' }}>{SORT_OPTIONS.map(option => <option key={option.value} value={option.value} style={{ color: '#0f172a' }}>{option.label}</option>)}</select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '12px', marginBottom: '20px' }}>{[
        { label: 'Players', value: stats.totalPlayers, color: '#06b6d4' },
        { label: 'Total Lines', value: stats.totalProps, color: '#6366f1' },
        { label: 'Sports', value: stats.totalSports, color: '#f97316' },
        { label: 'NHL Lines', value: stats.hockeyProps, color: '#22c55e' },
        { label: 'Top Market', value: stats.topMarketLabel, color: '#3b82f6' },
      ].map((stat, i) => <div key={i} style={{ padding: '14px', background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '10px' }}><div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px', fontFamily: 'JetBrains Mono, monospace' }}>{stat.label}</div><div style={{ fontSize: stat.label === 'Top Market' ? '15px' : '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div></div>)}</div>

      {/* View mode toggle — Browse All listed first so it is the primary view */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', padding: '4px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '10px', width: 'fit-content' }}>
        <button onClick={() => setViewMode('all')} style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s', background: viewMode === 'all' ? 'rgba(99,102,241,0.18)' : 'transparent', border: viewMode === 'all' ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent', color: viewMode === 'all' ? '#818cf8' : '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>Browse All</button>
        <button onClick={() => setViewMode('best')} style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.12s', background: viewMode === 'best' ? 'rgba(251,191,36,0.18)' : 'transparent', border: viewMode === 'best' ? '1px solid rgba(251,191,36,0.4)' : '1px solid transparent', color: viewMode === 'best' ? '#fbbf24' : '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>⚡ Best Props</button>
      </div>

      {/* Best Props view */}
      {viewMode === 'best' && <BestProps players={players} setPendingBet={setPendingModal} />}

      {/* Browse All view */}
      {viewMode === 'all' && <>
      {propAlerts.length > 0 && <div style={{ marginBottom: '16px', padding: '14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: '10px' }}><div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#facc15', fontSize: '12px', fontWeight: 700 }}><Zap size={14} />Prop alerts</div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>{propAlerts.slice(0, 4).map(alert => <div key={alert.id} style={{ padding: '10px', background: 'rgba(15,23,42,0.45)', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.25)' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}><div style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: 700 }}>{alert.title}</div><div style={{ fontSize: '10px', color: '#facc15' }}>{alert.metricDisplay}</div></div><div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '4px' }}>{alert.edge}</div><div style={{ fontSize: '10px', color: '#64748b' }}>{alert.note}</div></div>)}</div></div>}
      {filteredPlayers.length > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', marginBottom: '16px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '8px', fontSize: '11px', color: '#818cf8' }}><ShoppingCart size={13} />Click any odds cell to quick-add to your Bet Tracker</div>}
      {filteredPlayers.length === 0 ? <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>No props available. Props load for upcoming games only.</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>{Object.entries(playersBySport).map(([sport, sportPlayers]) => {
        const meta = getSportMeta(sport);
        const visual = getSportVisual(sport);
        const visiblePlayers = tier === 'pro' ? sportPlayers : sportPlayers.slice(0, FREE_PLAYERS_LIMIT);
        return <div key={sport}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '8px 14px', borderRadius: '999px',
              background: `${visual.color}18`,
              border: `1px solid ${visual.color}55`,
            }}>
              <span style={{ fontSize: '16px' }}>{meta.icon}</span>
              <span style={{ fontSize: '12px', color: visual.color, fontWeight: 800, letterSpacing: '0.5px' }}>{meta.label}</span>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>{sportPlayers.length} player{sportPlayers.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${visual.color}55, transparent)` }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>{visiblePlayers.map(player => {
            const isExpanded = expandedPlayers.has(player.key);
            const marketKeys = Object.keys(player.markets);
            const visibleMarkets = propFilter === 'ALL' ? marketKeys : marketKeys.filter(k => k === propFilter);
            return <div key={player.key} style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderLeft: `3px solid ${visual.color}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div onClick={() => toggleExpand(player.key)} style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.08)' : 'transparent', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <PlayerBadge name={player.name} photo={player.photo} />
                  <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: '14px', color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{player.name}</div><div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}><div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TeamBadge team={player.visuals.away} /><span>@</span><TeamBadge team={player.visuals.home} /></div><span>{player.game}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 8px', borderRadius: '999px', background: player.timing.background, border: `1px solid ${player.timing.border}`, color: player.timing.color, fontSize: '10px', fontWeight: 800, letterSpacing: '0.04em' }}><span>{player.timing.label}</span><span style={{ color: '#cbd5e1', fontWeight: 600, letterSpacing: 0 }}>{player.timing.detail}</span></span></div></div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                  {player.topInsight && <><span style={{ fontSize: '10px', color: '#cbd5e1', background: 'rgba(51,65,85,0.65)', padding: '4px 8px', borderRadius: '999px' }}>{player.topInsight.recommendation}</span><span style={{ fontSize: '10px', color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '4px 8px', borderRadius: '999px' }}>{player.summaryMetrics.edge > -999 ? `${player.summaryMetrics.edge > 0 ? '+' : ''}${Math.round(player.summaryMetrics.edge)} edge` : 'No price read'}</span><span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(71,85,105,0.3)', padding: '4px 8px', borderRadius: '999px' }}>{player.summaryMetrics.books} books</span></>}
                  {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                </div>
              </div>
              {isExpanded && <div style={{ padding: '0 16px 16px' }}>{visibleMarkets.map(marketKey => {
                const mkt = player.markets[marketKey];
                const books = mkt.bookList || [];
                const overPrices = Object.values(mkt.over).filter(p => p != null);
                const underPrices = Object.values(mkt.under).filter(p => p != null);
                const bestOver = overPrices.length ? Math.max(...overPrices) : null;
                const bestUnder = underPrices.length ? Math.max(...underPrices) : null;
                return <div key={marketKey} style={{ marginTop: '12px', padding: '12px', background: 'rgba(15,23,42,0.4)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}><span style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0', fontFamily: 'JetBrains Mono, monospace' }}>{getMarketDisplayName(marketKey)}</span>{mkt.line != null && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Consensus O/U {mkt.line}</span>}<span style={{ fontSize: '10px', color: '#64748b' }}>{books.length} book{books.length !== 1 ? 's' : ''}</span><span style={{ marginLeft: 'auto', fontSize: '9px', color: '#6366f1', background: 'rgba(99,102,241,0.12)', padding: '2px 6px', borderRadius: '4px' }}>tap odds to add</span></div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(30,41,59,0.65)', border: '1px solid rgba(71,85,105,0.25)' }}><div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Market read</div><div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>{mkt.insights.summary}</div>{mkt.insights.details.map((detail, idx) => <div key={idx} style={{ fontSize: '10px', color: '#94a3b8', marginTop: '5px' }}>{detail}</div>)}</div>
                    <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(30,41,59,0.65)', border: '1px solid rgba(71,85,105,0.25)' }}><div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Best numbers</div><div style={{ fontSize: '11px', color: '#22c55e' }}>Over: {mkt.insights.bestOverBook ? `${getBookAbbreviation(mkt.insights.bestOverBook)} ${formatOdds(mkt.insights.bestOver)}` : '—'}</div><div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>Under: {mkt.insights.bestUnderBook ? `${getBookAbbreviation(mkt.insights.bestUnderBook)} ${formatOdds(mkt.insights.bestUnder)}` : '—'}</div><div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>Disagreement: {mkt.insights.lineRange ? `${mkt.insights.lineRange.toFixed(1)} pts` : 'same number market-wide'}</div></div>
                    <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(30,41,59,0.65)', border: '1px solid rgba(71,85,105,0.25)' }}><div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>Trade desk</div><div style={{ fontSize: '11px', color: '#e2e8f0' }}>Status: <span style={{ color: mkt.insights.recommendation === 'Playable' ? '#22c55e' : mkt.insights.recommendation === 'Monitor' ? '#f59e0b' : '#94a3b8' }}>{mkt.insights.recommendation}</span></div><div style={{ fontSize: '11px', color: '#e2e8f0', marginTop: '4px' }}>Fair: O {mkt.insights.fairOverPrice != null ? formatOdds(mkt.insights.fairOverPrice) : '—'} / U {mkt.insights.fairUnderPrice != null ? formatOdds(mkt.insights.fairUnderPrice) : '—'}</div>{mkt.insights.strongestMove && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>Movement: {getBookAbbreviation(mkt.insights.strongestMove.book)} {mkt.insights.strongestMove.side} {mkt.insights.strongestMove.lineChange > 0 ? '+' : ''}{mkt.insights.strongestMove.lineChange}</div>}</div>
                  </div>
                  <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'JetBrains Mono, monospace' }}><thead><tr><td style={{ padding: '4px 8px', color: '#64748b', fontWeight: 600, width: '56px' }}>Side</td>{books.map(book => <td key={book} style={{ padding: '4px 8px', color: '#64748b', textAlign: 'center', minWidth: '52px' }}>{getBookAbbreviation(book)}</td>)}</tr></thead><tbody><tr><td style={{ padding: '6px 8px', color: '#22c55e', fontWeight: 700 }}>Over</td>{books.map(book => <OddsCell key={book} price={mkt.over[book]} isBest={mkt.over[book] != null && mkt.over[book] === bestOver} side="over" player={player.name} marketKey={marketKey} line={mkt.line} book={book} game={player.game} onQuickAdd={setPendingModal} />)}</tr><tr><td style={{ padding: '6px 8px', color: '#ef4444', fontWeight: 700 }}>Under</td>{books.map(book => <OddsCell key={book} price={mkt.under[book]} isBest={mkt.under[book] != null && mkt.under[book] === bestUnder} side="under" player={player.name} marketKey={marketKey} line={mkt.line} book={book} game={player.game} onQuickAdd={setPendingModal} />)}</tr></tbody></table></div>
                </div>; })}</div>}
            </div>; })}
            {tier === 'free' && sportPlayers.length > FREE_PLAYERS_LIMIT && <><div style={{ position: 'relative', marginTop: '8px' }}><div style={{ display: 'flex', flexDirection: 'column', gap: '12px', filter: 'blur(6px)', opacity: 0.4, pointerEvents: 'none' }}>{sportPlayers.slice(FREE_PLAYERS_LIMIT, FREE_PLAYERS_LIMIT + 2).map(p => <div key={p.key} style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.3)', borderRadius: '12px' }}><div style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>{p.name}</div><div style={{ fontSize: '11px', color: '#64748b' }}>{Object.keys(p.markets).length} markets</div></div>)}</div><div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.6)', borderRadius: '12px' }}><Lock size={28} color="#818cf8" style={{ marginBottom: '12px' }} /><div style={{ fontSize: '14px', fontWeight: 700, color: '#e2e8f0', marginBottom: '4px' }}>+{sportPlayers.length - FREE_PLAYERS_LIMIT} more players locked</div><div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>Upgrade to Pro for all player props</div></div></div><div style={{ marginTop: '8px' }}><ProBanner /></div></>}
          </div></div>;
      })}</div>}
      </>}
    </div>
  </>);
}
