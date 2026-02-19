import React, { useState } from 'react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { calculateEV, kellyBet, americanToDecimal, americanToImplied, formatOdds } from '../utils/odds-math.js';

// EV Calculator ★ Pro-only tool that helps you figure out if a bet is worth making.
// It uses Expected Value (EV) and Kelly Criterion to give you a mathematical edge.

export default function EVCalculator() {
  const { tier } = useAuth();

  // --- State for user inputs ---
  // American odds the sportsbook is offering (e.g., -110, +150)
  const [odds, setOdds] = useState('-110');
  // The user's estimated true probability of winning (1-99%)
  const [prob, setProb] = useState(55);
  // Optional bankroll for Kelly bet sizing
  const [bankroll, setBankroll] = useState('');

  // If user is free tier, show the upgrade banner instead
  if (tier !== 'pro') {
    return (
      <div style={{ padding: '20px 24px', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#f8fafc' }}>🏆§® EV Calculator</h2>
        <ProBanner />
      </div>
    );
  }

  // --- Calculate everything from the inputs ---
  const oddsNum = parseInt(odds, 10);
  // isValid checks: odds can't be 0 or between -99 and 99 (invalid American odds)
  const isValid = !isNaN(oddsNum) && (oddsNum >= 100 || oddsNum <= -100);
  const trueProbability = prob / 100; // convert % to decimal (55% ★ 0.55)

  // EV% ★ positive means profitable long-term
  const ev = isValid ? calculateEV(oddsNum, trueProbability) : null;
  // Kelly% ★ what fraction of bankroll to bet
  const kelly = isValid ? kellyBet(oddsNum, trueProbability) : null;
  // Implied probability ★ what the sportsbook thinks the chance is
  const impliedProb = isValid ? americanToImplied(oddsNum) : null;
  // Decimal odds ★ another way to express the odds (used in Kelly formula)
  const decimalOdds = isValid ? americanToDecimal(oddsNum) : null;

  // If user entered a bankroll, calculate the dollar amount to bet
  const bankrollNum = parseFloat(bankroll);
  const kellyDollars = kelly && !isNaN(bankrollNum) && bankrollNum > 0
    ? (kelly * bankrollNum).toFixed(2)
    : null;

  // Is this a +EV bet? Used for color coding
  const isPositive = ev !== null && ev > 0;

  // --- Shared styles for the card containers ---
  const cardStyle = {
    padding: '16px',
    background: 'rgba(30, 41, 59, 0.6)',
    border: '1px solid rgba(71, 85, 105, 0.2)',
    borderRadius: '12px',
    marginBottom: '12px',
  };

  const labelStyle = {
    fontSize: '11px', color: '#64748b', marginBottom: '4px', display: 'block',
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    background: 'rgba(15, 23, 42, 0.8)',
    border: '1px solid rgba(71, 85, 105, 0.5)',
    borderRadius: '8px', color: '#e2e8f0',
    fontSize: '16px', fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '600px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px', color: '#f8fafc' }}>🏆§® EV Calculator</h2>
      <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
        Enter odds and your estimated win probability to see if a bet has positive expected value.
      </p>

      {/* --- INPUT CARD --- */}
      <div style={cardStyle}>
        {/* American Odds Input */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>American Odds (e.g., -110 or +150)</label>
          <input
            type="text"
            value={odds}
            onChange={(e) => setOdds(e.target.value)}
            placeholder="-110"
            style={inputStyle}
          />
        </div>

        {/* True Probability Slider */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Your Estimated True Probability: <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '14px' }}>{prob}%</span></label>
          <input
            type="range" min="1" max="99" value={prob}
            onChange={(e) => setProb(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1' }}
          />
          {/* Show the implied prob comparison */}
          {impliedProb !== null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px' }}>
              <span style={{ color: '#64748b' }}>Book implied: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{(impliedProb * 100).toFixed(1)}%</span></span>
              <span style={{ color: trueProbability > impliedProb ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                {trueProbability > impliedProb ? '★ You see edge' : '★ No edge'}
              </span>
            </div>
          )}
        </div>

        {/* Optional Bankroll Input */}
        <div>
          <label style={labelStyle}>Bankroll $ (optional ★ for Kelly bet sizing)</label>
          <input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(e.target.value)}
            placeholder="1000"
            style={{ ...inputStyle, fontSize: '14px' }}
          />
        </div>
      </div>

      {/* --- RESULTS CARD --- */}
      {isValid && (
        <div style={{
          ...cardStyle,
          border: `1px solid ${isPositive ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.3)'}`,
          background: isPositive
            ? 'rgba(34, 197, 94, 0.08)'
            : 'rgba(239, 68, 68, 0.06)',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: isPositive ? '#22c55e' : '#ef4444', marginBottom: '12px' }}>
            {isPositive ? '★ POSITIVE EV ★ This bet has edge!' : '★ NEGATIVE EV ★ No edge here'}
          </div>

          {/* Results grid ★ 2 columns on mobile-friendly layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* EV% */}
            <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>EXPECTED VALUE</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: isPositive ? '#22c55e' : '#ef4444' }}>
                {ev > 0 ? '+' : ''}{ev.toFixed(2)}%
              </div>
            </div>

            {/* Kelly % */}
            <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>KELLY BET SIZE</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: kelly > 0 ? '#c4b5fd' : '#64748b' }}>
                {(kelly * 100).toFixed(2)}%
              </div>
            </div>

            {/* Implied Prob */}
            <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>BOOK IMPLIED PROB</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#94a3b8' }}>
                {(impliedProb * 100).toFixed(1)}%
              </div>
            </div>

            {/* Your Estimate */}
            <div style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>YOUR ESTIMATE</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                {prob}%
              </div>
            </div>
          </div>

          {/* Kelly dollar amount if bankroll entered */}
          {kellyDollars && (
            <div style={{
              marginTop: '12px', padding: '12px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>RECOMMENDED BET</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#c4b5fd' }}>
                ${kellyDollars}
              </div>
              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                {(kelly * 100).toFixed(1)}% of ${bankrollNum.toLocaleString()} bankroll
              </div>
            </div>
          )}

          {/* Odds summary */}
          <div style={{ marginTop: '12px', fontSize: '11px', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <span>Odds: {formatOdds(oddsNum)}</span>
            <span>Decimal: {decimalOdds.toFixed(3)}</span>
            <span>Payout on $100: ${((decimalOdds - 1) * 100).toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* --- EXPLAINER CARD --- */}
      <div style={{ ...cardStyle, borderColor: 'rgba(99, 102, 241, 0.2)' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#c4b5fd', marginBottom: '8px' }}>🏆 What do these numbers mean?</h3>
        <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7 }}>
          <p style={{ marginBottom: '8px' }}>
            <strong style={{ color: '#e2e8f0' }}>Expected Value (EV)</strong> ★ If you made this bet 1,000 times, EV tells you your average profit/loss per bet. Positive EV = profitable long-term.
          </p>
          <p style={{ marginBottom: '8px' }}>
            <strong style={{ color: '#e2e8f0' }}>Kelly Criterion</strong> ★ A formula that tells you the optimal % of your bankroll to bet. It maximizes long-term growth while managing risk. Many sharps use "half Kelly" (bet half the suggested amount) to be safer.
          </p>
          <p>
            <strong style={{ color: '#e2e8f0' }}>Implied Probability</strong> ★ The win % the sportsbook's odds suggest. If your estimate is higher than theirs, you've found edge.
          </p>
        </div>
      </div>
    </div>
  );
}
