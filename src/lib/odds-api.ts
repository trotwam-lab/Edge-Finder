import type { Game, Sport, OddsApiResponse, MarketType } from "@/types";

const API_BASE = "https://api.the-odds-api.com/v4";

function getApiKey(): string {
    const key = process.env.ODDS_API_KEY;
    if (!key) throw new Error("ODDS_API_KEY environment variable is not set");
    return key;
}

// The free tier of the Odds API limits to a few recent games.
// We cycle through sports and markets to maximize coverage,
// and cache aggressively to stay within quota.
//
// API key is passed as a query parameter because The Odds API
// does not support header-based authentication. This is
// intentional — the key will appear in server-side request logs
// on Vercel but is never exposed to the browser/client.
//
// QUOTA WARNING: getAllActiveOdds() fires one request per sport
// (6 by default). Each call to /api/edges triggers getAllActiveOdds,
// so a single page load can consume 6 quota units. The 1-minute
// cache below helps within a single serverless instance, but
// cold starts on Vercel spawn fresh instances with empty caches.
// On the free tier (~500 requests/month), consider:
//   1. Reducing prioritySports to only active seasons
//   2. Adding a shared cache layer (e.g. Redis/Upstash)
//   3. Polling from a cron job and storing results in a DB

const responseCache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute cache

function getCached<T>(key: string): T | null {
    const entry = responseCache.get(key);
    if (entry && entry.expires > Date.now()) return entry.data as T;
    responseCache.delete(key);
    return null;
}

function setCache(key: string, data: unknown): void {
    responseCache.set(key, { data, expires: Date.now() + CACHE_TTL_MS });
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
          try {
                  const response = await fetch(url);
                  if (response.ok) return response;
                  if (response.status === 429 && attempt < retries) {
                            // Rate limited - back off
                    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
                            continue;
                  }
                  throw new Error(
                            `API returned ${response.status}: ${response.statusText}`
                          );
          } catch (err) {
                  if (attempt === retries) throw err;
                  await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
    }
    throw new Error("Max retries exceeded");
}

export async function getAvailableSports(): Promise<
{ key: string; group: string; title: string; active: boolean }[]
  > {
    const cacheKey = "sports";
    const cached = getCached<
    { key: string; group: string; title: string; active: boolean }[]
        >(cacheKey);
    if (cached) return cached;

  const url = `${API_BASE}/sports/?apiKey=${getApiKey()}`;
    const res = await fetchWithRetry(url);
    const data = await res.json();
    setCache(cacheKey, data);
    return data;
}

export async function getOdds(
    sport: Sport,
    markets: MarketType[] = ["h2h", "spreads", "totals"],
    regions: string = "us,us2,eu",
    oddsFormat: string = "american"
  ): Promise<Game[]> {
    const marketsStr = markets.join(",");
    const cacheKey = `odds:${sport}:${marketsStr}:${regions}`;
    const cached = getCached<Game[]>(cacheKey);
    if (cached) return cached;

  const url =
        `${API_BASE}/sports/${sport}/odds/` +
        `?apiKey=${getApiKey()}` +
        `&regions=${regions}` +
        `&markets=${marketsStr}` +
        `&oddsFormat=${oddsFormat}`;

  const res = await fetchWithRetry(url);
    const rawData: OddsApiResponse[] = await res.json();

  const games: Game[] = rawData.map((raw) => ({
        id: raw.id,
        sport: raw.sport_key as Sport,
        homeTeam: raw.home_team,
        awayTeam: raw.away_team,
        commenceTime: raw.commence_time,
        completed: false,
        bookmakers: raw.bookmakers.map((b) => ({
                key: b.key,
                title: b.title,
                lastUpdate: b.last_update,
                markets: b.markets.map((m) => ({
                          key: m.key as MarketType,
                          lastUpdate: m.last_update,
                          outcomes: m.outcomes.map((o) => ({
                                      name: o.name,
                                      price: o.price,
                                      point: o.point,
                                      description: o.description,
                          })),
                })),
        })),
  }));

  setCache(cacheKey, games);
    return games;
}

export async function getScores(
    sport: Sport,
    daysFrom: number = 3
  ): Promise<Game[]> {
    const cacheKey = `scores:${sport}:${daysFrom}`;
    const cached = getCached<Game[]>(cacheKey);
    if (cached) return cached;

  const url =
        `${API_BASE}/sports/${sport}/scores/` +
        `?apiKey=${getApiKey()}` +
        `&daysFrom=${daysFrom}`;

  const res = await fetchWithRetry(url);
    const rawData = await res.json();

  const games: Game[] = rawData.map(
        (
                raw: OddsApiResponse & {
                          completed?: boolean;
                          scores?: { name: string; score: string }[];
                }
              ) => ({
                      id: raw.id,
                      sport: raw.sport_key as Sport,
                      homeTeam: raw.home_team,
                      awayTeam: raw.away_team,
                      commenceTime: raw.commence_time,
                      completed: raw.completed ?? false,
                      scores: raw.scores
                        ? {
                                      home:
                                                      parseInt(
                                                                        raw.scores.find(
                                                                                            (s: { name: string }) => s.name === raw.home_team
                                                                                          )?.score ?? "0"
                                                                      ) || 0,
                                      away:
                                                      parseInt(
                                                                        raw.scores.find(
                                                                                            (s: { name: string }) => s.name === raw.away_team
                                                                                          )?.score ?? "0"
                                                                      ) || 0,
                        }
                                : undefined,
                      bookmakers: [],
              })
      );

  setCache(cacheKey, games);
    return games;
}

export async function getEventOdds(
    sport: Sport,
    eventId: string,
    markets: MarketType[] = ["h2h", "spreads", "totals"]
  ): Promise<Game | null> {
    const marketsStr = markets.join(",");
    const cacheKey = `event:${eventId}:${marketsStr}`;
    const cached = getCached<Game>(cacheKey);
    if (cached) return cached;

  const url =
        `${API_BASE}/sports/${sport}/events/${eventId}/odds` +
        `?apiKey=${getApiKey()}` +
        `&regions=us,us2,eu` +
        `&markets=${marketsStr}` +
        `&oddsFormat=american`;

  const res = await fetchWithRetry(url);
    if (!res.ok) return null;

  const raw: OddsApiResponse = await res.json();
    const game: Game = {
          id: raw.id,
          sport: raw.sport_key as Sport,
          homeTeam: raw.home_team,
          awayTeam: raw.away_team,
          commenceTime: raw.commence_time,
          completed: false,
          bookmakers: raw.bookmakers.map((b) => ({
                  key: b.key,
                  title: b.title,
                  lastUpdate: b.last_update,
                  markets: b.markets.map((m) => ({
                            key: m.key as MarketType,
                            lastUpdate: m.last_update,
                            outcomes: m.outcomes.map((o) => ({
                                        name: o.name,
                                        price: o.price,
                                        point: o.point,
                                        description: o.description,
                            })),
                  })),
          })),
    };

  setCache(cacheKey, game);
    return game;
}

// Fetch all active sports odds in parallel.
// See QUOTA WARNING above before adding more sports to this list.
export async function getAllActiveOdds(): Promise<Game[]> {
    const prioritySports: Sport[] = [
          "americanfootball_nfl",
          "basketball_nba",
          "baseball_mlb",
          "icehockey_nhl",
          "basketball_ncaab",
          "americanfootball_ncaaf",
        ];

  const results = await Promise.allSettled(
        prioritySports.map((sport) => getOdds(sport))
      );

  const allGames: Game[] = [];
    for (const result of results) {
          if (result.status === "fulfilled") {
                  allGames.push(...result.value);
          }
    }
    return allGames;
}
