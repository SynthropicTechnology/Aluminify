import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/shared/core/database/database";
import { logger } from "@/shared/core/services/logger.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import { requireSuperadminForAPI } from "@/shared/core/services/superadmin-auth.service";
import { z } from "zod";

/**
 * Superadmin Subscription Management API
 *
 * GET /api/superadmin/assinaturas — List all subscriptions with tenant info
 * POST /api/superadmin/assinaturas — Execute admin actions (cancel, change plan)
 *
 * Auth: Requires superadmin authentication
 */

const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

export const subscriptionActionSchema = z
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

const subscriptionListQuerySchema = z
  .object({
    status: z
      .enum(["active", "past_due", "canceled", "unpaid", "trialing", "paused"])
      .optional(),
    plan_id: z.string().uuid().optional(),
    search: z.string().optional(),
  })
  .strip();

export async function GET(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const db = getDatabaseClient();
    const { searchParams } = request.nextUrl;

    const parsedQuery = subscriptionListQuerySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      plan_id: searchParams.get("plan_id") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsedQuery.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { status, plan_id: planId, search } = parsedQuery.data;

    let query = db
      .from("subscriptions")
      .select(`
        *,
        subscription_plans (id, name, slug, price_monthly_cents, price_yearly_cents),
        empresas (id, nome, slug)
      `)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (planId) {
      query = query.eq("plan_id", planId);
    }

    const { data: subscriptions, error } = await query;

    if (error) throw error;

    // Filter by search (tenant name) client-side since it's a join field
    let filtered = subscriptions || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((sub) => {
        const empresa = sub.empresas as { nome?: string } | null;
        return empresa?.nome?.toLowerCase().includes(searchLower);
      });
    }

    return NextResponse.json({ subscriptions: filtered });
  } catch (error) {
    logger.error("superadmin-assinaturas", "Erro ao listar assinaturas", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao listar assinaturas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const parsedBody = subscriptionActionSchema.safeParse(await request.json());

    if (!parsedBody.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsedBody.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { action, subscription_id, plan_id } = parsedBody.data;

    const db = getDatabaseClient();
    const stripe = getStripeClient();

    // Get local subscription
    const { data: subscription } = await db
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("id", subscription_id)
      .single();

    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "Assinatura não encontrada ou sem vínculo Stripe" },
        { status: 404 }
      );
    }

    switch (action) {
      case "cancel": {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        // Webhook will update local database
        return NextResponse.json({
          success: true,
          message: "Cancelamento solicitado. O webhook atualizará o status.",
        });
      }

      case "change_plan": {
        // Get new plan's Stripe price
        const { data: newPlan } = await db
          .from("subscription_plans")
          .select("stripe_price_id_monthly, stripe_price_id_yearly")
          .eq("id", plan_id)
          .single();

        if (!newPlan?.stripe_price_id_monthly) {
          return NextResponse.json(
            { error: "Plano de destino não tem preço configurado no Stripe" },
            { status: 400 }
          );
        }

        // Get current subscription items
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id
        );
        const currentItemId = stripeSubscription.items.data[0]?.id;

        if (!currentItemId) {
          return NextResponse.json(
            { error: "Não foi possível encontrar o item da assinatura no Stripe" },
            { status: 500 }
          );
        }

        // Update subscription with new price (Stripe handles proration)
        await stripe.subscriptions.update(
          subscription.stripe_subscription_id,
          {
            items: [
              {
                id: currentItemId,
                price: newPlan.stripe_price_id_monthly,
              },
            ],
          }
        );

        // Webhook will update local database
        return NextResponse.json({
          success: true,
          message: "Plano alterado. O webhook atualizará os dados.",
        });
      }

      default:
        return NextResponse.json(
          { error: `Ação desconhecida: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error("superadmin-assinaturas", "Erro ao executar acao", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao executar ação" },
      { status: 500 }
    );
  }
}
