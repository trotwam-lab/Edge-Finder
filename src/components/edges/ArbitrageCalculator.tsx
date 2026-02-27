"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { americanToDecimal, impliedProbability } from "@/lib/edge-calculator";
import { formatOdds, formatCurrency, formatPercentage } from "@/lib/format";

interface Leg {
  label: string;
  odds: string;
  bookmaker: string;
}

export function ArbitrageCalculator() {
  const [legs, setLegs] = useState<Leg[]>([
    { label: "Outcome 1", odds: "", bookmaker: "" },
    { label: "Outcome 2", odds: "", bookmaker: "" },
  ]);
  const [totalStake, setTotalStake] = useState(1000);

  const calculation = useMemo(() => {
    const parsedOdds = legs.map((l) => {
      const n = parseFloat(l.odds);
      return isNaN(n) ? null : n;
    });

    if (parsedOdds.some((o) => o === null)) return null;

    const decimalOdds = parsedOdds.map((o) => americanToDecimal(o!));
    const impliedProbs = parsedOdds.map((o) => impliedProbability(o!));
    const totalImplied = impliedProbs.reduce((sum, p) => sum + p, 0);
    const isArbitrage = totalImplied < 1;
    const profitPct = isArbitrage ? (1 / totalImplied - 1) * 100 : 0;

    const stakes = decimalOdds.map((d) =>
      Math.round((totalStake / (d * totalImplied)) * 100) / 100
    );

    const payouts = decimalOdds.map((d, i) =>
      Math.round(stakes[i] * d * 100) / 100
    );

    const profits = payouts.map((p) => Math.round((p - totalStake) * 100) / 100);

    return {
      decimalOdds,
      impliedProbs,
      totalImplied,
      isArbitrage,
      profitPct,
      stakes,
      payouts,
      profits,
    };
  }, [legs, totalStake]);

  const addLeg = () => {
    if (legs.length >= 4) return;
    setLegs([...legs, { label: `Outcome ${legs.length + 1}`, odds: "", bookmaker: "" }]);
  };

  const removeLeg = (index: number) => {
    if (legs.length <= 2) return;
    setLegs(legs.filter((_, i) => i !== index));
  };

  const updateLeg = (index: number, field: keyof Leg, value: string) => {
    const updated = [...legs];
    updated[index] = { ...updated[index], [field]: value };
    setLegs(updated);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arbitrage Calculator</CardTitle>
      </CardHeader>

      {/* Stake Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Total Stake
        </label>
        <input
          type="number"
          value={totalStake}
          onChange={(e) => setTotalStake(parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Legs */}
      <div className="space-y-3 mb-4">
        {legs.map((leg, i) => (
          <div key={i} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Selection</label>
              <input
                type="text"
                value={leg.label}
                onChange={(e) => updateLeg(i, "label", e.target.value)}
                placeholder="Team/Outcome"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="w-28">
              <label className="block text-xs text-gray-500 mb-1">American Odds</label>
              <input
                type="text"
                value={leg.odds}
                onChange={(e) => updateLeg(i, "odds", e.target.value)}
                placeholder="+150"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 font-mono"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Bookmaker</label>
              <input
                type="text"
                value={leg.bookmaker}
                onChange={(e) => updateLeg(i, "bookmaker", e.target.value)}
                placeholder="DraftKings"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            {legs.length > 2 && (
              <button
                onClick={() => removeLeg(i)}
                className="px-2 py-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {legs.length < 4 && (
        <button
          onClick={addLeg}
          className="mb-4 text-sm text-brand-500 hover:text-brand-600 transition-colors"
        >
          + Add outcome
        </button>
      )}

      {/* Results */}
      {calculation && (
        <div className={`rounded-lg p-4 ${
          calculation.isArbitrage
            ? "bg-green-500/10 border border-green-500/30"
            : "bg-gray-50 dark:bg-gray-800/50"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-900 dark:text-white">
              {calculation.isArbitrage ? "ARBITRAGE FOUND" : "No Arbitrage"}
            </span>
            <span className={`text-xl font-bold ${
              calculation.isArbitrage ? "text-green-500" : "text-red-500"
            }`}>
              {calculation.isArbitrage
                ? `+${formatPercentage(calculation.profitPct)}`
                : formatPercentage((calculation.totalImplied - 1) * 100)}
            </span>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            Total implied probability: {formatPercentage(calculation.totalImplied * 100)}
          </div>

          <div className="space-y-2">
            {legs.map((leg, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{leg.label}</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-400">
                    Stake: {formatCurrency(calculation.stakes[i])}
                  </span>
                  <span className="text-xs text-gray-400">
                    Payout: {formatCurrency(calculation.payouts[i])}
                  </span>
                  <span className={`font-mono font-semibold ${
                    calculation.profits[i] >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {calculation.profits[i] >= 0 ? "+" : ""}
                    {formatCurrency(calculation.profits[i])}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
