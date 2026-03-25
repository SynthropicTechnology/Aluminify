import { z } from "zod";

/**
 * Zod Validation Tests for Billing Routes
 *
 * Tests the Zod schemas used across all billing/superadmin API routes.
 * Pure schema validation tests -- no HTTP/auth mocking needed.
 */

// ---- Schemas (must match what route files define) ----

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
  .refine(
    (data) => data.action !== "change_plan" || data.plan_id,
    { message: "plan_id e obrigatorio para change_plan", path: ["plan_id"] },
  );

const createPlanSchema = z
  .object({
    name: z.string().min(1, "Nome e obrigatorio"),
    slug: z
      .string()
      .min(1, "Slug e obrigatorio")
      .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
    description: z.string().optional(),
    features: z.array(z.string()).default([]),
    price_monthly_cents: z.number().int().min(0),
    price_yearly_cents: z.number().int().min(0).optional(),
    currency: z.string().default("BRL"),
    max_active_students: z.number().int().min(0).nullable().optional(),
    max_courses: z.number().int().min(0).nullable().optional(),
    max_storage_mb: z.number().int().min(0).nullable().optional(),
    allowed_modules: z.array(z.string()).default([]),
    extra_student_price_cents: z.number().int().min(0).nullable().optional(),
    display_order: z.number().int().default(0),
    is_featured: z.boolean().default(false),
    badge_text: z.string().nullable().optional(),
  })
  .strip();

const invoiceListQuerySchema = z
  .object({
    customer: z.string().optional(),
    subscription: z.string().optional(),
    status: z
      .enum(["draft", "open", "paid", "uncollectible", "void"])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    starting_after: z.string().optional(),
  })
  .strip();

// ---- Tests ----

describe("Checkout Body Schema", () => {
  it("Test 1: rejects missing plan_id", () => {
    const result = checkoutBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("Test 2: rejects invalid UUID for plan_id", () => {
    const result = checkoutBodySchema.safeParse({
      plan_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("Test 3: accepts valid plan_id with billing_interval", () => {
    const result = checkoutBodySchema.safeParse({
      plan_id: "550e8400-e29b-41d4-a716-446655440000",
      billing_interval: "month",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.plan_id).toBe(
        "550e8400-e29b-41d4-a716-446655440000",
      );
      expect(result.data.billing_interval).toBe("month");
    }
  });

  it("Test 4: defaults billing_interval to 'month' when omitted", () => {
    const result = checkoutBodySchema.safeParse({
      plan_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.billing_interval).toBe("month");
    }
  });
});

describe("Subscription Action Schema", () => {
  it("Test 5: rejects action 'change_plan' without plan_id", () => {
    const result = subscriptionActionSchema.safeParse({
      action: "change_plan",
      subscription_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });

  it("Test 6: accepts action 'cancel' without plan_id", () => {
    const result = subscriptionActionSchema.safeParse({
      action: "cancel",
      subscription_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });
});

describe("Create Plan Schema", () => {
  it("Test 7: rejects empty name", () => {
    const result = createPlanSchema.safeParse({
      name: "",
      slug: "basic",
      price_monthly_cents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("Test 8: rejects slug with uppercase characters", () => {
    const result = createPlanSchema.safeParse({
      name: "Basic Plan",
      slug: "Basic-Plan",
      price_monthly_cents: 1000,
    });
    expect(result.success).toBe(false);
  });
});

describe("Invoice List Query Schema", () => {
  it("Test 9: coerces limit string '50' to number 50", () => {
    const result = invoiceListQuerySchema.safeParse({
      limit: "50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
    }
  });

  it("Test 10: rejects limit above 100", () => {
    const result = invoiceListQuerySchema.safeParse({
      limit: 101,
    });
    expect(result.success).toBe(false);
  });
});
