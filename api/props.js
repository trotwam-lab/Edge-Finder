// API endpoint for fetching player props from the-odds-api
// Returns ALL outcomes from ALL books (not grouped)
// Caches results to save API credits

const cache = {};
const TTL = 60 * 1000; // 60 second cache for props

export default async function handler(req, res) {
  const { sport = 'basketball_nba' } = req.query;
  const cacheKey = `props-${sport}`;

  // Return cached data if fresh
  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache[cacheKey].data);
  }

  const API_KEY = process.env.ODDS_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Fetch events first
    const eventsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/events?apiKey=${API_KEY}`;
    const eventsResponse = await fetch(eventsUrl);

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
    }

    const events = await eventsResponse.json();

    if (!events || events.length === 0) {
      return res.json([]);
    }

    // Extended markets for more comprehensive props
    const markets = [
      'player_points', 'player_rebounds', 'player_assists',
      'player_threes', 'player_steals', 'player_blocks', 'player_turnovers'
    ];

    // Fetch odds for each event (up to 8 events for broader coverage)
    const allProps = [];

    for (const event of events.slice(0, 8)) {
      try {
        const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/events/${event.id}/odds?apiKey=${API_KEY}&regions=us&markets=${markets.join(',')}&oddsFormat=american`;

        const oddsResponse = await fetch(oddsUrl);

        if (!oddsResponse.ok) {
          console.warn(`Failed to fetch odds for event ${event.id}`);
          continue;
        }

        const oddsData = await oddsResponse.json();

        if (!oddsData.bookmakers) continue;

        // Process each bookmaker
        oddsData.bookmakers.forEach(bookmaker => {
          const bookKey = bookmaker.key;
          const bookTitle = bookmaker.title;

          // Process each market
          markets.forEach(marketKey => {
            const market = bookmaker.markets?.find(m => m.key === marketKey);

            if (market && market.outcomes) {
              market.outcomes.forEach(outcome => {
                // Each outcome represents one side (Over or Under) for a player
                allProps.push({
                  id: `${event.id}-${bookKey}-${marketKey}-${outcome.description}-${outcome.name}`,
                  player: outcome.description,
                  market: marketKey,
                  line: outcome.point,
                  outcome: outcome.name, // 'Over' or 'Under'
                  price: outcome.price,
                  bookKey: bookKey,
                  bookTitle: bookTitle,
                  game: `${event.home_team} vs ${event.away_team}`,
                  commence_time: event.commence_time
                });
              });
            }
          });
        });
      } catch (error) {
        console.warn(`Error processing event ${event.id}:`, error);
      }
    }

    // Cache the results
    cache[cacheKey] = { data: allProps, ts: Date.now() };
    res.setHeader('X-Cache', 'MISS');

    // Return ALL props - let the UI handle grouping and display
    res.json(allProps);

  } catch (error) {
    // Serve stale cache if available
    if (cache[cacheKey]) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json(cache[cacheKey].data);
    }
    console.error('Error fetching props:', error);
    res.status(500).json({ error: 'Failed to fetch props' });
  }
}
