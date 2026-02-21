import React, { useState, useMemo } from 'react';
import { DollarSign, Lock, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import { kellyBet, americanToDecimal, americanToImplied } from '../utils/odds-math.js';

export default function KellyCriterion() {
  const { tier } = useAuth();
  
  // Input states
  const [odds, setOdds] = useState('-110');
  const [winProbability, setWinProbability] = useState(55);
  const [bankroll, setBankroll] = useState('1000');
  const [showExplainer, setShowExplainer] = useState(false);

  // If user is free tier, show the upgrade banner instead
  if (tier !== 'pro') {
    return (
      <div style={{ padding: '20px 24px', maxWidth: '600px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={28} color="#818cf8" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', marginBottom: '8px' }}>
            Kelly Criterion Calculator
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '360px', margin: '0 auto', lineHeight: '1.6' }}>
            Calculate optimal bet sizing using the Kelly Criterion formula. Maximize growth while managing risk.
          </p>
        </div>

        {/* Preview (blurred) */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.5 }}>
            <div style={{
              padding: '16px', marginBottom: '10px',
              background: 'rgba(30, 41, 59, 0.6)',
              border: '1px solid rgba(71, 85, 105, 0.2)',
              borderRadius: '12px',
            }}>
              <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>KELLY BET SIZE</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#c4b5fd' }}>4.55%</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>$45.50 of $1,000</div>
            </div>
          </div>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Lock size={40} color="#818cf8" style={{ opacity: 0.8 }} />
          </div>
        </div>

        <ProBanner />
      </div>
    );
  }

  // --- Calculate everything from the inputs ---
  const oddsNum = parseInt(odds, 10);
  const isValid = !isNaN(oddsNum) && (oddsNum >= 100 || oddsNum <= -100);
  const trueProbability = winProbability / 100;
  const bankrollNum = parseFloat(bankroll) || 0;

  // Calculate Kelly values
  const fullKelly = isValid ? kellyBet(oddsNum, trueProbability) : 0;
  const halfKelly = fullKelly / 2;
  const quarterKelly = fullKelly / 4;

  // Calculate dollar amounts
  const fullKellyDollars = bankrollNum > 0 ? (fullKelly * bankrollNum).toFixed(2) : '0.00';
  const halfKellyDollars = bankrollNum > 0 ? (halfKelly * bankrollNum).toFixed(2) : '0.00';
  const quarterKellyDollars = bankrollNum > 0 ? (quarterKelly * bankrollNum).toFixed(2) : '0.00';

  // Get decimal and implied for display
  const decimalOdds = isValid ? americanToDecimal(oddsNum) : null;
  const impliedProb = isValid ? americanToImplied(oddsNum) : null;
  const edge = impliedProb ? ((trueProbability - impliedProb) * 100).toFixed(1) : null;

  // Determine risk level for gauge
  const riskLevel = useMemo(() => {
    if (fullKelly <= 0.02) return { label: 'Conservative', color: '#22c55e', width: '25%' };
    if (fullKelly <= 0.05) return { label: 'Moderate', color: '#eab308', width: '50%' };
    return { label: 'Aggressive', color: '#ef4444', width: '85%' };
  }, [fullKelly]);

  // --- Shared styles ---
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

  const resultCardStyle = (isRecommended) => ({
    padding: '14px',
    background: isRecommended ? 'rgba(99, 102, 241, 0.1)' : 'rgba(15, 23, 42, 0.5)',
    border: isRecommended ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(71, 85, 105, 0.3)',
    borderRadius: '10px',
    textAlign: 'center',
  });

  return (
    <div style={{ padding: '20px 24px', maxWidth: '600px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <DollarSign size={20} color="#6366f1" />
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#f8fafc' }}>Kelly Criterion Calculator</h2>
      </div>
      <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '20px', lineHeight: 1.5 }}>
        Calculate the optimal bet size to maximize long-term bankroll growth while managing risk.
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

        {/* Win Probability Slider */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>
            Your Estimated Win Probability: 
            <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '14px' }}> {winProbability}%</span>
          </label>
          <input
            type="range" min="1" max="99" value={winProbability}
            onChange={(e) => setWinProbability(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#6366f1' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#64748b' }}>
            <span>1%</span>
            <span>50%</span>
            <span>99%</span>
          </div>
        </div>

        {/* Bankroll Input */}
        <div>
          <label style={labelStyle}>Bankroll Amount ($)</label>
          <input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(e.target.value)}
            placeholder="1000"
            style={{ ...inputStyle, fontSize: '14px' }}
          />
        </div>
      </div>

      {/* --- RISK GAUGE --- */}
      {isValid && (
        <div style={{
          ...cardStyle,
          borderColor: 'rgba(71, 85, 105, 0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', color: '#64748b' }}>RISK LEVEL</span>
            <span style={{ fontSize: '12px', fontWeight: 700, color: riskLevel.color }}>
              {riskLevel.label}
            </span>
          </div>
          <div style={{
            height: '8px',
            background: 'rgba(15, 23, 42, 0.8)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: riskLevel.width,
              background: `linear-gradient(90deg, #22c55e, ${riskLevel.color})`,
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#64748b' }}>
            <span>Conservative</span>
            <span>Moderate</span>
            <span>Aggressive</span>
          </div>
        </div>
      )}

      {/* --- RESULTS CARD --- */}
      {isValid && (
        <div style={{
          ...cardStyle,
          border: fullKelly > 0 
            ? '1px solid rgba(34, 197, 94, 0.4)' 
            : '1px solid rgba(239, 68, 68, 0.3)',
          background: fullKelly > 0
            ? 'rgba(34, 197, 94, 0.08)'
            : 'rgba(239, 68, 68, 0.06)',
        }}>
          <div style={{ 
            fontSize: '12px', 
            fontWeight: 700, 
            color: fullKelly > 0 ? '#22c55e' : '#ef4444', 
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {fullKelly > 0 ? '✓ POSITIVE EDGE DETECTED' : '✗ NO EDGE - DO NOT BET'}
            {edge && <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '8px' }}>({edge}% edge)</span>}
          </div>

          {/* Results grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {/* Quarter Kelly */}
            <div style={resultCardStyle(false)}>
              <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>QUARTER KELLY</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: '#22c55e' }}>
                {(quarterKelly * 100).toFixed(2)}%
              </div>
              {bankrollNum > 0 && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  ${quarterKellyDollars}
                </div>
              )}
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>Conservative</div>
            </div>

            {/* Half Kelly */}
            <div style={resultCardStyle(true)}>
              <div style={{ fontSize: '9px', color: '#818cf8', marginBottom: '4px', letterSpacing: '0.5px' }}>HALF KELLY ★</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#c4b5fd' }}>
                {(halfKelly * 100).toFixed(2)}%
              </div>
              {bankrollNum > 0 && (
                <div style={{ fontSize: '12px', color: '#e2e8f0', marginTop: '2px' }}>
                  ${halfKellyDollars}
                </div>
              )}
              <div style={{ fontSize: '9px', color: '#a78bfa', marginTop: '4px' }}>Recommended</div>
            </div>

            {/* Full Kelly */}
            <div style={resultCardStyle(false)}>
              <div style={{ fontSize: '9px', color: '#64748b', marginBottom: '4px', letterSpacing: '0.5px' }}>FULL KELLY</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: fullKelly > 0.05 ? '#ef4444' : '#eab308' }}>
                {(fullKelly * 100).toFixed(2)}%
              </div>
              {bankrollNum > 0 && (
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                  ${fullKellyDollars}
                </div>
              )}
              <div style={{ fontSize: '9px', color: '#64748b', marginTop: '4px' }}>Aggressive</div>
            </div>
          </div>

          {/* Math breakdown */}
          <div style={{
            marginTop: '16px', padding: '12px',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '8px',
          }}>
            <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>THE MATH</div>
            <div style={{ fontSize: '11px', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 }}>
              <div>Decimal Odds: <span style={{ color: '#e2e8f0' }}>{decimalOdds?.toFixed(3)}</span></div>
              <div>Implied Prob (book): <span style={{ color: '#e2e8f0' }}>{(impliedProb * 100).toFixed(1)}%</span></div>
              <div>Your Prob: <span style={{ color: '#e2e8f0' }}>{winProbability}%</span></div>
              <div style={{ marginTop: '4px', paddingTop: '4px', borderTop: '1px solid rgba(71, 85, 105, 0.3)' }}>
                Kelly = (bp - q) / b = <span style={{ color: '#c4b5fd' }}>{(fullKelly * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- EXPLAINER CARD --- */}
      <div style={{ ...cardStyle, borderColor: 'rgba(99, 102, 241, 0.2)' }}>
        <button 
          onClick={() => setShowExplainer(!showExplainer)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={16} color="#818cf8" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#c4b5fd' }}>
              What is the Kelly Criterion?
            </span>
          </div>
          {showExplainer ? (
            <ChevronUp size={16} color="#64748b" />
          ) : (
            <ChevronDown size={16} color="#64748b" />
          )}
        </button>

        {showExplainer && (
          <div style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.8 }}>
            <p style={{ marginBottom: '12px' }}>
              The <strong style={{ color: '#e2e8f0' }}>Kelly Criterion</strong> is a mathematical formula that determines the optimal size of a series of bets. It was developed by John Kelly at Bell Labs in 1956.
            </p>
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#e2e8f0' }}>The Formula:</strong><br />
              <code style={{ color: '#c4b5fd', fontFamily: "'JetBrains Mono', monospace" }}>
                f* = (bp - q) / b
              </code>
            </p>
            <p style={{ marginBottom: '12px' }}>
              Where:<br />
              • <span style={{ color: '#c4b5fd' }}>f*</span> = fraction of bankroll to bet<br />
              • <span style={{ color: '#c4b5fd' }}>b</span> = decimal odds - 1 (net odds received)<br />
              • <span style={{ color: '#c4b5fd' }}>p</span> = probability of winning<br />
              • <span style={{ color: '#c4b5fd' }}>q</span> = probability of losing (1 - p)
            </p>
            <p style={{ marginBottom: '12px' }}>
              <strong style={{ color: '#e2e8f0' }}>Why Half Kelly?</strong><br />
              Most professional bettors use "Half Kelly" or "Quarter Kelly" because:<br />
              • It reduces volatility and drawdowns<br />
              • It accounts for uncertainty in your probability estimate<br />
              • It provides a safety buffer against bad luck
            </p>
            <p>
              <strong style={{ color: '#e2e8f0' }}>Key Rule:</strong> Only bet when you have an edge (your estimated probability is higher than the book's implied probability). If Kelly returns 0% or negative, <span style={{ color: '#ef4444' }}>don't bet</span>.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
