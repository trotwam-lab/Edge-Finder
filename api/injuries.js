// api/injuries.js — ESPN Injury Data Proxy
// Fetches from ESPN's unofficial injury endpoint and normalizes the response.
// NOTE: ESPN returns data under `items`, not `injuries`, at the top level.
// Cache TTL is 5 minutes — injuries change slowly relative to odds.

const cache = {};
const TTL = 5 * 60 * 1000; // 5 minutes

// Map sport keys to ESPN path format
const SPORT_PATH_MAP = {
    'basketball/nba': 'basketball/nba',
    'basketball_nba': 'basketball/nba',
    'americanfootball_nfl': 'football/nfl',
    'football/nfl': 'football/nfl',
    'baseball_mlb': 'baseball/mlb',
    'baseball/mlb': 'baseball/mlb',
    'icehockey_nhl': 'hockey/nhl',
    'hockey/nhl': 'hockey/nhl',
    'basketball_ncaab': 'basketball/mens-college-basketball',
    'americanfootball_ncaaf': 'football/college-football',
};

export default async function handler(req, res) {
    const { sport = 'basketball/nba' } = req.query;

  // Normalize sport key to ESPN path format
  const espnPath = SPORT_PATH_MAP[sport] || sport;
    const cacheKey = `injuries-${espnPath}`;

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < TTL) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json(cache[cacheKey].data);
  }

  try {
        const url = `https://site.api.espn.com/apis/site/v2/sports/${espnPath}/injuries`;
        const response = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000),
        });

      if (!response.ok) {
              return res.status(response.status).json({ error: `ESPN error: ${response.status}` });
      }

      const data = await response.json();

      // ESPN returns injuries under data.items (array of team objects), not data.injuries
      const normalized = [];
        const teams = data.items || data.injuries || [];

      teams.forEach(teamData => {
              const teamName = teamData.team?.displayName || teamData.team?.name || teamData.displayName || 'Unknown';
              const teamShort = teamName.split(' ').pop();

                          const playerInjuries = teamData.injuries || teamData.athletes || [];
              playerInjuries.forEach(injury => {
                        const playerName = injury.athlete?.displayName || injury.athlete?.fullName || 'Unknown Player';
                        const position = injury.athlete?.position?.abbreviation || 'N/A';
                        const status = injury.status || injury.type?.name || 'Unknown';
                        const injuryType = injury.type?.name || injury.details?.type || 'Undisclosed';
                        const description = injury.longComment || injury.shortComment || `${status} - ${injuryType}`;

                                             normalized.push({
                                                         id: injury.athlete?.id || `${teamName}-${playerName}`.replace(/\s+/g, '-').toLowerCase(),
                                                         playerName,
                                                         team: teamName,
                                                         teamShort,
                                                         position,
                                                         status,
                                                         injuryType,
                                                         description,
                                                         reportDate: injury.date || new Date().toISOString(),
                                                         source: 'ESPN',
                                             });
              });
      });

      const result = { items: teams, normalized, count: normalized.length };
        cache[cacheKey] = { data: result, ts: Date.now() };
        res.setHeader('X-Cache', 'MISS');
        return res.status(200).json(result);
  } catch (e) {
        // Return empty data rather than an error — callers treat empty as "unavailable"
      console.warn(`Injury fetch failed for ${espnPath}:`, e.message);
        return res.status(200).json({ items: [], normalized: [], count: 0, error: e.message });
  }
}
