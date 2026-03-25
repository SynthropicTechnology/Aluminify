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
 * GET /api/superadmin/assinaturas/[id] — Subscription detail with Stripe data
 */

<<<<<<< HEAD
const subscriptionIdSchema = z.object({
  id: z.string().uuid(),
});

const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
=======
const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

const subscriptionIdSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strip();
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

<<<<<<< HEAD
    const rawParams = await params;
    const parsedParams = subscriptionIdSchema.safeParse(rawParams);

    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Dados invalidos", details: parsedParams.error.flatten().fieldErrors },
        { status: 400 },
=======
    const parsedParams = subscriptionIdSchema.safeParse(await params);
    if (!parsedParams.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsedParams.error.flatten().fieldErrors,
        },
        { status: 400 }
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
      );
    }

    const { id } = parsedParams.data;
    const db = getDatabaseClient();

    // Local subscription data
    const { data: subscription, error } = await db
      .from("subscriptions")
      .select(`
        *,
        subscription_plans (*),
        empresas (id, nome, slug, stripe_customer_id)
      `)
      .eq("id", id)
      .single();

    if (error || !subscription) {
      return NextResponse.json(
        { error: "Assinatura não encontrada" },
        { status: 404 },
      );
    }

    // Fetch Stripe subscription details if linked
    let stripeData = null;
    if (subscription.stripe_subscription_id) {
      try {
        const stripe = getStripeClient();
        const stripeSub = await stripe.subscriptions.retrieve(
          subscription.stripe_subscription_id,
          { expand: ["default_payment_method", "latest_invoice"] },
        );

        stripeData = {
          id: stripeSub.id,
          status: stripeSub.status,
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          default_payment_method: stripeSub.default_payment_method,
          latest_invoice: stripeSub.latest_invoice,
          items: stripeSub.items.data.map((item) => ({
            id: item.id,
            price_id: item.price.id,
            amount: item.price.unit_amount,
            currency: item.price.currency,
            interval: item.price.recurring?.interval,
            current_period_start: item.current_period_start,
            current_period_end: item.current_period_end,
          })),
        };
      } catch (stripeError) {
<<<<<<< HEAD
        logger.error("superadmin-subscription-detail", "Stripe fetch error", {
          subscriptionId: id,
=======
        logger.error("superadmin-assinatura-detalhe", "Erro ao buscar dados Stripe", {
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
          error: stripeError instanceof Error ? stripeError.message : String(stripeError),
        });
      }
    }

    // Fetch invoices from Stripe
    let invoices: unknown[] = [];
    const empresa = subscription.empresas as { stripe_customer_id?: string } | null;
    if (empresa?.stripe_customer_id) {
      try {
        const stripe = getStripeClient();
        const stripeInvoices = await stripe.invoices.list({
          customer: empresa.stripe_customer_id,
          subscription: subscription.stripe_subscription_id || undefined,
          limit: 20,
        });

        invoices = stripeInvoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          status: inv.status,
          amount_due: inv.amount_due,
          amount_paid: inv.amount_paid,
          currency: inv.currency,
          created: inv.created,
          period_start: inv.period_start,
          period_end: inv.period_end,
          hosted_invoice_url: inv.hosted_invoice_url,
          invoice_pdf: inv.invoice_pdf,
        }));
      } catch (invoiceError) {
<<<<<<< HEAD
        logger.error("superadmin-subscription-detail", "Invoice fetch error", {
          subscriptionId: id,
=======
        logger.error("superadmin-assinatura-detalhe", "Erro ao buscar faturas Stripe", {
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
          error: invoiceError instanceof Error ? invoiceError.message : String(invoiceError),
        });
      }
    }

    return NextResponse.json({
      subscription,
      stripeData,
      invoices,
    });
  } catch (error) {
<<<<<<< HEAD
    logger.error("superadmin-subscription-detail", "GET error fetching subscription detail", {
=======
    logger.error("superadmin-assinatura-detalhe", "Erro ao buscar detalhe da assinatura", {
>>>>>>> 249b25702a9c6d93e5d63cdb791da445510067d1
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao buscar detalhes da assinatura" },
      { status: 500 },
    );
  }
}
