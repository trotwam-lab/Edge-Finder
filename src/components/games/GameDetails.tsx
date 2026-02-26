"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatOdds, formatDateTime, injuryStatusColor } from "@/lib/format";
import { getSportIcon } from "@/lib/sports-config";
import type { Game, Injury, Edge } from "@/types";

interface GameDetailsProps {
  game: Game;
  injuries: Injury[];
  edges: Edge[];
}

export function GameDetails({ game, injuries, edges }: GameDetailsProps) {
  const homeInjuries = injuries.filter((i) => i.team === game.homeTeam);
  const awayInjuries = injuries.filter((i) => i.team === game.awayTeam);

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <Card className="!p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{getSportIcon(game.sport)}</span>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {game.awayTeam} @ {game.homeTeam}
            </h1>
            <p className="text-sm text-gray-500">{formatDateTime(game.commenceTime)}</p>
          </div>
          {edges.length > 0 && (
            <Badge variant="edge" pulse>
              {edges.length} edge{edges.length !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </Card>

      {/* Odds Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Odds Comparison</CardTitle>
          <Badge variant="default">{game.bookmakers.length} bookmakers</Badge>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">
                  Book
                </th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                  {game.awayTeam} ML
                </th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                  {game.homeTeam} ML
                </th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                  {game.awayTeam} Spread
                </th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                  {game.homeTeam} Spread
                </th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                  Over
                </th>
                <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">
                  Under
                </th>
              </tr>
            </thead>
            <tbody>
              {game.bookmakers.map((book) => {
                const h2h = book.markets.find((m) => m.key === "h2h");
                const spreads = book.markets.find((m) => m.key === "spreads");
                const totals = book.markets.find((m) => m.key === "totals");

                const awayML = h2h?.outcomes.find((o) => o.name === game.awayTeam);
                const homeML = h2h?.outcomes.find((o) => o.name === game.homeTeam);
                const awaySpread = spreads?.outcomes.find((o) => o.name === game.awayTeam);
                const homeSpread = spreads?.outcomes.find((o) => o.name === game.homeTeam);
                const over = totals?.outcomes.find((o) => o.name === "Over");
                const under = totals?.outcomes.find((o) => o.name === "Under");

                return (
                  <tr
                    key={book.key}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {book.title}
                    </td>
                    <OddsCell outcome={awayML} />
                    <OddsCell outcome={homeML} />
                    <OddsCell outcome={awaySpread} showPoint />
                    <OddsCell outcome={homeSpread} showPoint />
                    <OddsCell outcome={over} showPoint />
                    <OddsCell outcome={under} showPoint />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Injury Report */}
      {(homeInjuries.length > 0 || awayInjuries.length > 0) && (
        <div className="grid md:grid-cols-2 gap-4">
          <InjuryPanel team={game.awayTeam} injuries={awayInjuries} />
          <InjuryPanel team={game.homeTeam} injuries={homeInjuries} />
        </div>
      )}
    </div>
  );
}

function OddsCell({
  outcome,
  showPoint,
}: {
  outcome?: { name: string; price: number; point?: number };
  showPoint?: boolean;
}) {
  if (!outcome) {
    return <td className="text-center py-2 px-3 text-gray-300 dark:text-gray-600">-</td>;
  }

  return (
    <td className="text-center py-2 px-3">
      {showPoint && outcome.point !== undefined && (
        <span className="text-gray-400 mr-1 text-xs">
          {outcome.point > 0 ? "+" : ""}
          {outcome.point}
        </span>
      )}
      <span
        className={`font-mono font-semibold ${
          outcome.price > 0
            ? "text-green-600 dark:text-green-400"
            : "text-gray-700 dark:text-gray-300"
        }`}
      >
        {formatOdds(outcome.price)}
      </span>
    </td>
  );
}

function InjuryPanel({ team, injuries }: { team: string; injuries: Injury[] }) {
  if (injuries.length === 0) return null;

  const totalImpact = injuries.reduce((sum, i) => sum + i.impactRating, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="!text-base">{team} Injuries</CardTitle>
        <span
          className={`text-sm font-bold ${
            totalImpact >= 15
              ? "text-red-500"
              : totalImpact >= 8
              ? "text-orange-500"
              : "text-yellow-500"
          }`}
        >
          Impact: {totalImpact}
        </span>
      </CardHeader>

      <div className="space-y-2">
        {injuries.map((inj) => (
          <div
            key={inj.id}
            className="flex items-center justify-between gap-2 text-sm"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                  inj.impactRating >= 8
                    ? "bg-red-500"
                    : inj.impactRating >= 5
                    ? "bg-orange-500"
                    : "bg-yellow-500"
                }`}
              >
                {inj.impactRating}
              </div>
              <span className="text-gray-900 dark:text-white truncate">
                {inj.playerName}
              </span>
              <span className="text-xs text-gray-400">{inj.position}</span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${injuryStatusColor(
                inj.status
              )}`}
            >
              {inj.status}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
