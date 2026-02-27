"use client";

import { useState } from "react";
import { useInjuries } from "@/hooks/useInjuries";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { injuryStatusColor, formatTimeAgo, formatDate } from "@/lib/format";
import { getSportIcon } from "@/lib/sports-config";
import { SPORTS } from "@/lib/sports-config";
import type { Injury, Sport, InjuryStatus } from "@/types";

const STATUS_FILTERS: { key: InjuryStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "out", label: "Out" },
  { key: "doubtful", label: "Doubtful" },
  { key: "questionable", label: "Questionable" },
  { key: "probable", label: "Probable" },
  { key: "day-to-day", label: "Day-to-Day" },
];

export function InjuryTracker() {
  const [selectedSport, setSelectedSport] = useState<Sport | undefined>();
  const [statusFilter, setStatusFilter] = useState<InjuryStatus | "all">("all");
  const [highImpactOnly, setHighImpactOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { injuries, loading, error, refresh } = useInjuries({
    sport: selectedSport,
    highImpactOnly,
  });

  const filteredInjuries = injuries.filter((inj) => {
    if (statusFilter !== "all" && inj.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        inj.playerName.toLowerCase().includes(q) ||
        inj.team.toLowerCase().includes(q) ||
        inj.injuryType.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group injuries by team
  const byTeam = new Map<string, Injury[]>();
  for (const inj of filteredInjuries) {
    const existing = byTeam.get(inj.team) ?? [];
    existing.push(inj);
    byTeam.set(inj.team, existing);
  }

  if (loading) return <LoadingState message="Loading injury reports..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="!p-4 bg-gradient-to-r from-red-500/5 to-orange-500/5 dark:from-red-500/10 dark:to-orange-500/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Real-Time Injury Tracker
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Live injury data from ESPN and other sources. Impact ratings show
              how much each injury affects the betting line.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="danger">{filteredInjuries.length} injuries</Badge>
            <Badge variant="warning">
              {filteredInjuries.filter((i) => i.impactRating >= 7).length} high impact
            </Badge>
            <button
              onClick={refresh}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-col gap-3">
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

        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setStatusFilter(filter.key)}
                className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === filter.key
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* High Impact Toggle */}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={highImpactOnly}
              onChange={(e) => setHighImpactOnly(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-gray-600 dark:text-gray-400">High impact only</span>
          </label>

          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search players, teams..."
            className="flex-1 min-w-[200px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {error && (
        <Card className="!p-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm text-red-500">{error}</p>
        </Card>
      )}

      {/* Injuries by Team */}
      {byTeam.size === 0 ? (
        <Card className="!p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No injuries match your current filters.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(byTeam.entries())
            .sort(
              ([, a], [, b]) =>
                b.reduce((s, i) => s + i.impactRating, 0) -
                a.reduce((s, i) => s + i.impactRating, 0)
            )
            .map(([team, teamInjuries]) => (
              <TeamInjuryCard key={team} team={team} injuries={teamInjuries} />
            ))}
        </div>
      )}
    </div>
  );
}

function TeamInjuryCard({
  team,
  injuries,
}: {
  team: string;
  injuries: Injury[];
}) {
  const totalImpact = injuries.reduce((sum, i) => sum + i.impactRating, 0);
  const sport = injuries[0]?.sport;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {sport && <span>{getSportIcon(sport)}</span>}
          <h3 className="font-semibold text-gray-900 dark:text-white">{team}</h3>
          <Badge variant="default">{injuries.length} injuries</Badge>
        </div>
        <div className="text-right">
          <div className="text-sm">
            <span className="text-gray-500">Total Impact: </span>
            <span
              className={`font-bold ${
                totalImpact >= 15
                  ? "text-red-500"
                  : totalImpact >= 8
                  ? "text-orange-500"
                  : "text-yellow-500"
              }`}
            >
              {totalImpact}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {injuries
          .sort((a, b) => b.impactRating - a.impactRating)
          .map((injury) => (
            <div
              key={injury.id}
              className="flex items-center justify-between gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                {/* Impact indicator */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    injury.impactRating >= 8
                      ? "bg-red-500"
                      : injury.impactRating >= 5
                      ? "bg-orange-500"
                      : "bg-yellow-500"
                  }`}
                >
                  {injury.impactRating}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white truncate">
                      {injury.playerName}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {injury.position}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {injury.injuryType} · {injury.description}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${injuryStatusColor(
                    injury.status
                  )}`}
                >
                  {injury.status}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTimeAgo(injury.lastUpdated)}
                </span>
              </div>
            </div>
          ))}
      </div>
    </Card>
  );
}
