import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Activity, Bell, Calculator, DollarSign, Star, Wrench, Zap } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';

const EdgeAlerts = lazy(() => import('./EdgeAlerts.jsx'));
const EVCalculator = lazy(() => import('./EVCalculator.jsx'));
const KellyCriterion = lazy(() => import('./KellyCriterion.jsx'));

const TOOLS = [
  { key: 'ALERTS', label: 'Market Alerts', icon: Bell, description: 'Steam, edge, and book-disagreement alerts.' },
  { key: 'WATCHLIST', label: 'Watchlist', icon: Star, description: 'Games that deserve follow-up before close.' },
  { key: 'EV', label: 'EV Calculator', icon: Calculator, description: 'Compare your number against the book.' },
  { key: 'KELLY', label: 'Kelly Sizing', icon: DollarSign, description: 'Size bets around bankroll and edge.' },
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
  const [activeTool, setActiveTool] = useState('ALERTS');
  const ActiveIcon = TOOLS.find(tool => tool.key === activeTool)?.icon || Wrench;

  return (
    <main className="edge-app-main pro-tools-page">
      <section className="pro-tools-hero">
        <div>
          <div className="market-kicker">Pro Tools</div>
          <h1>Alerts, EV, and bet sizing in one workspace.</h1>
          <p>
            Watch for market moves, check whether the price is worth betting, then size the position without jumping between tabs.
          </p>
        </div>
        <div className="pro-tools-status">
          <Zap size={18} />
          <span>{tier === 'pro' ? 'Live Pro Workspace' : 'Pro Preview'}</span>
        </div>
      </section>

      {tier !== 'pro' && (
        <div className="pro-tools-upgrade">
          <ProBanner />
        </div>
      )}

      <div className="pro-tools-layout">
        <aside className="pro-tools-sidebar">
          {TOOLS.map(({ key, label, icon: Icon, description }) => {
            const active = activeTool === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTool(key)}
                className={active ? 'pro-tool-tab active' : 'pro-tool-tab'}
              >
                <Icon size={18} />
                <span>
                  <strong>{label}</strong>
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
