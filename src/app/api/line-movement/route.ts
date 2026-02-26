import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getAllMovements,
  getMovement,
  getMovementsBySport,
  getSignificantMovements,
  getSteamMoves,
  getReverseLineMoves,
  recordSnapshot,
} from "@/lib/line-storage";
import { getOdds } from "@/lib/odds-api";
import type { Sport } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get("gameId");
    const sport = searchParams.get("sport");
    const filter = searchParams.get("filter"); // "steam" | "reverse" | "significant"
    const minMovement = parseFloat(searchParams.get("minMovement") ?? "1");

    if (gameId) {
      const movement = await getMovement(gameId);
      if (!movement) {
        return NextResponse.json(
          { error: "not_found", message: "No line movement data for this game" },
          { status: 404 }
        );
      }
      return NextResponse.json(movement);
    }

    let movements;
    switch (filter) {
      case "steam":
        movements = await getSteamMoves();
        break;
      case "reverse":
        movements = await getReverseLineMoves();
        break;
      case "significant":
        movements = await getSignificantMovements(minMovement);
        break;
      default:
        movements = sport
          ? await getMovementsBySport(sport)
          : await getAllMovements();
    }

    return NextResponse.json({
      movements,
      count: movements.length,
      filter: filter ?? "all",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch line movement";
    return NextResponse.json(
      { error: "line_movement_failed", message },
      { status: 500 }
    );
  }
}

// POST: Trigger a snapshot recording for current odds
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sport = body.sport as Sport;

    if (!sport) {
      return NextResponse.json(
        { error: "missing_sport", message: "sport field is required" },
        { status: 400 }
      );
    }

    const games = await getOdds(sport);
    const movements = await Promise.all(
      games.map((game) => recordSnapshot(game))
    );

    return NextResponse.json({
      recorded: movements.length,
      movements,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record snapshot";
    return NextResponse.json(
      { error: "snapshot_failed", message },
      { status: 500 }
    );
  }
}
