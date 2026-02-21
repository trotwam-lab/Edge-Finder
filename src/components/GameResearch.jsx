import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, History, Activity } from 'lucide-react';

export default function GameResearch({ game }) {
  const [tab, setTab] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!game?.away_team || !game?.home_team) return;
    
    setLoading(true);
    setData(null);
    
    try {
      const url = `/api/game-research?awayTeam=${encodeURIComponent(game.away_team)}&homeTeam=${encodeURIComponent(game.home_team)}&sport=${game.sport_key || 'basketball_nba'}&_t=${Date.now()}`;
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => {
    if (tab) loadData();
  }, [tab, loadData]);

  if (!tab) {
    return (
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => setTab('form')} style={tabStyle}>Recent Form</button>
        <button onClick={() => setTab('h2h')} style={tabStyle}>H2H</button>
        <button onClick={() => setTab('trends')} style={tabStyle}>Trends</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button onClick={() => setTab('form')} style={{...tabStyle, background: tab==='form' ? 'rgba(99,102,241,0.4)' : ''}}>Recent Form</button>
        <button onClick={() => setTab('h2h')} style={{...tabStyle, background: tab==='h2h' ? 'rgba(99,102,241,0.4)' : ''}}>H2H</button>
        <button onClick={() => setTab('trends')} style={{...tabStyle, background: tab==='trends' ? 'rgba(99,102,241,0.4)' : ''}}>Trends</button>
      </div>

      <div style={{ background: 'rgba(15,23,42,0.9)', borderRadius: '10px', padding: '14px', border: '1px solid rgba(99,102,241,0.4)' }}>
        {loading && <div style={{ textAlign: 'center', color: '#64748b' }}>Loading...</div>}
        
        {!loading && data?.accurate === false && (
          <div style={{ textAlign: 'center', color: '#f87171' }}>
            Data unavailable. Try again later.
          </div>
        )}
        
        {!loading && data?.accurate === true && (
          <>
            <div style={{ textAlign: 'right', fontSize: '10px', color: '#22c55e', marginBottom: '10px' }}>
              ✓ Verified | {data.dataSource}
            </div>
            
            {tab === 'form' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <TeamForm team={data.awayTeam} />
                <TeamForm team={data.homeTeam} />
              </div>
            )}
            
            {tab === 'trends' && (
              <div>
                {data.keyTrends?.map((t, i) => (
                  <div key={i} style={{ padding: '8px', borderLeft: '3px solid #6366f1', marginBottom: '8px', fontSize: '12px' }}>{t}</div>
                ))}
              </div>
            )}
            
            {tab === 'h2h' && (
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>{data.headToHead?.overall || 'No H2H data'}</div>
                {data.headToHead?.lastMeetings?.map((g, i) => (
                  <div key={i} style={{ padding: '8px', background: 'rgba(30,41,59,0.6)', borderRadius: '6px', marginBottom: '6px', fontSize: '12px' }}>
                    {g.winner} {g.score} <span style={{ color: '#64748b' }}>({g.date?.slice(0,10)})</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TeamForm({ team }) {
  const form = team?.recentForm || {};
  const last5 = form.last5 || [];
  
  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>{team?.name}</div>
      
      <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
        {last5.length > 0 ? last5.map((r, i) => (
          <span key={i} style={{
            width: '24px', height: '24px', borderRadius: '4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', fontWeight: 700,
            background: r === 'W' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
            color: r === 'W' ? '#22c55e' : '#f87171',
            border: `1px solid ${r === 'W' ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
          }}>{r}</span>
        )) : <span style={{ color: '#64748b', fontSize: '11px' }}>No games</span>}
      </div>
      
      <div style={{ fontSize: '11px', color: '#64748b' }}>
        Record: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{form.record || 'N/A'}</span>
      </div>
      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
        PPG: <span style={{ color: '#22c55e' }}>{form.avgPoints || '0.0'}</span> | 
        Allowed: <span style={{ color: '#f87171' }}>{form.avgAllowed || '0.0'}</span>
      </div>
    </div>
  );
}

const tabStyle = {
  flex: 1,
  padding: '10px',
  background: 'rgba(30,41,59,0.6)',
  border: '1px solid rgba(71,85,105,0.3)',
  borderRadius: '8px',
  color: '#94a3b8',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace",
};
