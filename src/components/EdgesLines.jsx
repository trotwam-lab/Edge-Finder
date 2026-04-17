import React, { useState, useEffect, useCallback } from 'react';
import { Zap, RefreshCw, Lock, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

const CONFIDENCE_COLORS = {
  HIGH: '#22c55e',
  MEDIUM: '#eab308',
  LOW: '#f97316',
};

const EDGES_REFRESH = 5 * 60 * 1000;
const MOVEMENTS_REFRESH = 2 * 60 * 1000;
const STORAGE_KEY = 'edgefinder_line_snapshots';

const THRESHOLDS = {
  SPREAD: 1,
  TOTAL: 2,
  MONEYLINE: 15,
};

// Sport pill color for consistency with Games tab
const SPORT_FAMILY_COLOR = {
  NBA: '#f97316', NFL: '#22c55e', NHL: '#3b82f6', MLB: '#ef4444',
  NCAAB: '#fb923c', NCAAF: '#16a34a', WNCAAB: '#f472b6',
  MMA: '#dc2626', Boxing: '#ef4444',
  EPL: '#a855f7', 'La Liga': '#a855f7', 'Serie A': '#a855f7',
  Bundesliga: '#a855f7', 'Ligue 1': '#a855f7', UCL: '#7c3aed',
  MLS: '#a855f7', 'Liga MX': '#a855f7',
};
function sportColor(label) {
  const key = String(label || '').split(/\s+/)[0];
  return SPORT_FAMILY_COLOR[key] || '#6b7280';
}

function formatTimeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function EdgesLines() {
  const { tier } = useAuth();
  const isPro = tier === 'pro';

  const [subTab, setSubTab] = useState('EDGES');
  const [edges, setEdges] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loadingEdges, setLoadingEdges] = useState(true);
  const [loadingMoves, setLoadingMoves] = useState(true);
  const [error, setError] = useState(null);
  const [lastEdgesFetch, setLastEdgesFetch] = useState(null);
  const [lastMovesFetch, setLastMovesFetch] = useState(null);

  const loadSnapshots = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  const saveSnapshots = useCallback((snapshots) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
    } catch (e) {
      console.error('Failed to save line snapshots:', e);
    }
  }, []);

  const extractLines = useCallback((oddsData) => {
    const lines = {};
    oddsData.forEach(game => {
      if (!game.id) return;
      lines[game.id] = {
        gameId: game.id,
        gameName: `${game.away_team} @ ${game.home_team}`,
        sport: game.sport_title || game.sport_key,
        commenceTime: game.commence_time,
        timestamp: Date.now(),
        markets: {},
      };
      game.bookmakers?.forEach(book => {
        book.markets?.forEach(market => {
          const marketKey = market.key;
          if (!lines[game.id].markets[marketKey]) lines[game.id].markets[marketKey] = {};
          market.outcomes?.forEach(outcome => {
            const outcomeKey = outcome.name + (outcome.point !== undefined ? ` ${outcome.point}` : '');
            if (!lines[game.id].markets[marketKey][outcomeKey] ||
                outcome.price > lines[game.id].markets[marketKey][outcomeKey].price) {
              lines[game.id].markets[marketKey][outcomeKey] = {
                price: outcome.price,
                point: outcome.point,
                book: book.key,
                name: outcome.name,
              };
            }
          });
        });
      });
    });
    return lines;
  }, []);

  const detectMovements = useCallback((currentLines, previousLines) => {
    const newMovements = [];
    Object.entries(currentLines).forEach(([gameId, currentGame]) => {
      const previousGame = previousLines[gameId];
      if (!previousGame) return;
      Object.entries(currentGame.markets).forEach(([marketKey, currentOutcomes]) => {
        const previousOutcomes = previousGame.markets[marketKey];
        if (!previousOutcomes) return;
        Object.entries(currentOutcomes).forEach(([outcomeKey, currentOutcome]) => {
          const previousOutcome = previousOutcomes[outcomeKey];
          if (!previousOutcome) return;
          const currentPrice = currentOutcome.price;
          const previousPrice = previousOutcome.price;
          const currentPoint = currentOutcome.point;
          const previousPoint = previousOutcome.point;
          let isSignificant = false;
          let movementType = '';
          let oldValue = '';
          let newValue = '';
          let isFavorable = false;
          if (currentPoint !== undefined && previousPoint !== undefined) {
            const pointDiff = Math.abs(currentPoint - previousPoint);
            if (marketKey === 'spreads' && pointDiff >= THRESHOLDS.SPREAD) {
              isSignificant = true;
              movementType = 'Spread';
              oldValue = `${previousPoint > 0 ? '+' : ''}${previousPoint}`;
              newValue = `${currentPoint > 0 ? '+' : ''}${currentPoint}`;
              isFavorable = currentPoint > previousPoint;
            } else if (marketKey === 'totals' && pointDiff >= THRESHOLDS.TOTAL) {
              isSignificant = true;
              movementType = 'Total';
              oldValue = `${previousPoint}`;
              newValue = `${currentPoint}`;
              isFavorable = currentPrice > previousPrice;
            }
          }
          if (marketKey === 'h2h') {
            const priceDiff = Math.abs(currentPrice - previousPrice);
            if (priceDiff >= THRESHOLDS.MONEYLINE) {
              isSignificant = true;
              movementType = 'Moneyline';
              oldValue = previousPrice > 0 ? `+${previousPrice}` : `${previousPrice}`;
              newValue = currentPrice > 0 ? `+${currentPrice}` : `${currentPrice}`;
              isFavorable = currentPrice > previousPrice;
            }
          }
          if (isSignificant) {
            newMovements.push({
              id: `${gameId}-${marketKey}-${outcomeKey}-${Date.now()}`,
              gameId,
              gameName: currentGame.gameName,
              sport: currentGame.sport,
              marketType: movementType,
              outcome: currentOutcome.name,
              oldLine: oldValue,
              newLine: newValue,
              oldPrice: previousPrice,
              newPrice: currentPrice,
              direction: currentPrice > previousPrice || currentPoint > previousPoint ? 'up' : 'down',
              isFavorable,
              timestamp: Date.now(),
            });
          }
        });
      });
    });
    return newMovements;
  }, []);

  const fetchEdges = useCallback(async () => {
    setLoadingEdges(true);
    setError(null);
    try {
      const res = await fetch('/api/edges');
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      setEdges(data);
      setLastEdgesFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingEdges(false);
    }
  }, []);

  const fetchMovements = useCallback(async () => {
    setLoadingMoves(true);
    setError(null);
    try {
      const res = await fetch('/api/odds');
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      const currentLines = extractLines(data);
      const previousLines = loadSnapshots();
      const newMovements = detectMovements(currentLines, previousLines);
      if (newMovements.length > 0) {
        setMovements(prev => [...newMovements, ...prev].slice(0, 50));
      }
      saveSnapshots(currentLines);
      setLastMovesFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingMoves(false);
    }
  }, [extractLines, loadSnapshots, saveSnapshots, detectMovements]);

  useEffect(() => {
    if (!isPro) return;
    fetchEdges();
    const interval = setInterval(fetchEdges, EDGES_REFRESH);
    return () => clearInterval(interval);
  }, [isPro, fetchEdges]);

  useEffect(() => {
    if (!isPro) return;
    fetchMovements();
    const interval = setInterval(fetchMovements, MOVEMENTS_REFRESH);
    return () => clearInterval(interval);
  }, [isPro, fetchMovements]);

  const refresh = () => {
    if (subTab === 'EDGES') fetchEdges();
    else fetchMovements();
  };

  if (!isPro) {
    return (
      <div style={{ padding: '20px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={28} color="#818cf8" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            Edges &amp; Lines
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '380px', margin: '0 auto', lineHeight: '1.6' }}>
            Real-time +EV edges across books plus significant line movement alerts — everything you need to find and time the right number.
          </p>
        </div>
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.5 }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                padding: '16px', marginBottom: '10px',
                background: 'rgba(30, 41, 59, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.2)',
                borderRadius: '12px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#e2e8f0' }}>🏀 Lakers vs Celtics</span>
                  <span style={{ fontSize: '13px', color: '#22c55e', fontWeight: 700 }}>+{(4 + i * 1.2).toFixed(1)}% EV</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Spread: Lakers +3.5 @ -108</div>
              </div>
            ))}
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={40} color="#818cf8" style={{ opacity: 0.8 }} />
          </div>
        </div>
        <ProBanner />
      </div>
    );
  }

  const loading = subTab === 'EDGES' ? loadingEdges : loadingMoves;
  const lastFetch = subTab === 'EDGES' ? lastEdgesFetch : lastMovesFetch;

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {subTab === 'EDGES'
            ? <Zap size={20} color="#eab308" />
            : <Activity size={20} color="#6366f1" />}
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            {subTab === 'EDGES' ? 'Edge Alerts' : 'Line Movement'}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastFetch && (
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={refresh} disabled={loading} style={{
            background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}>
            <RefreshCw size={14} color="#94a3b8" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', padding: '4px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '10px', width: 'fit-content' }}>
        {[
          { key: 'EDGES', label: 'Edges', icon: Zap, count: edges.length, activeBg: 'rgba(234,179,8,0.18)', activeBorder: 'rgba(234,179,8,0.4)', activeColor: '#eab308' },
          { key: 'LINES', label: 'Line Movement', icon: Activity, count: movements.length, activeBg: 'rgba(99,102,241,0.18)', activeBorder: 'rgba(99,102,241,0.4)', activeColor: '#818cf8' },
        ].map(({ key, label, icon: Icon, count, activeBg, activeBorder, activeColor }) => {
          const active = subTab === key;
          return (
            <button key={key} onClick={() => setSubTab(key)} style={{
              padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.12s',
              background: active ? activeBg : 'transparent',
              border: active ? `1px solid ${activeBorder}` : '1px solid transparent',
              color: active ? activeColor : '#64748b',
              display: 'flex', alignItems: 'center', gap: '6px',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <Icon size={13} />
              {label}
              {count > 0 && (
                <span style={{
                  padding: '1px 6px', borderRadius: '8px', fontSize: '10px', fontWeight: 700,
                  background: active ? 'rgba(15,23,42,0.5)' : 'rgba(71,85,105,0.25)',
                  color: active ? activeColor : '#94a3b8',
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: '16px',
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <AlertTriangle size={16} color="#ef4444" />
          <span style={{ fontSize: '12px', color: '#f87171' }}>{error}</span>
        </div>
      )}

      {subTab === 'EDGES' && (
        <>
          {loadingEdges && edges.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Zap size={36} color="#eab308" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>Scanning for edges...</p>
            </div>
          )}
          {!loadingEdges && edges.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              <TrendingUp size={36} style={{ opacity: 0.4, marginBottom: '12px' }} />
              <p style={{ fontSize: '13px' }}>No edges found right now. Check back soon — markets move fast.</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {edges.map((edge, i) => {
              const accent = sportColor(edge.sport);
              return (
                <div key={`${edge.gameId}-${edge.edge}-${i}`} style={{
                  padding: '16px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid rgba(${edge.confidence === 'HIGH' ? '34,197,94' : edge.confidence === 'MEDIUM' ? '234,179,8' : '249,115,22'}, 0.25)`,
                  borderLeft: `3px solid ${accent}`,
                  borderRadius: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '16px' }}>{edge.emoji}</span>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                          background: `${accent}20`, color: accent, letterSpacing: '0.5px',
                        }}>
                          {edge.sport}
                        </span>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                          background: `rgba(${edge.confidence === 'HIGH' ? '34,197,94' : edge.confidence === 'MEDIUM' ? '234,179,8' : '249,115,22'}, 0.15)`,
                          color: CONFIDENCE_COLORS[edge.confidence], letterSpacing: '0.5px',
                        }}>
                          {edge.confidence}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{edge.game}</div>
                    </div>
                    <div style={{
                      padding: '6px 12px', borderRadius: '8px',
                      background: 'rgba(34, 197, 94, 0.15)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}>
                      <span style={{ fontSize: '15px', fontWeight: 800, color: '#22c55e' }}>{edge.evDisplay}</span>
                      <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center' }}>EV</div>
                    </div>
                  </div>
                  <div style={{
                    padding: '10px 12px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '8px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>{edge.edge}</span>
                    <span style={{
                      padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                      background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8',
                    }}>
                      {edge.book}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {subTab === 'LINES' && (
        <>
          <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '16px', lineHeight: 1.5 }}>
            Tracking significant line movements: spreads ±1+ points, totals ±2+ points, moneylines ±15+ cents.{' '}
            <span style={{ color: '#22c55e' }}>Green = favorable move</span>,{' '}
            <span style={{ color: '#ef4444' }}>Red = unfavorable</span>.
          </p>
          {loadingMoves && movements.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Activity size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>Scanning for line movements...</p>
            </div>
          )}
          {!loadingMoves && movements.length === 0 && !error && (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              <TrendingUp size={36} style={{ opacity: 0.4, marginBottom: '12px' }} />
              <p style={{ fontSize: '13px' }}>No significant movements detected yet.</p>
              <p style={{ fontSize: '11px', marginTop: '8px' }}>Lines are tracked automatically. Check back soon!</p>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {movements.map(movement => {
              const accent = sportColor(movement.sport);
              return (
                <div key={movement.id} style={{
                  padding: '16px',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid rgba(${movement.isFavorable ? '34, 197, 94' : '239, 68, 68'}, 0.25)`,
                  borderLeft: `3px solid ${accent}`,
                  borderRadius: '12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                          background: `${accent}20`, color: accent, letterSpacing: '0.5px',
                        }}>{movement.sport}</span>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                          background: movement.marketType === 'Spread' ? 'rgba(99, 102, 241, 0.15)' :
                                     movement.marketType === 'Total' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                          color: movement.marketType === 'Spread' ? '#818cf8' :
                                 movement.marketType === 'Total' ? '#eab308' : '#22c55e',
                          letterSpacing: '0.5px',
                        }}>{movement.marketType.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>{movement.gameName}</div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '6px 10px', borderRadius: '8px',
                      background: movement.isFavorable ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${movement.isFavorable ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}>
                      {movement.direction === 'up'
                        ? <TrendingUp size={14} color={movement.isFavorable ? '#22c55e' : '#ef4444'} />
                        : <TrendingDown size={14} color={movement.isFavorable ? '#22c55e' : '#ef4444'} />}
                      <span style={{ fontSize: '12px', fontWeight: 700, color: movement.isFavorable ? '#22c55e' : '#ef4444' }}>
                        {movement.direction === 'up' ? 'UP' : 'DOWN'}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    padding: '10px 12px',
                    background: 'rgba(15, 23, 42, 0.4)',
                    borderRadius: '8px',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>{movement.outcome}</span>
                      <span style={{ fontSize: '13px', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>{movement.oldLine}</span>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>→</span>
                      <span style={{
                        fontSize: '14px',
                        color: movement.isFavorable ? '#22c55e' : '#ef4444',
                        fontWeight: 700,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>{movement.newLine}</span>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748b' }}>{formatTimeAgo(movement.timestamp)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
