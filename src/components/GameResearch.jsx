import React, { useState, useEffect } from 'react';

export default function GameResearch({ game }) {
  const [tab, setTab] = useState(null);
  const [data, setData] = useState(null);
  const [raw, setRaw] = useState(null);

  useEffect(() => {
    if (!tab || !game) return;
    
    const url = `/api/game-research?awayTeam=${encodeURIComponent(game.away_team)}&homeTeam=${encodeURIComponent(game.home_team)}&sport=${game.sport_key}&_t=${Date.now()}`;
    
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setRaw(JSON.stringify(d, null, 2));
        setData(d);
      });
  }, [tab, game]);

  if (!tab) {
    return (
      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <button onClick={() => setTab('form')} style={btn}>Recent Form</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <button onClick={() => setTab(null)} style={btn}>Back</button>
      
      <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', marginTop: '8px', fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap', color: '#22c55e' }}>
        {raw || 'Loading...'}
      </div>
    </div>
  );
}

const btn = {
  padding: '8px 16px',
  background: 'rgba(99,102,241,0.3)',
  border: '1px solid rgba(99,102,241,0.5)',
  borderRadius: '6px',
  color: '#f8fafc',
  cursor: 'pointer',
};
