import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { questaoService } from "@/app/shared/services/questoes";
import {
  QuestaoNotFoundError,
  QuestaoValidationError,
} from "@/app/shared/services/questoes/errors";
import { updateQuestaoSchema } from "@/app/shared/services/questoes/questao.validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function handleError(error: unknown) {
  if (error instanceof QuestaoNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof QuestaoValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[Questoes API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  try {
    const questao = await questaoService.getById(
      params.id,
      request.user?.empresaId,
    );
    return NextResponse.json({ data: questao });
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
    const parsed = updateQuestaoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const questao = await questaoService.update(
      params.id,
      parsed.data,
      user?.empresaId,
    );
    return NextResponse.json({ data: questao });
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
    await questaoService.delete(params.id, user?.empresaId);
    return NextResponse.json({ message: "Questao removida com sucesso" });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => deleteHandler(req, params))(request);
}
