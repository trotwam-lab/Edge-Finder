import React, { useState, useEffect, useCallback } from 'react';
import { Activity, History, TrendingUp, AlertCircle, RefreshCw, CheckCircle, BarChart3 } from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTrendColor(confidence) {
  return confidence === 'high' ? '#22c55e' : confidence === 'medium' ? '#eab308' : '#64748b';
}
function getTrendBg(confidence) {
  return confidence === 'high' ? 'rgba(34,197,94,0.12)' : confidence === 'medium' ? 'rgba(234,179,8,0.12)' : 'rgba(100,116,139,0.12)';
}

// ─── Last-10 row ─────────────────────────────────────────────────────────────

function Last10Row({ teamData, label }) {
  if (!teamData) {
    return (
      <div style={{ padding: '10px 0', color: '#64748b', fontSize: '12px', textAlign: 'center' }}>
        No data for {label}
      </div>
    );
  }
  const { wins, losses, streak, homeRecord, awayRecord, recentGames } = teamData;
  const total = wins + losses;
  const winPct = total > 0 ? wins / total : 0;

  const wColor = winPct >= 0.6 ? '#22c55e' : winPct < 0.4 ? '#ef4444' : '#eab308';
  const wBg   = winPct >= 0.6 ? 'rgba(34,197,94,0.15)' : winPct < 0.4 ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)';

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(71,85,105,0.15)' }}>
      {/* Team name + record */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{label}</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* W-L badge */}
          <div style={{ padding: '3px 10px', borderRadius: '6px', background: wBg, color: wColor, fontSize: '12px', fontWeight: 700 }}>
            {wins}-{losses} L{total}
          </div>
          {/* Streak badge */}
          {streak && streak !== '-' && (
            <div style={{
              padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
              background: streak.startsWith('W') ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: streak.startsWith('W') ? '#22c55e' : '#ef4444',
            }}>
              {streak}
            </div>
          )}
        </div>
      </div>

      {/* Home/Away splits */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <div style={{ fontSize: '10px', color: '#64748b', background: 'rgba(30,41,59,0.5)', padding: '4px 10px', borderRadius: '5px' }}>
          🏠 {homeRecord?.wins ?? 0}-{homeRecord?.losses ?? 0}
        </div>
        <div style={{ fontSize: '10px', color: '#64748b', background: 'rgba(30,41,59,0.5)', padding: '4px 10px', borderRadius: '5px' }}>
          ✈️ {awayRecord?.wins ?? 0}-{awayRecord?.losses ?? 0}
        </div>
      </div>

      {/* Last 10 game dots */}
      {recentGames && recentGames.length > 0 ? (
        <div style={{ display: 'flex', gap: '3px' }}>
          {recentGames.slice(0, 10).map((g, idx) => (
            <div
              key={idx}
              title={`${g.isHome ? 'vs' : '@'} ${g.opponentAbbr}: ${g.teamScore}-${g.opponentScore}`}
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
                {g.isHome ? 'vs' : '@'}{g.opponentAbbr?.slice(0, 3)}
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

// ─── H2H mini-table ──────────────────────────────────────────────────────────

function H2HPanel({ games, homeTeam, awayTeam }) {
  if (!games || games.length === 0) {
    return (
      <div style={{ padding: '12px 16px', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>
        No recent head-to-head matchups found
      </div>
    );
  }
  const homeLast = homeTeam?.split(' ').pop();
  const awayLast = awayTeam?.split(' ').pop();

  let homeW = 0, awayW = 0;
  games.forEach(g => {
    const hs = parseInt(g.homeScore) || 0, as_ = parseInt(g.awayScore) || 0;
    const isHomeTeamHome = g.homeTeam?.includes(homeLast);
    if (hs > as_) isHomeTeamHome ? homeW++ : awayW++;
    else isHomeTeamHome ? awayW++ : homeW++;
  });

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Series line */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginBottom: '10px', fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
        <span>{homeLast} {homeW}</span>
        <span style={{ color: '#64748b', fontWeight: 400 }}>–</span>
        <span>{awayW} {awayLast}</span>
      </div>
      {/* Game list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {games.map((g, i) => {
          const hs = parseInt(g.homeScore) || 0, as_ = parseInt(g.awayScore) || 0;
          const d = new Date(g.date);
          return (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '7px 10px', background: 'rgba(30,41,59,0.4)', borderRadius: '6px', fontSize: '11px',
            }}>
              <span style={{ color: '#64748b', minWidth: '52px' }}>
                {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span style={{ color: '#f8fafc', fontFamily: 'monospace', fontWeight: 600 }}>
                {g.awayTeam?.split(' ').pop()} {as_} – {hs} {g.homeTeam?.split(' ').pop()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Trends panel ────────────────────────────────────────────────────────────

function TrendsPanel({ trends }) {
  if (!trends || trends.length === 0) return null;
  return (
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {trends.map((t, i) => (
        <div key={i} style={{
          padding: '9px 12px', borderRadius: '8px',
          background: getTrendBg(t.confidence),
          border: `1px solid ${getTrendColor(t.confidence)}28`,
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <span style={{ fontSize: '14px' }}>{t.icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: getTrendColor(t.confidence) }}>{t.label}</div>
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{t.description}</div>
          </div>
          <span style={{
            fontSize: '9px', padding: '2px 6px', borderRadius: '4px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.4px',
            background: getTrendColor(t.confidence) + '22',
            color: getTrendColor(t.confidence),
          }}>{t.confidence}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
// Props: gameId, sport, homeTeam, awayTeam, commenceTime
// (matches what GameDetails passes)

export default function GameResearch({ gameId, sport, homeTeam, awayTeam, commenceTime }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('form');

  const fetchData = useCallback(async () => {
    if (!homeTeam || !awayTeam) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ gameId: gameId || '', sport: sport || 'basketball_nba', homeTeam, awayTeam });
      if (commenceTime) params.append('commenceTime', commenceTime);
      const res = await fetch(`/api/game-research?${params}`);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      setData(await res.json());
    } catch (e) {
      console.error('GameResearch fetch error:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [gameId, homeTeam, awayTeam, sport]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─ Tabs config
  const tabs = [
    { key: 'form',   label: 'Form',   icon: Activity },
    { key: 'h2h',    label: 'H2H',    icon: History },
    { key: 'trends', label: 'Trends', icon: TrendingUp },
  ];

  return (
    <div style={{
      background: 'rgba(15,23,42,0.55)',
      borderRadius: '10px',
      border: '1px solid rgba(71,85,105,0.25)',
      overflow: 'hidden',
      marginTop: '4px',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid rgba(71,85,105,0.2)',
        background: 'rgba(30,41,59,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={15} color="#818cf8" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc' }}>Game Research</span>
          {!loading && data && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '3px',
              fontSize: '9px', padding: '2px 7px', borderRadius: '12px', fontWeight: 600,
              ...(data.accurate
                ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e' }
                : { background: 'rgba(100,116,139,0.15)', color: '#64748b' }),
            }}>
              {data.accurate ? <CheckCircle size={9} /> : <AlertCircle size={9} />}
              {data.dataSource || (data.accurate ? 'Live' : 'Limited')}
            </span>
          )}
        </div>
        <button
          onClick={fetchData}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Tab strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(71,85,105,0.2)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 4px',
              background: activeTab === tab.key ? 'rgba(99,102,241,0.1)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #6366f1' : '2px solid transparent',
              color: activeTab === tab.key ? '#818cf8' : '#64748b',
              fontSize: '11px', fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
              transition: 'all 0.15s',
            }}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div style={{
            width: '22px', height: '22px', margin: '0 auto 10px',
            border: '2px solid rgba(99,102,241,0.2)', borderTop: '2px solid #6366f1',
            borderRadius: '50%', animation: 'grSpin 0.8s linear infinite',
          }} />
          <style>{'@keyframes grSpin { to { transform: rotate(360deg); } }'}</style>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Loading research…</div>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <AlertCircle size={20} color="#ef4444" style={{ marginBottom: '6px' }} />
          <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '8px' }}>{error}</div>
          <button onClick={fetchData} style={{
            padding: '5px 12px', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: '5px', color: '#818cf8', fontSize: '11px', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: '4px',
          }}>
            <RefreshCw size={11} /> Retry
          </button>
        </div>
      ) : !data ? (
        <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#64748b' }}>No data</div>
      ) : activeTab === 'form' ? (
        <div>
          <Last10Row teamData={data.teams?.home} label={homeTeam} />
          <Last10Row teamData={data.teams?.away} label={awayTeam} />
        </div>
      ) : activeTab === 'h2h' ? (
        <H2HPanel games={data.h2h} homeTeam={homeTeam} awayTeam={awayTeam} />
      ) : (
        <TrendsPanel trends={data.trends} />
      )}

      {/* Footer */}
      {!loading && !error && data && (
        <div style={{
          padding: '6px 14px', borderTop: '1px solid rgba(71,85,105,0.15)',
          fontSize: '9px', color: '#475569', textAlign: 'center',
        }}>
          {data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : ''} · {data.dataSource || 'Unknown'}
        </div>
      )}
    </div>
  );
}
