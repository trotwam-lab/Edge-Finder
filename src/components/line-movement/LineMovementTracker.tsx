"use client";

import { useState } from "react";
import { useLineMovement } from "@/hooks/useLineMovement";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { formatDateTime, formatOdds } from "@/lib/format";
import { getSportIcon, getSportLabel } from "@/lib/sports-config";
import { SPORTS } from "@/lib/sports-config";
import { LineChart } from "./LineChart";
import type { LineMovement, Sport } from "@/types";

type FilterMode = "all" | "steam" | "reverse" | "significant";

export function LineMovementTracker() {
  const [selectedSport, setSelectedSport] = useState<Sport | undefined>();
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [expandedGame, setExpandedGame] = useState<string | null>(null);

  const { movements, loading, error, refresh, recordSnapshots } =
    useLineMovement({
      sport: selectedSport,
      filter: filterMode === "all" ? undefined : filterMode,
    });

  if (loading) return <LoadingState message="Loading line movement data..." />;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <Card className="!p-4 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 dark:from-blue-500/10 dark:to-indigo-500/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Extended Line Movement Tracking
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Line history is persisted to disk and accumulates over time — not
              limited to your current session. Snapshots are recorded
              automatically and on each visit.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="info">{movements.length} tracked</Badge>
            <button
              onClick={() => {
                if (selectedSport) recordSnapshots(selectedSport);
              }}
              disabled={!selectedSport}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Record Snapshot
            </button>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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

        <div className="flex items-center gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "steam", label: "Steam Moves" },
              { key: "reverse", label: "Reverse Line" },
              { key: "significant", label: "Significant" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFilterMode(filter.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filterMode === filter.key
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors whitespace-nowrap"
        >
          Refresh
        </button>
      </div>

      {error && (
        <Card className="!p-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm text-red-500">{error}</p>
        </Card>
      )}

      {/* Movement List */}
      {movements.length === 0 ? (
        <Card className="!p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No line movement data recorded yet. Select a sport and click
            &quot;Record Snapshot&quot; to start tracking, or wait for
            automatic recording.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {movements.map((movement) => (
            <LineMovementCard
              key={movement.gameId}
              movement={movement}
              expanded={expandedGame === movement.gameId}
              onToggle={() =>
                setExpandedGame(
                  expandedGame === movement.gameId ? null : movement.gameId
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LineMovementCard({
  movement,
  expanded,
  onToggle,
}: {
  movement: LineMovement;
  expanded: boolean;
  onToggle: () => void;
}) {
  const movementAbs = Math.abs(movement.totalMovement ?? 0);
  const isSignificant = movementAbs >= 1;

  return (
    <Card onClick={onToggle} className={expanded ? "ring-1 ring-brand-500/30" : ""}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-lg">{getSportIcon(movement.sport)}</span>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {movement.awayTeam} @ {movement.homeTeam}
            </div>
            <div className="text-xs text-gray-500">
              {formatDateTime(movement.commenceTime)} · {movement.snapshots.length} snapshots
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {movement.steamMove && (
            <Badge variant="warning" pulse>
              STEAM
            </Badge>
          )}
          {movement.reverseLineMove && (
            <Badge variant="info" pulse>
              RLM
            </Badge>
          )}
          <div className="text-right">
            <div
              className={`text-lg font-bold font-mono ${
                movementAbs === 0
                  ? "text-gray-400"
                  : movement.direction === "home"
                  ? "text-blue-500"
                  : movement.direction === "away"
                  ? "text-orange-500"
                  : "text-gray-400"
              }`}
            >
              {movement.totalMovement !== undefined && movement.totalMovement > 0 ? "+" : ""}
              {movement.totalMovement?.toFixed(1) ?? "0.0"}
            </div>
            <div className="text-xs text-gray-400">
              {movement.direction === "stable" ? "stable" : `→ ${movement.direction}`}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded: Show chart and snapshot history */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 animate-slide-in">
          {/* Line Chart */}
          <LineChart snapshots={movement.snapshots} />

          {/* Opening vs Current */}
          <div className="grid grid-cols-2 gap-4 mt-4">
            {movement.openingLine && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <div className="text-xs text-gray-500 mb-1">Opening Line</div>
                {movement.openingLine.outcomes.map((o, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{o.name}</span>
                    <span className="font-mono">
                      {o.point !== undefined && (
                        <span className="text-gray-400 mr-2">
                          {o.point > 0 ? "+" : ""}{o.point}
                        </span>
                      )}
                      {formatOdds(o.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {movement.currentLine && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3">
                <div className="text-xs text-gray-500 mb-1">Current Line</div>
                {movement.currentLine.outcomes.map((o, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{o.name}</span>
                    <span className="font-mono">
                      {o.point !== undefined && (
                        <span className="text-gray-400 mr-2">
                          {o.point > 0 ? "+" : ""}{o.point}
                        </span>
                      )}
                      {formatOdds(o.price)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Snapshot History */}
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Full History ({movement.snapshots.length} snapshots)
            </h4>
            <div className="max-h-60 overflow-y-auto space-y-1">
              {movement.snapshots
                .slice()
                .reverse()
                .map((snap, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/30 rounded px-2 py-1.5"
                  >
                    <span className="text-gray-400">{formatDateTime(snap.timestamp)}</span>
                    <span className="text-gray-500">{snap.bookmaker}</span>
                    <div className="flex gap-3">
                      {snap.outcomes.map((o, j) => (
                        <span key={j} className="font-mono text-gray-600 dark:text-gray-300">
                          {o.name.slice(0, 12)}{" "}
                          {o.point !== undefined ? `${o.point > 0 ? "+" : ""}${o.point} ` : ""}
                          ({formatOdds(o.price)})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
