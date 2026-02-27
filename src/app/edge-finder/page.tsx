"use client";

import { EdgeFinderView } from "@/components/edges/EdgeFinder";
import { ArbitrageCalculator } from "@/components/edges/ArbitrageCalculator";

export default function EdgeFinderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Edge Finder
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Detect arbitrage, positive EV, steam moves, reverse line movement, and
          injury-impacted edges across every game and market.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <EdgeFinderView />
        <div className="space-y-6">
          <ArbitrageCalculator />
        </div>
      </div>
    </div>
  );
}
