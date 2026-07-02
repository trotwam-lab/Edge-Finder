import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Activity, Bell, Calculator, DollarSign, Layers, Scale, Star, Wrench, Zap } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';

const EdgeAlerts = lazy(() => import('./EdgeAlerts.jsx'));
const EVCalculator = lazy(() => import('./EVCalculator.jsx'));
const KellyCriterion = lazy(() => import('./KellyCriterion.jsx'));
const ParlayBuilder = lazy(() => import('./ParlayBuilder.jsx'));
const ArbitrageScanner = lazy(() => import('./ArbitrageScanner.jsx'));

// The Toolkit mixes free and Pro tools. Free tools give every user a reason
// to open this tab daily; Pro tools upsell in place (each one renders its
// own ProBanner when locked).
const TOOLS = [
  { key: 'PARLAY', label: 'Parlay Builder', icon: Layers, description: 'True combined odds, payout, and EV for any parlay.', pro: false },
  { key: 'ARB', label: 'Arb Scanner', icon: Scale, description: 'Guaranteed-profit and low-hold pairs across books.', pro: true },
  { key: 'ALERTS', label: 'Market Alerts', icon: Bell, description: 'Steam, edge, and book-disagreement alerts.', pro: true },
  { key: 'WATCHLIST', label: 'Watchlist', icon: Star, description: 'Games that deserve follow-up before close.', pro: false },
  { key: 'EV', label: 'EV Calculator', icon: Calculator, description: 'Compare your number against the book.', pro: true },
  { key: 'KELLY', label: 'Kelly Sizing', icon: DollarSign, description: 'Size bets around bankroll and edge.', pro: true },
];

function ToolFallback() {
  return (
    <div style={{ padding: '42px 24px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
      Loading tool...
    </div>
  );
}

function MarketWatchlist({ games, injuries, watchlist, onToggleWatchlist }) {
  const watchItems = useMemo(() => {
    const watched = games.filter(game => watchlist.includes(game.id));
    const candidates = games
      .filter(game => !watchlist.includes(game.id))
      .map(game => {
        const injuryCount = [
          ...(injuries?.[game.home_team] || []),
          ...(injuries?.[game.away_team] || []),
        ].length;
        const bookCount = game.bookmakers?.length || 0;
        const liveBoost = game.scores ? 2 : 0;
        return { game, score: injuryCount * 2 + Math.min(bookCount, 8) + liveBoost, injuryCount, bookCount };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
    return { watched, candidates };
  }, [games, injuries, watchlist]);

  return (
    <div className="pro-watchlist-panel">
      <div className="pro-watchlist-section">
        <div className="pro-watchlist-head">
          <Star size={16} />
          <span>Saved Games</span>
          <strong>{watchItems.watched.length}</strong>
        </div>
        {watchItems.watched.length === 0 ? (
          <div className="pro-empty-state">Star games from the main board to track them here.</div>
        ) : (
          <div className="pro-watchlist-list">
            {watchItems.watched.map(game => (
              <button key={game.id} className="pro-watchlist-row" onClick={() => onToggleWatchlist(game.id)}>
                <span>{game.away_team} @ {game.home_team}</span>
                <small>{game.bookmakers?.length || 0} books · tap to remove</small>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pro-watchlist-section">
        <div className="pro-watchlist-head">
          <Activity size={16} />
          <span>Suggested Alerts</span>
          <strong>{watchItems.candidates.length}</strong>
        </div>
        {watchItems.candidates.length === 0 ? (
          <div className="pro-empty-state">No alert candidates yet. Refresh after odds and injuries load.</div>
        ) : (
          <div className="pro-watchlist-list">
            {watchItems.candidates.map(({ game, injuryCount, bookCount }) => (
              <button key={game.id} className="pro-watchlist-row" onClick={() => onToggleWatchlist(game.id)}>
                <span>{game.away_team} @ {game.home_team}</span>
                <small>{bookCount} books · {injuryCount} injury flag{injuryCount === 1 ? '' : 's'} · add watch</small>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProTools({ games = [], injuries = {}, watchlist = [], onToggleWatchlist = () => {} }) {
  const { tier } = useAuth();
  const isPro = tier === 'pro';
  const [activeTool, setActiveTool] = useState('PARLAY');
  const ActiveIcon = TOOLS.find(tool => tool.key === activeTool)?.icon || Wrench;

  return (
    <main className="edge-app-main pro-tools-page">
      <section className="pro-tools-hero">
        <div>
          <div className="market-kicker">Toolkit</div>
          <h1>Price it, size it, and lock it in — one workspace.</h1>
          <p>
            Build parlays at their true price, scan for arbitrage, check EV, and size positions —
            without jumping between tabs. Tools marked PRO unlock with the membership.
          </p>
        </div>
        <div className="pro-tools-status">
          <Zap size={18} />
          <span>{isPro ? 'Live Pro Workspace' : 'Free Tools + Pro Preview'}</span>
        </div>
      </section>

      <div className="pro-tools-layout">
        <aside className="pro-tools-sidebar">
          {TOOLS.map(({ key, label, icon: Icon, description, pro }) => {
            const active = activeTool === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTool(key)}
                className={active ? 'pro-tool-tab active' : 'pro-tool-tab'}
              >
                <Icon size={18} />
                <span>
                  <strong>
                    {label}
                    {pro && !isPro && <em className="pro-tool-badge">PRO</em>}
                  </strong>
                  <small>{description}</small>
                </span>
              </button>
            );
          })}
        </aside>

        <section className="pro-tools-panel">
          <div className="pro-tools-panel-head">
            <ActiveIcon size={18} />
            <span>{TOOLS.find(tool => tool.key === activeTool)?.label}</span>
          </div>
          <Suspense fallback={<ToolFallback />}>
            {activeTool === 'PARLAY' && <ParlayBuilder />}
            {activeTool === 'ARB' && <ArbitrageScanner games={games} />}
            {activeTool === 'ALERTS' && <EdgeAlerts />}
            {activeTool === 'WATCHLIST' && (
              <MarketWatchlist
                games={games}
                injuries={injuries}
                watchlist={watchlist}
                onToggleWatchlist={onToggleWatchlist}
              />
            )}
            {activeTool === 'EV' && <EVCalculator />}
            {activeTool === 'KELLY' && <KellyCriterion />}
          </Suspense>
        </section>
      </div>
    </main>
  );
}
