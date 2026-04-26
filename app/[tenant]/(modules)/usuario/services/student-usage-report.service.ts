import ExcelJS from "exceljs";

import { fetchAllRows } from "@/app/shared/core/database/fetch-all-rows";
import { fetchAllRowsChunked } from "@/app/shared/core/database/chunked-query";
import { getDatabaseClient } from "@/app/shared/core/database/database";

export type StudentUsageReportScope = "active" | "inactive" | "all" | "filtered";

export type StudentUsageReportUsageFilter =
  | "all"
  | "no_access"
  | "no_cronograma"
  | "no_aulas"
  | "no_atividades"
  | "no_sessoes"
  | "no_flashcards"
  | "no_ai_chat"
  | "no_agendamentos";

export interface StudentUsageReportFilters {
  query?: string;
  courseId?: string;
  turmaId?: string;
  status?: "active" | "inactive";
  studentIds?: string[];
}

export interface StudentUsageReportOptions {
  empresaId: string;
  tenantSlug?: string;
  periodStart: Date;
  periodEnd: Date;
  scope: StudentUsageReportScope;
  usageFilter: StudentUsageReportUsageFilter;
  filters?: StudentUsageReportFilters;
}

export interface StudentUsageReportRow {
  alunoId: string;
  nome: string;
  email: string;
  matricula: string;
  telefone: string;
  status: "Ativo" | "Inativo";
  cursos: string;
  ultimoLogin: string;
  loginsNoPeriodo: number;
  acessouNoPeriodo: "Sim" | "Não";
  diasDesdeUltimoLogin: number | null;
  temCronograma: "Sim" | "Não";
  cronogramasTotal: number;
  cronogramasNoPeriodo: number;
  ultimoCronogramaCriado: string;
  aulasConcluidasNoPeriodo: number;
  ultimaAulaConcluida: string;
  marcouAulaNoPeriodo: "Sim" | "Não";
  atividadesIniciadasNoPeriodo: number;
  atividadesConcluidasNoPeriodo: number;
  taxaConclusaoAtividades: number;
  sessoesEstudoNoPeriodo: number;
  tempoLiquidoEstudoMinutos: number;
  flashcardsRevisadosNoPeriodo: number;
  conversasIaNoPeriodo: number;
  agendamentosNoPeriodo: number;
  percentualUso: number;
  recomendacaoContato: string;
}

export interface StudentUsageReportSummary {
  totalAlunos: number;
  acessaramNoPeriodo: number;
  comCronograma: number;
  marcaramAulas: number;
  fizeramAtividades: number;
  usaramSessoesEstudo: number;
  revisaramFlashcards: number;
  usaramIa: number;
  fizeramAgendamentos: number;
  percentualAcesso: number;
  percentualCronograma: number;
  percentualAulas: number;
  percentualAtividades: number;
  mediaUso: number;
}

export interface StudentUsageReportData {
  rows: StudentUsageReportRow[];
  summary: StudentUsageReportSummary;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  scope: StudentUsageReportScope;
  usageFilter: StudentUsageReportUsageFilter;
}

type UsuarioRow = {
  id: string;
  nome_completo: string | null;
  email: string | null;
  telefone: string | null;
  numero_matricula: string | null;
  ativo: boolean | null;
};

type CursoRow = {
  id: string;
  nome: string | null;
};

type UsuarioIdRow = {
  usuario_id: string | null;
};

type LoginRow = {
  usuario_id: string | null;
  occurred_at: string | null;
};

type CronogramaRow = {
  id: string;
  usuario_id: string | null;
  created_at: string | null;
};

type CronogramaItemRow = {
  cronograma_id: string | null;
  concluido: boolean | null;
  data_conclusao: string | null;
};

type AulasConcluidasRow = {
  usuario_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProgressoAtividadeRow = {
  usuario_id: string | null;
  status: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  updated_at: string | null;
};

type SessaoEstudoRow = {
  usuario_id: string | null;
  created_at: string | null;
  tempo_total_liquido_segundos: number | null;
};

type ProgressoFlashcardRow = {
  usuario_id: string | null;
  updated_at: string | null;
  numero_revisoes: number | null;
};

type AgendamentoRow = {
  aluno_id: string | null;
  created_at: string | null;
};

type UserIdRow = {
  user_id: string | null;
  created_at: string | null;
};

const YES = "Sim" as const;
const NO = "Não" as const;

function asIsoDate(value: Date): string {
  return value.toISOString();
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function isWithinPeriod(value: string | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function maxIso(values: Array<string | null | undefined>): string | null {
  let max: string | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!max || new Date(value) > new Date(max)) max = value;
  }
  return max;
}

function daysSince(value: string | null, now = new Date()): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}

function percentage(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function buildRecommendation(params: {
  acessou: boolean;
  temCronograma: boolean;
  marcouAula: boolean;
  fezAtividade: boolean;
  usouSessao: boolean;
  revisouFlashcard: boolean;
  percentualUso: number;
}): string {
  const reasons: string[] = [];
  if (!params.acessou) reasons.push("não acessou no período");
  if (!params.temCronograma) reasons.push("sem cronograma");
  if (params.acessou && !params.usouSessao) reasons.push("acessou mas não registrou sessão de estudo");
  if (!params.marcouAula) reasons.push("não marcou aulas concluídas");
  if (!params.fezAtividade) reasons.push("não concluiu atividades");
  if (!params.revisouFlashcard) reasons.push("não revisou flashcards");

  if (reasons.length === 0 && params.percentualUso >= 70) {
    return "Uso consistente; acompanhar evolução.";
  }

  return `Entrar em contato: ${reasons.slice(0, 4).join("; ")}.`;
}

function applyHeaderStyle(worksheet: ExcelJS.Worksheet, color = "111827") {
  const row = worksheet.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: color },
  };
  row.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  row.height = 28;
}

function applyWorksheetBorders(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "E5E7EB" } },
        left: { style: "thin", color: { argb: "E5E7EB" } },
        bottom: { style: "thin", color: { argb: "E5E7EB" } },
        right: { style: "thin", color: { argb: "E5E7EB" } },
      };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
  });
}

export class StudentUsageReportService {
  private readonly client = getDatabaseClient();

  // `tenant_login_events` ainda não está no database.types.ts gerado.
  // Mantemos o escape localizado para não perder tipagem no restante do serviço.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private fromUntyped(table: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.client.from as any)(table);
  }

  async buildReport(options: StudentUsageReportOptions): Promise<StudentUsageReportData> {
    const studentIds = await this.resolveStudentIds(options);
    const students = await this.fetchStudents(studentIds, options);

    if (students.length === 0) {
      return {
        rows: [],
        summary: this.buildSummary([]),
        periodStart: options.periodStart,
        periodEnd: options.periodEnd,
        generatedAt: new Date(),
        scope: options.scope,
        usageFilter: options.usageFilter,
      };
    }

    const ids = students.map((student) => student.id);
    const [courseNamesByStudent, metrics] = await Promise.all([
      this.fetchCourseNamesByStudent(options.empresaId, ids),
      this.fetchMetrics(options.empresaId, ids, options.periodStart, options.periodEnd),
    ]);

    const rows = students
      .map((student) => this.buildRow(student, courseNamesByStudent.get(student.id) ?? [], metrics, options))
      .filter((row) => this.matchesUsageFilter(row, options.usageFilter));

    return {
      rows,
      summary: this.buildSummary(rows),
      periodStart: options.periodStart,
      periodEnd: options.periodEnd,
      generatedAt: new Date(),
      scope: options.scope,
      usageFilter: options.usageFilter,
    };
  }

  async generateWorkbookBuffer(data: StudentUsageReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Aluminify";
    workbook.created = data.generatedAt;

    this.addSummarySheet(workbook, data);
    this.addStudentsSheet(workbook, data.rows);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private async resolveStudentIds(options: StudentUsageReportOptions): Promise<string[]> {
    const tenantStudentIds = await this.resolveTenantStudentIds(options.empresaId);
    let ids = new Set(tenantStudentIds);

    const filterIds = await this.resolveFilterStudentIds(options.filters ?? {});
    if (filterIds) {
      ids = new Set([...ids].filter((id) => filterIds.has(id)));
    }

    if (options.filters?.studentIds && options.filters.studentIds.length > 0) {
      const visibleIds = new Set(options.filters.studentIds);
      ids = new Set([...ids].filter((id) => visibleIds.has(id)));
    }

    return [...ids];
  }

  private async resolveTenantStudentIds(empresaId: string): Promise<string[]> {
    const [vinculos, matriculas, cursos] = await Promise.all([
      fetchAllRows<UsuarioIdRow>(
        this.client
          .from("usuarios_empresas")
          .select("usuario_id")
          .eq("empresa_id", empresaId)
          .eq("papel_base", "aluno")
          .eq("ativo", true)
          .is("deleted_at", null),
      ),
      fetchAllRows<UsuarioIdRow>(
        this.client
          .from("matriculas")
          .select("usuario_id")
          .eq("empresa_id", empresaId),
      ),
      fetchAllRows<CursoRow>(
        this.client.from("cursos").select("id, nome").eq("empresa_id", empresaId),
      ),
    ]);

    const cursoIds = cursos.map((curso) => curso.id);
    const alunosCursos = cursoIds.length > 0
      ? await fetchAllRowsChunked<UsuarioIdRow>(
          (ids) =>
            this.client
              .from("alunos_cursos")
              .select("usuario_id")
              .in("curso_id", ids),
          cursoIds,
        )
      : [];

    return [
      ...new Set(
        [...vinculos, ...matriculas, ...alunosCursos]
          .map((row) => row.usuario_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
  }

  private async resolveFilterStudentIds(filters: StudentUsageReportFilters): Promise<Set<string> | null> {
    if (filters.turmaId) {
      const rows = await fetchAllRows<UsuarioIdRow>(
        this.client
          .from("alunos_turmas")
          .select("usuario_id")
          .eq("turma_id", filters.turmaId),
      );
      return new Set(rows.map((row) => row.usuario_id).filter((id): id is string => Boolean(id)));
    }

    if (filters.courseId) {
      const rows = await fetchAllRows<UsuarioIdRow>(
        this.client
          .from("alunos_cursos")
          .select("usuario_id")
          .eq("curso_id", filters.courseId),
      );
      return new Set(rows.map((row) => row.usuario_id).filter((id): id is string => Boolean(id)));
    }

    return null;
  }

  private async fetchStudents(ids: string[], options: StudentUsageReportOptions): Promise<UsuarioRow[]> {
    if (ids.length === 0) return [];

    let rows = await fetchAllRowsChunked<UsuarioRow>(
      (chunkIds) =>
        this.client
          .from("usuarios")
          .select("id, nome_completo, email, telefone, numero_matricula, ativo")
          .in("id", chunkIds),
      ids,
    );

    const statusFilter = options.filters?.status;
    if (statusFilter === "active" || options.scope === "active") {
      rows = rows.filter((row) => row.ativo === true);
    } else if (statusFilter === "inactive" || options.scope === "inactive") {
      rows = rows.filter((row) => row.ativo === false);
    }

    const query = options.filters?.query?.trim().toLowerCase() ?? "";
    if (query) {
      rows = rows.filter((row) =>
        [row.nome_completo, row.email, row.numero_matricula]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      );
    }

    return rows.sort((a, b) =>
      (a.nome_completo || a.email || "").localeCompare(b.nome_completo || b.email || "", "pt-BR"),
    );
  }

  private async fetchCourseNamesByStudent(empresaId: string, studentIds: string[]): Promise<Map<string, string[]>> {
    const cursos = await fetchAllRows<CursoRow>(
      this.client.from("cursos").select("id, nome").eq("empresa_id", empresaId),
    );
    const cursoNomeById = new Map(cursos.map((curso) => [curso.id, curso.nome ?? "Curso sem nome"]));
    const cursoIds = cursos.map((curso) => curso.id);

    if (cursoIds.length === 0 || studentIds.length === 0) return new Map();

    const links = await fetchAllRowsChunked<{ usuario_id: string | null; curso_id: string | null }>(
      (ids) =>
        this.client
          .from("alunos_cursos")
          .select("usuario_id, curso_id")
          .in("usuario_id", ids)
          .in("curso_id", cursoIds),
      studentIds,
    );

    const namesByStudent = new Map<string, string[]>();
    for (const link of links) {
      if (!link.usuario_id || !link.curso_id) continue;
      const name = cursoNomeById.get(link.curso_id);
      if (!name) continue;
      const current = namesByStudent.get(link.usuario_id) ?? [];
      current.push(name);
      namesByStudent.set(link.usuario_id, current);
    }

    return namesByStudent;
  }

  private async fetchMetrics(
    empresaId: string,
    studentIds: string[],
    periodStart: Date,
    periodEnd: Date,
  ) {
    const since = asIsoDate(periodStart);
    const until = asIsoDate(periodEnd);

    const [
      loginRows,
      cronogramas,
      aulasConcluidas,
      progressoAtividades,
      sessoesEstudo,
      progressoFlashcards,
      agendamentos,
      aiThreads,
      chatConversations,
    ] = await Promise.all([
      fetchAllRowsChunked<LoginRow>(
        (ids) =>
          this.fromUntyped("tenant_login_events")
            .select("usuario_id, occurred_at")
            .eq("empresa_id", empresaId)
            .in("usuario_id", ids),
        studentIds,
      ),
      fetchAllRowsChunked<CronogramaRow>(
        (ids) =>
          this.client
            .from("cronogramas")
            .select("id, usuario_id, created_at")
            .eq("empresa_id", empresaId)
            .in("usuario_id", ids),
        studentIds,
      ),
      fetchAllRowsChunked<AulasConcluidasRow>(
        (ids) =>
          this.client
            .from("aulas_concluidas")
            .select("usuario_id, created_at, updated_at")
            .eq("empresa_id", empresaId)
            .in("usuario_id", ids)
            .gte("created_at", since)
            .lte("created_at", until),
        studentIds,
      ),
      fetchAllRowsChunked<ProgressoAtividadeRow>(
        (ids) =>
          this.client
            .from("progresso_atividades")
            .select("usuario_id, status, data_inicio, data_conclusao, updated_at")
            .eq("empresa_id", empresaId)
            .in("usuario_id", ids)
            .lte("updated_at", until),
        studentIds,
      ),
      fetchAllRowsChunked<SessaoEstudoRow>(
        (ids) =>
          this.client
            .from("sessoes_estudo")
            .select("usuario_id, created_at, tempo_total_liquido_segundos")
            .eq("empresa_id", empresaId)
            .in("usuario_id", ids)
            .gte("created_at", since)
            .lte("created_at", until),
        studentIds,
      ),
      fetchAllRowsChunked<ProgressoFlashcardRow>(
        (ids) =>
          this.client
            .from("progresso_flashcards")
            .select("usuario_id, updated_at, numero_revisoes")
            .eq("empresa_id", empresaId)
            .in("usuario_id", ids)
            .gt("numero_revisoes", 0)
            .gte("updated_at", since)
            .lte("updated_at", until),
        studentIds,
      ),
      fetchAllRowsChunked<AgendamentoRow>(
        (ids) =>
          this.client
            .from("agendamentos")
            .select("aluno_id, created_at")
            .eq("empresa_id", empresaId)
            .in("aluno_id", ids)
            .gte("created_at", since)
            .lte("created_at", until),
        studentIds,
      ),
      fetchAllRowsChunked<UserIdRow>(
        (ids) =>
          this.client
            .from("ai_agent_threads")
            .select("user_id, created_at")
            .eq("empresa_id", empresaId)
            .in("user_id", ids)
            .gte("created_at", since)
            .lte("created_at", until),
        studentIds,
      ),
      fetchAllRowsChunked<UserIdRow>(
        (ids) =>
          this.client
            .from("chat_conversations")
            .select("user_id, created_at")
            .eq("empresa_id", empresaId)
            .in("user_id", ids)
            .gte("created_at", since)
            .lte("created_at", until),
        studentIds,
      ),
    ]);

    const cronogramaIds = cronogramas.map((row) => row.id);
    const cronogramaOwnerById = new Map(cronogramas.map((row) => [row.id, row.usuario_id]));
    const cronogramaItens = cronogramaIds.length > 0
      ? await fetchAllRowsChunked<CronogramaItemRow>(
          (ids) =>
            this.client
              .from("cronograma_itens")
              .select("cronograma_id, concluido, data_conclusao")
              .in("cronograma_id", ids)
              .eq("concluido", true)
              .gte("data_conclusao", since)
              .lte("data_conclusao", until),
          cronogramaIds,
        )
      : [];

    return {
      loginRows,
      cronogramas,
      cronogramaItens,
      cronogramaOwnerById,
      aulasConcluidas,
      progressoAtividades: progressoAtividades.filter((row) =>
        isWithinPeriod(row.updated_at || row.data_inicio || row.data_conclusao, periodStart, periodEnd),
      ),
      sessoesEstudo,
      progressoFlashcards,
      agendamentos,
      aiThreads,
      chatConversations,
      periodStart,
      periodEnd,
    };
  }

  private buildRow(
    student: UsuarioRow,
    courseNames: string[],
    metrics: Awaited<ReturnType<StudentUsageReportService["fetchMetrics"]>>,
    options: StudentUsageReportOptions,
  ): StudentUsageReportRow {
    const studentId = student.id;
    const periodLogins = metrics.loginRows.filter((row) =>
      row.usuario_id === studentId && isWithinPeriod(row.occurred_at, options.periodStart, options.periodEnd),
    );
    const allLoginDates = metrics.loginRows
      .filter((row) => row.usuario_id === studentId)
      .map((row) => row.occurred_at);

    const studentCronogramas = metrics.cronogramas.filter((row) => row.usuario_id === studentId);
    const cronogramasNoPeriodo = studentCronogramas.filter((row) =>
      isWithinPeriod(row.created_at, options.periodStart, options.periodEnd),
    );
    const cronogramaItemConclusions = metrics.cronogramaItens.filter((row) =>
      row.cronograma_id && metrics.cronogramaOwnerById.get(row.cronograma_id) === studentId,
    );
    const aulaConclusions = metrics.aulasConcluidas.filter((row) => row.usuario_id === studentId);
    const aulasConcluidasNoPeriodo = aulaConclusions.length + cronogramaItemConclusions.length;
    const ultimaAulaConcluida = maxIso([
      ...aulaConclusions.map((row) => row.updated_at || row.created_at),
      ...cronogramaItemConclusions.map((row) => row.data_conclusao),
    ]);

    const atividades = metrics.progressoAtividades.filter((row) => row.usuario_id === studentId);
    const atividadesConcluidas = atividades.filter((row) => row.status === "Concluido");
    const sessoes = metrics.sessoesEstudo.filter((row) => row.usuario_id === studentId);
    const flashcards = metrics.progressoFlashcards.filter((row) => row.usuario_id === studentId);
    const agendamentos = metrics.agendamentos.filter((row) => row.aluno_id === studentId);
    const aiChatUserIds = new Set([
      ...metrics.aiThreads.filter((row) => row.user_id === studentId).map((row) => row.user_id),
      ...metrics.chatConversations.filter((row) => row.user_id === studentId).map((row) => row.user_id),
    ]);

    const acessou = periodLogins.length > 0;
    const temCronograma = studentCronogramas.length > 0;
    const marcouAula = aulasConcluidasNoPeriodo > 0;
    const fezAtividade = atividadesConcluidas.length > 0;
    const usouSessao = sessoes.length > 0;
    const revisouFlashcard = flashcards.length > 0;
    const usouIa = aiChatUserIds.has(studentId);
    const fezAgendamento = agendamentos.length > 0;

    const percentualUso = Math.round(
      (Number(acessou) * 20) +
      (Number(temCronograma) * 20) +
      (Number(marcouAula) * 20) +
      (Number(fezAtividade) * 15) +
      (Number(usouSessao) * 15) +
      (Number(revisouFlashcard || usouIa || fezAgendamento) * 10),
    );

    const ultimoLogin = maxIso(allLoginDates);
    const ultimoCronogramaCriado = maxIso(studentCronogramas.map((row) => row.created_at));
    const tempoLiquidoEstudoMinutos = Math.round(
      sessoes.reduce((sum, row) => sum + (row.tempo_total_liquido_segundos ?? 0), 0) / 60,
    );

    return {
      alunoId: studentId,
      nome: student.nome_completo || "(sem nome)",
      email: student.email || "",
      matricula: student.numero_matricula || "",
      telefone: student.telefone || "",
      status: student.ativo === false ? "Inativo" : "Ativo",
      cursos: [...new Set(courseNames)].join("; "),
      ultimoLogin: formatDateTime(ultimoLogin),
      loginsNoPeriodo: periodLogins.length,
      acessouNoPeriodo: acessou ? YES : NO,
      diasDesdeUltimoLogin: daysSince(ultimoLogin),
      temCronograma: temCronograma ? YES : NO,
      cronogramasTotal: studentCronogramas.length,
      cronogramasNoPeriodo: cronogramasNoPeriodo.length,
      ultimoCronogramaCriado: formatDateTime(ultimoCronogramaCriado),
      aulasConcluidasNoPeriodo,
      ultimaAulaConcluida: formatDateTime(ultimaAulaConcluida),
      marcouAulaNoPeriodo: marcouAula ? YES : NO,
      atividadesIniciadasNoPeriodo: atividades.length,
      atividadesConcluidasNoPeriodo: atividadesConcluidas.length,
      taxaConclusaoAtividades: percentage(atividadesConcluidas.length, atividades.length),
      sessoesEstudoNoPeriodo: sessoes.length,
      tempoLiquidoEstudoMinutos,
      flashcardsRevisadosNoPeriodo: flashcards.reduce(
        (sum, row) => sum + Math.max(1, row.numero_revisoes ?? 0),
        0,
      ),
      conversasIaNoPeriodo: metrics.aiThreads.filter((row) => row.user_id === studentId).length +
        metrics.chatConversations.filter((row) => row.user_id === studentId).length,
      agendamentosNoPeriodo: agendamentos.length,
      percentualUso,
      recomendacaoContato: buildRecommendation({
        acessou,
        temCronograma,
        marcouAula,
        fezAtividade,
        usouSessao,
        revisouFlashcard,
        percentualUso,
      }),
    };
  }

  private matchesUsageFilter(row: StudentUsageReportRow, filter: StudentUsageReportUsageFilter): boolean {
    switch (filter) {
      case "no_access":
        return row.acessouNoPeriodo === NO;
      case "no_cronograma":
        return row.temCronograma === NO;
      case "no_aulas":
        return row.marcouAulaNoPeriodo === NO;
      case "no_atividades":
        return row.atividadesConcluidasNoPeriodo === 0;
      case "no_sessoes":
        return row.sessoesEstudoNoPeriodo === 0;
      case "no_flashcards":
        return row.flashcardsRevisadosNoPeriodo === 0;
      case "no_ai_chat":
        return row.conversasIaNoPeriodo === 0;
      case "no_agendamentos":
        return row.agendamentosNoPeriodo === 0;
      case "all":
      default:
        return true;
    }
  }

  private buildSummary(rows: StudentUsageReportRow[]): StudentUsageReportSummary {
    const total = rows.length;
    const acessaram = rows.filter((row) => row.acessouNoPeriodo === YES).length;
    const comCronograma = rows.filter((row) => row.temCronograma === YES).length;
    const marcaramAulas = rows.filter((row) => row.aulasConcluidasNoPeriodo > 0).length;
    const fizeramAtividades = rows.filter((row) => row.atividadesConcluidasNoPeriodo > 0).length;
    const usaramSessoesEstudo = rows.filter((row) => row.sessoesEstudoNoPeriodo > 0).length;
    const revisaramFlashcards = rows.filter((row) => row.flashcardsRevisadosNoPeriodo > 0).length;
    const usaramIa = rows.filter((row) => row.conversasIaNoPeriodo > 0).length;
    const fizeramAgendamentos = rows.filter((row) => row.agendamentosNoPeriodo > 0).length;
    const mediaUso = total > 0
      ? Math.round(rows.reduce((sum, row) => sum + row.percentualUso, 0) / total)
      : 0;

    return {
      totalAlunos: total,
      acessaramNoPeriodo: acessaram,
      comCronograma,
      marcaramAulas,
      fizeramAtividades,
      usaramSessoesEstudo,
      revisaramFlashcards,
      usaramIa,
      fizeramAgendamentos,
      percentualAcesso: percentage(acessaram, total),
      percentualCronograma: percentage(comCronograma, total),
      percentualAulas: percentage(marcaramAulas, total),
      percentualAtividades: percentage(fizeramAtividades, total),
      mediaUso,
    };
  }

  private addSummarySheet(workbook: ExcelJS.Workbook, data: StudentUsageReportData) {
    const sheet = workbook.addWorksheet("Resumo", {
      properties: { tabColor: { argb: "2563EB" } },
    });

    sheet.columns = [
      { header: "Métrica", key: "metric", width: 36 },
      { header: "Valor", key: "value", width: 20 },
      { header: "Percentual", key: "percent", width: 16 },
    ];

    const summary = data.summary;
    sheet.addRows([
      { metric: "Gerado em", value: formatDateTime(data.generatedAt.toISOString()), percent: "" },
      { metric: "Período inicial", value: data.periodStart.toLocaleDateString("pt-BR"), percent: "" },
      { metric: "Período final", value: data.periodEnd.toLocaleDateString("pt-BR"), percent: "" },
      { metric: "Total de alunos no relatório", value: summary.totalAlunos, percent: "100%" },
      { metric: "Acessaram no período", value: summary.acessaramNoPeriodo, percent: `${summary.percentualAcesso}%` },
      { metric: "Têm cronograma", value: summary.comCronograma, percent: `${summary.percentualCronograma}%` },
      { metric: "Marcaram aulas concluídas", value: summary.marcaramAulas, percent: `${summary.percentualAulas}%` },
      { metric: "Concluíram atividades", value: summary.fizeramAtividades, percent: `${summary.percentualAtividades}%` },
      { metric: "Usaram sessões de estudo", value: summary.usaramSessoesEstudo, percent: `${percentage(summary.usaramSessoesEstudo, summary.totalAlunos)}%` },
      { metric: "Revisaram flashcards", value: summary.revisaramFlashcards, percent: `${percentage(summary.revisaramFlashcards, summary.totalAlunos)}%` },
      { metric: "Usaram IA/chat", value: summary.usaramIa, percent: `${percentage(summary.usaramIa, summary.totalAlunos)}%` },
      { metric: "Fizeram agendamentos", value: summary.fizeramAgendamentos, percent: `${percentage(summary.fizeramAgendamentos, summary.totalAlunos)}%` },
      { metric: "Média de uso geral", value: `${summary.mediaUso}%`, percent: "" },
    ]);

    applyHeaderStyle(sheet, "2563EB");
    applyWorksheetBorders(sheet);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  private addStudentsSheet(workbook: ExcelJS.Workbook, rows: StudentUsageReportRow[]) {
    const sheet = workbook.addWorksheet("Alunos", {
      properties: { tabColor: { argb: "111827" } },
    });

    sheet.columns = [
      { header: "Nome", key: "nome", width: 32 },
      { header: "Email", key: "email", width: 34 },
      { header: "Matrícula", key: "matricula", width: 18 },
      { header: "Telefone", key: "telefone", width: 18 },
      { header: "Status", key: "status", width: 12 },
      { header: "Cursos", key: "cursos", width: 42 },
      { header: "Último login", key: "ultimoLogin", width: 20 },
      { header: "Acessou?", key: "acessouNoPeriodo", width: 12 },
      { header: "Dias sem login", key: "diasDesdeUltimoLogin", width: 14 },
      { header: "Tem cronograma?", key: "temCronograma", width: 16 },
      { header: "Aulas concluídas", key: "aulasConcluidasNoPeriodo", width: 18 },
      { header: "Última aula concluída", key: "ultimaAulaConcluida", width: 22 },
      { header: "Marcou aula?", key: "marcouAulaNoPeriodo", width: 14 },
      { header: "Atividades iniciadas", key: "atividadesIniciadasNoPeriodo", width: 20 },
      { header: "Atividades concluídas", key: "atividadesConcluidasNoPeriodo", width: 21 },
      { header: "Taxa atividades", key: "taxaConclusaoAtividades", width: 16 },
      { header: "Sessões de estudo", key: "sessoesEstudoNoPeriodo", width: 18 },
      { header: "Minutos estudados", key: "tempoLiquidoEstudoMinutos", width: 18 },
      { header: "Flashcards revisados", key: "flashcardsRevisadosNoPeriodo", width: 20 },
      { header: "Conversas IA", key: "conversasIaNoPeriodo", width: 14 },
      { header: "Agendamentos", key: "agendamentosNoPeriodo", width: 14 },
      { header: "Uso geral", key: "percentualUso", width: 12 },
      { header: "Recomendação de contato", key: "recomendacaoContato", width: 54 },
    ];

    for (const row of rows) {
      sheet.addRow({
        ...row,
        taxaConclusaoAtividades: `${row.taxaConclusaoAtividades}%`,
        percentualUso: `${row.percentualUso}%`,
        diasDesdeUltimoLogin: row.diasDesdeUltimoLogin ?? "",
      });
    }

    applyHeaderStyle(sheet);
    applyWorksheetBorders(sheet);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, rows.length + 1), column: sheet.columns.length },
    };
  }
}
