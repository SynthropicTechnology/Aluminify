import { NextResponse } from "next/server";
import { requireAuth, AuthenticatedRequest } from "@/app/[tenant]/auth/middleware";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import { institutionAnalyticsService } from "@/app/[tenant]/(modules)/dashboard/services";

/**
 * GET /api/dashboard/leaderboard
 *
 * Retorna o ranking de alunos (por tempo de estudo) da empresa.
 * Acessível a alunos e membros da equipe (para exibir no dashboard do aluno).
 */
async function getHandler(request: AuthenticatedRequest) {
  try {
    const userId = request.user?.id;
    if (!userId) {
      return NextResponse.json(
        { error: "Usuário não autenticado" },
        { status: 401 },
      );
    }

    const role = request.user?.role;
    if (!["aluno", "professor", "usuario"].includes(role || "")) {
      return NextResponse.json(
        {
          error:
            "Acesso negado. Apenas alunos e membros da equipe podem acessar o ranking.",
        },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const empresaId = searchParams.get("empresa_id") || request.user?.empresaId || undefined;

    if (!empresaId) {
      return NextResponse.json(
        { error: "Empresa não informada ou usuário sem vínculo com empresa." },
        { status: 400 },
      );
    }

    // Aluno só pode ver ranking da(s) empresa(s) em que está vinculado
    if (role === "aluno") {
      const client = getDatabaseClient();
      const { data: vinculos } = await client
        .from("usuarios_empresas")
        .select("empresa_id")
        .eq("usuario_id", userId)
        .eq("ativo", true)
        .is("deleted_at", null);

      const empresasDoAluno = new Set(
        (vinculos ?? []).map((v) => v.empresa_id as string),
      );

      // Se empresa_id veio da query, validar que o aluno pertence a ela
      if (!empresasDoAluno.has(empresaId)) {
        return NextResponse.json(
          { error: "Acesso negado. Você não tem vínculo com esta instituição." },
          { status: 403 },
        );
      }
    }

    const client = getDatabaseClient();
    const ranking = await institutionAnalyticsService.getStudentRanking(
      empresaId,
      client,
      "mensal",
      10,
    );

    return NextResponse.json({
      success: true,
      data: { studentRanking: ranking },
    });
  } catch (error) {
    console.error("Dashboard Leaderboard API Error:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao carregar ranking";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = requireAuth(getHandler);
