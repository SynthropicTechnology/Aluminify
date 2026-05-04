import { NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { listaService } from "@/app/shared/services/listas";
import {
  ListaValidationError,
} from "@/app/shared/services/listas/errors";
import { createListaSchema } from "@/app/shared/services/listas/lista.validation";

function handleError(error: unknown) {
  if (error instanceof ListaValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("[Listas API]", error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function getHandler(request: AuthenticatedRequest) {
  try {
    const empresaId = request.user?.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa nao encontrada" },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const onlyAvailable = searchParams.get("available") === "true";
    const listas = onlyAvailable
      ? await listaService.listAvailable(empresaId)
      : await listaService.list(empresaId);
    return NextResponse.json({ data: listas });
  } catch (error) {
    return handleError(error);
  }
}

export const GET = requireUserAuth(getHandler);

async function postHandler(request: AuthenticatedRequest) {
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
    const parsed = createListaSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Dados invalidos",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const lista = await listaService.create({
      ...parsed.data,
      empresaId,
      createdBy: user?.id ?? null,
    });

    return NextResponse.json({ data: lista }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export const POST = requireUserAuth(postHandler);
