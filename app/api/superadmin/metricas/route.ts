import { NextResponse } from "next/server";
import { getDatabaseClient } from "@/shared/core/database/database";
import { logger } from "@/shared/core/services/logger.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import { requireSuperadminForAPI } from "@/shared/core/services/superadmin-auth.service";

/**
 * GET /api/superadmin/metricas — Subscription metrics dashboard
 */

const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

export async function GET() {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const db = getDatabaseClient();

    // Subscription counts by status
    const { data: subscriptions } = await db
      .from("subscriptions")
      .select("id, status, plan_id, billing_interval, created_at, canceled_at");

    const allSubs = subscriptions || [];

    const statusCounts: Record<string, number> = {};
    let totalActive = 0;
    let totalCanceled = 0;
    let monthlyCount = 0;
    let yearlyCount = 0;

    for (const sub of allSubs) {
      statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;
      if (sub.status === "active" || sub.status === "trialing") totalActive++;
      if (sub.status === "canceled") totalCanceled++;
      if (sub.status === "active") {
        if (sub.billing_interval === "year") yearlyCount++;
        else monthlyCount++;
      }
    }

    // Plan distribution
    const { data: plans } = await db
      .from("subscription_plans")
      .select("id, name, price_monthly_cents");

    const planMap = new Map(
      (plans || []).map((p) => [p.id, p]),
    );

    const planDistribution: Record<string, { name: string; count: number; revenue_cents: number }> = {};
    for (const sub of allSubs) {
      if (sub.status !== "active" && sub.status !== "trialing") continue;
      const plan = planMap.get(sub.plan_id);
      if (!plan) continue;
      if (!planDistribution[sub.plan_id]) {
        planDistribution[sub.plan_id] = {
          name: plan.name,
          count: 0,
          revenue_cents: 0,
        };
      }
      planDistribution[sub.plan_id].count++;
      planDistribution[sub.plan_id].revenue_cents += plan.price_monthly_cents;
    }

    // MRR estimate (active subscriptions × monthly price)
    let estimatedMRR = 0;
    for (const dist of Object.values(planDistribution)) {
      estimatedMRR += dist.revenue_cents;
    }

    // Stripe balance (optional, may fail if not configured)
    let stripeBalance = null;
    try {
      const stripe = getStripeClient();
      const balance = await stripe.balance.retrieve();
      stripeBalance = {
        available: balance.available.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
        pending: balance.pending.map((b) => ({
          amount: b.amount,
          currency: b.currency,
        })),
      };
    } catch {
      // Stripe not configured or no permissions
    }

    // Tenant count
    const { count: totalTenants } = await db
      .from("empresas")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true);

    // Recent cancellations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCancellations = allSubs.filter(
      (s) =>
        s.status === "canceled" &&
        s.canceled_at &&
        new Date(s.canceled_at) > thirtyDaysAgo,
    ).length;

    return NextResponse.json({
      totalSubscriptions: allSubs.length,
      totalActive,
      totalCanceled,
      totalTenants: totalTenants || 0,
      monthlyCount,
      yearlyCount,
      estimatedMRR,
      recentCancellations,
      statusCounts,
      planDistribution: Object.values(planDistribution),
      stripeBalance,
    });
  } catch (error) {
    logger.error("superadmin-metricas", "Erro ao buscar metricas", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao buscar métricas" },
      { status: 500 },
    );
  }
}
