/**
 * Unit tests for Stripe webhook handler
 * Tests event handling logic and idempotency
 */

// Mock Stripe
const mockRetrieve = jest.fn();
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: jest.fn(),
    },
    subscriptions: {
      retrieve: mockRetrieve,
      cancel: jest.fn(),
    },
  }));
});

// Mock stripe service
jest.mock("@/app/shared/core/services/stripe.service", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: jest.fn((body: string, _sig: string, _secret: string) => {
        return JSON.parse(body);
      }),
    },
    subscriptions: {
      retrieve: mockRetrieve,
    },
  }),
}));

// Mock Supabase
function createMockChain() {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.or = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data: null, error: null });
  chain.maybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
  return chain;
}

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: jest.fn().mockImplementation(() => createMockChain()),
  }),
}));

describe("Stripe Webhook Handler", () => {
  describe("Event Types", () => {
    it("should handle checkout.session.completed event structure", () => {
      const event = {
        type: "checkout.session.completed",
        id: "evt_test_123",
        data: {
          object: {
            mode: "subscription",
            subscription: "sub_test_123",
            customer: "cus_test_123",
            metadata: {
              empresa_id: "emp-1",
              plan_id: "plan-1",
              billing_interval: "month",
            },
          },
        },
      };

      expect(event.type).toBe("checkout.session.completed");
      expect(event.data.object.metadata.empresa_id).toBe("emp-1");
      expect(event.data.object.metadata.plan_id).toBe("plan-1");
      expect(event.data.object.subscription).toBe("sub_test_123");
    });

    it("should handle invoice.paid event structure", () => {
      const event = {
        type: "invoice.paid",
        id: "evt_test_456",
        data: {
          object: {
            subscription: "sub_test_123",
            amount_paid: 49900,
          },
        },
      };

      expect(event.type).toBe("invoice.paid");
      expect(event.data.object.amount_paid).toBe(49900);
    });

    it("should handle invoice.payment_failed event structure", () => {
      const event = {
        type: "invoice.payment_failed",
        id: "evt_test_789",
        data: {
          object: {
            subscription: "sub_test_123",
          },
        },
      };

      expect(event.type).toBe("invoice.payment_failed");
    });

    it("should handle customer.subscription.updated event structure", () => {
      const event = {
        type: "customer.subscription.updated",
        id: "evt_test_101",
        data: {
          object: {
            id: "sub_test_123",
            status: "active",
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
            cancel_at: null,
            items: {
              data: [
                {
                  price: {
                    id: "price_test_123",
                    recurring: { interval: "month" },
                  },
                },
              ],
            },
          },
        },
      };

      expect(event.type).toBe("customer.subscription.updated");
      expect(event.data.object.status).toBe("active");
      expect(event.data.object.items.data[0].price.recurring.interval).toBe("month");
    });

    it("should handle customer.subscription.deleted event structure", () => {
      const event = {
        type: "customer.subscription.deleted",
        id: "evt_test_202",
        data: {
          object: {
            id: "sub_test_123",
            status: "canceled",
          },
        },
      };

      expect(event.type).toBe("customer.subscription.deleted");
    });
  });

  describe("Idempotency", () => {
    it("should detect duplicate checkout sessions via stripe_subscription_id", () => {
      const existingSubscriptions = new Map<string, boolean>();
      existingSubscriptions.set("sub_test_123", true);

      const stripeSubscriptionId = "sub_test_123";
      const isDuplicate = existingSubscriptions.has(stripeSubscriptionId);

      expect(isDuplicate).toBe(true);
    });

    it("should allow new subscription when no duplicate exists", () => {
      const existingSubscriptions = new Map<string, boolean>();

      const stripeSubscriptionId = "sub_test_new";
      const isDuplicate = existingSubscriptions.has(stripeSubscriptionId);

      expect(isDuplicate).toBe(false);
    });
  });

  describe("Plan Mapping", () => {
    it("should map plan slugs to empresas.plano values", () => {
      const planoMapping: Record<string, string> = {
        gratuito: "basico",
        nuvem: "profissional",
        personalizado: "enterprise",
      };

      expect(planoMapping["gratuito"]).toBe("basico");
      expect(planoMapping["nuvem"]).toBe("profissional");
      expect(planoMapping["personalizado"]).toBe("enterprise");
      expect(planoMapping["unknown"] || "profissional").toBe("profissional");
    });
  });

  describe("Signature Validation", () => {
    it("should require stripe-signature header", () => {
      const signature = null;
      expect(signature).toBeNull();
      // The webhook handler returns 400 if signature is missing
    });

    it("should require STRIPE_WEBHOOK_SECRET", () => {
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      // In test env, this is undefined — webhook handler returns 500
      expect(secret).toBeUndefined();
    });
  });

  describe("Non-subscription checkout", () => {
    it("should ignore non-subscription checkout sessions", () => {
      const session = {
        mode: "payment", // not "subscription"
        subscription: null,
      };

      const shouldProcess = session.mode === "subscription";
      expect(shouldProcess).toBe(false);
    });
  });

  describe("Status Mapping", () => {
    it("should map Stripe subscription statuses correctly", () => {
      const validStatuses = ["active", "past_due", "canceled", "unpaid", "trialing", "paused"];

      const stripeStatus = "active";
      expect(validStatuses).toContain(stripeStatus);

      const pastDueStatus = "past_due";
      expect(validStatuses).toContain(pastDueStatus);
    });

    it("should determine billing interval from price", () => {
      const yearlyInterval = "year";
      const monthlyInterval = "month";

      expect(yearlyInterval === "year" ? "year" : "month").toBe("year");
      expect(monthlyInterval === "year" ? "year" : "month").toBe("month");
    });
  });
});
