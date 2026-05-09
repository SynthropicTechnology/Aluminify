import { NextRequest, NextResponse } from "next/server";
import {
  requireUserAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import { sessaoEstudoService } from "@/app/[tenant]/(modules)/sala-de-estudos/services/sessao-estudo.service";
import type { LogPausa } from "@/app/shared/types/entities/activity";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  const user = request.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tentativa = Number(url.searchParams.get("tentativa") ?? "1");
  const listaId = params.id;

  try {
    const result = await sessaoEstudoService.getOrCreateListaSessao(
      user.id,
      listaId,
      tentativa,
      user.empresaId,
    );
    return NextResponse.json({
      data: {
        sessaoId: result.sessao.id,
        status: result.sessao.status,
        inicio: result.sessao.inicio,
        tempoAcumulado: result.tempoAcumulado,
      },
    });
  } catch (error) {
    console.error("[Sessao Lista API] GET error:", error);
    return NextResponse.json(
      { error: "Erro ao buscar sessão" },
      { status: 500 },
    );
  }
}

async function patchHandler(
  request: AuthenticatedRequest,
  _params: { id: string },
) {
  const user = request.user;
  if (!user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { sessaoId, action, logPausas } = body as {
      sessaoId: string;
      action: "heartbeat" | "pausar" | "finalizar";
      logPausas?: LogPausa[];
    };

    if (!sessaoId || !action) {
      return NextResponse.json(
        { error: "sessaoId e action são obrigatórios" },
        { status: 400 },
      );
    }

    if (action === "heartbeat") {
      await sessaoEstudoService.heartbeat(user.id, sessaoId);
      return NextResponse.json({ ok: true });
    }

    if (action === "pausar" || action === "finalizar") {
      const result = await sessaoEstudoService.pausarListaSessao(
        user.id,
        sessaoId,
        logPausas ?? [],
      );
      return NextResponse.json({
        data: {
          sessaoId: result.id,
          status: result.status,
          tempoLiquido: result.tempoTotalLiquidoSegundos,
        },
      });
    }

    return NextResponse.json({ error: "action inválida" }, { status: 400 });
  } catch (error) {
    console.error("[Sessao Lista API] PATCH error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao atualizar sessão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => getHandler(req, params))(request);
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => patchHandler(req, params))(request);
}

// POST alias for sendBeacon (which only sends POST)
export async function POST(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => patchHandler(req, params))(request);
}
