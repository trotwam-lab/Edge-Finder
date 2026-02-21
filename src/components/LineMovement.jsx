import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Lock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes
const STORAGE_KEY = 'edgefinder_line_snapshots';

// Thresholds for significant line movement
const THRESHOLDS = {
  SPREAD: 1,      // 1+ points
  TOTAL: 2,       // 2+ points
  MONEYLINE: 15,  // 15+ cents
};

export default function LineMovement() {
  const { tier } = useAuth();
  const [odds, setOdds] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  // Load snapshots from localStorage
  const loadSnapshots = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);

  // Save snapshots to localStorage
  const saveSnapshots = useCallback((snapshots) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
    } catch (e) {
      console.error('Failed to save line snapshots:', e);
    }
  }, []);

  // Extract line data from odds response
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
        markets: {}
      };

      // Extract from bookmakers
      game.bookmakers?.forEach(book => {
        book.markets?.forEach(market => {
          const marketKey = market.key;
          if (!lines[game.id].markets[marketKey]) {
            lines[game.id].markets[marketKey] = {};
          }

          market.outcomes?.forEach(outcome => {
            const outcomeKey = outcome.name + (outcome.point !== undefined ? ` ${outcome.point}` : '');
            
            // Track best line per outcome
            if (!lines[game.id].markets[marketKey][outcomeKey] || 
                outcome.price > lines[game.id].markets[marketKey][outcomeKey].price) {
              lines[game.id].markets[marketKey][outcomeKey] = {
                price: outcome.price,
                point: outcome.point,
                book: book.key,
                name: outcome.name
              };
            }
          });
        });
      });
    });

    return lines;
  }, []);

  // Detect significant line movements
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

          // Check point-based markets (spread, totals)
          if (currentPoint !== undefined && previousPoint !== undefined) {
            const pointDiff = Math.abs(currentPoint - previousPoint);
            
            if (marketKey === 'spreads' && pointDiff >= THRESHOLDS.SPREAD) {
              isSignificant = true;
              movementType = 'Spread';
              oldValue = `${previousPoint > 0 ? '+' : ''}${previousPoint}`;
              newValue = `${currentPoint > 0 ? '+' : ''}${currentPoint}`;
              // Favorable if line moves in bettor's favor (gets more points)
              isFavorable = currentPoint > previousPoint;
            } else if (marketKey === 'totals' && pointDiff >= THRESHOLDS.TOTAL) {
              isSignificant = true;
              movementType = 'Total';
              oldValue = `${previousPoint}`;
              newValue = `${currentPoint}`;
              // For totals, lower is generally favorable for overs, higher for unders
              // We'll use price movement as indicator instead
              isFavorable = currentPrice > previousPrice;
            }
          }

          // Check moneyline price movement
          if (marketKey === 'h2h') {
            const priceDiff = Math.abs(currentPrice - previousPrice);
            
            if (priceDiff >= THRESHOLDS.MONEYLINE) {
              isSignificant = true;
              movementType = 'Moneyline';
              oldValue = previousPrice > 0 ? `+${previousPrice}` : `${previousPrice}`;
              newValue = currentPrice > 0 ? `+${currentPrice}` : `${currentPrice}`;
              // Favorable if price goes up (better payout)
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

  // Fetch odds data
  const fetchOdds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/odds');
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      setOdds(data);
      
      // Extract current lines
      const currentLines = extractLines(data);
      
      // Load previous snapshots
      const previousLines = loadSnapshots();
      
      // Detect movements
      const newMovements = detectMovements(currentLines, previousLines);
      
      // Add new movements to state (prepend, keep only last 50)
      if (newMovements.length > 0) {
        setMovements(prev => {
          const combined = [...newMovements, ...prev];
          return combined.slice(0, 50); // Keep last 50 movements
        });
      }
      
      // Save current lines as new snapshot
      saveSnapshots(currentLines);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [extractLines, loadSnapshots, saveSnapshots, detectMovements]);

  useEffect(() => {
    if (tier !== 'pro') return;
    fetchOdds();
    const interval = setInterval(fetchOdds, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [tier, fetchOdds]);

  // Format time ago
  const formatTimeAgo = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Free users see upgrade banner
  if (tier !== 'pro') {
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
            Line Movement
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '360px', margin: '0 auto', lineHeight: '1.6' }}>
            Track significant line movements across all markets. Get alerted when spreads, totals, or moneylines move in your favor.
          </p>
        </div>

        {/* Preview cards (blurred) */}
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
                  <span style={{ fontSize: '13px', color: '#e2e8f0' }}>🏀 Lakers @ Celtics</span>
                  <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 600 }}>📈 Spread</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>+3.5 → +4.5 (moved 1h ago)</div>
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

  // Shared card style
  const cardStyle = {
    padding: '16px',
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(71, 85, 105, 0.2)',
    borderRadius: '12px',
    marginBottom: '10px',
  };

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={20} color="#6366f1" />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Line Movement</h2>
          {movements.length > 0 && (
            <span style={{
              padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
              background: 'rgba(99, 102, 241, 0.2)', color: '#818cf8',
            }}>
              {movements.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastFetch && (
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={fetchOdds} disabled={loading} style={{
            background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}>
            <RefreshCw size={14} color="#94a3b8" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Info text */}
      <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
        Tracking significant line movements: spreads ±1+ points, totals ±2+ points, moneylines ±15+ cents. 
        <span style={{ color: '#22c55e' }}> Green = favorable move</span>, 
        <span style={{ color: '#ef4444' }}> Red = unfavorable</span>.
      </p>

      {/* Error */}
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

      {/* Loading */}
      {loading && movements.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Activity size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>Scanning for line movements...</p>
        </div>
      )}

      {/* No movements */}
      {!loading && movements.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <TrendingUp size={36} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p style={{ fontSize: '13px' }}>No significant movements detected yet.</p>
          <p style={{ fontSize: '11px', marginTop: '8px' }}>Lines are tracked automatically. Check back soon!</p>
        </div>
      )}

      {/* Movement cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {movements.map((movement) => (
          <div key={movement.id} style={{
            ...cardStyle,
            border: `1px solid rgba(${movement.isFavorable ? '34, 197, 94' : '239, 68, 68'}, 0.25)`,
            transition: 'border-color 0.2s',
          }}>
            {/* Top row: sport + game + direction */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>
                    {movement.sport}
                  </span>
                  <span style={{
                    padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                    background: movement.marketType === 'Spread' ? 'rgba(99, 102, 241, 0.15)' : 
                               movement.marketType === 'Total' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                    color: movement.marketType === 'Spread' ? '#818cf8' : 
                           movement.marketType === 'Total' ? '#eab308' : '#22c55e',
                    letterSpacing: '0.5px',
                  }}>
                    {movement.marketType.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                  {movement.gameName}
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '6px 10px', borderRadius: '8px',
                background: movement.isFavorable ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${movement.isFavorable ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}>
                {movement.direction === 'up' ? (
                  <TrendingUp size={14} color={movement.isFavorable ? '#22c55e' : '#ef4444'} />
                ) : (
                  <TrendingDown size={14} color={movement.isFavorable ? '#22c55e' : '#ef4444'} />
                )}
                <span style={{ fontSize: '12px', fontWeight: 700, color: movement.isFavorable ? '#22c55e' : '#ef4444' }}>
                  {movement.direction === 'up' ? '📈 UP' : '📉 DOWN'}
                </span>
              </div>
            </div>

            {/* Line change */}
            <div style={{
              padding: '10px 12px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#64748b' }}>{movement.outcome}</span>
                <span style={{ fontSize: '13px', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" }}>
                  {movement.oldLine}
                </span>
                <span style={{ fontSize: '12px', color: '#64748b' }}>→</span>
                <span style={{ 
                  fontSize: '14px', 
                  color: movement.isFavorable ? '#22c55e' : '#ef4444', 
                  fontWeight: 700,
                  fontFamily: "'JetBrains Mono', monospace"
                }}>
                  {movement.newLine}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: '#64748b' }}>
                {formatTimeAgo(movement.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
