"use client";

import { useTheme } from "@/context/ThemeContext";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PLANS } from "@/lib/stripe";
import { formatCurrency } from "@/lib/format";
import type { SubscriptionTier } from "@/types";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500">Customize your Edge Finder experience.</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Theme
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["light", "dark", "system"] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setTheme(option)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                    theme === option
                      ? "border-brand-500 bg-brand-500/10 text-brand-600 dark:text-brand-400 ring-1 ring-brand-500"
                      : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <div className="text-lg mb-1">
                    {option === "light" ? "☀️" : option === "dark" ? "🌙" : "💻"}
                  </div>
                  <div className="capitalize">{option}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Currently using: <strong>{resolvedTheme}</strong> mode
            </p>
          </div>
        </div>
      </Card>

      {/* Subscription Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Plans</CardTitle>
        </CardHeader>

        <div className="grid md:grid-cols-3 gap-4">
          {(Object.entries(PLANS) as [SubscriptionTier, typeof PLANS[SubscriptionTier]][]).map(
            ([tier, plan]) => (
              <div
                key={tier}
                className={`rounded-lg border p-4 ${
                  tier === "pro"
                    ? "border-brand-500 ring-1 ring-brand-500 bg-brand-500/5"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>
                  {tier === "pro" && (
                    <Badge variant="edge">Popular</Badge>
                  )}
                </div>
                <div className="mb-3">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {plan.price === 0 ? "Free" : formatCurrency(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-gray-500">/month</span>
                  )}
                </div>
                <ul className="space-y-1.5 mb-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"
                    >
                      <span className="text-green-500 shrink-0">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    tier === "free"
                      ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                      : tier === "pro"
                      ? "bg-brand-500 text-white hover:bg-brand-600"
                      : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100"
                  }`}
                >
                  {tier === "free" ? "Current Plan" : `Upgrade to ${plan.name}`}
                </button>
              </div>
            )
          )}
        </div>
      </Card>

      {/* Data & API */}
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
        </CardHeader>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-300">Odds Data</span>
            <Badge variant="success">The Odds API</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-300">Injury Data</span>
            <Badge variant="success">ESPN</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600 dark:text-gray-300">Line History</span>
            <Badge variant="info">Local (Persistent)</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
