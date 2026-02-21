import React, { useState } from 'react';
import { Star, ChevronDown, ChevronUp, Share2, Lock } from 'lucide-react';
import { getConsensusFairOdds, formatOdds, isPositiveEV, findBestOdds, americanToImplied, calculateEV, calculateEdgeScore } from '../utils/odds-math.js';
import { BOOKMAKERS } from '../constants.js';
import { useAuth } from '../AuthGate.jsx';

function getSportColor(sport) {
  const colors = { NBA: '#f97316', NFL: '#22c55e', NHL: '#3b82f6', MLB: '#ef4444' };
  return colors[sport] || '#6b7280';
}

function formatGameTime(date) {
  const now = new Date();
  if (date < now) return 'LIVE';
  const diff = date - now;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
  injuries, gameLineHistory, setPendingBet
}) {
  const { tier } = useAuth(); // Get tier for EV display
  const [copied, setCopied] = useState(false); // For share button "Copied!" tooltip
  const [showQuickPick, setShowQuickPick] = useState(false); // Quick-pick bet popover
  const isLive = new Date(game.commence_time) < new Date();

  // === EDGE SCOREâ¢ â pro-only composite rating ===
  const edgeScore = calculateEdgeScore(game, gameLineHistory);
  // Map score to label + color for the badge
  const edgeBadge = edgeScore <= 40
    ? { label: 'LOW', color: '#64748b', bg: 'rgba(100,116,139,0.2)' }
    : edgeScore <= 60
    ? { label: 'MID', color: '#eab308', bg: 'rgba(234,179,8,0.15)' }
    : edgeScore <= 80
    ? { label: 'EDGE', color: '#22c55e', bg: 'rgba(34,197,94,0.15)' }
    : { label: '🔥 HOT', color: '#f97316', bg: 'rgba(249,115,22,0.2)' };

  // === TRENDING â free for all users ===
  // If line history has 3+ entries, the line is actively moving
  const historyEntries = gameLineHistory[game.id] || [];
  const isTrending = historyEntries.length >= 3;

  // === SHARE â copy game summary to clipboard ===
  const handleShare = (e) => {
    e.stopPropagation(); // Don't toggle card expand
    const spreadText = homeSpread ? `Spread: ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point}` : '';
    const totalText = totalLine ? `Total: ${totalLine.point}` : '';
    const parts = [`${game.away_team} vs ${game.home_team}`, spreadText, totalText, 'via Edge Finder edgefinder-betting.vercel.app'].filter(Boolean);
    navigator.clipboard.writeText(parts.join(' | ')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const sportLabel = game.sport_title?.split(' ')[0] || 'NBA';

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

  // Line movement
  const history = gameLineHistory[game.id] || [];
  const hasMovement = history.length > 1;
  const start = history[0]?.spread;
  const current = history[history.length - 1]?.spread;
  const move = hasMovement ? current - start : 0;

  // Injury counts
  const awayKey = game.away_team?.split(' ')?.pop()?.toLowerCase();
  const homeKey = game.home_team?.split(' ')?.pop()?.toLowerCase();
  const awayInjuries = injuries[game.away_team?.toLowerCase()] || injuries[awayKey] || [];
  const homeInjuries = injuries[game.home_team?.toLowerCase()] || injuries[homeKey] || [];

  const firstBook = game.bookmakers?.[0];
  const homeSpread = firstBook?.markets?.find(m => m.key === 'spreads')?.outcomes?.find(o => o.name === game.home_team);
  const totalLine = firstBook?.markets?.find(m => m.key === 'totals')?.outcomes?.[0];

  return (
    <div>
      {/* Clickable card header */}
      <div onClick={onToggle} className="game-card-header" style={{
        padding: '16px 20px',
        background: expanded ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.6)',
        border: `1px solid ${expanded ? 'rgba(99, 102, 241, 0.4)' : 'rgba(71, 85, 105, 0.2)'}`,
        borderRadius: '12px', cursor: 'pointer',
        display: 'grid', gridTemplateColumns: '40px 2fr 120px 120px 80px',
        alignItems: 'center', gap: '16px'
      }}>
        {/* Watchlist star + Share button side by side */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <button onClick={(e) => { e.stopPropagation(); onToggleWatchlist(game.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Star size={18} color={watchlist.includes(game.id) ? '#fbbf24' : '#475569'}
              fill={watchlist.includes(game.id) ? '#fbbf24' : 'none'} />
          </button>
          {/* Share button â copies game summary to clipboard (free for everyone) */}
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
          {/* ð¯ Quick Bet button â opens a popover with the main lines to track */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowQuickPick(!showQuickPick); }}
              title="Quick bet â track this game"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                fontSize: '14px', lineHeight: 1,
              }}
            >🎯</button>
            {/* Quick-pick popover: shows the main lines for one-tap tracking */}
            {showQuickPick && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)',
                  zIndex: 100, background: '#1e293b', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: '10px', padding: '10px', minWidth: '220px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                <div style={{ fontSize: '10px', color: '#818cf8', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
                  QUICK BET â tap a line
                </div>
                {/* Build quick-pick options from the first bookmaker's lines */}
                {(() => {
                  const book = game.bookmakers?.[0];
                  if (!book) return <div style={{ fontSize: '11px', color: '#64748b' }}>No odds available</div>;
                  const spreads = book.markets?.find(m => m.key === 'spreads');
                  const h2h = book.markets?.find(m => m.key === 'h2h');
                  const totals = book.markets?.find(m => m.key === 'totals');
                  // Each option: { label, type, pick, odds }
                  const options = [];
                  // Away spread
                  spreads?.outcomes?.filter(o => o.name === game.away_team).forEach(o => {
                    options.push({ label: `${game.away_team} ${o.point > 0 ? '+' : ''}${o.point}`, type: 'Spread', pick: `${game.away_team} ${o.point > 0 ? '+' : ''}${o.point}`, odds: o.price });
                  });
                  // Home spread
                  spreads?.outcomes?.filter(o => o.name === game.home_team).forEach(o => {
                    options.push({ label: `${game.home_team} ${o.point > 0 ? '+' : ''}${o.point}`, type: 'Spread', pick: `${game.home_team} ${o.point > 0 ? '+' : ''}${o.point}`, odds: o.price });
                  });
                  // Moneylines
                  h2h?.outcomes?.forEach(o => {
                    options.push({ label: `${o.name} ML`, type: 'Moneyline', pick: `${o.name} ${formatOdds(o.price)}`, odds: o.price });
                  });
                  // Totals
                  totals?.outcomes?.forEach(o => {
                    options.push({ label: `${o.name} ${o.point}`, type: 'Total', pick: `${o.name} ${o.point}`, odds: o.price });
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
              background: game.scores ? 'rgba(239, 68, 68, 0.2)' : `${getSportColor(sportLabel)}20`,
              color: game.scores ? '#ef4444' : getSportColor(sportLabel),
              borderRadius: '4px', fontSize: '9px', fontWeight: 700
            }}>{game.scores ? 'LIVE' : sportLabel}</span>
            {/* Edge Scoreâ¢ badge â Pro users see score, free users see lock */}
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
            {/* Trending indicator â FREE for all users, shows when line moved 3+ times */}
            {isTrending && (
              <span style={{
                padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: 700,
                background: 'rgba(245,158,11,0.2)', color: '#f59e0b'
              }}>📊 MOVING</span>
            )}
            {hasMovement && Math.abs(move) >= 1 && (
              <span style={{
                padding: '1px 5px',
                background: move > 0 ? 'rgba(249, 115, 22, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                borderRadius: '3px', fontSize: '9px',
                color: move > 0 ? '#f97316' : '#3b82f6', fontWeight: 700
              }}>{move > 0 ? '🔥 STEAM' : '❄️ FADE'}</span>
            )}
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{game.away_team}</span>
            {awayInjuries.length > 0 && (
              <span style={{ padding: '1px 5px', background: 'rgba(239,68,68,0.2)', borderRadius: '3px', fontSize: '9px', color: '#ef4444', fontWeight: 700 }}>
                🏥 {awayInjuries.length}
              </span>
            )}
            {game.scores && <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>{game.awayScore}</span>}
            <span style={{ color: '#64748b', fontSize: '12px' }}>@</span>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>{game.home_team}</span>
            {homeInjuries.length > 0 && (
              <span style={{ padding: '1px 5px', background: 'rgba(239,68,68,0.2)', borderRadius: '3px', fontSize: '9px', color: '#ef4444', fontWeight: 700 }}>
                🏥 {homeInjuries.length}
              </span>
            )}
            {game.scores && <span style={{ fontWeight: 700, fontSize: '16px', color: '#f8fafc' }}>{game.homeScore}</span>}
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
          </div>
        </div>

        <div className="game-spread">
          {homeSpread ? (
            <>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                {homeSpread.point > 0 ? '+' : ''}{homeSpread.point}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{firstBook.title}</div>
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
            fontWeight: isLive ? 700 : 400
          }}>{formatGameTime(new Date(game.commence_time))}</span>
          {expanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
        </div>
      </div>
    </div>
  );
}
