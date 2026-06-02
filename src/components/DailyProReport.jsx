import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, FileText, RefreshCw, Star, Zap } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import { auth } from '../firebase.js';
import ProBanner from './ProBanner.jsx';
import { getMarketDisplayName, formatOdds } from '../utils/props.js';

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

function formatGameTime(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      padding: '16px',
      background: 'rgba(30,41,59,0.62)',
      border: '1px solid rgba(71,85,105,0.28)',
      borderRadius: '14px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      {icon}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.03em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{subtitle}</div>}
      </div>
    </div>
  );
}

export default function DailyProReport({ games = [], playerProps = [] }) {
  const { tier } = useAuth();
  const [edges, setEdges] = useState([]);
  const [loadingEdges, setLoadingEdges] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadEdges = useCallback(async () => {
    if (tier !== 'pro') return;
    setLoadingEdges(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/edges', { headers });
      if (!res.ok) throw new Error(`Edge scan failed: ${res.status}`);
      const data = await res.json();
      setEdges(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingEdges(false);
    }
  }, [tier]);

  useEffect(() => {
    loadEdges();
  }, [loadEdges]);

  const reportDate = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  const topEdges = useMemo(() => edges.slice(0, 5), [edges]);

  const upcomingGames = useMemo(() => {
    return [...games]
      .filter(game => game?.commence_time && Date.parse(game.commence_time) >= Date.now() - 3 * 60 * 60 * 1000)
      .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time))
      .slice(0, 6);
  }, [games]);

  const propBoard = useMemo(() => {
    const map = new Map();
    playerProps.forEach(prop => {
      if (!prop?.player || !prop?.market) return;
      const key = `${prop.sport}:${prop.gameId}:${prop.player}:${prop.market}:${prop.line ?? ''}`;
      if (!map.has(key)) {
        map.set(key, {
          player: prop.player,
          game: prop.game,
          market: prop.market,
          line: prop.line,
          sport: prop.sport,
          books: new Set(),
          prices: [],
        });
      }
      const item = map.get(key);
      item.books.add(prop.bookTitle || prop.book || prop.bookKey);
      if (prop.price != null) item.prices.push({ price: prop.price, side: prop.outcome, book: prop.bookTitle || prop.book || prop.bookKey });
    });

    return Array.from(map.values())
      .map(item => {
        const best = item.prices.sort((a, b) => b.price - a.price)[0];
        return { ...item, bookCount: item.books.size, best };
      })
      .sort((a, b) => b.bookCount - a.bookCount || String(a.player).localeCompare(String(b.player)))
      .slice(0, 5);
  }, [playerProps]);

  if (tier !== 'pro') {
    return (
      <main className="edge-app-main" style={{ maxWidth: '760px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '46px', marginBottom: '12px' }}>📝</div>
          <h2 style={{ fontSize: '21px', color: '#f8fafc', margin: '0 0 8px' }}>Daily Pro Report</h2>
          <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
            Free gives you the board preview. Pro gives you the daily workflow: top edges, props to inspect, and where to start your card.
          </p>
        </div>
        <ProBanner />
      </main>
    );
  }

  return (
    <main className="edge-app-main" style={{ maxWidth: '980px' }}>
      <div style={{
        padding: '20px',
        marginBottom: '16px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.08))',
        border: '1px solid rgba(99,102,241,0.32)',
        borderRadius: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FileText size={20} color="#a78bfa" />
              <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase' }}>EdgeFinder Pro</span>
            </div>
            <h2 style={{ fontSize: '22px', color: '#f8fafc', margin: '0 0 6px' }}>Daily Betting Workflow</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
              Start here: scan the top edge board, pick the props worth researching, then track only the bets you can explain.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
              <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{reportDate}</div>
              {lastUpdated && <div>Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>}
            </div>
            <button onClick={loadEdges} disabled={loadingEdges} style={{
              padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.16)', color: '#c4b5fd', cursor: loadingEdges ? 'not-allowed' : 'pointer',
            }}>
              <RefreshCw size={15} style={{ animation: loadingEdges ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontSize: '12px' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <Card>
          <SectionTitle icon={<Zap size={18} color="#fbbf24" />} title="Top 5 Edge Board" subtitle="Exact plays from the live Pro edge scan" />
          {loadingEdges && topEdges.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '12px' }}>Scanning markets…</div>
          ) : topEdges.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {topEdges.map((edge, idx) => (
                <div key={`${edge.gameId}-${edge.edge}-${idx}`} style={{ paddingBottom: '10px', borderBottom: idx === topEdges.length - 1 ? 'none' : '1px solid rgba(71,85,105,0.28)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{idx + 1}. {edge.emoji} {edge.game}</div>
                    <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 800 }}>{edge.evDisplay}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45 }}>{edge.edge}</div>
                  <div style={{ fontSize: '10px', color: '#818cf8', marginTop: '3px' }}>{edge.book} · {edge.confidence} confidence</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px' }}>No qualifying +EV edges right now. That is useful too — do not force action.</div>
          )}
        </Card>

        <Card>
          <SectionTitle icon={<Star size={18} color="#38bdf8" />} title="Props to Research" subtitle="High-coverage markets with multiple books" />
          {propBoard.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {propBoard.map((prop, idx) => (
                <div key={`${prop.player}-${prop.market}-${idx}`} style={{ paddingBottom: '10px', borderBottom: idx === propBoard.length - 1 ? 'none' : '1px solid rgba(71,85,105,0.28)' }}>
                  <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{idx + 1}. {prop.player}</div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                    {getMarketDisplayName(prop.market)} {prop.line ?? ''} · {prop.bookCount} books
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Best seen: {prop.best?.side || '—'} {prop.best?.price != null ? formatOdds(prop.best.price) : '—'} {prop.best?.book ? `at ${prop.best.book}` : ''}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px' }}>Props are still loading. Refresh after the slate populates.</div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle icon={<CalendarDays size={18} color="#22c55e" />} title="Slate Watchlist" subtitle="Upcoming games to open first" />
        {upcomingGames.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {upcomingGames.map(game => (
              <div key={game.id} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(15,23,42,0.42)', border: '1px solid rgba(71,85,105,0.22)' }}>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700, marginBottom: '4px' }}>{game.away_team} @ {game.home_team}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{game.sport_title || game.sport_key} · {formatGameTime(game.commence_time)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '12px' }}>No upcoming games loaded yet. Try Games refresh, then return here.</div>
        )}
      </Card>
    </main>
  );
}
