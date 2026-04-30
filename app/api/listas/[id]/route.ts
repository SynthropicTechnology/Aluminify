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
import { updateListaSchema } from "@/app/shared/services/listas/lista.validation";

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
  console.error("[Listas API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  try {
    const user = request.user;
    const empresaId = user?.empresaId;

    if (user?.role === "aluno") {
      if (!empresaId || !user?.id) {
        return NextResponse.json(
          { error: "Empresa nao encontrada" },
          { status: 400 },
        );
      }
      const lista = await listaService.getParaAluno(
        params.id,
        user.id,
        empresaId,
      );
      return NextResponse.json({ data: lista });
    }

    const lista = await listaService.getById(params.id, empresaId);
    return NextResponse.json({ data: lista });
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
    const parsed = updateListaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const lista = await listaService.update(
      params.id,
      parsed.data,
      user?.empresaId,
    );
    return NextResponse.json({ data: lista });
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
    await listaService.delete(params.id, user?.empresaId);
    return NextResponse.json({ message: "Lista removida com sucesso" });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => deleteHandler(req, params))(request);
}
