const SGO_BASE_URL = 'https://api.sportsgameodds.com/v2';

const SPORT_TO_LEAGUE = {
  basketball_nba: 'NBA',
  basketball_wnba: 'WNBA',
  americanfootball_nfl: 'NFL',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
  mma_mixed_martial_arts: 'UFC',
};

const LEAGUE_TO_SPORT = {
  NBA: { key: 'basketball_nba', title: 'NBA', group: 'Basketball' },
  WNBA: { key: 'basketball_wnba', title: 'WNBA', group: 'Basketball' },
  NFL: { key: 'americanfootball_nfl', title: 'NFL', group: 'American Football' },
  MLB: { key: 'baseball_mlb', title: 'MLB', group: 'Baseball' },
  NHL: { key: 'icehockey_nhl', title: 'NHL', group: 'Ice Hockey' },
  UFC: { key: 'mma_mixed_martial_arts', title: 'UFC', group: 'Mixed Martial Arts' },
};

const CORE_ODD_IDS = {
  h2h: [
    ['points-home-game-ml-home', 'home'],
    ['points-away-game-ml-away', 'away'],
  ],
  spreads: [
    ['points-home-game-sp-home', 'home'],
    ['points-away-game-sp-away', 'away'],
  ],
  totals: [
    ['points-all-game-ou-over', 'Over'],
    ['points-all-game-ou-under', 'Under'],
  ],
};

export function isSportsGameOddsEnabled() {
  return process.env.SPORTSGAMEODDS_ENABLED === 'true' && Boolean(process.env.SPORTSGAMEODDS_API_KEY);
}

export function leagueIdForOddsSport(sport) {
  return SPORT_TO_LEAGUE[sport] || null;
}

export function sgoScannableSports() {
  return Object.values(LEAGUE_TO_SPORT);
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(String(value).replace(/^\+/, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function teamName(event, side) {
  return event?.teams?.[side]?.names?.long || (side === 'home' ? 'Home' : 'Away');
}

function titleizeBook(bookKey) {
  return String(bookKey || '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Unknown';
}

async function sgoJson(path, params = {}) {
  const url = new URL(`${SGO_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {
    headers: { 'x-api-key': process.env.SPORTSGAMEODDS_API_KEY },
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

export async function fetchSportsGameOddsEvents({ leagueID, limit = 100, includeAltLines = false } = {}) {
  const result = await sgoJson('/events', {
    leagueID,
    oddsAvailable: true,
    includeAltLines,
    limit,
  });
  if (!result.ok || result.data?.success === false) {
    return { ok: false, status: result.status, data: [], error: result.data?.error };
  }
  return { ok: true, status: result.status, data: Array.isArray(result.data?.data) ? result.data.data : [] };
}

function addOutcome(bookmakers, bookKey, marketKey, outcome) {
  if (!outcome || outcome.price === undefined) return;

  if (!bookmakers.has(bookKey)) {
    bookmakers.set(bookKey, {
      key: bookKey,
      title: titleizeBook(bookKey),
      last_update: outcome.last_update || new Date().toISOString(),
      markets: [],
    });
  }

  const bookmaker = bookmakers.get(bookKey);
  if (outcome.last_update) bookmaker.last_update = outcome.last_update;
  let market = bookmaker.markets.find(entry => entry.key === marketKey);
  if (!market) {
    market = { key: marketKey, outcomes: [] };
    bookmaker.markets.push(market);
  }

  const existing = market.outcomes.find(entry =>
    entry.name === outcome.name && (entry.point ?? null) === (outcome.point ?? null)
  );
  if (!existing) market.outcomes.push(outcome);
}

// SportsGameOdds occasionally returns a single bookmaker's two moneyline
// selections on the wrong participants. A reversed favorite/underdog pair
// creates an enormous but unplayable arb, so discard that book's h2h market
// when BOTH sides oppose a strong SGO fair line. Requiring both signs to be
// reversed and a >= 2/1 fair favorite keeps normal price movement intact.
function isReversedStrongMoneyline(market) {
  if (market?.key !== 'h2h' || market.outcomes?.length !== 2) return false;

  const pairs = market.outcomes.map(outcome => ({
    offered: toNumber(outcome.price),
    fair: toNumber(outcome.sgo?.fairOdds),
  }));
  if (pairs.some(pair => pair.offered === undefined || pair.fair === undefined)) return false;
  if (!pairs.some(pair => Math.abs(pair.fair) >= 200)) return false;

  return pairs.every(pair => Math.sign(pair.offered) === -Math.sign(pair.fair));
}

function removeReversedMoneylines(bookmakers, eventID) {
  bookmakers.forEach(bookmaker => {
    const rejected = bookmaker.markets.filter(isReversedStrongMoneyline);
    if (!rejected.length) return;

    bookmaker.markets = bookmaker.markets.filter(market => !rejected.includes(market));
    console.warn(`Dropped reversed SGO moneyline for ${eventID} at ${bookmaker.key}`);
  });
}

export function transformSgoEventToOddsApiGame(event) {
  const bookmakers = new Map();
  const home = teamName(event, 'home');
  const away = teamName(event, 'away');

  Object.entries(CORE_ODD_IDS).forEach(([marketKey, oddDefs]) => {
    oddDefs.forEach(([oddID, side]) => {
      const odd = event?.odds?.[oddID];
      if (!odd?.byBookmaker) return;

      Object.entries(odd.byBookmaker).forEach(([bookKey, bookOdd]) => {
        if (!bookOdd?.available) return;
        const price = toNumber(bookOdd.odds);
        if (price === undefined) return;

        let point;
        if (marketKey === 'spreads') point = toNumber(bookOdd.spread ?? odd.bookSpread);
        if (marketKey === 'totals') point = toNumber(bookOdd.overUnder ?? odd.bookOverUnder);

        addOutcome(bookmakers, bookKey, marketKey, {
          name: side === 'home' ? home : side === 'away' ? away : side,
          price,
          ...(point !== undefined ? { point } : {}),
          last_update: bookOdd.lastUpdatedAt,
          sgo: {
            fairOdds: odd.fairOdds,
            fairSpread: odd.fairSpread,
            fairOverUnder: odd.fairOverUnder,
            deeplink: bookOdd.deeplink,
          },
        });
      });
    });
  });

  removeReversedMoneylines(bookmakers, event.eventID);

  return {
    id: event.eventID,
    sport_key: LEAGUE_TO_SPORT[event.leagueID]?.key || event.leagueID,
    sport_title: LEAGUE_TO_SPORT[event.leagueID]?.title || event.leagueID,
    commence_time: event.status?.startsAt,
    home_team: home,
    away_team: away,
    bookmakers: [...bookmakers.values()].filter(book => book.markets.length > 0),
  };
}

function propLine(odd, bookOdd) {
  return toNumber(bookOdd.overUnder ?? bookOdd.spread ?? odd.bookOverUnder ?? odd.bookSpread);
}

function propOutcomeName(sideID) {
  if (sideID === 'over') return 'Over';
  if (sideID === 'under') return 'Under';
  if (sideID === 'yes') return 'Yes';
  if (sideID === 'no') return 'No';
  return sideID || 'Prop';
}

function shouldIncludeProp(odd) {
  if (!odd) return false;
  if (!odd.playerID && ['home', 'away', 'all'].includes(odd.statEntityID)) return false;
  if (!odd.byBookmaker || !['ou', 'yn', 'sp', 'ml'].includes(odd.betTypeID)) return false;
  return true;
}

export function transformSgoEventToProps(event) {
  const props = [];
  const game = `${teamName(event, 'away')} @ ${teamName(event, 'home')}`;
  const sport = LEAGUE_TO_SPORT[event.leagueID]?.key || event.leagueID;

  Object.entries(event?.odds || {}).forEach(([oddID, odd]) => {
    if (!shouldIncludeProp(odd)) return;
    const player = event.players?.[odd.playerID]?.name || odd.marketName?.replace(/ Over\/Under$/, '') || odd.statEntityID;
    const market = odd.statID || odd.marketName || 'player_prop';
    const outcome = propOutcomeName(odd.sideID);

    Object.entries(odd.byBookmaker || {}).forEach(([bookKey, bookOdd]) => {
      if (!bookOdd?.available) return;
      const price = toNumber(bookOdd.odds);
      if (price === undefined) return;
      const line = propLine(odd, bookOdd);

      props.push({
        id: `${event.eventID}-${bookKey}-${oddID}-${line ?? 'na'}`,
        player,
        market,
        line,
        outcome,
        price,
        bookKey,
        bookTitle: titleizeBook(bookKey),
        book: titleizeBook(bookKey),
        game,
        gameId: event.eventID,
        sport,
        commence_time: event.status?.startsAt,
        sgo: {
          oddID,
          fairOdds: odd.fairOdds,
          fairOverUnder: odd.fairOverUnder,
          openBookOdds: odd.openBookOdds,
          openBookOverUnder: odd.openBookOverUnder,
          deeplink: bookOdd.deeplink,
          lastUpdatedAt: bookOdd.lastUpdatedAt,
        },
      });
    });
  });

  return props;
}
