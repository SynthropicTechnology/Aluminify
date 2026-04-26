import { NextResponse, type NextRequest } from "next/server";

import {
  requireAuth,
  type AuthenticatedRequest,
} from "@/app/[tenant]/auth/middleware";
import {
  StudentUsageReportService,
  type StudentUsageReportScope,
  type StudentUsageReportUsageFilter,
} from "@/app/[tenant]/(modules)/usuario/services/student-usage-report.service";

const VALID_SCOPES = new Set<StudentUsageReportScope>([
  "active",
  "inactive",
  "all",
  "filtered",
]);

const VALID_USAGE_FILTERS = new Set<StudentUsageReportUsageFilter>([
  "all",
  "no_access",
  "no_cronograma",
  "no_aulas",
  "no_atividades",
  "no_sessoes",
  "no_flashcards",
  "no_ai_chat",
  "no_agendamentos",
]);

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function parseEndDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function sanitizeFilenamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .toLowerCase();
}

async function getHandler(request: AuthenticatedRequest) {
  try {
    const user = request.user;
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    if (user.role !== "usuario" || !user.isAdmin) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    const empresaId = user.empresaId;
    if (!empresaId) {
      return NextResponse.json(
        { error: "Tenant ativo não encontrado para exportação" },
        { status: 400 },
      );
    }

    const params = request.nextUrl.searchParams;
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const rawScope = params.get("scope") || "active";
    const scope: StudentUsageReportScope = VALID_SCOPES.has(rawScope as StudentUsageReportScope)
      ? (rawScope as StudentUsageReportScope)
      : "active";

    const rawUsageFilter = params.get("usageFilter") || "all";
    const usageFilter: StudentUsageReportUsageFilter = VALID_USAGE_FILTERS.has(
      rawUsageFilter as StudentUsageReportUsageFilter,
    )
      ? (rawUsageFilter as StudentUsageReportUsageFilter)
      : "all";

    const periodStart = parseDate(params.get("periodStart"), defaultStart);
    const periodEnd = parseEndDate(params.get("periodEnd"), now);
    if (periodStart > periodEnd) {
      return NextResponse.json(
        { error: "A data inicial não pode ser maior que a data final" },
        { status: 400 },
      );
    }

    const service = new StudentUsageReportService();
    const studentIds = params
      .get("studentIds")
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const report = await service.buildReport({
      empresaId,
      tenantSlug: params.get("tenant") || undefined,
      periodStart,
      periodEnd,
      scope,
      usageFilter,
      filters: {
        query: params.get("query") || undefined,
        courseId: params.get("courseId") || undefined,
        turmaId: params.get("turmaId") || undefined,
        status: params.get("status") === "active" || params.get("status") === "inactive"
          ? (params.get("status") as "active" | "inactive")
          : undefined,
        studentIds,
      },
    });

    if (params.get("format") === "json") {
      return NextResponse.json(report);
    }

    const buffer = await service.generateWorkbookBuffer(report);

    const filename = `relatorio-uso-alunos-${sanitizeFilenamePart(
      params.get("tenant") || "tenant",
    )}-${periodStart.toISOString().split("T")[0]}-${periodEnd
      .toISOString()
      .split("T")[0]}.xlsx`;
    const body = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error("Erro ao gerar relatório de uso dos alunos:", error);
    return NextResponse.json(
      { error: "Erro ao gerar relatório de uso dos alunos" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return requireAuth(getHandler)(request);
}
