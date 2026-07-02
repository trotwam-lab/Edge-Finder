import React, { useEffect, useState } from 'react';
import { Receipt, Lock } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import { formatOdds } from '../utils/odds-math.js';

// Yesterday's Receipts — the public, auto-graded track record.
// Free users see the FULL graded results of yesterday's edge scan (nothing
// blurred): the proof. The only thing behind the paywall is today's edges,
// which are the only ones still bettable. Grading = did the flagged price
// still beat the market's no-vig closing line (positive EV at close)?

function GradeBadge({ edge }) {
  if (edge.closingEv == null) {
    return (
      <span className="ef-mono" style={{
        fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px',
        background: 'rgba(125,141,168,0.14)', color: 'var(--ef-text-dim)',
      }}>PENDING</span>
    );
  }
  const beat = edge.beatClose;
  return (
    <span className="ef-mono" style={{
      fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '5px',
      background: beat ? 'var(--ef-green-soft)' : 'var(--ef-red-soft)',
      color: beat ? 'var(--ef-green)' : 'var(--ef-red)',
    }}>
      {edge.closingEv > 0 ? '+' : ''}{edge.closingEv}% at close
    </span>
  );
}

export default function EdgeReceipts({ onNavigate = () => {} }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/edge-receipts')
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then(json => { if (!cancelled) setData(json); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  // Nothing to prove yet (or backend not configured) — stay out of the way.
  if (failed || !data || data.available === false) return null;

  const y = data.yesterday;
  const d30 = data.rolling?.d30;
  const graded = y ? y.beat + y.missed : 0;

  return (
    <div style={{
      padding: '16px',
      background: 'rgba(17,24,39,0.62)',
      border: '1px solid var(--ef-border)',
      borderRadius: '14px',
      marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <Receipt size={18} color="var(--ef-cyan)" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ef-text)', letterSpacing: '0.03em' }}>
              Yesterday&apos;s Receipts
            </div>
            <div style={{ fontSize: '11px', color: 'var(--ef-text-dim)', marginTop: '2px', lineHeight: 1.5 }}>
              Every edge the scan flagged yesterday, graded against the closing line. No cherry-picking — misses included.
            </div>
          </div>
        </div>
        {y && graded > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <span className="ef-mono" style={{
              fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px',
              background: 'var(--ef-accent-soft)', color: 'var(--ef-cyan)',
            }}>
              {y.beat}/{graded} beat the close
            </span>
            {y.avgClv != null && (
              <span className="ef-mono" style={{
                fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '6px',
                background: y.avgClv >= 0 ? 'var(--ef-green-soft)' : 'var(--ef-red-soft)',
                color: y.avgClv >= 0 ? 'var(--ef-green)' : 'var(--ef-red)',
              }}>
                avg {y.avgClv > 0 ? '+' : ''}{y.avgClv}% CLV
              </span>
            )}
          </div>
        )}
      </div>

      {!y || y.edges.length === 0 ? (
        <div style={{ fontSize: '12px', color: 'var(--ef-text-muted)', lineHeight: 1.6 }}>
          The scan is building its public record — yesterday had no qualifying edges.
          Every edge flagged today gets graded here tomorrow, hit or miss.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '10px' }}>
          {y.edges.slice(0, 5).map((edge, idx, arr) => (
            <div key={`${edge.game}-${edge.edge}-${idx}`} style={{
              display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start',
              paddingBottom: idx === arr.length - 1 ? 0 : '10px',
              borderBottom: idx === arr.length - 1 ? 'none' : '1px solid rgba(125,141,168,0.14)',
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'var(--ef-text)', fontWeight: 700 }}>
                  {edge.emoji} {edge.game}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--ef-text-muted)', marginTop: '2px' }}>
                  {edge.edge} · flagged at {edge.book} ({formatOdds(edge.flaggedPrice)}, +{edge.flaggedEv}% EV)
                </div>
              </div>
              <GradeBadge edge={edge} />
            </div>
          ))}
        </div>
      )}

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(125,141,168,0.14)',
      }}>
        <div style={{ fontSize: '11px', color: 'var(--ef-text-dim)' }}>
          {d30?.graded
            ? <>Last 30 days: <strong className="ef-mono" style={{ color: 'var(--ef-text-muted)' }}>{d30.beatRate}%</strong> of {d30.graded} graded edges beat the close{d30.avgClv != null && <> · avg {d30.avgClv > 0 ? '+' : ''}{d30.avgClv}% CLV</>}</>
            : 'Rolling 7 and 30-day stats build automatically as days grade out.'}
        </div>
        {!isPro && data.todayCount > 0 && (
          <button onClick={() => onNavigate('SETTINGS')} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '8px', border: 'none',
            background: 'var(--ef-gradient)', color: '#fff',
            fontSize: '11px', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--ef-font-body)',
          }}>
            <Lock size={12} /> {data.todayCount} edge{data.todayCount === 1 ? ' is' : 's are'} live today — unlock Pro
          </button>
        )}
      </div>
    </div>
  );
}
