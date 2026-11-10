function rankKey(edge = {}) {
  const game = edge.gameId || edge.game || '';
  const market = edge.market || '';
  const outcome = edge.outcomeName || edge.edge || '';
  const point = edge.outcomePoint ?? '';
  return `${game}::${market}::${outcome}::${point}`;
}

// A ranked board should show one wager once. If several books qualify for the
// same event/market/side/line, keep the strongest offer and attach that book.
// The full market comparison remains available elsewhere in the app.
export function dedupeRankedEdges(edges = []) {
  const bestByWager = new Map();

  for (const edge of edges) {
    const key = rankKey(edge);
    const current = bestByWager.get(key);
    if (!current
      || Number(edge.ev) > Number(current.ev)
      || (Number(edge.ev) === Number(current.ev) && Number(edge.price) > Number(current.price))) {
      bestByWager.set(key, edge);
    }
  }

  return Array.from(bestByWager.values()).sort((a, b) => (
    Number(b.ev) - Number(a.ev)
    || Number(b.price) - Number(a.price)
    || String(a.game || '').localeCompare(String(b.game || ''))
  ));
}

