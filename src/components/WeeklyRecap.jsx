import React, { useMemo, useState } from 'react';
import { CalendarRange, ChevronDown, ChevronUp } from 'lucide-react';

const DAY_MS = 24 * 60 * 60 * 1000;

function fmtMoney(val) {
  const sign = val >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(val).toFixed(2)}`;
}

function marketLabel(bet) {
  if (bet?.type) return bet.type;
  const key = bet?.marketKey || '';
  if (key === 'h2h') return 'Moneyline';
  if (key === 'spreads') return 'Spread';
  if (key === 'totals') return 'Total';
  if (key.includes('player_') || key.includes('batter_') || key.includes('pitcher_')) return 'Player Prop';
  return 'Other';
}

function sportLabel(bet) {
  const key = bet?.sportKey || '';
  if (key.includes('basketball')) return 'Basketball';
  if (key.includes('americanfootball')) return 'Football';
  if (key.includes('icehockey')) return 'Hockey';
  if (key.includes('baseball')) return 'Baseball';
  if (key.includes('mma') || key.includes('boxing')) return 'Combat';
  if (key.includes('soccer')) return 'Soccer';
  return key ? key.split('_')[0] : 'Other';
}

// Weekly review card: the habit-forming "how did my week actually go?"
// summary. getTimingValue is passed in from BetTracker so CLV math stays
// in exactly one place.
export default function WeeklyRecap({ bets = [], getTimingValue }) {
  const [open, setOpen] = useState(true);

  const recap = useMemo(() => {
    const cutoff = Date.now() - 7 * DAY_MS;
    const weekBets = bets.filter(b => {
      if (b?.deleted) return false;
      const when = Date.parse(b?.settledDate || b?.date || '');
      return Number.isFinite(when) && when >= cutoff;
    });
    const settled = weekBets.filter(b => b.status === 'won' || b.status === 'lost' || b.status === 'push');
    if (settled.length === 0) return { settledCount: 0, weekCount: weekBets.length };

    const wins = settled.filter(b => b.status === 'won').length;
    const losses = settled.filter(b => b.status === 'lost').length;
    const pushes = settled.filter(b => b.status === 'push').length;
    const wagered = settled.reduce((s, b) => s + (Number(b.wager) || 0), 0);
    const netPL = settled.reduce((s, b) => s + (Number(b.profit) || 0), 0);
    const roi = wagered > 0 ? (netPL / wagered) * 100 : 0;

    // Unit size: prefer the one set in first-run setup, else avg wager.
    let unitSize = null;
    try {
      unitSize = JSON.parse(localStorage.getItem('edgefinder_bankroll_settings'))?.unitSize || null;
    } catch {}
    if (!unitSize) unitSize = settled.length ? wagered / settled.length : null;
    const units = unitSize ? netPL / unitSize : null;

    // Best sport / worst market by profit
    const bySport = new Map();
    const byMarket = new Map();
    settled.forEach(b => {
      const s = sportLabel(b);
      const m = marketLabel(b);
      bySport.set(s, (bySport.get(s) || 0) + (Number(b.profit) || 0));
      byMarket.set(m, (byMarket.get(m) || 0) + (Number(b.profit) || 0));
    });
    const sportRows = Array.from(bySport.entries()).sort((a, b) => b[1] - a[1]);
    const marketRows = Array.from(byMarket.entries()).sort((a, b) => a[1] - b[1]);
    const bestSport = sportRows[0] || null;
    const worstMarket = marketRows[0] && marketRows[0][1] < 0 ? marketRows[0] : null;

    // CLV summary across all bets from the week that have timing data
    const timings = weekBets
      .map(b => (typeof getTimingValue === 'function' ? getTimingValue(b) : null))
      .filter(t => t && t.value != null);
    const beatClose = timings.filter(t => t.value > 0).length;
    const beatCloseRate = timings.length ? (beatClose / timings.length) * 100 : null;

    return {
      settledCount: settled.length,
      weekCount: weekBets.length,
      wins, losses, pushes, netPL, roi, units, unitSize,
      bestSport, worstMarket,
      timingCount: timings.length,
      beatCloseRate,
    };
  }, [bets, getTimingValue]);

  const statBox = (label, value, color = '#e2e8f0', sub = null) => (
    <div key={label} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(2,6,23,0.34)', border: '1px solid rgba(100,116,139,0.18)' }}>
      <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '15px', fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px' }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(15,23,42,0.6))',
      border: '1px solid rgba(99,102,241,0.28)',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '12px',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: '#e2e8f0', fontFamily: '"JetBrains Mono", monospace',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em' }}>
          <CalendarRange size={15} color="#a78bfa" /> YOUR WEEK IN REVIEW
          <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>last 7 days</span>
        </span>
        {open ? <ChevronUp size={15} color="#64748b" /> : <ChevronDown size={15} color="#64748b" />}
      </button>

      {open && (
        recap.settledCount === 0 ? (
          <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6, marginTop: '12px' }}>
            {recap.weekCount > 0
              ? `You tracked ${recap.weekCount} bet${recap.weekCount === 1 ? '' : 's'} this week — settle them (won/lost) and your weekly recap builds itself here.`
              : 'No bets tracked in the last 7 days. Track every bet — even losers — and this recap shows whether your process is actually improving.'}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '12px' }}>
              {statBox('Record', `${recap.wins}-${recap.losses}-${recap.pushes}`, '#c4b5fd')}
              {statBox('Units', recap.units != null ? `${recap.units >= 0 ? '+' : ''}${recap.units.toFixed(2)}u` : '—', recap.units >= 0 ? '#22c55e' : '#f87171', recap.unitSize ? `1u = $${Number(recap.unitSize).toFixed(0)}` : null)}
              {statBox('Net P/L', fmtMoney(recap.netPL), recap.netPL >= 0 ? '#22c55e' : '#f87171')}
              {statBox('ROI', `${recap.roi >= 0 ? '+' : ''}${recap.roi.toFixed(1)}%`, recap.roi >= 0 ? '#22c55e' : '#f87171')}
            </div>
            <div style={{ display: 'grid', gap: '6px', marginTop: '12px', fontSize: '11px', color: '#cbd5e1', lineHeight: 1.6 }}>
              {recap.bestSport && (
                <div>
                  🏆 Best sport: <strong style={{ color: recap.bestSport[1] >= 0 ? '#22c55e' : '#f87171' }}>{recap.bestSport[0]}</strong> ({fmtMoney(recap.bestSport[1])})
                </div>
              )}
              {recap.worstMarket && (
                <div>
                  ⚠️ Toughest market: <strong style={{ color: '#f87171' }}>{recap.worstMarket[0]}</strong> ({fmtMoney(recap.worstMarket[1])}) — consider sizing down here
                </div>
              )}
              {recap.beatCloseRate != null ? (
                <div>
                  ⏱️ You beat the closing line <strong style={{ color: recap.beatCloseRate >= 52 ? '#22c55e' : recap.beatCloseRate >= 45 ? '#eab308' : '#f87171' }}>
                    {recap.beatCloseRate.toFixed(0)}%
                  </strong> of the time ({recap.timingCount} bet{recap.timingCount === 1 ? '' : 's'} with line data).
                  {' '}Beating the close consistently is the strongest sign of long-term winning.
                </div>
              ) : (
                <div style={{ color: '#64748b' }}>
                  ⏱️ No closing-line data yet this week — bets placed through the app capture it automatically.
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
