import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { importacaoService } from "@/app/shared/services/importacao";
import {
  ImportacaoNotFoundError,
  ImportacaoValidationError,
} from "@/app/shared/services/importacao/errors";
import { publicarSchema } from "@/app/shared/services/importacao/importacao.validation";

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
  console.error("[Importacao Publicar API]", error);
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
    const parsed = publicarSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const job = await importacaoService.publicar(
      params.id,
      empresaId,
      user?.id ?? null,
      {
        criarLista: parsed.data.criarLista,
        tituloLista: parsed.data.tituloLista,
        modosCorrecaoPermitidos: parsed.data.modosCorrecaoPermitidos,
      },
    );

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => postHandler(req, params))(request);
}
