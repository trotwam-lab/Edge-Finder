import React from 'react';
import { Home, Target, Users, TrendingUp, Settings, FileText, Wrench } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import { NAV_TABS } from '../constants.js';

const TAB_ICONS = { Home, Target, Users, Wrench, FileText, TrendingUp, Settings };

export default function MobileNav({ activeTab, setActiveTab }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';

  return (
    <nav
      className="mobile-nav"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(7, 11, 20, 0.96)',
        borderTop: '1px solid var(--ef-border)',
        display: 'none',
        zIndex: 200,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div style={{
        display: 'flex', overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        padding: '8px 0 env(safe-area-inset-bottom, 8px)',
      }}>
        {NAV_TABS.map(({ key, label, icon, proOnly }) => {
          const Icon = TAB_ICONS[icon];
          const isLocked = proOnly && !isPro;
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => {
                if (isLocked) {
                  setActiveTab('SETTINGS');
                } else {
                  setActiveTab(key);
                }
              }}
              title={isLocked ? `${label} — Pro only` : label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: isLocked ? 'var(--ef-text-dim)' : isActive ? 'var(--ef-cyan)' : 'var(--ef-text-muted)',
                fontSize: '11px', fontWeight: isActive ? 700 : 500,
                fontFamily: 'var(--ef-font-body)',
                padding: '8px 14px', flexShrink: 0, minHeight: '52px',
                scrollSnapAlign: 'start', minWidth: '64px', position: 'relative',
              }}
            >
              <Icon size={20} />
              {label}
              {isLocked && (
                <span style={{
                  position: 'absolute', top: '2px', right: '10px',
                  fontSize: '7px', color: 'var(--ef-amber)', lineHeight: 1, fontWeight: 800,
                }}>PRO</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
