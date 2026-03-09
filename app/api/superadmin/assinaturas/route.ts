import { NextRequest, NextResponse } from "next/server";
import { getDatabaseClient } from "@/shared/core/database/database";
import { getStripeClient } from "@/shared/core/services/stripe.service";

/**
 * Superadmin Subscription Management API
 *
 * GET /api/superadmin/assinaturas — List all subscriptions with tenant info
 * POST /api/superadmin/assinaturas — Execute admin actions (cancel, change plan)
 */

export async function GET(request: NextRequest) {
  try {
    const db = getDatabaseClient();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const planId = searchParams.get("plan_id");
    const search = searchParams.get("search");

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
    console.error("[Superadmin Subscriptions] GET error:", error);
    return NextResponse.json(
      { error: "Erro ao listar assinaturas" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, subscription_id, plan_id } = body as {
      action: "cancel" | "change_plan";
      subscription_id: string;
      plan_id?: string;
    };

    if (!action || !subscription_id) {
      return NextResponse.json(
        { error: "action e subscription_id são obrigatórios" },
        { status: 400 }
      );
    }

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
        if (!plan_id) {
          return NextResponse.json(
            { error: "plan_id é obrigatório para change_plan" },
            { status: 400 }
          );
        }

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
    console.error("[Superadmin Subscriptions] POST error:", error);
    return NextResponse.json(
      { error: "Erro ao executar ação" },
      { status: 500 }
    );
  }
}
