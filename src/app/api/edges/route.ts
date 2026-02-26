import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAllActiveOdds, getOdds } from "@/lib/odds-api";
import {
  findAllEdges,
  detectArbitrage,
  detectPositiveEV,
} from "@/lib/edge-calculator";
import { getAllMovements } from "@/lib/line-storage";
import { fetchInjuries } from "@/lib/injuries";
import type { Sport, Edge } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get("sport") as Sport | null;
    const edgeType = searchParams.get("type");
    const minProfit = parseFloat(searchParams.get("minProfit") ?? "0");
    const minConfidence = parseFloat(searchParams.get("minConfidence") ?? "0");

    // Fetch all data in parallel
    const gamesPromise = sport ? getOdds(sport) : getAllActiveOdds();
    const movementsPromise = getAllMovements();
    const injuriesPromise = fetchInjuries(sport ?? undefined);

    const [games, movements, injuries] = await Promise.all([
      gamesPromise,
      movementsPromise,
      injuriesPromise,
    ]);

    // Find all edges across all games
    let allEdges: Edge[] = [];
    for (const game of games) {
      const edges = findAllEdges(game, movements, injuries);
      allEdges.push(...edges);
    }

    // Apply filters
    if (edgeType) {
      allEdges = allEdges.filter((e) => e.type === edgeType);
    }
    if (minProfit > 0) {
      allEdges = allEdges.filter((e) => e.profitPercentage >= minProfit);
    }
    if (minConfidence > 0) {
      allEdges = allEdges.filter((e) => e.confidence >= minConfidence);
    }

    // Sort by best edges first
    allEdges.sort(
      (a, b) =>
        b.confidence * b.profitPercentage - a.confidence * a.profitPercentage
    );

    // Categorize edges
    const summary = {
      total: allEdges.length,
      arbitrage: allEdges.filter((e) => e.type === "arbitrage").length,
      positiveEV: allEdges.filter((e) => e.type === "positive_ev").length,
      steamMoves: allEdges.filter((e) => e.type === "steam_move").length,
      reverseLineMoves: allEdges.filter((e) => e.type === "reverse_line").length,
      injuryEdges: allEdges.filter((e) => e.type === "injury_impact").length,
      extreme: allEdges.filter((e) => e.strength === "extreme").length,
      strong: allEdges.filter((e) => e.strength === "strong").length,
    };

    return NextResponse.json({
      edges: allEdges,
      summary,
      gamesAnalyzed: games.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to find edges";
    return NextResponse.json(
      { error: "edge_detection_failed", message },
      { status: 500 }
    );
  }
}
