import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, FileText, Flame, Lock, RefreshCw, ShieldOff, ShoppingCart, Star, Zap } from 'lucide-react';
import { useAuth } from '../AuthGate.jsx';
import { auth } from '../firebase.js';
import ProBanner from './ProBanner.jsx';
import { getMarketDisplayName, formatOdds } from '../utils/props.js';
import { buildLineShoppingOpportunities, buildMarketDisagreement, getSpreadMoveSignal } from '../utils/odds-math.js';

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

function formatGameTime(value) {
  if (!value) return 'TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'TBD';
  return date.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

function isUpcoming(game) {
  return game?.commence_time && Date.parse(game.commence_time) >= Date.now() - 3 * 60 * 60 * 1000;
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

function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
      {icon}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc', letterSpacing: '0.03em' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
    </div>
  );
}

function RowDivider({ isLast }) {
  return isLast ? null : <div style={{ height: '1px', background: 'rgba(71,85,105,0.28)', margin: '10px 0' }} />;
}

// The 5-step routine the report is built around. Each step maps to a section
// below — the goal is that a subscriber opens this screen every morning and
// follows the same checklist instead of browsing aimlessly.
const MORNING_ROUTINE = [
  { step: 1, title: 'Scan the edge board', note: 'See where prices beat the market average.' },
  { step: 2, title: 'Check steam moves', note: 'Big line moves = the market learned something.' },
  { step: 3, title: 'Shop the price', note: 'Same bet, better number. Always take the best book.' },
  { step: 4, title: 'Save your plays', note: 'Track every bet so results are real, not vibes.' },
  { step: 5, title: 'Review CLV weekly', note: 'Beating the closing line is the #1 sign you bet well.' },
];

const FREE_PREVIEW_SECTIONS = [
  { icon: '🎯', title: 'Top 5 Edge Board', note: 'The exact book, line, and EV% for the best-priced bets on the slate.' },
  { icon: '🔥', title: 'Steam Move Tracker', note: 'Which lines moved the most since open, and toward which team.' },
  { icon: '🛒', title: 'Best Books Today', note: 'Which sportsbook is posting the best numbers — and how much shopping saves.' },
  { icon: '🏀', title: 'Props to Research', note: 'High-coverage player props with the best available price.' },
  { icon: '🚫', title: 'Games to Avoid', note: 'Where books agree and there is no pricing edge. Passing is a skill.' },
];

function FreeReportTeaser() {
  return (
    <main className="edge-app-main" style={{ maxWidth: '760px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div style={{ fontSize: '46px', marginBottom: '12px' }}>📝</div>
        <h2 style={{ fontSize: '21px', color: '#f8fafc', margin: '0 0 8px' }}>Daily Pro Report</h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, margin: '0 auto', maxWidth: '480px' }}>
          One screen, every morning: where the value is, where the market is moving,
          and which games to skip. This is the screen Pro is built around.
        </p>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <div style={{ filter: 'blur(6px)', pointerEvents: 'none', opacity: 0.5, userSelect: 'none' }} aria-hidden="true">
          {[
            { game: '🏀 Lakers @ Celtics', detail: 'Spread: Lakers +4.5 @ -105', tag: '+4.6% EV' },
            { game: '⚾ Yankees @ Orioles', detail: 'Steam: -1.5 → -2.5 toward Yankees', tag: 'HIGH' },
            { game: '🏒 Oilers @ Stars', detail: 'Best price: FanDuel +128 (12c better)', tag: 'SHOP' },
          ].map((row, i) => (
            <div key={i} style={{
              padding: '16px', marginBottom: '10px',
              background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(71,85,105,0.2)', borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#e2e8f0' }}>{row.game}</span>
                <span style={{ fontSize: '12px', color: '#22c55e', fontWeight: 700 }}>{row.tag}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>{row.detail}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Lock size={40} color="#818cf8" style={{ opacity: 0.85 }} />
        </div>
      </div>

      <Card style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: 800, color: '#c4b5fd', marginBottom: '12px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Inside today&apos;s report
        </div>
        <div style={{ display: 'grid', gap: '10px' }}>
          {FREE_PREVIEW_SECTIONS.map(section => (
            <div key={section.title} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '15px' }}>{section.icon}</span>
              <div>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{section.title}</div>
                <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.5 }}>{section.note}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <ProBanner />
    </main>
  );
}

export default function DailyProReport({
  games = [],
  playerProps = [],
  gameLineHistory = {},
  historicOdds = {},
  setPendingBet,
}) {
  const { tier } = useAuth();
  const [edges, setEdges] = useState([]);
  const [loadingEdges, setLoadingEdges] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadEdges = useCallback(async () => {
    if (tier !== 'pro') return;
    setLoadingEdges(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/edges', { headers });
      if (!res.ok) throw new Error(`Edge scan failed: ${res.status}`);
      const data = await res.json();
      setEdges(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingEdges(false);
    }
  }, [tier]);

  useEffect(() => {
    loadEdges();
  }, [loadEdges]);

  const reportDate = new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });

  const topEdges = useMemo(() => edges.slice(0, 5), [edges]);

  const upcomingGames = useMemo(() => {
    return [...games]
      .filter(isUpcoming)
      .sort((a, b) => Date.parse(a.commence_time) - Date.parse(b.commence_time))
      .slice(0, 6);
  }, [games]);

  // Steam Move Tracker — biggest spread moves since the opening snapshot we
  // captured for each game. Opener comes from historicOdds (first time the
  // app saw the game); current is the live first-book spread, the same pair
  // GameDetails uses, so the numbers match across screens.
  const steamMoves = useMemo(() => {
    return games
      .filter(isUpcoming)
      .map(game => {
        const history = gameLineHistory?.[game.id] || [];
        const opener = historicOdds?.[game.id]?.spread ?? history[0]?.spread ?? null;
        const current = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')
          ?.outcomes?.find(o => o.name === game.home_team)?.point ?? null;
        const signal = getSpreadMoveSignal(game, history, opener, current);
        if (!signal) return null;
        return { game, signal };
      })
      .filter(item => item && item.signal.moveAbs >= 0.5)
      .sort((a, b) => b.signal.moveAbs - a.signal.moveAbs)
      .slice(0, 5);
  }, [games, gameLineHistory, historicOdds]);

  // Line shopping across the whole slate: the single biggest best-vs-worst
  // price gap per game, plus a tally of which book posted the best number
  // most often today.
  const lineShopping = useMemo(() => {
    const rows = [];
    const bookWins = new Map();
    let opportunityCount = 0;

    games.filter(isUpcoming).forEach(game => {
      const opportunities = buildLineShoppingOpportunities(game.bookmakers);
      opportunities.forEach(opp => {
        opportunityCount += 1;
        const title = opp.best?.bookTitle;
        if (title) bookWins.set(title, (bookWins.get(title) || 0) + 1);
      });
      if (opportunities[0]) rows.push({ game, opp: opportunities[0] });
    });

    rows.sort((a, b) => b.opp.centsSaved - a.opp.centsSaved);
    const bestBooks = Array.from(bookWins.entries())
      .map(([book, count]) => ({ book, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return { rows: rows.slice(0, 5), bestBooks, opportunityCount };
  }, [games]);

  // Games to avoid: thin markets or games where books agree and our edge
  // scan found nothing. Telling users where NOT to bet is part of the value.
  const gamesToAvoid = useMemo(() => {
    const edgeGameIds = new Set(edges.map(e => e.gameId).filter(Boolean));
    return games
      .filter(isUpcoming)
      .map(game => {
        const bookCount = game.bookmakers?.length || 0;
        const reasons = [];
        if (bookCount > 0 && bookCount < 3) {
          reasons.push(`Thin market — only ${bookCount} book${bookCount === 1 ? '' : 's'} posting lines`);
        } else if (bookCount >= 3 && !edgeGameIds.has(game.id)) {
          const disagreement = buildMarketDisagreement(game).top;
          const topShop = buildLineShoppingOpportunities(game.bookmakers)[0];
          const tightConsensus = !disagreement || disagreement.strength === 'LOW';
          const nothingToShop = !topShop || topShop.centsSaved < 5;
          if (tightConsensus && nothingToShop) {
            reasons.push('Books agree on the price — no number edge found right now');
          }
        }
        return reasons.length ? { game, reason: reasons[0] } : null;
      })
      .filter(Boolean)
      .slice(0, 4);
  }, [games, edges]);

  const propBoard = useMemo(() => {
    const map = new Map();
    playerProps.forEach(prop => {
      if (!prop?.player || !prop?.market) return;
      const key = `${prop.sport}:${prop.gameId}:${prop.player}:${prop.market}:${prop.line ?? ''}`;
      if (!map.has(key)) {
        map.set(key, {
          player: prop.player,
          game: prop.game,
          market: prop.market,
          line: prop.line,
          sport: prop.sport,
          books: new Set(),
          prices: [],
        });
      }
      const item = map.get(key);
      item.books.add(prop.bookTitle || prop.book || prop.bookKey);
      if (prop.price != null) item.prices.push({ price: prop.price, side: prop.outcome, book: prop.bookTitle || prop.book || prop.bookKey });
    });

    return Array.from(map.values())
      .map(item => {
        const best = item.prices.sort((a, b) => b.price - a.price)[0];
        return { ...item, bookCount: item.books.size, best };
      })
      .sort((a, b) => b.bookCount - a.bookCount || String(a.player).localeCompare(String(b.player)))
      .slice(0, 5);
  }, [playerProps]);

  const trackBestPrice = (game, opp) => {
    if (!setPendingBet || !opp?.best) return;
    setPendingBet({
      game: `${game.away_team} vs ${game.home_team}`,
      type: opp.marketLabel,
      pick: `${opp.label} ${formatOdds(opp.best.price)}`,
      odds: opp.best.price,
      book: opp.best.bookTitle,
      date: game.commence_time,
      gameId: game.id,
      sportKey: game.sport_key,
      marketKey: opp.marketKey,
      outcomeName: opp.outcomeName,
      outcomePoint: opp.point ?? undefined,
      commenceTime: game.commence_time,
    });
  };

  if (tier !== 'pro') {
    return <FreeReportTeaser />;
  }

  return (
    <main className="edge-app-main" style={{ maxWidth: '980px' }}>
      <div style={{
        padding: '20px',
        marginBottom: '16px',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.08))',
        border: '1px solid rgba(99,102,241,0.32)',
        borderRadius: '16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <FileText size={20} color="#a78bfa" />
              <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase' }}>EdgeFinder Pro</span>
            </div>
            <h2 style={{ fontSize: '22px', color: '#f8fafc', margin: '0 0 6px' }}>Your Morning Report</h2>
            <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
              Where to look today: the best prices, the biggest moves, and the games worth skipping.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'right' }}>
              <div style={{ color: '#cbd5e1', fontWeight: 700 }}>{reportDate}</div>
              {lastUpdated && <div>Updated {lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>}
            </div>
            <button onClick={loadEdges} disabled={loadingEdges} style={{
              padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.35)',
              background: 'rgba(99,102,241,0.16)', color: '#c4b5fd', cursor: loadingEdges ? 'not-allowed' : 'pointer',
            }}>
              <RefreshCw size={15} style={{ animation: loadingEdges ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
          {MORNING_ROUTINE.map(item => (
            <div key={item.step} title={item.note} style={{
              display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0,
              padding: '7px 11px', borderRadius: '999px',
              background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(99,102,241,0.25)',
            }}>
              <span style={{
                width: '16px', height: '16px', borderRadius: '50%', fontSize: '10px', fontWeight: 800,
                background: 'rgba(99,102,241,0.35)', color: '#e0e7ff',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}>{item.step}</span>
              <span style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.title}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <Card style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', fontSize: '12px' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <Card>
          <SectionTitle
            icon={<Zap size={18} color="#fbbf24" />}
            title="Top 5 Edge Board"
            subtitle="Prices that beat the market average. In plain terms: these books are offering more than the bet is worth."
          />
          {loadingEdges && topEdges.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '12px' }}>Scanning markets…</div>
          ) : topEdges.length ? (
            <div>
              {topEdges.map((edge, idx) => (
                <div key={`${edge.gameId}-${edge.edge}-${idx}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{idx + 1}. {edge.emoji} {edge.game}</div>
                    <div style={{ fontSize: '12px', color: '#22c55e', fontWeight: 800 }}>{edge.evDisplay}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', lineHeight: 1.45 }}>{edge.edge}</div>
                  <div style={{ fontSize: '10px', color: '#818cf8', marginTop: '3px' }}>{edge.book} · {edge.confidence} confidence</div>
                  <RowDivider isLast={idx === topEdges.length - 1} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px' }}>No qualifying +EV edges right now. That is useful too — do not force action.</div>
          )}
        </Card>

        <Card>
          <SectionTitle
            icon={<Flame size={18} color="#f97316" />}
            title="Steam Move Tracker"
            subtitle="Spread moves since the opening line we captured. A big move means the market learned something — find out what before you bet."
          />
          {steamMoves.length ? (
            <div>
              {steamMoves.map(({ game, signal }, idx) => (
                <div key={game.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{game.away_team} @ {game.home_team}</div>
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '5px', alignSelf: 'flex-start',
                      background: signal.strength === 'HIGH' ? 'rgba(239,68,68,0.18)' : signal.strength === 'MEDIUM' ? 'rgba(249,115,22,0.18)' : 'rgba(234,179,8,0.15)',
                      color: signal.strength === 'HIGH' ? '#f87171' : signal.strength === 'MEDIUM' ? '#fb923c' : '#fbbf24',
                    }}>
                      {signal.strength === 'HIGH' ? 'STEAM' : signal.strength}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1' }}>{signal.label} · spread {signal.detail}</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{formatGameTime(game.commence_time)}</div>
                  <RowDivider isLast={idx === steamMoves.length - 1} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px' }}>
              No meaningful line moves captured yet today. Moves show up here as the app watches lines through the day.
            </div>
          )}
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', marginBottom: '14px' }}>
        <Card>
          <SectionTitle
            icon={<ShoppingCart size={18} color="#2dd4bf" />}
            title="Best Books Today"
            subtitle="Same bet, better price. Shopping the line is the easiest edge in betting — these are today's biggest price gaps."
          />
          {lineShopping.bestBooks.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {lineShopping.bestBooks.map(({ book, count }, idx) => (
                <div key={book} style={{
                  padding: '6px 10px', borderRadius: '8px', fontSize: '11px',
                  background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)', color: '#5eead4',
                }}>
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'} <strong>{book}</strong> · best price {count}×
                </div>
              ))}
            </div>
          )}
          {lineShopping.rows.length ? (
            <div>
              {lineShopping.rows.map(({ game, opp }, idx) => (
                <div key={game.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '4px' }}>
                    <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{game.away_team} @ {game.home_team}</div>
                    <div style={{ fontSize: '11px', color: '#2dd4bf', fontWeight: 800, whiteSpace: 'nowrap' }}>+{opp.centsSaved}c better</div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    {opp.label}: {formatOdds(opp.best.price)} at {opp.best.bookTitle} vs {formatOdds(opp.worst.price)} at {opp.worst.bookTitle}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '3px' }}>
                    <div style={{ fontSize: '10px', color: '#64748b' }}>{opp.bookCount} books compared</div>
                    {setPendingBet && (
                      <button onClick={() => trackBestPrice(game, opp)} style={{
                        padding: '3px 9px', borderRadius: '6px', fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                        background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)', color: '#5eead4',
                        fontFamily: '"JetBrains Mono", monospace',
                      }}>
                        Track best price
                      </button>
                    )}
                  </div>
                  <RowDivider isLast={idx === lineShopping.rows.length - 1} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px' }}>No price gaps found yet. Check back once more books post lines for today&apos;s slate.</div>
          )}
        </Card>

        <Card>
          <SectionTitle
            icon={<Star size={18} color="#38bdf8" />}
            title="Props to Research"
            subtitle="Player props posted by the most books, with the best available price. More books = a more reliable line to compare against."
          />
          {propBoard.length ? (
            <div>
              {propBoard.map((prop, idx) => (
                <div key={`${prop.player}-${prop.market}-${idx}`}>
                  <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700 }}>{idx + 1}. {prop.player}</div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '2px' }}>
                    {getMarketDisplayName(prop.market)} {prop.line ?? ''} · {prop.bookCount} books
                  </div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                    Best seen: {prop.best?.side || '—'} {prop.best?.price != null ? formatOdds(prop.best.price) : '—'} {prop.best?.book ? `at ${prop.best.book}` : ''}
                  </div>
                  <RowDivider isLast={idx === propBoard.length - 1} />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#64748b', fontSize: '12px' }}>Props are still loading. Refresh after the slate populates.</div>
          )}
        </Card>
      </div>

      {gamesToAvoid.length > 0 && (
        <Card style={{ marginBottom: '14px' }}>
          <SectionTitle
            icon={<ShieldOff size={18} color="#f87171" />}
            title="Games to Avoid"
            subtitle="No pricing edge found here right now. Skipping games where you have no advantage is how winning bettors protect bankroll."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {gamesToAvoid.map(({ game, reason }) => (
              <div key={game.id} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(15,23,42,0.42)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700, marginBottom: '4px' }}>{game.away_team} @ {game.home_team}</div>
                <div style={{ fontSize: '10px', color: '#fca5a5', lineHeight: 1.5 }}>{reason}</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>{formatGameTime(game.commence_time)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle
          icon={<CalendarDays size={18} color="#22c55e" />}
          title="Slate Watchlist"
          subtitle="Today's games in start-time order — open these first."
        />
        {upcomingGames.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {upcomingGames.map(game => (
              <div key={game.id} style={{ padding: '12px', borderRadius: '10px', background: 'rgba(15,23,42,0.42)', border: '1px solid rgba(71,85,105,0.22)' }}>
                <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 700, marginBottom: '4px' }}>{game.away_team} @ {game.home_team}</div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{game.sport_title || game.sport_key} · {formatGameTime(game.commence_time)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#64748b', fontSize: '12px' }}>No upcoming games loaded yet. Try Games refresh, then return here.</div>
        )}
      </Card>
    </main>
  );
}
