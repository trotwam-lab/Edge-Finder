// Which of yesterday's flagged edges the user logged in their own tracker:
// same game, market, side and (for spreads/totals) line.
export function matchTakenEdges(edges, bets) {
  const live = (bets || []).filter(b => b && !b.deleted && b.gameId && b.marketKey && b.outcomeName);
  return (edges || []).filter(edge => edge?.gameId && live.some(b => (
    b.gameId === edge.gameId
    && b.marketKey === edge.market
    && b.outcomeName === edge.outcomeName
    && (edge.outcomePoint == null || Number(b.outcomePoint) === Number(edge.outcomePoint))
  )));
}
