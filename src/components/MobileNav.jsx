import React from 'react';
import { Target, Users, TrendingUp, Calculator, Settings, Zap, Crosshair } from 'lucide-react';

// Each tab in the bottom nav bar ★ order matters!
const tabs = [
  { key: 'GAMES', label: 'Games', icon: Target },
  { key: 'EDGES', label: 'Edges', icon: Zap },
  { key: 'PROPS', label: 'Props', icon: Users },
  { key: 'EV CALC', label: 'EV Calc', icon: Calculator },
  { key: 'TRACKER', label: 'Tracker', icon: TrendingUp },
  { key: 'PICKS', label: 'Picks', icon: Crosshair },
  { key: 'SETTINGS', label: 'Settings', icon: Settings },
];

export default function MobileNav({ activeTab, setActiveTab }) {
  return (
    <nav className="mobile-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(15, 23, 42, 0.95)',
      borderTop: '1px solid rgba(56, 189, 248, 0.1)',
      display: 'none', // shown via CSS media query
      justifyContent: 'space-around', alignItems: 'center',
      padding: '8px 0 env(safe-area-inset-bottom, 8px)',
      zIndex: 200,
      backdropFilter: 'blur(20px)'
    }}>
      {tabs.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => setActiveTab(key)} style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: activeTab === key ? '#818cf8' : '#64748b',
          fontSize: '10px', fontWeight: activeTab === key ? 700 : 400,
          padding: '4px 12px'
        }}>
          <Icon size={20} />
          {label}
        </button>
      ))}
    </nav>
  );
}
