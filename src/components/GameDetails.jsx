import React from 'react';
import { TrendingUp } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BOOKMAKERS, FREE_BOOKS } from '../constants.js';
import { getConsensusFairOdds, formatOdds, isPositiveEV, findBestOdds } from '../utils/odds-math.js';
import { buildPremiumGameSummary } from '../utils/game-summary.js';
import { useAuth } from '../AuthGate.jsx';
import ProBanner from './ProBanner.jsx';
import GameResearch from './GameResearch.jsx';

function HoldBadge({ hold }) {
  if (hold === null || hold === undefined) return null;
  const color = hold < 3 ? '#22c55e' : hold < 5 ? '#eab308' : '#ef4444';
  const bg = hold < 3 ? 'rgba(34,197,94,0.15)' : hold < 5 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)';
  return <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '3px', background: bg, color, fontWeight: 600 }}>Hold: {hold}%</span>;
}

export default function GameDetails({
  game, injuries, gameLineHistory, manualOpeners, setManualOpeners, historicOdds, enabledBooks,
  setPendingBet // Called when user clicks on odds to track a bet
}) {
  // Get the user's subscription tier to control which books are visible
  const { tier } = useAuth();
  const history = gameLineHistory[game.id] || [];
  const manualOpener = manualOpeners[game.id];
  const historicOpener = historicOdds[game.id];

  const opener = manualOpener?.spread ?? historicOpener?.spread ?? history[0]?.spread;
  const openerTotal = manualOpener?.total ?? historicOpener?.total ?? history[0]?.total;
  const current = history.length > 0 ? history[history.length - 1]?.spread :
    game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')?.outcomes?.find(o => o.name === game.home_team)?.point;
  const currentTotal = history.length > 0 ? history[history.length - 1]?.total :
    game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals')?.outcomes?.[0]?.point;
  const spreadMove = current != null && opener != null ? current - opener : 0;
  const totalMove = currentTotal != null && openerTotal != null ? currentTotal - openerTotal : 0;
  const hasHistory = history.length > 1;

  // Fair odds per market
  const spreadFair = getConsensusFairOdds(game.bookmakers, 'spreads');
  const h2hFair = getConsensusFairOdds(game.bookmakers, 'h2h');
  const totalFair = getConsensusFairOdds(game.bookmakers, 'totals');

  // Best odds
  const bestOddsMap = {};
  ['h2h', 'spreads', 'totals'].forEach(mkt => {
    const outcomes = game.bookmakers?.[0]?.markets?.find(m => m.key === mkt)?.outcomes || [];
    outcomes.forEach(o => {
      const best = findBestOdds(game.bookmakers, mkt, o.name);
      if (best) bestOddsMap[`${mkt}-${o.name}`] = best;
    });
  });

  const spreadOutcomes = game.bookmakers?.[0]?.markets?.find(m => m.key === 'spreads')?.outcomes || [];
  const totalOutcomes = game.bookmakers?.[0]?.markets?.find(m => m.key === 'totals')?.outcomes || [];
  const moneylineOutcomes = game.bookmakers?.[0]?.markets?.find(m => m.key === 'h2h')?.outcomes || [];

  const spreadCandidates = spreadOutcomes.map(o => {
    const best = bestOddsMap[`spreads-${o.name}`];
    return best ? { ...best, market: 'spreads', point: o.point, name: o.name } : null;
  }).filter(Boolean);
  const totalCandidates = totalOutcomes.map(o => {
    const best = bestOddsMap[`totals-${o.name}`];
    return best ? { ...best, market: 'totals', point: o.point, name: o.name } : null;
  }).filter(Boolean);
  const moneylineCandidates = moneylineOutcomes.map(o => {
    const best = bestOddsMap[`h2h-${o.name}`];
    return best ? { ...best, market: 'h2h', name: o.name } : null;
  }).filter(Boolean);

  const bestSpreadCandidate = spreadCandidates.find(c => c.name === game.home_team) || spreadCandidates[0] || null;
  const bestTotalCandidate = totalCandidates[0] || null;
  const bestMoneylineCandidate = moneylineCandidates.find(c => c.name === game.home_team) || moneylineCandidates[0] || null;

  // Injury data - try new prefixed format first, then fall back to old format
  // This prevents cross-league collisions (e.g., Philadelphia Eagles vs Winthrop Eagles)
  const sportPrefix = game.sport_key?.split('_')[0] || 'basketball'; // basketball, americanfootball, etc.
  const awayKey = game.away_team?.split(' ')?.pop()?.toLowerCase();
  const homeKey = game.home_team?.split(' ')?.pop()?.toLowerCase();
  const awayFullKey = `${sportPrefix}:${game.away_team}`?.toLowerCase();
  const homeFullKey = `${sportPrefix}:${game.home_team}`?.toLowerCase();
  const awayShortKey = `${sportPrefix}:${awayKey}`;
  const homeShortKey = `${sportPrefix}:${homeKey}`;
  
  const awayInjuries = injuries[awayFullKey] || injuries[awayShortKey] || injuries[game.away_team?.toLowerCase()] || injuries[awayKey] || [];
  const homeInjuries = injuries[homeFullKey] || injuries[homeShortKey] || injuries[game.home_team?.toLowerCase()] || injuries[homeKey] || [];
  const allInjuries = [...awayInjuries, ...homeInjuries];

  const premiumSummary = buildPremiumGameSummary({
    game,
    opener,
    currentSpread: current,
    openerTotal,
    currentTotal,
    spreadMove,
    totalMove,
    allInjuries,
    bestSpread: bestSpreadCandidate,
    bestTotal: bestTotalCandidate,
    bestMoneyline: bestMoneylineCandidate,
    spreadCandidates,
    totalCandidates,
    moneylineCandidates,
  });

  // Trend
  let trendText = '', trendColor = '', trendIcon = '';
  const spreadMoveAbs = Math.abs(spreadMove);
  if (spreadMoveAbs >= 2) {
    trendText = spreadMove > 0 ? `HEAVY PUBLIC ACTION on ${game.home_team}` : `SHARP MONEY on ${game.away_team}`;
    trendColor = spreadMove > 0 ? '#f97316' : '#3b82f6';
    trendIcon = spreadMove > 0 ? '🏆¥' : '🏆°';
  } else if (spreadMoveAbs >= 1) {
    trendText = spreadMove > 0 ? `Steam move toward ${game.home_team}` : `Line fading ${game.home_team}`;
    trendColor = spreadMove > 0 ? '#f97316' : '#64748b';
    trendIcon = spreadMove > 0 ? '🏆' : '🏆';
  }

  return (
    <div style={{
      marginTop: '8px', padding: '16px 20px',
      background: 'rgba(15, 23, 42, 0.8)',
      border: '1px solid rgba(71, 85, 105, 0.2)', borderRadius: '12px'
    }}>
      {/* Premium Game Summary */}
      {tier === 'pro' ? (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(59,130,246,0.08))',
          border: '1px solid rgba(99, 102, 241, 0.28)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
            <h4 style={{ fontSize: '12px', color: '#c4b5fd', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Premium Game Summary</h4>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '4px 8px', borderRadius: '999px',
              background: premiumSummary.readLabel === 'Playable' ? 'rgba(34,197,94,0.18)' : premiumSummary.readLabel === 'Monitor' ? 'rgba(234,179,8,0.18)' : premiumSummary.readLabel === 'Thin Edge' ? 'rgba(59,130,246,0.18)' : 'rgba(100,116,139,0.18)',
              color: premiumSummary.readLabel === 'Playable' ? '#22c55e' : premiumSummary.readLabel === 'Monitor' ? '#eab308' : premiumSummary.readLabel === 'Thin Edge' ? '#38bdf8' : '#94a3b8'
            }}>{premiumSummary.readLabel}</span>
          </div>

          <div style={{ fontSize: '12px', color: '#e2e8f0', marginBottom: '10px' }}>
            <span style={{ color: '#94a3b8' }}>Market snapshot:</span> {premiumSummary.snapshot || 'Building snapshot...'}
          </div>

          {premiumSummary.bullets?.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>What stands out</div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: '#cbd5e1', fontSize: '12px', lineHeight: 1.5 }}>
                {premiumSummary.bullets.map((bullet, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{bullet}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>
            <span style={{ color: '#94a3b8' }}>Why:</span> {premiumSummary.reason}
          </div>

          <div style={{ fontSize: '12px', color: '#cbd5e1', marginBottom: '8px' }}>
            <span style={{ color: '#94a3b8' }}>Sport note:</span> {premiumSummary.sportNote}
          </div>

          <div style={{ fontSize: '12px', color: '#f8fafc', fontWeight: 600 }}>
            <span style={{ color: '#94a3b8', fontWeight: 500 }}>Best angle:</span> {premiumSummary.bestAngle}
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: '16px', padding: '16px', background: 'rgba(30, 41, 59, 0.45)', borderRadius: '12px',
          border: '1px solid rgba(99, 102, 241, 0.18)'
        }}>
          <div style={{ fontSize: '12px', color: '#c4b5fd', textTransform: 'uppercase', marginBottom: '8px' }}>Premium Game Summary</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6, marginBottom: '10px' }}>
            Unlock a sharper game read: market snapshot, what stands out, sport-specific context, and the best current angle.
          </div>
          <ProBanner compact />
        </div>
      )}

      {/* ALL LINES with fair odds, best odds highlighting, hold */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          ALL LINES
          {spreadFair && <HoldBadge hold={spreadFair.hold} />}
          {h2hFair && <span style={{ fontSize: '9px', color: '#64748b' }}>ML Hold: {h2hFair.hold}%</span>}
          {totalFair && <span style={{ fontSize: '9px', color: '#64748b' }}>Total Hold: {totalFair.hold}%</span>}
        </h4>

        {/* Fair line header */}
        {(spreadFair || h2hFair) && (
          <div style={{
            display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr',
            padding: '6px 12px', marginBottom: '4px',
            background: 'rgba(99, 102, 241, 0.1)', borderRadius: '6px', fontSize: '10px', color: '#818cf8'
          }}>
            <span>🏆 FAIR LINE</span>
            <span>{h2hFair ? `ML: ${h2hFair.outcomes?.map(o => formatOdds(o.fairPrice)).join(' / ')}` : ''}</span>
            <span>{spreadFair ? `Spread: ${spreadFair.outcomes?.map(o => formatOdds(o.fairPrice)).join(' / ')}` : ''}</span>
            <span>{totalFair ? `Total: ${totalFair.outcomes?.map(o => formatOdds(o.fairPrice)).join(' / ')}` : ''}</span>
          </div>
        )}

        <div style={{ display: 'grid', gap: '6px' }}>
          {game.bookmakers?.filter(book => {
            // Filter by enabled books AND by tier (free users only see FREE_BOOKS)
            const isEnabledBook = !enabledBooks || enabledBooks.includes(book.key);
            const isTierAllowed = tier === 'pro' || FREE_BOOKS.includes(book.key);
            return isEnabledBook && isTierAllowed;
          }).slice(0, 7).map(book => {
            const h2h = book.markets?.find(m => m.key === 'h2h');
            const spreads = book.markets?.find(m => m.key === 'spreads');
            const totals = book.markets?.find(m => m.key === 'totals');

            return (
              <div key={book.key} className="book-line-row" style={{
                display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr',
                alignItems: 'center', padding: '8px 12px',
                background: 'rgba(30, 41, 59, 0.5)', borderRadius: '6px', fontSize: '12px'
              }}>
                <span style={{ fontWeight: 600 }}>{BOOKMAKERS[book.key] || book.title}</span>

                {/* Moneyline ★ clickable! Tap any odds to send to Bet Tracker */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {h2h?.outcomes?.map((o, i) => {
                    const isBest = bestOddsMap[`h2h-${o.name}`]?.book === book.key;
                    const fair = h2hFair?.outcomes?.find(fo => fo.name === o.name);
                    const isPEV = fair && isPositiveEV(o.price, fair.fairPrice);
                    return (
                      <span key={i}
                        title="Click to track this bet"
                        onClick={() => setPendingBet && setPendingBet({
                          game: `${game.away_team} vs ${game.home_team}`,
                          type: 'Moneyline',
                          pick: `${o.name} ${formatOdds(o.price)}`,
                          odds: o.price,
                          date: game.commence_time,
                          gameId: game.id,
                          sportKey: game.sport_key,
                          marketKey: 'h2h',
                          outcomeName: o.name,
                          commenceTime: game.commence_time,
                        })}
                        className="clickable-odds"
                        style={{
                          color: isPEV ? '#22c55e' : isBest ? '#38bdf8' : '#e2e8f0',
                          fontWeight: (isBest || isPEV) ? 700 : 400,
                          background: isPEV ? 'rgba(34,197,94,0.15)' : isBest ? 'rgba(56,189,248,0.1)' : 'transparent',
                          padding: '1px 4px', borderRadius: '3px',
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}>
                        {o.name?.split(' ').pop()} {formatOdds(o.price)}
                        {isPEV && <span style={{ fontSize: '8px', marginLeft: '2px' }}>+EV</span>}
                      </span>
                    );
                  })}
                </div>

                {/* Spread ★ clickable! */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {spreads?.outcomes?.map((o, i) => {
                    const isBest = bestOddsMap[`spreads-${o.name}`]?.book === book.key;
                    const fair = spreadFair?.outcomes?.find(fo => fo.name === o.name);
                    const isPEV = fair && isPositiveEV(o.price, fair.fairPrice);
                    return (
                      <span key={i}
                        title="Click to track this bet"
                        onClick={() => setPendingBet && setPendingBet({
                          game: `${game.away_team} vs ${game.home_team}`,
                          type: 'Spread',
                          pick: `${o.name} ${o.point > 0 ? '+' : ''}${o.point}`,
                          odds: o.price,
                          date: game.commence_time,
                          gameId: game.id,
                          sportKey: game.sport_key,
                          marketKey: 'spreads',
                          outcomeName: o.name,
                          outcomePoint: o.point,
                          commenceTime: game.commence_time,
                        })}
                        className="clickable-odds"
                        style={{
                          color: isPEV ? '#22c55e' : isBest ? '#38bdf8' : '#e2e8f0',
                          fontWeight: (isBest || isPEV) ? 700 : 400,
                          background: isPEV ? 'rgba(34,197,94,0.15)' : isBest ? 'rgba(56,189,248,0.1)' : 'transparent',
                          padding: '1px 4px', borderRadius: '3px',
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}>
                        {o.point > 0 ? '+' : ''}{o.point} ({formatOdds(o.price)})
                        {isPEV && <span style={{ fontSize: '8px', marginLeft: '2px' }}>+EV</span>}
                      </span>
                    );
                  })}
                </div>

                {/* Totals ★ clickable! */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {totals?.outcomes?.map((o, i) => {
                    const isBest = bestOddsMap[`totals-${o.name}`]?.book === book.key;
                    const fair = totalFair?.outcomes?.find(fo => fo.name === o.name);
                    const isPEV = fair && isPositiveEV(o.price, fair.fairPrice);
                    return (
                      <span key={i}
                        title="Click to track this bet"
                        onClick={() => setPendingBet && setPendingBet({
                          game: `${game.away_team} vs ${game.home_team}`,
                          type: 'Total',
                          pick: `${o.name} ${o.point}`,
                          odds: o.price,
                          date: game.commence_time,
                          gameId: game.id,
                          sportKey: game.sport_key,
                          marketKey: 'totals',
                          outcomeName: o.name,
                          outcomePoint: o.point,
                          commenceTime: game.commence_time,
                        })}
                        className="clickable-odds"
                        style={{
                          color: isPEV ? '#22c55e' : isBest ? '#38bdf8' : '#e2e8f0',
                          fontWeight: (isBest || isPEV) ? 700 : 400,
                          background: isPEV ? 'rgba(34,197,94,0.15)' : isBest ? 'rgba(56,189,248,0.1)' : 'transparent',
                          padding: '1px 4px', borderRadius: '3px',
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}>
                        {o.name} {o.point} ({formatOdds(o.price)})
                        {isPEV && <span style={{ fontSize: '8px', marginLeft: '2px' }}>+EV</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Show upgrade banner for free users who are missing books */}
        {tier === 'free' && (
          <div style={{ marginTop: '12px' }}>
            <ProBanner compact />
          </div>
        )}
      </div>

      {/* Mini Sparkline ★ quick visual of spread movement (Pro only) */}
      {hasHistory && tier === 'pro' && (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(30, 41, 59, 0.5)', borderRadius: '8px' }}>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px' }}>🏆 SPREAD SPARKLINE</div>
          <div style={{ height: '60px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <Line type="monotone" dataKey="spread" stroke="#818cf8" strokeWidth={2} dot={false} />
                <YAxis domain={['auto', 'auto']} hide />
                <XAxis dataKey="time" hide />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {/* Free users see a placeholder for the sparkline */}
      {hasHistory && tier === 'free' && (
        <div style={{
          marginBottom: '16px', padding: '14px',
          background: 'rgba(30, 41, 59, 0.4)', borderRadius: '8px',
          textAlign: 'center', fontSize: '12px', color: '#64748b',
        }}>
          🏆 Line history sparkline ★ <span style={{ color: '#818cf8', fontWeight: 600 }}>Pro</span>
        </div>
      )}

      {/* Line Movement */}
      {hasHistory ? (
        <>
          <div style={{ marginBottom: '16px', padding: '16px', background: 'rgba(30, 41, 59, 0.6)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h4 style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>🏆 LINE MOVEMENT</h4>
              {manualOpener ? (
                <span style={{ fontSize: '9px', color: '#22c55e', background: 'rgba(34,197,94,0.2)', padding: '2px 6px', borderRadius: '3px' }}>★ Manual Opener</span>
              ) : historicOpener ? (
                <span style={{ fontSize: '9px', color: '#6366f1', background: 'rgba(99,102,241,0.2)', padding: '2px 6px', borderRadius: '3px' }}>🏆 Historic Opener</span>
              ) : (
                <span style={{ fontSize: '9px', color: '#64748b', background: 'rgba(100,116,139,0.2)', padding: '2px 6px', borderRadius: '3px' }}>Tracking from app load</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>OPENER</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#94a3b8' }}>{opener > 0 ? '+' : ''}{opener}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: spreadMove > 0 ? '#22c55e' : spreadMove < 0 ? '#ef4444' : '#64748b' }}>
                  {spreadMove > 0 ? '★' : spreadMove < 0 ? '★' : '★'}
                </div>
                <div style={{
                  fontSize: '12px', fontWeight: 600, padding: '4px 10px',
                  background: spreadMove !== 0 ? (spreadMove > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)') : 'rgba(100,116,139,0.2)',
                  borderRadius: '4px',
                  color: spreadMove > 0 ? '#22c55e' : spreadMove < 0 ? '#ef4444' : '#64748b'
                }}>{spreadMove > 0 ? '+' : ''}{spreadMove.toFixed(1)}</div>
              </div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>CURRENT</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc' }}>{current > 0 ? '+' : ''}{current}</div>
              </div>
            </div>
            {currentTotal && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', paddingTop: '12px', borderTop: '1px solid rgba(71,85,105,0.3)' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Total: {openerTotal} ★ {currentTotal}</span>
                {totalMove !== 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600, padding: '2px 8px',
                    background: totalMove > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                    borderRadius: '3px', color: totalMove > 0 ? '#22c55e' : '#ef4444'
                  }}>{totalMove > 0 ? '+' : ''}{totalMove.toFixed(1)}</span>
                )}
              </div>
            )}
          </div>

          {trendText && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(30,41,59,0.5)', borderRadius: '8px', borderLeft: `3px solid ${trendColor}` }}>
              <h4 style={{ fontSize: '12px', color: trendColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                {trendIcon} {trendText}
              </h4>
            </div>
          )}

          {/* Chart */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} /> LINE HISTORY CHART
            </h4>
            <div style={{ height: '120px', background: 'rgba(15,23,42,0.5)', borderRadius: '8px', padding: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id={`colorSpread-${game.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px' }}
                    itemStyle={{ color: '#e2e8f0' }} labelStyle={{ color: '#64748b' }}
                    formatter={(v) => v ?? 'N/A'}
                  />
                  <Area type="monotone" dataKey="spread" stroke="#6366f1" strokeWidth={2}
                    fillOpacity={1} fill={`url(#colorSpread-${game.id})`} name="Spread" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(30,41,59,0.5)', borderRadius: '8px' }}>
          <h4 style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>🏆 BETTING TRENDS</h4>
          <p style={{ fontSize: '11px', color: '#64748b' }}>Collecting data... trends will appear after next refresh</p>
        </div>
      )}

      {/* Manual Opener */}
      <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(30,41,59,0.5)', borderRadius: '8px', border: '1px solid rgba(71,85,105,0.3)' }}>
        <h4 style={{ fontSize: '11px', color: '#64748b', marginBottom: '8px' }}>⚙️ SET TRUE OPENER</h4>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="number" step="0.5" placeholder="Spread" defaultValue={manualOpener?.spread || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setManualOpeners(prev => ({ ...prev, [game.id]: { ...prev[game.id], spread: v } }));
            }}
            style={{ width: '70px', padding: '6px 10px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px' }}
          />
          <input type="number" step="0.5" placeholder="Total" defaultValue={manualOpener?.total || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) setManualOpeners(prev => ({ ...prev, [game.id]: { ...prev[game.id], total: v } }));
            }}
            style={{ width: '70px', padding: '6px 10px', background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(71,85,105,0.5)', borderRadius: '4px', color: '#e2e8f0', fontSize: '13px' }}
          />
          <button onClick={() => setManualOpeners(prev => { const n = { ...prev }; delete n[game.id]; return n; })}
            style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: '4px', color: '#ef4444', fontSize: '11px', cursor: 'pointer' }}>
            Clear
          </button>
        </div>
        <p style={{ fontSize: '10px', color: '#64748b', marginTop: '6px' }}>Enter the true opening line to track movement from there</p>
      </div>

      {/* Game Research - Recent Form, H2H, Trends */}
      <div style={{ marginBottom: '16px' }}>
        <GameResearch 
          gameId={game.id}
          sport={game.sport_key || 'basketball_nba'}
          homeTeam={game.home_team}
          awayTeam={game.away_team}
          commenceTime={game.commence_time}
        />
      </div>

      {/* Injury Report */}
      {allInjuries.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontSize: '12px', color: '#ef4444', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            🏆 INJURY REPORT ({allInjuries.length})
          </h4>
          <div style={{ display: 'grid', gap: '6px' }}>
            {allInjuries.map((inj, idx) => (
              <div key={idx} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)', borderRadius: '6px', fontSize: '12px'
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>{inj.name}</span>
                  <span style={{ color: '#64748b', marginLeft: '8px' }}>{inj.teamShort}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#ef4444', fontWeight: 600 }}>{inj.status}</div>
                  <div style={{ color: '#94a3b8', fontSize: '10px' }}>{inj.injury || 'Undisclosed'}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ fontSize: '11px', color: '#64748b' }}>
        Last updated: {new Date(game.commence_time).toLocaleString()}
      </div>

      {/* Hover effect for clickable odds cells */}
      <style>{`
        .clickable-odds:hover {
          background: rgba(99, 102, 241, 0.25) !important;
          box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.4);
        }
      `}</style>
    </div>
  );
}
