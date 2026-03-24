import Stripe from "stripe";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { logger } from "@/app/shared/core/services/logger.service";
import { getStripeClient } from "@/app/shared/core/services/stripe.service";
import type {
  BillingInterval,
  SubscriptionStatus,
} from "@/app/shared/types/entities/subscription";

type PlanoEmpresa = "basico" | "profissional" | "enterprise";

const planoMapping: Record<string, PlanoEmpresa> = {
  gratuito: "basico",
  nuvem: "profissional",
  personalizado: "enterprise",
};

function toIso(timestamp?: number | null): string | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

function resolveBillingInterval(interval?: string | null): BillingInterval {
  return interval === "year" ? "year" : "month";
}

export function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const subDetails = invoice.parent?.subscription_details;
  if (!subDetails?.subscription) return null;

  return typeof subDetails.subscription === "string"
    ? subDetails.subscription
    : subDetails.subscription.id;
}

export async function syncStripeSubscriptionToLocal(
  stripeSubscriptionId: string,
  metadata?: { empresa_id?: string; plan_id?: string },
): Promise<void> {
  const stripe = getStripeClient();
  const db = getDatabaseClient();

  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);

  const currentPriceId = stripeSub.items.data[0]?.price?.id;
  const interval = stripeSub.items.data[0]?.price?.recurring?.interval;

  let resolvedPlanId = metadata?.plan_id;
  if (currentPriceId) {
    const { data: matchingPlan, error: matchingPlanError } = await db
      .from("subscription_plans")
      .select("id, slug")
      .or(
        `stripe_price_id_monthly.eq.${currentPriceId},stripe_price_id_yearly.eq.${currentPriceId}`,
      )
      .maybeSingle();

    if (matchingPlanError) {
      throw matchingPlanError;
    }

    if (matchingPlan?.id) {
      resolvedPlanId = matchingPlan.id;
    }
  }

  const stripeCustomerId =
    typeof stripeSub.customer === "string" ? stripeSub.customer : (stripeSub.customer?.id ?? "");

  const subscriptionData = {
    stripe_subscription_id: stripeSubscriptionId,
    stripe_customer_id: stripeCustomerId,
    status: stripeSub.status as SubscriptionStatus,
    billing_interval: resolveBillingInterval(interval),
    current_period_start: toIso(stripeSub.current_period_start),
    current_period_end: toIso(stripeSub.current_period_end),
    cancel_at: toIso(stripeSub.cancel_at),
    canceled_at: toIso(stripeSub.canceled_at),
    ...(resolvedPlanId ? { plan_id: resolvedPlanId } : {}),
    ...(metadata?.empresa_id ? { empresa_id: metadata.empresa_id } : {}),
  };

  const { data: existing, error: existingError } = await db
    .from("subscriptions")
    .select("id, empresa_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { error: updateError } = await db
      .from("subscriptions")
      .update(subscriptionData)
      .eq("id", existing.id);

    if (updateError) {
      throw updateError;
    }
  } else {
    if (!metadata?.empresa_id || !resolvedPlanId) {
      throw new Error(
        `Cannot create subscription without empresa_id and plan_id: ${stripeSubscriptionId}`,
      );
    }

    const { error: insertError } = await db.from("subscriptions").insert({
      ...subscriptionData,
      empresa_id: metadata.empresa_id,
      plan_id: resolvedPlanId,
    });

    if (insertError) {
      throw insertError;
    }
  }

  const empresaId = existing?.empresa_id ?? metadata?.empresa_id;
  if (empresaId && resolvedPlanId) {
    const { data: plan, error: planError } = await db
      .from("subscription_plans")
      .select("slug")
      .eq("id", resolvedPlanId)
      .single();

    if (planError) {
      throw planError;
    }

    const plano = planoMapping[plan.slug] ?? "profissional";

    const { error: empresaError } = await db
      .from("empresas")
      .update({ plano })
      .eq("id", empresaId);

    if (empresaError) {
      throw empresaError;
    }
  }

  logger.info("billing", "Subscription synced", {
    stripe_subscription_id: stripeSubscriptionId,
    status: stripeSub.status,
    empresa_id: existing?.empresa_id ?? metadata?.empresa_id ?? null,
  });
}