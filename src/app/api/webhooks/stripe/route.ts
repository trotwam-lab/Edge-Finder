export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import {
    hasProcessedEvent,
    markEventProcessed,
    mapPriceToTier,
} from "@/lib/stripe";
import type { StripeWebhookResult } from "@/lib/stripe";

// ============================================================
// Stripe Webhook Handler
// - Proper signature verification using raw body
// - Idempotency checking to prevent duplicate processing
// - Handles all relevant subscription lifecycle events
//
// TODO: All handler functions below currently log to console
// and return success without writing to a database. Before
// going live you MUST implement the database calls marked
// with TODO comments. Without them, subscription tiers are
// not persisted and will be lost on every cold start.
// ============================================================

function getStripe(): Stripe {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    return new Stripe(key, { apiVersion: "2023-10-16" });
}

function getWebhookSecret(): string {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");
    return secret;
}

export async function POST(request: NextRequest) {
    const stripe = getStripe();
    const webhookSecret = getWebhookSecret();

  // Read the raw body for signature verification
  // CRITICAL: Must use raw body, not parsed JSON, for Stripe signature to verify
  const rawBody = await request.text();
    const signature = request.headers.get("stripe-signature");

  if (!signature) {
        return NextResponse.json(
          { error: "missing_signature", message: "No stripe-signature header" },
          { status: 400 }
              );
  }

  let event: Stripe.Event;
    try {
          event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
          const message =
                  err instanceof Error ? err.message : "Signature verification failed";
          console.error("Webhook signature verification failed:", message);
          return NextResponse.json(
            { error: "invalid_signature", message },
            { status: 400 }
                );
    }

  // Idempotency: skip already-processed events.
  // NOTE: This check is in-memory and will not catch duplicates across
  // different serverless instances. See stripe.ts for details.
  if (hasProcessedEvent(event.id)) {
        return NextResponse.json({ received: true, status: "already_processed" });
  }

  let result: StripeWebhookResult;
    try {
          result = await handleEvent(stripe, event);
          markEventProcessed(event.id);
    } catch (err) {
          const message =
                  err instanceof Error ? err.message : "Event processing failed";
          console.error(`Webhook processing error for ${event.type}:`, message);
          return NextResponse.json(
            { error: "processing_failed", message },
            { status: 500 }
                );
    }

  return NextResponse.json({ received: true, ...result });
}

async function handleEvent(
    stripe: Stripe,
    event: Stripe.Event
  ): Promise<StripeWebhookResult> {
    switch (event.type) {
      case "checkout.session.completed":
              return handleCheckoutComplete(
                        event.data.object as Stripe.Checkout.Session
                      );
      case "customer.subscription.created":
      case "customer.subscription.updated":
              return handleSubscriptionChange(
                        event.data.object as Stripe.Subscription
                      );
      case "customer.subscription.deleted":
              return handleSubscriptionCanceled(
                        event.data.object as Stripe.Subscription
                      );
      case "invoice.payment_succeeded":
              return handlePaymentSucceeded(event.data.object as Stripe.Invoice);
      case "invoice.payment_failed":
              return handlePaymentFailed(event.data.object as Stripe.Invoice);
      case "customer.subscription.trial_will_end":
              return handleTrialEnding(event.data.object as Stripe.Subscription);
      default:
              return { success: true, action: "ignored" };
    }
}

async function handleCheckoutComplete(
    session: Stripe.Checkout.Session
  ): Promise<StripeWebhookResult> {
    const customerId =
          typeof session.customer === "string"
        ? session.customer
            : session.customer?.id;

  if (!customerId) {
        return {
                success: false,
                action: "checkout_complete",
                error: "No customer ID",
        };
  }

  // TODO: Persist checkout completion to your user database.
  // Example: await db.users.update({ stripeCustomerId: customerId }, { checkoutCompleted: true });
  console.log(`Checkout completed for customer: ${customerId}`);

  return { success: true, action: "checkout_complete", customerId };
}

async function handleSubscriptionChange(
    subscription: Stripe.Subscription
  ): Promise<StripeWebhookResult> {
    const customerId =
          typeof subscription.customer === "string"
        ? subscription.customer
            : subscription.customer.id;

  const item = subscription.items.data[0];
    const amount = item?.price?.unit_amount ?? 0;
    const tier = mapPriceToTier(amount);

  // TODO: Update the user's subscription tier in your database.
  // Example: await db.users.update({ stripeCustomerId: customerId }, { tier, subscriptionStatus: subscription.status });
  console.log(
        `Subscription ${subscription.status} for ${customerId}: tier=${tier}`
      );

  return { success: true, action: "subscription_updated", customerId, tier };
}

async function handleSubscriptionCanceled(
    subscription: Stripe.Subscription
  ): Promise<StripeWebhookResult> {
    const customerId =
          typeof subscription.customer === "string"
        ? subscription.customer
            : subscription.customer.id;

  // TODO: Downgrade the user to the free tier in your database.
  // Example: await db.users.update({ stripeCustomerId: customerId }, { tier: "free", subscriptionStatus: "canceled" });
  console.log(`Subscription canceled for ${customerId}, downgrading to free`);

  return {
        success: true,
        action: "subscription_canceled",
        customerId,
        tier: "free",
  };
}

async function handlePaymentSucceeded(
    invoice: Stripe.Invoice
  ): Promise<StripeWebhookResult> {
    const customerId =
          typeof invoice.customer === "string"
        ? invoice.customer
            : invoice.customer?.id;

  // TODO: Log the successful payment and extend the subscription period if needed.
  console.log(`Payment succeeded for ${customerId}: ${invoice.amount_paid}`);

  return {
        success: true,
        action: "payment_succeeded",
        customerId: customerId ?? undefined,
  };
}

async function handlePaymentFailed(
    invoice: Stripe.Invoice
  ): Promise<StripeWebhookResult> {
    const customerId =
          typeof invoice.customer === "string"
        ? invoice.customer
            : invoice.customer?.id;

  // TODO: Mark the subscription as past_due in your database and trigger
  // a notification email or in-app warning to the user.
  // Example: await db.users.update({ stripeCustomerId: customerId }, { tier: "free", subscriptionStatus: "past_due" });
  console.error(`Payment failed for ${customerId}: ${invoice.id}`);

  return {
        success: true,
        action: "payment_failed",
        customerId: customerId ?? undefined,
        error: `Payment failed for invoice ${invoice.id}`,
  };
}

async function handleTrialEnding(
    subscription: Stripe.Subscription
  ): Promise<StripeWebhookResult> {
    const customerId =
          typeof subscription.customer === "string"
        ? subscription.customer
            : subscription.customer.id;

  // TODO: Send a "trial ending soon" notification email to the user.
  // Example: await emailService.sendTrialEndingEmail(customerId, subscription.trial_end);
  console.log(`Trial ending soon for ${customerId}`);

  return { success: true, action: "trial_ending", customerId };
}
