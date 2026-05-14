import { NextResponse } from "next/server";
import { requireAuth, AuthenticatedRequest } from "@/app/[tenant]/auth/middleware";
import { institutionAnalyticsService } from "@/app/[tenant]/(modules)/dashboard/services";

/**
 * GET /api/dashboard/institution
 *
 * Retorna dados agregados do dashboard da instituição.
 * Apenas para administradores da instituição.
 *
 * Agrega dados de:
 * - Total de alunos, professores e cursos
 * - Horas de estudo agregadas
 * - Ranking de alunos (por tempo de estudo)
 * - Ranking de professores (por alunos atendidos)
 * - Performance por disciplina
 */
async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.id;
    const empresaId = request.user?.empresaId;
    if (!userId) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 },
      );
    }

    // Verificar se é admin da empresa
    if (!request.user?.isAdmin) {
      return NextResponse.json(
        {
          error:
            "Acesso negado. Apenas administradores da instituição podem acessar este dashboard.",
        },
        { status: 403 },
      );
    }

    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa não encontrada para o usuário" },
        { status: 400 },
      );
    }

    // Obter parâmetro de período (semanal, mensal, anual)
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "mensal") as
      | "semanal"
      | "mensal"
      | "anual";

    // Validar período
    if (!["semanal", "mensal", "anual"].includes(period)) {
      return NextResponse.json(
        { error: "Período inválido. Use: semanal, mensal ou anual" },
        { status: 400 },
      );
    }

    // Buscar dados agregados do dashboard
    const dashboardData =
      await institutionAnalyticsService.getInstitutionDashboard(
        empresaId,
        period,
        userId,
      );

    return NextResponse.json({ success: true, data: dashboardData });
  } catch (error) {
    console.error("Institution Dashboard API Error:", error);

    let errorMessage = "Erro ao carregar dados do dashboard";
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
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
}

export const GET = requireAuth(getHandler);
