// api/_gameMarkets.js — map The Odds API's per-event baseball markets onto
// the market keys the app already renders from the SportsGameOdds feed
// (f5_spreads, team_totals, nrfi), so one UI serves either provider.
//
// These markets only exist on The Odds API's per-event endpoint, not the bulk
// /odds call, so they are fetched when a user opens a game.

export const ODDS_API_EXTRA_MARKETS = ['spreads_1st_5_innings', 'team_totals', 'totals_1st_1_innings'];

function price(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapOutcome(marketKey, outcome) {
  const p = price(outcome?.price);
  if (p == null) return null;
  const side = String(outcome.name || '').toLowerCase();

  if (marketKey === 'spreads_1st_5_innings') {
    if (outcome.point == null) return null;
    return { key: 'f5_spreads', outcome: { name: outcome.name, point: Number(outcome.point), price: p } };
  }
  if (marketKey === 'team_totals') {
    if (!outcome.description || outcome.point == null || !['over', 'under'].includes(side)) return null;
    return { key: 'team_totals', outcome: { name: outcome.description, side, point: Number(outcome.point), price: p } };
  }
  if (marketKey === 'totals_1st_1_innings') {
    // NRFI = under 0.5 runs in the 1st inning; other lines aren't NRFI.
    if (side !== 'under' || Number(outcome.point) !== 0.5) return null;
    return { key: 'nrfi', outcome: { name: 'NRFI', side: 'under', point: 0.5, price: p } };
  }
  return null;
}

// Odds API event-odds payload -> { bookmakers: [{ key, title, markets: [{ key, outcomes }] }] }
export function transformEventMarkets(event) {
  const bookmakers = (event?.bookmakers || []).map(book => {
    const byKey = new Map();
    (book.markets || []).forEach(market => {
      (market.outcomes || []).forEach(outcome => {
        const mapped = mapOutcome(market.key, outcome);
        if (!mapped) return;
        if (!byKey.has(mapped.key)) byKey.set(mapped.key, []);
        byKey.get(mapped.key).push(mapped.outcome);
      });
    });
    return {
      key: book.key,
      title: book.title,
      markets: Array.from(byKey.entries()).map(([key, outcomes]) => ({ key, outcomes })),
    };
  }).filter(book => book.markets.length > 0);
  return { bookmakers };
}
