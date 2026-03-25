import { NextResponse } from "next/server";
import { cronogramaService } from "@/app/[tenant]/(modules)/cronograma/services";
import {
  CronogramaConflictError,
  CronogramaValidationError,
  CronogramaTempoInsuficienteError,
} from "@/app/[tenant]/(modules)/cronograma/services/errors";
import {
  requireUserAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";

// Geração de cronograma pode ser demorada para muitas disciplinas/módulos
export const maxDuration = 120;

function handleError(error: unknown) {
  // Erros esperados de validação - log informativo apenas
  if (error instanceof CronogramaValidationError) {
    console.log("[Cronograma] Validação:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof CronogramaTempoInsuficienteError) {
    console.log(
      "[Cronograma] Tempo insuficiente:",
      JSON.stringify(error.detalhes),
    );
    return NextResponse.json(
      {
        error: error.message,
        detalhes: error.detalhes,
      },
      { status: 400 },
    );
  }

  if (error instanceof CronogramaConflictError) {
    console.log("[Cronograma] Conflito:", error.message);
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  // Erro inesperado - log completo para debug
  console.error("[Cronograma] Erro inesperado:", error);
  if (error instanceof Error) {
    console.error("[Cronograma] Stack:", error.stack);
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Internal server error";

  return NextResponse.json(
    {
      error: errorMessage,
      details:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.stack
            : String(error)
          : undefined,
    },
    { status: 500 },
  );
}

async function postHandler(request: AuthenticatedRequest) {
  console.log("[Cronograma API] Recebendo requisição POST");

  if (!request.user) {
    console.error("[Cronograma API] Usuário não autenticado");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cronograma API] Usuário autenticado:", request.user.id);

  try {
    const body = await request.json();
    console.log("[Cronograma API] Body recebido:", {
      aluno_id: body?.aluno_id,
      data_inicio: body?.data_inicio,
      data_fim: body?.data_fim,
      disciplinas_count: body?.disciplinas_ids?.length || 0,
    });

    // Validar campos obrigatórios
    if (!body?.aluno_id || !body?.data_inicio || !body?.data_fim || !body?.curso_alvo_id) {
      console.error("[Cronograma API] Campos obrigatórios faltando");
      return NextResponse.json(
        {
          error: "Campos obrigatórios: aluno_id, data_inicio, data_fim, curso_alvo_id",
        },
        { status: 400 },
      );
    }

    const payload = {
      ...body,
      prioridade_minima: Math.max(1, Number(body?.prioridade_minima ?? 1)),
      modulos_ids: Array.isArray(body?.modulos_ids)
        ? body.modulos_ids
        : undefined,
      excluir_aulas_concluidas:
        typeof body?.excluir_aulas_concluidas === "boolean"
          ? body.excluir_aulas_concluidas
          : true,
    };

    console.log("[Cronograma API] Payload preparado:", {
      disciplinas_ids: payload.disciplinas_ids?.length || 0,
      modulos_ids: payload.modulos_ids?.length || 0,
      curso_alvo_id: payload.curso_alvo_id,
      prioridade_minima: payload.prioridade_minima,
    });

    console.log("[Cronograma API] Chamando serviço...");
    const result = await cronogramaService.gerarCronograma(
      payload,
      request.user.id,
      request.user.email,
      request.user.empresaId,
      request.user.name,
    );
    console.log(
      "[Cronograma API] Cronograma gerado com sucesso:",
      result.cronograma?.id,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export const POST = requireUserAuth(postHandler);
