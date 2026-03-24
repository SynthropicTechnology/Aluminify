import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/shared/core/auth";
import { getDatabaseClient } from "@/shared/core/database/database";
import { logger } from "@/shared/core/services/logger.service";
import { rateLimitService } from "@/shared/core/services/rate-limit/rate-limit.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import { z } from "zod";

export const checkoutBodySchema = z
  .object({
    plan_id: z.string().uuid("plan_id deve ser um UUID valido"),
    billing_interval: z.enum(["month", "year"]).default("month"),
  })
  .strip();

/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for a subscription purchase.
 *
 * Body: { plan_id: string, billing_interval: "month" | "year" }
 *
 * Flow:
 * 1. Verify authenticated user with admin role
 * 2. Fetch plan from subscription_plans
 * 3. Create or retrieve Stripe Customer
 * 4. Create Checkout Session (mode: subscription)
 * 5. Return session URL
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();

    if (!user || !user.empresaId) {
      return NextResponse.json(
        { error: "Não autenticado ou sem empresa vinculada" },
        { status: 401 }
      );
    }

    if (!user.isAdmin) {
      return NextResponse.json(
        { error: "Apenas administradores podem gerenciar assinaturas" },
        { status: 403 }
      );
    }

    if (!rateLimitService.checkLimit(`checkout:${user.empresaId}`)) {
      return NextResponse.json(
        { error: "Muitas requisicoes. Tente novamente em alguns segundos." },
        { status: 429 }
      );
    }

    const parsed = checkoutBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { plan_id, billing_interval } = parsed.data;

    const db = getDatabaseClient();

    // Fetch plan
    const { data: plan, error: planError } = await db
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("active", true)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plano não encontrado ou inativo" },
        { status: 404 }
      );
    }

    // Determine price ID
    const priceId =
      billing_interval === "year"
        ? plan.stripe_price_id_yearly
        : plan.stripe_price_id_monthly;

    if (!priceId) {
      return NextResponse.json(
        { error: "Preço não configurado para este intervalo de cobrança" },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    // Get or create Stripe Customer
    const { data: empresa } = await db
      .from("empresas")
      .select("stripe_customer_id, nome")
      .eq("id", user.empresaId)
      .single();

    let stripeCustomerId = empresa?.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: empresa?.nome || undefined,
        metadata: {
          empresa_id: user.empresaId,
        },
      });
      stripeCustomerId = customer.id;

      // Store customer ID
      await db
        .from("empresas")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", user.empresaId);
    }

    // Determine URLs
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const tenantSlug = user.empresaSlug || "";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/${tenantSlug}/configuracoes/plano?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/${tenantSlug}/configuracoes/plano`,
      metadata: {
        empresa_id: user.empresaId,
        plan_id: plan_id,
        billing_interval: billing_interval,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("stripe-checkout", "Erro ao criar checkout", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao criar sessão de checkout" },
      { status: 500 }
    );
  }
}
