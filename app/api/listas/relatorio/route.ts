import { NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { listaService } from "@/app/shared/services/listas";

async function getHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user;
    if (user?.role === "aluno") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const empresaId = user?.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa nao encontrada" },
        { status: 400 },
      );
    }

    const relatorio = await listaService.getRelatorio(empresaId);
    return NextResponse.json({ data: relatorio });
  } catch (error) {
    console.error("[Listas Relatorio API]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export const GET = requireUserAuth(getHandler);
