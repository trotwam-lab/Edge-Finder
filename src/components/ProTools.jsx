import React, { useState } from 'react';
import { Calculator, DollarSign } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import EVCalculator from './EVCalculator.jsx';
import KellyCriterion from './KellyCriterion.jsx';
import ProBanner from './ProBanner.jsx';

const TOOLS = [
  { key: 'EV_CALC', label: 'EV Calculator', icon: Calculator },
  { key: 'KELLY', label: 'Kelly Criterion', icon: DollarSign },
];

export default function ProTools() {
  const { tier } = useAuth();
  const [activeTool, setActiveTool] = useState('EV_CALC');
  const isPro = tier === 'pro';

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{
        padding: '18px',
        borderRadius: '16px',
        background: 'rgba(15, 23, 42, 0.55)',
        border: '1px solid rgba(71, 85, 105, 0.24)',
      }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '8px' }}>Pro Tools</div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#f8fafc', margin: 0 }}>Calculators moved into one top-level workspace</h2>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0', lineHeight: 1.6 }}>Use one tab for bet sizing and edge math instead of splitting calculators across the main nav.</p>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {TOOLS.map(({ key, label, icon: Icon }) => {
          const active = activeTool === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTool(key)}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: active ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(71,85,105,0.28)',
                background: active ? 'rgba(99,102,241,0.18)' : 'rgba(30,41,59,0.5)',
                color: active ? '#f8fafc' : '#94a3b8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '12px',
                fontWeight: 700,
              }}
            >
              <Icon size={14} />
              {label}
            </button>
          );
        })}
      </div>

      {!isPro ? (
        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(15, 23, 42, 0.55)', border: '1px solid rgba(71, 85, 105, 0.24)', borderRadius: '16px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', marginBottom: '8px' }}>Pro Tools are part of Edge Finder Pro</div>
          <ProBanner />
        </div>
      ) : activeTool === 'EV_CALC' ? <EVCalculator /> : <KellyCriterion />}
    </div>
  );
}
