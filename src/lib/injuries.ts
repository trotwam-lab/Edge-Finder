import type { Injury, InjuryStatus, Sport, InjuryImpactAnalysis } from "@/types";

// ============================================================
// Injury Data Aggregator
// Fetches from multiple public sources to build a comprehensive
// injury picture. Uses caching to minimize requests.
// ============================================================

const injuryCache = new Map<string, { data: Injury[]; expires: number }>();
const INJURY_CACHE_TTL = 5 * 60_000; // 5 minutes

// Impact multiplier by position (how much a player's absence affects the line)
const POSITION_IMPACT: Record<string, number> = {
  // NFL
  QB: 10,
  RB: 6,
  WR: 5,
  TE: 4,
  OL: 4,
  DL: 4,
  LB: 5,
  CB: 5,
  S: 4,
  K: 2,
  P: 1,
  // NBA
  PG: 7,
  SG: 6,
  SF: 7,
  PF: 7,
  C: 8,
  G: 7,
  F: 7,
  // MLB
  SP: 9,
  RP: 4,
  CP: 5,
  "1B": 5,
  "2B": 5,
  "3B": 5,
  SS: 6,
  LF: 4,
  CF: 5,
  RF: 4,
  DH: 4,
  // NHL
  GK: 9,
  D: 6,
  LW: 5,
  RW: 5,
  // Default
  default: 5,
};

const STATUS_SEVERITY: Record<InjuryStatus, number> = {
  out: 1.0,
  doubtful: 0.8,
  questionable: 0.5,
  probable: 0.2,
  "day-to-day": 0.4,
};

export function calculateImpactRating(
  position: string,
  status: InjuryStatus
): number {
  const positionMultiplier = POSITION_IMPACT[position] ?? POSITION_IMPACT.default;
  const statusMultiplier = STATUS_SEVERITY[status];
  return Math.round(positionMultiplier * statusMultiplier);
}

// Fetch injuries from The Odds API's additional endpoints or public sources
export async function fetchInjuries(sport?: Sport): Promise<Injury[]> {
  const cacheKey = sport ?? "all";
  const cached = injuryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  // Use ESPN's public injury data as a baseline source
  const injuries = await fetchESPNInjuries(sport);

  injuryCache.set(cacheKey, { data: injuries, expires: Date.now() + INJURY_CACHE_TTL });
  return injuries;
}

async function fetchESPNInjuries(sport?: Sport): Promise<Injury[]> {
  const sportMap: Record<string, string> = {
    americanfootball_nfl: "football/nfl",
    basketball_nba: "basketball/nba",
    baseball_mlb: "baseball/mlb",
    icehockey_nhl: "hockey/nhl",
    basketball_ncaab: "basketball/mens-college-basketball",
    americanfootball_ncaaf: "football/college-football",
  };

  const sports = sport
    ? [{ key: sport, path: sportMap[sport] }]
    : Object.entries(sportMap).map(([key, path]) => ({ key, path }));

  const allInjuries: Injury[] = [];

  for (const { key, path } of sports) {
    if (!path) continue;
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/${path}/injuries`;
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;

      const data = await res.json();

      // Parse ESPN injury format
      if (data.items) {
        for (const teamData of data.items) {
          const teamName =
            teamData.team?.displayName ?? teamData.team?.name ?? "Unknown";

          for (const player of teamData.injuries ?? []) {
            const status = mapESPNStatus(
              player.status ?? player.type?.name ?? "Unknown"
            );
            const position = player.athlete?.position?.abbreviation ?? "default";

            allInjuries.push({
              id: `espn-${player.athlete?.id ?? Math.random().toString(36).slice(2)}`,
              playerName:
                player.athlete?.displayName ??
                player.athlete?.fullName ??
                "Unknown Player",
              team: teamName,
              sport: key as Sport,
              position,
              status,
              injuryType: player.type?.name ?? player.details?.type ?? "Undisclosed",
              description:
                player.longComment ??
                player.shortComment ??
                `${status} - ${player.type?.name ?? "injury"}`,
              reportDate: player.date ?? new Date().toISOString(),
              impactRating: calculateImpactRating(position, status),
              source: "ESPN",
              lastUpdated: new Date().toISOString(),
            });
          }
        }
      }
    } catch {
      // Source unavailable, continue with others
    }
  }

  return allInjuries;
}

function mapESPNStatus(status: string): InjuryStatus {
  const lower = status.toLowerCase();
  if (lower.includes("out")) return "out";
  if (lower.includes("doubtful")) return "doubtful";
  if (lower.includes("questionable")) return "questionable";
  if (lower.includes("probable")) return "probable";
  if (lower.includes("day-to-day") || lower.includes("dtd")) return "day-to-day";
  return "questionable";
}

// ============================================================
// Injury Impact Analysis
// ============================================================

export function analyzeInjuryImpact(
  gameId: string,
  homeTeam: string,
  awayTeam: string,
  injuries: Injury[]
): InjuryImpactAnalysis {
  const gameInjuries = injuries.filter(
    (i) => i.team === homeTeam || i.team === awayTeam
  );

  const homeInjuries = gameInjuries.filter((i) => i.team === homeTeam);
  const awayInjuries = gameInjuries.filter((i) => i.team === awayTeam);

  const homeImpact = homeInjuries.reduce((sum, i) => sum + i.impactRating, 0);
  const awayImpact = awayInjuries.reduce((sum, i) => sum + i.impactRating, 0);
  const totalImpact = homeImpact + awayImpact;

  const impactDiff = homeImpact - awayImpact;
  // Rough estimate: every 5 impact points = ~1 point on the spread
  const lineShiftExpected = impactDiff * 0.2;

  let recommendation = "No significant injury edge detected.";
  if (Math.abs(impactDiff) >= 10) {
    const favoredTeam = impactDiff > 0 ? awayTeam : homeTeam;
    recommendation = `Strong injury edge favoring ${favoredTeam}. Consider betting ${favoredTeam} spread/ML if line hasn't adjusted.`;
  } else if (Math.abs(impactDiff) >= 5) {
    const favoredTeam = impactDiff > 0 ? awayTeam : homeTeam;
    recommendation = `Moderate injury edge for ${favoredTeam}. Monitor line movement for value.`;
  }

  return {
    gameId,
    injuries: gameInjuries,
    totalImpact,
    lineShiftExpected,
    affectedMarkets: ["h2h", "spreads", "totals"],
    recommendation,
  };
}

export function getHighImpactInjuries(
  injuries: Injury[],
  minImpact: number = 6
): Injury[] {
  return injuries
    .filter((i) => i.impactRating >= minImpact)
    .sort((a, b) => b.impactRating - a.impactRating);
}
