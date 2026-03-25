import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import type { Json } from "@/app/shared/core/database.types";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import {
  getSubscriptionIdFromInvoice,
  syncStripeSubscriptionToLocal,
} from "@/app/shared/core/services/billing.service";
import { logger } from "@/app/shared/core/services/logger.service";
import { rateLimitService } from "@/app/shared/core/services/rate-limit/rate-limit.service";
import { getStripeClient } from "@/app/shared/core/services/stripe.service";

const WEBHOOK_EVENTS_TABLE = "webhook_events" as never;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    message.includes("503") ||
    message.includes("network")
  );
}

async function dispatchSubscriptionSync(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!subscriptionId) {
        throw new Error(`Missing subscription on checkout.session.completed: ${event.id}`);
      }

      await syncStripeSubscriptionToLocal(subscriptionId, {
        empresa_id: session.metadata?.empresa_id,
        plan_id: session.metadata?.plan_id,
      });
      return;
    }

    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getSubscriptionIdFromInvoice(invoice);

      if (!subscriptionId) {
        logger.warn("stripe-webhook", "Invoice without subscription details", {
          event_id: event.id,
          event_type: event.type,
        });
        return;
      }

      await syncStripeSubscriptionToLocal(subscriptionId);
      return;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncStripeSubscriptionToLocal(subscription.id);
      return;
    }

    default:
      logger.warn("stripe-webhook", "Unhandled event type", {
        event_id: event.id,
        event_type: event.type,
      });
  }
}

async function processWebhookEvent(event: Stripe.Event): Promise<void> {
  const db = getDatabaseClient();
  const webhookEvents = db.from(WEBHOOK_EVENTS_TABLE);

  const { data: existing, error: existingError } = await webhookEvents
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.status === "processed") {
    logger.info("stripe-webhook", "Duplicate event skipped", {
      event_id: event.id,
      event_type: event.type,
    });
    return;
  }

  const { data: webhookRecord, error: upsertError } = await webhookEvents
    .upsert(
      {
        stripe_event_id: event.id,
        event_type: event.type,
        status: "processing",
        payload: event.data.object as unknown as Json,
      },
      { onConflict: "stripe_event_id" },
    )
    .select("id")
    .single();

  if (upsertError || !webhookRecord?.id) {
    throw upsertError ?? new Error(`Failed to persist webhook event: ${event.id}`);
  }

  const startTime = Date.now();

  try {
    await dispatchSubscriptionSync(event);

    const processingTime = Date.now() - startTime;

    await webhookEvents.update({
      status: "processed",
      processed_at: new Date().toISOString(),
      processing_time_ms: processingTime,
    }).eq("id", webhookRecord.id);

    logger.info("stripe-webhook", "Event processed", {
      event_id: event.id,
      event_type: event.type,
      processing_time_ms: processingTime,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    await webhookEvents.update({
      status: "failed",
      processing_error: errorMessage,
      processing_time_ms: processingTime,
    }).eq("id", webhookRecord.id);

    Sentry.captureException(error);

    logger.error("stripe-webhook", "Event processing failed", {
      event_id: event.id,
      event_type: event.type,
      processing_time_ms: processingTime,
      error: errorMessage,
    });

    throw error;
  }
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  if (!rateLimitService.checkLimit(`webhook:${clientIp}`)) {
    logger.warn("stripe-webhook", "Rate limit exceeded", { client_ip: clientIp });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.error("stripe-webhook", "STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      logger.error("stripe-webhook", "Missing stripe-signature header");
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    const stripe = getStripeClient();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      logger.error("stripe-webhook", "Signature validation failed", {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    await processWebhookEvent(event);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    const transient = isTransientError(error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (transient) {
      logger.error("stripe-webhook", "Transient error while processing webhook", {
        error: errorMessage,
      });
      return NextResponse.json({ error: "Temporary webhook processing failure" }, { status: 500 });
    }

    logger.warn("stripe-webhook", "Permanent webhook error; returning 200", {
      error: errorMessage,
    });

    return NextResponse.json({ received: true }, { status: 200 });
  }
}
