import React, { useMemo, useState } from 'react';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { americanToDecimal, impliedToAmerican, formatOdds } from '../utils/odds-math.js';

// Parlay Builder — free for everyone.
// Enter the legs of a parlay and get the true combined price, the payout,
// and (optionally) the expected value if you estimate each leg's real win
// probability. Books quote parlays without showing how much vig stacks up
// per leg; this makes that visible before the bet is placed.

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid var(--ef-border-strong)',
  background: 'rgba(7, 11, 20, 0.7)',
  color: 'var(--ef-text)',
  fontSize: '13px',
  fontFamily: 'var(--ef-font-mono)',
  outline: 'none',
};

function parseAmerican(value) {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return null;
  if (n > -100 && n < 100) return null; // American odds are never between -99 and +99
  return n;
}

function newLeg() {
  return { id: Math.random().toString(36).slice(2), label: '', odds: '', estProb: '' };
}

export default function ParlayBuilder() {
  const [legs, setLegs] = useState([newLeg(), newLeg()]);
  const [stake, setStake] = useState('25');

  const updateLeg = (id, patch) => {
    setLegs(prev => prev.map(leg => (leg.id === id ? { ...leg, ...patch } : leg)));
  };

  const removeLeg = (id) => setLegs(prev => (prev.length > 1 ? prev.filter(leg => leg.id !== id) : prev));

  const summary = useMemo(() => {
    const parsed = legs
      .map(leg => ({ ...leg, oddsNum: parseAmerican(leg.odds) }))
      .filter(leg => leg.oddsNum != null);
    if (parsed.length < 2) return null;

    const combinedDecimal = parsed.reduce((acc, leg) => acc * americanToDecimal(leg.oddsNum), 1);
    const impliedProb = 1 / combinedDecimal;
    const combinedAmerican = impliedToAmerican(impliedProb);

    const stakeNum = parseFloat(stake);
    const validStake = Number.isFinite(stakeNum) && stakeNum > 0 ? stakeNum : null;

    // If the user estimated a true win % for every priced leg, we can show
    // the parlay's real EV instead of just the book's quote.
    const probs = parsed.map(leg => {
      const p = parseFloat(leg.estProb);
      return Number.isFinite(p) && p > 0 && p < 100 ? p / 100 : null;
    });
    const allProbsSet = probs.every(p => p != null);
    const trueProb = allProbsSet ? probs.reduce((acc, p) => acc * p, 1) : null;
    const evPct = trueProb != null ? (trueProb * combinedDecimal - 1) * 100 : null;

    return {
      legCount: parsed.length,
      combinedDecimal,
      combinedAmerican,
      impliedProb,
      payout: validStake != null ? validStake * combinedDecimal : null,
      profit: validStake != null ? validStake * (combinedDecimal - 1) : null,
      trueProb,
      evPct,
    };
  }, [legs, stake]);

  return (
    <div style={{ padding: '16px', display: 'grid', gap: '14px' }}>
      <div style={{ color: 'var(--ef-text-muted)', fontSize: '12px', lineHeight: 1.6 }}>
        Add each leg&apos;s American odds (e.g. <span className="ef-mono">-110</span> or{' '}
        <span className="ef-mono">+145</span>) to see the true combined price and payout.
        Optionally estimate each leg&apos;s real win chance to see whether the parlay is +EV or a donation.
      </div>

      <div style={{ display: 'grid', gap: '8px' }}>
        {legs.map((leg, idx) => {
          const oddsNum = parseAmerican(leg.odds);
          return (
            <div key={leg.id} style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.4fr) 110px 110px 34px',
              gap: '8px',
              alignItems: 'center',
              padding: '10px',
              borderRadius: 'var(--ef-radius-sm)',
              border: '1px solid var(--ef-border)',
              background: 'var(--ef-surface)',
            }}>
              <input
                type="text"
                value={leg.label}
                onChange={e => updateLeg(leg.id, { label: e.target.value })}
                placeholder={`Leg ${idx + 1} — e.g. Knicks +3.5`}
                style={{ ...inputStyle, fontFamily: 'var(--ef-font-body)' }}
              />
              <input
                type="text"
                inputMode="numeric"
                value={leg.odds}
                onChange={e => updateLeg(leg.id, { odds: e.target.value.replace(/[^0-9+-]/g, '') })}
                placeholder="Odds"
                title="American odds for this leg"
                style={{
                  ...inputStyle,
                  borderColor: leg.odds && oddsNum == null ? 'rgba(255,68,102,0.55)' : 'var(--ef-border-strong)',
                }}
              />
              <input
                type="text"
                inputMode="decimal"
                value={leg.estProb}
                onChange={e => updateLeg(leg.id, { estProb: e.target.value.replace(/[^0-9.]/g, '') })}
                placeholder="Win % (opt)"
                title="Your estimated true win probability for this leg (optional)"
                style={inputStyle}
              />
              <button
                onClick={() => removeLeg(leg.id)}
                title="Remove leg"
                aria-label={`Remove leg ${idx + 1}`}
                disabled={legs.length <= 1}
                style={{
                  height: '34px', borderRadius: '8px', border: '1px solid var(--ef-border)',
                  background: 'transparent', color: 'var(--ef-text-dim)',
                  cursor: legs.length <= 1 ? 'not-allowed' : 'pointer',
                  display: 'grid', placeItems: 'center',
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setLegs(prev => [...prev, newLeg()])}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '9px 14px', borderRadius: '8px',
            border: '1px solid var(--ef-accent-border)', background: 'var(--ef-accent-soft)',
            color: 'var(--ef-cyan)', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--ef-font-body)',
          }}
        >
          <Plus size={14} /> Add leg
        </button>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--ef-text-muted)' }}>
          Stake $
          <input
            type="text"
            inputMode="decimal"
            value={stake}
            onChange={e => setStake(e.target.value.replace(/[^0-9.]/g, ''))}
            style={{ ...inputStyle, width: '90px' }}
          />
        </label>
      </div>

      {summary ? (
        <div style={{
          borderRadius: 'var(--ef-radius)',
          border: '1px solid var(--ef-violet-border)',
          background: 'linear-gradient(135deg, rgba(123,92,255,0.1), rgba(0,200,255,0.06))',
          padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--ef-text)', fontWeight: 700, fontSize: '13px' }}>
            <Layers size={16} color="#a78bfa" />
            {summary.legCount}-leg parlay
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--ef-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Combined odds</div>
              <div className="ef-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ef-cyan)', marginTop: '4px' }}>
                {formatOdds(summary.combinedAmerican)}
              </div>
              <div className="ef-mono" style={{ fontSize: '10px', color: 'var(--ef-text-dim)', marginTop: '2px' }}>
                {summary.combinedDecimal.toFixed(2)} decimal
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--ef-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Book implied odds</div>
              <div className="ef-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ef-text)', marginTop: '4px' }}>
                {(summary.impliedProb * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '10px', color: 'var(--ef-text-dim)', marginTop: '2px' }}>chance needed to break even</div>
            </div>
            {summary.payout != null && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--ef-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Payout / profit</div>
                <div className="ef-mono" style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ef-green)', marginTop: '4px' }}>
                  ${summary.payout.toFixed(2)}
                </div>
                <div className="ef-mono" style={{ fontSize: '10px', color: 'var(--ef-text-dim)', marginTop: '2px' }}>
                  +${summary.profit.toFixed(2)} profit
                </div>
              </div>
            )}
            {summary.trueProb != null && (
              <div>
                <div style={{ fontSize: '10px', color: 'var(--ef-text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your edge</div>
                <div className="ef-mono" style={{
                  fontSize: '20px', fontWeight: 700, marginTop: '4px',
                  color: summary.evPct >= 0 ? 'var(--ef-green)' : 'var(--ef-red)',
                }}>
                  {summary.evPct >= 0 ? '+' : ''}{summary.evPct.toFixed(1)}% EV
                </div>
                <div className="ef-mono" style={{ fontSize: '10px', color: 'var(--ef-text-dim)', marginTop: '2px' }}>
                  true win chance {(summary.trueProb * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
          {summary.trueProb == null && (
            <div style={{ fontSize: '11px', color: 'var(--ef-text-muted)', marginTop: '12px', lineHeight: 1.55 }}>
              Fill in a win % on every leg to see the parlay&apos;s expected value. Rule of thumb: each extra leg
              multiplies the book&apos;s built-in vig — most 4+ leg parlays are heavily -EV.
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--ef-text-dim)', lineHeight: 1.6 }}>
          Enter valid American odds on at least two legs to price the parlay.
        </div>
      )}
    </div>
  );
}
