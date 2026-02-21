// GameResearch.jsx — Expandable research section for each game
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, Target, History, Activity } from 'lucide-react';

export default function GameResearch({ game }) {
  const [activeTab, setActiveTab] = useState(null); // 'form', 'h2h', 'trends'
  const [research, setResearch] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch research when expanded
  useEffect(() => {
    if (!activeTab || research) return;
    
    setLoading(true);
    fetch(`/api/game-research?homeTeam=${encodeURIComponent(game.home_team)}&awayTeam=${encodeURIComponent(game.away_team)}&sport=${game.sport_key}`)
      .then(r => r.json())
      .then(data => {
        setResearch(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeTab, game]);

  const TabButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setActiveTab(activeTab === id ? null : id)}
      style={{
        flex: 1,
        padding: '10px',
        background: activeTab === id 
          ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.5), rgba(139, 92, 246, 0.5))' 
          : 'rgba(15, 23, 42, 0.8)',
        border: `1px solid ${activeTab === id ? 'rgba(99, 102, 241, 0.8)' : 'rgba(71, 85, 105, 0.4)'}`,
        borderRadius: '8px',
        color: activeTab === id ? '#ffffff' : '#64748b',
        fontSize: '12px',
        fontWeight: activeTab === id ? 700 : 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        fontFamily: "'JetBrains Mono', monospace',
        boxShadow: activeTab === id ? '0 0 15px rgba(99, 102, 241, 0.3)' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      <Icon size={14} color={activeTab === id ? '#c4b5fd' : '#64748b'} />
      <span style={{ color: activeTab === id ? '#f8fafc' : '#94a3b8' }}>{label}</span>
      {activeTab === id ? <ChevronUp size={14} color="#c4b5fd" /> : <ChevronDown size={14} color="#64748b" />}
    </button>
  );

  return (
    <div style={{ marginTop: '16px', borderTop: '1px solid rgba(71, 85, 105, 0.3)', paddingTop: '16px' }}>
      {/* Research Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <TabButton id="form" icon={Activity} label="Recent Form" />
        <TabButton id="h2h" icon={History} label="H2H" />
        <TabButton id="trends" icon={TrendingUp} label="Trends" />
      </div>

      {/* Tab Content */}
      {activeTab && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.9)',
          borderRadius: '10px',
          padding: '14px',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          boxShadow: '0 4px 20px rgba(99, 102, 241, 0.15)',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '13px' }}>
              Loading research...
            </div>
          ) : research ? (
            <>
              {/* Data Source Badge */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                marginBottom: '10px',
                fontSize: '10px',
                color: research.source === 'ESPN' ? '#22c55e' : '#eab308',
              }}>
                {research.source === 'ESPN' ? '✓ Live ESPN Data' : '⚠ Data Unavailable'}
              </div>
              {activeTab === 'form' && <RecentForm research={research} />}
              {activeTab === 'h2h' && <HeadToHead research={research} />}
              {activeTab === 'trends' && <KeyTrends research={research} />}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b', fontSize: '13px' }}>
              Click to load research data
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Recent Form Tab
function RecentForm({ research }) {
  const { awayTeam, homeTeam } = research;
  
  return (
    <div>
      <h4 style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px', fontWeight: 700 }}>
        LAST 5 GAMES
      </h4>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Away Team */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            {awayTeam.name}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {awayTeam.recentForm.last5.map((result, i) => (
              <span key={i} style={{
                width: '24px', height: '24px', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700,
                background: result === 'W' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: result === 'W' ? '#22c55e' : '#f87171',
                border: `1px solid ${result === 'W' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
              }}>
                {result}
              </span>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Record: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{awayForm.record}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Avg: <span style={{ color: '#22c55e' }}>{awayForm.avgPoints} PPG</span> | 
            <span style={{ color: '#f87171' }}> {awayForm.avgAllowed} allowed</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            ATS: <span style={{ color: '#f8fafc' }}>{(awayTeam.ats || {}).last5 || 'N/A'}</span> (L5)
          </div>
        </div>

        {/* Home Team */}
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            {homeTeam.name || 'Home Team'}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {(homeForm.last5 || ['?', '?', '?', '?', '?']).map((result, i) => (
              <span key={i} style={{
                width: '24px', height: '24px', borderRadius: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700,
                background: result === 'W' ? 'rgba(34, 197, 94, 0.3)' : result === 'L' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(100, 100, 100, 0.3)',
                color: result === 'W' ? '#22c55e' : result === 'L' ? '#f87171' : '#64748b',
                border: `1px solid ${result === 'W' ? 'rgba(34, 197, 94, 0.5)' : result === 'L' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(100, 100, 100, 0.5)'}`,
              }}>
                {result}
              </span>
            ))}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>
            Record: <span style={{ color: '#f8fafc', fontWeight: 600 }}>{homeForm.record}</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            Avg: <span style={{ color: '#22c55e' }}>{homeForm.avgPoints} PPG</span> | 
            <span style={{ color: '#f87171' }}> {homeForm.avgAllowed} allowed</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            ATS: <span style={{ color: '#f8fafc' }}>{(homeTeam.ats || {}).last5 || 'N/A'}</span> (L5)
          </div>
        </div>
      </div>
    </div>
  );
}

// Head to Head Tab
function HeadToHead({ research }) {
  const { headToHead } = research;
  
  return (
    <div>
      <h4 style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px', fontWeight: 700 }}>
        HEAD TO HEAD — {headToHead.overall}
      </h4>
      
      {headToHead.thisSeason.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, marginBottom: '6px' }}>
            THIS SEASON
          </div>
          {headToHead.thisSeason.map((game, i) => (
            <div key={i} style={{
              padding: '10px', background: 'rgba(99, 102, 241, 0.1)',
              borderRadius: '6px', marginBottom: '6px',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}>
              <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>
                {game.winner} {game.score}
              </div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>
                {game.date} · Spread: {game.spread}
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div style={{ fontSize: '11px', color: '#818cf8', fontWeight: 600, marginBottom: '6px' }}>
        PREVIOUS MEETINGS
      </div>
      {headToHead.lastMeetings.map((game, i) => (
        <div key={i} style={{
          padding: '8px 10px', background: 'rgba(30, 41, 59, 0.6)',
          borderRadius: '6px', marginBottom: '6px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <span style={{ fontSize: '12px', color: '#f8fafc' }}>{game.winner}</span>
            <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '8px' }}>{game.score}</span>
          </div>
          <span style={{ fontSize: '10px', color: '#64748b' }}>{game.date}</span>
        </div>
      ))}
    </div>
  );
}

// Key Trends Tab
function KeyTrends({ research }) {
  const { keyTrends, awayTeam, homeTeam } = research;
  
  return (
    <div>
      <h4 style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '12px', fontWeight: 700 }}>
        KEY BETTING TRENDS
      </h4>
      
      <div style={{ display: 'grid', gap: '8px' }}>
        {keyTrends.map((trend, i) => (
          <div key={i} style={{
            padding: '10px 12px', background: 'rgba(30, 41, 59, 0.6)',
            borderRadius: '6px', borderLeft: '3px solid #6366f1',
            fontSize: '12px', color: '#e2e8f0',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ color: '#6366f1', fontWeight: 700 }}>→</span>
            {trend}
          </div>
        ))}
      </div>
      
      {/* ATS Records */}
      <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div style={{ padding: '10px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '6px' }}>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>{awayTeam.name} ATS</div>
          <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 700 }}>{awayTeam.ats.overall}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Home: {awayTeam.ats.home}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Away: {awayTeam.ats.away}</div>
        </div>
        <div style={{ padding: '10px', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '6px' }}>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>{homeTeam.name} ATS</div>
          <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: 700 }}>{homeTeam.ats.overall}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Home: {homeTeam.ats.home}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>Away: {homeTeam.ats.away}</div>
        </div>
      </div>
    </div>
  );
}
