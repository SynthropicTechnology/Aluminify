import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/shared/core/auth";
import { getDatabaseClient } from "@/shared/core/database/database";
import { logger } from "@/shared/core/services/logger.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import { z } from "zod";

const portalBodySchema = z.object({}).strip();

/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Billing Portal Session for subscription management.
 * Allows tenants to upgrade, downgrade, cancel, and update payment methods.
 *
 * No body required — uses authenticated user's empresa.
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        return NextResponse.json(
          { error: "Dados invalidos", details: { body: ["JSON invalido"] } },
          { status: 400 }
        );
      }

      const parsed = portalBodySchema.safeParse(parsedBody);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: "Dados invalidos",
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }
    }

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

    const db = getDatabaseClient();

    const { data: empresa } = await db
      .from("empresas")
      .select("stripe_customer_id")
      .eq("id", user.empresaId)
      .single();

    if (!empresa?.stripe_customer_id) {
      return NextResponse.json(
        { error: "Nenhuma assinatura ativa encontrada. Assine um plano primeiro." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();

    const baseUrl = request.headers.get("origin") || "";
    const tenantSlug = user.empresaSlug || "";

    const session = await stripe.billingPortal.sessions.create({
      customer: empresa.stripe_customer_id,
      return_url: `${baseUrl}/${tenantSlug}/configuracoes/plano`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logger.error("stripe-portal", "Erro ao criar sessao do portal", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao criar sessão do portal" },
      { status: 500 }
    );
  }
}
