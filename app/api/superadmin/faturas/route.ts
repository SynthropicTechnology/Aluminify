import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/shared/core/services/logger.service";
import { getStripeClient } from "@/shared/core/services/stripe.service";
import { requireSuperadminForAPI } from "@/shared/core/services/superadmin-auth.service";
import { z } from "zod";

/**
 * Superadmin Invoice API
 *
 * GET /api/superadmin/faturas — List invoices from Stripe
 *   Query params: customer, subscription, status, limit, starting_after
 */

const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

export const invoiceListQuerySchema = z
  .object({
    customer: z.string().optional(),
    subscription: z.string().optional(),
    status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    starting_after: z.string().optional(),
  })
  .strip();

export async function GET(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const { searchParams } = request.nextUrl;
    const parsedQuery = invoiceListQuerySchema.safeParse({
      customer: searchParams.get("customer") ?? undefined,
      subscription: searchParams.get("subscription") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      starting_after: searchParams.get("starting_after") ?? undefined,
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

    const { customer, subscription, status, limit, starting_after } = parsedQuery.data;

    const stripe = getStripeClient();

    const invoices = await stripe.invoices.list({
      customer,
      subscription,
      status,
      limit,
      starting_after,
    });

    const data = invoices.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      customer: inv.customer,
      subscription: typeof inv.parent?.subscription_details?.subscription === "string"
        ? inv.parent.subscription_details.subscription
        : inv.parent?.subscription_details?.subscription ?? null,
      status: inv.status,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      amount_remaining: inv.amount_remaining,
      currency: inv.currency,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      customer_email: inv.customer_email,
      customer_name: inv.customer_name,
    }));

    return NextResponse.json({
      invoices: data,
      has_more: invoices.has_more,
    });
  } catch (error) {
    logger.error("superadmin-faturas", "Erro ao listar faturas", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Erro ao listar faturas" },
      { status: 500 },
    );
  }
}
