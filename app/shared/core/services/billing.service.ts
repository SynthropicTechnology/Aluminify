/**
 * Billing Service
 *
 * Implements the single-sync pattern: fetch current Stripe subscription state
 * and upsert it into the local database. Every webhook event type calls the
 * same syncStripeSubscriptionToLocal() function instead of applying incremental
 * updates.
 *
 * Also provides helper functions for Stripe v20+ API changes.
 */

import Stripe from "stripe";
import { getStripeClient } from "@/app/shared/core/services/stripe.service";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { logger } from "@/app/shared/core/services/logger.service";
import type { SubscriptionStatus, BillingInterval } from "@/app/shared/types/entities/subscription";

// ============================================================================
// Plan Mapping
// ============================================================================

type PlanoEnum = "basico" | "profissional" | "enterprise";

const planoMapping: Record<string, PlanoEnum> = {
  gratuito: "basico",
  nuvem: "profissional",
  personalizado: "enterprise",
};

// ============================================================================
// Helpers for Stripe v20+ API changes
// ============================================================================

/**
 * Extract subscription ID from invoice (Stripe v20+).
 * In Stripe v20, subscription moved to invoice.parent.subscription_details.
 */
export function getSubscriptionIdFromInvoice(
  invoice: Stripe.Invoice,
): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (subDetails?.subscription) {
    return typeof subDetails.subscription === "string"
      ? subDetails.subscription
      : subDetails.subscription.id;
  }
  return null;
}

/**
 * Get current period from subscription items (Stripe v20+).
 * Period dates moved from subscription root to items.
 */
function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    current_period_start: item?.current_period_start ?? 0,
    current_period_end: item?.current_period_end ?? 0,
  };
}

// ============================================================================
// Single-Sync Function
// ============================================================================

/**
 * Sync a Stripe subscription to the local database.
 *
 * This function implements the single-sync pattern:
 * 1. Fetches current state from Stripe via subscriptions.retrieve()
 * 2. Upserts the subscription in the local database
 * 3. Syncs the empresas.plano enum
 *
 * Every webhook event type calls this same function, ensuring the local
 * database always reflects the current Stripe state regardless of event
 * ordering or duplicate deliveries.
 *
 * @param stripeSubscriptionId - The Stripe subscription ID to sync
 * @param metadata - Optional metadata (empresa_id, plan_id) needed for new subscriptions
 */
export async function syncStripeSubscriptionToLocal(
  stripeSubscriptionId: string,
  metadata?: { empresa_id?: string; plan_id?: string },
): Promise<void> {
  const stripe = getStripeClient();
  const db = getDatabaseClient();

  // 1. Fetch current Stripe state
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const period = getSubscriptionPeriod(stripeSub);

  // 2. Resolve plan from Stripe price ID
  const currentPriceId = stripeSub.items.data[0]?.price?.id;
  let planId = metadata?.plan_id;
  let planSlug: string | undefined;

  if (currentPriceId) {
    const { data: matchingPlan } = await db
      .from("subscription_plans")
      .select("id, slug")
      .or(
        `stripe_price_id_monthly.eq.${currentPriceId},stripe_price_id_yearly.eq.${currentPriceId}`,
      )
      .maybeSingle();

    if (matchingPlan) {
      if (!planId) {
        planId = matchingPlan.id;
      }
      planSlug = matchingPlan.slug;
    }
  }

  // 3. Determine billing interval
  const interval: BillingInterval =
    (stripeSub.items.data[0]?.price?.recurring?.interval as BillingInterval) || "month";

  // 4. Get stripe_customer_id as string
  const stripeCustomerId =
    typeof stripeSub.customer === "string"
      ? stripeSub.customer
      : (stripeSub.customer as Stripe.Customer)?.id ?? "";

  // 5. Build subscription data
  const subscriptionData = {
    stripe_subscription_id: stripeSubscriptionId,
    stripe_customer_id: stripeCustomerId,
    status: stripeSub.status as SubscriptionStatus,
    billing_interval: interval === "year" ? ("year" as const) : ("month" as const),
    current_period_start: new Date(period.current_period_start * 1000).toISOString(),
    current_period_end: new Date(period.current_period_end * 1000).toISOString(),
    cancel_at: stripeSub.cancel_at
      ? new Date(stripeSub.cancel_at * 1000).toISOString()
      : null,
    canceled_at: stripeSub.canceled_at
      ? new Date(stripeSub.canceled_at * 1000).toISOString()
      : null,
    ...(planId ? { plan_id: planId } : {}),
    ...(metadata?.empresa_id ? { empresa_id: metadata.empresa_id } : {}),
  };

  // 6. Check if subscription exists locally
  const { data: existing } = await db
    .from("subscriptions")
    .select("id, empresa_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (existing) {
    // 7. Update existing subscription
    await db.from("subscriptions").update(subscriptionData).eq("id", existing.id);
  } else {
    // 8. Insert new subscription (requires empresa_id and plan_id)
    const empresaId = metadata?.empresa_id;
    if (!empresaId || !planId) {
      throw new Error(
        `Cannot create subscription without empresa_id and plan_id: ${stripeSubscriptionId}`,
      );
    }
    await db.from("subscriptions").insert({
      ...subscriptionData,
      empresa_id: empresaId,
      plan_id: planId,
    });
  }

  // 9. Sync empresas.plano enum
  const empresaId = existing?.empresa_id || metadata?.empresa_id;
  if (empresaId && planId) {
    // Get plan slug if we don't have it yet
    if (!planSlug) {
      const { data: plan } = await db
        .from("subscription_plans")
        .select("slug")
        .eq("id", planId)
        .single();

      planSlug = plan?.slug;
    }

    if (planSlug) {
      const planoValue: PlanoEnum = planoMapping[planSlug] || "profissional";
      await db.from("empresas").update({ plano: planoValue }).eq("id", empresaId);
    }
  }

  // 10. Log the sync result
  logger.info("billing", "Subscription synced", {
    stripe_subscription_id: stripeSubscriptionId,
    status: stripeSub.status,
    empresa_id: empresaId || "unknown",
  });
}
