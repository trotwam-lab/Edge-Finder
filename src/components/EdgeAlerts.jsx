import React, { useState, useEffect, useCallback } from 'react';
import { Zap, RefreshCw, Lock, TrendingUp, AlertTriangle } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

const CONFIDENCE_COLORS = {
  HIGH: '#22c55e',
  MEDIUM: '#eab308',
  LOW: '#f97316',
};

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function EdgeAlerts() {
  const { tier } = useAuth();
  const [edges, setEdges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchEdges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/edges');
      if (!res.ok) throw new Error(`API Error: ${res.status}`);
      const data = await res.json();
      setEdges(data);
      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tier !== 'pro') return;
    fetchEdges();
    const interval = setInterval(fetchEdges, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [tier, fetchEdges]);

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
            Edge Alerts
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '360px', margin: '0 auto', lineHeight: '1.6' }}>
            Real-time edge detection across all sportsbooks. Get notified when books disagree — that's where the value lives.
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

  return (
    <div style={{ padding: '20px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Zap size={20} color="#eab308" />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>Edge Alerts</h2>
          {edges.length > 0 && (
            <span style={{
              padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
              background: 'rgba(34, 197, 94, 0.2)', color: '#22c55e',
            }}>
              {edges.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastFetch && (
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              Updated {lastFetch.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button onClick={fetchEdges} disabled={loading} style={{
            background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.3)',
            borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          }}>
            <RefreshCw size={14} color="#94a3b8" style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

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
      {loading && edges.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Zap size={36} color="#eab308" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '13px' }}>Scanning for edges...</p>
        </div>
      )}

      {/* No edges */}
      {!loading && edges.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
          <TrendingUp size={36} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p style={{ fontSize: '13px' }}>No edges found right now. Check back soon — markets move fast.</p>
        </div>
      )}

      {/* Edge cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {edges.map((edge, i) => (
          <div key={`${edge.gameId}-${edge.edge}-${i}`} style={{
            padding: '16px',
            background: 'rgba(30, 41, 59, 0.6)',
            border: `1px solid rgba(${edge.confidence === 'HIGH' ? '34,197,94' : edge.confidence === 'MEDIUM' ? '234,179,8' : '249,115,22'}, 0.25)`,
            borderRadius: '12px',
            transition: 'border-color 0.2s',
          }}>
            {/* Top row: sport + game + EV */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '16px' }}>{edge.emoji}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, letterSpacing: '0.5px' }}>
                    {edge.sport}
                  </span>
                  <span style={{
                    padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                    background: `rgba(${edge.confidence === 'HIGH' ? '34,197,94' : edge.confidence === 'MEDIUM' ? '234,179,8' : '249,115,22'}, 0.15)`,
                    color: CONFIDENCE_COLORS[edge.confidence],
                    letterSpacing: '0.5px',
                  }}>
                    {edge.confidence}
                  </span>
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc' }}>
                  {edge.game}
                </div>
              </div>
              <div style={{
                padding: '6px 12px', borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
              }}>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#22c55e' }}>
                  {edge.evDisplay}
                </span>
                <div style={{ fontSize: '9px', color: '#64748b', textAlign: 'center' }}>EV</div>
              </div>
            </div>

            {/* Edge description + book */}
            <div style={{
              padding: '10px 12px',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 600 }}>
                {edge.edge}
              </span>
              <span style={{
                padding: '3px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8',
              }}>
                {edge.book}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
