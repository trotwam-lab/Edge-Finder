import React, { useState } from 'react';
import { SPORTS, BOOKMAKERS } from '../constants.js';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

// Odds format options
const ODDS_FORMATS = [
  { key: 'american', label: 'American', example: '-110 / +150' },
  { key: 'decimal', label: 'Decimal', example: '1.91 / 2.50' },
  { key: 'fractional', label: 'Fractional', example: '10/11 / 3/2' },
];

// Refresh interval options (in seconds)
const REFRESH_OPTIONS = [
  { key: 30, label: '30s', desc: 'Fastest — uses more API calls' },
  { key: 60, label: '60s', desc: 'Fast — recommended for live games' },
  { key: 120, label: '2min', desc: 'Standard — balanced refresh rate' },
  { key: 300, label: '5min', desc: 'Slow — saves data & battery' },
];

// Default tab options
const DEFAULT_TAB_OPTIONS = [
  { key: 'GAMES', label: 'Games' },
  { key: 'EDGES', label: 'Edges' },
  { key: 'LINES', label: 'Lines' },
  { key: 'PROPS', label: 'Props' },
  { key: 'TRACKER', label: 'Tracker' },
];

// Game card display modes
const DISPLAY_MODES = [
  { key: 'standard', label: 'Standard', desc: 'Full game cards with all details' },
  { key: 'compact', label: 'Compact', desc: 'Condensed view — more games visible' },
];

// Section wrapper style
const sectionStyle = {
  padding: '16px',
  background: 'rgba(30, 41, 59, 0.6)',
  border: '1px solid rgba(71, 85, 105, 0.2)',
  borderRadius: '12px',
  marginBottom: '12px',
};

const sectionHeaderStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#e2e8f0',
  marginBottom: '4px',
};

const sectionSubStyle = {
  fontSize: '11px',
  color: '#64748b',
  marginBottom: '12px',
};

const toggleBtnOn = {
  padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
  background: 'rgba(99,102,241,0.3)',
  border: '1px solid rgba(99,102,241,0.5)',
  color: '#f8fafc',
  fontFamily: "'JetBrains Mono', monospace",
};

const toggleBtnOff = {
  padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
  background: 'rgba(30,41,59,0.4)',
  border: '1px solid rgba(71,85,105,0.3)',
  color: '#475569',
  fontFamily: "'JetBrains Mono', monospace",
};

// Toggle switch component
function ToggleSwitch({ enabled, onToggle, label, description }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid rgba(71, 85, 105, 0.15)',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#e2e8f0' }}>{label}</div>
        {description && <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{description}</div>}
      </div>
      <button
        onClick={onToggle}
        style={{
          width: '44px', height: '24px',
          borderRadius: '12px', border: 'none',
          background: enabled ? 'rgba(99, 102, 241, 0.6)' : 'rgba(71, 85, 105, 0.4)',
          position: 'relative', cursor: 'pointer',
          transition: 'background 0.2s ease',
          flexShrink: 0,
        }}
      >
        <div style={{
          width: '18px', height: '18px',
          borderRadius: '50%',
          background: enabled ? '#c4b5fd' : '#64748b',
          position: 'absolute',
          top: '3px',
          left: enabled ? '22px' : '3px',
          transition: 'left 0.2s ease, background 0.2s ease',
        }} />
      </button>
    </div>
  );
}

export default function Settings({
  enabledSports, setEnabledSports,
  enabledBooks, setEnabledBooks,
  watchlist, setWatchlist,
  manualOpeners, setManualOpeners,
  isConnected, countdown,
  // New settings props
  oddsFormat, setOddsFormat,
  refreshInterval, setRefreshInterval,
  defaultTab, setDefaultTab,
  displayMode, setDisplayMode,
  defaultBankroll, setDefaultBankroll,
  showEdgeScores, setShowEdgeScores,
  showFairOdds, setShowFairOdds,
  showHoldPercentage, setShowHoldPercentage,
  showInjuries, setShowInjuries,
  confirmBeforeDelete, setConfirmBeforeDelete,
  autoExpandGames, setAutoExpandGames,
}) {
  const { tier } = useAuth();
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div style={{ padding: '20px 24px', maxWidth: '700px', margin: '0 auto' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#f8fafc' }}>Settings</h2>

      {/* ================ SUBSCRIPTION STATUS ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Subscription</div>
        {tier === 'pro' ? (
          <div>
            <div style={{ fontSize: '14px', color: '#c4b5fd', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Edge Finder Pro
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
              All features unlocked. Thank you for supporting Edge Finder!
            </div>
            <a href="https://billing.stripe.com/p/login/live" target="_blank" rel="noopener" style={{
              padding: '8px 16px', background: 'rgba(99, 102, 241, 0.2)',
              border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '6px',
              color: '#818cf8', fontSize: '11px', textDecoration: 'none',
              fontFamily: "'JetBrains Mono', monospace",
            }}>Manage Subscription</a>
          </div>
        ) : (
          <ProBanner />
        )}
      </div>

      {/* ================ DISPLAY PREFERENCES ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Display Preferences</div>
        <div style={sectionSubStyle}>Customize how games and data appear</div>

        {/* Odds Format */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>ODDS FORMAT</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {ODDS_FORMATS.map(fmt => (
              <button
                key={fmt.key}
                onClick={() => setOddsFormat(fmt.key)}
                style={oddsFormat === fmt.key ? toggleBtnOn : toggleBtnOff}
              >
                <div>{fmt.label}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>{fmt.example}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Game Card Display Mode */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>GAME CARD LAYOUT</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DISPLAY_MODES.map(mode => (
              <button
                key={mode.key}
                onClick={() => setDisplayMode(mode.key)}
                style={displayMode === mode.key ? toggleBtnOn : toggleBtnOff}
              >
                <div>{mode.label}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Default Landing Tab */}
        <div style={{ marginBottom: '4px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>DEFAULT TAB ON LAUNCH</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DEFAULT_TAB_OPTIONS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setDefaultTab(tab.key)}
                style={defaultTab === tab.key ? toggleBtnOn : toggleBtnOff}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ================ DATA & REFRESH ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Data & Refresh</div>
        <div style={sectionSubStyle}>Control how often odds update and data accuracy settings</div>

        {/* Refresh Interval */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '8px', fontWeight: 600 }}>AUTO-REFRESH INTERVAL</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {REFRESH_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setRefreshInterval(opt.key)}
                style={refreshInterval === opt.key ? toggleBtnOn : toggleBtnOff}
              >
                <div>{opt.label}</div>
                <div style={{ fontSize: '9px', opacity: 0.7, marginTop: '2px' }}>{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Connection Status */}
        <div style={{
          padding: '10px 12px',
          background: 'rgba(15, 23, 42, 0.4)',
          borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: isConnected ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Next refresh in {countdown}s
          </span>
        </div>
      </div>

      {/* ================ GAME CARD OPTIONS ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Game Card Options</div>
        <div style={sectionSubStyle}>Toggle which information shows on game cards</div>

        <ToggleSwitch
          label="Edge Scores"
          description="Show Edge Score badges on game cards (Pro)"
          enabled={showEdgeScores}
          onToggle={() => setShowEdgeScores(prev => !prev)}
        />
        <ToggleSwitch
          label="Fair Odds / Hold %"
          description="Show no-vig fair lines and hold percentage"
          enabled={showFairOdds}
          onToggle={() => setShowFairOdds(prev => !prev)}
        />
        <ToggleSwitch
          label="Hold Percentage"
          description="Display the vig/juice for each market"
          enabled={showHoldPercentage}
          onToggle={() => setShowHoldPercentage(prev => !prev)}
        />
        <ToggleSwitch
          label="Injury Badges"
          description="Show injury count badges on game cards"
          enabled={showInjuries}
          onToggle={() => setShowInjuries(prev => !prev)}
        />
        <ToggleSwitch
          label="Confirm Before Delete"
          description="Ask for confirmation before deleting bets or data"
          enabled={confirmBeforeDelete}
          onToggle={() => setConfirmBeforeDelete(prev => !prev)}
        />
      </div>

      {/* ================ BANKROLL MANAGEMENT ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Bankroll Management</div>
        <div style={sectionSubStyle}>Set your default bankroll for EV Calculator and Kelly Criterion</div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: '#64748b' }}>$</span>
          <input
            type="number"
            value={defaultBankroll}
            onChange={(e) => setDefaultBankroll(e.target.value)}
            placeholder="1000"
            style={{
              flex: 1,
              padding: '10px 14px',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '8px', color: '#e2e8f0',
              fontSize: '16px', fontFamily: "'JetBrains Mono', monospace",
              outline: 'none',
            }}
          />
        </div>
        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>
          This value will pre-fill the bankroll field in EV Calc and Kelly Criterion
        </div>
      </div>

      {/* ================ SPORTS SELECTION ================ */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={sectionHeaderStyle}>Sports</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{enabledSports.length} of {Object.keys(SPORTS).length} active</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setEnabledSports(Object.keys(SPORTS))} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '4px', color: '#22c55e', fontSize: '10px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>All On</button>
            <button onClick={() => setEnabledSports([])} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontSize: '10px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>All Off</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.keys(SPORTS).map(sport => {
            const on = enabledSports.includes(sport);
            return (
              <button key={sport} onClick={() => setEnabledSports(prev => on ? prev.filter(s => s !== sport) : [...prev, sport])}
                style={on ? toggleBtnOn : toggleBtnOff}
              >{sport}</button>
            );
          })}
        </div>
      </div>

      {/* ================ SPORTSBOOKS SELECTION ================ */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={sectionHeaderStyle}>Sportsbooks</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{enabledBooks.length} of {Object.keys(BOOKMAKERS).length} active</div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setEnabledBooks(Object.keys(BOOKMAKERS))} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '4px', color: '#22c55e', fontSize: '10px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>All On</button>
            <button onClick={() => setEnabledBooks([])} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontSize: '10px', cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace" }}>All Off</button>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {Object.entries(BOOKMAKERS).map(([key, name]) => {
            const on = enabledBooks.includes(key);
            return (
              <button key={key} onClick={() => setEnabledBooks(prev => on ? prev.filter(b => b !== key) : [...prev, key])}
                style={{
                  padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  background: on ? 'rgba(34,197,94,0.25)' : 'rgba(30,41,59,0.4)',
                  border: on ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(71,85,105,0.3)',
                  color: on ? '#22c55e' : '#475569',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >{name}</button>
            );
          })}
        </div>
      </div>

      {/* ================ WATCHLIST ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Watchlist</div>
        <div style={sectionSubStyle}>
          {watchlist.length} game{watchlist.length !== 1 ? 's' : ''} saved
        </div>
        {watchlist.length > 0 && (
          <button
            onClick={() => { if (confirm('Clear entire watchlist?')) setWatchlist([]); }}
            style={{
              padding: '6px 14px', background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px',
              color: '#f87171', fontSize: '11px', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Clear Watchlist
          </button>
        )}
      </div>

      {/* ================ CLEAR DATA ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Clear Cached Data</div>
        <div style={sectionSubStyle}>Reset line history, manual openers, and prop tracking data</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => { if (confirm('Clear all line history?')) { localStorage.removeItem('edgefinder_game_lines'); location.reload(); } }}
            style={{
              padding: '6px 14px', background: 'rgba(249, 115, 22, 0.2)',
              border: '1px solid rgba(249, 115, 22, 0.4)', borderRadius: '6px',
              color: '#fb923c', fontSize: '11px', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Clear Line History
          </button>
          <button
            onClick={() => { if (confirm('Clear all manual openers?')) setManualOpeners({}); }}
            style={{
              padding: '6px 14px', background: 'rgba(249, 115, 22, 0.2)',
              border: '1px solid rgba(249, 115, 22, 0.4)', borderRadius: '6px',
              color: '#fb923c', fontSize: '11px', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Clear Openers
          </button>
          <button
            onClick={() => { if (confirm('Clear ALL local data? This cannot be undone.')) { localStorage.clear(); location.reload(); } }}
            style={{
              padding: '6px 14px', background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px',
              color: '#f87171', fontSize: '11px', cursor: 'pointer',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Reset Everything
          </button>
        </div>
      </div>

      {/* ================ ABOUT ================ */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Edge Finder Live Odds</div>
        <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>
          Real-time odds comparison across 7 sportsbooks and 25+ sports. Track line movement, find value, and sharpen your edge.
        </div>
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href="https://edgefinder.beehiiv.com" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontFamily: "'JetBrains Mono', monospace" }}>Newsletter</a>
          <a href="https://wamclaw.gumroad.com/l/pro-bettors-dashboard" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontFamily: "'JetBrains Mono', monospace" }}>Pro Dashboard</a>
          <a href="https://x.com/TROTWAM" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontFamily: "'JetBrains Mono', monospace" }}>@TROTWAM</a>
        </div>
      </div>

      {/* ================ VERSION ================ */}
      <div style={{ textAlign: 'center', padding: '16px', fontSize: '10px', color: '#475569' }}>
        Edge Finder v3.0 — Built by WAM
      </div>
    </div>
  );
}
