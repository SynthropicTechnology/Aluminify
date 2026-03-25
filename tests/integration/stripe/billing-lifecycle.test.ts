import { POST as webhookPost } from "@/app/api/webhooks/stripe/route";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { syncStripeSubscriptionToLocal } from "@/app/shared/core/services/billing.service";
import { getStripeClient } from "@/app/shared/core/services/stripe.service";
import { rateLimitService } from "@/app/shared/core/services/rate-limit/rate-limit.service";

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: jest.fn(),
}));

jest.mock("@/app/shared/core/services/billing.service", () => ({
  syncStripeSubscriptionToLocal: jest.fn(),
  getSubscriptionIdFromInvoice: jest.fn(() => "sub_invoice_1"),
}));

jest.mock("@/app/shared/core/services/stripe.service", () => ({
  getStripeClient: jest.fn(),
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

function createBuilder(): QueryBuilder {
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
      "stripe-signature": "sig_test",
      "x-forwarded-for": "127.0.0.1",
    },
    body: JSON.stringify(event),
  });
}

describe("billing lifecycle integration", () => {
  const webhookEventsBuilder = createBuilder();
  const localState = { status: "none" };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";

    const db = {
      from: jest.fn((table: string) => {
        if (table === "webhook_events") return webhookEventsBuilder;
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    webhookEventsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    webhookEventsBuilder.single.mockResolvedValue({ data: { id: "w_1" }, error: null });

    (getDatabaseClient as jest.Mock).mockReturnValue(db);
    (rateLimitService.checkLimit as jest.Mock).mockReturnValue(true);

    const stripe = {
      webhooks: {
        constructEvent: jest.fn((body: string) => JSON.parse(body)),
      },
    };

    (getStripeClient as jest.Mock).mockReturnValue(stripe);
    (syncStripeSubscriptionToLocal as jest.Mock).mockResolvedValue(undefined);
  });

  it("cobre checkout -> paid -> failed -> deleted com transicoes locais", async () => {
    (syncStripeSubscriptionToLocal as jest.Mock)
      .mockImplementationOnce(async () => {
        localState.status = "active";
      })
      .mockImplementationOnce(async () => {
        localState.status = "active";
      })
      .mockImplementationOnce(async () => {
        localState.status = "past_due";
      })
      .mockImplementationOnce(async () => {
        localState.status = "canceled";
      });

    const checkoutResponse = await webhookPost(
      makeRequest({
        id: "evt_checkout",
        type: "checkout.session.completed",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_lifecycle",
            metadata: { empresa_id: "emp_1", plan_id: "plan_1" },
          },
        },
      }) as never,
    );
    expect(checkoutResponse.status).toBe(200);
    expect(localState.status).toBe("active");

    const paidResponse = await webhookPost(
      makeRequest({
        id: "evt_paid",
        type: "invoice.paid",
        data: { object: { id: "inv_paid" } },
      }) as never,
    );
    expect(paidResponse.status).toBe(200);
    expect(localState.status).toBe("active");

    const failedResponse = await webhookPost(
      makeRequest({
        id: "evt_failed",
        type: "invoice.payment_failed",
        data: { object: { id: "inv_failed" } },
      }) as never,
    );
    expect(failedResponse.status).toBe(200);
    expect(localState.status).toBe("past_due");

    const deletedResponse = await webhookPost(
      makeRequest({
        id: "evt_deleted",
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_lifecycle" } },
      }) as never,
    );

    expect(deletedResponse.status).toBe(200);
    expect(localState.status).toBe("canceled");
    expect(syncStripeSubscriptionToLocal).toHaveBeenCalledTimes(4);
  });
});
