import React, { Suspense, lazy, useState, useEffect, useMemo, useDeferredValue } from 'react';
import { Activity, AlertTriangle, BarChart3, Loader, X } from 'lucide-react';
import { SPORTS, BOOKMAKERS, FREE_BOOKS } from './constants.js';
import { useAuth } from './AuthGate.jsx';
import ProBanner from './components/ProBanner.jsx';
import { useOdds, usePersistentState } from './hooks/useOdds.js';
import { useAlerts } from './hooks/useAlerts.js';
import Header from './components/Header.jsx';
import SportFilter from './components/SportFilter.jsx';
import GameCard from './components/GameCard.jsx';
import GameTicker from './components/GameTicker.jsx';
import MobileNav from './components/MobileNav.jsx';
import OnboardingCoach from './components/OnboardingCoach.jsx';
import HomeDashboard from './components/HomeDashboard.jsx';
import FirstRunSetup from './components/FirstRunSetup.jsx';
import { useTeamLogos, SPORT_VISUALS, getSportVisual } from './utils/team-logos.js';
import { isGameLive, getGameStatus } from './utils/live-status.js';

const tabLoaders = {
  PropsView: () => import('./components/PropsView.jsx'),
  ProTools: () => import('./components/ProTools.jsx'),
  GameDetails: () => import('./components/GameDetails.jsx'),
  DailyProReport: () => import('./components/DailyProReport.jsx'),
  BetTracker: () => import('./components/BetTracker.jsx'),
};

const OLD_ONBOARDING_SPORT_DEFAULTS = ['NBA', 'NFL', 'MLB', 'NHL'];

function sameSet(a = [], b = []) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const values = new Set(a);
  return b.every(item => values.has(item));
}

const PropsView = lazy(tabLoaders.PropsView);
const ProTools = lazy(tabLoaders.ProTools);
const GameDetails = lazy(tabLoaders.GameDetails);
const DailyProReport = lazy(tabLoaders.DailyProReport);
const BetTracker = lazy(tabLoaders.BetTracker);

function TabFallback({ label = 'Loading...' }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
      <Loader size={28} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
      <div style={{ marginTop: '12px', fontSize: '12px' }}>{label}</div>
    </div>
  );
}

function MarketSummary({ games, injuries, lastUpdate, isConnected, loading }) {
  const liveGames = games.filter(isGameLive).length;
  const injuryCount = Object.values(injuries || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  const bookCount = games.reduce((max, game) => Math.max(max, game.bookmakers?.length || 0), 0);
  const trackedMarkets = games.reduce((sum, game) => {
    const markets = game.bookmakers?.reduce((bookSum, book) => bookSum + (book.markets?.length || 0), 0) || 0;
    return sum + markets;
  }, 0);
  const watchCandidates = Math.min(games.length, Math.max(0, Math.round((games.length || 0) * 0.28) + liveGames));
  const updated = lastUpdate
    ? lastUpdate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : 'Waiting';
  const stats = [
    { label: 'Games', value: games.length || '--', tone: '#38bdf8' },
    { label: 'Books', value: bookCount || '--', tone: '#2dd4bf' },
    { label: 'Markets', value: trackedMarkets || '--', tone: '#a3e635' },
    { label: 'Alerts', value: injuryCount + liveGames, tone: injuryCount || liveGames ? '#f59e0b' : '#64748b' },
  ];
  const intelligenceCards = [
    {
      icon: Activity,
      label: 'Market Pulse',
      title: liveGames ? `${liveGames} live board${liveGames === 1 ? '' : 's'} moving` : 'Pregame board building',
      note: isConnected ? 'Live odds, scores, and book coverage are connected.' : 'Using cached odds until the feed reconnects.',
      tone: '#38bdf8',
    },
    {
      icon: BarChart3,
      label: 'Line Shopping',
      title: `${bookCount || '--'} books scanned per matchup`,
      note: 'Best numbers and book disagreement are surfaced inside each game card.',
      tone: '#2dd4bf',
    },
    {
      icon: AlertTriangle,
      label: 'Watchlist',
      title: `${watchCandidates || '--'} games worth checking first`,
      note: 'Start with injury flags, live games, and mismatched book prices before browsing the full slate.',
      tone: '#f59e0b',
    },
  ];

  return (
    <section className="market-summary">
      <div className="market-summary-copy">
        <div className="market-kicker">{isConnected ? 'Live Market Intelligence' : 'Offline Cache'} · {loading ? 'Updating' : `Updated ${updated}`}</div>
        <h1>Find the best betting number before the market closes.</h1>
        <p>
          Scan today&apos;s slate by market pressure, book disagreement, live movement, and injury risk.
          The board is built to show what deserves attention first.
        </p>
      </div>
      <div className="market-stats">
        {stats.map(stat => (
          <div className="market-stat" key={stat.label}>
            <span>{stat.label}</span>
            <strong style={{ color: stat.tone }}>{stat.value}</strong>
          </div>
        ))}
      </div>
      <div className="market-intel-grid">
        {intelligenceCards.map(card => {
          const Icon = card.icon;
          return (
            <article className="market-intel-card" key={card.label} style={{ '--intel-color': card.tone }}>
              <div className="market-intel-icon"><Icon size={15} /></div>
              <div>
                <span>{card.label}</span>
                <strong>{card.title}</strong>
                <p>{card.note}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function BettingApp() {
  const { user, tier, refreshTier } = useAuth();
  const [activeTab, setActiveTab] = useState('HOME');
  const [showCheckoutToast, setShowCheckoutToast] = useState(false);
  const [showCancelToast, setShowCancelToast] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setShowCheckoutToast(true);
      refreshTier();
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
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [expandedGame, setExpandedGame] = useState(null);
  const [pendingBet, setPendingBet] = useState(null);
  // Enrich incoming bet with the historic opener price (if one was captured
  // when we first saw this game), so CLV can be computed automatically.
  const handleSetPendingBet = (bet) => {
    let openingOdds = null;
    try {
      const opener = bet.gameId ? historicOdds?.[bet.gameId] : null;
      if (opener && bet.marketKey === 'h2h' && bet.outcomeName) {
        const match = opener.h2h?.find(o => o.name === bet.outcomeName);
        if (match?.price != null) openingOdds = match.price;
      }
    } catch {}
    setPendingBet({ ...bet, openingOdds });
    setActiveTab('TRACKER');
  };

  const [watchlist, setWatchlist] = usePersistentState('edgefinder_watchlist', []);
  const [manualOpeners, setManualOpeners] = usePersistentState('edgefinder_manual_openers', {});
  const [enabledSports, setEnabledSports] = usePersistentState('edgefinder_enabled_sports', Object.keys(SPORTS));
  const [enabledBooks, setEnabledBooks] = usePersistentState('edgefinder_enabled_books', Object.keys(BOOKMAKERS));
  const [shareActivity, setShareActivity] = usePersistentState('edgefinder_share_activity', false);
  const [communityHandle, setCommunityHandle] = usePersistentState('edgefinder_community_handle', '');
  const [firstRunComplete, setFirstRunComplete] = usePersistentState('edgefinder_first_run_complete', false);

  useEffect(() => {
    if (sameSet(enabledSports, OLD_ONBOARDING_SPORT_DEFAULTS)) {
      setEnabledSports(Object.keys(SPORTS));
    }
    if (sameSet(enabledBooks, FREE_BOOKS)) {
      setEnabledBooks(Object.keys(BOOKMAKERS));
    }
    // One-time migration: sports added to the app after a user saved their
    // preferences (e.g. WNBA) would otherwise stay invisible forever. The
    // flag keeps us from re-adding a sport the user deliberately turns off.
    const NEW_SPORTS = ['WNBA'];
    NEW_SPORTS.forEach(sport => {
      const migrationKey = `edgefinder_sport_added_${sport}`;
      try {
        if (localStorage.getItem(migrationKey)) return;
        localStorage.setItem(migrationKey, 'true');
        setEnabledSports(prev => prev.includes(sport) ? prev : [...prev, sport]);
      } catch {}
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFirstRunComplete = ({ sports, books, bankroll, unitSize }) => {
    if (sports?.length) setEnabledSports(sports);
    if (books?.length) setEnabledBooks(books);
    if (bankroll || unitSize) {
      try {
        localStorage.setItem('edgefinder_bankroll_settings', JSON.stringify({ bankroll, unitSize }));
      } catch {}
    }
    setFirstRunComplete(true);
    setActiveTab('HOME');
  };

  const {
    games, playerProps, injuries, historicOdds, loading, error, lastUpdate,
    isConnected, countdown, gameLineHistory, propHistory, sportLastUpdated, manualRefresh,
  } = useOdds({ filter, enabledSports });

  const toggleWatchlist = (id) => {
    setWatchlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // Open a specific game (from the ticker / game-of-the-day) on the board,
  // expanded. Reset filter+search so the game is guaranteed to be visible.
  const handleSelectGame = (game) => {
    if (!game?.id) return;
    setFilter('ALL');
    setSearchTerm('');
    setExpandedGame(game.id);
    setActiveTab('GAMES');
  };

  const alertsApi = useAlerts({ games, watchlist, gameLineHistory, historicOdds, tier });

  const handleManageSubscription = async () => {
    if (!user) {
      alert('Please log in first to manage your subscription.');
      return;
    }

    setIsOpeningPortal(true);
    try {
      // Identity travels as a verified ID token — the server ignores any
      // body-supplied userId/email for billing actions.
      const token = await user.getIdToken();
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Billing portal error:', data.error);
        alert('Failed to open billing portal: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Billing portal error:', error);
      alert('Failed to open billing portal. Please try again.');
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const filteredGames = useMemo(() => games
    .filter(g =>
      filter === 'ALL' ||
      g.sport_key === SPORTS[filter] ||
      g.sport_title?.includes(filter) ||
      g.sport_key?.includes(filter.toLowerCase())
    )
    .filter(g => {
      if (!deferredSearchTerm) return true;
      const s = deferredSearchTerm.toLowerCase();
      return g.home_team?.toLowerCase().includes(s) || g.away_team?.toLowerCase().includes(s);
    }), [games, filter, deferredSearchTerm]);

  // Group filtered games by sport so each sport gets its own header + accent.
  // When the user filters to a specific sport the grouping still works but
  // only that group will render, keeping the Games tab consistent.
  const gamesBySport = useMemo(() => {
    const now = Date.now();
    // Precompute status once per game (used for both ordering passes).
    const statusOf = new Map();
    filteredGames.forEach(g => statusOf.set(g.id, getGameStatus(g)));

    const buckets = new Map();
    filteredGames.forEach(g => {
      const key = g.sport_key || 'other';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(g);
    });

    // Order sports by what is actually happening soonest — NOT a fixed list.
    // Live sports first, then by their soonest live/upcoming game. This keeps
    // in-season leagues (MLB in summer) ahead of leagues whose games are months
    // out (e.g. NFL Week 1 lines that books post back in the spring), and it
    // self-corrects as seasons change instead of hardcoding any sport order.
    const rankOf = (sportGames) => {
      let hasLive = false;
      let earliest = Infinity;
      sportGames.forEach(g => {
        const s = statusOf.get(g.id);
        if (s?.isLive) { hasLive = true; earliest = Math.min(earliest, now); }
        else if (s?.isUpcoming) {
          const t = Date.parse(g.commence_time);
          if (Number.isFinite(t)) earliest = Math.min(earliest, t);
        }
      });
      return { hasLive, earliest };
    };

    // Within each sport: live games first, then soonest start time.
    buckets.forEach(list => list.sort((a, b) => {
      const sa = statusOf.get(a.id), sb = statusOf.get(b.id);
      if (!!sa?.isLive !== !!sb?.isLive) return sa?.isLive ? -1 : 1;
      return (Date.parse(a.commence_time) || Infinity) - (Date.parse(b.commence_time) || Infinity);
    }));

    return Array.from(buckets.entries()).sort(([, ga], [, gb]) => {
      const ra = rankOf(ga), rb = rankOf(gb);
      if (ra.hasLive !== rb.hasLive) return ra.hasLive ? -1 : 1;
      return ra.earliest - rb.earliest;
    });
  }, [filteredGames]);

  const teamLogoMap = useTeamLogos(games);

  useEffect(() => {
    if (activeTab === 'EV_CALC' || activeTab === 'KELLY' || activeTab === 'EDGES_LINES') {
      setActiveTab('PRO_TOOLS');
    }
  }, [activeTab]);

  useEffect(() => {
    // Warm heavy tab chunks on desktop only. Phones pay real startup CPU and
    // network for tabs the user may never open — on-demand loading with the
    // Suspense fallback is the snappier trade there.
    if (window.matchMedia?.('(max-width: 768px)')?.matches) return;
    const warmTabs = () => {
      tabLoaders.PropsView();
      tabLoaders.BetTracker();
      tabLoaders.ProTools();
    };
    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmTabs, { timeout: 2500 });
      return () => window.cancelIdleCallback?.(idleId);
    }
    const timer = window.setTimeout(warmTabs, 1200);
    return () => window.clearTimeout(timer);
  }, []);

  const toastBase = {
    position: 'fixed', top: 'calc(14px + env(safe-area-inset-top, 0px))', left: '50%', transform: 'translateX(-50%)',
    padding: '14px 24px', borderRadius: '10px', zIndex: 9999,
    display: 'flex', alignItems: 'center', gap: '10px',
    fontFamily: 'var(--ef-font-body)', fontSize: '14px', fontWeight: 600,
  };

  return (
    <div className="edge-app-shell" style={{
      minHeight: '100vh',
      background: `
        radial-gradient(1100px 480px at 85% -10%, rgba(123, 92, 255, 0.14), transparent 60%),
        radial-gradient(900px 420px at 8% -6%, rgba(0, 200, 255, 0.1), transparent 55%),
        var(--ef-bg)`,
      backgroundAttachment: 'fixed',
      fontFamily: 'var(--ef-font-body)',
      color: 'var(--ef-text)',
      paddingBottom: 'calc(82px + env(safe-area-inset-bottom, 0px))',
    }}>
      {showCheckoutToast && (
        <div style={{ ...toastBase, background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', boxShadow: '0 4px 20px rgba(34,197,94,0.4)', fontWeight: 700 }}>
          {'🎯 Welcome to EdgeFinder Pro! All features unlocked.'}
          <button onClick={() => setShowCheckoutToast(false)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}
      {showCancelToast && (
        <div style={{ ...toastBase, background: 'rgba(71,85,105,0.9)', color: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
          {'Checkout cancelled - no worries, you can upgrade anytime.'}
          <button onClick={() => setShowCancelToast(false)} style={{ background: 'none', border: 'none', color: '#e2e8f0', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}
      {!firstRunComplete && <FirstRunSetup onComplete={handleFirstRunComplete} isPro={tier === 'pro'} />}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        games={games}
        playerProps={playerProps}
        isConnected={isConnected}
        injuries={injuries}
        loading={loading}
        countdown={countdown}
        onRefresh={manualRefresh}
        lastUpdate={lastUpdate}
        sportLastUpdated={sportLastUpdated}
        alertsApi={alertsApi}
      />
      {activeTab === 'HOME' && (
        <HomeDashboard
          games={games}
          playerProps={playerProps}
          loading={loading}
          watchlist={watchlist}
          onToggleWatchlist={toggleWatchlist}
          gameLineHistory={gameLineHistory}
          historicOdds={historicOdds}
          onNavigate={setActiveTab}
          onSelectGame={handleSelectGame}
          onRefresh={manualRefresh}
        />
      )}
      {activeTab === 'GAMES' && (
        <main className="edge-app-main">
          <MarketSummary
            games={games}
            injuries={injuries}
            lastUpdate={lastUpdate}
            isConnected={isConnected}
            loading={loading}
          />
          <GameTicker games={games} onSelect={handleSelectGame} />
          <OnboardingCoach onNavigate={setActiveTab} />
          <SportFilter
            filter={filter}
            setFilter={setFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            enabledSports={enabledSports}
            games={games}
          />
          {loading && games.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px' }}>
              <Loader size={36} color="#6366f1" style={{ animation: 'spin 1s linear infinite' }} />
              <p style={{ marginTop: '16px', color: '#94a3b8' }}>Loading games...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              {gamesBySport.map(([sportKey, sportGames]) => {
                const visual = getSportVisual(sportKey);
                const liveCount = sportGames.filter(isGameLive).length;
                return (
                  <div key={sportKey}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      marginBottom: '10px', paddingLeft: '2px',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 10px', borderRadius: '6px',
                        background: 'rgba(15,23,42,0.7)',
                        border: `1px solid ${visual.color}40`,
                      }}>
                        <span style={{ fontSize: '16px' }}>{visual.icon}</span>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: visual.color, letterSpacing: 0 }}>
                          {visual.short}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {sportGames.length} game{sportGames.length !== 1 ? 's' : ''}
                        </span>
                        {liveCount > 0 && (
                          <span style={{
                            fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
                            background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontWeight: 700,
                          }}>{liveCount} LIVE</span>
                        )}
                      </div>
                      <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${visual.color}55, transparent)` }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {sportGames.map(game => (
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
                            logoMap={teamLogoMap}
                          />
                          {expandedGame === game.id && (
                            <Suspense fallback={<TabFallback label="Loading game details..." />}>
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
                            </Suspense>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filteredGames.length === 0 && !loading && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No games found. Try adjusting filters.</div>
              )}
            </div>
          )}
        </main>
      )}
      {activeTab === 'PROPS' && <Suspense fallback={<TabFallback label="Loading props view..." />}><PropsView playerProps={playerProps} games={games} loading={loading} propHistory={propHistory} setPendingBet={handleSetPendingBet} onRefresh={manualRefresh} onNavigate={setActiveTab} /></Suspense>}
      {activeTab === 'PRO_TOOLS' && (
        <Suspense fallback={<TabFallback label="Loading pro tools..." />}>
          <ProTools
            games={games}
            injuries={injuries}
            watchlist={watchlist}
            onToggleWatchlist={toggleWatchlist}
          />
        </Suspense>
      )}
      {activeTab === 'REPORT' && (
        <Suspense fallback={<TabFallback label="Building daily report..." />}>
          <DailyProReport
            games={games}
            playerProps={playerProps}
            gameLineHistory={gameLineHistory}
            historicOdds={historicOdds}
            setPendingBet={handleSetPendingBet}
          />
        </Suspense>
      )}
      {activeTab === 'TRACKER' && <Suspense fallback={<TabFallback label="Loading tracker..." />}><BetTracker pendingBet={pendingBet} onBetConsumed={() => setPendingBet(null)} games={games} historicOdds={historicOdds} /></Suspense>}
      {activeTab === 'SETTINGS' && (
        <main className="edge-app-main" style={{ maxWidth: '640px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '20px', color: '#f8fafc' }}>Settings</h2>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>Subscription</div>
            {tier === 'pro' ? (
              <div>
                <div style={{ fontSize: '14px', color: '#c4b5fd', fontWeight: 700, marginBottom: '8px' }}>You are on EdgeFinder Pro</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '12px' }}>All features unlocked. Thank you for supporting EdgeFinder!</div>
                <button
                  onClick={handleManageSubscription}
                  disabled={isOpeningPortal}
                  style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: '6px', color: '#818cf8', fontSize: '11px', cursor: isOpeningPortal ? 'not-allowed' : 'pointer', opacity: isOpeningPortal ? 0.7 : 1, fontFamily: 'var(--ef-font-body)' }}
                >
                  {isOpeningPortal ? 'Opening...' : 'Manage Subscription'}
                </button>
              </div>
            ) : <ProBanner />}
          </div>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Sports</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{enabledSports.length} of {Object.keys(SPORTS).length} active</div>
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
                  <button key={sport} onClick={() => setEnabledSports(prev => on ? prev.filter(s => s !== sport) : [...prev, sport])} style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: on ? 'rgba(99,102,241,0.3)' : 'rgba(30,41,59,0.4)', border: on ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(71,85,105,0.3)', color: on ? '#f8fafc' : '#475569' }}>{sport}</button>
                );
              })}
            </div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Sportsbooks</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {tier === 'pro' ? `${enabledBooks.length} of ${Object.keys(BOOKMAKERS).length} active` : `${FREE_BOOKS.length} free preview books active · Pro unlocks all books`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => setEnabledBooks(tier === 'pro' ? Object.keys(BOOKMAKERS) : FREE_BOOKS)} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: '4px', color: '#22c55e', fontSize: '10px', cursor: 'pointer' }}>{tier === 'pro' ? 'All On' : 'Free Books'}</button>
                <button onClick={() => setEnabledBooks([])} style={{ padding: '4px 10px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontSize: '10px', cursor: 'pointer' }}>All Off</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.entries(BOOKMAKERS).map(([key, name]) => {
                const freeAllowed = FREE_BOOKS.includes(key);
                const lockedForFree = tier !== 'pro' && !freeAllowed;
                const on = tier === 'pro' ? enabledBooks.includes(key) : freeAllowed;
                return (
                  <button
                    key={key}
                    disabled={lockedForFree}
                    onClick={() => {
                      if (lockedForFree) return;
                      setEnabledBooks(prev => on ? prev.filter(b => b !== key) : [...prev, key]);
                    }}
                    title={lockedForFree ? 'Pro unlocks this sportsbook' : name}
                    style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: lockedForFree ? 'not-allowed' : 'pointer', background: on ? 'rgba(34,197,94,0.25)' : 'rgba(30,41,59,0.4)', border: on ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(71,85,105,0.3)', color: lockedForFree ? '#475569' : on ? '#22c55e' : '#475569', opacity: lockedForFree ? 0.55 : 1 }}
                  >{lockedForFree ? `🔒 ${name}` : name}</button>
                );
              })}
            </div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Auto-Refresh</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Live games refresh every 60s. Non-live every 120s.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: isConnected ? '#10b981' : '#ef4444' }}>{isConnected ? 'Connected' : 'Disconnected'}</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>| Next refresh in {countdown}s</span>
            </div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Watchlist</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>{watchlist.length} game{watchlist.length !== 1 ? 's' : ''} saved</div>
            {watchlist.length > 0 && (
              <button onClick={() => { if (confirm('Clear entire watchlist?')) setWatchlist([]); }} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer' }}>Clear Watchlist</button>
            )}
          </div>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Community Sharing</div>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>
                  Show your tracked bets and CLV wins in the community feed under a handle you choose. Off by default — nothing is shared unless you turn this on.
                </div>
              </div>
              <button
                onClick={() => setShareActivity(v => !v)}
                role="switch"
                aria-checked={shareActivity}
                aria-label="Share my activity with the community"
                style={{
                  width: '42px', height: '24px', borderRadius: '12px', flexShrink: 0, padding: '2px',
                  border: shareActivity ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(71,85,105,0.4)',
                  background: shareActivity ? 'rgba(34,197,94,0.25)' : 'rgba(30,41,59,0.6)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center',
                  justifyContent: shareActivity ? 'flex-end' : 'flex-start', transition: 'all 0.2s ease',
                }}
              >
                <span style={{
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: shareActivity ? '#22c55e' : '#64748b', transition: 'all 0.2s ease',
                }} />
              </button>
            </div>
            {shareActivity && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>Display handle</div>
                <input
                  type="text"
                  value={communityHandle}
                  onChange={(e) => setCommunityHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                  placeholder="e.g. mikey_clv"
                  style={{
                    width: '100%', maxWidth: '240px', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid rgba(71,85,105,0.4)', background: 'rgba(15,23,42,0.7)',
                    color: '#e2e8f0', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace', outline: 'none',
                  }}
                />
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', lineHeight: '1.6' }}>
                  Only your handle, the market, and the line are shared — never your stake size, bankroll, or email. Turn this off any time to stop sharing instantly.
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>Clear Cached Data</div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>Reset line history, manual openers, and prop tracking data.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={() => { if (confirm('Clear all line history?')) { localStorage.removeItem('edgefinder_game_lines'); location.reload(); } }} style={{ padding: '6px 14px', background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '6px', color: '#fb923c', fontSize: '11px', cursor: 'pointer' }}>Clear Line History</button>
              <button onClick={() => { if (confirm('Clear all manual openers?')) setManualOpeners({}); }} style={{ padding: '6px 14px', background: 'rgba(249,115,22,0.2)', border: '1px solid rgba(249,115,22,0.4)', borderRadius: '6px', color: '#fb923c', fontSize: '11px', cursor: 'pointer' }}>Clear Openers</button>
              <button onClick={() => { if (confirm('Clear ALL local data?')) { localStorage.clear(); location.reload(); } }} style={{ padding: '6px 14px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', color: '#f87171', fontSize: '11px', cursor: 'pointer' }}>Reset Everything</button>
            </div>
          </div>
          <div style={{ padding: '16px', background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>EdgeFinder Live Odds</div>
            <div style={{ fontSize: '11px', color: '#64748b', lineHeight: '1.6' }}>Real-time odds comparison across 7+ sportsbooks and 25+ sports. Track line movement, find value, and sharpen your edge.</div>
            <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="https://edgefinder.beehiiv.com" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none' }}>Newsletter</a>
              <a href="https://x.com/TROTWAM" target="_blank" rel="noopener" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none' }}>@TROTWAM</a>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '16px', fontSize: '10px', color: '#475569' }}>
            EdgeFinder v3.0
          </div>
        </main>
      )}
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes efPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes efMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ef-ticker-track { display: inline-flex; }
        .ef-ticker-scroll { animation: efMarquee 42s linear infinite; }
        .ef-ticker-scroll:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .ef-ticker-scroll { animation: none; } }
      `}</style>
    </div>
  );
}
