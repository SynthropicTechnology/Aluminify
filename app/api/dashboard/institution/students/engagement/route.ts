import { NextResponse } from "next/server";
import { requireAuth, type AuthenticatedRequest } from "@/app/[tenant]/auth/middleware";
import { studentEngagementService } from "@/app/[tenant]/(modules)/dashboard/services";
import type {
  StudentEngagementFilter,
} from "@/app/[tenant]/(modules)/dashboard/types";

const VALID_PERIODS = ["semanal", "mensal", "anual"] as const;
const VALID_FILTERS: StudentEngagementFilter[] = [
  "todos",
  "sem_acesso",
  "acessou_sem_estudo",
  "sem_cronograma",
  "baixo_engajamento",
  "sem_conclusao",
  "engajado",
];

async function getHandler(request: AuthenticatedRequest) {
  try {
    const empresaId = request.user?.empresaId;
    if (!request.user?.id) {
      return NextResponse.json({ error: "Usuário não autenticado" }, { status: 401 });
    }
    if (!request.user?.isAdmin) {
      return NextResponse.json(
        { error: "Acesso negado. Apenas administradores da instituição podem acessar estes dados." },
        { status: 403 },
      );
    }
    if (!empresaId) {
      return NextResponse.json({ error: "Empresa não encontrada para o usuário" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period") ?? "mensal";
    const filterParam = searchParams.get("filter") ?? "todos";
    const format = searchParams.get("format") ?? "json";
    const includeEngaged = searchParams.get("includeEngaged") === "true";

    const period = VALID_PERIODS.includes(periodParam as (typeof VALID_PERIODS)[number])
      ? (periodParam as (typeof VALID_PERIODS)[number])
      : "mensal";
    const filter = VALID_FILTERS.includes(filterParam as StudentEngagementFilter)
      ? (filterParam as StudentEngagementFilter)
      : "todos";

    const data = await studentEngagementService.getEngagementData(empresaId, {
      period,
      filter,
      includeEngaged,
    });

    if (format === "csv") {
      const csv = studentEngagementService.toCsv(data.students);
      const filename = `alunos-engajamento-${period}-${filter}.csv`;
      return new NextResponse(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[Student Engagement API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erro ao carregar alunos por engajamento",
      },
      { status: 500 },
    );
  }
}

export const GET = requireAuth(getHandler);
