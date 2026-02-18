const API_KEY = process.env.ODDS_API_KEY;
const BASE_URL = 'https://api.the-odds-api.com/v4';

const cache = {};
const CACHE_TTL = 120000;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { sport = 'basketball_nba' } = req.query;
  const cacheKey = `props_${sport}`;
  const now = Date.now();

  if (cache[cacheKey] && (now - cache[cacheKey].timestamp < CACHE_TTL)) {
    return res.json(cache[cacheKey].data);
  }

  try {
    // Step 1: Get events for this sport
    const eventsRes = await fetch(`${BASE_URL}/sports/${sport}/events?apiKey=${API_KEY}`);
    if (!eventsRes.ok) return res.json([]);
    const events = await eventsRes.json();

    const allProps = [];

    // Step 2: Fetch props for up to 3 upcoming events
    for (const event of events.slice(0, 3)) {
      try {
        const oddsRes = await fetch(
          `${BASE_URL}/sports/${sport}/events/${event.id}/odds?apiKey=${API_KEY}&regions=us&markets=player_points,player_assists,player_rebounds&oddsFormat=american`
        );
        if (!oddsRes.ok) continue;
        const odds = await oddsRes.json();

        odds.bookmakers?.forEach(book => {
          book.markets?.forEach(market => {
            if (market.key.includes('player_')) {
              market.outcomes?.forEach(outcome => {
                allProps.push({
                  id: `${event.id}-${outcome.description}-${market.key}-${outcome.name}`,
                  player: outcome.description,
                  market: market.key,
                  line: outcome.point,
                  outcome: outcome.name,
                  price: outcome.price,
                  bookKey: book.key,
                  bookTitle: book.title,
                  game: `${event.away_team} @ ${event.home_team}`,
                  commence_time: event.commence_time
                });
              });
            }
          });
        });
      } catch (e) {
        console.warn(`Props fetch error for event ${event.id}:`, e.message);
      }
    }

    cache[cacheKey] = { data: allProps, timestamp: now };
    return res.json(allProps);
  } catch (e) {
    console.error('Props error:', e);
    return res.status(500).json({ error: e.message });
  }
}
