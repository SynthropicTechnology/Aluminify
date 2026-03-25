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
jest.mock("@/app/shared/core/services/logger.service", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

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
    cancel_at: null,
    canceled_at: null,
    items: {
      data: [
        {
          price: {
            id: "price_test_789",
            recurring: { interval: "month" },
          },
          current_period_start: 1700000000,
          current_period_end: 1702592000,
        },
      ],
    },
    ...overrides,
  };
}

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
  });
});
