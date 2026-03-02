// api/props.js — Player Props Endpoint
// Returns ALL outcomes (Over AND Under) from ALL books for each player/market.
// The UI groups these by player; having both sides lets users compare Over vs Under
// across every sportsbook at once.

const cache = {};
const TTL = 60 * 1000; // 1 minute

const PROP_MARKETS = [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_steals',
    'player_blocks',
  ];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

  const { sport = 'basketball_nba' } = req.query;
    const API_KEY = process.env.ODDS_API_KEY;

  if (!API_KEY) {
        return res.status(500).json({ error: 'API key not configured' });
  }

  const cacheKey = `props-${sport}`;
    if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(cache[cacheKey].data);
    }

  try {
        // Step 1: Get upcoming events
      const eventsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${API_KEY}`;
        const eventsResponse = await fetch(eventsUrl, { signal: AbortSignal.timeout(10000) });
        if (!eventsResponse.ok) {
                throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
        }
        const events = await eventsResponse.json();
        if (!events || events.length === 0) {
                return res.json([]);
        }

      const allProps = [];

      // Step 2: Fetch prop odds for each event (limit to 8 to balance coverage vs API credits)
      for (const event of events.slice(0, 8)) {
              try {
                        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${API_KEY}&regions=us&markets=${PROP_MARKETS.join(',')}&oddsFormat=american`;
                        const oddsResponse = await fetch(oddsUrl, { signal: AbortSignal.timeout(10000) });
                        if (!oddsResponse.ok) {
                                    console.warn(`Props fetch failed for event ${event.id}: ${oddsResponse.status}`);
                                    continue;
                        }
                        const oddsData = await oddsResponse.json();
                        if (!oddsData.bookmakers || oddsData.bookmakers.length === 0) continue;

                // Step 3: Collect EVERY outcome from EVERY book (Over AND Under separately)
                oddsData.bookmakers.forEach(bookmaker => {
                            PROP_MARKETS.forEach(marketKey => {
                                          const market = bookmaker.markets?.find(m => m.key === marketKey);
                                          if (!market?.outcomes) return;

                                                             market.outcomes.forEach(outcome => {
                                                                             // outcome.description = player name
                                                                                                   // outcome.name = 'Over' or 'Under'
                                                                                                   // outcome.point = the line (e.g. 22.5)
                                                                                                   // outcome.price = American odds
                                                                                                   if (!outcome.description) return; // skip outcomes without player name

                                                                                                   allProps.push({
                                                                                                                     id: `${event.id}-${bookmaker.key}-${marketKey}-${outcome.description}-${outcome.name}-${outcome.point}`,
                                                                                                                     player: outcome.description,
                                                                                                                     market: marketKey,
                                                                                                                     line: outcome.point,
                                                                                                                     outcome: outcome.name,   // 'Over' or 'Under'
                                                                                                                     price: outcome.price,
                                                                                                                     bookKey: bookmaker.key,
                                                                                                                     bookTitle: bookmaker.title,
                                                                                                                     book: bookmaker.title,   // alias for components that use .book
                                                                                                                     game: `${event.away_team} @ ${event.home_team}`,
                                                                                                                     gameId: event.id,
                                                                                                                     commence_time: event.commence_time,
                                                                                                     });
                                                             });
                            });
                });
              } catch (error) {
                        console.warn(`Error fetching props for event ${event.id}:`, error.message);
              }
      }

      cache[cacheKey] = { data: allProps, ts: Date.now() };
        res.setHeader('X-Cache', 'MISS');
        return res.json(allProps);
  } catch (error) {
        console.error('Props API error:', error);
        return res.status(500).json({ error: 'Failed to fetch props', details: error.message });
  }
}
