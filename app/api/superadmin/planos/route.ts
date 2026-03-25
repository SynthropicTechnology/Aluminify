import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabaseClient } from "@/shared/core/database/database";
import { logger } from "@/shared/core/services/logger.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import { requireSuperadminForAPI } from "@/shared/core/services/superadmin-auth.service";
<<<<<<< HEAD
import { logger } from "@/shared/core/services/logger.service";
=======
import { z } from "zod";
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1

/**
 * Superadmin Plan Management API
 *
 * GET /api/superadmin/planos — List all plans
 * POST /api/superadmin/planos — Create a new plan (syncs with Stripe)
 * PUT /api/superadmin/planos — Update an existing plan (syncs with Stripe)
 * PATCH /api/superadmin/planos — Toggle plan active status
 *
 * Auth: Requires superadmin authentication
 */

const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

<<<<<<< HEAD
const createPlanSchema = z
  .object({
    name: z.string().min(1, "Nome e obrigatorio"),
    slug: z
      .string()
      .min(1, "Slug e obrigatorio")
      .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
=======
export const createPlanSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
    description: z.string().optional(),
    features: z.array(z.string()).default([]),
    price_monthly_cents: z.number().int().min(0),
    price_yearly_cents: z.number().int().min(0).optional(),
    currency: z.string().default("BRL"),
<<<<<<< HEAD
    max_active_students: z.number().int().min(0).nullable().optional(),
    max_courses: z.number().int().min(0).nullable().optional(),
    max_storage_mb: z.number().int().min(0).nullable().optional(),
    allowed_modules: z.array(z.string()).default([]),
    extra_student_price_cents: z.number().int().min(0).nullable().optional(),
    display_order: z.number().int().default(0),
    is_featured: z.boolean().default(false),
    badge_text: z.string().nullable().optional(),
=======
    max_active_students: z.number().int().positive().optional(),
    max_courses: z.number().int().positive().optional(),
    max_storage_mb: z.number().int().positive().optional(),
    allowed_modules: z.array(z.string()).default([]),
    extra_student_price_cents: z.number().int().min(0).optional(),
    display_order: z.number().int().default(0),
    is_featured: z.boolean().default(false),
    badge_text: z.string().optional(),
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
  })
  .strip();

const updatePlanSchema = z
  .object({
<<<<<<< HEAD
    id: z.string().uuid("id deve ser um UUID valido"),
    name: z.string().min(1).optional(),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens")
      .optional(),
    description: z.string().nullable().optional(),
    features: z.array(z.string()).optional(),
    price_monthly_cents: z.number().int().min(0).optional(),
    price_yearly_cents: z.number().int().min(0).nullable().optional(),
    currency: z.string().optional(),
    max_active_students: z.number().int().min(0).nullable().optional(),
    max_courses: z.number().int().min(0).nullable().optional(),
    max_storage_mb: z.number().int().min(0).nullable().optional(),
=======
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    features: z.array(z.string()).optional(),
    price_monthly_cents: z.number().int().min(0).optional(),
    price_yearly_cents: z.number().int().min(0).nullable().optional(),
    max_active_students: z.number().int().positive().nullable().optional(),
    max_courses: z.number().int().positive().nullable().optional(),
    max_storage_mb: z.number().int().positive().nullable().optional(),
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
    allowed_modules: z.array(z.string()).optional(),
    extra_student_price_cents: z.number().int().min(0).nullable().optional(),
    display_order: z.number().int().optional(),
    is_featured: z.boolean().optional(),
    badge_text: z.string().nullable().optional(),
    active: z.boolean().optional(),
  })
  .strip();

const togglePlanSchema = z
  .object({
<<<<<<< HEAD
    id: z.string().uuid("id deve ser um UUID valido"),
=======
    id: z.string().uuid(),
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
    active: z.boolean(),
  })
  .strip();

export async function GET() {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const db = getDatabaseClient();
    const { data: plans, error } = await db
      .from("subscription_plans")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ plans });
  } catch (error) {
<<<<<<< HEAD
    logger.error("superadmin-plans", "GET error listing plans", {
=======
    logger.error("superadmin-planos", "Erro ao listar planos", {
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao listar planos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

<<<<<<< HEAD
    const body = await request.json();
    const parsed = createPlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados invalidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

=======
    const parsedBody = createPlanSchema.safeParse(await request.json());
    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = parsedBody.data as CreatePlanInput;

>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
    const {
      name,
      slug,
      description,
<<<<<<< HEAD
      features,
      price_monthly_cents,
      price_yearly_cents,
      currency,
      max_active_students,
      max_courses,
      max_storage_mb,
      allowed_modules,
      extra_student_price_cents,
      display_order,
      is_featured,
      badge_text,
    } = parsed.data;
=======
      features = [],
      price_monthly_cents,
      price_yearly_cents,
      currency = "BRL",
    } = body;
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1

    const db = getDatabaseClient();

    // Check slug uniqueness
    const { data: existing } = await db
      .from("subscription_plans")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um plano com este slug" },
        { status: 409 }
      );
    }

    // Create Stripe Product + Prices
    const stripe = getStripeClient();
    let stripeProductId: string | null = null;
    let stripePriceIdMonthly: string | null = null;
    let stripePriceIdYearly: string | null = null;

    // Only create in Stripe if price > 0 (skip for free plans)
    if (price_monthly_cents > 0) {
      const product = await stripe.products.create({
        name,
        description: description || undefined,
        metadata: { slug },
      });
      stripeProductId = product.id;

      const monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: price_monthly_cents,
        currency: currency.toLowerCase(),
        recurring: { interval: "month" },
      });
      stripePriceIdMonthly = monthlyPrice.id;

      if (price_yearly_cents && price_yearly_cents > 0) {
        const yearlyPrice = await stripe.prices.create({
          product: product.id,
          unit_amount: price_yearly_cents,
          currency: currency.toLowerCase(),
          recurring: { interval: "year" },
        });
        stripePriceIdYearly = yearlyPrice.id;
      }
    }

    // Save to database
    const { data: plan, error } = await db
      .from("subscription_plans")
      .insert({
        name,
        slug,
        description: description || null,
        features: features as unknown as string,
        price_monthly_cents,
        price_yearly_cents: price_yearly_cents || null,
        currency,
        stripe_product_id: stripeProductId,
        stripe_price_id_monthly: stripePriceIdMonthly,
        stripe_price_id_yearly: stripePriceIdYearly,
        max_active_students: max_active_students || null,
        max_courses: max_courses || null,
        max_storage_mb: max_storage_mb || null,
        allowed_modules: (allowed_modules || []) as unknown as string,
        extra_student_price_cents: extra_student_price_cents || null,
        display_order: display_order || 0,
        is_featured: is_featured || false,
        badge_text: badge_text || null,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    logger.info("superadmin-plans", "Plan created", { planId: plan.id, slug });

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
<<<<<<< HEAD
    logger.error("superadmin-plans", "POST error creating plan", {
=======
    logger.error("superadmin-planos", "Erro ao criar plano", {
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao criar plano" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

<<<<<<< HEAD
    const body = await request.json();
    const parsed = updatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados invalidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const validatedBody = parsed.data;
=======
    const parsedBody = updatePlanSchema.safeParse(await request.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const body = parsedBody.data as UpdatePlanInput & { id: string };
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1

    const db = getDatabaseClient();
    const stripe = getStripeClient();

    // Get current plan
    const { data: currentPlan } = await db
      .from("subscription_plans")
      .select("*")
      .eq("id", validatedBody.id)
      .single();

    if (!currentPlan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    // Update Stripe Product metadata if name/description changed
    if (currentPlan.stripe_product_id && (validatedBody.name || validatedBody.description)) {
      await stripe.products.update(currentPlan.stripe_product_id, {
        name: validatedBody.name || currentPlan.name,
        description: validatedBody.description || currentPlan.description || undefined,
      });
    }

    // Handle price changes (create new Stripe Price, archive old)
    let newMonthlyPriceId = currentPlan.stripe_price_id_monthly;
    let newYearlyPriceId = currentPlan.stripe_price_id_yearly;

    if (validatedBody.price_monthly_cents !== undefined && validatedBody.price_monthly_cents !== currentPlan.price_monthly_cents && currentPlan.stripe_product_id) {
      // Archive old price
      if (currentPlan.stripe_price_id_monthly) {
        await stripe.prices.update(currentPlan.stripe_price_id_monthly, { active: false });
      }
      // Create new price
      if (validatedBody.price_monthly_cents > 0) {
        const newPrice = await stripe.prices.create({
          product: currentPlan.stripe_product_id,
          unit_amount: validatedBody.price_monthly_cents,
          currency: (currentPlan.currency || "BRL").toLowerCase(),
          recurring: { interval: "month" },
        });
        newMonthlyPriceId = newPrice.id;
      }
    }

    if (validatedBody.price_yearly_cents !== undefined && validatedBody.price_yearly_cents !== currentPlan.price_yearly_cents && currentPlan.stripe_product_id) {
      if (currentPlan.stripe_price_id_yearly) {
        await stripe.prices.update(currentPlan.stripe_price_id_yearly, { active: false });
      }
      if (validatedBody.price_yearly_cents && validatedBody.price_yearly_cents > 0) {
        const newPrice = await stripe.prices.create({
          product: currentPlan.stripe_product_id,
          unit_amount: validatedBody.price_yearly_cents,
          currency: (currentPlan.currency || "BRL").toLowerCase(),
          recurring: { interval: "year" },
        });
        newYearlyPriceId = newPrice.id;
      }
    }

    // Update database
    const updateData: Record<string, unknown> = {};
    if (validatedBody.name !== undefined) updateData.name = validatedBody.name;
    if (validatedBody.description !== undefined) updateData.description = validatedBody.description;
    if (validatedBody.features !== undefined) updateData.features = validatedBody.features;
    if (validatedBody.price_monthly_cents !== undefined) updateData.price_monthly_cents = validatedBody.price_monthly_cents;
    if (validatedBody.price_yearly_cents !== undefined) updateData.price_yearly_cents = validatedBody.price_yearly_cents;
    if (validatedBody.max_active_students !== undefined) updateData.max_active_students = validatedBody.max_active_students;
    if (validatedBody.max_courses !== undefined) updateData.max_courses = validatedBody.max_courses;
    if (validatedBody.max_storage_mb !== undefined) updateData.max_storage_mb = validatedBody.max_storage_mb;
    if (validatedBody.allowed_modules !== undefined) updateData.allowed_modules = validatedBody.allowed_modules;
    if (validatedBody.extra_student_price_cents !== undefined) updateData.extra_student_price_cents = validatedBody.extra_student_price_cents;
    if (validatedBody.display_order !== undefined) updateData.display_order = validatedBody.display_order;
    if (validatedBody.is_featured !== undefined) updateData.is_featured = validatedBody.is_featured;
    if (validatedBody.badge_text !== undefined) updateData.badge_text = validatedBody.badge_text;
    if (validatedBody.active !== undefined) updateData.active = validatedBody.active;
    updateData.stripe_price_id_monthly = newMonthlyPriceId;
    updateData.stripe_price_id_yearly = newYearlyPriceId;

    const { data: plan, error } = await db
      .from("subscription_plans")
      .update(updateData)
      .eq("id", validatedBody.id)
      .select()
      .single();

    if (error) throw error;

    logger.info("superadmin-plans", "Plan updated", { planId: validatedBody.id });

    return NextResponse.json({ plan });
  } catch (error) {
<<<<<<< HEAD
    logger.error("superadmin-plans", "PUT error updating plan", {
=======
    logger.error("superadmin-planos", "Erro ao atualizar plano", {
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao atualizar plano" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

<<<<<<< HEAD
    const body = await request.json();
    const parsed = togglePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados invalidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { id, active } = parsed.data;
=======
    const parsedBody = togglePlanSchema.safeParse(await request.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { id, active } = parsedBody.data;
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1

    const db = getDatabaseClient();
    const stripe = getStripeClient();

    // Get current plan for Stripe sync
    const { data: currentPlan } = await db
      .from("subscription_plans")
      .select("stripe_price_id_monthly, stripe_price_id_yearly")
      .eq("id", id)
      .single();

    // Archive/reactivate Stripe prices
    if (currentPlan) {
      if (currentPlan.stripe_price_id_monthly) {
        await stripe.prices.update(currentPlan.stripe_price_id_monthly, { active });
      }
      if (currentPlan.stripe_price_id_yearly) {
        await stripe.prices.update(currentPlan.stripe_price_id_yearly, { active });
      }
    }

    const { data: plan, error } = await db
      .from("subscription_plans")
      .update({ active })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    logger.info("superadmin-plans", "Plan status toggled", { planId: id, active });

    return NextResponse.json({ plan });
  } catch (error) {
<<<<<<< HEAD
    logger.error("superadmin-plans", "PATCH error toggling plan status", {
=======
    logger.error("superadmin-planos", "Erro ao alterar status do plano", {
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao alterar status do plano" }, { status: 500 });
  }
}
