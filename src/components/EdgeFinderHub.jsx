import React, { useMemo } from 'react';
import { Star, LayoutDashboard, Zap, Activity, FileText, TrendingUp, Clock3, ShieldCheck } from 'lucide-react';
import EdgeAlerts from './EdgeAlerts.jsx';
import LineMovement from './LineMovement.jsx';
import { buildMarketInsights, getBookAbbreviation, getMarketDisplayName, getSportMeta, scorePropCandidate, formatOdds } from '../utils/props.js';
import { calculateEdgeScore, calculateEV, findBestOdds, formatOdds as formatGameOdds, getConsensusFairOdds } from '../utils/odds-math.js';

const sectionCard = {
  background: 'rgba(15, 23, 42, 0.55)',
  border: '1px solid rgba(71, 85, 105, 0.24)',
  borderRadius: '16px',
  padding: '18px',
};

function SectionShell({ icon: Icon, title, eyebrow, children, muted = false }) {
  return (
    <section style={{ ...sectionCard, opacity: muted ? 0.88 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(6,182,212,0.18))',
          border: '1px solid rgba(99,102,241,0.25)',
        }}>
          <Icon size={18} color="#c4b5fd" />
        </div>
        <div>
          <div style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>{eyebrow}</div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '2px 0 0' }}>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, note, accent = '#818cf8' }) {
  return (
    <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(30,41,59,0.55)', border: '1px solid rgba(71,85,105,0.24)' }}>
      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '22px', fontWeight: 800, color: accent }}>{value}</div>
      {note && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', lineHeight: 1.5 }}>{note}</div>}
    </div>
  );
}

function OpportunityCard({ item, index }) {
  const borderColor = item.kind === 'prop' ? 'rgba(34,197,94,0.22)' : 'rgba(99,102,241,0.24)';
  const accent = item.kind === 'prop' ? '#22c55e' : '#818cf8';

  return (
    <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(30,41,59,0.55)', border: `1px solid ${borderColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '16px' }}>{item.emoji}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700 }}>{item.sport}</span>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '999px', background: 'rgba(15,23,42,0.6)', color: '#cbd5e1' }}>#{index + 1}</span>
            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '999px', background: item.kind === 'prop' ? 'rgba(34,197,94,0.14)' : 'rgba(99,102,241,0.14)', color: accent, fontWeight: 700 }}>{item.kind === 'prop' ? 'PROP' : 'GAME'}</span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.35 }}>{item.title}</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{item.subtitle}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>{item.metricLabel}</div>
          <div style={{ fontSize: '18px', fontWeight: 800, color: accent }}>{item.metricValue}</div>
        </div>
      </div>
      <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(15,23,42,0.45)', marginBottom: '10px' }}>
        <div style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>{item.edgeLine}</div>
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px', lineHeight: 1.5 }}>{item.note}</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {item.tags.map(tag => (
          <span key={tag} style={{ fontSize: '10px', color: '#cbd5e1', background: 'rgba(51,65,85,0.7)', border: '1px solid rgba(148,163,184,0.14)', borderRadius: '999px', padding: '4px 8px' }}>{tag}</span>
        ))}
      </div>
    </div>
  );
}

function BoardFallbackCard({ title, text, badge, accent = '#94a3b8' }) {
  return (
    <div style={{ padding: '14px', borderRadius: '14px', background: 'rgba(30,41,59,0.45)', border: '1px dashed rgba(148,163,184,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{title}</div>
        {badge && <span style={{ fontSize: '10px', color: accent, fontWeight: 800 }}>{badge}</span>}
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function DailyCardItem({ item, accent }) {
  return (
    <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(30,41,59,0.55)', border: '1px solid rgba(71,85,105,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>{item.title}</div>
        <span style={{ fontSize: '10px', color: accent, fontWeight: 800 }}>{item.badge}</span>
      </div>
      <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.55 }}>{item.text}</div>
    </div>
  );
}

function buildPropBoard(playerProps, propHistory) {
  const players = {};
  playerProps.forEach(prop => {
    if (!prop.player) return;
    const key = `${prop.sport}::${prop.player}`;
    if (!players[key]) {
      players[key] = {
        key,
        sport: prop.sport,
        sportMeta: getSportMeta(prop.sport),
        name: prop.player,
        game: prop.game,
        commenceTime: prop.commence_time,
        markets: {},
      };
    }
    if (!players[key].markets[prop.market]) {
      players[key].markets[prop.market] = { line: null, over: {}, under: {}, books: new Set(), _lineVotes: {}, _overByLine: {}, _underByLine: {}, historyKeys: { over: {}, under: {} } };
    }
    const market = players[key].markets[prop.market];
    const book = prop.book || prop.bookTitle || prop.bookKey || 'Unknown';
    market.books.add(book);
    if (prop.line != null) market._lineVotes[prop.line] = (market._lineVotes[prop.line] || 0) + 1;
    if (prop.outcome === 'Over') {
      if (!market._overByLine[book]) market._overByLine[book] = {};
      if (prop.line != null) market._overByLine[book][prop.line] = prop.price;
      market.historyKeys.over[book] = [prop.sport, prop.gameId, prop.player, prop.market, prop.outcome, book].join('::');
    }
    if (prop.outcome === 'Under') {
      if (!market._underByLine[book]) market._underByLine[book] = {};
      if (prop.line != null) market._underByLine[book][prop.line] = prop.price;
      market.historyKeys.under[book] = [prop.sport, prop.gameId, prop.player, prop.market, prop.outcome, book].join('::');
    }
  });

  return Object.values(players).map(player => {
    Object.entries(player.markets).forEach(([marketKey, market]) => {
      let consensusLine = null;
      let maxVotes = 0;
      Object.entries(market._lineVotes || {}).forEach(([line, count]) => {
        if (count > maxVotes || (count === maxVotes && consensusLine !== null && Number(line) < Number(consensusLine))) {
          maxVotes = count;
          consensusLine = Number(line);
        }
      });
      market.line = consensusLine;
      market.bookList = Array.from(market.books).sort();
      market.bookList.forEach(book => {
        const overByLine = market._overByLine?.[book] || {};
        const underByLine = market._underByLine?.[book] || {};
        if (consensusLine != null && overByLine[consensusLine] != null) market.over[book] = overByLine[consensusLine];
        if (consensusLine != null && underByLine[consensusLine] != null) market.under[book] = underByLine[consensusLine];
      });
      market.insights = buildMarketInsights(market, propHistory);
      market.marketKey = marketKey;
    });
    return player;
  });
}

function buildGameBoard(games, gameLineHistory) {
  return games.map(game => {
    const sport = game.sport_key || 'unknown';
    const sportMeta = getSportMeta(sport);
    const score = calculateEdgeScore(game, gameLineHistory);
    const spreadFair = getConsensusFairOdds(game.bookmakers, 'spreads');
    const totalFair = getConsensusFairOdds(game.bookmakers, 'totals');
    const h2hFair = getConsensusFairOdds(game.bookmakers, 'h2h');

    const candidates = [];
    const firstBook = game.bookmakers?.[0];
    const firstSpreadOutcomes = firstBook?.markets?.find(m => m.key === 'spreads')?.outcomes || [];
    const firstTotalOutcomes = firstBook?.markets?.find(m => m.key === 'totals')?.outcomes || [];
    const firstMlOutcomes = firstBook?.markets?.find(m => m.key === 'h2h')?.outcomes || [];

    firstSpreadOutcomes.forEach(outcome => {
      const fair = spreadFair?.outcomes?.find(item => item.name === outcome.name);
      const best = findBestOdds(game.bookmakers, 'spreads', outcome.name);
      const ev = fair && best ? calculateEV(best.price, fair.fairProb) : null;
      if (best && ev != null) {
        candidates.push({
          type: 'spread',
          title: `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point}`,
          bestPrice: best.price,
          bestBook: best.book,
          ev,
          note: `Fair spread price ${formatGameOdds(fair.fairPrice)} · best at ${best.book}`,
        });
      }
    });

    firstTotalOutcomes.forEach(outcome => {
      const fair = totalFair?.outcomes?.find(item => item.name === outcome.name);
      const best = findBestOdds(game.bookmakers, 'totals', outcome.name);
      const ev = fair && best ? calculateEV(best.price, fair.fairProb) : null;
      if (best && ev != null) {
        candidates.push({
          type: 'total',
          title: `${outcome.name} ${outcome.point}`,
          bestPrice: best.price,
          bestBook: best.book,
          ev,
          note: `Fair total price ${formatGameOdds(fair.fairPrice)} · best at ${best.book}`,
        });
      }
    });

    firstMlOutcomes.forEach(outcome => {
      const fair = h2hFair?.outcomes?.find(item => item.name === outcome.name);
      const best = findBestOdds(game.bookmakers, 'h2h', outcome.name);
      const ev = fair && best ? calculateEV(best.price, fair.fairProb) : null;
      if (best && ev != null) {
        candidates.push({
          type: 'moneyline',
          title: `${outcome.name} ML`,
          bestPrice: best.price,
          bestBook: best.book,
          ev,
          note: `Fair ML ${formatGameOdds(fair.fairPrice)} · best at ${best.book}`,
        });
      }
    });

    const history = gameLineHistory?.[game.id] || [];
    const opener = history[0];
    const latest = history[history.length - 1];
    const spreadMove = opener?.spread != null && latest?.spread != null ? Number((latest.spread - opener.spread).toFixed(1)) : 0;
    const totalMove = opener?.total != null && latest?.total != null ? Number((latest.total - opener.total).toFixed(1)) : 0;
    const topCandidate = candidates.sort((a, b) => (b.ev || -999) - (a.ev || -999))[0] || null;

    return {
      game,
      sportMeta,
      edgeScore: score,
      topCandidate,
      spreadMove,
      totalMove,
      books: game.bookmakers?.length || 0,
    };
  });
}

export default function EdgeFinderHub({ games = [], playerProps = [], loading, propHistory = {}, propClosingLines = {}, gameLineHistory = {} }) {
  const liveGames = games.filter((game) => {
    const startTime = game?.commence_time ? new Date(game.commence_time).getTime() : null;
    return startTime && startTime <= Date.now() && !game.completed;
  }).length;

  const propPlayers = useMemo(() => buildPropBoard(playerProps, propHistory), [playerProps, propHistory]);
  const propOpportunities = useMemo(() => {
    const list = [];
    propPlayers.forEach(player => {
      Object.entries(player.markets || {}).forEach(([marketKey, market]) => {
        const result = scorePropCandidate({ marketKey, mkt: market, timing: { key: 'pregame', detail: player.commenceTime || 'scheduled' } });
        if (result.score < 24 || result.bestBook == null || result.bestPrice == null) return;
        const sideLabel = result.side === 'over' ? 'Over' : 'Under';
        const edgeValue = result.edgeValue != null ? Math.round(result.edgeValue) : 0;
        list.push({
          kind: 'prop',
          score: result.score,
          secondaryScore: edgeValue,
          emoji: player.sportMeta.icon,
          sport: player.sportMeta.label,
          title: `${player.name} ${getMarketDisplayName(marketKey)} ${sideLabel} ${market.line ?? '—'}`,
          subtitle: player.game,
          metricLabel: 'Signal',
          metricValue: `${result.score}`,
          edgeLine: `${getBookAbbreviation(result.bestBook)} ${formatOdds(result.bestPrice)} · ${edgeValue > 0 ? '+' : ''}${edgeValue} vs fair`,
          note: market.insights?.summary || 'Cross-book value detected in the prop market.',
          tags: [
            `${market.insights?.booksCount || 0} books`,
            market.insights?.lineRange ? `${market.insights.lineRange.toFixed(1)} pt spread` : 'tight market',
            ...(result.reasons || []),
          ].filter(Boolean).slice(0, 4),
        });
      });
    });
    return list.sort((a, b) => b.score - a.score || b.secondaryScore - a.secondaryScore).slice(0, 4);
  }, [propPlayers]);

  const gameBoard = useMemo(() => buildGameBoard(games, gameLineHistory), [games, gameLineHistory]);
  const gameOpportunities = useMemo(() => {
    return gameBoard
      .filter(item => item.topCandidate && (item.topCandidate.ev >= 1.5 || item.edgeScore >= 65 || Math.abs(item.spreadMove) >= 1 || Math.abs(item.totalMove) >= 2))
      .sort((a, b) => ((b.topCandidate?.ev || 0) + b.edgeScore / 20) - ((a.topCandidate?.ev || 0) + a.edgeScore / 20))
      .slice(0, 3)
      .map(item => ({
        kind: 'game',
        score: item.edgeScore,
        secondaryScore: item.topCandidate?.ev || 0,
        emoji: item.sportMeta.icon,
        sport: item.sportMeta.label,
        title: item.game.away_team + ' @ ' + item.game.home_team,
        subtitle: item.topCandidate?.type === 'moneyline' ? 'Moneyline board' : item.topCandidate?.type === 'total' ? 'Totals board' : 'Spread board',
        metricLabel: 'Edge score',
        metricValue: `${item.edgeScore}`,
        edgeLine: `${item.topCandidate?.title} · ${formatGameOdds(item.topCandidate?.bestPrice)} at ${item.topCandidate?.bestBook}`,
        note: item.topCandidate?.note || 'Market disagreement is creating a playable board.',
        tags: [
          item.topCandidate?.ev != null ? `${item.topCandidate.ev > 0 ? '+' : ''}${item.topCandidate.ev.toFixed(1)}% EV` : null,
          `${item.books} books`,
          Math.abs(item.spreadMove) >= 1 ? `${item.spreadMove > 0 ? '+' : ''}${item.spreadMove} spread move` : null,
          Math.abs(item.totalMove) >= 2 ? `${item.totalMove > 0 ? '+' : ''}${item.totalMove} total move` : null,
        ].filter(Boolean),
      }));
  }, [gameBoard]);

  const bestOpportunities = [...propOpportunities, ...gameOpportunities]
    .sort((a, b) => (b.kind === 'prop' ? b.score + b.secondaryScore : b.score + (b.secondaryScore || 0) * 4) - (a.kind === 'prop' ? a.score + a.secondaryScore : a.score + (a.secondaryScore || 0) * 4))
    .slice(0, 6);

  const bestOpportunityFallbacks = useMemo(() => {
    if (bestOpportunities.length > 0) return [];
    if (loading) {
      return [{
        title: 'Refreshing the board',
        text: 'EdgeFinder is pulling props, movement, and game prices now. Strong spots will auto-rank here as the next snapshot lands.',
        badge: 'Live refresh',
        accent: '#818cf8',
      }];
    }

    const hasAnyBoard = games.length > 0 || playerProps.length > 0;
    if (!hasAnyBoard) {
      return [
        {
          title: 'Waiting on market data',
          text: 'No games or props are loaded yet, so the board is in pre-open mode. As soon as books post numbers, this section will start ranking them automatically.',
          badge: 'Pre-open',
          accent: '#94a3b8',
        },
      ];
    }

    return [
      {
        title: 'Thin board right now',
        text: `We see ${games.length} game${games.length !== 1 ? 's' : ''} and ${playerProps.length} prop line${playerProps.length !== 1 ? 's' : ''}, but not enough edge, depth, or movement yet to call anything a best opportunity.`,
        badge: 'Monitor',
        accent: '#fbbf24',
      },
      {
        title: 'What unlocks this section',
        text: 'Best Opportunities fills when books disagree on price/line, enough shops hang a market, or a real move shows up in tracked snapshots.',
        badge: 'Thresholds',
        accent: '#06b6d4',
      },
    ];
  }, [bestOpportunities.length, loading, games.length, playerProps.length]);

  const dailyCard = useMemo(() => {
    const featuredGame = [...gameBoard]
      .filter(item => item.topCandidate)
      .sort((a, b) => ((b.topCandidate?.ev || 0) + b.edgeScore / 15) - ((a.topCandidate?.ev || 0) + a.edgeScore / 15))[0];
    const featuredProp = propOpportunities[0];
    const movementLeader = [...gameBoard].sort((a, b) => Math.max(Math.abs(b.spreadMove), Math.abs(b.totalMove)) - Math.max(Math.abs(a.spreadMove), Math.abs(a.totalMove)))[0];
    const closingChecks = Object.values(propClosingLines || {}).filter(item => item?.locked);

    const cardHeadline = featuredGame
      ? `${featuredGame.game.away_team} @ ${featuredGame.game.home_team}`
      : featuredProp?.title || 'Board building';

    return {
      headline: cardHeadline,
      summary: featuredGame
        ? `Top game board right now leans ${featuredGame.topCandidate?.title} at ${featuredGame.topCandidate?.bestBook} ${formatGameOdds(featuredGame.topCandidate?.bestPrice)} with an Edge Score of ${featuredGame.edgeScore}.`
        : featuredProp
          ? `Best prop signal on the board is ${featuredProp.title} with a ${featuredProp.metricValue} score.`
          : 'Waiting on more books and live line history to mature the card.',
      sections: [
        featuredGame ? {
          title: 'Featured game angle',
          badge: `${featuredGame.edgeScore} edge`,
          text: `${featuredGame.topCandidate?.title} is the cleanest game-side setup. ${featuredGame.topCandidate?.note}${Math.abs(featuredGame.spreadMove) >= 1 ? ` Spread has moved ${featuredGame.spreadMove > 0 ? '+' : ''}${featuredGame.spreadMove} since first capture.` : ''}`,
        } : null,
        featuredProp ? {
          title: 'Best prop on the board',
          badge: `${featuredProp.metricValue} signal`,
          text: `${featuredProp.edgeLine}. ${featuredProp.note}`,
        } : null,
        movementLeader ? {
          title: 'Market pressure point',
          badge: `${Math.max(Math.abs(movementLeader.spreadMove), Math.abs(movementLeader.totalMove)).toFixed(1)} move`,
          text: `${movementLeader.game.away_team} @ ${movementLeader.game.home_team} is moving the most right now.${Math.abs(movementLeader.spreadMove) >= 1 ? ` Spread: ${movementLeader.spreadMove > 0 ? '+' : ''}${movementLeader.spreadMove}.` : ''}${Math.abs(movementLeader.totalMove) >= 2 ? ` Total: ${movementLeader.totalMove > 0 ? '+' : ''}${movementLeader.totalMove}.` : ''}`,
        } : null,
        closingChecks.length ? {
          title: 'Tracked closing-line sample',
          badge: `${closingChecks.length} tracked`,
          text: `The app has already banked ${closingChecks.length} locally tracked closing-line snapshots for props, so the feed can surface CLV checks instead of fake editorial notes.`,
        } : null,
      ].filter(Boolean).slice(0, 4),
    };
  }, [gameBoard, propOpportunities, propClosingLines]);

  const snapshotStats = useMemo(() => {
    const gameSignals = gameBoard.filter(item => item.topCandidate?.ev >= 1.5).length;
    const majorMoves = gameBoard.filter(item => Math.abs(item.spreadMove) >= 1 || Math.abs(item.totalMove) >= 2).length;
    return {
      gamesOnBoard: games.length,
      liveGames,
      propsTracked: playerProps.length,
      rankedSignals: propOpportunities.length + gameSignals,
      movementFlags: majorMoves,
    };
  }, [gameBoard, games.length, liveGames, playerProps.length, propOpportunities.length]);

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <SectionShell icon={Star} title="Best Opportunities" eyebrow="A · Priority Board">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <MetricCard label="Ranked now" value={bestOpportunities.length} note={loading ? 'Refreshing live board…' : 'Auto-ranked from prop value, game EV, market depth, and movement.'} accent="#22c55e" />
          <MetricCard label="Prop signals" value={propOpportunities.length} note="Built from fair-value edge, line disagreement, timing, and book count." accent="#fbbf24" />
          <MetricCard label="Game spots" value={gameOpportunities.length} note="Board only promotes games with a real EV read, strong score, or meaningful movement." accent="#818cf8" />
        </div>

        {bestOpportunities.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {bestOpportunities.map((item, index) => <OpportunityCard key={`${item.kind}-${item.title}-${index}`} item={item} index={index} />)}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {bestOpportunityFallbacks.map((item) => <BoardFallbackCard key={item.title} {...item} />)}
          </div>
        )}
      </SectionShell>

      <SectionShell icon={LayoutDashboard} title="Daily Snapshot" eyebrow="B · Daily Setup">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <MetricCard label="Games on board" value={snapshotStats.gamesOnBoard} accent="#f8fafc" />
          <MetricCard label="Live now" value={snapshotStats.liveGames} accent="#f97316" />
          <MetricCard label="Props tracked" value={snapshotStats.propsTracked} accent="#22c55e" />
          <MetricCard label="Ranked signals" value={snapshotStats.rankedSignals} accent="#818cf8" />
          <MetricCard label="Movement flags" value={snapshotStats.movementFlags} accent="#06b6d4" />
        </div>

        <div style={{ padding: '16px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(14,165,233,0.07))', border: '1px solid rgba(99,102,241,0.24)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <ShieldCheck size={16} color="#c4b5fd" />
            <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c4b5fd', fontWeight: 800 }}>Today&apos;s operating note</div>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#f8fafc', marginBottom: '6px' }}>{dailyCard.headline}</div>
          <div style={{ fontSize: '12px', color: '#cbd5e1', lineHeight: 1.65 }}>{dailyCard.summary}</div>
        </div>
      </SectionShell>

      <SectionShell icon={FileText} title="Featured Card / Daily Card" eyebrow="C · Actionable Card">
        {dailyCard.sections.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {dailyCard.sections.map((item) => <DailyCardItem key={item.title} item={item} accent="#fbbf24" />)}
          </div>
        ) : (
          <div style={{ padding: '14px 16px', borderRadius: '12px', background: 'rgba(30,41,59,0.55)', border: '1px solid rgba(71,85,105,0.2)', color: '#94a3b8', fontSize: '12px' }}>
            Daily card will populate as soon as live books and tracked movement create a clean feature angle.
          </div>
        )}
      </SectionShell>

      <SectionShell icon={Zap} title="Signal Feed" eyebrow="D · Live Edges">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <MetricCard label="Value triggers" value={propOpportunities.length} note="Top prop signals feeding the alert stream." accent="#fbbf24" />
          <MetricCard label="CLV checks" value={Object.values(propClosingLines || {}).filter(item => item?.locked).length} note="Locally tracked first-vs-close snapshots add real post-lock context." accent="#22c55e" />
          <MetricCard label="Feed posture" value={loading ? 'Updating' : 'Live'} note="Embedded feed stays tied to the same prop board and edge API, not a fake side channel." accent="#818cf8" />
        </div>
        <EdgeAlerts playerProps={playerProps} propHistory={propHistory} propClosingLines={propClosingLines} embedded />
      </SectionShell>

      <SectionShell icon={Activity} title="Market Movement / Live Intel" eyebrow="E · Movement Watch">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(30,41,59,0.55)', border: '1px solid rgba(71,85,105,0.24)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><TrendingUp size={14} color="#06b6d4" /><span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>What it watches</span></div>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6 }}>Spread moves of 1+ point, totals of 2+, and moneyline shifts of 15+ cents, all captured against locally stored snapshots.</div>
          </div>
          <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(30,41,59,0.55)', border: '1px solid rgba(71,85,105,0.24)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}><Clock3 size={14} color="#fbbf24" /><span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 700 }}>How to use it</span></div>
            <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.6 }}>Use the board above for ranking, then use this movement feed to decide whether to fire now or wait for a better number back.</div>
          </div>
        </div>
        <LineMovement embedded />
      </SectionShell>
    </div>
  );
}
