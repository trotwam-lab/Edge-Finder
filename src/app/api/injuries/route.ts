import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchInjuries, getHighImpactInjuries, analyzeInjuryImpact } from "@/lib/injuries";
import type { Sport } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") as Sport | null;
    const team = searchParams.get("team");
    const highImpactOnly = searchParams.get("highImpact") === "true";
    const gameId = searchParams.get("gameId");
    const homeTeam = searchParams.get("homeTeam");
    const awayTeam = searchParams.get("awayTeam");

    let injuries = await fetchInjuries(sport ?? undefined);

    if (team) {
      injuries = injuries.filter(
        (i) => i.team.toLowerCase().includes(team.toLowerCase())
      );
    }

    if (highImpactOnly) {
      injuries = getHighImpactInjuries(injuries);
    }

    // If gameId and teams provided, return impact analysis
    if (gameId && homeTeam && awayTeam) {
      const analysis = analyzeInjuryImpact(gameId, homeTeam, awayTeam, injuries);
      return NextResponse.json({ injuries, analysis });
    }

    return NextResponse.json({
      injuries,
      count: injuries.length,
      sport: sport ?? "all",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch injuries";
    return NextResponse.json(
      { error: "injuries_fetch_failed", message },
      { status: 500 }
    );
  }
}
