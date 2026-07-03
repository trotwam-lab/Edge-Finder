import React, { useState } from 'react';
import { Star, ChevronDown, ChevronUp, Share2, Lock, Target } from 'lucide-react';
import { getConsensusFairOdds, formatOdds, isPositiveEV, findBestOdds, americanToImplied, calculateEV, calculateEdgeScore, getLineShoppingScore, getSpreadMoveSignal, buildMarketDisagreement } from '../utils/odds-math.js';
import { BOOKMAKERS } from '../constants.js';
import { useAuth } from '../AuthGate.jsx';
import { getSportVisual, resolveTeamLogo } from '../utils/team-logos.js';
import { getGameStatus, formatStartTime } from '../utils/live-status.js';

function TeamLogo({ name, url, size = 26 }) {
  const [fallback, setFallback] = useState(!url);
  const initials = String(name || '')
    .split(/\s+/).filter(Boolean).slice(-2)
    .map(w => w[0]).join('').toUpperCase() || '—';
  return (
    <div
      title={name}
      style={{
        width: size, height: size, borderRadius: '999px', overflow: 'hidden',
        border: '1px solid rgba(148,163,184,0.25)',
        background: fallback ? 'rgba(30,41,59,0.95)' : '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#e2e8f0', fontSize: '10px', fontWeight: 800, flexShrink: 0,
      }}
    >
      {fallback || !url
        ? initials
        : <img src={url} alt={name} onError={() => setFallback(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
    </div>
  );
}

// Right-rail status text: live game detail (inning/quarter/clock), Final, a
// short countdown when it's minutes away, or the scheduled start time.
function statusDisplay(status, commence) {
  if (status.isLive) return status.detail || 'LIVE';
  if (status.isFinal) return 'Final';
  if (status.label === 'IN PROGRESS') return 'In progress';
  if (status.label === 'ENDED') return 'Ended';
  const diff = new Date(commence) - new Date();
  if (diff > 0 && diff < 3600000) return `${Math.max(1, Math.floor(diff / 60000))}m`;
  return formatStartTime(commence);
}

function HoldBadge({ hold }) {
  if (hold === null || hold === undefined) return null;
  const color = hold < 3 ? '#22c55e' : hold < 5 ? '#eab308' : '#ef4444';
  const bg = hold < 3 ? 'rgba(34,197,94,0.15)' : hold < 5 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
  return (
    <span style={{ fontSize: '9px', padding: '2px 5px', borderRadius: '3px', background: bg, color, fontWeight: 600 }}>
      Hold: {hold}%
    </span>
  );
}

export default function GameCard({
  game, expanded, onToggle, watchlist, onToggleWatchlist,
  injuries, gameLineHistory, setPendingBet, logoMap = {},
}) {
  const sportVisual = getSportVisual(game.sport_key);
  const awayLogo = resolveTeamLogo(logoMap, game.sport_key, game.away_team);
  const homeLogo = resolveTeamLogo(logoMap, game.sport_key, game.home_team);
  const { tier } = useAuth(); // Get tier for EV display
  const [copied, setCopied] = useState(false); // For share button "Copied!" tooltip
  const [showQuickPick, setShowQuickPick] = useState(false); // Quick-pick bet popover
  // Accurate status from the ESPN-backed feed (falls back to time/scores).
  const status = getGameStatus(game);
  const isLive = status.isLive;
  const isFinal = status.isFinal;
  const hasGameScore = status.homeScore != null && status.awayScore != null;

  // === EDGE SCORE™ — pro-only composite rating ===
  const edgeScore = calculateEdgeScore(game, gameLineHistory);
  // Map score to label + color for the badge
  const edgeBadge = edgeScore <= 40
    ? { label: 'LOW', color: '#64748b', bg: 'rgba(100,116,139,0.2)' }
    : edgeScore <= 60
    ? { label: 'MID', color: '#eab308', bg: 'rgba(234,179,8,0.15)' }
    : edgeScore <= 80
    ? { label: 'EDGE', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
    : { label: '🔥 HOT', color: '#f97316', bg: 'rgba(249,115,22,0.2)' };

  // === TRENDING — free for all users ===
  // If line history has 3+ entries, the line is actively moving
  const historyEntries = gameLineHistory[game.id] || [];
  const isTrending = historyEntries.length >= 3;

  // === SHARE — copy game summary to clipboard ===
  const handleShare = (e) => {
    e.stopPropagation(); // Don't toggle card expand
    const spreadText = homeSpread ? `Spread: ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point}` : '';
    const totalText = totalLine ? `Total: ${totalLine.point}` : '';
    const parts = [`${game.away_team} vs ${game.home_team}`, spreadText, totalText, 'via EdgeFinder edgefinder-betting.vercel.app'].filter(Boolean);
    navigator.clipboard.writeText(parts.join(' | ')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const sportLabel = sportVisual.short;

  // Consensus fair odds for spreads
  const spreadFair = getConsensusFairOdds(game.bookmakers, 'spreads');
  const h2hFair = getConsensusFairOdds(game.bookmakers, 'h2h');
  const totalFair = getConsensusFairOdds(game.bookmakers, 'totals');

  // Best odds across books
  const bestSpreadHome = findBestOdds(game.bookmakers, 'spreads', game.home_team);
  const bestSpreadAway = findBestOdds(game.bookmakers, 'spreads', game.away_team);
  const bestH2hHome = findBestOdds(game.bookmakers, 'h2h', game.home_team);
  const bestH2hAway = findBestOdds(game.bookmakers, 'h2h', game.away_team);
  const bestTotalOver = findBestOdds(game.bookmakers, 'totals', 'Over');
  const bestTotalUnder = findBestOdds(game.bookmakers, 'totals', 'Under');
  const lineShopping = getLineShoppingScore(game.bookmakers);
  const topShop = lineShopping.top;

  // Line movement
  const history = gameLineHistory[game.id] || [];
  const hasMovement = history.length > 1;
  const start = history[0]?.spread;
  const current = history[history.length - 1]?.spread;
  const move = hasMovement ? current - start : 0;
  const spreadMoveSignal = getSpreadMoveSignal(game, history);
  const disagreement = buildMarketDisagreement(game);

  // Injury counts
  const awayKey = game.away_team?.split(' ')?.pop()?.toLowerCase();
  const homeKey = game.home_team?.split(' ')?.pop()?.toLowerCase();
  const awayInjuries = injuries[game.away_team?.toLowerCase()] || injuries[awayKey] || [];
  const homeInjuries = injuries[game.home_team?.toLowerCase()] || injuries[homeKey] || [];

  const firstBook = game.bookmakers?.[0];
  const homeSpread = firstBook?.markets?.find(m => m.key === 'spreads')?.outcomes?.find(o => o.name === game.home_team);
  const totalLine = firstBook?.markets?.find(m => m.key === 'totals')?.outcomes?.[0];

  // Soccer moneylines are 3-way (home/draw/away). When the market carries a
  // Draw outcome, show the full 1X2 line in the card's line column instead of
  // a spread, ordered home · draw · away.
  const isSoccer = game.sport_key?.startsWith('soccer');
  const h2hOutcomes = firstBook?.markets?.find(m => m.key === 'h2h')?.outcomes || [];
  const threeWay = isSoccer && h2hOutcomes.length >= 3 ? {
    home: h2hOutcomes.find(o => o.name === game.home_team),
    draw: h2hOutcomes.find(o => /^draw$/i.test(o.name || '')),
    away: h2hOutcomes.find(o => o.name === game.away_team),
  } : null;

  return (
    <div>
      {/* Clickable card header */}
      <div onClick={onToggle} className="game-card-header" style={{
        padding: '14px 18px',
        background: expanded ? 'rgba(20, 184, 166, 0.12)' : 'rgba(15, 23, 42, 0.72)',
        border: `1px solid ${expanded ? 'rgba(45, 212, 191, 0.34)' : 'rgba(100, 116, 139, 0.18)'}`,
        borderLeft: `4px solid ${sportVisual.color}`,
        borderRadius: '8px', cursor: 'pointer',
        display: 'grid', gridTemplateColumns: '40px minmax(0, 2fr) 116px 116px 78px',
        alignItems: 'center', gap: '14px',
        boxShadow: expanded ? '0 18px 42px rgba(2, 6, 23, 0.22)' : '0 10px 28px rgba(2, 6, 23, 0.16)',
      }}>
        {/* Watchlist star + Share button side by side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button onClick={(e) => { e.stopPropagation(); onToggleWatchlist(game.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Star size={18} color={watchlist.includes(game.id) ? '#fbbf24' : '#475569'}
              fill={watchlist.includes(game.id) ? '#fbbf24' : 'none'} />
          </button>
          {/* Share button — copies game summary to clipboard (free for everyone) */}
          <div style={{ position: 'relative' }}>
            <button onClick={handleShare}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <Share2 size={14} color="#475569" />
            </button>
            {/* "Copied!" tooltip appears briefly after clicking share */}
            {copied && (
              <span style={{
                position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)',
                fontSize: '9px', background: '#22c55e', color: '#fff', padding: '2px 6px',
                borderRadius: '3px', whiteSpace: 'nowrap', fontWeight: 600
              }}>Copied!</span>
            )}
          </div>
          {/* 🎯 Quick Bet button — opens a popover with the main lines to track */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowQuickPick(!showQuickPick); }}
              title="Quick bet — track this game"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                color: '#64748b', lineHeight: 1,
              }}
            ><Target size={14} /></button>
            {/* Quick-pick popover: shows the main lines for one-tap tracking */}
            {showQuickPick && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)',
                  zIndex: 100, background: '#1e293b', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: '8px', padding: '10px', minWidth: '220px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ fontSize: '10px', color: '#818cf8', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
                  QUICK BET — tap a line
                </div>
                {/* Build quick-pick options from the first bookmaker's lines */}
                {(() => {
                  const book = game.bookmakers?.[0];
                  if (!book) return <div style={{ fontSize: '11px', color: '#64748b' }}>No odds available</div>;
                  const spreads = book.markets?.find(m => m.key === 'spreads');
                  const h2h = book.markets?.find(m => m.key === 'h2h');
                  const totals = book.markets?.find(m => m.key === 'totals');
                  // Each option tracks its market/outcome so the tracker can
                  // auto-match the bet back to future odds snapshots for CLV.
                  const options = [];
                  // Away spread
                  spreads?.outcomes?.filter(o => o.name === game.away_team).forEach(o => {
                    options.push({ label: `${game.away_team} ${o.point > 0 ? '+' : ''}${o.point}`, type: 'Spread', pick: `${game.away_team} ${o.point > 0 ? '+' : ''}${o.point}`, odds: o.price, marketKey: 'spreads', outcomeName: o.name, outcomePoint: o.point });
                  });
                  // Home spread
                  spreads?.outcomes?.filter(o => o.name === game.home_team).forEach(o => {
                    options.push({ label: `${game.home_team} ${o.point > 0 ? '+' : ''}${o.point}`, type: 'Spread', pick: `${game.home_team} ${o.point > 0 ? '+' : ''}${o.point}`, odds: o.price, marketKey: 'spreads', outcomeName: o.name, outcomePoint: o.point });
                  });
                  // Moneylines
                  h2h?.outcomes?.forEach(o => {
                    options.push({ label: `${o.name} ML`, type: 'Moneyline', pick: `${o.name} ${formatOdds(o.price)}`, odds: o.price, marketKey: 'h2h', outcomeName: o.name });
                  });
                  // Totals
                  totals?.outcomes?.forEach(o => {
                    options.push({ label: `${o.name} ${o.point}`, type: 'Total', pick: `${o.name} ${o.point}`, odds: o.price, marketKey: 'totals', outcomeName: o.name, outcomePoint: o.point });
                  });
                  return options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPendingBet({
                          game: `${game.away_team} vs ${game.home_team}`,
                          type: opt.type,
                          pick: opt.pick,
                          odds: opt.odds,
                          date: game.commence_time,
                          gameId: game.id,
                          sportKey: game.sport_key,
                          marketKey: opt.marketKey,
                          outcomeName: opt.outcomeName,
                          outcomePoint: opt.outcomePoint,
                          commenceTime: game.commence_time,
                        });
                        setShowQuickPick(false);
                      }}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        width: '100%', padding: '7px 10px', marginBottom: '4px',
                        background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(71,85,105,0.3)',
                        borderRadius: '6px', cursor: 'pointer', color: '#e2e8f0',
                        fontSize: '11px', fontFamily: "'JetBrains Mono', monospace",
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.8)'}
                    >
                      <span>{opt.label}</span>
                      <span style={{ color: '#818cf8', fontWeight: 700 }}>{formatOdds(opt.odds)}</span>
                    </button>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="game-teams">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{
              padding: '2px 6px',
              background: isLive ? 'rgba(239, 68, 68, 0.2)' : isFinal ? 'rgba(100,116,139,0.2)' : `${sportVisual.color}20`,
              color: isLive ? '#ef4444' : isFinal ? '#94a3b8' : sportVisual.color,
              borderRadius: '4px', fontSize: '9px', fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: '4px',
            }}>
              <span aria-hidden="true" style={isLive ? { animation: 'efPulse 1.4s ease-in-out infinite' } : undefined}>
                {isLive ? '●' : isFinal ? '✓' : sportVisual.icon}
              </span>
              {isLive ? 'LIVE' : isFinal ? 'FINAL' : sportLabel}
            </span>
            {/* Precise live game clock: "Top 5th", "Q3 4:21", "2nd 12:05"… */}
            {isLive && status.detail && (
              <span style={{
                padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 700,
                background: 'rgba(239,68,68,0.12)', color: '#fca5a5',
                display: 'inline-flex', alignItems: 'center', gap: '4px',
              }}>{status.detail}</span>
            )}
            {/* Edge Score™ badge — Pro users see score, free users see lock */}
            {tier === 'pro' ? (
              <span style={{
                padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 700,
                background: edgeBadge.bg, color: edgeBadge.color
              }}>{edgeBadge.label} {edgeScore}</span>
            ) : (
              <span style={{
                padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 700,
                background: 'rgba(100,116,139,0.2)', color: '#64748b'
              }}><Lock size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> Edge</span>
            )}
            {/* Trending indicator — FREE for all users, shows when line moved 3+ times */}
            {isTrending && (
              <span style={{
                padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 700,
                background: 'rgba(245,158,11,0.2)', color: '#f59e0b'
              }}>MOVING</span>
            )}
            {spreadMoveSignal && spreadMoveSignal.moveAbs >= 1 && (
              <span style={{
                padding: '1px 5px',
                background: 'rgba(249, 115, 22, 0.2)',
                borderRadius: '3px', fontSize: '9px',
                color: '#f97316', fontWeight: 700
              }}>STEAM {spreadMoveSignal.team}</span>
            )}
            {tier === 'pro' && disagreement.top && disagreement.top.strength !== 'LOW' && (
              <span style={{
                padding: '1px 5px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: 700,
                background: 'rgba(234,179,8,0.16)',
                color: '#fbbf24'
              }}>DISAGREE {disagreement.top.range}{disagreement.top.unit}</span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <TeamLogo name={game.away_team} url={awayLogo} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{game.away_team}</span>
            </span>
            {awayInjuries.length > 0 && (
              <span style={{ padding: '1px 5px', background: 'rgba(239,68,68,0.2)', borderRadius: '3px', fontSize: '9px', color: '#ef4444', fontWeight: 700 }}>
                INJ {awayInjuries.length}
              </span>
            )}
            {hasGameScore && <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>{status.awayScore}</span>}
            <span style={{ color: '#64748b', fontSize: '12px' }}>@</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <TeamLogo name={game.home_team} url={homeLogo} />
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{game.home_team}</span>
            </span>
            {homeInjuries.length > 0 && (
              <span style={{ padding: '1px 5px', background: 'rgba(239,68,68,0.2)', borderRadius: '3px', fontSize: '9px', color: '#ef4444', fontWeight: 700 }}>
                INJ {homeInjuries.length}
              </span>
            )}
            {hasGameScore && <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>{status.homeScore}</span>}
          </div>
          {/* Fair odds summary on card */}
          <div className="game-fair-line" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {spreadFair && <HoldBadge hold={spreadFair.hold} />}
            {h2hFair && (
              <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                Fair ML: {h2hFair.outcomes?.map(o => formatOdds(o.fairPrice)).join(' / ')}
              </span>
            )}
            {/* Pro users see implied probabilities */}
            {tier === 'pro' && h2hFair && (
              <span style={{ fontSize: '9px', color: '#a78bfa' }}>
                Win%: {h2hFair.outcomes?.map(o => `${(o.fairProb * 100).toFixed(0)}%`).join(' / ')}
              </span>
            )}
            {/* Pro users see EV indicator if best odds have +EV */}
            {tier === 'pro' && bestH2hHome && h2hFair && (() => {
              const fairHome = h2hFair.outcomes?.find(o => o.name === game.home_team);
              if (fairHome) {
                const ev = calculateEV(bestH2hHome.price, fairHome.fairProb);
                if (ev && ev > 0) return (
                  <span style={{ fontSize: '9px', padding: '1px 5px', background: 'rgba(34,197,94,0.2)', borderRadius: '3px', color: '#22c55e', fontWeight: 700 }}>
                    +EV {ev.toFixed(1)}%
                  </span>
                );
              }
              return null;
            })()}
            {tier === 'pro' && topShop && (
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                background: 'rgba(20,184,166,0.16)',
                borderRadius: '3px',
                color: '#2dd4bf',
                fontWeight: 700
              }}>
                Shop {lineShopping.label}: {topShop.label} {formatOdds(topShop.best.price)} at {BOOKMAKERS[topShop.best.book] || topShop.best.bookTitle} saves {topShop.centsSaved}c
              </span>
            )}
            {tier !== 'pro' && topShop && (
              <span style={{
                fontSize: '9px',
                padding: '1px 5px',
                background: 'rgba(20,184,166,0.10)',
                borderRadius: '3px',
                color: '#5eead4',
                fontWeight: 700
              }}>
                <Lock size={9} style={{ display: 'inline', verticalAlign: 'middle' }} /> Line Shopping
              </span>
            )}
          </div>
        </div>

        <div className="game-spread">
          {threeWay ? (
            <>
              <div style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {formatOdds(threeWay.home?.price)} / {formatOdds(threeWay.draw?.price)} / {formatOdds(threeWay.away?.price)}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>1X2 · {game.bookmakers?.length || 0} books</div>
            </>
          ) : homeSpread ? (
            <>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                {homeSpread.point > 0 ? '+' : ''}{homeSpread.point}
              </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{game.bookmakers?.length || 0} books</div>
            </>
          ) : <span style={{ color: '#64748b', fontSize: '12px' }}>N/A</span>}
        </div>

        <div className="game-total">
          {totalLine ? (
            <>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>O/U {totalLine.point}</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{firstBook.title}</div>
            </>
          ) : <span style={{ color: '#64748b', fontSize: '12px' }}>N/A</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: '11px', padding: '3px 8px', borderRadius: '4px',
            background: isLive ? 'rgba(239,68,68,0.2)' : 'transparent',
            color: isLive ? '#ef4444' : '#94a3b8',
            fontWeight: isLive ? 700 : 400, whiteSpace: 'nowrap',
          }}>{statusDisplay(status, game.commence_time)}</span>
          {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </div>
      </div>
    </div>
  );
}
