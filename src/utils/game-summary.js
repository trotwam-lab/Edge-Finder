function getSportFamily(sportKey = '') {
  const normalized = String(sportKey).toLowerCase();

  if (normalized.includes('basketball_nba') || normalized.includes('basketball_wnba')) return 'nba';
  if (normalized.includes('basketball_ncaab')) return 'cbb';
  if (normalized.includes('americanfootball_ncaaf')) return 'cfootball';
  if (normalized.includes('americanfootball_nfl') || normalized.includes('americanfootball_cfl') || normalized.includes('americanfootball_')) return 'football';
  if (normalized.includes('baseball_mlb') || normalized.includes('baseball_')) return 'baseball';
  if (normalized.includes('icehockey_nhl') || normalized.includes('icehockey_')) return 'hockey';
  if (normalized.includes('soccer_')) return 'soccer';
  if (normalized.includes('mma_')) return 'mma';
  return 'generic';
}

function formatSigned(value) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value}`;
}

function toReadableSourceTag(source) {
  const labels = {
    line_history: 'line history',
    current_market: 'current market',
    fair_odds: 'fair odds',
    injuries: 'injuries',
    market_disagreement: 'market disagreement',
    sport_context: 'sport context',
    derived_logic: 'derived logic',
  };
  return labels[source] || source.replace(/_/g, ' ');
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) list.push(value);
}

function buildSnapshot({ currentSpread, currentTotal, bestSpread, bestTotal, bestMoneyline }) {
  const parts = [];
  if (currentSpread != null) parts.push(`Spread ${formatSigned(currentSpread)}`);
  if (currentTotal != null) parts.push(`Total ${currentTotal}`);
  if (bestMoneyline?.price != null) parts.push(`Best ML ${bestMoneyline.name} ${formatSigned(bestMoneyline.price)}`);
  else if (bestSpread?.price != null) parts.push(`Best spread price ${formatSigned(bestSpread.price)}`);
  else if (bestTotal?.price != null) parts.push(`Best total price ${formatSigned(bestTotal.price)}`);
  return parts.join(' · ');
}

function getInjurySeverity(status = '') {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('out')) return 3;
  if (normalized.includes('doubt')) return 2.5;
  if (normalized.includes('question')) return 2;
  if (normalized.includes('probable')) return 1;
  return normalized ? 0.5 : 0;
}

function countImpactInjuries(allInjuries = []) {
  return allInjuries.filter(inj => getInjurySeverity(inj?.status) >= 2).length;
}

function getInjurySeverityScore(allInjuries = []) {
  return allInjuries.reduce((sum, inj) => sum + getInjurySeverity(inj?.status), 0);
}

function isKeyFootballNumber(value) {
  if (value == null || Number.isNaN(value)) return false;
  return [3, 7, 10, 14].includes(Math.abs(value));
}

function hasPositiveEV(candidate) {
  return Boolean(candidate?.isPositiveEV);
}

function getSportThresholds(sportFamily) {
  switch (sportFamily) {
    case 'nba':
      return { meaningfulSpreadMove: 1, meaningfulTotalMove: 2, thinSpreadMove: 0.5, thinTotalMove: 1 };
    case 'cbb':
      return { meaningfulSpreadMove: 1.5, meaningfulTotalMove: 2.5, thinSpreadMove: 0.5, thinTotalMove: 1.5 };
    case 'football':
    case 'cfootball':
      return { meaningfulSpreadMove: 1, meaningfulTotalMove: 1.5, thinSpreadMove: 0.5, thinTotalMove: 1 };
    case 'baseball':
      return { meaningfulSpreadMove: 0.5, meaningfulTotalMove: 1, thinSpreadMove: 0.5, thinTotalMove: 0.5 };
    case 'hockey':
      return { meaningfulSpreadMove: 0.5, meaningfulTotalMove: 0.5, thinSpreadMove: 0.5, thinTotalMove: 0.5 };
    case 'soccer':
      return { meaningfulSpreadMove: 0.25, meaningfulTotalMove: 0.25, thinSpreadMove: 0.25, thinTotalMove: 0.25 };
    default:
      return { meaningfulSpreadMove: 1, meaningfulTotalMove: 1.5, thinSpreadMove: 0.5, thinTotalMove: 1 };
  }
}

function pickBestCandidate(candidates = []) {
  const filtered = candidates.filter(Boolean);
  if (!filtered.length) return null;
  return filtered.sort((a, b) => {
    const aScore = (a.isPositiveEV ? 100 : 0) + Math.abs(a.price || 0) / 100;
    const bScore = (b.isPositiveEV ? 100 : 0) + Math.abs(b.price || 0) / 100;
    return bScore - aScore;
  })[0];
}

function buildReasoningSignals({ spreadMoveAbs, totalMoveAbs, allInjuries, bestSpread, bestTotal, bestMoneyline, disagreementScore, sportFamily, currentSpread }) {
  const thresholds = getSportThresholds(sportFamily);
  const impactInjuries = countImpactInjuries(allInjuries);
  const injurySeverityScore = getInjurySeverityScore(allInjuries);
  const heavyInjuryFog = injurySeverityScore >= (sportFamily === 'nba' ? 4 : 5);
  const keyNumberSpot = (sportFamily === 'football' || sportFamily === 'cfootball') && isKeyFootballNumber(currentSpread);
  const pricingSignal = [bestSpread, bestTotal, bestMoneyline].some(hasPositiveEV);
  const disagreementSignal = disagreementScore >= 2;
  const meaningfulMove = spreadMoveAbs >= thresholds.meaningfulSpreadMove || totalMoveAbs >= thresholds.meaningfulTotalMove;
  const thinMove = spreadMoveAbs >= thresholds.thinSpreadMove || totalMoveAbs >= thresholds.thinTotalMove;

  const flags = [];
  const sourceTags = [];

  if (spreadMoveAbs > 0 || totalMoveAbs > 0) {
    pushUnique(sourceTags, 'line_history');
    pushUnique(sourceTags, 'derived_logic');
  }
  if (pricingSignal) {
    pushUnique(flags, 'positive_ev_present');
    pushUnique(sourceTags, 'fair_odds');
    pushUnique(sourceTags, 'current_market');
  }
  if (meaningfulMove) pushUnique(flags, 'meaningful_market_move');
  else if (thinMove) pushUnique(flags, 'modest_market_move');
  if (disagreementSignal) {
    pushUnique(flags, 'books_disagree');
    pushUnique(sourceTags, 'market_disagreement');
    pushUnique(sourceTags, 'current_market');
  }
  if (impactInjuries > 0) {
    pushUnique(flags, 'impact_injuries_present');
    pushUnique(sourceTags, 'injuries');
  } else if (allInjuries.length > 0) {
    pushUnique(flags, 'injury_noise_present');
    pushUnique(sourceTags, 'injuries');
  }
  if (heavyInjuryFog) pushUnique(flags, 'injury_uncertainty_high');
  if (keyNumberSpot) pushUnique(flags, 'key_number_spread');
  if (sportFamily === 'cbb' && spreadMoveAbs >= 1.5) pushUnique(flags, 'high_variance_college_context');
  if (sportFamily === 'baseball' && hasPositiveEV(bestMoneyline)) pushUnique(flags, 'price_market_preferred');
  if (sportFamily === 'soccer' && totalMoveAbs >= 0.25) pushUnique(flags, 'low_scoring_total_sensitivity');
  if (sportFamily !== 'generic') pushUnique(sourceTags, 'sport_context');

  return {
    thresholds,
    impactInjuries,
    injurySeverityScore,
    heavyInjuryFog,
    keyNumberSpot,
    pricingSignal,
    disagreementSignal,
    meaningfulMove,
    thinMove,
    flags,
    sourceTags,
  };
}

function inferReadLabel(signals) {
  const {
    pricingSignal,
    meaningfulMove,
    heavyInjuryFog,
    keyNumberSpot,
    disagreementSignal,
    sportFamily,
    spreadMoveAbs,
    totalMoveAbs,
  } = signals;

  if (pricingSignal && meaningfulMove && !heavyInjuryFog && !keyNumberSpot) return 'Playable';
  if ((pricingSignal && heavyInjuryFog) || (meaningfulMove && heavyInjuryFog)) return 'Monitor';
  if ((sportFamily === 'football' || sportFamily === 'cfootball') && keyNumberSpot && (pricingSignal || meaningfulMove)) return 'Monitor';
  if (sportFamily === 'cbb' && pricingSignal && spreadMoveAbs >= 1.5) return 'Monitor';
  if (pricingSignal || disagreementSignal || spreadMoveAbs >= signals.thresholds.thinSpreadMove || totalMoveAbs >= signals.thresholds.thinTotalMove) return 'Thin Edge';
  return 'Pass';
}

function buildUniversalBullets({ opener, currentSpread, openerTotal, currentTotal, spreadMove, totalMove, bestSpread, bestTotal, bestMoneyline, disagreementScore, allInjuries }) {
  const bullets = [];
  if (opener != null && currentSpread != null && spreadMove !== 0) {
    bullets.push(`Spread moved from ${formatSigned(opener)} to ${formatSigned(currentSpread)}.`);
  }
  if (openerTotal != null && currentTotal != null && totalMove !== 0) {
    bullets.push(`Total moved from ${openerTotal} to ${currentTotal}.`);
  }
  if (hasPositiveEV(bestSpread) || hasPositiveEV(bestTotal) || hasPositiveEV(bestMoneyline)) {
    bullets.push('At least one current book number is pricing better than consensus fair value.');
  }
  if (disagreementScore >= 2) {
    bullets.push('Books are not tightly aligned, so line shopping matters more than usual.');
  }
  const impactInjuries = countImpactInjuries(allInjuries);
  if (impactInjuries > 0) {
    bullets.push(`${impactInjuries} higher-impact injury item${impactInjuries === 1 ? '' : 's'} could still move the number.`);
  } else if (allInjuries.length > 0) {
    bullets.push(`${allInjuries.length} reported injury item${allInjuries.length === 1 ? '' : 's'} could still affect the market.`);
  }
  return bullets.slice(0, 3);
}

function buildSportNote(sportFamily, { spreadMoveAbs, totalMoveAbs, allInjuries, disagreementScore, bestSpread, bestTotal, bestMoneyline, currentSpread }) {
  switch (sportFamily) {
    case 'nba':
      if (countImpactInjuries(allInjuries) > 0) return 'NBA markets can swing hard on late availability, so injury context matters more than the raw move alone.';
      if (hasPositiveEV(bestTotal) && totalMoveAbs >= 2) return 'NBA totals can move quickly when pace and rotation expectations shift, so totals value matters more here.';
      return 'NBA reads should balance the number, the move, and whether lineup news is actually driving it.';
    case 'cbb':
      if (spreadMoveAbs >= 1.5) return 'College basketball is more volatile game-to-game, so line movement alone should not be treated like certainty.';
      if (hasPositiveEV(bestSpread) || hasPositiveEV(bestMoneyline)) return 'CBB edges are often thinner and noisier, so number quality matters more than the team name on the jersey.';
      return 'CBB edges are often thinner and noisier, so matchup style and volatility matter more than brand-name teams.';
    case 'football':
    case 'cfootball':
      if (isKeyFootballNumber(currentSpread)) return 'Football numbers become much more sensitive around key spreads like 3 and 7, so timing matters more than a raw edge label.';
      if (spreadMoveAbs >= 1) return 'Football moves matter more when they push through important numbers, not just because the line changed.';
      return 'In football, injuries and market structure often matter more than small cosmetic movement.';
    case 'baseball':
      if (hasPositiveEV(bestMoneyline)) return 'Baseball often plays more like a price market than a side market, so price quality can matter more than team narrative.';
      if (allInjuries.length > 0) return 'Baseball context should account for lineup availability, but pitcher quality and price usually drive the stronger edge.';
      return 'Baseball pricing is often more sensitive to pitchers and lineup quality than to broad team form alone.';
    case 'hockey':
      if (hasPositiveEV(bestMoneyline)) return 'Hockey often behaves like a tight price market, so moneyline quality can matter more than a small move in the opener.';
      return 'Hockey edges are usually small, so price discipline matters more than forcing action off a minor move.';
    case 'soccer':
      if (totalMoveAbs >= 0.25) return 'Soccer totals are low-scoring and fragile, so even quarter-goal movement can be meaningful.';
      return 'Soccer markets are lower-scoring and more draw-sensitive, so smaller line moves can still matter.';
    default:
      if (disagreementScore >= 2) return 'This looks more like a line-shopping spot than a blind follow-the-market spot.';
      return 'The best use of this read is to decide whether the current number is worth action or better left alone.';
  }
}

function inferBestAngle({ game, spreadCandidates = [], totalCandidates = [], moneylineCandidates = [], readLabel }) {
  if (readLabel === 'Pass') return 'No bet right now';

  const bestSpread = pickBestCandidate(spreadCandidates);
  const bestTotal = pickBestCandidate(totalCandidates);
  const bestMoneyline = pickBestCandidate(moneylineCandidates);
  const candidates = [bestSpread, bestTotal, bestMoneyline]
    .filter(Boolean)
    .sort((a, b) => ((b.isPositiveEV ? 1 : 0) - (a.isPositiveEV ? 1 : 0)) || ((Math.abs(b.price || 0)) - (Math.abs(a.price || 0))));
  const best = candidates[0];

  if (!best) return `${game.away_team} vs ${game.home_team} — monitor for a better number`;
  if (best.market === 'totals') return `${best.name} ${best.point} at ${best.bookTitle || best.book}`;
  if (best.market === 'h2h') return `${best.name} moneyline ${formatSigned(best.price)} at ${best.bookTitle || best.book}`;
  return `${best.name} ${formatSigned(best.point)} at ${best.bookTitle || best.book}`;
}

function buildReasonFromFlags(readLabel, flags = [], sportFamily) {
  const reasonByRead = {
    Playable: sportFamily === 'baseball'
      ? 'The current price still looks actionable relative to the market context and available number.'
      : 'The current number still looks actionable relative to the market context and available price.',
    Monitor: 'There is something real here, but timing, news, or number quality still matters before jumping in.',
    'Thin Edge': 'There may be a workable angle, but the edge is not strong enough to force action.',
    Pass: 'The market does not separate enough right now to justify forcing a bet.',
  };

  if (flags.includes('injury_uncertainty_high')) return `${reasonByRead[readLabel]} Injury uncertainty is the main reason not to overstate the edge.`;
  if (flags.includes('key_number_spread')) return `${reasonByRead[readLabel]} The spread is sitting on a key football number, so timing risk is elevated.`;
  if (flags.includes('price_market_preferred')) return `${reasonByRead[readLabel]} This profiles more like a price-first spot than a narrative side.`;
  return reasonByRead[readLabel];
}

function buildValidation({ opener, currentSpread, openerTotal, currentTotal, spreadCandidates, totalCandidates, moneylineCandidates, sourceTags, flags }) {
  const trackedMarkets = {
    spread: spreadCandidates.length,
    total: totalCandidates.length,
    moneyline: moneylineCandidates.length,
  };

  const dataQuality = [
    opener != null || currentSpread != null,
    openerTotal != null || currentTotal != null,
    spreadCandidates.length > 0 || totalCandidates.length > 0 || moneylineCandidates.length > 0,
  ].filter(Boolean).length;

  const confidence = dataQuality === 3 ? 'standard' : dataQuality === 2 ? 'partial' : 'thin';

  return {
    summaryVersion: 'v2-reliability',
    confidence,
    trackedMarkets,
    sourceCount: sourceTags.length,
    flagCount: flags.length,
    openerAvailable: opener != null,
    currentSpreadAvailable: currentSpread != null,
    openerTotalAvailable: openerTotal != null,
    currentTotalAvailable: currentTotal != null,
  };
}

export function buildPremiumGameSummary({
  game,
  opener,
  currentSpread,
  openerTotal,
  currentTotal,
  spreadMove,
  totalMove,
  allInjuries = [],
  bestSpread,
  bestTotal,
  bestMoneyline,
  spreadCandidates = [],
  totalCandidates = [],
  moneylineCandidates = [],
}) {
  const sportFamily = getSportFamily(game.sport_key);
  const spreadMoveAbs = Math.abs(spreadMove || 0);
  const totalMoveAbs = Math.abs(totalMove || 0);
  const disagreementScore = [bestSpread, bestTotal, bestMoneyline].filter(x => x?.bookTitle || x?.book).length;

  const signals = buildReasoningSignals({
    spreadMoveAbs,
    totalMoveAbs,
    allInjuries,
    bestSpread,
    bestTotal,
    bestMoneyline,
    disagreementScore,
    sportFamily,
    currentSpread,
  });

  const readLabel = inferReadLabel({
    ...signals,
    sportFamily,
    spreadMoveAbs,
    totalMoveAbs,
  });

  const bullets = buildUniversalBullets({
    opener,
    currentSpread,
    openerTotal,
    currentTotal,
    spreadMove,
    totalMove,
    bestSpread,
    bestTotal,
    bestMoneyline,
    disagreementScore,
    allInjuries,
  });

  const sportNote = buildSportNote(sportFamily, {
    spreadMoveAbs,
    totalMoveAbs,
    allInjuries,
    disagreementScore,
    bestSpread,
    bestTotal,
    bestMoneyline,
    currentSpread,
  });

  const bestAngle = inferBestAngle({ game, spreadCandidates, totalCandidates, moneylineCandidates, readLabel });
  const reasonFlags = signals.flags;
  const sourceTags = signals.sourceTags;

  return {
    snapshot: buildSnapshot({ currentSpread, currentTotal, bestSpread, bestTotal, bestMoneyline }),
    bullets,
    readLabel,
    reason: buildReasonFromFlags(readLabel, reasonFlags, sportFamily),
    sportNote,
    bestAngle,
    reasonFlags,
    sourceTags,
    sourceTagLabels: sourceTags.map(toReadableSourceTag),
    validation: buildValidation({
      opener,
      currentSpread,
      openerTotal,
      currentTotal,
      spreadCandidates,
      totalCandidates,
      moneylineCandidates,
      sourceTags,
      flags: reasonFlags,
    }),
    tracking: {
      sportFamily,
      disagreementScore,
      spreadMoveAbs,
      totalMoveAbs,
      impactInjuryCount: signals.impactInjuries,
      injurySeverityScore: Number(signals.injurySeverityScore.toFixed(1)),
      keyNumberSpread: signals.keyNumberSpot,
      meaningfulMove: signals.meaningfulMove,
      pricingSignal: signals.pricingSignal,
    },
  };
}
