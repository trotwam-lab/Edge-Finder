"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatOdds } from "@/lib/format";
import type { Game, Bookmaker } from "@/types";

interface PropsViewProps {
  game: Game;
}

export function PropsView({ game }: PropsViewProps) {
  // Group all available markets across bookmakers
  const marketMap = new Map<
    string,
    { bookmaker: string; outcomes: { name: string; price: number; point?: number; description?: string }[] }[]
  >();

  for (const book of game.bookmakers) {
    for (const market of book.markets) {
      const existing = marketMap.get(market.key) ?? [];
      existing.push({
        bookmaker: book.title,
        outcomes: market.outcomes,
      });
      marketMap.set(market.key, existing);
    }
  }

  const markets = Array.from(marketMap.entries());

  if (markets.length === 0) {
    return (
      <Card className="!p-8 text-center">
        <p className="text-gray-500">No prop/market data available for this game.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {markets.map(([marketKey, bookData]) => (
        <Card key={marketKey}>
          <CardHeader>
            <CardTitle className="!text-base capitalize">
              {marketKey.replace(/_/g, " ")}
            </CardTitle>
            <Badge variant="default">{bookData.length} books</Badge>
          </CardHeader>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 uppercase">
                    Book
                  </th>
                  {bookData[0]?.outcomes.map((outcome, i) => (
                    <th
                      key={i}
                      className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase"
                    >
                      {outcome.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookData.map((data, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 dark:border-gray-800"
                  >
                    <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                      {data.bookmaker}
                    </td>
                    {data.outcomes.map((outcome, i) => (
                      <td key={i} className="text-center py-2 px-3">
                        {outcome.point !== undefined && (
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
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
