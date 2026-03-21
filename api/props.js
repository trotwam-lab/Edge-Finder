// api/props.js — Player Props Endpoint
// Markets are sport-aware and pulled from the current Odds API coverage.

const cache = {};
const TTL = 60 * 1000; // 1 minute

// Sport-specific prop markets supported by the Odds API.
// Keep these scoped to the sports we actively surface in the app.
const MARKETS_BY_SPORT = {
  basketball_nba: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_steals',
    'player_blocks',
    'player_turnovers',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
    'player_rebounds_assists',
    'player_double_double',
    'player_triple_double',
  ],
  basketball_ncaab: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_steals',
    'player_blocks',
    'player_turnovers',
    'player_points_rebounds_assists',
  ],
  basketball_wncaab: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_steals',
    'player_blocks',
    'player_turnovers',
    'player_points_rebounds_assists',
  ],
  americanfootball_nfl: [
    'player_pass_yds',
    'player_pass_tds',
    'player_pass_completions',
    'player_pass_attempts',
    'player_pass_interceptions',
    'player_pass_longest_completion',
    'player_rush_yds',
    'player_rush_attempts',
    'player_rush_longest',
    'player_rush_tds',
    'player_receptions',
    'player_reception_yds',
    'player_reception_longest',
    'player_reception_tds',
    'player_anytime_td',
    'player_1st_td',
    'player_last_td',
    'player_tds_over',
    'player_sacks',
    'player_solo_tackles',
    'player_tackles_assists',
  ],
  americanfootball_ncaaf: [
    'player_pass_yds',
    'player_pass_tds',
    'player_pass_completions',
    'player_rush_yds',
    'player_rush_attempts',
    'player_reception_yds',
    'player_receptions',
    'player_anytime_td',
    'player_1st_td',
    'player_last_td',
    'player_tds_over',
  ],
  icehockey_nhl: [
    'player_points',
    'player_shots_on_goal',
    'player_blocked_shots',
    'player_assists',
    'player_goals',
    'player_power_play_points',
    'player_saves',
  ],
  baseball_mlb: [
    'batter_hits',
    'batter_total_bases',
    'batter_rbis',
    'batter_runs_scored',
    'batter_home_runs',
    'batter_hits_runs_rbis',
    'batter_singles',
    'batter_doubles',
    'batter_triples',
    'batter_walks',
    'batter_strikeouts',
    'pitcher_strikeouts',
    'pitcher_hits_allowed',
    'pitcher_walks',
    'pitcher_outs',
    'pitcher_earned_runs',
    'pitcher_record_a_win',
  ],
  soccer_epl: ['player_shots_on_target', 'player_to_score'],
};

const DEFAULT_MARKETS = ['player_points', 'player_rebounds', 'player_assists'];

function getMarkets(sport) {
  return MARKETS_BY_SPORT[sport] || DEFAULT_MARKETS;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { sport = 'basketball_nba' } = req.query;
  const API_KEY = process.env.ODDS_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'API key not configured' });

  const cacheKey = `props-${sport}`;
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache[cacheKey].data);
  }

  try {
    const markets = getMarkets(sport);

    const eventsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${API_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!eventsRes.ok) throw new Error(`Events fetch failed: ${eventsRes.status}`);
    const events = await eventsRes.json();
    if (!events || events.length === 0) return res.json([]);

    const allProps = [];

    for (const event of events.slice(0, 8)) {
      try {
        const oddsRes = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${API_KEY}&regions=us&markets=${markets.join(',')}&oddsFormat=american`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!oddsRes.ok) {
          console.warn(`Props failed for ${sport} ${event.id}: ${oddsRes.status}`);
          continue;
        }
        const oddsData = await oddsRes.json();
        if (!oddsData.bookmakers?.length) continue;

        oddsData.bookmakers.forEach(bookmaker => {
          bookmaker.markets?.forEach(market => {
            if (!markets.includes(market.key) || !market.outcomes?.length) return;

            market.outcomes.forEach(outcome => {
              if (!outcome.description) return;
              allProps.push({
                id: `${sport}-${event.id}-${bookmaker.key}-${market.key}-${outcome.description}-${outcome.name}-${outcome.point ?? 'na'}`,
                player: outcome.description,
                market: market.key,
                line: outcome.point,
                outcome: outcome.name,
                price: outcome.price,
                bookKey: bookmaker.key,
                bookTitle: bookmaker.title,
                book: bookmaker.title,
                game: `${event.away_team} @ ${event.home_team}`,
                gameId: event.id,
                sport,
                commence_time: event.commence_time,
              });
            });
          });
        });
      } catch (err) {
        console.warn(`Error fetching props for ${sport} ${event.id}:`, err.message);
      }
    }

    cache[cacheKey] = { data: allProps, ts: Date.now() };
    res.setHeader('X-Cache', 'MISS');
    return res.json(allProps);
  } catch (err) {
    console.error('Props API error:', err);
    return res.status(500).json({ error: 'Failed to fetch props', details: err.message });
  }
}
