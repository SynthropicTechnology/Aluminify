import { getDatabaseClient } from "@/app/shared/core/database/database";
import { logger } from "@/app/shared/core/services/logger.service";
import { getStripeClient } from "@/app/shared/core/services/stripe.service";
import { syncStripeSubscriptionToLocal } from "@/app/shared/core/services/billing.service";

jest.mock("@/app/shared/core/services/stripe.service", () => ({
  getStripeClient: jest.fn(),
}));

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: jest.fn(),
}));

jest.mock("@/app/shared/core/services/logger.service", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type QueryBuilder = {
  select: jest.Mock;
  eq: jest.Mock;
  or: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
  update: jest.Mock;
  insert: jest.Mock;
};

function createQueryBuilder(): QueryBuilder {
  const queryBuilder = {} as QueryBuilder;
  queryBuilder.select = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.eq = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.or = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.maybeSingle = jest.fn();
  queryBuilder.single = jest.fn();
  queryBuilder.update = jest.fn().mockReturnValue(queryBuilder);
  queryBuilder.insert = jest.fn().mockReturnValue(queryBuilder);
  return queryBuilder;
}

function createStripeSubscription(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sub_123",
    customer: "cus_123",
    status: "active",
    current_period_start: 1_708_992_000,
    current_period_end: 1_711_584_000,
    cancel_at: null,
    canceled_at: null,
    items: {
      data: [
        {
          price: {
            id: "price_monthly_123",
            recurring: {
              interval: "month",
            },
          },
        },
      ],
    },
    ...overrides,
  };
}

describe("syncStripeSubscriptionToLocal", () => {
  const subscriptionsBuilder = createQueryBuilder();
  const planResolveBuilder = createQueryBuilder();
  const planSlugBuilder = createQueryBuilder();
  const empresasBuilder = createQueryBuilder();

  const db = {
    from: jest.fn((table: string) => {
      if (table === "subscriptions") return subscriptionsBuilder;
      if (table === "subscription_plans") {
        if (planResolveBuilder.or.mock.calls.length === 0) {
          return planResolveBuilder;
        }
        return planSlugBuilder;
      }
      if (table === "empresas") return empresasBuilder;
      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  const stripe = {
    subscriptions: {
      retrieve: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    subscriptionsBuilder.maybeSingle.mockReset();
    subscriptionsBuilder.single.mockReset();
    subscriptionsBuilder.update.mockReturnValue(subscriptionsBuilder);
    subscriptionsBuilder.insert.mockReturnValue(subscriptionsBuilder);

    planResolveBuilder.single.mockReset();
    planResolveBuilder.maybeSingle.mockReset();
    planResolveBuilder.or.mockReturnValue(planResolveBuilder);

    planSlugBuilder.single.mockReset();
    planSlugBuilder.maybeSingle.mockReset();

    empresasBuilder.update.mockReturnValue(empresasBuilder);

    (getDatabaseClient as jest.Mock).mockReturnValue(db);
    (getStripeClient as jest.Mock).mockReturnValue(stripe);
    stripe.subscriptions.retrieve.mockResolvedValue(createStripeSubscription());

    planResolveBuilder.maybeSingle.mockResolvedValue({
      data: { id: "plan_db_1", slug: "nuvem" },
      error: null,
    });

    planSlugBuilder.single.mockResolvedValue({
      data: { slug: "nuvem" },
      error: null,
    });
  });

  it("updates local subscription when it already exists", async () => {
    subscriptionsBuilder.maybeSingle.mockResolvedValue({
      data: { id: "sub_local_1", empresa_id: "emp_1" },
      error: null,
    });

    await syncStripeSubscriptionToLocal("sub_123");

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
    expect(subscriptionsBuilder.update).toHaveBeenCalled();
    expect(subscriptionsBuilder.insert).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it("creates subscription when local record does not exist and metadata is provided", async () => {
    subscriptionsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

    await syncStripeSubscriptionToLocal("sub_123", {
      empresa_id: "emp_1",
      plan_id: "plan_meta_1",
    });

    expect(subscriptionsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        empresa_id: "emp_1",
        plan_id: "plan_db_1",
        stripe_subscription_id: "sub_123",
      }),
    );
  });

  it("throws when local record does not exist and metadata is missing", async () => {
    subscriptionsBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });
    planResolveBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(syncStripeSubscriptionToLocal("sub_123")).rejects.toThrow(
      "Cannot create subscription without empresa_id and plan_id",
    );
  });

  it("resolves plan by Stripe price and maps empresas.plano via plan slug", async () => {
    subscriptionsBuilder.maybeSingle.mockResolvedValue({
      data: { id: "sub_local_1", empresa_id: "emp_1" },
      error: null,
    });

    planResolveBuilder.maybeSingle.mockResolvedValue({
      data: { id: "plan_resolved_1", slug: "gratuito" },
      error: null,
    });

    planSlugBuilder.single.mockResolvedValue({
      data: { slug: "gratuito" },
      error: null,
    });

    await syncStripeSubscriptionToLocal("sub_123");

    expect(planResolveBuilder.or).toHaveBeenCalledWith(
      expect.stringContaining("stripe_price_id_monthly.eq.price_monthly_123"),
    );
    expect(empresasBuilder.update).toHaveBeenCalledWith({ plano: "basico" });
  });

  it("syncs empresas.plano when subscription status is canceled", async () => {
    subscriptionsBuilder.maybeSingle.mockResolvedValue({
      data: { id: "sub_local_1", empresa_id: "emp_1" },
      error: null,
    });

    stripe.subscriptions.retrieve.mockResolvedValue(
      createStripeSubscription({
        status: "canceled",
        canceled_at: 1_709_000_000,
      }),
    );

    planResolveBuilder.maybeSingle.mockResolvedValue({
      data: { id: "plan_resolved_2", slug: "personalizado" },
      error: null,
    });

    planSlugBuilder.single.mockResolvedValue({
      data: { slug: "personalizado" },
      error: null,
    });

    await syncStripeSubscriptionToLocal("sub_123");

    expect(subscriptionsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "canceled" }),
    );
    expect(empresasBuilder.update).toHaveBeenCalledWith({ plano: "enterprise" });
  });

  it("calls stripe.subscriptions.retrieve with provided subscriptionId", async () => {
    subscriptionsBuilder.maybeSingle.mockResolvedValue({
      data: { id: "sub_local_1", empresa_id: "emp_1" },
      error: null,
    });

    await syncStripeSubscriptionToLocal("sub_abc_987");

    expect(stripe.subscriptions.retrieve).toHaveBeenCalledTimes(1);
    expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_abc_987");
  });
});
