import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Target, Wallet, Zap } from 'lucide-react';
import { SPORTS, BOOKMAKERS, FREE_BOOKS, PRO_FEATURES } from '../constants.js';

const chipStyle = (on) => ({
  padding: '9px 14px',
  borderRadius: '8px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: '"JetBrains Mono", monospace',
  background: on ? 'rgba(45,212,191,0.18)' : 'rgba(15,23,42,0.5)',
  border: on ? '1px solid rgba(45,212,191,0.5)' : '1px solid rgba(71,85,105,0.35)',
  color: on ? '#5eead4' : '#94a3b8',
});

function StepHeader({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        {icon}
        <h2 style={{ fontSize: '18px', color: '#f8fafc', margin: 0 }}>{title}</h2>
      </div>
      <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{subtitle}</p>
    </div>
  );
}

// First-run wizard: sports -> books -> bankroll -> Free vs Pro -> Home.
// Everything is skippable; the goal is orientation, not a paywall.
export default function FirstRunSetup({ onComplete, isPro = false }) {
  const [step, setStep] = useState(0);
  const [sports, setSports] = useState(Object.keys(SPORTS));
  const [books, setBooks] = useState(Object.keys(BOOKMAKERS));
  const [bankroll, setBankroll] = useState('1000');
  const [unitSize, setUnitSize] = useState('25');

  const toggle = (list, setList, value) => {
    setList(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const finish = () => {
    onComplete({
      sports: sports.length ? sports : Object.keys(SPORTS),
      books: books.length ? books : Object.keys(BOOKMAKERS),
      bankroll: parseFloat(bankroll) || null,
      unitSize: parseFloat(unitSize) || null,
    });
  };

  const steps = [
    {
      key: 'sports',
      canContinue: sports.length > 0,
      render: () => (
        <>
          <StepHeader
            icon={<Target size={20} color="#5eead4" />}
            title="Which sports do you bet?"
            subtitle="We'll load these first and keep your board focused. You can change this anytime in Settings."
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.keys(SPORTS).map(name => (
              <button key={name} onClick={() => toggle(sports, setSports, name)} style={chipStyle(sports.includes(name))}>
                {name}
              </button>
            ))}
          </div>
        </>
      ),
    },
    {
      key: 'books',
      canContinue: true,
      render: () => (
        <>
          <StepHeader
            icon={<Check size={20} color="#5eead4" />}
            title="Which sportsbooks do you use?"
            subtitle={isPro
              ? 'We highlight your books when comparing prices across the market.'
              : 'Free shows FanDuel, DraftKings, and BetMGM. Pick the rest anyway — they light up the moment you go Pro.'}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {Object.entries(BOOKMAKERS).map(([key, name]) => {
              const freeBook = FREE_BOOKS.includes(key);
              return (
                <button key={key} onClick={() => toggle(books, setBooks, key)} style={{
                  ...chipStyle(books.includes(key)),
                  position: 'relative',
                }}>
                  {name}
                  {!freeBook && !isPro && (
                    <span style={{ fontSize: '8px', color: '#fbbf24', fontWeight: 800, marginLeft: '5px' }}>PRO</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      ),
    },
    {
      key: 'bankroll',
      canContinue: true,
      render: () => (
        <>
          <StepHeader
            icon={<Wallet size={20} color="#5eead4" />}
            title="Set your bankroll and unit"
            subtitle="A unit is your standard bet size — most disciplined bettors use 1–2% of bankroll. This powers Kelly sizing and keeps your tracker honest. Optional, but recommended."
          />
          <div style={{ display: 'grid', gap: '14px', maxWidth: '320px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'grid', gap: '6px' }}>
              Bankroll ($)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={bankroll}
                onChange={e => setBankroll(e.target.value)}
                style={{
                  padding: '12px', borderRadius: '8px', fontSize: '14px',
                  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.4)',
                  color: '#f8fafc', fontFamily: '"JetBrains Mono", monospace',
                }}
              />
            </label>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'grid', gap: '6px' }}>
              Unit size ($)
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={unitSize}
                onChange={e => setUnitSize(e.target.value)}
                style={{
                  padding: '12px', borderRadius: '8px', fontSize: '14px',
                  background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(71,85,105,0.4)',
                  color: '#f8fafc', fontFamily: '"JetBrains Mono", monospace',
                }}
              />
            </label>
          </div>
        </>
      ),
    },
    {
      key: 'tiers',
      canContinue: true,
      render: () => (
        <>
          <StepHeader
            icon={<Zap size={20} color="#fbbf24" />}
            title="How Free and Pro work"
            subtitle="Free is a real preview, not a trial that expires. Pro adds the daily direction."
          />
          <div style={{ display: 'grid', gap: '10px', marginBottom: '6px' }}>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.35)' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#e2e8f0', marginBottom: '6px' }}>FREE — always</div>
              <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.7 }}>
                Live odds on FanDuel, DraftKings &amp; BetMGM · sample edges · 3-player prop preview · full bet tracker with CLV
              </div>
            </div>
            <div style={{ padding: '14px', borderRadius: '10px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.35)' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#c4b5fd', marginBottom: '6px' }}>PRO — {PRO_FEATURES.price}</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.7 }}>
                Daily Pro Report (where to look today) · full edge board with exact book &amp; line ·
                all {Object.keys(BOOKMAKERS).length} sportsbooks · steam moves · unlimited props
              </div>
            </div>
          </div>
        </>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(2,6,15,0.88)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      <div style={{
        width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto',
        padding: '24px', borderRadius: '18px',
        background: 'linear-gradient(160deg, #0c1727, #0f172a)',
        border: '1px solid rgba(71,85,105,0.4)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {steps.map((s, i) => (
              <span key={s.key} style={{
                width: i === step ? '22px' : '8px', height: '8px', borderRadius: '4px',
                background: i <= step ? '#2dd4bf' : 'rgba(71,85,105,0.5)',
                transition: 'width 0.2s',
              }} />
            ))}
          </div>
          <button onClick={finish} style={{
            background: 'none', border: 'none', color: '#64748b', fontSize: '11px', cursor: 'pointer',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            Skip for now
          </button>
        </div>

        {current.render()}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '22px' }}>
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '11px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
              background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(71,85,105,0.35)',
              color: step === 0 ? '#334155' : '#94a3b8',
              cursor: step === 0 ? 'not-allowed' : 'pointer',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <button
            onClick={() => isLast ? finish() : setStep(s => s + 1)}
            disabled={!current.canContinue}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '11px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 800,
              background: current.canContinue ? 'linear-gradient(135deg, #14b8a6, #6366f1)' : 'rgba(30,41,59,0.6)',
              border: 'none',
              color: current.canContinue ? '#fff' : '#475569',
              cursor: current.canContinue ? 'pointer' : 'not-allowed',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
            {isLast ? "Show me today's board" : 'Continue'} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
