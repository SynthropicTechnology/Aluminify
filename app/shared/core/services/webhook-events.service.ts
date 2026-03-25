import type Stripe from "stripe";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { logger } from "@/app/shared/core/services/logger.service";
import {
  getSubscriptionIdFromInvoice,
  syncStripeSubscriptionToLocal,
} from "@/app/shared/core/services/billing.service";
import type { WebhookEventStatus } from "@/app/shared/types/entities/subscription";

const WEBHOOK_EVENTS_TABLE = "webhook_events" as never;

type PayloadObject = Record<string, unknown>;
type WebhookEventRow = {
  stripe_event_id: string;
  event_type: string;
  status: WebhookEventStatus;
  processing_error: string | null;
  processing_time_ms: number | null;
  created_at: string;
  processed_at: string | null;
  payload: unknown;
};
type WebhookEventCursorRow = Pick<WebhookEventRow, "created_at">;
type WebhookEventReplayRow = Pick<
  WebhookEventRow,
  "stripe_event_id" | "event_type" | "status" | "payload"
>;
type WebhookEventUpdate = Partial<
  Pick<
    WebhookEventRow,
    "status" | "processing_error" | "processed_at" | "processing_time_ms"
  >
>;

export interface ListWebhookEventsFilters {
  status?: WebhookEventStatus;
  limit?: number;
  starting_after?: string;
}

export interface WebhookEventListItem {
  stripe_event_id: string;
  event_type: string;
  status: WebhookEventStatus;
  processing_error: string | null;
  processing_time_ms: number | null;
  created_at: string;
  processed_at: string | null;
  payload_summary: {
    subscription_id: string | null;
    customer_id: string | null;
  };
}

interface ReplayResult {
  replayed: true;
  stripe_event_id: string;
  status: WebhookEventStatus;
}

async function updateWebhookEvent(
  stripeEventId: string,
  patch: WebhookEventUpdate,
): Promise<void> {
  const db = getDatabaseClient();
  const { error } = await db
    .from(WEBHOOK_EVENTS_TABLE)
    .update(patch as never)
    .eq("stripe_event_id", stripeEventId);

  if (error) {
    throw error;
  }
}

function asObject(value: unknown): PayloadObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as PayloadObject;
}

function readString(payload: PayloadObject, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function extractSubscriptionId(eventType: string, payload: PayloadObject): string | null {
  if (eventType === "checkout.session.completed") {
    return readString(payload, "subscription");
  }

  if (
    eventType === "customer.subscription.updated" ||
    eventType === "customer.subscription.deleted"
  ) {
    return readString(payload, "id");
  }

  if (eventType === "invoice.paid" || eventType === "invoice.payment_failed") {
    return getSubscriptionIdFromInvoice(payload as unknown as Stripe.Invoice);
  }

  return null;
}

function extractCustomerId(payload: PayloadObject): string | null {
  const customer = payload.customer;
  if (typeof customer === "string") {
    return customer;
  }

  if (customer && typeof customer === "object") {
    const id = (customer as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
}

export async function listWebhookEvents(
  filters: ListWebhookEventsFilters = {},
): Promise<{ events: WebhookEventListItem[]; has_more: boolean }> {
  const db = getDatabaseClient();
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  let query = db
    .from(WEBHOOK_EVENTS_TABLE)
    .select(
      "stripe_event_id, event_type, status, processing_error, processing_time_ms, created_at, processed_at, payload",
    )
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.starting_after) {
    const { data: cursorData, error: cursorError } = await db
      .from(WEBHOOK_EVENTS_TABLE)
      .select("created_at")
      .eq("stripe_event_id", filters.starting_after)
      .maybeSingle();

    if (cursorError) {
      throw cursorError;
    }

    const cursor = cursorData as WebhookEventCursorRow | null;

    if (cursor?.created_at) {
      query = query.lt("created_at", cursor.created_at);
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as WebhookEventRow[];

  const has_more = rows.length > limit;
  const events = rows.slice(0, limit).map((row) => {
    const payload = asObject(row.payload);

    return {
      stripe_event_id: row.stripe_event_id,
      event_type: row.event_type,
      status: row.status,
      processing_error: row.processing_error,
      processing_time_ms: row.processing_time_ms,
      created_at: row.created_at,
      processed_at: row.processed_at,
      payload_summary: {
        subscription_id: extractSubscriptionId(row.event_type, payload),
        customer_id: extractCustomerId(payload),
      },
    };
  });

  return { events, has_more };
}

export async function replayWebhookEvent(stripeEventId: string): Promise<ReplayResult> {
  if (!stripeEventId) {
    throw new Error("stripe_event_id e obrigatorio");
  }

  const db = getDatabaseClient();
  const { data: eventRowData, error: eventError } = await db
    .from(WEBHOOK_EVENTS_TABLE)
    .select("stripe_event_id, event_type, status, payload")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();

  if (eventError) {
    throw eventError;
  }

  const eventRow = eventRowData as WebhookEventReplayRow | null;

  if (!eventRow) {
    throw new Error(`Webhook event not found: ${stripeEventId}`);
  }

  if (eventRow.status !== "failed") {
    throw new Error(`Only failed webhook events can be replayed: ${stripeEventId}`);
  }

  const payload = asObject(eventRow.payload);
  const subscriptionId = extractSubscriptionId(eventRow.event_type, payload);

  const startedAt = Date.now();

  await updateWebhookEvent(stripeEventId, {
    status: "processing",
    processing_error: null,
  });

  try {
    if (subscriptionId) {
      await syncStripeSubscriptionToLocal(subscriptionId);
    } else {
      logger.warn("superadmin-webhooks", "Replay without subscription id", {
        stripe_event_id: stripeEventId,
        event_type: eventRow.event_type,
      });
    }

    const duration = Date.now() - startedAt;
    await updateWebhookEvent(stripeEventId, {
      status: "processed",
      processing_error: null,
      processed_at: new Date().toISOString(),
      processing_time_ms: duration,
    });

    logger.info("superadmin-webhooks", "Webhook replayed", {
      stripe_event_id: stripeEventId,
      event_type: eventRow.event_type,
      processing_time_ms: duration,
    });

    return {
      replayed: true,
      stripe_event_id: stripeEventId,
      status: "processed",
    };
  } catch (error) {
    const duration = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : String(error);

    await updateWebhookEvent(stripeEventId, {
      status: "failed",
      processing_error: message,
      processing_time_ms: duration,
    });

    logger.error("superadmin-webhooks", "Webhook replay failed", {
      stripe_event_id: stripeEventId,
      event_type: eventRow.event_type,
      processing_time_ms: duration,
      error: message,
    });

    throw error;
  }
}
