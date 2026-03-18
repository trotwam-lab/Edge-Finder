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
  if (bestMoneyline?.price != null) parts.push(`Best ML ${formatSigned(bestMoneyline.price)}`);
  else if (bestSpread?.price != null) parts.push(`Best spread price ${formatSigned(bestSpread.price)}`);
  else if (bestTotal?.price != null) parts.push(`Best total price ${formatSigned(bestTotal.price)}`);
  return parts.join(' · ');
}

function inferReadLabel({ spreadMoveAbs, totalMoveAbs, allInjuries, bestSpread, bestTotal, bestMoneyline, disagreementScore }) {
  const pricingSignal = [bestSpread, bestTotal, bestMoneyline].some(x => x?.isPositiveEV);
  const meaningfulMove = spreadMoveAbs >= 1 || totalMoveAbs >= 1.5;
  const noisyInjuries = allInjuries.length >= 3;

  if (pricingSignal && meaningfulMove && !noisyInjuries) return 'Playable';
  if ((pricingSignal && noisyInjuries) || (meaningfulMove && noisyInjuries)) return 'Monitor';
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
  if (allInjuries.length > 0) {
    bullets.push(`${allInjuries.length} reported injury item${allInjuries.length === 1 ? '' : 's'} could still affect the market.`);
  }
  return bullets.slice(0, 3);
}

function buildSportNote(sportFamily, { spreadMoveAbs, totalMoveAbs, allInjuries, disagreementScore }) {
  switch (sportFamily) {
    case 'nba':
      if (allInjuries.length > 0) return 'NBA markets can swing hard on late availability, so injury context matters more than the raw move alone.';
      if (totalMoveAbs >= 2) return 'NBA totals can move quickly when pace and rotation expectations shift.';
      return 'NBA reads should balance the number, the move, and whether lineup news is actually driving it.';
    case 'cbb':
      if (spreadMoveAbs >= 1.5) return 'College basketball is more volatile game-to-game, so line movement alone should not be treated like certainty.';
      return 'CBB edges are often thinner and noisier, so matchup style and volatility matter more than brand-name teams.';
    case 'football':
      if (spreadMoveAbs >= 1) return 'Football moves matter more when they push through important numbers, not just because the line changed.';
      return 'In football, injuries and market structure often matter more than small cosmetic movement.';
    case 'baseball':
      return 'Baseball pricing is often more sensitive to pitchers and lineup quality than to broad team form alone.';
    default:
      if (disagreementScore >= 2) return 'This looks more like a line-shopping spot than a blind follow-the-market spot.';
      return 'The best use of this read is to decide whether the current number is worth action or better left alone.';
  }
}

function inferBestAngle({ game, bestSpread, bestTotal, bestMoneyline, readLabel }) {
  if (readLabel === 'Pass') return 'No bet right now';
  if (bestSpread?.isPositiveEV) {
    return `${bestSpread.name} ${formatSigned(bestSpread.point)} at ${bestSpread.bookTitle}`;
  }
  if (bestTotal?.isPositiveEV) {
    return `${bestTotal.name} ${bestTotal.point} at ${bestTotal.bookTitle}`;
  }
  if (bestMoneyline?.isPositiveEV) {
    return `${bestMoneyline.name} moneyline ${formatSigned(bestMoneyline.price)} at ${bestMoneyline.bookTitle}`;
  }
  if (bestSpread?.name) {
    return `${bestSpread.name} ${formatSigned(bestSpread.point)} at ${bestSpread.bookTitle}`;
  }
  return `${game.away_team} vs ${game.home_team} — monitor for a better number`;
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
  });

  const reasonByRead = {
    Playable: 'The current number still looks actionable relative to the market context and available price.',
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
    bestAngle: inferBestAngle({ game, bestSpread, bestTotal, bestMoneyline, readLabel }),
  };
}
