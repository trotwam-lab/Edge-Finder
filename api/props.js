// api/props.js — Player Props Endpoint
// Markets are sport-aware — basketball markets for NBA, football for NFL, etc.

const cache = {};
const TTL = 60 * 1000; // 1 minute

// Sport-specific prop markets supported by the Odds API
const MARKETS_BY_SPORT = {
  basketball_nba:    ['player_points','player_rebounds','player_assists','player_threes','player_steals','player_blocks'],
  basketball_ncaab:  ['player_points','player_rebounds','player_assists','player_threes'],
  basketball_wncaab: ['player_points','player_rebounds','player_assists'],
  americanfootball_nfl:  ['player_pass_yds','player_rush_yds','player_reception_yds','player_anytime_td','player_pass_tds','player_pass_completions','player_receptions'],
  americanfootball_ncaaf: ['player_pass_yds','player_rush_yds','player_reception_yds','player_anytime_td'],
  icehockey_nhl: ['player_points','player_shots_on_goal','player_blocked_shots','player_assists','player_goals'],
  baseball_mlb: ['batter_hits','batter_total_bases','batter_rbis','batter_runs_scored','batter_home_runs','pitcher_strikeouts','pitcher_hits_allowed'],
  soccer_epl: ['player_shots_on_target','player_to_score'],
};

const DEFAULT_MARKETS = ['player_points','player_rebounds','player_assists'];

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

    // Step 1: Get upcoming events for this sport
    const eventsRes = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${API_KEY}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!eventsRes.ok) throw new Error(`Events fetch failed: ${eventsRes.status}`);
    const events = await eventsRes.json();
    if (!events || events.length === 0) return res.json([]);

    const allProps = [];

    // Step 2: Fetch props for up to 8 upcoming events
    for (const event of events.slice(0, 8)) {
      try {
        const oddsRes = await fetch(
          `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${API_KEY}&regions=us&markets=${markets.join(',')}&oddsFormat=american`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (!oddsRes.ok) { console.warn(`Props failed for ${event.id}: ${oddsRes.status}`); continue; }
        const oddsData = await oddsRes.json();
        if (!oddsData.bookmakers?.length) continue;

        oddsData.bookmakers.forEach(bookmaker => {
          markets.forEach(marketKey => {
            const market = bookmaker.markets?.find(m => m.key === marketKey);
            if (!market?.outcomes) return;
            market.outcomes.forEach(outcome => {
              if (!outcome.description) return;
              allProps.push({
                id: `${event.id}-${bookmaker.key}-${marketKey}-${outcome.description}-${outcome.name}-${outcome.point}`,
                player:     outcome.description,
                market:     marketKey,
                line:       outcome.point,
                outcome:    outcome.name,
                price:      outcome.price,
                bookKey:    bookmaker.key,
                bookTitle:  bookmaker.title,
                book:       bookmaker.title,
                game:       `${event.away_team} @ ${event.home_team}`,
                gameId:     event.id,
                sport,
                commence_time: event.commence_time,
              });
            });
          });
        });
      } catch (err) {
        console.warn(`Error fetching props for ${event.id}:`, err.message);
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
