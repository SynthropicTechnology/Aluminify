import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import Stripe from "stripe";
import { getStripeClient } from "@/shared/core/services/stripe.service";

/**
 * Stripe Webhook Handler
 *
 * Receives webhook notifications from Stripe for subscription lifecycle events.
 *
 * Security:
 * - Stripe signature validated via stripe.webhooks.constructEvent()
 * - Uses global STRIPE_WEBHOOK_SECRET (single Stripe account for all tenants)
 *
 * URL: POST /api/webhooks/stripe
 *
 * Handled events:
 * - checkout.session.completed — New subscription created via checkout
 * - invoice.paid — Subscription renewal confirmed
 * - invoice.payment_failed — Payment failed, subscription at risk
 * - customer.subscription.updated — Plan change (upgrade/downgrade)
 * - customer.subscription.deleted — Subscription canceled
 */

function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase configuration");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ============================================================================
// Helpers for Stripe v20+ API changes
// ============================================================================

type PlanoEnum = "basico" | "profissional" | "enterprise";

const planoMapping: Record<string, PlanoEnum> = {
  gratuito: "basico",
  nuvem: "profissional",
  personalizado: "enterprise",
};

/** Extract subscription ID from invoice (Stripe v20: invoice.parent.subscription_details) */
function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice): string | undefined {
  // Stripe v20+: subscription moved to invoice.parent.subscription_details
  const subDetails = invoice.parent?.subscription_details;
  if (subDetails?.subscription) {
    return typeof subDetails.subscription === "string"
      ? subDetails.subscription
      : subDetails.subscription.id;
  }
  return undefined;
}

/** Get current period from subscription items (Stripe v20: moved from subscription to items) */
function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    current_period_start: item?.current_period_start ?? 0,
    current_period_end: item?.current_period_end ?? 0,
  };
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  db: ReturnType<typeof getServiceClient>
) {
  if (session.mode !== "subscription") {
    console.log("[Stripe Webhook] Ignoring non-subscription checkout session");
    return;
  }

  const empresaId = session.metadata?.empresa_id;
  const planId = session.metadata?.plan_id;
  const billingInterval = session.metadata?.billing_interval || "month";

  if (!empresaId || !planId) {
    console.error("[Stripe Webhook] Missing metadata in checkout session:", {
      empresa_id: empresaId,
      plan_id: planId,
    });
    return;
  }

  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id;

  if (!stripeSubscriptionId || !stripeCustomerId) {
    console.error("[Stripe Webhook] Missing subscription or customer ID");
    return;
  }

  // Idempotency: check if subscription already exists
  const { data: existing } = await db
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (existing) {
    console.log("[Stripe Webhook] Subscription already exists, skipping:", stripeSubscriptionId);
    return;
  }

  // Get subscription details from Stripe for period info
  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const period = getSubscriptionPeriod(stripeSubscription);

  // Create subscription record
  const { data: subscription, error: subError } = await db
    .from("subscriptions")
    .insert({
      empresa_id: empresaId,
      plan_id: planId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_customer_id: stripeCustomerId,
      status: "active",
      billing_interval: billingInterval as "month" | "year",
      current_period_start: new Date(period.current_period_start * 1000).toISOString(),
      current_period_end: new Date(period.current_period_end * 1000).toISOString(),
      last_payment_date: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (subError) {
    console.error("[Stripe Webhook] Error creating subscription:", subError);
    throw subError;
  }

  // Get plan slug to map to empresas.plano enum
  const { data: plan } = await db
    .from("subscription_plans")
    .select("slug")
    .eq("id", planId)
    .single();

  const planoValue: PlanoEnum = plan ? planoMapping[plan.slug] || "profissional" : "profissional";

  await db
    .from("empresas")
    .update({
      stripe_customer_id: stripeCustomerId,
      subscription_id: subscription.id,
      plano: planoValue,
    })
    .eq("id", empresaId);

  console.log("[Stripe Webhook] Subscription created:", {
    subscriptionId: subscription.id,
    empresaId,
    planId,
    stripeSubscriptionId,
  });
}

async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof getServiceClient>
) {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) return;

  const { data: subscription } = await db
    .from("subscriptions")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (!subscription) {
    console.log("[Stripe Webhook] No local subscription found for invoice.paid:", stripeSubscriptionId);
    return;
  }

  // Get updated period from Stripe
  const stripe = getStripeClient();
  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const period = getSubscriptionPeriod(stripeSubscription);

  await db
    .from("subscriptions")
    .update({
      status: "active",
      last_payment_date: new Date().toISOString(),
      last_payment_amount_cents: invoice.amount_paid,
      current_period_start: new Date(period.current_period_start * 1000).toISOString(),
      current_period_end: new Date(period.current_period_end * 1000).toISOString(),
      next_payment_date: new Date(period.current_period_end * 1000).toISOString(),
    })
    .eq("id", subscription.id);

  console.log("[Stripe Webhook] Invoice paid, subscription renewed:", {
    subscriptionId: subscription.id,
    amountPaid: invoice.amount_paid,
  });
}

async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  db: ReturnType<typeof getServiceClient>
) {
  const stripeSubscriptionId = getSubscriptionIdFromInvoice(invoice);
  if (!stripeSubscriptionId) return;

  await db
    .from("subscriptions")
    .update({ status: "past_due" })
    .eq("stripe_subscription_id", stripeSubscriptionId);

  console.log("[Stripe Webhook] Payment failed, subscription past_due:", stripeSubscriptionId);
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  db: ReturnType<typeof getServiceClient>
) {
  const { data: localSub } = await db
    .from("subscriptions")
    .select("id, empresa_id, plan_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (!localSub) {
    console.log("[Stripe Webhook] No local subscription found for update:", subscription.id);
    return;
  }

  // Check if price changed (upgrade/downgrade)
  const currentPriceId = subscription.items.data[0]?.price?.id;
  let newPlanId = localSub.plan_id;

  if (currentPriceId) {
    const { data: matchingPlan } = await db
      .from("subscription_plans")
      .select("id, slug")
      .or(`stripe_price_id_monthly.eq.${currentPriceId},stripe_price_id_yearly.eq.${currentPriceId}`)
      .maybeSingle();

    if (matchingPlan && matchingPlan.id !== localSub.plan_id) {
      newPlanId = matchingPlan.id;

      const planoValue: PlanoEnum = planoMapping[matchingPlan.slug] || "profissional";

      await db
        .from("empresas")
        .update({ plano: planoValue })
        .eq("id", localSub.empresa_id);
    }
  }

  // Determine billing interval from price
  const interval = subscription.items.data[0]?.price?.recurring?.interval || "month";
  const period = getSubscriptionPeriod(subscription);

  await db
    .from("subscriptions")
    .update({
      plan_id: newPlanId,
      status: subscription.status === "active" ? "active" : subscription.status as "past_due" | "canceled" | "unpaid" | "trialing" | "paused",
      billing_interval: interval === "year" ? "year" : "month",
      current_period_start: new Date(period.current_period_start * 1000).toISOString(),
      current_period_end: new Date(period.current_period_end * 1000).toISOString(),
      cancel_at: subscription.cancel_at
        ? new Date(subscription.cancel_at * 1000).toISOString()
        : null,
    })
    .eq("id", localSub.id);

  console.log("[Stripe Webhook] Subscription updated:", {
    subscriptionId: localSub.id,
    newPlanId,
    status: subscription.status,
    interval,
  });
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  db: ReturnType<typeof getServiceClient>
) {
  await db
    .from("subscriptions")
    .update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id);

  console.log("[Stripe Webhook] Subscription canceled:", subscription.id);
}

// ============================================================================
// Route Handler
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Read raw body for signature verification
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error("[Stripe Webhook] Missing stripe-signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Validate signature
    const stripe = getStripeClient();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Stripe Webhook] Signature validation failed:", message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${message}` },
        { status: 400 }
      );
    }

    console.log("[Stripe Webhook] Received:", {
      type: event.type,
      id: event.id,
      timestamp: new Date().toISOString(),
    });

    const db = getServiceClient();

    // Handle events
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
          db
        );
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice, db);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice,
          db
        );
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
          db
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          db
        );
        break;

      default:
        console.log("[Stripe Webhook] Unhandled event type:", event.type);
    }

    const processingTime = Date.now() - startTime;
    console.log("[Stripe Webhook] Processed:", {
      type: event.type,
      id: event.id,
      processingTime: `${processingTime}ms`,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[Stripe Webhook] Error:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: `${processingTime}ms`,
    });

    return NextResponse.json(
      { error: "Internal server error processing webhook" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "Stripe Webhook Handler",
    usage: "POST /api/webhooks/stripe",
    events: [
      "checkout.session.completed",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
    ],
  });
}
