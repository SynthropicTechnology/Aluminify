import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { respostaService } from "@/app/shared/services/listas";

interface RouteContext {
  params: Promise<{ id: string }>;
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
    const progresso = await respostaService.getProgresso(params.id, user.id);
    return NextResponse.json({ data: progresso });
  } catch (error) {
    console.error("[Progresso API]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => getHandler(req, params))(request);
}
