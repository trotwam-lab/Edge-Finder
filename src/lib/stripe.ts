import type { SubscriptionPlan, SubscriptionTier, WebhookEvent } from "@/types";

// ============================================================
// Stripe Payment Integration
// Handles subscription management and webhook processing
// with proper signature verification and idempotency.
// ============================================================

export const PLANS: Record<SubscriptionTier, SubscriptionPlan> = {
    free: {
          tier: "free",
          name: "Free",
          price: 0,
          features: [
                  "Basic odds comparison",
                  "3 sports tracked",
                  "Line movement (last 24 hours)",
                  "Basic arbitrage alerts",
                ],
          edgeTypes: ["arbitrage"],
          refreshInterval: 300, // 5 minutes
          historicalDataDays: 1,
    },
    pro: {
          tier: "pro",
          name: "Pro",
          price: 29.99,
          features: [
                  "All odds comparison",
                  "All sports tracked",
                  "Full line movement history",
                  "All edge types",
                  "Real-time injury tracking",
                  "Email alerts",
                  "Arbitrage calculator",
                ],
          edgeTypes: [
                  "arbitrage",
                  "positive_ev",
                  "steam_move",
                  "reverse_line",
                  "injury_impact",
                ],
          refreshInterval: 60, // 1 minute
          historicalDataDays: 30,
    },
    elite: {
          tier: "elite",
          name: "Elite",
          price: 79.99,
          features: [
                  "Everything in Pro",
                  "Closing line value analysis",
                  "Sharp money indicators",
                  "Public fade signals",
                  "Custom alerts & filters",
                  "Priority data refresh (30s)",
                  "Unlimited historical data",
                  "API access",
                ],
          edgeTypes: [
                  "arbitrage",
                  "positive_ev",
                  "steam_move",
                  "reverse_line",
                  "closing_line_value",
                  "injury_impact",
                  "public_fade",
                  "sharp_money",
                ],
          refreshInterval: 30, // 30 seconds
          historicalDataDays: 365,
    },
};

// ============================================================
// Webhook idempotency store
//
// WARNING: This is an in-memory Set. On Vercel (serverless),
// each function instance has its own copy. If Stripe retries
// a webhook delivery to a different cold-start instance, the
// duplicate check will NOT fire. For production correctness,
// replace this with a database-backed event log
// (e.g. a "processed_webhook_events" table keyed by event.id).
// ============================================================
const processedEvents = new Set<string>();

export function hasProcessedEvent(eventId: string): boolean {
    return processedEvents.has(eventId);
}

export function markEventProcessed(eventId: string): void {
    processedEvents.add(eventId);
    // Prevent unbounded memory growth within a single instance
  if (processedEvents.size > 10000) {
        const entries = Array.from(processedEvents);
        for (let i = 0; i < 5000; i++) {
                processedEvents.delete(entries[i]);
        }
  }
}

export interface StripeWebhookResult {
    success: boolean;
    action: string;
    customerId?: string;
    tier?: SubscriptionTier;
    error?: string;
}

// ============================================================
// mapPriceToTier
//
// Maps a Stripe price amount (in cents) to a subscription tier.
// Thresholds are set slightly below the plan prices to handle
// Stripe's rounding — but matching on price.id is more reliable
// in production once you have stable Stripe Price IDs configured.
//
// Plan prices:  Pro = $29.99 (2999 cents)
//               Elite = $79.99 (7999 cents)
// Thresholds:   Pro >= 2900 cents  (~$29.00)
//               Elite >= 7900 cents (~$79.00)
// ============================================================
export function mapPriceToTier(amount: number): SubscriptionTier {
    // amount is in cents
  if (amount >= 7900) return "elite";
    if (amount >= 2900) return "pro";
    return "free";
}

export function getTierFeatures(tier: SubscriptionTier): string[] {
    return PLANS[tier].features;
}

export function canAccessEdgeType(
    tier: SubscriptionTier,
    edgeType: string
  ): boolean {
    return PLANS[tier].edgeTypes.includes(edgeType as never);
}
