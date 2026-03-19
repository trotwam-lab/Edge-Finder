function getSportFamily(sportKey = '') {
  if (sportKey.includes('basketball_nba')) return 'nba';
  if (sportKey.includes('basketball_ncaab')) return 'cbb';
  if (sportKey.includes('americanfootball')) return 'football';
  if (sportKey.includes('baseball')) return 'baseball';
  if (sportKey.includes('icehockey')) return 'hockey';
  return 'generic';
}

function formatSigned(value) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value > 0 ? '+' : ''}${value}`;
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

function pickBestCandidate(candidates = []) {
  const filtered = candidates.filter(Boolean);
  if (!filtered.length) return null;
  return filtered.sort((a, b) => {
    const aScore = (a.isPositiveEV ? 100 : 0) + Math.abs(a.price || 0) / 100;
    const bScore = (b.isPositiveEV ? 100 : 0) + Math.abs(b.price || 0) / 100;
    return bScore - aScore;
  })[0];
}

function inferReadLabel({ spreadMoveAbs, totalMoveAbs, allInjuries, bestSpread, bestTotal, bestMoneyline, disagreementScore, sportFamily, currentSpread }) {
  const pricingSignal = [bestSpread, bestTotal, bestMoneyline].some(x => x?.isPositiveEV);
  const meaningfulMove = spreadMoveAbs >= 1 || totalMoveAbs >= 1.5;
  const impactInjuries = countImpactInjuries(allInjuries);
  const injurySeverityScore = getInjurySeverityScore(allInjuries);
  const heavyInjuryFog = injurySeverityScore >= (sportFamily === 'nba' ? 4 : 5);
  const keyNumberSpot = sportFamily === 'football' && isKeyFootballNumber(currentSpread);

  if (pricingSignal && meaningfulMove && !heavyInjuryFog && !keyNumberSpot) return 'Playable';
  if ((pricingSignal && heavyInjuryFog) || (meaningfulMove && heavyInjuryFog)) return 'Monitor';
  if (sportFamily === 'football' && keyNumberSpot && (pricingSignal || meaningfulMove)) return 'Monitor';
  if (sportFamily === 'cbb' && pricingSignal && spreadMoveAbs >= 1.5) return 'Monitor';
  if (pricingSignal || disagreementScore >= 2 || spreadMoveAbs >= 0.5 || totalMoveAbs >= 1) return 'Thin Edge';
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
  if (bestSpread?.isPositiveEV || bestTotal?.isPositiveEV || bestMoneyline?.isPositiveEV) {
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
      if (bestTotal?.isPositiveEV && totalMoveAbs >= 2) return 'NBA totals can move quickly when pace and rotation expectations shift, so totals value matters more here.';
      return 'NBA reads should balance the number, the move, and whether lineup news is actually driving it.';
    case 'cbb':
      if (spreadMoveAbs >= 1.5) return 'College basketball is more volatile game-to-game, so line movement alone should not be treated like certainty.';
      if (bestSpread?.isPositiveEV || bestMoneyline?.isPositiveEV) return 'CBB edges are often thinner and noisier, so number quality matters more than the team name on the jersey.';
      return 'CBB edges are often thinner and noisier, so matchup style and volatility matter more than brand-name teams.';
    case 'football':
      if (isKeyFootballNumber(currentSpread)) return 'Football numbers become much more sensitive around key spreads like 3 and 7, so timing matters more than a raw edge label.';
      if (spreadMoveAbs >= 1) return 'Football moves matter more when they push through important numbers, not just because the line changed.';
      return 'In football, injuries and market structure often matter more than small cosmetic movement.';
    case 'baseball':
      if (bestMoneyline?.isPositiveEV) return 'Baseball often plays more like a price market than a side market, so price quality can matter more than team narrative.';
      if (allInjuries.length > 0) return 'Baseball context should account for lineup availability, but pitcher quality and price usually drive the stronger edge.';
      return 'Baseball pricing is often more sensitive to pitchers and lineup quality than to broad team form alone.';
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
  const candidates = [bestSpread, bestTotal, bestMoneyline].filter(Boolean).sort((a, b) => ((b.isPositiveEV ? 1 : 0) - (a.isPositiveEV ? 1 : 0)));
  const best = candidates[0];

  if (!best) return `${game.away_team} vs ${game.home_team} — monitor for a better number`;
  if (best.market === 'totals') return `${best.name} ${best.point} at ${best.bookTitle}`;
  if (best.market === 'h2h') return `${best.name} moneyline ${formatSigned(best.price)} at ${best.bookTitle}`;
  return `${best.name} ${formatSigned(best.point)} at ${best.bookTitle}`;
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
  const disagreementScore = [bestSpread, bestTotal, bestMoneyline].filter(x => x?.bookTitle).length;

  const readLabel = inferReadLabel({
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

  const reasonByRead = {
    Playable: sportFamily === 'baseball' ? 'The current price still looks actionable relative to the market context and available number.' : 'The current number still looks actionable relative to the market context and available price.',
    Monitor: 'There is something real here, but timing, news, or number quality still matters before jumping in.',
    'Thin Edge': 'There may be a workable angle, but the edge is not strong enough to force action.',
    Pass: 'The market does not separate enough right now to justify forcing a bet.',
  };

  return {
    snapshot: buildSnapshot({ currentSpread, currentTotal, bestSpread, bestTotal, bestMoneyline }),
    bullets,
    readLabel,
    reason: reasonByRead[readLabel],
    sportNote,
    bestAngle: inferBestAngle({ game, spreadCandidates, totalCandidates, moneylineCandidates, readLabel }),
  };
}
