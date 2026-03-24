import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/shared/core/database/database";
import { logger } from "@/shared/core/services/logger.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import type { CreatePlanInput, UpdatePlanInput } from "@/shared/types/entities/subscription";
import { requireSuperadminForAPI } from "@/shared/core/services/superadmin-auth.service";
import { z } from "zod";

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

export const createPlanSchema = z
  .object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
    features: z.array(z.string()).default([]),
    price_monthly_cents: z.number().int().min(0),
    price_yearly_cents: z.number().int().min(0).optional(),
    currency: z.string().default("BRL"),
    max_active_students: z.number().int().positive().optional(),
    max_courses: z.number().int().positive().optional(),
    max_storage_mb: z.number().int().positive().optional(),
    allowed_modules: z.array(z.string()).default([]),
    extra_student_price_cents: z.number().int().min(0).optional(),
    display_order: z.number().int().default(0),
    is_featured: z.boolean().default(false),
    badge_text: z.string().optional(),
  })
  .strip();

const updatePlanSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    features: z.array(z.string()).optional(),
    price_monthly_cents: z.number().int().min(0).optional(),
    price_yearly_cents: z.number().int().min(0).nullable().optional(),
    max_active_students: z.number().int().positive().nullable().optional(),
    max_courses: z.number().int().positive().nullable().optional(),
    max_storage_mb: z.number().int().positive().nullable().optional(),
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
    id: z.string().uuid(),
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
    logger.error("superadmin-planos", "Erro ao listar planos", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao listar planos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

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

    const {
      name,
      slug,
      description,
      features = [],
      price_monthly_cents,
      price_yearly_cents,
      currency = "BRL",
    } = body;

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
        max_active_students: body.max_active_students || null,
        max_courses: body.max_courses || null,
        max_storage_mb: body.max_storage_mb || null,
        allowed_modules: (body.allowed_modules || []) as unknown as string,
        extra_student_price_cents: body.extra_student_price_cents || null,
        display_order: body.display_order || 0,
        is_featured: body.is_featured || false,
        badge_text: body.badge_text || null,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    logger.error("superadmin-planos", "Erro ao criar plano", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao criar plano" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

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

    const db = getDatabaseClient();
    const stripe = getStripeClient();

    // Get current plan
    const { data: currentPlan } = await db
      .from("subscription_plans")
      .select("*")
      .eq("id", body.id)
      .single();

    if (!currentPlan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    // Update Stripe Product metadata if name/description changed
    if (currentPlan.stripe_product_id && (body.name || body.description)) {
      await stripe.products.update(currentPlan.stripe_product_id, {
        name: body.name || currentPlan.name,
        description: body.description || currentPlan.description || undefined,
      });
    }

    // Handle price changes (create new Stripe Price, archive old)
    let newMonthlyPriceId = currentPlan.stripe_price_id_monthly;
    let newYearlyPriceId = currentPlan.stripe_price_id_yearly;

    if (body.price_monthly_cents !== undefined && body.price_monthly_cents !== currentPlan.price_monthly_cents && currentPlan.stripe_product_id) {
      // Archive old price
      if (currentPlan.stripe_price_id_monthly) {
        await stripe.prices.update(currentPlan.stripe_price_id_monthly, { active: false });
      }
      // Create new price
      if (body.price_monthly_cents > 0) {
        const newPrice = await stripe.prices.create({
          product: currentPlan.stripe_product_id,
          unit_amount: body.price_monthly_cents,
          currency: (currentPlan.currency || "BRL").toLowerCase(),
          recurring: { interval: "month" },
        });
        newMonthlyPriceId = newPrice.id;
      }
    }

    if (body.price_yearly_cents !== undefined && body.price_yearly_cents !== currentPlan.price_yearly_cents && currentPlan.stripe_product_id) {
      if (currentPlan.stripe_price_id_yearly) {
        await stripe.prices.update(currentPlan.stripe_price_id_yearly, { active: false });
      }
      if (body.price_yearly_cents && body.price_yearly_cents > 0) {
        const newPrice = await stripe.prices.create({
          product: currentPlan.stripe_product_id,
          unit_amount: body.price_yearly_cents,
          currency: (currentPlan.currency || "BRL").toLowerCase(),
          recurring: { interval: "year" },
        });
        newYearlyPriceId = newPrice.id;
      }
    }

    // Update database
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.price_monthly_cents !== undefined) updateData.price_monthly_cents = body.price_monthly_cents;
    if (body.price_yearly_cents !== undefined) updateData.price_yearly_cents = body.price_yearly_cents;
    if (body.max_active_students !== undefined) updateData.max_active_students = body.max_active_students;
    if (body.max_courses !== undefined) updateData.max_courses = body.max_courses;
    if (body.max_storage_mb !== undefined) updateData.max_storage_mb = body.max_storage_mb;
    if (body.allowed_modules !== undefined) updateData.allowed_modules = body.allowed_modules;
    if (body.extra_student_price_cents !== undefined) updateData.extra_student_price_cents = body.extra_student_price_cents;
    if (body.display_order !== undefined) updateData.display_order = body.display_order;
    if (body.is_featured !== undefined) updateData.is_featured = body.is_featured;
    if (body.badge_text !== undefined) updateData.badge_text = body.badge_text;
    if (body.active !== undefined) updateData.active = body.active;
    updateData.stripe_price_id_monthly = newMonthlyPriceId;
    updateData.stripe_price_id_yearly = newYearlyPriceId;

    const { data: plan, error } = await db
      .from("subscription_plans")
      .update(updateData)
      .eq("id", body.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ plan });
  } catch (error) {
    logger.error("superadmin-planos", "Erro ao atualizar plano", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao atualizar plano" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

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

    return NextResponse.json({ plan });
  } catch (error) {
    logger.error("superadmin-planos", "Erro ao alterar status do plano", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Erro ao alterar status do plano" }, { status: 500 });
  }
}
