import { POST } from "@/app/api/webhooks/stripe/route";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import {
  getSubscriptionIdFromInvoice,
  syncStripeSubscriptionToLocal,
} from "@/app/shared/core/services/billing.service";
import { logger } from "@/app/shared/core/services/logger.service";
import { rateLimitService } from "@/app/shared/core/services/rate-limit/rate-limit.service";
import { getStripeClient } from "@/app/shared/core/services/stripe.service";
import * as Sentry from "@sentry/nextjs";

jest.mock("@/app/shared/core/services/stripe.service", () => ({
  getStripeClient: jest.fn(),
}));

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: jest.fn(),
}));

jest.mock("@/app/shared/core/services/billing.service", () => ({
  syncStripeSubscriptionToLocal: jest.fn(),
  getSubscriptionIdFromInvoice: jest.fn(),
}));

jest.mock("@/app/shared/core/services/logger.service", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/app/shared/core/services/rate-limit/rate-limit.service", () => ({
  rateLimitService: {
    checkLimit: jest.fn(),
  },
}));

jest.mock("@sentry/nextjs", () => ({
  captureException: jest.fn(),
}));

type QueryBuilder = {
  select: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
  upsert: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
};

function createQueryBuilder(): QueryBuilder {
  const builder = {} as QueryBuilder;
  builder.select = jest.fn().mockReturnValue(builder);
  builder.eq = jest.fn().mockReturnValue(builder);
  builder.maybeSingle = jest.fn();
  builder.upsert = jest.fn().mockReturnValue(builder);
  builder.single = jest.fn();
  builder.update = jest.fn().mockReturnValue(builder);
  return builder;
}

function makeRequest(event: unknown): Request {
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "stripe-signature": "test-signature",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(event),
  });
}

describe("Stripe Webhook Handler", () => {
  const webhookEventsBuilder = createQueryBuilder();

  const db = {
    from: jest.fn((table: string) => {
      if (table === "webhook_events") {
        return webhookEventsBuilder;
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  const stripe = {
    webhooks: {
      constructEvent: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    webhookEventsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    webhookEventsBuilder.single.mockResolvedValue({
      data: { id: "webhook-record-1" },
      error: null,
    });

    webhookEventsBuilder.eq.mockReturnValue(webhookEventsBuilder);
    webhookEventsBuilder.update.mockReturnValue(webhookEventsBuilder);
    webhookEventsBuilder.select.mockReturnValue(webhookEventsBuilder);
    webhookEventsBuilder.upsert.mockReturnValue(webhookEventsBuilder);

    (rateLimitService.checkLimit as jest.Mock).mockReturnValue(true);
    (getDatabaseClient as jest.Mock).mockReturnValue(db);
    (getStripeClient as jest.Mock).mockReturnValue(stripe);
    (syncStripeSubscriptionToLocal as jest.Mock).mockResolvedValue(undefined);
    (getSubscriptionIdFromInvoice as jest.Mock).mockReturnValue("sub_invoice_1");

    stripe.webhooks.constructEvent.mockImplementation((body: string) => JSON.parse(body));
  });

  it("duplicate event with status processed returns 200 without reprocessing", async () => {
    webhookEventsBuilder.maybeSingle.mockResolvedValue({
      data: { id: "webhook-record-1", status: "processed" },
      error: null,
    });

    const response = await POST(
      makeRequest({
        id: "evt_duplicate_1",
        type: "invoice.paid",
        data: { object: { id: "in_1" } },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(syncStripeSubscriptionToLocal).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "stripe-webhook",
      "Duplicate event skipped",
      expect.objectContaining({ event_id: "evt_duplicate_1" }),
    );
  });

  it("new event is upserted to webhook_events with processing status", async () => {
    await POST(
      makeRequest({
        id: "evt_new_1",
        type: "invoice.paid",
        data: { object: { id: "in_2" } },
      }) as never,
    );

    expect(webhookEventsBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_event_id: "evt_new_1",
        event_type: "invoice.paid",
        status: "processing",
      }),
      { onConflict: "stripe_event_id" },
    );
  });

  it("successful processing updates webhook_events to processed with processing_time_ms", async () => {
    const response = await POST(
      makeRequest({
        id: "evt_success_1",
        type: "customer.subscription.updated",
        data: { object: { id: "sub_abc_1" } },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(syncStripeSubscriptionToLocal).toHaveBeenCalledWith("sub_abc_1");
    expect(webhookEventsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processed",
        processing_time_ms: expect.any(Number),
      }),
    );
  });

  it("failed processing updates webhook_events to failed with error message", async () => {
    (syncStripeSubscriptionToLocal as jest.Mock).mockRejectedValueOnce(new Error("missing metadata"));

    const response = await POST(
      makeRequest({
        id: "evt_fail_1",
        type: "invoice.paid",
        data: { object: { id: "in_3" } },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(webhookEventsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        processing_error: "missing metadata",
        processing_time_ms: expect.any(Number),
      }),
    );
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it("rate limited request returns 429", async () => {
    (rateLimitService.checkLimit as jest.Mock).mockReturnValue(false);

    const response = await POST(
      makeRequest({
        id: "evt_rl_1",
        type: "invoice.paid",
        data: { object: { id: "in_4" } },
      }) as never,
    );

    expect(response.status).toBe(429);
    expect(syncStripeSubscriptionToLocal).not.toHaveBeenCalled();
  });

  it("invalid Stripe signature returns 400", async () => {
    stripe.webhooks.constructEvent.mockImplementationOnce(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(
      makeRequest({
        id: "evt_sig_1",
        type: "invoice.paid",
        data: { object: { id: "in_5" } },
      }) as never,
    );

    expect(response.status).toBe(400);
  });

  it("checkout.session.completed calls syncStripeSubscriptionToLocal with metadata", async () => {
    const response = await POST(
      makeRequest({
        id: "evt_checkout_1",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_checkout_1",
            metadata: {
              empresa_id: "emp_1",
              plan_id: "plan_1",
            },
          },
        },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(syncStripeSubscriptionToLocal).toHaveBeenCalledWith("sub_checkout_1", {
      empresa_id: "emp_1",
      plan_id: "plan_1",
    });
  });

  it("unknown event type returns 200 without error", async () => {
    const response = await POST(
      makeRequest({
        id: "evt_unknown_1",
        type: "charge.refunded",
        data: { object: { id: "ch_1" } },
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(syncStripeSubscriptionToLocal).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      "stripe-webhook",
      "Unhandled event type",
      expect.objectContaining({ event_type: "charge.refunded" }),
    );
  });
});
