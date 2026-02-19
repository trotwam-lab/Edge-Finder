import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { SPORTS, BOOKMAKERS } from './constants.js';
import { useAuth } from './AuthGate.jsx';
import ProBanner from './components/ProBanner.jsx';
import { useOdds, usePersistentState } from './hooks/useOdds.js';
import Header from './components/Header.jsx';
import SportFilter from './components/SportFilter.jsx';
import GameCard from './components/GameCard.jsx';
import GameDetails from './components/GameDetails.jsx';
import PropsView from './components/PropsView.jsx';
import EVCalculator from './components/EVCalculator.jsx';
import BetTracker from './components/BetTracker.jsx';
import EdgeAlerts from './components/EdgeAlerts.jsx';
import PickTracker from './components/PickTracker.jsx';
import MobileNav from './components/MobileNav.jsx';

export default function BettingApp() {
  const { tier, refreshTier } = useAuth();
  const [activeTab, setActiveTab] = useState('GAMES');
  const [showCheckoutToast, setShowCheckoutToast] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);

  // Handle ?checkout=success or ?checkout=cancel URL params after Stripe payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setShowCheckoutToast(true);
      // Re-fetch the user's tier now that they've paid
      refreshTier();
      // Clean up the URL so the toast doesn't show again on refresh
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setShowCheckoutToast(false), 5000);
    } else if (params.get('checkout') === 'cancel') {
      setShowCancelToast(true);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setShowCancelToast(false), 4000);
    }
  }, []);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGame, setExpandedGame] = useState(null);

  // ââ "Quick Bet" state ââââââââââââââââââââââââââââââââââââââââââââââââââââââ
  // When a user clicks on odds in a game, we store the bet info here.
  // This automatically switches to the TRACKER tab and pre-fills the form.
  const [pendingBet, setPendingBet] = useState(null);

  // Wrapper: when a bet is picked, auto-switch to the Tracker tab
  const handleSetPendingBet = (bet) => {
    setPendingBet(bet);
    setActiveTab('TRACKER'); // jump to Tracker so user sees the pre-filled form
  };
  const [watchlist, setWatchlist] = usePersistentState('edgefinder_watchlist', []);
  const [manualOpeners, setManualOpeners] = usePersistentState('edgefinder_manual_openers', {});
  const [enabledSports, setEnabledSports] = usePersistentState('edgefinder_enabled_sports', Object.keys(SPORTS));
  const [enabledBooks, setEnabledBooks] = usePersistentState('edgefinder_enabled_books', Object.keys(BOOKMAKERS));

  const {
    games, playerProps, injuries, historicOdds,
    loading, error, lastUpdate, isConnected, countdown,
    gameLineHistory, propHistory, sportLastUpdated,
    manualRefresh
  } = useOdds({ filter, enabledSports });

  const toggleWatchlist = (id) => {
    setWatchlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Filter games
  const filteredGames = games
    .filter(g => filter === 'ALL' || g.sport_key === SPORTS[filter] || g.sport_title?.includes(filter) || g.sport_key?.includes(filter.toLowerCase()))
    .filter(g => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return g.home_team?.toLowerCase().includes(s) || g.away_team?.toLowerCase().includes(s);
    });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0f1a 0%, #0f172a 50%, #1e1b4b 100%)',
      backgroundAttachment: 'fixed',
      fontFamily: "'JetBrains Mono', monospace",
      color: '#e2e8f0',
      paddingBottom: '70px' // space for mobile nav
    }}>
      {/* Success toast after Stripe checkout */}
      {showCheckoutToast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          padding: '14px 24px', background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          borderRadius: '10px', color: '#fff', fontSize: '14px', fontWeight: 700,
          zIndex: 9999, boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          ð Welcome to Edge Finder Pro! All features unlocked.
          <button onClick={() => setShowCheckoutToast(false)} style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px',
          }}>Ã</button>
        </div>
      )}

      {/* Cancel toast if user backed out of Stripe */}
      {showCancelToast && (
        <div style={{
          position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
          padding: '14px 24px', background: 'rgba(71, 85, 105, 0.9)',
          borderRadius: '10px', color: '#e2e8f0', fontSize: '14px', fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          Checkout cancelled â no worries, you can upgrade anytime.
          <button onClick={() => setShowCancelToast(false)} style={{
            background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: '16px', marginLeft: '10px',
          }}>Ã</button>
        </div>
      )}

      <Header
        activeTab={activeTab} setActiveTab={setActiveTab}
        games={games} playerProps={playerProps}
        isConnected={isConnected} injuries={injuries}
        loading={loading} countdown={countdown}
        onRefresh={manualRefresh} lastUpdate={lastUpdate}
        sportLastUpdated={sportLastUpdated}
      />

      {activeTab === 'GAMES' && (
        <div style={{ padding: '20px 24px' }}>
          <SportFilter filter={filter} setFilter={setFilter} searchTerm={searchTerm} setSearchTerm={setSearchTerm} enabledSports={enabledSports} />

          {loading && games.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading games...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredGames.map(game => (
                <div key={game.id}>
                  <GameCard
                    game={game}
                    expanded={expandedGame === game.id}
                    onToggle={() => setExpandedGame(expandedGame === game.id ? null : game.id)}
                    watchlist={watchlist}
                    onToggleWatchlist={toggleWatchlist}
                    injuries={injuries}
                    gameLineHistory={gameLineHistory}
                    setPendingBet={handleSetPendingBet}
                  />
                  {expandedGame === game.id && (
                    <GameDetails
                      game={game}
                      injuries={injuries}
                      gameLineHistory={gameLineHistory}
                      manualOpeners={manualOpeners}
                      setManualOpeners={setManualOpeners}
                      historicOdds={historicOdds}
                      enabledBooks={enabledBooks}
                      setPendingBet={handleSetPendingBet}
                    />
                  )}
                </div>
              ))}
              {filteredGames.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No games found. Try adjusting filters.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'EDGES' && (
        <EdgeAlerts />
      )}

      {activeTab === 'PROPS' && (
        <PropsView playerProps={playerProps} loading={loading} propHistory={propHistory} />
      )}

      {activeTab === 'EV CALC' && (
        <EVCalculator />
      )}

      {activeTab === 'TRACKER' && (
        <BetTracker
          pendingBet={pendingBet}
          onBetConsumed={() => setPendingBet(null)}
        />
      )}

      {activeTab === 'PICKS' && (
        <PickTracker />
      )}

      {activeTab === 'SETTINGS' && (
        <div style={{ padding: '20px 24px', maxWidth: '600px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#f8fafc' }}>âï¸ Settings</h2>

          {/* Subscription Status */}
          <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>ð Subscription</div>
            {tier === 'pro' ? (
              <div>
                <div style={{ fontSize: '14px', color: '#c4b5fd', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  â¡ You're on Edge Finder Pro
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

          {/* Sports Selection */}
          <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>ð Sports</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{enabledSports.length} of {Object.keys(SPORTS).length} active â only enabled sports will load</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setEnabledSports(Object.keys(SPORTS))} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '4px', color: '#22c55e', fontSize: '10px', cursor: 'pointer' }}>All On</button>
                <button onClick={() => setEnabledSports([])} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontSize: '10px', cursor: 'pointer' }}>All Off</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.keys(SPORTS).map(sport => {
                const on = enabledSports.includes(sport);
                return (
                  <button key={sport} onClick={() => setEnabledSports(prev => on ? prev.filter(s => s !== sport) : [...prev, sport])}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
                      background: on ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.4)',
                      border: on ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(71,85,105,0.3)',
                      color: on ? '#f8fafc' : '#475569',
                    }}
                  >{sport}</button>
                );
              })}
            </div>
          </div>

          {/* Sportsbooks Selection */}
          <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>ð Sportsbooks</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{enabledBooks.length} of {Object.keys(BOOKMAKERS).length} active â only enabled books show in game details</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setEnabledBooks(Object.keys(BOOKMAKERS))} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '4px', color: '#22c55e', fontSize: '10px', cursor: 'pointer' }}>All On</button>
                <button onClick={() => setEnabledBooks([])} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontSize: '10px', cursor: 'pointer' }}>All Off</button>
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
                    }}
                  >{name}</button>
                );
              })}
            </div>
          </div>

          {/* Refresh Status */}
          <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Auto-Refresh</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>Live games refresh every 60s. Non-live games refresh every 120s.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: isConnected ? '#10b981' : '#ef4444' }}>
                {isConnected ? 'â Connected' : 'â Disconnected'}
              </span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                | Next refresh in {countdown}s
              </span>
            </div>
          </div>

          {/* Watchlist */}
          <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>â­ Watchlist</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>
              {watchlist.length} game{watchlist.length !== 1 ? 's' : ''} saved
            </div>
            {watchlist.length > 0 && (
              <button
                onClick={() => { if (confirm('Clear entire watchlist?')) setWatchlist([]); }}
                style={{
                  padding: '6px 14px', background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px',
                  color: '#f87171', fontSize: '11px', cursor: 'pointer'
                }}
              >
                Clear Watchlist
              </button>
            )}
          </div>

          {/* Clear Data */}
          <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>ðï¸ Clear Cached Data</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>Reset line history, manual openers, and prop tracking data.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { if (confirm('Clear all line history?')) { localStorage.removeItem('edgefinder_game_lines'); location.reload(); } }}
                style={{
                  padding: '6px 14px', background: 'rgba(249, 115, 22, 0.2)',
                  border: '1px solid rgba(249, 115, 22, 0.4)', borderRadius: '6px',
                  color: '#fb923c', fontSize: '11px', cursor: 'pointer'
                }}
              >
                Clear Line History
              </button>
              <button
                onClick={() => { if (confirm('Clear all manual openers?')) setManualOpeners({}); }}
                style={{
                  padding: '6px 14px', background: 'rgba(249, 115, 22, 0.2)',
                  border: '1px solid rgba(249, 115, 22, 0.4)', borderRadius: '6px',
                  color: '#fb923c', fontSize: '11px', cursor: 'pointer'
                }}
              >
                Clear Openers
              </button>
              <button
                onClick={() => { if (confirm('Clear ALL local data? This cannot be undone.')) { localStorage.clear(); location.reload(); } }}
                style={{
                  padding: '6px 14px', background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '6px',
                  color: '#f87171', fontSize: '11px', cursor: 'pointer'
                }}
              >
                Reset Everything
              </button>
            </div>
          </div>

          {/* About */}
          <div style={{ padding: '16px', background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>ð Edge Finder Live Odds</div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>
              Real-time odds comparison across 7 sportsbooks and 25+ sports. Track line movement, find value, and sharpen your edge.
            </div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="https://edgefinder.beehiiv.com" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none' }}>ð° Newsletter</a>
              <a href="https://wamclaw.gumroad.com/l/pro-bettors-dashboard" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none' }}>ð Pro Dashboard</a>
              <a href="https://x.com/TROTWAM" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none' }}>ð¦ @TROTWAM</a>
            </div>
          </div>

          {/* Version */}
          <div style={{ textAlign: 'center', padding: '16px', fontSize: '10px', color: '#475569' }}>
            Edge Finder v2.0 â¢ Built with ð¥ by WAM
          </div>
        </div>
      )}

      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* Mobile Responsive */
        @media (max-width: 768px) {
          .mobile-nav {
            display: flex !important;
          }
          .header-inner {
            flex-direction: column !important;
            align-items: flex-start !important;
          }
          .header-tabs {
            display: none !important;
          }
          .header-status {
            width: 100%;
            justify-content: flex-start !important;
          }
          .game-card-header {
            grid-template-columns: 30px 1fr !important;
            grid-template-rows: auto auto !important;
            gap: 8px !important;
            padding: 12px !important;
          }
          .game-spread, .game-total {
            display: none !important;
          }
          .game-teams {
            grid-column: 2 !important;
          }
          .game-fair-line {
            margin-top: 4px;
          }
          .sport-filter-bar {
            flex-direction: column !important;
          }
          .sport-buttons {
            width: 100%;
            padding-bottom: 8px !important;
          }
          .sport-buttons::-webkit-scrollbar {
            display: none;
          }
          .props-stats {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .book-line-row {
            grid-template-columns: 1fr !important;
            gap: 4px !important;
          }
        }
      `}</style>
    </div>
  );
}
