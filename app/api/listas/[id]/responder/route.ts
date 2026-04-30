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
import { responderSchema } from "@/app/shared/services/listas/lista.validation";

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
  console.error("[Responder API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function postHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const user = request.user;
  if (!user?.id || !user?.empresaId) {
    return NextResponse.json(
      { error: "Empresa nao encontrada" },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();
    const parsed = responderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const resultado = await respostaService.responder(
      params.id,
      user.id,
      user.empresaId,
      parsed.data,
    );

    return NextResponse.json({ data: resultado }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => postHandler(req, params))(request);
}
