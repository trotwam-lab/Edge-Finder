"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GameDetails } from "@/components/games/GameDetails";
import { PropsView } from "@/components/games/PropsView";
import { EdgeCard } from "@/components/edges/EdgeCard";
import { LineChart } from "@/components/line-movement/LineChart";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LoadingState } from "@/components/ui/Spinner";
import type { Game, Edge, Injury, LineMovement } from "@/types";

export default function GameDetailPage() {
  const params = useParams();
  const gameId = params.id as string;

  const [game, setGame] = useState<Game | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [lineMovement, setLineMovement] = useState<LineMovement | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"odds" | "edges" | "movement" | "injuries">("odds");

  useEffect(() => {
    async function fetchAll() {
      try {
        // Fetch game, edges, injuries, and line movement in parallel
        const [oddsRes, edgesRes, lineRes] = await Promise.all([
          fetch(`/api/odds?type=all`),
          fetch(`/api/edges`),
          fetch(`/api/line-movement?gameId=${gameId}`),
        ]);

        if (oddsRes.ok) {
          const data = await oddsRes.json();
          const found = data.games?.find((g: Game) => g.id === gameId);
          if (found) {
            setGame(found);
            // Fetch injuries for this game's teams
            const injRes = await fetch(
              `/api/injuries?homeTeam=${encodeURIComponent(found.homeTeam)}&awayTeam=${encodeURIComponent(found.awayTeam)}&gameId=${gameId}`
            );
            if (injRes.ok) {
              const injData = await injRes.json();
              setInjuries(injData.injuries ?? []);
            }
          }
        }

        if (edgesRes.ok) {
          const data = await edgesRes.json();
          setEdges(
            (data.edges ?? []).filter((e: Edge) => e.gameId === gameId)
          );
        }

        if (lineRes.ok) {
          const data = await lineRes.json();
          if (data.gameId) setLineMovement(data);
        }
      } catch {
        // errors handled individually
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [gameId]);

  if (loading) return <LoadingState message="Loading game details..." />;

  if (!game) {
    return (
      <Card className="!p-12 text-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Game Not Found
        </h2>
        <p className="text-gray-500">
          This game may have already started or the ID is invalid.
        </p>
      </Card>
    );
  }

  const tabs = [
    { key: "odds", label: "Odds", count: game.bookmakers.length },
    { key: "edges", label: "Edges", count: edges.length },
    { key: "movement", label: "Line Movement", count: lineMovement?.snapshots.length ?? 0 },
    { key: "injuries", label: "Injuries", count: injuries.length },
  ] as const;

  return (
    <div className="space-y-6">
      <GameDetails game={game} injuries={injuries} edges={edges} />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "odds" && <PropsView game={game} />}

      {activeTab === "edges" && (
        <div className="space-y-4">
          {edges.length === 0 ? (
            <Card className="!p-8 text-center">
              <p className="text-gray-500">No edges detected for this game.</p>
            </Card>
          ) : (
            edges.map((edge) => <EdgeCard key={edge.id} edge={edge} expanded />)
          )}
        </div>
      )}

      {activeTab === "movement" && (
        <Card>
          <CardHeader>
            <CardTitle>Line Movement History</CardTitle>
            {lineMovement && (
              <Badge variant="info">{lineMovement.snapshots.length} snapshots</Badge>
            )}
          </CardHeader>
          {lineMovement ? (
            <>
              <LineChart snapshots={lineMovement.snapshots} />
              <div className="mt-4 max-h-60 overflow-y-auto space-y-1">
                {lineMovement.snapshots
                  .slice()
                  .reverse()
                  .map((snap, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800/30 rounded px-2 py-1.5"
                    >
                      <span className="text-gray-400">
                        {new Date(snap.timestamp).toLocaleString()}
                      </span>
                      <span className="text-gray-500">{snap.bookmaker}</span>
                      <div className="flex gap-3 font-mono">
                        {snap.outcomes.map((o, j) => (
                          <span key={j} className="text-gray-600 dark:text-gray-300">
                            {o.name.slice(0, 15)}{" "}
                            {o.point !== undefined ? `(${o.point > 0 ? "+" : ""}${o.point}) ` : ""}
                            {o.price > 0 ? "+" : ""}
                            {o.price}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-sm">
              No line movement data recorded for this game yet.
            </p>
          )}
        </Card>
      )}

      {activeTab === "injuries" && (
        <div className="space-y-4">
          {injuries.length === 0 ? (
            <Card className="!p-8 text-center">
              <p className="text-gray-500">No injuries reported for teams in this game.</p>
            </Card>
          ) : (
            injuries.map((injury) => (
              <Card key={injury.id} className="!p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        injury.impactRating >= 8
                          ? "bg-red-500"
                          : injury.impactRating >= 5
                          ? "bg-orange-500"
                          : "bg-yellow-500"
                      }`}
                    >
                      {injury.impactRating}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {injury.playerName}{" "}
                        <span className="text-xs text-gray-400">({injury.position})</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {injury.team} · {injury.injuryType}
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant={
                      injury.status === "out"
                        ? "danger"
                        : injury.status === "doubtful"
                        ? "warning"
                        : "default"
                    }
                  >
                    {injury.status.toUpperCase()}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
