"use client";

import { useState } from "react";
import { useEdges } from "@/hooks/useEdges";
import { EdgeCard } from "./EdgeCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import { SPORTS } from "@/lib/sports-config";
import type { EdgeType, Sport } from "@/types";

const EDGE_FILTERS: { key: EdgeType | "all"; label: string }[] = [
  { key: "all", label: "All Edges" },
  { key: "arbitrage", label: "Arbitrage" },
  { key: "positive_ev", label: "Positive EV" },
  { key: "steam_move", label: "Steam Moves" },
  { key: "reverse_line", label: "Reverse Line" },
  { key: "injury_impact", label: "Injury Impact" },
];

export function EdgeFinderView() {
  const [selectedSport, setSelectedSport] = useState<Sport | undefined>();
  const [selectedType, setSelectedType] = useState<EdgeType | "all">("all");
  const [expandedEdge, setExpandedEdge] = useState<string | null>(null);
  const [minProfit, setMinProfit] = useState(0);

  const { edges, summary, loading, error, gamesAnalyzed, refresh } = useEdges({
    sport: selectedSport,
    type: selectedType === "all" ? undefined : selectedType,
    minProfit,
  });

  if (loading) return <LoadingState message="Scanning for edges across all markets..." />;

  return (
    <div className="space-y-6">
      {/* Summary Bar */}
      {summary && (
        <Card className="!p-4 bg-gradient-to-r from-brand-500/5 to-purple-500/5 dark:from-brand-500/10 dark:to-purple-500/10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {summary.total} Edge{summary.total !== 1 ? "s" : ""} Found
              </h2>
              <p className="text-sm text-gray-500">
                Across {gamesAnalyzed} games analyzed
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {summary.extreme > 0 && (
                <Badge variant="danger" pulse>
                  {summary.extreme} EXTREME
                </Badge>
              )}
              {summary.strong > 0 && (
                <Badge variant="warning">
                  {summary.strong} strong
                </Badge>
              )}
              {summary.arbitrage > 0 && (
                <Badge variant="success">{summary.arbitrage} arbs</Badge>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
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

        {/* Edge Type Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {EDGE_FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setSelectedType(filter.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedType === filter.key
                  ? "bg-purple-500 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Min Profit Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Min profit:</label>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={minProfit}
            onChange={(e) => setMinProfit(parseFloat(e.target.value))}
            className="w-24"
          />
          <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
            {minProfit}%
          </span>
        </div>

        <button
          onClick={refresh}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-500 text-white hover:bg-brand-600 transition-colors whitespace-nowrap"
        >
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <Card className="!p-4 border-red-500/30 bg-red-500/5">
          <p className="text-sm text-red-500">{error}</p>
        </Card>
      )}

      {/* Edge List */}
      {edges.length === 0 ? (
        <Card className="!p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No edges found matching your filters. Try broadening your search.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {edges.map((edge) => (
            <EdgeCard
              key={edge.id}
              edge={edge}
              expanded={expandedEdge === edge.id}
              onToggle={() =>
                setExpandedEdge(expandedEdge === edge.id ? null : edge.id)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
