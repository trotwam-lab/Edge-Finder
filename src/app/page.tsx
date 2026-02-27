"use client";

import { useState } from "react";
import { useOdds } from "@/hooks/useOdds";
import { useEdges } from "@/hooks/useEdges";
import { StatsOverview } from "@/components/dashboard/StatsOverview";
import { GameCard } from "@/components/dashboard/GameCard";
import { EdgeCard } from "@/components/edges/EdgeCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { SPORTS } from "@/lib/sports-config";
import { formatTimeAgo } from "@/lib/format";
import type { Sport } from "@/types";

export default function DashboardPage() {
  const [selectedSport, setSelectedSport] = useState<Sport | undefined>();
  const { games, loading: gamesLoading, lastUpdated, refresh: refreshGames } = useOdds({
    sport: selectedSport,
    refreshInterval: 120,
  });
  const { edges, summary, loading: edgesLoading, refresh: refreshEdges } = useEdges({
    sport: selectedSport,
  });

  const loading = gamesLoading || edgesLoading;

  // Count edges per game
  const edgesByGame = new Map<string, number>();
  for (const edge of edges) {
    edgesByGame.set(edge.gameId, (edgesByGame.get(edge.gameId) ?? 0) + 1);
  }

  // Top edges to highlight
  const topEdges = edges.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time edge detection across all markets
            {lastUpdated && (
              <span className="ml-2">· Updated {formatTimeAgo(lastUpdated.toISOString())}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => {
            refreshGames();
            refreshEdges();
          }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
        >
          Refresh All
        </button>
      </div>

      {/* Stats Overview */}
      <StatsOverview
        edges={edges}
        gamesCount={games.length}
        loading={loading}
      />

      {/* Sport Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedSport(undefined)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            !selectedSport
              ? "bg-brand-500 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
          }`}
        >
          All Sports
        </button>
        {SPORTS.map((sport) => (
          <button
            key={sport.key}
            onClick={() => setSelectedSport(sport.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              selectedSport === sport.key
                ? "bg-brand-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {sport.icon} {sport.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState message="Analyzing games and finding edges..." />
      ) : (
        <>
          {/* Top Edges */}
          {topEdges.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Top Edges Right Now
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {topEdges.map((edge) => (
                  <EdgeCard key={edge.id} edge={edge} />
                ))}
              </div>
            </div>
          )}

          {/* Games Grid */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Upcoming Games ({games.length})
            </h2>
            {games.length === 0 ? (
              <Card className="!p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400">
                  No games found. Try selecting a different sport or check back later.
                </p>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {games.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    edgeCount={edgesByGame.get(game.id) ?? 0}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
