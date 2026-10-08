// TrackerInsights — where results come from (book, bet type, price, timing)
// and a bankroll curve with its worst drawdown. Uses the tracker's current
// filters, so it always describes the bets on screen.
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceArea, CartesianGrid } from 'recharts';
import {
  ODDS_BUCKETS, TIMING_BUCKETS, bankrollSeries, betBook, betMarketType, breakdown, oddsBucket, timingBucket,
} from '../utils/insights.js';

const LINE = '#0b93cf'; // validated: in-band lightness, ≥3:1 on the panel surface
const MIN_SAMPLE = 5;

const GROUPINGS = [
  { key: 'type', label: 'Bet type', fn: betMarketType },
  { key: 'book', label: 'Sportsbook', fn: betBook },
  { key: 'odds', label: 'Price', fn: oddsBucket, order: [...ODDS_BUCKETS, 'Unknown'] },
  { key: 'timing', label: 'Timing', fn: timingBucket, order: [...TIMING_BUCKETS, 'Unknown'] },
];

const panel = {
  background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)',
  borderRadius: '12px', padding: '16px', marginBottom: '12px',
};
const mono = { fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: 'tabular-nums' };
const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`;
const tone = (n) => (n == null ? '#94a3b8' : n > 0 ? '#22c55e' : n < 0 ? '#f87171' : '#e2e8f0');

function readStartingBankroll() {
  try {
    const value = Number(JSON.parse(localStorage.getItem('edgefinder_bankroll_settings'))?.bankroll);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function Standouts({ rows }) {
  const solid = rows.filter(r => r.settled >= MIN_SAMPLE && r.roi != null && r.key !== 'Unknown' && r.key !== 'Not recorded');
  if (solid.length < 2) {
    return <div style={{ fontSize: '11px', color: '#64748b' }}>Standouts appear once two groups each have {MIN_SAMPLE}+ settled bets.</div>;
  }
  const best = solid.reduce((a, b) => (b.roi > a.roi ? b : a));
  const worst = solid.reduce((a, b) => (b.roi < a.roi ? b : a));
  return (
    <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.7 }}>
      Strongest: <strong>{best.key}</strong> at <span style={{ ...mono, color: tone(best.roi) }}>{best.roi > 0 ? '+' : ''}{best.roi}%</span> ROI over {best.settled} bets.{' '}
      Weakest: <strong>{worst.key}</strong> at <span style={{ ...mono, color: tone(worst.roi) }}>{worst.roi > 0 ? '+' : ''}{worst.roi}%</span> over {worst.settled}.
      <span style={{ color: '#64748b' }}> Small samples swing a lot — treat these as leads, not conclusions.</span>
    </div>
  );
}

function BankrollTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.3)', borderRadius: '6px', padding: '6px 8px', fontSize: '11px', color: '#e2e8f0' }}>
      <div style={{ color: '#94a3b8' }}>{p.index === 0 ? 'Start' : `Bet ${p.index} · ${p.label}`}</div>
      <div style={mono}>{money(p.balance)}</div>
    </div>
  );
}

export default function TrackerInsights({ bets }) {
  const [grouping, setGrouping] = useState('type');
  const [showTable, setShowTable] = useState(false);
  const active = GROUPINGS.find(g => g.key === grouping);
  const rows = useMemo(() => breakdown(bets, active.fn, active.order || null), [bets, active]);
  const start = useMemo(readStartingBankroll, []);
  const series = useMemo(() => bankrollSeries(bets, start), [bets, start]);
  const settledCount = series.points.length - 1;

  if (!bets?.some(b => !b.deleted)) return null;

  const tabButton = (on) => ({
    padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    border: on ? '1px solid rgba(45,212,191,0.42)' : '1px solid rgba(100,116,139,0.24)',
    background: on ? 'rgba(20,184,166,0.18)' : 'transparent', color: on ? '#ccfbf1' : '#94a3b8',
  });
  const dd = series.maxDrawdown;

  return (
    <section style={panel} aria-label="Insights">
      <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', letterSpacing: '0.5px', marginBottom: '10px' }}>INSIGHTS</div>

      {settledCount >= 2 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#e2e8f0' }}>{start ? 'Bankroll' : 'Running profit'}</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <span>Now <span style={{ ...mono, color: '#e2e8f0' }}>{money(series.final)}</span></span>
              <span>Peak <span style={{ ...mono, color: '#e2e8f0' }}>{money(series.peak)}</span></span>
              <span>Max drawdown <span style={{ ...mono, color: dd.amount ? '#f87171' : '#e2e8f0' }}>{money(-dd.amount)}{dd.pct != null && dd.amount ? ` (${dd.pct}%)` : ''}</span></span>
            </div>
          </div>
          <div style={{ height: '180px' }} role="img" aria-label={`${start ? 'Bankroll' : 'Running profit'} over ${settledCount} settled bets: from ${money(series.points[0].balance)} to ${money(series.final)}, peak ${money(series.peak)}, worst drawdown ${money(dd.amount)}.`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="rgba(148,163,184,0.1)" vertical={false} />
                {dd.amount > 0 && (
                  <ReferenceArea x1={dd.fromIndex} x2={dd.toIndex} fill="rgba(248,113,113,0.1)" stroke="none" ifOverflow="visible" />
                )}
                <XAxis dataKey="index" type="number" domain={[0, 'dataMax']} tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={{ stroke: 'rgba(148,163,184,0.2)' }} allowDecimals={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => `$${Math.round(v)}`} domain={['auto', 'auto']} />
                <Tooltip content={<BankrollTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.4)', strokeWidth: 1 }} />
                <Line type="linear" dataKey="balance" stroke={LINE} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#0f172a', strokeWidth: 2, fill: LINE }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>
            Settled bets in order{dd.amount > 0 ? '; the shaded stretch is your deepest drop from a peak' : ''}.
            {!start && ' Add a bankroll in setup to chart your balance instead of profit.'}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }} role="tablist" aria-label="Break down results by">
        {GROUPINGS.map(g => (
          <button key={g.key} type="button" role="tab" aria-selected={grouping === g.key} onClick={() => setGrouping(g.key)} style={tabButton(grouping === g.key)}>
            By {g.label.toLowerCase()}
          </button>
        ))}
      </div>

      <Standouts rows={rows} />

      <div style={{ overflowX: 'auto', marginTop: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', minWidth: '420px' }}>
          <thead>
            <tr style={{ color: '#64748b', textAlign: 'right' }}>
              <th style={{ textAlign: 'left', fontWeight: 600, padding: '4px 6px' }}>{active.label}</th>
              <th style={{ fontWeight: 600, padding: '4px 6px' }}>Bets</th>
              <th style={{ fontWeight: 600, padding: '4px 6px' }}>W-L-P</th>
              <th style={{ fontWeight: 600, padding: '4px 6px' }}>Win %</th>
              <th style={{ fontWeight: 600, padding: '4px 6px' }}>Profit</th>
              <th style={{ fontWeight: 600, padding: '4px 6px' }}>ROI</th>
              <th style={{ fontWeight: 600, padding: '4px 6px' }} title="Share of bets with a recorded close that beat it">Beat close</th>
            </tr>
          </thead>
          <tbody>
            {(showTable ? rows : rows.slice(0, 6)).map(r => (
              <tr key={r.key} style={{ borderTop: '1px solid rgba(71,85,105,0.2)', textAlign: 'right', color: '#cbd5e1' }}>
                <td style={{ textAlign: 'left', padding: '6px', color: '#e2e8f0', fontWeight: 600 }}>{r.key}</td>
                <td style={{ ...mono, padding: '6px' }}>{r.bets}</td>
                <td style={{ ...mono, padding: '6px' }}>{r.record}</td>
                <td style={{ ...mono, padding: '6px' }}>{r.winPct == null ? '—' : `${r.winPct}%`}</td>
                <td style={{ ...mono, padding: '6px', color: tone(r.profit) }}>{r.settled ? money(r.profit) : '—'}</td>
                <td style={{ ...mono, padding: '6px', color: tone(r.roi) }}>{r.roi == null ? '—' : `${r.roi > 0 ? '+' : ''}${r.roi}%`}</td>
                <td style={{ ...mono, padding: '6px' }} title={r.timed ? `${r.timed} with a close` : 'No closes recorded'}>{r.beatClosePct == null ? '—' : `${r.beatClosePct}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 6 && (
        <button type="button" onClick={() => setShowTable(v => !v)} style={{ marginTop: '6px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '11px', cursor: 'pointer', padding: 0 }}>
          {showTable ? 'Show fewer' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
