import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperadminForAPI } from "@/app/shared/core/services/superadmin-auth.service";
import { listWebhookEvents } from "@/app/shared/core/services/webhook-events.service";
import { logger } from "@/app/shared/core/services/logger.service";

const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

const querySchema = z
  .object({
    status: z.enum(["processing", "processed", "failed"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    starting_after: z.string().optional(),
  })
  .strip();

export async function GET(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const parsed = querySchema.safeParse({
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      starting_after: request.nextUrl.searchParams.get("starting_after") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = await listWebhookEvents(parsed.data);
    return NextResponse.json(data);
  } catch (error) {
    logger.error("superadmin-webhooks", "Erro ao listar webhooks", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Erro ao listar webhooks" },
      { status: 500 },
    );
  }
}
