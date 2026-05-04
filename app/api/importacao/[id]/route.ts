import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { importacaoService } from "@/app/shared/services/importacao";
import type { UpdateImportacaoInput } from "@/app/shared/types/entities/importacao";
import {
  ImportacaoNotFoundError,
  ImportacaoValidationError,
} from "@/app/shared/services/importacao/errors";
import { updateImportacaoSchema } from "@/app/shared/services/importacao/importacao.validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function handleError(error: unknown) {
  if (error instanceof ImportacaoNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ImportacaoValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const msg = error instanceof Error ? error.message : String(error);
  console.error("[Importacao API] Unhandled error:", msg, error);
  return NextResponse.json({ error: msg }, { status: 500 });
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  try {
    const job = await importacaoService.getById(
      params.id,
      request.user?.empresaId,
    );
    return NextResponse.json({ data: job });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => getHandler(req, params))(request);
}

async function patchHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const user = request.user;
  if (user?.role !== "usuario") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updateImportacaoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = parsed.data as unknown as UpdateImportacaoInput;
    const isMetadataOnly = !data.questoesJson;

    const job = isMetadataOnly
      ? await importacaoService.updateMetadata(params.id, data, user?.empresaId)
      : await importacaoService.updateRevisao(params.id, data, user?.empresaId);

    return NextResponse.json({ data: job });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => patchHandler(req, params))(request);
}

async function deleteHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const user = request.user;
  if (user?.role !== "usuario") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await importacaoService.delete(params.id, user?.empresaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => deleteHandler(req, params))(request);
}
