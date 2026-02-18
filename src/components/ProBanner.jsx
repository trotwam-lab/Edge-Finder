// ProBanner.jsx â The upgrade CTA component
// Shows free users what they're missing and gives them a button to subscribe
// When they click "Upgrade", we call our API to create a Stripe checkout session,
// then redirect them to Stripe's payment page

import React, { useState } from 'react';
import { Lock, Zap, Check } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import { PRO_FEATURES } from '../constants.js';

export default function ProBanner({ compact = false }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Called when user clicks "Upgrade to Pro"
  const handleUpgrade = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Call our serverless function to create a Stripe Checkout session
      const res = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,    // Firebase user ID
          email: user.email,   // User's email for Stripe
        }),
      });

      const data = await res.json();

      if (data.url) {
        // Redirect to Stripe's hosted payment page
        window.location.href = data.url;
      } else {
        alert('Error creating checkout session. Please try again.');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Error connecting to payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Compact version â small inline banner for locked features
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
          Pro feature â unlock all sportsbooks & tools
        </span>
        <button onClick={handleUpgrade} disabled={loading} style={{
          padding: '6px 14px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          border: 'none', borderRadius: '6px',
          color: '#fff', fontSize: '11px', fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          {loading ? '...' : 'Upgrade'}
        </button>
      </div>
    );
  }

  // Full version â premium-looking upgrade banner with feature list
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
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={20} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
            Edge Finder Pro
          </div>
          <div style={{ fontSize: '11px', color: '#a78bfa' }}>
            Sharpen your edge with premium tools
          </div>
        </div>
      </div>

      {/* Feature list */}
      <div style={{ display: 'grid', gap: '10px', marginBottom: '20px', position: 'relative' }}>
        {PRO_FEATURES.features.map((feature, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Check size={14} color="#22c55e" />
            <span style={{ fontSize: '13px', color: '#cbd5e1' }}>
              {feature.icon} {feature.text}
            </span>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <button onClick={handleUpgrade} disabled={loading} style={{
        width: '100%', padding: '14px',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        border: 'none', borderRadius: '10px',
        color: '#fff', fontSize: '14px', fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        fontFamily: "'JetBrains Mono', monospace",
        position: 'relative',
        transition: 'transform 0.15s',
      }}>
        {loading ? 'Creating checkout...' : `Upgrade to Pro â ${PRO_FEATURES.price}`}
      </button>

      <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: '#64748b' }}>
        Cancel anytime â¢ Secure payment via Stripe
      </div>
    </div>
  );
}
