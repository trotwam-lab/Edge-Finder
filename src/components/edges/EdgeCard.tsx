"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  formatOdds,
  formatPercentage,
  formatDateTime,
  formatTimeAgo,
  edgeStrengthColor,
  edgeStrengthBg,
} from "@/lib/format";
import { getSportIcon } from "@/lib/sports-config";
import type { Edge, ArbitrageOpportunity } from "@/types";

interface EdgeCardProps {
  edge: Edge;
  expanded?: boolean;
  onToggle?: () => void;
}

const EDGE_TYPE_LABELS: Record<string, string> = {
  arbitrage: "Arbitrage",
  positive_ev: "+EV",
  steam_move: "Steam Move",
  reverse_line: "Reverse Line",
  closing_line_value: "CLV",
  injury_impact: "Injury Edge",
  public_fade: "Public Fade",
  sharp_money: "Sharp Money",
};

const EDGE_TYPE_VARIANTS: Record<string, "success" | "info" | "warning" | "danger"> = {
  arbitrage: "success",
  positive_ev: "info",
  steam_move: "warning",
  reverse_line: "warning",
  injury_impact: "danger",
  public_fade: "info",
  sharp_money: "success",
  closing_line_value: "info",
};

export function EdgeCard({ edge, expanded = false, onToggle }: EdgeCardProps) {
  const isArbitrage = edge.type === "arbitrage";
  const arb = isArbitrage ? (edge as ArbitrageOpportunity) : null;

  return (
    <Card
      className={`border ${edgeStrengthBg(edge.strength)} ${
        edge.strength === "extreme" ? "animate-pulse-glow" : ""
      }`}
      onClick={onToggle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">{getSportIcon(edge.sport)}</span>
          <Badge variant={EDGE_TYPE_VARIANTS[edge.type] ?? "default"}>
            {EDGE_TYPE_LABELS[edge.type] ?? edge.type}
          </Badge>
          <span className={`text-xs font-bold uppercase ${edgeStrengthColor(edge.strength)}`}>
            {edge.strength}
          </span>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold text-green-500">
            +{formatPercentage(edge.profitPercentage)}
          </div>
          <div className="text-xs text-gray-500">{edge.confidence}% conf</div>
        </div>
      </div>

      {/* Teams */}
      <div className="mb-2">
        <div className="font-medium text-gray-900 dark:text-white">
          {edge.awayTeam} @ {edge.homeTeam}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatDateTime(edge.commenceTime)} · {edge.market}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        {edge.description}
      </p>

      {/* Outcomes */}
      {edge.outcomes.length > 0 && (
        <div className="space-y-1 mb-3">
          {edge.outcomes.map((outcome, i) => (
            <div
              key={i}
              className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2"
            >
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {outcome.selection}
                </span>
                <span className="text-xs text-gray-500 ml-2">
                  @ {outcome.bookmaker}
                </span>
              </div>
              <span className="font-mono text-sm font-semibold text-green-500">
                {formatOdds(outcome.odds)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Arbitrage Optimal Stakes */}
      {expanded && arb && arb.optimalStakes && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Optimal Stakes ($1000 base)
          </h4>
          <div className="space-y-1">
            {arb.optimalStakes.map((stake, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-600 dark:text-gray-300">
                  {stake.selection} @ {stake.bookmaker}
                </span>
                <span className="font-mono font-semibold text-gray-900 dark:text-white">
                  ${stake.stake.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              Guaranteed Profit:
            </span>
            <span className="text-lg font-bold text-green-500">
              +${(arb.guaranteedProfit * 10).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Injuries */}
      {expanded && edge.relatedInjuries && edge.relatedInjuries.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Related Injuries
          </h4>
          <div className="space-y-1">
            {edge.relatedInjuries.map((injury) => (
              <div key={injury.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-gray-900 dark:text-white">{injury.playerName}</span>
                  <span className="text-gray-500 ml-1">({injury.team})</span>
                </div>
                <Badge variant={injury.status === "out" ? "danger" : "warning"}>
                  {injury.status.toUpperCase()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs text-gray-400">
        <span>Detected {formatTimeAgo(edge.detectedAt)}</span>
        <span>{edge.bookmakers.join(", ")}</span>
      </div>
    </Card>
  );
}
