import { americanToImplied, impliedToAmerican, formatOdds as formatAmericanOdds } from './odds-math.js';

export const BOOK_ABBREVIATIONS = {
  FanDuel: 'FD', DraftKings: 'DK', BetMGM: 'MGM', Caesars: 'Csr',
  BetRivers: 'BR', PointsBet: 'PB', Bet365: 'B365', WynnBET: 'Wynn',
  Unibet: 'Uni', Barstool: 'BAR', 'ESPN BET': 'ESPN', Fanatics: 'Fan',
  BetOnline: 'BOL', Bovada: 'BVD', HardRockBet: 'HRB'
};

export const MARKET_DISPLAY_NAMES = {
  player_points: 'PTS',
  player_rebounds: 'REB',
  player_assists: 'AST',
  player_threes: '3PM',
  player_steals: 'STL',
  player_blocks: 'BLK',
  player_turnovers: 'TO',
  player_points_rebounds_assists: 'PRA',
  player_points_rebounds: 'PR',
  player_points_assists: 'PA',
  player_rebounds_assists: 'RA',
  player_double_double: 'DBL-DBL',
  player_triple_double: 'TRP-DBL',
  player_pass_yds: 'PASS YDS',
  player_pass_tds: 'PASS TD',
  player_pass_completions: 'COMP',
  player_pass_attempts: 'ATT',
  player_pass_interceptions: 'INT',
  player_pass_longest_completion: 'LONGEST COMP',
  player_rush_yds: 'RUSH YDS',
  player_rush_attempts: 'RUSH ATT',
  player_rush_longest: 'LONGEST RUSH',
  player_rush_tds: 'RUSH TD',
  player_receptions: 'REC',
  player_reception_yds: 'REC YDS',
  player_reception_longest: 'LONGEST REC',
  player_reception_tds: 'REC TD',
  player_anytime_td: 'ANYTIME TD',
  player_1st_td: '1ST TD',
  player_last_td: 'LAST TD',
  player_tds_over: 'TD',
  player_sacks: 'SACKS',
  player_solo_tackles: 'SOLO TKL',
  player_tackles_assists: 'TKL+AST',
  player_shots_on_goal: 'SOG',
  player_blocked_shots: 'BLK SHOTS',
  player_goals: 'GOALS',
  player_power_play_points: 'PP PTS',
  player_saves: 'SAVES',
  batter_hits: 'HITS',
  batter_total_bases: 'TB',
  batter_rbis: 'RBI',
  batter_runs_scored: 'RUNS',
  batter_home_runs: 'HR',
  batter_hits_runs_rbis: 'H+R+RBI',
  batter_singles: '1B',
  batter_doubles: '2B',
  batter_triples: '3B',
  batter_walks: 'WALKS',
  batter_strikeouts: 'K',
  pitcher_strikeouts: 'PITCHER K',
  pitcher_hits_allowed: 'H ALLOWED',
  pitcher_walks: 'BB ALLOWED',
  pitcher_outs: 'OUTS',
  pitcher_earned_runs: 'ER',
  pitcher_record_a_win: 'PITCHER WIN',
};

export const SPORT_META = {
  basketball_nba: { label: 'NBA', icon: '🏀', family: 'basketball', espnPath: 'basketball/nba', logoSport: 'nba' },
  basketball_ncaab: { label: 'NCAAB', icon: '🏀', family: 'basketball', espnPath: 'basketball/mens-college-basketball', logoSport: 'ncb' },
  basketball_wncaab: { label: 'WNCAAB', icon: '🏀', family: 'basketball', espnPath: 'basketball/womens-college-basketball', logoSport: 'ncb' },
  americanfootball_nfl: { label: 'NFL', icon: '🏈', family: 'football', espnPath: 'football/nfl', logoSport: 'nfl' },
  americanfootball_ncaaf: { label: 'NCAAF', icon: '🏈', family: 'football', espnPath: 'football/college-football', logoSport: 'ncf' },
  icehockey_nhl: { label: 'NHL', icon: '🏒', family: 'hockey', espnPath: 'hockey/nhl', logoSport: 'nhl' },
  baseball_mlb: { label: 'MLB', icon: '⚾', family: 'baseball', espnPath: 'baseball/mlb', logoSport: 'mlb' },
  soccer_epl: { label: 'EPL', icon: '⚽', family: 'soccer', espnPath: 'soccer/eng.1', logoSport: 'soccer' },
};

export const SPORT_SORT_ORDER = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl', 'baseball_mlb', 'basketball_ncaab', 'americanfootball_ncaaf', 'basketball_wncaab', 'soccer_epl'];

export function getSportMeta(sport) {
  return SPORT_META[sport] || { label: sport?.split('_').slice(-1)[0]?.toUpperCase() || 'Other', icon: '🎯', family: 'other' };
}

export function getBookAbbreviation(book) { return BOOK_ABBREVIATIONS[book] || book?.slice(0, 4) || '?'; }
export function getMarketDisplayName(market) { return MARKET_DISPLAY_NAMES[market] || market?.replace(/^(player_|batter_|pitcher_)/, '').replaceAll('_', ' ').toUpperCase() || market; }
export function formatOdds(price) { return formatAmericanOdds(price).replace('-', '−'); }

export function normalizeMarketFilterLabel(market) {
  const display = getMarketDisplayName(market);
  return display.length <= 14 ? display : display.replaceAll(' ', '\n');
}

export function buildTeamVisuals(game, sport, logoMap = {}) {
  const [awayRaw, homeRaw] = String(game || '').split(' @ ');
  const away = awayRaw?.trim();
  const home = homeRaw?.trim();
  const sportMap = logoMap[sport] || {};
  return {
    away: away ? { name: away, logo: sportMap[normalizeTeamKey(away)] || null, initials: getInitials(away) } : null,
    home: home ? { name: home, logo: sportMap[normalizeTeamKey(home)] || null, initials: getInitials(home) } : null,
  };
}

export function getPropTimingState({ gameStatus, commenceTime }) {
  const started = gameStatus?.started ?? (commenceTime ? Date.parse(commenceTime) <= Date.now() : false);
  const completed = gameStatus?.completed ?? false;
  const live = gameStatus?.live ?? (started && !completed);
  const resolvedCommenceTime = gameStatus?.commenceTime || commenceTime || null;

  if (completed) {
    return {
      key: 'final',
      label: 'FINAL',
      detail: 'Props closed',
      color: '#94a3b8',
      background: 'rgba(100,116,139,0.14)',
      border: 'rgba(148,163,184,0.28)',
    };
  }

  if (live) {
    return {
      key: 'live',
      label: 'LIVE',
      detail: 'In progress',
      color: '#f43f5e',
      background: 'rgba(244,63,94,0.14)',
      border: 'rgba(244,63,94,0.32)',
    };
  }

  if (resolvedCommenceTime) {
    const startsAt = new Date(resolvedCommenceTime);
    const diffMs = startsAt.getTime() - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    const absMinutes = Math.abs(diffMinutes);

    let detail = startsAt.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

    if (diffMinutes >= 0 && diffMinutes <= 59) detail = `Starts in ${Math.max(1, diffMinutes)}m`;
    else if (diffMinutes >= 60 && diffMinutes <= 6 * 60) detail = `Starts in ${Math.round(diffMinutes / 60)}h`;
    else if (diffMinutes < 0 && absMinutes <= 15) detail = 'Starting now';

    return {
      key: 'pregame',
      label: 'PRE',
      detail,
      color: '#22c55e',
      background: 'rgba(34,197,94,0.12)',
      border: 'rgba(34,197,94,0.28)',
    };
  }

  return {
    key: 'unknown',
    label: 'SCHEDULED',
    detail: 'Start time pending',
    color: '#94a3b8',
    background: 'rgba(100,116,139,0.14)',
    border: 'rgba(148,163,184,0.28)',
  };
}

export function normalizeTeamKey(name) {
  return String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getInitials(name) {
  const words = String(name || '').split(/\s+/).filter(Boolean);
  return words.slice(-2).map(word => word[0]).join('').toUpperCase() || '—';
}

export function getPlayerInitials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'PP';
}

export function createPropHistoryKey(prop) {
  return [prop.sport, prop.gameId, prop.player, prop.market, prop.outcome, prop.book || prop.bookTitle || prop.bookKey].join('::');
}

export function createPropMarketKey(prop) {
  return [prop.sport, prop.gameId, prop.player, prop.market].join('::');
}

export function summarizeHistory(entries = []) {
  if (!entries.length) return null;
  const first = entries[0];
  const last = entries[entries.length - 1];
  return {
    priceChange: (last?.price != null && first?.price != null) ? last.price - first.price : null,
    lineChange: (last?.line != null && first?.line != null) ? Number((last.line - first.line).toFixed(2)) : null,
    startLine: first?.line ?? null,
    currentLine: last?.line ?? null,
    observations: entries.length,
    updatedAt: last?.capturedAt ?? null,
  };
}

export function buildMarketInsights(mkt, propHistory = {}) {
  const overBooks = Object.keys(mkt.over || {}).filter(book => mkt.over[book] != null);
  const underBooks = Object.keys(mkt.under || {}).filter(book => mkt.under[book] != null);
  const books = Array.from(new Set([...(mkt.bookList || []), ...overBooks, ...underBooks]));
  const overPrices = overBooks.map(book => mkt.over[book]);
  const underPrices = underBooks.map(book => mkt.under[book]);
  const bestOver = overPrices.length ? Math.max(...overPrices) : null;
  const bestUnder = underPrices.length ? Math.max(...underPrices) : null;
  const bestOverBook = overBooks.find(book => mkt.over[book] === bestOver) || null;
  const bestUnderBook = underBooks.find(book => mkt.under[book] === bestUnder) || null;

  let fairOverProbSum = 0;
  let fairUnderProbSum = 0;
  let fairCount = 0;

  books.forEach(book => {
    const over = mkt.over?.[book];
    const under = mkt.under?.[book];
    if (over == null || under == null) return;
    const overImplied = americanToImplied(over);
    const underImplied = americanToImplied(under);
    if (!overImplied || !underImplied) return;
    const total = overImplied + underImplied;
    fairOverProbSum += overImplied / total;
    fairUnderProbSum += underImplied / total;
    fairCount += 1;
  });

  const fairOverProb = fairCount ? fairOverProbSum / fairCount : null;
  const fairUnderProb = fairCount ? fairUnderProbSum / fairCount : null;
  const fairOverPrice = fairOverProb ? impliedToAmerican(fairOverProb) : null;
  const fairUnderPrice = fairUnderProb ? impliedToAmerican(fairUnderProb) : null;
  const edgeOver = bestOver != null && fairOverPrice != null ? bestOver - fairOverPrice : null;
  const edgeUnder = bestUnder != null && fairUnderPrice != null ? bestUnder - fairUnderPrice : null;

  const allLineEntries = [];
  Object.entries(mkt._overByLine || {}).forEach(([book, lines]) => {
    Object.keys(lines || {}).forEach(line => allLineEntries.push(Number(line)));
  });
  Object.entries(mkt._underByLine || {}).forEach(([book, lines]) => {
    Object.keys(lines || {}).forEach(line => allLineEntries.push(Number(line)));
  });
  const minLine = allLineEntries.length ? Math.min(...allLineEntries) : mkt.line;
  const maxLine = allLineEntries.length ? Math.max(...allLineEntries) : mkt.line;
  const lineRange = minLine != null && maxLine != null ? Number((maxLine - minLine).toFixed(2)) : null;

  const historySummaries = books.flatMap(book => {
    const overKey = mkt.historyKeys?.over?.[book];
    const underKey = mkt.historyKeys?.under?.[book];
    return [
      overKey ? { side: 'over', book, ...summarizeHistory(propHistory[overKey]) } : null,
      underKey ? { side: 'under', book, ...summarizeHistory(propHistory[underKey]) } : null,
    ].filter(Boolean);
  });

  const lineMoves = historySummaries.filter(item => item.lineChange != null && item.lineChange !== 0);
  const strongestMove = lineMoves.sort((a, b) => Math.abs(b.lineChange) - Math.abs(a.lineChange))[0] || null;
  const priceMoves = historySummaries.filter(item => item.priceChange != null && item.priceChange !== 0);
  const strongestPriceMove = priceMoves.sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange))[0] || null;

  const summaries = [];
  if (lineRange != null && lineRange > 0 && mkt.line != null) {
    summaries.push(`Best number is ${minLine} to ${maxLine} around a ${mkt.line} consensus.`);
  }
  if (strongestMove) {
    const direction = strongestMove.lineChange > 0 ? 'up' : 'down';
    summaries.push(`${getBookAbbreviation(strongestMove.book)} moved ${direction} ${Math.abs(strongestMove.lineChange)} on the ${strongestMove.side}.`);
  }
  if (edgeOver != null || edgeUnder != null) {
    const side = (edgeOver ?? -Infinity) >= (edgeUnder ?? -Infinity) ? 'over' : 'under';
    const edge = side === 'over' ? edgeOver : edgeUnder;
    const book = side === 'over' ? bestOverBook : bestUnderBook;
    if (edge != null && book) summaries.push(`${getBookAbbreviation(book)} shows the best ${side} price at ${formatOdds(side === 'over' ? bestOver : bestUnder)} (${edge > 0 ? '+' : ''}${Math.round(edge)} vs fair).`);
  }

  const recommendationScore = Math.max(edgeOver ?? -999, edgeUnder ?? -999);
  let recommendation = 'Pass';
  if (recommendationScore >= 15 || (lineRange != null && lineRange >= 1)) recommendation = 'Playable';
  else if (recommendationScore >= 7 || strongestMove) recommendation = 'Monitor';

  return {
    booksCount: books.length,
    bestOver,
    bestUnder,
    bestOverBook,
    bestUnderBook,
    fairOverPrice,
    fairUnderPrice,
    edgeOver,
    edgeUnder,
    lineRange,
    strongestMove,
    strongestPriceMove,
    recommendation,
    summary: summaries[0] || 'Hold for a better read as books fill in.',
    details: summaries.slice(1),
    sortEdge: Math.max(edgeOver || Number.NEGATIVE_INFINITY, edgeUnder || Number.NEGATIVE_INFINITY),
    sortBooks: books.length,
    sortMovement: Math.max(Math.abs(strongestMove?.lineChange || 0), Math.abs(strongestPriceMove?.priceChange || 0) / 100),
  };
}

// ============================================================
// Composite prop scoring — powers "Best Props Right Now"
// Returns a 0-100 score plus the recommended side, best book/price,
// and a short list of human-readable reason strings.
// ============================================================
export function scorePropCandidate({ marketKey, mkt, timing }) {
  const insights = mkt?.insights;
  if (!insights || insights.booksCount < 2) {
    return { score: 0, side: null, edgeValue: null, bestPrice: null, bestBook: null, reasons: [] };
  }

  const edgeOver = insights.edgeOver;
  const edgeUnder = insights.edgeUnder;

  // Pick the better-value side
  const side = (edgeOver ?? Number.NEGATIVE_INFINITY) >= (edgeUnder ?? Number.NEGATIVE_INFINITY)
    ? 'over' : 'under';
  const edgeValue = side === 'over' ? edgeOver : edgeUnder;
  const bestPrice = side === 'over' ? insights.bestOver : insights.bestUnder;
  const bestBook = side === 'over' ? insights.bestOverBook : insights.bestUnderBook;

  let score = 0;
  const reasons = [];

  // 1. Price edge vs fair value — primary signal (0-40 pts, capped)
  if (edgeValue != null && edgeValue > 0) {
    const edgePts = Math.min(40, Math.round(edgeValue * 2));
    score += edgePts;
    if (edgeValue >= 10) reasons.push(`+${Math.round(edgeValue)} vs fair line`);
    else if (edgeValue >= 5) reasons.push(`+${Math.round(edgeValue)} above fair`);
  }

  // 2. Book depth — more books = more reliable fair model (0-20 pts)
  const booksCount = insights.booksCount ?? 0;
  const depthPts = Math.min(20, Math.round((Math.max(0, booksCount - 1) / 5) * 20));
  score += depthPts;
  if (booksCount >= 5) reasons.push(`${booksCount} books pricing market`);

  // 3. Line disagreement — books diverge on the number (0-15 pts)
  const lineRange = insights.lineRange;
  if (lineRange != null && lineRange > 0) {
    if (lineRange >= 1) { score += 15; reasons.push(`${lineRange.toFixed(1)}-pt line spread`); }
    else if (lineRange >= 0.5) { score += 9; reasons.push(`${lineRange.toFixed(1)}-pt disagreement`); }
    else { score += 4; }
  }

  // 4. Movement signal — observed line changes (0-15 pts)
  const move = insights.strongestMove;
  if (move?.lineChange != null) {
    const absMove = Math.abs(move.lineChange);
    if (absMove >= 1) {
      score += 15;
      reasons.push(`${move.lineChange > 0 ? '+' : ''}${move.lineChange} move at ${getBookAbbreviation(move.book)}`);
    } else if (absMove >= 0.5) {
      score += 8;
      reasons.push(`${move.lineChange > 0 ? '+' : ''}${move.lineChange} move`);
    }
  }

  // 5. Timing relevance — live & pre-game games are actionable (0-10 pts)
  if (timing?.key === 'live') score += 10;
  else if (timing?.key === 'pregame') score += 5;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    side,
    edgeValue,
    bestPrice,
    bestBook,
    reasons: reasons.slice(0, 3),
  };
}

export function buildPropAlerts(players = [], propHistory = {}, propClosingLines = {}) {
  const alerts = [];

  players.forEach(player => {
    Object.entries(player.markets || {}).forEach(([marketKey, mkt]) => {
      const insights = mkt.insights;
      if (!insights) return;

      const edgeSide = (insights.edgeOver ?? -Infinity) >= (insights.edgeUnder ?? -Infinity) ? 'Over' : 'Under';
      const edgeValue = edgeSide === 'Over' ? insights.edgeOver : insights.edgeUnder;
      const edgeBook = edgeSide === 'Over' ? insights.bestOverBook : insights.bestUnderBook;
      const edgePrice = edgeSide === 'Over' ? insights.bestOver : insights.bestUnder;
      const movement = insights.strongestMove;
      const priceMove = insights.strongestPriceMove;
      const marketKeyId = `${player.sport}::${player.game}::${player.name}::${marketKey}`;
      const closingEntries = Object.entries(propClosingLines).filter(([key]) => key.startsWith(`${player.sport}::`) && key.includes(`::${player.name}::${marketKey}::`));
      const validatedClosers = closingEntries.filter(([, item]) => item?.closingLine != null || item?.closingPrice != null);

      if (edgeBook && edgePrice != null && edgeValue != null && edgeValue >= 10 && insights.booksCount >= 3) {
        alerts.push({
          id: `${marketKeyId}::value::${edgeBook}`,
          type: 'value',
          sport: player.sportMeta?.label || player.sport,
          emoji: player.sportMeta?.icon || '🎯',
          player: player.name,
          game: player.game,
          market: getMarketDisplayName(marketKey),
          title: `${player.name} ${marketKey ? getMarketDisplayName(marketKey) : 'Prop'} ${edgeSide} ${mkt.line ?? '—'}`,
          edge: `${edgeSide} ${mkt.line ?? '—'} at ${getBookAbbreviation(edgeBook)} ${formatOdds(edgePrice)}`,
          book: edgeBook,
          confidence: edgeValue >= 18 ? 'HIGH' : edgeValue >= 12 ? 'MEDIUM' : 'LOW',
          note: insights.summary,
          metric: edgeValue,
          metricDisplay: `${edgeValue > 0 ? '+' : ''}${Math.round(edgeValue)} fair`,
        });
      }

      if (movement && Math.abs(movement.lineChange || 0) >= 0.5) {
        alerts.push({
          id: `${marketKeyId}::move::${movement.book}::${movement.side}`,
          type: 'movement',
          sport: player.sportMeta?.label || player.sport,
          emoji: player.sportMeta?.icon || '🎯',
          player: player.name,
          game: player.game,
          market: getMarketDisplayName(marketKey),
          title: `${player.name} ${getMarketDisplayName(marketKey)} ${movement.side === 'over' ? 'Over' : 'Under'} ${mkt.line ?? '—'}`,
          edge: `${getBookAbbreviation(movement.book)} moved ${movement.lineChange > 0 ? '+' : ''}${movement.lineChange} on the ${movement.side}`,
          book: movement.book,
          confidence: Math.abs(movement.lineChange) >= 1 ? 'HIGH' : 'MEDIUM',
          note: priceMove ? `Price also moved ${priceMove.priceChange > 0 ? '+' : ''}${priceMove.priceChange}.` : insights.summary,
          metric: Math.abs(movement.lineChange),
          metricDisplay: `${movement.lineChange > 0 ? '+' : ''}${movement.lineChange}`,
        });
      }

      if (validatedClosers.length > 0) {
        const latestClose = validatedClosers.sort((a, b) => new Date(b[1]?.capturedAt || 0) - new Date(a[1]?.capturedAt || 0))[0]?.[1];
        if (latestClose?.closingLine != null && latestClose?.firstLine != null) {
          const clv = Number((latestClose.closingLine - latestClose.firstLine).toFixed(2));
          if (Math.abs(clv) >= 0.5) {
            alerts.push({
              id: `${marketKeyId}::close::${latestClose.book || 'close'}`,
              type: 'closing',
              sport: player.sportMeta?.label || player.sport,
              emoji: player.sportMeta?.icon || '🎯',
              player: player.name,
              game: player.game,
              market: getMarketDisplayName(marketKey),
              title: `${player.name} ${getMarketDisplayName(marketKey)} closing-line check`,
              edge: `${latestClose.side} ${latestClose.firstLine} → ${latestClose.closingLine}`,
              book: latestClose.book || 'Local',
              confidence: Math.abs(clv) >= 1 ? 'HIGH' : 'LOW',
              note: 'Tracked locally from the first observed line to the last pregame snapshot.',
              metric: Math.abs(clv),
              metricDisplay: `${clv > 0 ? '+' : ''}${clv} pts`,
            });
          }
        }
      }
    });
  });

  return alerts.sort((a, b) => (b.metric || 0) - (a.metric || 0)).slice(0, 20);
}
