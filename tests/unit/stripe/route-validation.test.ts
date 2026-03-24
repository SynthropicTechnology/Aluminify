import { z } from "zod";

const checkoutBodySchema = z
  .object({
    plan_id: z.string().uuid("plan_id deve ser um UUID valido"),
    billing_interval: z.enum(["month", "year"]).default("month"),
  })
  .strip();

const subscriptionActionSchema = z
  .object({
    action: z.enum(["cancel", "change_plan"]),
    subscription_id: z.string().uuid(),
    plan_id: z.string().uuid().optional(),
  })
  .strip()
  .refine((data) => data.action !== "change_plan" || data.plan_id, {
    message: "plan_id e obrigatorio para change_plan",
    path: ["plan_id"],
  });

const createPlanSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    price_monthly_cents: z.number().int().min(0),
  })
  .strip();

const invoiceListQuerySchema = z
  .object({
    customer: z.string().optional(),
    subscription: z.string().optional(),
    status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    starting_after: z.string().optional(),
  })
  .strip();

describe("Route validation schemas", () => {
  it("rejects missing plan_id in checkoutBodySchema", () => {
    const parsed = checkoutBodySchema.safeParse({ billing_interval: "month" });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid UUID in checkoutBodySchema", () => {
    const parsed = checkoutBodySchema.safeParse({
      plan_id: "not-a-uuid",
      billing_interval: "month",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts valid checkout payload", () => {
    const parsed = checkoutBodySchema.safeParse({
      plan_id: "11111111-1111-1111-1111-111111111111",
      billing_interval: "month",
    });

    expect(parsed.success).toBe(true);
  });

  it("defaults billing_interval to month when omitted", () => {
    const parsed = checkoutBodySchema.safeParse({
      plan_id: "11111111-1111-1111-1111-111111111111",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("Schema should parse with default interval");
    }

    expect(parsed.data.billing_interval).toBe("month");
  });

  it("rejects change_plan without plan_id", () => {
    const parsed = subscriptionActionSchema.safeParse({
      action: "change_plan",
      subscription_id: "11111111-1111-1111-1111-111111111111",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts cancel action without plan_id", () => {
    const parsed = subscriptionActionSchema.safeParse({
      action: "cancel",
      subscription_id: "11111111-1111-1111-1111-111111111111",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects empty plan name", () => {
    const parsed = createPlanSchema.safeParse({
      name: "",
      slug: "plano-basico",
      price_monthly_cents: 1000,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects slug with uppercase characters", () => {
    const parsed = createPlanSchema.safeParse({
      name: "Plano",
      slug: "Plano-Basico",
      price_monthly_cents: 1000,
    });

    expect(parsed.success).toBe(false);
  });

  it("coerces invoice query limit string to number", () => {
    const parsed = invoiceListQuerySchema.safeParse({ limit: "50" });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error("Schema should coerce limit");
    }

    expect(parsed.data.limit).toBe(50);
  });

  it("rejects invoice query limit above 100", () => {
    const parsed = invoiceListQuerySchema.safeParse({ limit: "101" });

    expect(parsed.success).toBe(false);
  });
});
