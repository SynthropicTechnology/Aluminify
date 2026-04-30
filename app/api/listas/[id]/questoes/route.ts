import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { listaService } from "@/app/shared/services/listas";
import {
  ListaNotFoundError,
  ListaValidationError,
} from "@/app/shared/services/listas/errors";
import {
  addQuestoesSchema,
  reorderQuestoesSchema,
} from "@/app/shared/services/listas/lista.validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function handleError(error: unknown) {
  if (error instanceof ListaNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ListaValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[Listas Questoes API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function postHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const user = request.user;
  if (user?.role !== "usuario") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const empresaId = user?.empresaId;
  if (!empresaId) {
    return NextResponse.json(
      { error: "Empresa nao encontrada" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const parsed = addQuestoesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await listaService.addQuestoes(params.id, parsed.data.questaoIds, empresaId);
    return NextResponse.json(
      { message: "Questoes adicionadas com sucesso" },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => postHandler(req, params))(request);
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
    const { searchParams } = new URL(request.url);
    const questaoId = searchParams.get("questaoId");
    if (!questaoId) {
      return NextResponse.json(
        { error: "questaoId query parameter is required" },
        { status: 400 },
      );
    }

    await listaService.removeQuestao(params.id, questaoId, user?.empresaId);
    return NextResponse.json({ message: "Questao removida da lista" });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => deleteHandler(req, params))(request);
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
    const parsed = reorderQuestoesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await listaService.reorderQuestoes(
      params.id,
      parsed.data.ordens,
      user?.empresaId,
    );
    return NextResponse.json({ message: "Questoes reordenadas com sucesso" });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => patchHandler(req, params))(request);
}
