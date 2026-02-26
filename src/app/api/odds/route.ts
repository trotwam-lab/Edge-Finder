import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getOdds, getAllActiveOdds, getScores } from "@/lib/odds-api";
import type { Sport } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") as Sport | null;
    const type = searchParams.get("type"); // "odds" | "scores" | "all"

    if (type === "scores" && sport) {
      const scores = await getScores(sport);
      return NextResponse.json({ games: scores, count: scores.length });
    }

    if (type === "all" || !sport) {
      const games = await getAllActiveOdds();
      return NextResponse.json({ games, count: games.length });
    }

    const markets = searchParams.get("markets")?.split(",") ?? [
      "h2h",
      "spreads",
      "totals",
    ];
    const games = await getOdds(sport, markets);
    return NextResponse.json({ games, count: games.length });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch odds";
    return NextResponse.json(
      { error: "odds_fetch_failed", message },
      { status: 500 }
    );
  }
}
