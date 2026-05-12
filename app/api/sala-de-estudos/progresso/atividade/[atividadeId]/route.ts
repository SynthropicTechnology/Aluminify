import { NextResponse, type NextRequest } from "next/server";
import {
  progressoAtividadeService,
  ProgressoNotFoundError,
  ProgressoValidationError,
} from "@/app/[tenant]/(modules)/sala-de-estudos/services/atividades";
import {
  atividadeService,
  atividadeRequerDesempenho,
} from "@/app/[tenant]/(modules)/sala-de-estudos/services/atividades";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";
import {
  requireAuth,
  AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import type { StatusAtividade } from "@/app/[tenant]/(modules)/sala-de-estudos/services/atividades";

const serializeProgresso = (
  progresso: Awaited<
    ReturnType<typeof progressoAtividadeService.getProgressoById>
  >,
) => ({
  id: progresso.id,
  alunoId: progresso.alunoId,
  atividadeId: progresso.atividadeId,
  status: progresso.status,
  dataInicio: progresso.dataInicio?.toISOString() || null,
  dataConclusao: progresso.dataConclusao?.toISOString() || null,
  questoesTotais: progresso.questoesTotais,
  questoesAcertos: progresso.questoesAcertos,
  dificuldadePercebida: progresso.dificuldadePercebida,
  anotacoesPessoais: progresso.anotacoesPessoais,
  createdAt: progresso.createdAt.toISOString(),
  updatedAt: progresso.updatedAt.toISOString(),
});

function handleError(error: unknown) {
  if (error instanceof ProgressoNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ProgressoValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  console.error("Progresso API Error:", error);
  let errorMessage = "Internal server error";
  if (error instanceof Error) {
    errorMessage = error.message || errorMessage;
    console.error("Error stack:", error.stack);
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (error && typeof error === "object" && "message" in error) {
    errorMessage = String(error.message);
  }

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

interface RouteContext {
  params: Promise<{ atividadeId: string }>;
}

// PATCH: Atualizar progresso de uma atividade (por atividadeId)
async function patchHandler(
  request: AuthenticatedRequest,
  params: { atividadeId: string },
) {
  try {
    // Usar aluno_id do usuário autenticado
    const alunoId = request.user?.id;
    if (!alunoId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verificar permissão: aluno só pode atualizar seu próprio progresso
    if (
      request.user &&
      request.user.role !== "usuario"
    ) {
      // Já validado acima, alunoId é do usuário autenticado
    }

    const body = await request.json();
    const status = body?.status as StatusAtividade | undefined;
    if (!status) {
      return NextResponse.json(
        { error: "Missing parameter: status is required" },
        { status: 400 },
      );
    }

    // Resolver empresa_id do conteúdo (evita vazamento multi-org).
    // Fonte de verdade: `atividades.empresa_id` (obrigatório).
    const db = getDatabaseClient();
    const { data: atividadeMeta, error: atividadeMetaError } = await db
      .from("atividades")
      .select("empresa_id, tipo")
      .eq("id", params.atividadeId)
      .maybeSingle<{ empresa_id: string; tipo: string }>();

    if (atividadeMetaError || !atividadeMeta) {
      return NextResponse.json(
        { error: "Atividade não encontrada" },
        { status: 404 },
      );
    }

    const empresaId = atividadeMeta.empresa_id;

    // Se for aluno, garantir que ele tem vínculo com a empresa da atividade
    // (aluno multi-org não pode gravar/ler dados de outra empresa por acidente).
    if (request.user?.role === "aluno") {
      const courseIds = await fetchCanonicalCourseIdsForStudent(
        db,
        alunoId,
        empresaId,
      );

      if (courseIds.length === 0) {
        return NextResponse.json(
          {
            error:
              "Acesso negado: esta atividade pertence a outra empresa/organização",
          },
          { status: 403 },
        );
      }
    }

    // Se for concluir, verificar se precisa de dados de desempenho
    if (status === "Concluido" && body.desempenho) {
      // Buscar atividade para validar tipo
      const atividade = await atividadeService.getById(params.atividadeId);

      // Validar se o tipo requer desempenho
      if (atividadeRequerDesempenho(atividade.tipo)) {
        // Validar dados de desempenho
        const desempenho = body.desempenho;
        // Importante: questoesAcertos pode ser 0, então não podemos validar com "falsy"
        if (
          desempenho.questoesTotais == null ||
          desempenho.questoesAcertos == null ||
          desempenho.dificuldadePercebida == null
        ) {
          return NextResponse.json(
            {
              error:
                "Este tipo de atividade requer registro completo de desempenho (questões totais, acertos e dificuldade)",
            },
            { status: 400 },
          );
        }

        // Marcar como concluído com desempenho
        const updated =
          await progressoAtividadeService.marcarComoConcluidoComDesempenho(
            alunoId,
            params.atividadeId,
            {
              questoesTotais: desempenho.questoesTotais,
              questoesAcertos: desempenho.questoesAcertos,
              dificuldadePercebida: desempenho.dificuldadePercebida,
              anotacoesPessoais: desempenho.anotacoesPessoais || null,
            },
            empresaId,
          );
        return NextResponse.json({ data: serializeProgresso(updated) });
      }
      // Se não requer desempenho, continuar com updateStatus normal
    } else if (status === "Concluido") {
      // Verificar se requer desempenho mas não foi fornecido
      const atividade = await atividadeService.getById(params.atividadeId);
      if (atividadeRequerDesempenho(atividade.tipo)) {
        return NextResponse.json(
          {
            error:
              'Este tipo de atividade requer registro de desempenho. Forneça os dados no campo "desempenho".',
          },
          { status: 400 },
        );
      }
    }

    // Atualização normal (Iniciado, Pendente, ou Concluido sem desempenho)
    const updated = await progressoAtividadeService.updateStatus(
      alunoId,
      params.atividadeId,
      status,
      empresaId,
    );
    return NextResponse.json({ data: serializeProgresso(updated) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireAuth((req) => patchHandler(req, params))(request);
}
