"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatOdds, formatDateTime } from "@/lib/format";
import { getSportIcon } from "@/lib/sports-config";
import type { Game } from "@/types";
import Link from "next/link";

interface GameCardProps {
  game: Game;
  edgeCount?: number;
}

export function GameCard({ game, edgeCount = 0 }: GameCardProps) {
  // Get best odds for each side
  const h2hMarkets = game.bookmakers
    .flatMap((b) => b.markets.filter((m) => m.key === "h2h"))
    .flatMap((m) => m.outcomes);

  const homeOdds = h2hMarkets
    .filter((o) => o.name === game.homeTeam)
    .map((o) => o.price);
  const awayOdds = h2hMarkets
    .filter((o) => o.name === game.awayTeam)
    .map((o) => o.price);

  const bestHome = homeOdds.length > 0 ? Math.max(...homeOdds) : null;
  const bestAway = awayOdds.length > 0 ? Math.max(...awayOdds) : null;

  const spreadMarkets = game.bookmakers
    .flatMap((b) => b.markets.filter((m) => m.key === "spreads"))
    .flatMap((m) => m.outcomes);

  const homeSpread = spreadMarkets.find((o) => o.name === game.homeTeam);
  const awaySpread = spreadMarkets.find((o) => o.name === game.awayTeam);

  return (
    <Link href={`/games/${game.id}`}>
      <Card
        className="hover:border-brand-500/50 transition-all hover:shadow-lg hover:shadow-brand-500/5 group"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getSportIcon(game.sport)}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatDateTime(game.commenceTime)}
            </span>
          </div>
          {edgeCount > 0 && (
            <Badge variant="edge" pulse>
              {edgeCount} edge{edgeCount !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          {/* Away Team */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 dark:text-white truncate mr-2">
              {game.awayTeam}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {awaySpread && (
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {awaySpread.point !== undefined && awaySpread.point > 0 ? "+" : ""}
                  {awaySpread.point}
                </span>
              )}
              {bestAway !== null && (
                <span className={`font-mono text-sm font-semibold tabular-nums ${
                  bestAway > 0 ? "text-green-500" : "text-gray-700 dark:text-gray-300"
                }`}>
                  {formatOdds(bestAway)}
                </span>
              )}
            </div>
          </div>

          {/* Home Team */}
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 dark:text-white truncate mr-2">
              {game.homeTeam}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              {homeSpread && (
                <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  {homeSpread.point !== undefined && homeSpread.point > 0 ? "+" : ""}
                  {homeSpread.point}
                </span>
              )}
              {bestHome !== null && (
                <span className={`font-mono text-sm font-semibold tabular-nums ${
                  bestHome > 0 ? "text-green-500" : "text-gray-700 dark:text-gray-300"
                }`}>
                  {formatOdds(bestHome)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {game.bookmakers.length} book{game.bookmakers.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-brand-500 opacity-0 group-hover:opacity-100 transition-opacity">
            View Details →
          </span>
        </div>
      </Card>
    </Link>
  );
}
