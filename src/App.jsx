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
import LineMovement from './components/LineMovement.jsx';
import KellyCriterion from './components/KellyCriterion.jsx';
import MobileNav from './components/MobileNav.jsx';
import Settings from './components/Settings.jsx';

export default function BettingApp() {
  const { tier, refreshTier } = useAuth();

  // ——— User Preferences (persisted in localStorage) ———
  const [oddsFormat, setOddsFormat] = usePersistentState('edgefinder_odds_format', 'american');
  const [userRefreshInterval, setUserRefreshInterval] = usePersistentState('edgefinder_refresh_interval', 120);
  const [defaultTab, setDefaultTab] = usePersistentState('edgefinder_default_tab', 'GAMES');
  const [displayMode, setDisplayMode] = usePersistentState('edgefinder_display_mode', 'standard');
  const [defaultBankroll, setDefaultBankroll] = usePersistentState('edgefinder_default_bankroll', '');
  const [showEdgeScores, setShowEdgeScores] = usePersistentState('edgefinder_show_edge_scores', true);
  const [showFairOdds, setShowFairOdds] = usePersistentState('edgefinder_show_fair_odds', true);
  const [showHoldPercentage, setShowHoldPercentage] = usePersistentState('edgefinder_show_hold_pct', true);
  const [showInjuries, setShowInjuries] = usePersistentState('edgefinder_show_injuries', true);
  const [confirmBeforeDelete, setConfirmBeforeDelete] = usePersistentState('edgefinder_confirm_delete', true);
  const [autoExpandGames, setAutoExpandGames] = usePersistentState('edgefinder_auto_expand', false);

  // ——— Active tab — defaults to user preference ———
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [showCheckoutToast, setShowCheckoutToast] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);

  // Handle ?checkout=success or ?checkout=cancel URL params after Stripe payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setShowCheckoutToast(true);
      // Re-fetch the user's tier now that they've paid
      // refreshTier uses retry logic (5 attempts with exponential backoff)
      // to account for Stripe subscription propagation delay
      refreshTier();
      // Clean up the URL so the toast doesn't show again on refresh
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setShowCheckoutToast(false), 5000);
      // Safety net: re-check tier again after 15 seconds in case the
      // initial retry cycle completed before Stripe finalized
      setTimeout(() => refreshTier(), 15000);
    } else if (params.get('checkout') === 'cancel') {
      setShowCancelToast(true);
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setShowCancelToast(false), 4000);
    }
  }, []);
  const [filter, setFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGame, setExpandedGame] = useState(null);

  // —— "Quick Bet" state ——————————————————————————————————————————————————————
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
  } = useOdds({ filter, enabledSports, refreshInterval: userRefreshInterval });

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
          Welcome to Edge Finder Pro! All features unlocked.
          <button onClick={() => setShowCheckoutToast(false)} style={{
            background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px',
          }}>x</button>
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
          Checkout cancelled — no worries, you can upgrade anytime.
          <button onClick={() => setShowCancelToast(false)} style={{
            background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer', fontSize: '16px', marginLeft: '10px',
          }}>x</button>
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

          {/* Data freshness indicator */}
          {lastUpdate && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', marginBottom: '12px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(71, 85, 105, 0.15)',
              borderRadius: '8px',
              fontSize: '10px', color: '#64748b',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#ef4444',
                  display: 'inline-block',
                }} />
                <span>
                  {filteredGames.length} game{filteredGames.length !== 1 ? 's' : ''} loaded
                </span>
                <span style={{ color: '#475569' }}>|</span>
                <span>
                  Last updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
              <div>
                Refreshing every {userRefreshInterval}s
              </div>
            </div>
          )}

          {loading && games.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading games...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: displayMode === 'compact' ? '6px' : '12px' }}>
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
                    compact={displayMode === 'compact'}
                    showEdgeScores={showEdgeScores}
                    showFairOdds={showFairOdds}
                    showInjuries={showInjuries}
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

      {activeTab === 'LINES' && (
        <LineMovement />
      )}

      {activeTab === 'PROPS' && (
        <PropsView playerProps={playerProps} loading={loading} propHistory={propHistory} setPendingBet={handleSetPendingBet} />
      )}

      {activeTab === 'EV CALC' && (
        <EVCalculator defaultBankroll={defaultBankroll} />
      )}

      {activeTab === 'KELLY' && (
        <KellyCriterion defaultBankroll={defaultBankroll} />
      )}

      {activeTab === 'TRACKER' && (
        <BetTracker
          pendingBet={pendingBet}
          onBetConsumed={() => setPendingBet(null)}
        />
      )}

      {activeTab === 'SETTINGS' && (
        <Settings
          enabledSports={enabledSports} setEnabledSports={setEnabledSports}
          enabledBooks={enabledBooks} setEnabledBooks={setEnabledBooks}
          watchlist={watchlist} setWatchlist={setWatchlist}
          manualOpeners={manualOpeners} setManualOpeners={setManualOpeners}
          isConnected={isConnected} countdown={countdown}
          oddsFormat={oddsFormat} setOddsFormat={setOddsFormat}
          refreshInterval={userRefreshInterval} setRefreshInterval={setUserRefreshInterval}
          defaultTab={defaultTab} setDefaultTab={setDefaultTab}
          displayMode={displayMode} setDisplayMode={setDisplayMode}
          defaultBankroll={defaultBankroll} setDefaultBankroll={setDefaultBankroll}
          showEdgeScores={showEdgeScores} setShowEdgeScores={setShowEdgeScores}
          showFairOdds={showFairOdds} setShowFairOdds={setShowFairOdds}
          showHoldPercentage={showHoldPercentage} setShowHoldPercentage={setShowHoldPercentage}
          showInjuries={showInjuries} setShowInjuries={setShowInjuries}
          confirmBeforeDelete={confirmBeforeDelete} setConfirmBeforeDelete={setConfirmBeforeDelete}
          autoExpandGames={autoExpandGames} setAutoExpandGames={setAutoExpandGames}
        />
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

        /* Tablet — show scrollable header tabs */
        @media (min-width: 769px) and (max-width: 1200px) {
          .header-tabs {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          .header-tabs::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
