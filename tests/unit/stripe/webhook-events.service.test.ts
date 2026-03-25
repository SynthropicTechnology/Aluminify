import {
  listWebhookEvents,
  replayWebhookEvent,
} from "@/app/shared/core/services/webhook-events.service";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { syncStripeSubscriptionToLocal } from "@/app/shared/core/services/billing.service";

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: jest.fn(),
}));

jest.mock("@/app/shared/core/services/billing.service", () => ({
  syncStripeSubscriptionToLocal: jest.fn(),
  getSubscriptionIdFromInvoice: jest.fn(() => "sub_invoice_1"),
}));

jest.mock("@/app/shared/core/services/logger.service", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type Builder = {
  select: jest.Mock;
  eq: jest.Mock;
  maybeSingle: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  lt: jest.Mock;
  update: jest.Mock;
};

function createBuilder(): Builder {
  const b = {} as Builder;
  b.select = jest.fn().mockReturnValue(b);
  b.eq = jest.fn().mockReturnValue(b);
  b.maybeSingle = jest.fn();
  b.order = jest.fn().mockReturnValue(b);
  b.limit = jest.fn();
  b.lt = jest.fn().mockReturnValue(b);
  b.update = jest.fn().mockReturnValue(b);
  return b;
}

describe("webhook-events.service", () => {
  const builder = createBuilder();
  const db = {
    from: jest.fn(() => builder),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    builder.limit.mockResolvedValue({ data: [], error: null });
    builder.maybeSingle.mockResolvedValue({ data: null, error: null });

    (getDatabaseClient as jest.Mock).mockReturnValue(db);
    (syncStripeSubscriptionToLocal as jest.Mock).mockResolvedValue(undefined);
  });

  it("rejeita replay quando evento nao existe", async () => {
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(replayWebhookEvent("evt_not_found")).rejects.toThrow(
      "Webhook event not found: evt_not_found",
    );
  });

  it("processa replay apenas quando status failed e atualiza para processed", async () => {
    builder.maybeSingle.mockResolvedValueOnce({
      data: {
        stripe_event_id: "evt_failed_1",
        event_type: "customer.subscription.updated",
        status: "failed",
        payload: { id: "sub_123" },
      },
      error: null,
    });

    const result = await replayWebhookEvent("evt_failed_1");

    expect(result.replayed).toBe(true);
    expect(syncStripeSubscriptionToLocal).toHaveBeenCalledWith("sub_123");
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processing" }),
    );
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "processed" }),
    );
  });

  it("listWebhookEvents retorna payload resumido ordenado por created_at desc", async () => {
    builder.limit.mockResolvedValueOnce({
      data: [
        {
          stripe_event_id: "evt_2",
          event_type: "invoice.paid",
          status: "processed",
          processing_error: null,
          processing_time_ms: 20,
          created_at: "2026-03-24T10:01:00.000Z",
          processed_at: "2026-03-24T10:01:05.000Z",
          payload: { customer: "cus_1" },
        },
        {
          stripe_event_id: "evt_1",
          event_type: "customer.subscription.updated",
          status: "failed",
          processing_error: "boom",
          processing_time_ms: 10,
          created_at: "2026-03-24T10:00:00.000Z",
          processed_at: null,
          payload: { id: "sub_1", customer: "cus_2" },
        },
      ],
      error: null,
    });

    const result = await listWebhookEvents({ limit: 2 });

    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result.events).toHaveLength(2);
    expect(result.events[0].stripe_event_id).toBe("evt_2");
    expect(result.events[0].payload_summary.customer_id).toBe("cus_1");
  });
});
