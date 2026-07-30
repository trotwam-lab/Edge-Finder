// ProBanner.jsx — The upgrade CTA component
// Shows free users what they're missing and gives them a button to subscribe.
// Offers monthly (with free trial) and annual (discounted) plans; checkout
// itself is handled by the shared useCheckout hook.

import React, { useState } from 'react';
import { Lock, Zap, Check } from 'lucide-react';
import { PRO_FEATURES } from '../constants.js';
import { useCheckout } from '../hooks/useCheckout.js';

export default function ProBanner({ compact = false }) {
  const { startCheckout, isCheckingOut } = useCheckout();
  const [plan, setPlan] = useState('monthly');

  // Compact version — small inline banner for locked features
  if (compact) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        borderRadius: '10px',
      }}>
        <Lock size={16} color="#818cf8" />
        <span style={{ fontSize: '12px', color: '#c4b5fd', flex: 1 }}>
          Pro feature — unlock all sportsbooks & tools · {PRO_FEATURES.trialText}
        </span>
        <button onClick={() => startCheckout('monthly')} disabled={isCheckingOut} style={{
          padding: '6px 14px',
          background: 'var(--ef-gradient)',
          border: 'none', borderRadius: '6px',
          color: '#fff', fontSize: '11px', fontWeight: 700,
          cursor: isCheckingOut ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--ef-font-body)',
          opacity: isCheckingOut ? 0.7 : 1,
        }}>
          {isCheckingOut ? 'Loading...' : 'Try free'}
        </button>
      </div>
    );
  }

  const planButton = (key, label, sub) => {
    const active = plan === key;
    return (
      <button
        key={key}
        onClick={() => setPlan(key)}
        style={{
          flex: 1, padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
          background: active ? 'rgba(99,102,241,0.22)' : 'rgba(15,23,42,0.5)',
          border: active ? '1px solid rgba(99,102,241,0.6)' : '1px solid rgba(71,85,105,0.35)',
          color: active ? '#f8fafc' : '#94a3b8',
          fontFamily: 'var(--ef-font-body)', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 800 }}>{label}</div>
        <div style={{ fontSize: '10px', marginTop: '2px', color: active ? '#c4b5fd' : '#64748b' }}>{sub}</div>
      </button>
    );
  };

  // Full version — premium-looking upgrade banner with feature list
  return (
    <div style={{
      padding: '28px',
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.05))',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative gradient glow */}
      <div style={{
        position: 'absolute', top: '-50%', right: '-20%',
        width: '200px', height: '200px',
        background: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 0%, transparent 70%)',
        borderRadius: '50%',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', position: 'relative' }}>
        <div style={{
          width: '36px', height: '36px',
          background: 'var(--ef-gradient)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
            EdgeFinder Pro
          </div>
          <div style={{ fontSize: '11px', color: '#a78bfa' }}>
            {PRO_FEATURES.headline}
          </div>
        </div>
      </div>

      <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 18px', position: 'relative' }}>
        {PRO_FEATURES.subheadline}
      </p>

      {/* Feature list */}
      <div style={{ display: 'grid', gap: '10px', marginBottom: '18px', position: 'relative' }}>
        {PRO_FEATURES.features.map((feature, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Check size={14} color="#22c55e" />
            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
              {feature.icon} {feature.text}
            </span>
          </div>
        ))}
      </div>

      {/* Plan picker */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', position: 'relative' }}>
        {planButton('monthly', PRO_FEATURES.price, PRO_FEATURES.trialText)}
        {planButton('annual', PRO_FEATURES.priceAnnual, `${PRO_FEATURES.annualSavings} · 2 months free`)}
      </div>

      {/* CTA Button */}
      <button onClick={() => startCheckout(plan)} disabled={isCheckingOut} style={{
        width: '100%', padding: '14px',
        background: 'var(--ef-gradient)',
        border: 'none', borderRadius: '10px',
        color: '#fff', fontSize: '14px', fontWeight: 700,
        cursor: isCheckingOut ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--ef-font-body)',
        position: 'relative',
        transition: 'transform 0.15s',
        opacity: isCheckingOut ? 0.7 : 1,
      }}>
        {isCheckingOut
          ? 'Loading...'
          : plan === 'annual'
            ? `Unlock Pro — ${PRO_FEATURES.priceAnnual}`
            : `Start ${PRO_FEATURES.trialText} — then ${PRO_FEATURES.price}`}
      </button>

      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
        Cancel anytime · Secure payment via Stripe
      </div>
    </div>
  );
}
