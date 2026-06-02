import React from 'react';
import { Target, Users, TrendingUp, Settings, FileText, Wrench } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';

// All tabs — Pro-only tabs are gated with proOnly: true
const ALL_TABS = [
  { key: 'GAMES',       label: 'Games',     icon: Target,      proOnly: false },
  { key: 'PROPS',       label: 'Props',     icon: Users,       proOnly: false },
  { key: 'PRO_TOOLS',   label: 'Tools',     icon: Wrench,      proOnly: true  },
  { key: 'REPORT',      label: 'Report',    icon: FileText,    proOnly: true  },
  { key: 'TRACKER',     label: 'Tracker',   icon: TrendingUp,  proOnly: false },
  { key: 'SETTINGS',    label: 'Settings',  icon: Settings,    proOnly: false },
];

export default function MobileNav({ activeTab, setActiveTab }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';

  return (
    <nav
      className="mobile-nav"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'rgba(7, 17, 31, 0.97)',
        borderTop: '1px solid rgba(148, 163, 184, 0.14)',
        display: 'none',
        zIndex: 200,
        backdropFilter: 'blur(20px)',
      }}
    >
      <div style={{
        display: 'flex', overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
        padding: '8px 0 env(safe-area-inset-bottom, 8px)',
      }}>
        {ALL_TABS.map(({ key, label, icon: Icon, proOnly }) => {
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
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                background: 'none', border: 'none', cursor: 'pointer',
                color: isLocked ? 'rgba(100, 116, 139, 0.5)' : isActive ? '#5eead4' : '#64748b',
                fontSize: '10px', fontWeight: isActive ? 700 : 400,
                padding: '4px 14px', flexShrink: 0,
                scrollSnapAlign: 'start', minWidth: '60px', position: 'relative',
              }}
            >
              <Icon size={20} />
              {label}
              {isLocked && (
                <span style={{
                  position: 'absolute', top: '2px', right: '10px',
                  fontSize: '7px', color: '#fbbf24', lineHeight: 1, fontWeight: 800,
                }}>PRO</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
