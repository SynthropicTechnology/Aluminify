import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { respostaService } from "@/app/shared/services/listas";
import {
  ListaNotFoundError,
  RespostaValidationError,
} from "@/app/shared/services/listas/errors";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function handleError(error: unknown) {
  if (error instanceof ListaNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof RespostaValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[Resultado API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const user = request.user;
  if (!user?.id) {
    return NextResponse.json(
      { error: "Usuario nao encontrado" },
      { status: 400 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const tentativaParam = searchParams.get("tentativa");
    const tentativa = tentativaParam ? Number(tentativaParam) : undefined;

    const resultado = await respostaService.getResultado(
      params.id,
      user.id,
      tentativa,
    );
    return NextResponse.json({ data: resultado });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => getHandler(req, params))(request);
}
