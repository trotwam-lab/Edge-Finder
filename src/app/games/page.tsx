"use client";

import { useState } from "react";
import { useOdds } from "@/hooks/useOdds";
import { GameCard } from "@/components/dashboard/GameCard";
import { LoadingState } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { SPORTS } from "@/lib/sports-config";
import type { Sport } from "@/types";

export default function GamesPage() {
  const [selectedSport, setSelectedSport] = useState<Sport | undefined>();
  const { games, loading, error, refresh, lastUpdated } = useOdds({
    sport: selectedSport,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            All Games
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Browse all upcoming games with real-time odds from every major
            sportsbook.
          </p>
        </div>
        <button
          onClick={refresh}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Sport Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedSport(undefined)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
            !selectedSport
              ? "bg-brand-500 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
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
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
          >
            {sport.icon} {sport.label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="!p-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm text-red-500">{error}</p>
        </Card>
      )}

      {loading ? (
        <LoadingState message="Loading games..." />
      ) : games.length === 0 ? (
        <Card className="!p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No games found. Try selecting a different sport.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}
