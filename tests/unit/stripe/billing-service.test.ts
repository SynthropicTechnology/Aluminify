<<<<<<< HEAD
/**
 * Unit tests for billing.service.ts - syncStripeSubscriptionToLocal
 *
 * Tests the single-sync pattern: fetch current Stripe state and upsert locally.
 */

// Mock Stripe
const mockRetrieve = jest.fn();
jest.mock("@/app/shared/core/services/stripe.service", () => ({
  getStripeClient: () => ({
    subscriptions: {
      retrieve: mockRetrieve,
    },
  }),
}));

// Mock logger
=======
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

>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
jest.mock("@/app/shared/core/services/logger.service", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

<<<<<<< HEAD
// Mock database client
const mockChain: Record<string, jest.Mock> = {};
mockChain.select = jest.fn().mockReturnValue(mockChain);
mockChain.insert = jest.fn().mockReturnValue(mockChain);
mockChain.update = jest.fn().mockReturnValue(mockChain);
mockChain.upsert = jest.fn().mockReturnValue(mockChain);
mockChain.eq = jest.fn().mockReturnValue(mockChain);
mockChain.or = jest.fn().mockReturnValue(mockChain);
mockChain.single = jest.fn().mockResolvedValue({ data: null, error: null });
mockChain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

const mockFrom = jest.fn().mockImplementation(() => {
  // Reset chain for each call
  mockChain.select = jest.fn().mockReturnValue(mockChain);
  mockChain.insert = jest.fn().mockReturnValue(mockChain);
  mockChain.update = jest.fn().mockReturnValue(mockChain);
  mockChain.upsert = jest.fn().mockReturnValue(mockChain);
  mockChain.eq = jest.fn().mockReturnValue(mockChain);
  mockChain.or = jest.fn().mockReturnValue(mockChain);
  mockChain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  mockChain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return mockChain;
});

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: () => ({
    from: mockFrom,
  }),
}));

// Realistic Stripe subscription fixture
function createStripeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_test_123",
    status: "active",
    customer: "cus_test_456",
    current_period_start: 1700000000,
    current_period_end: 1702592000,
=======
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
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
    cancel_at: null,
    canceled_at: null,
    items: {
      data: [
        {
          price: {
<<<<<<< HEAD
            id: "price_test_789",
            recurring: { interval: "month" },
          },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
=======
            id: "price_monthly_123",
            recurring: {
              interval: "month",
            },
          },
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
        },
      ],
    },
    ...overrides,
  };
}

<<<<<<< HEAD
describe("Billing Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("syncStripeSubscriptionToLocal", () => {
    it("Test 1: When subscription exists locally, updates the local record", async () => {
      const { syncStripeSubscriptionToLocal } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const stripeSub = createStripeSubscription();
      mockRetrieve.mockResolvedValue(stripeSub);

      // Mock: subscription exists locally
      const existingId = "local-sub-id-1";
      const existingEmpresaId = "empresa-1";
      let callIndex = 0;
      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockReturnValue(chain);
        chain.update = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.or = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

        if (table === "subscription_plans") {
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "plan-1", slug: "nuvem" },
            error: null,
          });
        }

        if (table === "subscriptions" && callIndex === 0) {
          callIndex++;
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: existingId, empresa_id: existingEmpresaId },
            error: null,
          });
        }

        return chain;
      });

      await syncStripeSubscriptionToLocal("sub_test_123");

      // Verify stripe.subscriptions.retrieve was called
      expect(mockRetrieve).toHaveBeenCalledWith("sub_test_123");

      // Verify update was called (from calls should include subscriptions table)
      expect(mockFrom).toHaveBeenCalledWith("subscriptions");
    });

    it("Test 2: When subscription does NOT exist and metadata provided, creates new record", async () => {
      // Re-import to get fresh module
      jest.resetModules();
      jest.mock("@/app/shared/core/services/stripe.service", () => ({
        getStripeClient: () => ({
          subscriptions: { retrieve: mockRetrieve },
        }),
      }));
      jest.mock("@/app/shared/core/services/logger.service", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.mock("@/app/shared/core/database/database", () => ({
        getDatabaseClient: () => ({ from: mockFrom }),
      }));

      const { syncStripeSubscriptionToLocal } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const stripeSub = createStripeSubscription();
      mockRetrieve.mockResolvedValue(stripeSub);

      // Mock: subscription does NOT exist locally
      let insertCalled = false;
      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockImplementation(() => {
          insertCalled = true;
          return chain;
        });
        chain.update = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.or = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

        if (table === "subscription_plans") {
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "plan-1", slug: "nuvem" },
            error: null,
          });
        }

        return chain;
      });

      await syncStripeSubscriptionToLocal("sub_test_123", {
        empresa_id: "empresa-1",
        plan_id: "plan-1",
      });

      expect(insertCalled).toBe(true);
    });

    it("Test 3: When subscription does NOT exist and NO metadata, throws error", async () => {
      jest.resetModules();
      jest.mock("@/app/shared/core/services/stripe.service", () => ({
        getStripeClient: () => ({
          subscriptions: { retrieve: mockRetrieve },
        }),
      }));
      jest.mock("@/app/shared/core/services/logger.service", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.mock("@/app/shared/core/database/database", () => ({
        getDatabaseClient: () => ({ from: mockFrom }),
      }));

      const { syncStripeSubscriptionToLocal } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const stripeSub = createStripeSubscription();
      mockRetrieve.mockResolvedValue(stripeSub);

      // Mock: subscription does NOT exist locally, no plan found
      mockFrom.mockImplementation(() => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockReturnValue(chain);
        chain.update = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.or = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
        return chain;
      });

      await expect(
        syncStripeSubscriptionToLocal("sub_test_123"),
      ).rejects.toThrow("Cannot create subscription without empresa_id and plan_id");
    });

    it("Test 4: Resolves plan from price ID and updates empresas.plano", async () => {
      jest.resetModules();
      jest.mock("@/app/shared/core/services/stripe.service", () => ({
        getStripeClient: () => ({
          subscriptions: { retrieve: mockRetrieve },
        }),
      }));
      jest.mock("@/app/shared/core/services/logger.service", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.mock("@/app/shared/core/database/database", () => ({
        getDatabaseClient: () => ({ from: mockFrom }),
      }));

      const { syncStripeSubscriptionToLocal } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const stripeSub = createStripeSubscription();
      mockRetrieve.mockResolvedValue(stripeSub);

      // Track which tables are updated
      const updatedTables: string[] = [];
      let callIndex = 0;

      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockReturnValue(chain);
        chain.update = jest.fn().mockImplementation(() => {
          updatedTables.push(table);
          return chain;
        });
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.or = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

        if (table === "subscription_plans") {
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "plan-1", slug: "nuvem" },
            error: null,
          });
          chain.single = jest.fn().mockResolvedValue({
            data: { slug: "nuvem" },
            error: null,
          });
        }

        if (table === "subscriptions" && callIndex === 0) {
          callIndex++;
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "local-sub-1", empresa_id: "empresa-1" },
            error: null,
          });
        }

        return chain;
      });

      await syncStripeSubscriptionToLocal("sub_test_123");

      // empresas table should be updated with plano value
      expect(updatedTables).toContain("empresas");
    });

    it("Test 5: When subscription status is canceled, updates empresas.plano", async () => {
      jest.resetModules();
      jest.mock("@/app/shared/core/services/stripe.service", () => ({
        getStripeClient: () => ({
          subscriptions: { retrieve: mockRetrieve },
        }),
      }));
      jest.mock("@/app/shared/core/services/logger.service", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.mock("@/app/shared/core/database/database", () => ({
        getDatabaseClient: () => ({ from: mockFrom }),
      }));

      const { syncStripeSubscriptionToLocal } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const stripeSub = createStripeSubscription({
        status: "canceled",
        canceled_at: 1700100000,
      });
      mockRetrieve.mockResolvedValue(stripeSub);

      let callIndex = 0;
      const updatedTables: string[] = [];

      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockReturnValue(chain);
        chain.update = jest.fn().mockImplementation(() => {
          updatedTables.push(table);
          return chain;
        });
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.or = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

        if (table === "subscription_plans") {
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "plan-1", slug: "nuvem" },
            error: null,
          });
          chain.single = jest.fn().mockResolvedValue({
            data: { slug: "nuvem" },
            error: null,
          });
        }

        if (table === "subscriptions" && callIndex === 0) {
          callIndex++;
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "local-sub-1", empresa_id: "empresa-1" },
            error: null,
          });
        }

        return chain;
      });

      await syncStripeSubscriptionToLocal("sub_test_123");

      expect(updatedTables).toContain("empresas");
    });

    it("Test 6: Calls stripe.subscriptions.retrieve() with the provided subscriptionId", async () => {
      jest.resetModules();
      jest.mock("@/app/shared/core/services/stripe.service", () => ({
        getStripeClient: () => ({
          subscriptions: { retrieve: mockRetrieve },
        }),
      }));
      jest.mock("@/app/shared/core/services/logger.service", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.mock("@/app/shared/core/database/database", () => ({
        getDatabaseClient: () => ({ from: mockFrom }),
      }));

      const { syncStripeSubscriptionToLocal } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const stripeSub = createStripeSubscription();
      mockRetrieve.mockResolvedValue(stripeSub);

      // Mock existing subscription to avoid throw
      let callIndex = 0;
      mockFrom.mockImplementation((table: string) => {
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn().mockReturnValue(chain);
        chain.insert = jest.fn().mockReturnValue(chain);
        chain.update = jest.fn().mockReturnValue(chain);
        chain.eq = jest.fn().mockReturnValue(chain);
        chain.or = jest.fn().mockReturnValue(chain);
        chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
        chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });

        if (table === "subscriptions" && callIndex === 0) {
          callIndex++;
          chain.maybeSingle = jest.fn().mockResolvedValue({
            data: { id: "local-sub-1", empresa_id: "empresa-1" },
            error: null,
          });
        }

        return chain;
      });

      await syncStripeSubscriptionToLocal("sub_specific_id_123");

      expect(mockRetrieve).toHaveBeenCalledWith("sub_specific_id_123");
    });
  });

  describe("getSubscriptionIdFromInvoice", () => {
    it("extracts subscription ID from invoice.parent.subscription_details (Stripe v20+)", async () => {
      jest.resetModules();
      jest.mock("@/app/shared/core/services/stripe.service", () => ({
        getStripeClient: () => ({
          subscriptions: { retrieve: mockRetrieve },
        }),
      }));
      jest.mock("@/app/shared/core/services/logger.service", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.mock("@/app/shared/core/database/database", () => ({
        getDatabaseClient: () => ({ from: mockFrom }),
      }));

      const { getSubscriptionIdFromInvoice } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const invoice = {
        parent: {
          subscription_details: {
            subscription: "sub_from_invoice_123",
          },
        },
      };

      const result = getSubscriptionIdFromInvoice(invoice as any);
      expect(result).toBe("sub_from_invoice_123");
    });

    it("returns null when invoice has no subscription details", async () => {
      jest.resetModules();
      jest.mock("@/app/shared/core/services/stripe.service", () => ({
        getStripeClient: () => ({
          subscriptions: { retrieve: mockRetrieve },
        }),
      }));
      jest.mock("@/app/shared/core/services/logger.service", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      }));
      jest.mock("@/app/shared/core/database/database", () => ({
        getDatabaseClient: () => ({ from: mockFrom }),
      }));

      const { getSubscriptionIdFromInvoice } = await import(
        "@/app/shared/core/services/billing.service"
      );

      const invoice = { parent: null };
      const result = getSubscriptionIdFromInvoice(invoice as any);
      expect(result).toBeNull();
    });
=======
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
>>>>>>> c2b85828f307c32c7d73093a83914d83564c13bf
  });
});
