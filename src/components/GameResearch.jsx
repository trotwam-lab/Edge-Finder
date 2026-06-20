import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, History, TrendingUp, AlertCircle, RefreshCw, CheckCircle, BarChart3, CloudSun, UserRound } from 'lucide-react';

function getTrendColor(confidence) {
  return confidence === 'high' ? '#22c55e' : confidence === 'medium' ? '#eab308' : '#64748b';
}
function getTrendBg(confidence) {
  return confidence === 'high' ? 'rgba(34,197,94,0.12)' : confidence === 'medium' ? 'rgba(234,179,8,0.12)' : 'rgba(100,116,139,0.12)';
}

function pillStyle() {
  return {
    fontSize: '10px',
    color: '#94a3b8',
    background: 'rgba(30,41,59,0.5)',
    padding: '4px 10px',
    borderRadius: '5px',
  };
}

function normalizeTeamData(data, side) {
  if (!data) return null;

  if (data.sport === 'baseball_mlb') {
    const src = data.offensiveForm?.[side];
    const games = src?.games || [];
    const [wins, losses] = (src?.summary?.record || '0-0').split('-').map((n) => parseInt(n, 10) || 0);
    return {
      wins,
      losses,
      streak: null,
      badges: [
        src?.summary?.avgRunsScored != null ? `Runs ${src.summary.avgRunsScored}/G` : null,
        src?.seasonStats?.battingAverage ? `AVG ${src.seasonStats.battingAverage}` : null,
        src?.seasonStats?.onBasePct ? `OBP ${src.seasonStats.onBasePct}` : null,
      ].filter(Boolean),
      recentGames: games.map((g) => ({
        won: !!g.won,
        isHome: !!g.isHome,
        opponentAbbr: g.opponentAbbr || g.opponent,
        teamScore: g.runsScored,
        opponentScore: g.runsAllowed,
      })),
    };
  }

  if (data.sport === 'basketball_nba') {
    const src = data[side];
    const games = src?.form?.lastGames || [];
    return {
      wins: src?.form?.record?.wins || 0,
      losses: src?.form?.record?.losses || 0,
      streak: src?.form?.streak,
      badges: [
        src?.rest?.note,
        src?.injuries?.note && src.injuries.note !== 'No injury data source configured' ? src.injuries.note : null,
        src?.ats?.note && src.ats.note !== 'No historical odds data source configured' ? src.ats.note : null,
      ].filter(Boolean),
      recentGames: games.map((g) => ({
        won: g.result === 'W',
        isHome: g.location === 'home',
        opponentAbbr: g.opponent,
        teamScore: g.pts,
        opponentScore: g.oppPts,
      })),
    };
  }

  if (data.sport === 'icehockey_nhl') {
    const src = data[side];
    const games = src?.recentGames || [];
    const wins = games.filter((g) => g.result === 'W').length;
    const losses = games.filter((g) => g.result === 'L').length;
    return {
      wins,
      losses,
      streak: null,
      badges: [
        src?.rest?.isBackToBack ? 'Back-to-back' : null,
        src?.rest?.homeAwayFatigue,
        src?.goalie?.likelyStarter?.name ? `G ${src.goalie.likelyStarter.name}` : null,
      ].filter(Boolean),
      recentGames: games.map((g) => ({
        won: g.result === 'W',
        isHome: null,
        opponentAbbr: g.opponent,
        teamScore: g.score,
        opponentScore: g.opponentScore,
      })),
    };
  }

  return data.teams?.[side] || null;
}

function normalizeTrends(data) {
  const raw = data?.trends || data?.matchup?.trends || [];
  return raw.map((t) => {
    if (t.label || t.description) return t;
    const text = t.text || '';
    return {
      ...t,
      label: t.category ? t.category.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()) : 'Trend',
      description: text,
      icon: t.icon || '📊',
    };
  });
}

function Last10Row({ teamData, label }) {
  if (!teamData) {
    return <div style={{ padding: '10px 0', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>No data for {label}</div>;
  }

  const { wins = 0, losses = 0, streak, badges = [], recentGames = [] } = teamData;
  const total = wins + losses;
  const winPct = total > 0 ? wins / total : 0;
  const wColor = winPct >= 0.6 ? '#22c55e' : winPct < 0.4 ? '#ef4444' : '#eab308';
  const wBg = winPct >= 0.6 ? 'rgba(34,197,94,0.15)' : winPct < 0.4 ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)';

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(71,85,105,0.15)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', gap: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{label}</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ padding: '3px 10px', borderRadius: '6px', background: wBg, color: wColor, fontSize: '12px', fontWeight: 700 }}>
            {wins}-{losses}
          </div>
          {streak && streak !== '-' && streak !== 'N/A' && (
            <div style={{
              padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
              background: streak.includes('W') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: streak.includes('W') ? '#22c55e' : '#ef4444',
            }}>
              {streak}
            </div>
          )}
        </div>
      </div>

      {badges.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {badges.map((badge, i) => <div key={i} style={pillStyle()}>{badge}</div>)}
        </div>
      )}

      {recentGames.length > 0 ? (
        <div style={{ display: 'flex', gap: '3px' }}>
          {recentGames.slice(0, 10).map((g, idx) => (
            <div
              key={idx}
              title={`${g.isHome === null ? '' : g.isHome ? 'vs ' : '@ '}${g.opponentAbbr}: ${g.teamScore}-${g.opponentScore}`}
              style={{
                flex: 1,
                height: '32px',
                borderRadius: '5px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: g.won ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                color: g.won ? '#22c55e' : '#ef4444',
                fontSize: '10px',
                fontWeight: 700,
                cursor: 'default',
              }}
            >
              {g.won ? 'W' : 'L'}
              <span style={{ fontSize: '7px', fontWeight: 400, opacity: 0.75, marginTop: '1px' }}>
                {g.isHome === null ? '' : g.isHome ? 'vs' : '@'}{String(g.opponentAbbr || '').slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '11px', color: '#64748b' }}>No recent games found</div>
      )}
    </div>
  );
}

function H2HPanel({ games, homeTeam, awayTeam }) {
  if (!games || games.length === 0) {
    return <div style={{ padding: '12px 16px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>No recent head-to-head matchups found</div>;
  }
  const homeLast = homeTeam?.split(' ').pop();
  const awayLast = awayTeam?.split(' ').pop();

  let homeW = 0, awayW = 0;
  games.forEach(g => {
    const hs = parseInt(g.homeScore) || 0, as = parseInt(g.awayScore) || 0;
    const isHomeTeamHome = g.homeTeam?.includes(homeLast);
    if (hs > as) isHomeTeamHome ? homeW++ : awayW++;
    else isHomeTeamHome ? awayW++ : homeW++;
  });

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '10px', fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
        <span>{homeLast} {homeW}</span>
        <span style={{ color: '#64748b', fontWeight: 400 }}>–</span>
        <span>{awayW} {awayLast}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {games.map((g, i) => {
          const hs = parseInt(g.homeScore) || 0, as = parseInt(g.awayScore) || 0;
          const d = new Date(g.date);
          return (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', background: 'rgba(30,41,59,0.4)', borderRadius: '6px', fontSize: '11px' }}>
              <span style={{ color: '#64748b', minWidth: '52px' }}>{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 600 }}>
                {g.awayTeam?.split(' ').pop()} {as} – {hs} {g.homeTeam?.split(' ').pop()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendsPanel({ trends }) {
  if (!trends || trends.length === 0) {
    return <div style={{ padding: '12px 16px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>No trend flags yet</div>;
  }
  return (
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {trends.map((t, i) => (
        <div key={i} style={{ padding: '9px 12px', borderRadius: '8px', background: getTrendBg(t.confidence), border: `1px solid ${getTrendColor(t.confidence)}28`, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>{t.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: getTrendColor(t.confidence) }}>{t.label}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{t.description}</div>
          </div>
          <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', background: getTrendColor(t.confidence) + '22', color: getTrendColor(t.confidence) }}>{t.confidence}</span>
        </div>
      ))}
    </div>
  );
}

function PlayerAvatar({ player, label }) {
  const [fallback, setFallback] = useState(!player?.headshot);

  useEffect(() => {
    setFallback(!player?.headshot);
  }, [player?.headshot]);

  const initials = String(player?.name || label || '—')
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—';

  return (
    <div style={{ width: 42, height: 42, borderRadius: '999px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.22)', background: 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(14,165,233,0.22))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f8fafc', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}>
      {fallback || !player?.headshot
        ? initials
        : <img src={player.headshot} alt={player.name || label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setFallback(true)} />}
    </div>
  );
}

function baseballInningsToOuts(ip) {
  const text = String(ip || '0');
  const [whole, frac = '0'] = text.split('.');
  return (parseInt(whole, 10) || 0) * 3 + (parseInt(frac, 10) || 0);
}

function outsToBaseballInnings(outs) {
  if (!outs) return '0.0';
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function pitcherStats(player) {
  const starts = player?.last3Starts || [];
  if (starts.length > 0) {
    const outs = starts.reduce((sum, s) => sum + baseballInningsToOuts(s.inningsPitched), 0);
    const er = starts.reduce((sum, s) => sum + (parseInt(s.earnedRuns, 10) || 0), 0);
    const hits = starts.reduce((sum, s) => sum + (parseInt(s.hits, 10) || 0), 0);
    const walks = starts.reduce((sum, s) => sum + (parseInt(s.walks, 10) || 0), 0);
    const ks = starts.reduce((sum, s) => sum + (parseInt(s.strikeouts, 10) || 0), 0);
    const innings = outs / 3;
    return [
      `L${starts.length}: ${outsToBaseballInnings(outs)} IP`,
      innings ? `${((er * 9) / innings).toFixed(2)} ERA` : null,
      innings ? `${((hits + walks) / innings).toFixed(2)} WHIP` : null,
      `${ks} K`,
    ].filter(Boolean);
  }
  if (player?.lastStart) {
    return [
      `Last: ${player.lastStart.innings || '—'} IP`,
      player.lastStart.earnedRuns != null ? `${player.lastStart.earnedRuns} ER` : null,
      player.lastStart.opponent ? `vs ${String(player.lastStart.opponent).split(' ').pop()}` : null,
    ].filter(Boolean);
  }
  return [player?.era != null ? `${player.era} ERA` : null, player?.whip != null ? `${player.whip} WHIP` : null].filter(Boolean);
}

function goalieStats(goalieProfile) {
  const starts = goalieProfile?.last3Starts || [];
  if (starts.length > 0) {
    const saves = starts.reduce((sum, s) => sum + (parseInt(s.saves, 10) || 0), 0);
    const shots = starts.reduce((sum, s) => sum + (parseInt(s.shotsFaced, 10) || 0), 0);
    const ga = starts.reduce((sum, s) => sum + (parseInt(s.goalsAllowed, 10) || 0), 0);
    return [
      `L${starts.length}: ${shots ? (saves / shots).toFixed(3) : '—'} SV%`,
      `${(ga / starts.length).toFixed(1)} GA/G`,
      `${(saves / starts.length).toFixed(1)} saves/G`,
    ];
  }
  return [goalieProfile?.savePercentage ? `${goalieProfile.savePercentage} SV%` : null, goalieProfile?.goalsAgainstAverage ? `${goalieProfile.goalsAgainstAverage} GAA` : null].filter(Boolean);
}

function PlayerCard({ title, player, emptyText, detail, stats = [], badge = null }) {
  return (
    <div style={{ background: 'rgba(30,41,59,0.35)', borderRadius: '8px', padding: '10px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
      <PlayerAvatar player={player} label={title} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', color: '#cbd5e1', fontSize: '11px', fontWeight: 700 }}><UserRound size={12} /> {title}{badge}</div>
        <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{player?.name || emptyText}</div>
        <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>{detail || 'No player data available'}</div>
        {stats.length > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '7px' }}>
            {stats.map((stat, i) => <span key={i} style={{ fontSize: '9px', color: '#cbd5e1', background: 'rgba(15,23,42,0.55)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: '999px', padding: '2px 6px' }}>{stat}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function rotoConfBadge(confirmed) {
  return (
    <span style={{
      fontSize: '8px', fontWeight: 800, letterSpacing: '0.04em', padding: '1px 5px', borderRadius: '4px',
      background: confirmed ? 'rgba(34,197,94,0.16)' : 'rgba(100,116,139,0.18)',
      color: confirmed ? '#22c55e' : '#94a3b8',
    }}>{confirmed ? 'CONFIRMED' : 'PROJ'}</span>
  );
}

function LineupColumn({ title, players }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      {players?.length ? players.map((p, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'baseline', fontSize: '10px', color: '#cbd5e1', padding: '2px 0' }}>
          <span style={{ color: '#64748b', width: '10px', flexShrink: 0 }}>{i + 1}</span>
          <span style={{ color: '#64748b', width: '22px', flexShrink: 0 }}>{p.pos || ''}</span>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
        </div>
      )) : <div style={{ fontSize: '10px', color: '#64748b' }}>Not posted</div>}
    </div>
  );
}

function BaseballExtras({ data }) {
  if (data?.sport !== 'baseball_mlb') return null;
  const homePitcher = data.pitchingMatchup?.home;
  const awayPitcher = data.pitchingMatchup?.away;
  const weather = data.weather;
  const roto = data.roto;
  const lineups = data.lineups;
  const hasLineups = !!(lineups && (lineups.away?.length || lineups.home?.length));
  const rotoColor = roto?.status === 'Confirmed' ? '#22c55e' : roto?.status === 'Partial' ? '#eab308' : '#94a3b8';

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(71,85,105,0.15)', display: 'grid', gap: '10px' }}>
      {/* Roto: starting-pitcher + lineup confirmation status */}
      {roto && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', padding: '8px 10px', borderRadius: '8px', background: 'rgba(15,23,42,0.5)', border: `1px solid ${rotoColor}33` }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 800, color: rotoColor, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            ⚾ Roto: {roto.status}
          </span>
          {roto.lineups && (
            <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: roto.lineups === 'Posted' ? 'rgba(34,197,94,0.16)' : 'rgba(100,116,139,0.18)', color: roto.lineups === 'Posted' ? '#22c55e' : '#94a3b8' }}>
              Lineups: {roto.lineups}
            </span>
          )}
          <span style={{ fontSize: '10px', color: '#94a3b8' }}>{roto.note}</span>
          {roto.source && <span style={{ fontSize: '9px', color: '#475569', marginLeft: 'auto' }}>{roto.source}</span>}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <PlayerCard title="Away starter" player={awayPitcher} emptyText="Not listed yet" badge={awayPitcher ? rotoConfBadge(!!awayPitcher.confirmed) : null} detail={awayPitcher?.confirmed ? 'Confirmed probable (Roto)' : awayPitcher?.last3Starts?.length ? 'Projected · recent starter form' : 'Projected from rotation'} stats={pitcherStats(awayPitcher)} />
        <PlayerCard title="Home starter" player={homePitcher} emptyText="Not listed yet" badge={homePitcher ? rotoConfBadge(!!homePitcher.confirmed) : null} detail={homePitcher?.confirmed ? 'Confirmed probable (Roto)' : homePitcher?.last3Starts?.length ? 'Projected · recent starter form' : 'Projected from rotation'} stats={pitcherStats(homePitcher)} />
      </div>

      {/* Projected / confirmed batting lineups (MLB Stats API) */}
      {hasLineups ? (
        <div style={{ background: 'rgba(30,41,59,0.35)', borderRadius: '8px', padding: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#cbd5e1', fontSize: '11px', fontWeight: 700 }}>
            <span aria-hidden="true">🧾</span> Projected Lineups
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <LineupColumn title={String(data.awayTeam || 'Away').split(' ').pop()} players={lineups.away} />
            <LineupColumn title={String(data.homeTeam || 'Home').split(' ').pop()} players={lineups.home} />
          </div>
        </div>
      ) : (
        <div style={{ fontSize: '10px', color: '#64748b' }}>
          🧾 Lineups not posted yet — they usually drop a few hours before first pitch.
        </div>
      )}

      <div style={{ background: 'rgba(30,41,59,0.35)', borderRadius: '8px', padding: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#cbd5e1', fontSize: '11px', fontWeight: 700 }}><CloudSun size={12} /> Weather</div>
        <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 700 }}>
          {weather?.temperature != null ? `${weather.temperature}° · ${weather.condition || 'Conditions available'}` : 'Weather coming soon'}
        </div>
        <div style={{ color: '#94a3b8', fontSize: '10px', marginTop: '4px' }}>
          {weather?.windSpeed != null ? `Wind ${weather.windSpeed} mph ${weather.windDirection || ''}` : 'Live weather feed coming soon'}
        </div>
      </div>
    </div>
  );
}

function HockeyExtras({ data }) {
  if (data?.sport !== 'icehockey_nhl') return null;
  const homeGoalie = data.home?.goalie?.likelyStarter;
  const awayGoalie = data.away?.goalie?.likelyStarter;

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(71,85,105,0.15)', display: 'grid', gap: '10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <PlayerCard title="Away goalie" player={awayGoalie} emptyText="Not listed yet" detail="Recent goalie form" stats={goalieStats(data.away?.goalie)} />
        <PlayerCard title="Home goalie" player={homeGoalie} emptyText="Not listed yet" detail="Recent goalie form" stats={goalieStats(data.home?.goalie)} />
      </div>
    </div>
  );
}

export default function GameResearch({ gameId, sport, homeTeam, awayTeam, commenceTime }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('form');

  const fetchData = useCallback(async () => {
    if (!homeTeam || !awayTeam) {
      setLoading(false);
      setError('Missing team information');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ gameId: gameId || '', sport: sport || 'basketball_nba', homeTeam, awayTeam });
      if (commenceTime) params.append('commenceTime', commenceTime);
      const res = await fetch(`/api/game-research?${params}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const payload = await res.json();
      if (payload?.error) throw new Error(payload.error);
      setData(payload);
    } catch (e) {
      console.error('GameResearch fetch error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [gameId, homeTeam, awayTeam, sport, commenceTime]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const homeNormalized = useMemo(() => normalizeTeamData(data, 'home'), [data]);
  const awayNormalized = useMemo(() => normalizeTeamData(data, 'away'), [data]);
  const trends = useMemo(() => normalizeTrends(data), [data]);

  const tabs = [
    { key: 'form', label: 'Form', icon: Activity },
    { key: 'h2h', label: 'H2H', icon: History },
    { key: 'trends', label: 'Trends', icon: TrendingUp },
  ];

  const statusLabel = data?.dataSource || (data?.accurate ? 'Live' : data?.sport === 'baseball_mlb' ? 'MLB Research' : 'Research');

  return (
    <div style={{ background: 'rgba(15,23,42,0.55)', borderRadius: '10px', border: '1px solid rgba(71,85,105,0.25)', overflow: 'hidden', marginTop: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid rgba(71,85,105,0.2)', background: 'rgba(30,41,59,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={15} color="#818cf8" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Game Research</span>
          {!loading && data && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', padding: '2px 7px', borderRadius: '12px', fontWeight: 600, ...(data.accurate ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' } : { background: 'rgba(100,116,139,0.15)', color: '#94a3b8' }) }}>
              {data.accurate ? <CheckCircle size={9} /> : <AlertCircle size={9} />}
              {statusLabel}
            </span>
          )}
        </div>
        <button onClick={fetchData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }} title="Refresh">
          <RefreshCw size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ flex: 1, padding: '8px 4px', background: activeTab === tab.key ? 'rgba(99,102,241,0.1)' : 'transparent', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent', color: activeTab === tab.key ? '#818cf8' : '#64748b', fontSize: '11px', fontWeight: activeTab === tab.key ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'all 0.15s' }}>
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{ width: '22px', height: '22px', margin: '0 auto 10px', border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #6366f1', borderRadius: '50%', animation: 'grSpin 0.8s linear infinite' }} />
          <style>{'@keyframes grSpin { to { transform: rotate(360deg); } }'}</style>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Loading research…</div>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <AlertCircle size={20} color="#ef4444" style={{ marginBottom: '6px' }} />
          <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '8px' }}>{error}</div>
          <button onClick={fetchData} style={{ padding: '5px 12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '5px', color: '#818cf8', fontSize: '11px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      ) : !data ? (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>No data</div>
      ) : activeTab === 'form' ? (
        <div>
          <BaseballExtras data={data} />
          <HockeyExtras data={data} />
          <Last10Row teamData={homeNormalized} label={homeTeam} />
          <Last10Row teamData={awayNormalized} label={awayTeam} />
        </div>
      ) : activeTab === 'h2h' ? (
        <H2HPanel games={data.h2h} homeTeam={homeTeam} awayTeam={awayTeam} />
      ) : (
        <TrendsPanel trends={trends} />
      )}

      {!loading && !error && data && (
        <div style={{ padding: '6px 14px', borderTop: '1px solid rgba(71,85,105,0.15)', fontSize: '9px', color: '#475569', textAlign: 'center' }}>
          {(data.timestamp || data.generatedAt) ? new Date(data.timestamp || data.generatedAt).toLocaleTimeString() : ''} · {statusLabel}
        </div>
      )}
    </div>
  );
}
