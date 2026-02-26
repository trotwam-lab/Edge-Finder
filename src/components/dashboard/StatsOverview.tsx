"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { Edge } from "@/types";

interface StatsOverviewProps {
  edges: Edge[];
  gamesCount: number;
  loading: boolean;
}

export function StatsOverview({ edges, gamesCount, loading }: StatsOverviewProps) {
  const arbCount = edges.filter((e) => e.type === "arbitrage").length;
  const pevCount = edges.filter((e) => e.type === "positive_ev").length;
  const steamCount = edges.filter((e) => e.type === "steam_move").length;
  const injuryCount = edges.filter((e) => e.type === "injury_impact").length;
  const extremeCount = edges.filter((e) => e.strength === "extreme").length;

  const stats = [
    {
      label: "Games Tracked",
      value: gamesCount,
      color: "text-brand-500",
      bg: "bg-brand-500/10",
    },
    {
      label: "Total Edges",
      value: edges.length,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      badge: extremeCount > 0 ? `${extremeCount} extreme` : undefined,
    },
    {
      label: "Arbitrage",
      value: arbCount,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
    {
      label: "Positive EV",
      value: pevCount,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Steam Moves",
      value: steamCount,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Injury Edges",
      value: injuryCount,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {stats.map((stat) => (
        <Card key={stat.label} className="!p-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {stat.label}
            </span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold ${stat.color}`}>
                {loading ? "-" : stat.value}
              </span>
              {stat.badge && (
                <Badge variant="danger" pulse>
                  {stat.badge}
                </Badge>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
