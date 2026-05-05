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

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function postHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  try {
    const user = request.user;
    const empresaId = user?.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa não encontrada" },
        { status: 400 },
      );
    }
    if (user?.role === "aluno") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
    }

    const newLista = await listaService.duplicate(
      params.id,
      user?.id ?? null,
      empresaId,
    );
    return NextResponse.json({ data: newLista }, { status: 201 });
  } catch (error) {
    if (error instanceof ListaNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ListaValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[Listas Duplicate API]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => postHandler(req, params))(request);
}
