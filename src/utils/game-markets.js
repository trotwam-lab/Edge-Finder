// src/utils/game-markets.js
// Best-price summaries for the extra baseball markets the SportsGameOdds feed
// adds to a game: first-five run lines, team totals, and NRFI.

export const EXTRA_MARKETS = [
  { key: 'f5_spreads', title: 'First 5 innings run line', type: 'Spread' },
  { key: 'team_totals', title: 'Team totals', type: 'Total' },
  { key: 'nrfi', title: 'No run first inning', type: 'Other' },
];

const MAX_ROWS = 8;

function signed(point) {
  return point > 0 ? `+${point}` : `${point}`;
}

function sideLabel(side) {
  if (side === 'over') return 'Over';
  if (side === 'under') return 'Under';
  return '';
}

export function extraMarketLabel(marketKey, outcome) {
  if (marketKey === 'f5_spreads') return `${outcome.name} ${signed(outcome.point)} (F5)`;
  if (marketKey === 'team_totals') return `${outcome.name} ${sideLabel(outcome.side)} ${outcome.point}`.replace(/\s+/g, ' ');
  if (marketKey === 'nrfi') return outcome.point != null ? `NRFI (Under ${outcome.point} 1st inn)` : 'NRFI (no run 1st inning)';
  return outcome.name;
}

// Returns [{ key, title, type, rows: [{ id, label, price, bookKey, bookTitle, outcome }] }]
// keeping only markets with at least one priced outcome from an allowed book.
export function summarizeExtraMarkets(game, isBookAllowed = () => true) {
  const books = (game?.bookmakers || []).filter(book => isBookAllowed(book.key));
  return EXTRA_MARKETS.map(def => {
    const best = new Map();
    books.forEach(book => {
      const market = book.markets?.find(m => m.key === def.key);
      market?.outcomes?.forEach(outcome => {
        const price = Number(outcome.price);
        if (!Number.isFinite(price)) return;
        const id = `${outcome.name}|${outcome.side ?? ''}|${outcome.point ?? ''}`;
        const current = best.get(id);
        if (!current || price > current.price) {
          best.set(id, { id, label: extraMarketLabel(def.key, outcome), price, bookKey: book.key, bookTitle: book.title, outcome });
        }
      });
    });
    const rows = Array.from(best.values())
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
      .slice(0, MAX_ROWS);
    return { ...def, rows };
  }).filter(market => market.rows.length > 0);
}
