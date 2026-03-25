import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperadminForAPI } from "@/app/shared/core/services/superadmin-auth.service";
import { replayWebhookEvent } from "@/app/shared/core/services/webhook-events.service";
import { logger } from "@/app/shared/core/services/logger.service";

const unauthorized = () =>
  NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

const bodySchema = z
  .object({
    eventId: z.string().min(1),
  })
  .strip();

export async function POST(request: NextRequest) {
  try {
    const superadmin = await requireSuperadminForAPI();
    if (!superadmin) return unauthorized();

    const body = await request.json();
    const parsed = bodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await replayWebhookEvent(parsed.data.eventId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error("superadmin-webhooks", "Erro ao reprocessar webhook", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Erro ao reprocessar webhook" },
      { status: 500 },
    );
  }
}
