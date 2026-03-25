import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDatabaseClient } from "@/shared/core/database/database";
import { logger } from "@/shared/core/services/logger.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import { requireSuperadminForAPI } from "@/shared/core/services/superadmin-auth.service";

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

const subscriptionListQuerySchema = z
  .object({
    status: z.string().optional(),
    plan_id: z.string().uuid().optional(),
    search: z.string().optional(),
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

export async function GET(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const { searchParams } = request.nextUrl;

    const queryParams = {
      status: searchParams.get("status") || undefined,
      plan_id: searchParams.get("plan_id") || undefined,
      search: searchParams.get("search") || undefined,
    };

    const parsed = subscriptionListQuerySchema.safeParse(queryParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados invalidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { status, plan_id: planId, search } = parsed.data;

    const db = getDatabaseClient();

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
    logger.error("superadmin-subscriptions", "GET error listing subscriptions", {
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

    const body = await request.json();
    const parsed = subscriptionActionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados invalidos", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { action, subscription_id, plan_id } = parsed.data;

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
        logger.info("superadmin-subscriptions", "Subscription canceled", {
          subscriptionId: subscription_id,
        });
        // Webhook will update local database
        return NextResponse.json({
          success: true,
          message: "Cancelamento solicitado. O webhook atualizará o status.",
        });
      }

      case "change_plan": {
        // plan_id is guaranteed by schema refinement
        // Get new plan's Stripe price
        const { data: newPlan } = await db
          .from("subscription_plans")
          .select("stripe_price_id_monthly, stripe_price_id_yearly")
          .eq("id", plan_id!)
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

        logger.info("superadmin-subscriptions", "Subscription plan changed", {
          subscriptionId: subscription_id,
          newPlanId: plan_id,
        });

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
    logger.error("superadmin-subscriptions", "POST error executing action", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao executar ação" },
      { status: 500 }
    );
  }
}
