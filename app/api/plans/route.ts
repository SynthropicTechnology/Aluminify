import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/shared/core/database/database";
import type { PublicPlan } from "@/shared/types/entities/subscription";

/**
 * GET /api/plans
 *
 * Public endpoint to list active subscription plans for the pricing page.
 * No authentication required.
 * Excludes Stripe IDs and internal fields.
 */
export async function GET() {
  try {
    const db = getDatabaseClient();

    const { data: plans, error } = await db
      .from("subscription_plans")
      .select(
        "id, name, slug, description, features, price_monthly_cents, price_yearly_cents, currency, max_active_students, max_courses, max_storage_mb, extra_student_price_cents, display_order, is_featured, badge_text"
      )
      .eq("active", true)
      .order("display_order", { ascending: true });

    if (error) throw error;

    const publicPlans: PublicPlan[] = (plans || []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
      price_monthly_cents: plan.price_monthly_cents,
      price_yearly_cents: plan.price_yearly_cents,
      currency: plan.currency,
      max_active_students: plan.max_active_students,
      max_courses: plan.max_courses,
      max_storage_mb: plan.max_storage_mb,
      extra_student_price_cents: plan.extra_student_price_cents,
      display_order: plan.display_order,
      is_featured: plan.is_featured,
      badge_text: plan.badge_text,
    }));

    return NextResponse.json({ plans: publicPlans });
  } catch (error) {
    console.error("[Plans API] Error:", error);
    return NextResponse.json(
      { error: "Erro ao listar planos" },
      { status: 500 }
    );
  }
}
