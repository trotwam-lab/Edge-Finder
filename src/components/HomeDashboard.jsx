import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, FileText, Flame, Lock, RefreshCw, Star, Users, Zap } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import { auth } from '../firebase.js';
import ProBanner from './ProBanner.jsx';
import { BOOKMAKERS, FREE_BOOKS } from '../constants.js';
import { getMarketDisplayName, formatOdds } from '../utils/props.js';
import {
  buildLineShoppingOpportunities,
  buildMarketDisagreement,
  getMarketTrustLabel,
  getSpreadMoveSignal,
} from '../utils/odds-math.js';
import { getSportVisual } from '../utils/team-logos.js';
import { getGameStatus, formatStartTime } from '../utils/live-status.js';
import GameTicker from './GameTicker.jsx';

const PRO_LOCKED_BOOK_COUNT = Object.keys(BOOKMAKERS).length - FREE_BOOKS.length;

async function getAuthHeaders() {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

// On-board = live right now or scheduled (not finished). Finished games are
// excluded so the dashboard stops surfacing games that already ended.
function isLiveOrUpcoming(game) {
  const s = getGameStatus(game);
  return s.isLive || s.isUpcoming;
}

function formatGameTime(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  const today = new Date().toDateString() === date.toDateString();
  return today
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function Card({ children, style = {} }) {
  return (
    <div style={{
      padding: '16px',
      background: 'rgba(30,41,59,0.62)',
      border: '1px solid rgba(71,85,105,0.28)',
      borderRadius: '14px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        {icon}
        <div>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.03em' }}>{title}</div>
          {subtitle && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.5 }}>{subtitle}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

function TrustBadge({ trust }) {
  if (!trust) return null;
  return (
    <span title={trust.note} style={{
      fontSize: '9px', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', whiteSpace: 'nowrap',
      background: `${trust.color}22`, color: trust.color, letterSpacing: '0.04em',
    }}>
      {trust.label.toUpperCase()}
    </span>
  );
}

function WatchStar({ gameId, watchlist = [], onToggleWatchlist }) {
  if (!gameId || !onToggleWatchlist) return null;
  const saved = watchlist.includes(gameId);
  return (
    <button
      onClick={() => onToggleWatchlist(gameId)}
      title={saved ? 'Remove from watchlist' : 'Save to watchlist'}
      aria-label={saved ? 'Remove from watchlist' : 'Save to watchlist'}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
        color: saved ? '#fbbf24' : '#475569', lineHeight: 0,
      }}
    >
      <Star size={15} fill={saved ? '#fbbf24' : 'none'} />
    </button>
  );
}

// Friendly empty state with actions instead of a dead-looking section.
function EmptyState({ message, hint, onRefresh, onBrowse, browseLabel = 'Try another sport' }) {
  return (
    <div style={{ padding: '14px 4px', color: '#64748b', fontSize: '12px', lineHeight: 1.6 }}>
      <div style={{ color: '#94a3b8' }}>{message}</div>
      {hint && <div style={{ fontSize: '11px', marginTop: '2px' }}>{hint}</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
        {onRefresh && (
          <button onClick={onRefresh} style={{
            padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', color: '#5eead4',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            Refresh odds
          </button>
        )}
        {onBrowse && (
          <button onClick={onBrowse} style={{
            padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            {browseLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function HomeDashboard({
  games = [],
  playerProps = [],
  loading = false,
  watchlist = [],
  onToggleWatchlist,
  gameLineHistory = {},
  historicOdds = {},
  onNavigate = () => {},
  onSelectGame,
  onRefresh = () => {},
}) {
  const { tier, user } = useAuth();
  const isPro = tier === 'pro';
  const [edges, setEdges] = useState([]);
  const [edgesLoading, setEdgesLoading] = useState(true);
  const [edgesError, setEdgesError] = useState(null);

  const loadEdges = useCallback(async () => {
    setEdgesLoading(true);
    setEdgesError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/edges', { headers });
      if (!res.ok) throw new Error(`Edge scan failed (${res.status})`);
      const data = await res.json();
      setEdges(Array.isArray(data) ? data : []);
    } catch (err) {
      setEdgesError(err.message);
    } finally {
      setEdgesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEdges();
  }, [loadEdges]);

  const upcoming = useMemo(() => games.filter(isLiveOrUpcoming), [games]);

  const topEdges = useMemo(() => edges.slice(0, 3), [edges]);

  // Per-game market context so each row can explain itself and carry an
  // honest trust label.
  const gameContext = useMemo(() => {
    const map = new Map();
    upcoming.forEach(game => {
      const history = gameLineHistory?.[game.id] || [];
      const opener = historicOdds?.[game.id]?.spread ?? history[0]?.spread ?? null;
      const current = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')
        ?.outcomes?.find(o => o.name === game.home_team)?.point ?? null;
      const signal = getSpreadMoveSignal(game, history, opener, current);
      const disagreement = buildMarketDisagreement(game).top;
      const shopping = buildLineShoppingOpportunities(game.bookmakers)[0] || null;
      map.set(game.id, {
        game,
        signal,
        disagreement,
        shopping,
        trust: getMarketTrustLabel(game, { signal, disagreement, shopping }),
      });
    });
    return map;
  }, [upcoming, gameLineHistory, historicOdds]);

  // Plain-English "why this matters" for a game row.
  const whyLine = useCallback((ctx) => {
    if (!ctx) return null;
    const reasons = [];
    if (ctx.shopping?.centsSaved >= 5) {
      reasons.push(`Best price is ${ctx.shopping.centsSaved}c better than the worst book`);
    }
    if (ctx.disagreement && ctx.disagreement.strength !== 'LOW') {
      reasons.push(`Books disagree by ${ctx.disagreement.range}${ctx.disagreement.unit === 'pts' ? ' points' : ' cents'} on the ${ctx.disagreement.label.toLowerCase()}`);
    }
    if (ctx.signal && ctx.signal.moveAbs >= 1) {
      reasons.push(`Line moved ${ctx.signal.moveAbs} toward ${ctx.signal.team} since open`);
    }
    return reasons[0] || null;
  }, []);

  const biggestMoves = useMemo(() => {
    return Array.from(gameContext.values())
      .filter(ctx => ctx.signal && ctx.signal.moveAbs >= 0.5)
      .sort((a, b) => b.signal.moveAbs - a.signal.moveAbs)
      .slice(0, 3);
  }, [gameContext]);

  const topProps = useMemo(() => {
    const map = new Map();
    playerProps.forEach(prop => {
      if (!prop?.player || !prop?.market) return;
      const key = `${prop.sport}:${prop.gameId}:${prop.player}:${prop.market}:${prop.line ?? ''}`;
      if (!map.has(key)) {
        map.set(key, { player: prop.player, game: prop.game, market: prop.market, line: prop.line, books: new Set(), prices: [] });
      }
      const item = map.get(key);
      item.books.add(prop.bookTitle || prop.book || prop.bookKey);
      if (prop.price != null) item.prices.push({ price: prop.price, side: prop.outcome, book: prop.bookTitle || prop.book || prop.bookKey });
    });
    return Array.from(map.values())
      .map(item => ({ ...item, bookCount: item.books.size, best: item.prices.sort((a, b) => b.price - a.price)[0] }))
      .sort((a, b) => b.bookCount - a.bookCount)
      .slice(0, 3);
  }, [playerProps]);

  // Live games float to the top, then the soonest scheduled games.
  const startingSoon = useMemo(() => {
    return [...upcoming]
      .sort((a, b) => {
        const la = getGameStatus(a).isLive;
        const lb = getGameStatus(b).isLive;
        if (la !== lb) return la ? -1 : 1;
        return Date.parse(a.commence_time) - Date.parse(b.commence_time);
      })
      .slice(0, 5);
  }, [upcoming]);

  const watchedGames = useMemo(
    () => games.filter(game => watchlist.includes(game.id)),
    [games, watchlist]
  );

  const firstName = user?.email ? user.email.split('@')[0] : null;

  return (
    <main className="edge-app-main" style={{ maxWidth: '980px' }}>
      {/* Game of the Day + live ticker */}
      <GameTicker games={games} onSelect={onSelectGame || (() => onNavigate('GAMES'))} />

      {/* Hero */}
      <div style={{
        padding: '20px',
        marginBottom: '14px',
        background: 'linear-gradient(135deg, rgba(20,184,166,0.14), rgba(99,102,241,0.1))',
        border: '1px solid rgba(45,212,191,0.25)',
        borderRadius: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#5eead4', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px' }}>
              {new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <h1 style={{ fontSize: '20px', color: '#f8fafc', margin: '0 0 6px' }}>
              {greeting()}{firstName ? `, ${firstName}` : ''} — here&apos;s today&apos;s board.
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
              Top edges, biggest moves, and what starts soon. Star anything to keep it on your watchlist.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => { onRefresh(); loadEdges(); }} disabled={loading} title="Refresh odds" style={{
              padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(45,212,191,0.35)',
              background: 'rgba(45,212,191,0.12)', color: '#5eead4', cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            {isPro && (
              <button onClick={() => onNavigate('REPORT')} style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.35)',
                background: 'rgba(99,102,241,0.16)', color: '#c4b5fd', cursor: 'pointer',
                fontSize: '11px', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
              }}>
                <FileText size={14} /> Daily Report
              </button>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        {/* Top 3 edges */}
        <Card>
          <SectionTitle
            icon={<Zap size={18} color="#fbbf24" />}
            title="Today's Top 3 Edges"
            subtitle="Prices our scan says beat the market average."
          />
          {edgesLoading && topEdges.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '12px', padding: '8px 0' }}>Scanning the market…</div>
          ) : edgesError ? (
            <EmptyState
              message="The edge scan didn't load."
              hint="This is usually temporary — odds providers rate-limit during busy windows."
              onRefresh={loadEdges}
            />
          ) : topEdges.length === 0 ? (
            <EmptyState
              message="No qualifying +EV edges right now."
              hint="That's honest, not broken — edges appear as books move at different speeds."
              onRefresh={loadEdges}
              onBrowse={() => onNavigate('GAMES')}
              browseLabel="Browse the board"
            />
          ) : isPro ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {topEdges.map((edge, idx) => (
                <div key={`${edge.gameId}-${edge.edge}-${idx}`} style={{ paddingBottom: idx === topEdges.length - 1 ? 0 : '10px', borderBottom: idx === topEdges.length - 1 ? 'none' : '1px solid rgba(71,85,105,0.28)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{edge.emoji} {edge.game}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 800 }}>{edge.evDisplay}</span>
                      <WatchStar gameId={edge.gameId} watchlist={watchlist} onToggleWatchlist={onToggleWatchlist} />
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>{edge.edge}</div>
                  <div style={{ fontSize: '10px', color: '#818cf8', marginTop: '3px' }}>
                    {edge.book} · {edge.confidence} confidence · fair win chance {edge.fairProbability}%
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Free: real first row from the server teaser, blur the rest.
            <div>
              {topEdges[0] && (
                <div style={{ paddingBottom: '10px', borderBottom: '1px solid rgba(71,85,105,0.28)', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{topEdges[0].emoji} {topEdges[0].game}</div>
                    <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 800 }}>{topEdges[0].evDisplay}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: '#818cf8', marginTop: '3px' }}>
                    {topEdges[0].confidence} confidence · today&apos;s free sample edge
                  </div>
                </div>
              )}
              <div style={{ position: 'relative' }}>
                <div style={{ filter: 'blur(5px)', opacity: 0.5, pointerEvents: 'none', userSelect: 'none' }} aria-hidden="true">
                  {(topEdges.length > 1 ? topEdges.slice(1) : [{}, {}]).map((edge, idx) => (
                    <div key={idx} style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{edge.game || '🏀 Hidden matchup'}</span>
                        <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 800 }}>{edge.evDisplay || '+4.2%'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Spread: hidden team +3.5 @ -105</div>
                    </div>
                  ))}
                </div>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Lock size={22} color="#818cf8" />
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#94a3b8', margin: '10px 0', lineHeight: 1.5 }}>
                Pro shows the exact book and line for every edge, scanned across {PRO_LOCKED_BOOK_COUNT} more sportsbooks than the free preview.
              </div>
              <ProBanner compact />
            </div>
          )}
        </Card>

        {/* Biggest moves */}
        <Card>
          <SectionTitle
            icon={<Flame size={18} color="#f97316" />}
            title="Biggest Line Moves"
            subtitle="Where the market changed its mind since the opening number."
          />
          {loading && biggestMoves.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '12px', padding: '8px 0' }}>Watching lines…</div>
          ) : biggestMoves.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {biggestMoves.map((ctx, idx) => (
                <div key={ctx.game.id} style={{ paddingBottom: idx === biggestMoves.length - 1 ? 0 : '10px', borderBottom: idx === biggestMoves.length - 1 ? 'none' : '1px solid rgba(71,85,105,0.28)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{ctx.game.away_team} @ {ctx.game.home_team}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <TrustBadge trust={ctx.trust} />
                      <WatchStar gameId={ctx.game.id} watchlist={watchlist} onToggleWatchlist={onToggleWatchlist} />
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                    {ctx.signal.label} · spread {ctx.signal.detail}
                  </div>
                  {whyLine(ctx) && (
                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{whyLine(ctx)}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              message="No meaningful moves captured yet."
              hint="Moves build up as the app watches lines through the day — check back before the slate starts."
              onRefresh={onRefresh}
            />
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        {/* Top props */}
        <Card>
          <SectionTitle
            icon={<Users size={18} color="#38bdf8" />}
            title="Top Props"
            subtitle="The player props posted by the most books today."
            action={
              <button onClick={() => onNavigate('PROPS')} style={{
                fontSize: '10px', color: '#5eead4', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, padding: '2px',
              }}>
                View all →
              </button>
            }
          />
          {loading && topProps.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '12px', padding: '8px 0' }}>Loading props…</div>
          ) : topProps.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {topProps.map((prop, idx) => (
                <div key={`${prop.player}-${prop.market}-${idx}`} style={{ paddingBottom: idx === topProps.length - 1 ? 0 : '10px', borderBottom: idx === topProps.length - 1 ? 'none' : '1px solid rgba(71,85,105,0.28)' }}>
                  <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{prop.player}</div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                    {getMarketDisplayName(prop.market)} {prop.line ?? ''} · {prop.bookCount} book{prop.bookCount === 1 ? '' : 's'}
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Best seen: {prop.best?.side || '—'} {prop.best?.price != null ? formatOdds(prop.best.price) : '—'} {prop.best?.book ? `at ${prop.best.book}` : ''}
                  </div>
                </div>
              ))}
              {!isPro && (
                <div style={{ fontSize: '10px', color: '#94a3b8', paddingTop: '4px', borderTop: '1px solid rgba(71,85,105,0.28)' }}>
                  Free preview shows 3 players on 3 books. Pro unlocks every player and {PRO_LOCKED_BOOK_COUNT} more books.
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              message="No props available yet for this slate."
              hint="Books usually post player props closer to game time."
              onRefresh={onRefresh}
              onBrowse={() => onNavigate('PROPS')}
              browseLabel="Open props board"
            />
          )}
        </Card>

        {/* Starting soon */}
        <Card>
          <SectionTitle
            icon={<CalendarClock size={18} color="#22c55e" />}
            title="Live & Starting Soon"
            subtitle="Live games up top, then the next to tip — shop these first."
          />
          {loading && startingSoon.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '12px', padding: '8px 0' }}>Loading the slate…</div>
          ) : startingSoon.length ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              {startingSoon.map((game, idx) => {
                const ctx = gameContext.get(game.id);
                const visual = getSportVisual(game.sport_key);
                const status = getGameStatus(game);
                return (
                  <div key={game.id} style={{ paddingBottom: idx === startingSoon.length - 1 ? 0 : '10px', borderBottom: idx === startingSoon.length - 1 ? 'none' : '1px solid rgba(71,85,105,0.28)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                      <div
                        onClick={() => onSelectGame?.(game)}
                        style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700, cursor: onSelectGame ? 'pointer' : 'default' }}
                      >
                        {visual.icon} {game.away_team} @ {game.home_team}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {status.isLive && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 800, color: '#ef4444' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', animation: 'efPulse 1.4s ease-in-out infinite' }} />
                            LIVE
                          </span>
                        )}
                        <TrustBadge trust={ctx?.trust} />
                        <WatchStar gameId={game.id} watchlist={watchlist} onToggleWatchlist={onToggleWatchlist} />
                      </div>
                    </div>
                    <div style={{ fontSize: '10px', color: status.isLive ? '#fca5a5' : '#94a3b8', marginTop: '2px' }}>
                      {status.isLive
                        ? `${status.detail || 'In progress'}${status.awayScore != null && status.homeScore != null ? ` · ${status.awayScore}–${status.homeScore}` : ''}`
                        : `${formatStartTime(game.commence_time)} · ${game.bookmakers?.length || 0} books posting`}
                    </div>
                    {whyLine(ctx) && (
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{whyLine(ctx)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              message="No upcoming games loaded yet."
              hint="If a slate should be live, the odds feed may still be warming up."
              onRefresh={onRefresh}
              onBrowse={() => onNavigate('GAMES')}
              browseLabel="Browse all sports"
            />
          )}
        </Card>
      </div>

      {/* Watchlist */}
      <Card style={{ marginBottom: '14px' }}>
        <SectionTitle
          icon={<Star size={18} color="#fbbf24" />}
          title="My Watchlist"
          subtitle={watchedGames.length ? 'Your saved games — open each one and compare the number before it starts.' : null}
        />
        {watchedGames.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {watchedGames.map(game => (
              <div key={game.id} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(15,23,42,0.42)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{game.away_team} @ {game.home_team}</div>
                  <WatchStar gameId={game.id} watchlist={watchlist} onToggleWatchlist={onToggleWatchlist} />
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                  {game.sport_title || game.sport_key} · {formatGameTime(game.commence_time)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
            Nothing saved yet. Tap the <Star size={11} style={{ display: 'inline', verticalAlign: '-1px' }} /> on any
            edge, move, or game to keep it here for the day.
          </div>
        )}
      </Card>

      {!isPro && <ProBanner />}

      {edgesError && topEdges.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', color: '#f87171', fontSize: '11px' }}>
          <AlertTriangle size={14} /> {edgesError}
        </div>
      )}
    </main>
  );
}
