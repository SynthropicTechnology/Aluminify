import { getDatabaseClient } from "@/app/shared/core/database/database";
import { getServiceRoleClient } from "@/app/shared/core/database/database-auth";
import type {
  DashboardData,
  ModuloImportancia,
  StrategicDomain,
  StrategicDomainRecommendation,
  SubjectDistributionItem,
} from "../types";

type DashboardScopeLevel = "curso" | "disciplina" | "frente" | "modulo";
type DashboardGroupBy = "curso" | "disciplina" | "frente" | "modulo";
type DashboardPeriod = "semanal" | "mensal" | "anual";

type StudyTimeRow = {
  seconds: number;
  curso_id: string | null;
  disciplina_id: string | null;
  frente_id: string | null;
  modulo_id: string | null;
};

type SubjectDistributionFilteredResult = {
  totalSeconds: number;
  totalHours: number;
  items: Array<{
    id: string | null;
    name: string;
    percentage: number;
    seconds: number;
    prettyTime: string;
    color: string;
  }>;
};

type PerformanceFilteredResult = Array<{
  id: string;
  name: string;
  subLabel: string | null;
  score: number;
  isNotStarted: boolean;
}>;

type StrategicDomainFilteredResult = {
  data: StrategicDomain;
  modules: Array<{
    moduloId: string;
    moduloNome: string;
    importancia: ModuloImportancia;
    flashcardsScore: number | null;
    questionsScore: number | null;
    risk: number | null;
  }>;
};

export interface DashboardDataOptions {
  period?: "semanal" | "mensal" | "anual";
  /** Filter by organization ID (for multi-org students) */
  empresaId?: string;
}

export class DashboardAnalyticsService {
  /**
   * Busca dados agregados do dashboard para um aluno
   * @param alunoId - ID do aluno
   * @param periodOrOptions - Período ou objeto de opções com empresaId para filtro
   */
  async getDashboardData(
    alunoId: string,
    periodOrOptions:
      | "semanal"
      | "mensal"
      | "anual"
      | DashboardDataOptions = "anual",
  ): Promise<DashboardData> {
    // Normalize options
    const options: DashboardDataOptions =
      typeof periodOrOptions === "string"
        ? { period: periodOrOptions }
        : periodOrOptions;

    const period = options.period ?? "anual";
    const empresaId = options.empresaId;

    const client = getDatabaseClient();

    // Buscar dados do usuário
    const user = await this.getUserInfo(alunoId, client);

    // Buscar métricas em paralelo
    const [
      metrics,
      heatmap,
      subjects,
      focusEfficiency,
      strategicDomain,
      subjectDistribution,
    ] = await Promise.all([
      this.getMetrics(alunoId, client, period, empresaId),
      this.getHeatmapData(alunoId, client, period, empresaId),
      this.getSubjectPerformance(alunoId, client, period, empresaId),
      this.getFocusEfficiency(alunoId, client, period, empresaId),
      this.getStrategicDomain(alunoId, client, period, empresaId),
      this.getSubjectDistribution(alunoId, client, period, empresaId),
    ]);

    return {
      user,
      metrics,
      heatmap,
      subjects,
      focusEfficiency,
      strategicDomain,
      subjectDistribution,
    };
  }

  /**
   * Retorna cursos disponíveis para seleção no dashboard.
   * - Aluno: cursos matriculados
   * - Professor/usuario: todos os cursos
   */
  async getAvailableCourses(
    alunoId: string,
    empresaId?: string,
  ): Promise<
    Array<{
      id: string;
      nome: string;
      empresa_id: string | null;
      empresaNome: string | null;
      empresaLogoUrl: string | null;
    }>
  > {
    const client = getDatabaseClient();
    const { cursoIds } = await this.resolveCursoScope(
      alunoId,
      client,
      empresaId,
    );
    if (cursoIds.length === 0) return [];
    let query = client
      .from("cursos")
      .select("id, nome, empresa_id, empresas:empresa_id(nome, logo_url)")
      .in("id", cursoIds);
    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }
    const { data: cursos, error } = await query;
    if (error) throw new Error(`Erro ao buscar cursos: ${error.message}`);
    return (
      (cursos ?? []) as Array<{
        id: string;
        nome: string;
        empresa_id: string | null;
        empresas: { nome: string; logo_url: string | null } | null;
      }>
    )
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        empresa_id: c.empresa_id,
        empresaNome: c.empresas?.nome ?? null,
        empresaLogoUrl: c.empresas?.logo_url ?? null,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  /**
   * Resolve o escopo de cursos do usuário (aluno vs professor/usuario).
   * Reutiliza a mesma lógica do dashboard atual, mas centraliza para endpoints filtráveis.
   * @param empresaId - Optional: filter courses to only those belonging to this organization
   */
  private async resolveCursoScope(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    empresaId?: string,
  ): Promise<{ isProfessor: boolean; cursoIds: string[] }> {
    const { data: professorData } = await client
      .from("usuarios")
      .select("id")
      .eq("id", alunoId)
      .maybeSingle();

    // Fallback via auth metadata (usuario/professor sem registro em `usuarios`)
    let isProfessor = !!professorData;
    if (!isProfessor) {
      try {
        const { data: authUser } = await client.auth.admin.getUserById(alunoId);
        const role =
          (authUser?.user?.user_metadata?.role as string | undefined) ??
          undefined;
        if (role === "professor" || role === "usuario") {
          isProfessor = true;
        }
      } catch (e) {
        console.warn(
          "[dashboard-analytics] Não foi possível ler role do usuário via auth.admin:",
          e,
        );
      }
    }

    let cursoIds: string[] = [];
    if (isProfessor) {
      // For professors, get all courses (optionally filtered by empresa)
      let query = client.from("cursos").select("id");
      if (empresaId) {
        query = query.eq("empresa_id", empresaId);
      }
      const { data: todosCursos } = await query;
      cursoIds = (todosCursos ?? []).map((c: { id: string }) => c.id);
    } else {
      // For students, get enrolled courses (optionally filtered by empresa)
      const { data: alunosCursos } = await client
        .from("alunos_cursos")
        .select("curso_id, cursos!inner(empresa_id)")
        .eq("usuario_id", alunoId);

      if (empresaId) {
        // Filter to only courses from the specified empresa
        cursoIds = (alunosCursos ?? [])
          .filter(
            (ac: { cursos: { empresa_id: string } }) =>
              ac.cursos?.empresa_id === empresaId,
          )
          .map((ac: { curso_id: string }) => ac.curso_id);
      } else {
        cursoIds = (alunosCursos ?? []).map(
          (ac: { curso_id: string }) => ac.curso_id,
        );
      }
    }

    return { isProfessor, cursoIds };
  }

  private getPeriodStart(period: DashboardPeriod): Date {
    const hoje = new Date();
    const inicio = new Date(hoje);
    switch (period) {
      case "semanal":
        inicio.setDate(hoje.getDate() - 7);
        return inicio;
      case "anual":
        inicio.setDate(hoje.getDate() - 365);
        return inicio;
      case "mensal":
      default:
        inicio.setDate(hoje.getDate() - 31);
        return inicio;
    }
  }

  private getPeriodDays(period: DashboardPeriod): number {
    return period === "semanal" ? 7 : period === "mensal" ? 31 : 365;
  }

  private formatSeconds(seconds: number): string {
    const safe = Math.max(0, Math.floor(seconds));
    const h = Math.floor(safe / 3600);
    const m = Math.floor((safe % 3600) / 60);
    if (h <= 0) return `${m}m`;
    if (m <= 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  private effectiveCourseIds(
    cursoIds: string[],
    scope: DashboardScopeLevel,
    scopeId?: string,
  ): string[] {
    if (scope === "curso" && scopeId) return [scopeId];
    return cursoIds;
  }

  /**
   * Endpoint filtrável: Distribuição por disciplina/frente/módulo
   */
  async getSubjectDistributionFiltered(
    alunoId: string,
    opts: {
      groupBy: DashboardGroupBy;
      scope: DashboardScopeLevel;
      scopeId?: string;
      period: DashboardPeriod;
      /** Filter by organization ID (multi-org students) */
      empresaId?: string;
    },
  ): Promise<SubjectDistributionFilteredResult> {
    const client = getDatabaseClient();
    const { cursoIds } = await this.resolveCursoScope(
      alunoId,
      client,
      opts.empresaId,
    );
    const effectiveCursoIds = this.effectiveCourseIds(
      cursoIds,
      opts.scope,
      opts.scopeId,
    );
    if (effectiveCursoIds.length === 0) {
      return { totalSeconds: 0, totalHours: 0, items: [] };
    }

    const inicioPeriodo = this.getPeriodStart(opts.period);

    // =========================================================
    // NOVO: distribuição por "tempo de estudo" = aulas assistidas
    // (cronograma_itens concluído) + listas (sessões vinculadas a atividade)
    // Evita dupla contagem ao NÃO somar sessões genéricas sem atividade vinculada.
    // =========================================================

    const [listRows, watchedRows] = await Promise.all([
      this.getListSessionsRows(alunoId, client, { start: inicioPeriodo }),
      this.getWatchedClassesRows(alunoId, client, { start: inicioPeriodo }),
    ]);

    const rows: StudyTimeRow[] = [...listRows, ...watchedRows];

    // Aplicar escopo direto quando possível (disciplina/frente/modulo)
    let scopedRows = rows;
    if (opts.scope === "disciplina" && opts.scopeId) {
      scopedRows = scopedRows.filter((r) => r.disciplina_id === opts.scopeId);
    } else if (opts.scope === "frente" && opts.scopeId) {
      scopedRows = scopedRows.filter((r) => r.frente_id === opts.scopeId);
    } else if (opts.scope === "modulo" && opts.scopeId) {
      scopedRows = scopedRows.filter((r) => r.modulo_id === opts.scopeId);
    }

    // Escopo por curso: como sessoes_estudo não tem curso_id, filtramos por estrutura
    let filteredRows = scopedRows;
    if (opts.scope === "curso") {
      const disciplinaIdsSet = new Set<string>();
      const { data: cursosDisciplinas } = await client
        .from("cursos_disciplinas")
        .select("disciplina_id, curso_id")
        .in("curso_id", effectiveCursoIds);
      for (const cd of (cursosDisciplinas ?? []) as Array<{
        disciplina_id: string;
      }>) {
        disciplinaIdsSet.add(cd.disciplina_id);
      }

      // Frentes e módulos “vinculados” ao(s) curso(s) (inclui globais)
      const { data: frentes } = await client
        .from("frentes")
        .select("id, curso_id, disciplina_id")
        .in("disciplina_id", Array.from(disciplinaIdsSet))
        .or(
          effectiveCursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
            (effectiveCursoIds.length > 0 ? "," : "") +
            "curso_id.is.null",
        );

      const frontIdsSet = new Set(
        ((frentes ?? []) as Array<{ id: string; curso_id: string | null }>)
          .filter((f) => !f.curso_id || effectiveCursoIds.includes(f.curso_id))
          .map((f) => f.id),
      );

      const { data: modulos } = await client
        .from("modulos")
        .select("id, curso_id, frente_id")
        .in("frente_id", Array.from(frontIdsSet))
        .or(
          effectiveCursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
            (effectiveCursoIds.length > 0 ? "," : "") +
            "curso_id.is.null",
        );

      const moduleIdsSet = new Set(
        ((modulos ?? []) as Array<{ id: string; curso_id: string | null }>)
          .filter((m) => !m.curso_id || effectiveCursoIds.includes(m.curso_id))
          .map((m) => m.id),
      );

      filteredRows = rows.filter((r) => {
        const did = r.disciplina_id;
        const fid = r.frente_id;
        const mid = r.modulo_id;
        const cid =
          (r as unknown as { curso_id?: string | null }).curso_id ?? null;
        return (
          (cid != null && effectiveCursoIds.includes(cid)) ||
          (mid != null && moduleIdsSet.has(mid)) ||
          (fid != null && frontIdsSet.has(fid)) ||
          (did != null && disciplinaIdsSet.has(did))
        );
      });
    }

    const secondsByKey = new Map<string, number>();
    if (opts.groupBy === "curso") {
      const moduleIds = [
        ...new Set(filteredRows.map((r) => r.modulo_id).filter(Boolean)),
      ] as string[];
      const frontIds = [
        ...new Set(filteredRows.map((r) => r.frente_id).filter(Boolean)),
      ] as string[];
      const disciplinaIdsUsed = [
        ...new Set(filteredRows.map((r) => r.disciplina_id).filter(Boolean)),
      ] as string[];

      const moduleCourseMap = new Map<string, string | null>();
      const frontCourseMap = new Map<string, string | null>();
      const disciplinaCourseIdsMap = new Map<string, string[]>();

      if (moduleIds.length > 0) {
        const { data: modulos } = await client
          .from("modulos")
          .select("id, curso_id")
          .in("id", moduleIds);
        for (const m of (modulos ?? []) as Array<{
          id: string;
          curso_id: string | null;
        }>) {
          moduleCourseMap.set(m.id, m.curso_id);
        }
      }

      if (frontIds.length > 0) {
        const { data: frentes } = await client
          .from("frentes")
          .select("id, curso_id")
          .in("id", frontIds);
        for (const f of (frentes ?? []) as Array<{
          id: string;
          curso_id: string | null;
        }>) {
          frontCourseMap.set(f.id, f.curso_id);
        }
      }

      if (disciplinaIdsUsed.length > 0) {
        const { data: cursosDisciplinas } = await client
          .from("cursos_disciplinas")
          .select("curso_id, disciplina_id")
          .in("curso_id", effectiveCursoIds)
          .in("disciplina_id", disciplinaIdsUsed);

        for (const row of (cursosDisciplinas ?? []) as Array<{
          curso_id: string;
          disciplina_id: string;
        }>) {
          const curr = disciplinaCourseIdsMap.get(row.disciplina_id) ?? [];
          curr.push(row.curso_id);
          disciplinaCourseIdsMap.set(row.disciplina_id, curr);
        }
      }

      const onlyCourseId =
        effectiveCursoIds.length === 1 ? effectiveCursoIds[0] : null;

      for (const r of filteredRows) {
        const seconds = r.seconds ?? 0;
        if (seconds <= 0) continue;

        let courseKey: string | null = null;
        if ((r as unknown as { curso_id?: string | null }).curso_id) {
          courseKey =
            (r as unknown as { curso_id?: string | null }).curso_id ?? null;
        }
        if (r.modulo_id) {
          const cid = moduleCourseMap.get(r.modulo_id) ?? null;
          if (cid) courseKey = cid;
        }
        if (!courseKey && r.frente_id) {
          const cid = frontCourseMap.get(r.frente_id) ?? null;
          if (cid) courseKey = cid;
        }
        if (!courseKey && r.disciplina_id) {
          const cids = disciplinaCourseIdsMap.get(r.disciplina_id) ?? [];
          if (cids.length === 1) courseKey = cids[0];
        }
        if (!courseKey && onlyCourseId) {
          courseKey = onlyCourseId;
        }

        const k = courseKey ?? "__unknown__";
        secondsByKey.set(k, (secondsByKey.get(k) ?? 0) + seconds);
      }
    } else {
      const groupKey = (r: {
        disciplina_id: string | null;
        frente_id: string | null;
        modulo_id: string | null;
      }) => {
        if (opts.groupBy === "disciplina")
          return r.disciplina_id ?? "__unknown__";
        if (opts.groupBy === "frente") return r.frente_id ?? "__unknown__";
        return r.modulo_id ?? "__unknown__";
      };

      for (const r of filteredRows) {
        const k = groupKey(r);
        const seconds = r.seconds ?? 0;
        secondsByKey.set(k, (secondsByKey.get(k) ?? 0) + seconds);
      }
    }

    const totalSeconds = Array.from(secondsByKey.values()).reduce(
      (acc, v) => acc + v,
      0,
    );
    const totalHours = totalSeconds > 0 ? Math.round(totalSeconds / 3600) : 0;
    if (totalSeconds <= 0) {
      return { totalSeconds: 0, totalHours: 0, items: [] };
    }

    const ids = Array.from(secondsByKey.keys()).filter(
      (k) => k !== "__unknown__",
    );
    const nameById = new Map<string, string>();

    if (opts.groupBy === "curso" && ids.length > 0) {
      const { data: cursos } = await client
        .from("cursos")
        .select("id, nome")
        .in("id", ids);
      for (const c of (cursos ?? []) as Array<{ id: string; nome: string }>) {
        nameById.set(c.id, c.nome);
      }
    } else if (opts.groupBy === "disciplina" && ids.length > 0) {
      const { data: disciplinas } = await client
        .from("disciplinas")
        .select("id, nome")
        .in("id", ids);
      for (const d of (disciplinas ?? []) as Array<{
        id: string;
        nome: string;
      }>) {
        nameById.set(d.id, d.nome);
      }
    } else if (opts.groupBy === "frente" && ids.length > 0) {
      const { data: frentes } = await client
        .from("frentes")
        .select("id, nome")
        .in("id", ids);
      for (const f of (frentes ?? []) as Array<{ id: string; nome: string }>) {
        nameById.set(f.id, f.nome);
      }
    } else if (opts.groupBy === "modulo" && ids.length > 0) {
      const { data: modulos } = await client
        .from("modulos")
        .select("id, nome")
        .in("id", ids);
      for (const m of (modulos ?? []) as Array<{ id: string; nome: string }>) {
        nameById.set(m.id, m.nome);
      }
    }

    const cores = [
      "#60a5fa",
      "#a78bfa",
      "#facc15",
      "#9ca3af",
      "#f87171",
      "#34d399",
      "#fb7185",
    ];
    let corIndex = 0;

    const items = Array.from(secondsByKey.entries())
      .map(([id, seconds]) => {
        const name =
          id === "__unknown__"
            ? "Não identificado"
            : (nameById.get(id) ?? "Desconhecido");
        const percentage = Math.round((seconds / totalSeconds) * 100);
        const color = cores[corIndex++ % cores.length];
        return {
          id: id === "__unknown__" ? null : id,
          name,
          percentage,
          seconds,
          prettyTime: this.formatSeconds(seconds),
          color,
        };
      })
      .sort((a, b) => b.seconds - a.seconds);

    return { totalSeconds, totalHours, items };
  }

  /**
   * Endpoint filtrável: Performance por disciplina/frente/módulo
   */
  async getPerformanceFiltered(
    alunoId: string,
    opts: {
      groupBy: DashboardGroupBy;
      scope: DashboardScopeLevel;
      scopeId?: string;
      period: DashboardPeriod;
      /** Filter by organization ID (multi-org students) */
      empresaId?: string;
    },
  ): Promise<PerformanceFilteredResult> {
    const client = getDatabaseClient();
    const { cursoIds } = await this.resolveCursoScope(
      alunoId,
      client,
      opts.empresaId,
    );
    const effectiveCursoIds = this.effectiveCourseIds(
      cursoIds,
      opts.scope,
      opts.scopeId,
    );
    if (effectiveCursoIds.length === 0) return [];

    // 1) Disciplinas do(s) curso(s)
    const { data: cursosDisciplinas } = await client
      .from("cursos_disciplinas")
      .select("disciplina_id, curso_id")
      .in("curso_id", effectiveCursoIds);

    let disciplinaIds = [
      ...new Set(
        ((cursosDisciplinas ?? []) as Array<{ disciplina_id: string }>).map(
          (cd) => cd.disciplina_id,
        ),
      ),
    ];
    if (opts.scope === "disciplina" && opts.scopeId) {
      disciplinaIds = disciplinaIds.includes(opts.scopeId)
        ? [opts.scopeId]
        : [];
    }
    if (disciplinaIds.length === 0) return [];

    const { data: disciplinas } = await client
      .from("disciplinas")
      .select("id, nome")
      .in("id", disciplinaIds);
    const disciplinaMap = new Map(
      (disciplinas ?? []).map((d: { id: string; nome: string }) => [
        d.id,
        d.nome,
      ]),
    );

    // 2) Frentes das disciplinas (curso_id do curso ou null)
    const { data: todasFrentes } = await client
      .from("frentes")
      .select("id, nome, disciplina_id, curso_id")
      .in("disciplina_id", disciplinaIds)
      .or(
        effectiveCursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
          (effectiveCursoIds.length > 0 ? "," : "") +
          "curso_id.is.null",
      );

    let frentesFiltradas = (
      (todasFrentes ?? []) as Array<{
        id: string;
        nome: string;
        disciplina_id: string;
        curso_id: string | null;
      }>
    ).filter((f) => !f.curso_id || effectiveCursoIds.includes(f.curso_id));
    if (opts.scope === "frente" && opts.scopeId) {
      frentesFiltradas = frentesFiltradas.filter((f) => f.id === opts.scopeId);
    }
    if (frentesFiltradas.length === 0) return [];

    const frenteMap = new Map(frentesFiltradas.map((f) => [f.id, f]));

    // 3) Módulos das frentes
    const { data: todosModulos } = await client
      .from("modulos")
      .select("id, nome, numero_modulo, importancia, frente_id, curso_id")
      .in(
        "frente_id",
        frentesFiltradas.map((f) => f.id),
      )
      .or(
        effectiveCursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
          (effectiveCursoIds.length > 0 ? "," : "") +
          "curso_id.is.null",
      );

    let modulosFiltrados = (
      (todosModulos ?? []) as Array<{
        id: string;
        nome: string;
        numero_modulo: number | null;
        importancia: ModuloImportancia | null;
        frente_id: string;
        curso_id: string | null;
      }>
    ).filter((m) => !m.curso_id || effectiveCursoIds.includes(m.curso_id));
    if (opts.scope === "modulo" && opts.scopeId) {
      modulosFiltrados = modulosFiltrados.filter((m) => m.id === opts.scopeId);
    }
    if (modulosFiltrados.length === 0) return [];

    const moduloMap = new Map(modulosFiltrados.map((m) => [m.id, m]));
    const moduloIds = modulosFiltrados.map((m) => m.id);

    const chunk = <T>(arr: T[], size: number): T[][] => {
      if (arr.length === 0) return [];
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
      return out;
    };

    // 4) Atividades desses módulos
    const atividadesPromises = chunk(moduloIds, 900).map(async (idsChunk) => {
      let q = client
        .from("atividades")
        .select("id, modulo_id")
        .in("modulo_id", idsChunk);
      if (opts.empresaId) q = q.eq("empresa_id", opts.empresaId);
      const { data: chunkRows, error: chunkErr } = await q;
      if (chunkErr) {
        console.error(
          "[dashboard-analytics] Erro ao buscar atividades por modulo_id:",
          chunkErr,
        );
        return [];
      }
      return (chunkRows ?? []) as Array<{ id: string; modulo_id: string }>;
    });

    const atividades = (await Promise.all(atividadesPromises)).flat();

    const atividadeModuloMap = new Map(
      (atividades ?? []).map((a) => [a.id, a.modulo_id]),
    );
    const atividadeIds = Array.from(atividadeModuloMap.keys());
    if (atividadeIds.length === 0) {
      // Sem atividades: tudo “não iniciado”
      let courseNameMap: Map<string, string> | undefined;
      if (opts.groupBy === "curso") {
        const { data: cursos } = await client
          .from("cursos")
          .select("id, nome")
          .in("id", effectiveCursoIds);
        courseNameMap = new Map(
          ((cursos ?? []) as Array<{ id: string; nome: string }>).map((c) => [
            c.id,
            c.nome,
          ]),
        );
      }
      return this.buildPerformanceEmptyList(
        opts.groupBy,
        disciplinaIds,
        disciplinaMap,
        frentesFiltradas,
        modulosFiltrados,
        effectiveCursoIds,
        courseNameMap,
      );
    }

    // 5) Progresso concluído com questões
    const inicioPeriodo = this.getPeriodStart(opts.period);
    const progressosPromises = chunk(atividadeIds, 900).map(async (idsChunk) => {
      let q = client
        .from("progresso_atividades")
        .select("atividade_id, questoes_totais, questoes_acertos")
        .eq("usuario_id", alunoId)
        .eq("status", "Concluido")
        .not("questoes_totais", "is", null)
        .gt("questoes_totais", 0)
        .gte("data_conclusao", inicioPeriodo.toISOString())
        .in("atividade_id", idsChunk);
      if (opts.empresaId) q = q.eq("empresa_id", opts.empresaId);
      const { data: chunkRows, error: chunkErr } = await q;
      if (chunkErr) {
        console.error(
          "[dashboard-analytics] Erro ao buscar progresso_atividades por atividade_id:",
          chunkErr,
        );
        return [];
      }
      return (chunkRows ?? []) as Array<{
        atividade_id: string;
        questoes_totais: number | null;
        questoes_acertos: number | null;
      }>;
    });

    const progressos = (await Promise.all(progressosPromises)).flat();

    const moduleAgg = new Map<string, { totais: number; acertos: number }>();
    for (const p of progressos) {
      const moduloId = atividadeModuloMap.get(p.atividade_id);
      if (!moduloId) continue;
      if (!moduloMap.has(moduloId)) continue;
      const totais = p.questoes_totais ?? 0;
      const acertos = p.questoes_acertos ?? 0;
      if (totais <= 0) continue;
      const curr = moduleAgg.get(moduloId) || { totais: 0, acertos: 0 };
      curr.totais += totais;
      curr.acertos += acertos;
      moduleAgg.set(moduloId, curr);
    }

    if (opts.groupBy === "curso") {
      const onlyCourseId =
        effectiveCursoIds.length === 1 ? effectiveCursoIds[0] : null;
      const { data: cursos } = await client
        .from("cursos")
        .select("id, nome")
        .in("id", effectiveCursoIds);
      const courseNameMap = new Map(
        ((cursos ?? []) as Array<{ id: string; nome: string }>).map((c) => [
          c.id,
          c.nome,
        ]),
      );

      const courseAgg = new Map<string, { totais: number; acertos: number }>();
      let unknown = { totais: 0, acertos: 0 };

      for (const [mid, agg] of moduleAgg.entries()) {
        const modulo = moduloMap.get(mid);
        if (!modulo) continue;
        const cid =
          (modulo as unknown as { curso_id?: string | null }).curso_id ?? null;
        const effectiveCid = cid ?? onlyCourseId;
        if (effectiveCid && effectiveCursoIds.includes(effectiveCid)) {
          const curr = courseAgg.get(effectiveCid) || { totais: 0, acertos: 0 };
          curr.totais += agg.totais;
          curr.acertos += agg.acertos;
          courseAgg.set(effectiveCid, curr);
        } else {
          unknown = {
            totais: unknown.totais + agg.totais,
            acertos: unknown.acertos + agg.acertos,
          };
        }
      }

      const out: PerformanceFilteredResult = effectiveCursoIds.map((cid) => {
        const agg = courseAgg.get(cid);
        const totais = agg?.totais ?? 0;
        const acertos = agg?.acertos ?? 0;
        const score = totais > 0 ? Math.round((acertos / totais) * 100) : 0;
        return {
          id: cid,
          name: courseNameMap.get(cid) ?? "Curso",
          subLabel: null,
          score,
          isNotStarted: totais <= 0,
        };
      });

      if (unknown.totais > 0) {
        out.push({
          id: "__unknown__",
          name: "Não identificado",
          subLabel: null,
          score: Math.round((unknown.acertos / unknown.totais) * 100),
          isNotStarted: false,
        });
      }

      return out;
    }

    if (opts.groupBy === "modulo") {
      return modulosFiltrados.map((m) => {
        const agg = moduleAgg.get(m.id);
        const totais = agg?.totais ?? 0;
        const acertos = agg?.acertos ?? 0;
        const score = totais > 0 ? Math.round((acertos / totais) * 100) : 0;
        const frente = frenteMap.get(m.frente_id);
        const disciplinaNome = frente
          ? (disciplinaMap.get(frente.disciplina_id) ?? null)
          : null;
        const subLabel = frente
          ? [disciplinaNome, frente.nome].filter(Boolean).join(" • ")
          : disciplinaNome;
        return {
          id: m.id,
          name: m.nome,
          subLabel: subLabel ?? null,
          score,
          isNotStarted: totais <= 0,
          moduloNumero: m.numero_modulo ?? null,
          importancia: (m.importancia ?? null) as ModuloImportancia | null,
        };
      });
    }

    if (opts.groupBy === "frente") {
      const frontAgg = new Map<string, { totais: number; acertos: number }>();
      for (const [mid, agg] of moduleAgg.entries()) {
        const modulo = moduloMap.get(mid);
        if (!modulo) continue;
        const fid = modulo.frente_id;
        const curr = frontAgg.get(fid) || { totais: 0, acertos: 0 };
        curr.totais += agg.totais;
        curr.acertos += agg.acertos;
        frontAgg.set(fid, curr);
      }

      return frentesFiltradas.map((f) => {
        const agg = frontAgg.get(f.id);
        const totais = agg?.totais ?? 0;
        const acertos = agg?.acertos ?? 0;
        const score = totais > 0 ? Math.round((acertos / totais) * 100) : 0;
        const subLabel = disciplinaMap.get(f.disciplina_id) ?? null;
        return {
          id: f.id,
          name: f.nome,
          subLabel,
          score,
          isNotStarted: totais <= 0,
        };
      });
    }

    // groupBy disciplina
    const discAgg = new Map<string, { totais: number; acertos: number }>();
    for (const [mid, agg] of moduleAgg.entries()) {
      const modulo = moduloMap.get(mid);
      if (!modulo) continue;
      const frente = frenteMap.get(modulo.frente_id);
      if (!frente) continue;
      const did = frente.disciplina_id;
      const curr = discAgg.get(did) || { totais: 0, acertos: 0 };
      curr.totais += agg.totais;
      curr.acertos += agg.acertos;
      discAgg.set(did, curr);
    }

    return disciplinaIds.map((did) => {
      const nome = disciplinaMap.get(did) ?? "Desconhecida";
      const agg = discAgg.get(did);
      const totais = agg?.totais ?? 0;
      const acertos = agg?.acertos ?? 0;
      const score = totais > 0 ? Math.round((acertos / totais) * 100) : 0;
      return {
        id: did,
        name: nome,
        subLabel: null,
        score,
        isNotStarted: totais <= 0,
      };
    });
  }

  private buildPerformanceEmptyList(
    groupBy: DashboardGroupBy,
    disciplinaIds: string[],
    disciplinaMap: Map<string, string>,
    frentes: Array<{ id: string; nome: string; disciplina_id: string }>,
    modulos: Array<{ id: string; nome: string; frente_id: string }>,
    courseIds: string[] = [],
    courseNameMap: Map<string, string> = new Map(),
  ): PerformanceFilteredResult {
    if (groupBy === "curso") {
      return courseIds.map((id) => ({
        id,
        name: courseNameMap.get(id) ?? "Curso",
        subLabel: null,
        score: 0,
        isNotStarted: true,
      }));
    }
    if (groupBy === "disciplina") {
      return disciplinaIds.map((id) => ({
        id,
        name: disciplinaMap.get(id) ?? "Desconhecida",
        subLabel: null,
        score: 0,
        isNotStarted: true,
      }));
    }
    if (groupBy === "frente") {
      return frentes.map((f) => ({
        id: f.id,
        name: f.nome,
        subLabel: disciplinaMap.get(f.disciplina_id) ?? null,
        score: 0,
        isNotStarted: true,
      }));
    }
    // modulo
    const frenteMap = new Map(frentes.map((f) => [f.id, f]));
    return modulos.map((m) => {
      const frente = frenteMap.get(m.frente_id);
      const subLabel = frente
        ? (disciplinaMap.get(frente.disciplina_id) ?? null)
        : null;
      return { id: m.id, name: m.nome, subLabel, score: 0, isNotStarted: true };
    });
  }

  /**
   * Endpoint filtrável: Domínio Estratégico por escopo (sem filtro por modo).
   * Retorna também a lista de módulos (para ranking + seletor no nível Módulo).
   */
  async getStrategicDomainFiltered(
    alunoId: string,
    opts: {
      scope: DashboardScopeLevel;
      scopeId?: string;
      period: DashboardPeriod;
      /** Filter by organization ID (multi-org students) */
      empresaId?: string;
    },
  ): Promise<StrategicDomainFilteredResult> {
    const client = getDatabaseClient();
    const empty: StrategicDomainFilteredResult = {
      data: {
        baseModules: { flashcardsScore: null, questionsScore: null },
        highRecurrence: { flashcardsScore: null, questionsScore: null },
        recommendations: [],
      },
      modules: [],
    };

    const { cursoIds } = await this.resolveCursoScope(
      alunoId,
      client,
      opts.empresaId,
    );
    const effectiveCursoIds = this.effectiveCourseIds(
      cursoIds,
      opts.scope,
      opts.scopeId,
    );
    if (effectiveCursoIds.length === 0) return empty;

    // Disciplinas do(s) curso(s)
    const { data: cursosDisciplinas } = await client
      .from("cursos_disciplinas")
      .select("disciplina_id, curso_id")
      .in("curso_id", effectiveCursoIds);

    let disciplinaIds = [
      ...new Set(
        ((cursosDisciplinas ?? []) as Array<{ disciplina_id: string }>).map(
          (cd) => cd.disciplina_id,
        ),
      ),
    ];
    if (opts.scope === "disciplina" && opts.scopeId) {
      disciplinaIds = disciplinaIds.includes(opts.scopeId)
        ? [opts.scopeId]
        : [];
    }
    if (disciplinaIds.length === 0) return empty;

    // Frentes
    const { data: todasFrentes } = await client
      .from("frentes")
      .select("id, disciplina_id, curso_id")
      .in("disciplina_id", disciplinaIds)
      .or(
        effectiveCursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
          (effectiveCursoIds.length > 0 ? "," : "") +
          "curso_id.is.null",
      );

    let frentesFiltradas = (
      (todasFrentes ?? []) as Array<{
        id: string;
        disciplina_id: string;
        curso_id: string | null;
      }>
    ).filter((f) => !f.curso_id || effectiveCursoIds.includes(f.curso_id));
    if (opts.scope === "frente" && opts.scopeId) {
      frentesFiltradas = frentesFiltradas.filter((f) => f.id === opts.scopeId);
    }
    if (frentesFiltradas.length === 0) return empty;

    const frenteIds = frentesFiltradas.map((f) => f.id);

    // Módulos
    const { data: todosModulos } = await client
      .from("modulos")
      .select("id, nome, importancia, frente_id, curso_id")
      .in("frente_id", frenteIds)
      .or(
        effectiveCursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
          (effectiveCursoIds.length > 0 ? "," : "") +
          "curso_id.is.null",
      );

    let modulosFiltrados = (
      (todosModulos ?? []) as Array<{
        id: string;
        nome: string;
        importancia: ModuloImportancia | null;
        frente_id: string;
        curso_id: string | null;
      }>
    ).filter((m) => !m.curso_id || effectiveCursoIds.includes(m.curso_id));
    if (opts.scope === "modulo" && opts.scopeId) {
      modulosFiltrados = modulosFiltrados.filter((m) => m.id === opts.scopeId);
    }
    if (modulosFiltrados.length === 0) return empty;

    const modulosById = new Map(
      modulosFiltrados.map((m) => [
        m.id,
        {
          id: m.id,
          nome: m.nome,
          importancia: (m.importancia ?? "Media") as ModuloImportancia,
        },
      ]),
    );

    // Escopo estratégico: somente Base/Alta (como no card atual)
    const baseModuleIds = modulosFiltrados
      .filter((m) => m.importancia === "Base")
      .map((m) => m.id);
    const highRecurrenceModuleIds = modulosFiltrados
      .filter((m) => m.importancia === "Alta")
      .map((m) => m.id);
    const strategicModuleIds = [
      ...new Set([...baseModuleIds, ...highRecurrenceModuleIds]),
    ];
    if (strategicModuleIds.length === 0) return empty;

    const inicioPeriodo = this.getPeriodStart(opts.period);

    const chunk = <T>(arr: T[], size: number): T[][] => {
      if (arr.length === 0) return [];
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
      return out;
    };

    const roundPercentFromAvgFeedback = (sum: number, count: number) => {
      if (count <= 0) return null;
      return Math.round((sum / count / 4) * 100);
    };

    const roundPercentFromRatio = (num: number, den: number) => {
      if (den <= 0) return null;
      return Math.round((num / den) * 100);
    };

    // Flashcards: map flashcard -> modulo, aggregate feedback
    const flashcardIdToModuloId = new Map<string, string>();
    const flashAggByModulo = new Map<string, { sum: number; count: number }>();

    const { data: flashcardsRows } = await client
      .from("flashcards")
      .select("id, modulo_id")
      .in("modulo_id", strategicModuleIds);

    const flashcardIds = (flashcardsRows ?? [])
      .map((f: { id: string; modulo_id: string | null }) => {
        if (f.modulo_id) flashcardIdToModuloId.set(f.id, f.modulo_id);
        return f.id;
      })
      .filter(Boolean);

    if (flashcardIds.length > 0) {
      const progressosFlashcards: Array<{
        flashcard_id: string;
        ultimo_feedback: number | null;
      }> = [];

      await Promise.all(
        chunk(flashcardIds, 900).map(async (idsChunk) => {
          // `ultima_revisao` pode não existir dependendo da migration; se falhar, fazemos fallback para não filtrar por período.
          const attempt = await client
            .from("progresso_flashcards")
            .select("flashcard_id, ultimo_feedback, ultima_revisao")
            .eq("usuario_id", alunoId)
            .in("flashcard_id", idsChunk)
            .not("ultimo_feedback", "is", null)
            .gte("ultima_revisao", inicioPeriodo.toISOString());

          let progChunk = attempt.data as unknown;
          let progErr = attempt.error as unknown;

          if (attempt.error) {
            const msg = attempt.error.message || "";
            const missingUltimaRevisao =
              msg.includes("ultima_revisao") &&
              msg.toLowerCase().includes("does not exist");
            if (missingUltimaRevisao) {
              const fallback = await client
                .from("progresso_flashcards")
                .select("flashcard_id, ultimo_feedback")
                .eq("usuario_id", alunoId)
                .in("flashcard_id", idsChunk)
                .not("ultimo_feedback", "is", null);
              progChunk = fallback.data as unknown;
              progErr = fallback.error as unknown;
            }
          }

          if (progErr) {
            console.error(
              "[dashboard-analytics] Erro ao buscar progresso_flashcards:",
              progErr,
            );
            return;
          }

          progressosFlashcards.push(
            ...((progChunk as Array<{
              flashcard_id: string;
              ultimo_feedback: number | null;
            }>) ?? []),
          );
        }),
      );

      for (const p of progressosFlashcards) {
        const moduloId = flashcardIdToModuloId.get(p.flashcard_id);
        const feedback = p.ultimo_feedback;
        if (!moduloId || feedback == null) continue;
        if (feedback < 1 || feedback > 4) continue;

        const curr = flashAggByModulo.get(moduloId) || { sum: 0, count: 0 };
        curr.sum += feedback;
        curr.count += 1;
        flashAggByModulo.set(moduloId, curr);
      }
    }

    // Questões: progresso_atividades -> atividades(modulo_id)
    const questionsAggByModulo = new Map<
      string,
      { acertos: number; totais: number }
    >();

    // Primeiro restringir atividades aos módulos estratégicos para evitar varrer tudo do aluno
    let atividadesScopeQuery = client
      .from("atividades")
      .select("id, modulo_id")
      .in("modulo_id", strategicModuleIds);
    if (opts.empresaId) {
      atividadesScopeQuery = atividadesScopeQuery.eq(
        "empresa_id",
        opts.empresaId,
      );
    }
    const { data: atividadesInScope, error: atividadesScopeErr } =
      await atividadesScopeQuery;

    if (atividadesScopeErr) {
      console.error(
        "[dashboard-analytics] Erro ao buscar atividades do escopo estratégico:",
        atividadesScopeErr,
      );
    }

    const atividadeIdToModuloId = new Map(
      (
        (atividadesInScope ?? []) as Array<{
          id: string;
          modulo_id: string | null;
        }>
      )
        .filter((a) => a.modulo_id != null)
        .map((a) => [a.id, a.modulo_id as string]),
    );

    const atividadeIds = Array.from(atividadeIdToModuloId.keys());
    if (atividadeIds.length > 0) {
      const progressosAtividades: Array<{
        atividade_id: string;
        questoes_totais: number | null;
        questoes_acertos: number | null;
      }> = [];

      await Promise.all(
        chunk(atividadeIds, 900).map(async (idsChunk) => {
          let q = client
            .from("progresso_atividades")
            .select("atividade_id, questoes_totais, questoes_acertos")
            .eq("usuario_id", alunoId)
            .eq("status", "Concluido")
            .not("questoes_totais", "is", null)
            .gt("questoes_totais", 0)
            .gte("data_conclusao", inicioPeriodo.toISOString())
            .in("atividade_id", idsChunk);
          if (opts.empresaId) q = q.eq("empresa_id", opts.empresaId);
          const { data: progChunk, error: progErr } = await q;

          if (progErr) {
            console.error(
              "[dashboard-analytics] Erro ao buscar progresso_atividades (escopo estratégico):",
              progErr,
            );
            return;
          }

          progressosAtividades.push(
            ...((progChunk ?? []) as typeof progressosAtividades),
          );
        }),
      );

      for (const p of progressosAtividades) {
        const moduloId = atividadeIdToModuloId.get(p.atividade_id);
        if (!moduloId) continue;
        const totais = p.questoes_totais ?? 0;
        const acertos = p.questoes_acertos ?? 0;
        if (totais <= 0) continue;
        const curr = questionsAggByModulo.get(moduloId) || {
          acertos: 0,
          totais: 0,
        };
        curr.acertos += acertos;
        curr.totais += totais;
        questionsAggByModulo.set(moduloId, curr);
      }
    }

    const axisFlashcardsScore = (moduleIds: string[]) => {
      let sum = 0;
      let count = 0;
      for (const id of moduleIds) {
        const agg = flashAggByModulo.get(id);
        if (!agg) continue;
        sum += agg.sum;
        count += agg.count;
      }
      return roundPercentFromAvgFeedback(sum, count);
    };

    const axisQuestionsScore = (moduleIds: string[]) => {
      let acertos = 0;
      let totais = 0;
      for (const id of moduleIds) {
        const agg = questionsAggByModulo.get(id);
        if (!agg) continue;
        acertos += agg.acertos;
        totais += agg.totais;
      }
      return roundPercentFromRatio(acertos, totais);
    };

    const moduleFlashcardsScore = (moduleId: string) => {
      const agg = flashAggByModulo.get(moduleId);
      if (!agg) return null;
      return roundPercentFromAvgFeedback(agg.sum, agg.count);
    };

    const moduleQuestionsScore = (moduleId: string) => {
      const agg = questionsAggByModulo.get(moduleId);
      if (!agg) return null;
      return roundPercentFromRatio(agg.acertos, agg.totais);
    };

    const buildReason = (flash: number | null, questions: number | null) => {
      if (
        flash != null &&
        questions != null &&
        Math.abs(flash - questions) >= 25
      ) {
        return "Gap entre memória e aplicação";
      }

      const threshold = 70;
      if (questions == null || (flash != null && flash <= (questions ?? 999))) {
        return flash != null && flash < threshold
          ? "Flashcards baixos (recall fraco)"
          : "Flashcards com inconsistência";
      }

      return questions < threshold
        ? "Acurácia baixa em questões"
        : "Questões com inconsistência";
    };

    const importanceOrder: Record<ModuloImportancia, number> = {
      Alta: 0,
      Base: 1,
      Media: 2,
      Baixa: 3,
    };

    type RecommendationWithRisk = StrategicDomainRecommendation & {
      risk: number;
    };
    const recommendationsWithRisk: RecommendationWithRisk[] = [];

    const modulesList: StrategicDomainFilteredResult["modules"] = [];

    for (const moduloId of strategicModuleIds) {
      const modulo = modulosById.get(moduloId);
      if (!modulo) continue;

      const flash = moduleFlashcardsScore(moduloId);
      const questions = moduleQuestionsScore(moduloId);
      const risk =
        flash != null && questions != null
          ? Math.min(flash, questions)
          : (flash ?? questions);

      modulesList.push({
        moduloId,
        moduloNome: modulo.nome,
        importancia: modulo.importancia,
        flashcardsScore: flash,
        questionsScore: questions,
        risk: risk ?? null,
      });

      if (risk == null) continue;

      recommendationsWithRisk.push({
        moduloId,
        moduloNome: modulo.nome,
        importancia: modulo.importancia,
        flashcardsScore: flash,
        questionsScore: questions,
        reason: buildReason(flash, questions),
        risk,
      });
    }

    const recommendations: StrategicDomainRecommendation[] =
      recommendationsWithRisk
        .sort((a, b) => {
          if (a.risk !== b.risk) return a.risk - b.risk;
          const ia = importanceOrder[a.importancia] ?? 99;
          const ib = importanceOrder[b.importancia] ?? 99;
          return ia - ib;
        })
        .slice(0, 3)
        .map(({ risk: _risk, ...r }) => r);

    return {
      data: {
        baseModules: {
          flashcardsScore: axisFlashcardsScore(baseModuleIds),
          questionsScore: axisQuestionsScore(baseModuleIds),
        },
        highRecurrence: {
          flashcardsScore: axisFlashcardsScore(highRecurrenceModuleIds),
          questionsScore: axisQuestionsScore(highRecurrenceModuleIds),
        },
        recommendations,
      },
      modules: modulesList.sort((a, b) => (a.risk ?? 999) - (b.risk ?? 999)),
    };
  }

  /**
   * Busca informações do usuário (aluno ou professor)
   */
  public async getUserInfo(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
  ) {
    // Buscar dados do usuário autenticado primeiro para obter o email e role
    const { data: authUser } = await client.auth.admin.getUserById(alunoId);

    if (!authUser?.user) {
      throw new Error("Usuário não encontrado no sistema de autenticação");
    }

    const userEmail = authUser.user.email || "";
    const userRole = (authUser.user.user_metadata?.role as string) || "aluno";
    const isProfessor = userRole === "professor" || userRole === "usuario";

    // Buscar nome do professor se for professor
    let professorName: string | null = null;
    let professorEmpresaId: string | null = null;
    if (isProfessor) {
      const { data: professor } = await client
        .from("usuarios")
        .select("nome_completo, empresa_id")
        .eq("id", alunoId)
        .maybeSingle();

      professorName = professor?.nome_completo || null;
      professorEmpresaId = professor?.empresa_id || null;
    }

    // Buscar dados do aluno (professores também precisam ter registro aqui para dados de sessões/progresso)
    const { data: aluno, error: alunoError } = await client
      .from("usuarios")
      .select("id, nome_completo, email")
      .eq("id", alunoId)
      .maybeSingle();

    // Se houver erro de RLS ou permissão, tentar com cliente admin
    let alunoFinal = aluno;
    if (alunoError && !aluno) {
      console.log(
        "[DashboardAnalytics] Erro ao buscar aluno, tentando com cliente admin:",
        alunoError.message,
      );
      const adminClient = getServiceRoleClient();
      const { data: alunoAdmin, error: adminError } = await adminClient
        .from("usuarios")
        .select("id, nome_completo, email")
        .eq("id", alunoId)
        .maybeSingle();

      if (adminError) {
        console.error(
          "[DashboardAnalytics] Erro mesmo com cliente admin:",
          adminError,
        );
        // Se ainda houver erro, pode ser que o registro realmente não exista
      } else if (alunoAdmin) {
        alunoFinal = alunoAdmin;
      }
    }

    // Se o registro não existe, criar um registro básico
    if (!alunoFinal) {
      console.log(
        `[DashboardAnalytics] Registro não encontrado na tabela alunos para ${isProfessor ? "professor" : "aluno"}, criando registro...`,
      );

      if (!userEmail) {
        throw new Error("Email do usuário é necessário para criar o registro");
      }

      // Obter empresa_id do professor ou do metadata do usuário
      const empresaId =
        professorEmpresaId ||
        (authUser.user.user_metadata?.empresa_id as string) ||
        null;
      if (!empresaId) {
        throw new Error(
          "Empresa do usuário não encontrada. Não é possível criar o registro de aluno.",
        );
      }

      // Usar nome do professor se disponível, senão usar metadata
      const fullName =
        professorName ||
        authUser.user.user_metadata?.full_name ||
        authUser.user.user_metadata?.name ||
        userEmail.split("@")[0] ||
        (isProfessor ? "Professor" : "Aluno");

      // Tentar inserir com o cliente normal primeiro (pode funcionar se RLS permitir)
      let insertClient = client;
      let insertError = null;

      const { error: normalInsertError } = await client
        .from("usuarios")
        .insert({
          id: alunoId,
          email: userEmail,
          nome_completo: fullName,
          empresa_id: empresaId,
        });

      if (normalInsertError) {
        console.log(
          "[DashboardAnalytics] Erro ao inserir com cliente normal, tentando com cliente admin:",
          normalInsertError.message,
        );
        // Tentar com cliente admin (bypass RLS)
        insertClient = getServiceRoleClient();
        const { error: adminInsertError } = await insertClient
          .from("usuarios")
          .insert({
            id: alunoId,
            email: userEmail,
            nome_completo: fullName,
            empresa_id: empresaId,
          });

        if (adminInsertError) {
          insertError = adminInsertError;
        }
      }

      if (insertError) {
        console.error(
          "[DashboardAnalytics] Erro ao criar registro mesmo com cliente admin:",
          insertError,
        );
        throw new Error(`Erro ao criar registro: ${insertError.message}`);
      }

      console.log("[DashboardAnalytics] Registro criado com sucesso");

      // Buscar o registro recém-criado usando o cliente que funcionou
      const { data: novoAluno, error: selectError } = await insertClient
        .from("usuarios")
        .select("id, nome_completo, email")
        .eq("id", alunoId)
        .single();

      if (selectError || !novoAluno) {
        throw new Error("Erro ao buscar registro recém-criado");
      }

      // Usar o novo registro
      alunoFinal = novoAluno;
      const avatarUrl =
        authUser?.user?.user_metadata?.avatar_url ||
        authUser?.user?.user_metadata?.picture ||
        "";

      // Calcular streak (dias consecutivos com sessões de estudo)
      const streakDays = await this.calculateStreak(alunoId, client);

      // Usar nome do professor se disponível, senão usar o nome do registro
      const displayName =
        professorName ||
        alunoFinal.nome_completo ||
        alunoFinal.email.split("@")[0] ||
        (isProfessor ? "Professor" : "Aluno");

      return {
        name: displayName,
        email: alunoFinal.email,
        avatarUrl,
        streakDays,
      };
    }

    // Buscar avatar do usuário (se existir)
    const avatarUrl =
      authUser?.user?.user_metadata?.avatar_url ||
      authUser?.user?.user_metadata?.picture ||
      "";

    // Calcular streak (dias consecutivos com sessões de estudo)
    const streakDays = await this.calculateStreak(alunoId, client);

    // Usar nome do professor se disponível, senão usar o nome do registro de aluno
    const displayName =
      professorName ||
      alunoFinal.nome_completo ||
      alunoFinal.email.split("@")[0] ||
      (isProfessor ? "Professor" : "Aluno");

    return {
      name: displayName,
      email: alunoFinal.email,
      avatarUrl,
      streakDays,
    };
  }

  /**
   * Calcula dias consecutivos de estudo (streak)
   */
  private async calculateStreak(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<number> {
    const { data: sessoes } = await client
      .from("sessoes_estudo")
      .select("inicio")
      .eq("usuario_id", alunoId)
      .eq("status", "concluido")
      .order("inicio", { ascending: false })
      .limit(365);

    if (!sessoes || sessoes.length === 0) return 0;

    // Agrupar por data (ignorar hora)
    const diasUnicos = new Set<string>();
    sessoes.forEach((sessao) => {
      if (sessao.inicio) {
        const data = new Date(sessao.inicio).toISOString().split("T")[0];
        diasUnicos.add(data);
      }
    });

    // Ordenar datas e calcular streak
    const dias = Array.from(diasUnicos).sort().reverse();
    let streak = 0;
    const hoje = new Date().toISOString().split("T")[0];
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Se não estudou hoje, começar de ontem
    let dataEsperada = dias.includes(hoje) ? hoje : ontem;

    for (const dia of dias) {
      if (dia === dataEsperada) {
        streak++;
        // Calcular próxima data esperada
        const dataEsperadaDate = new Date(dataEsperada);
        dataEsperadaDate.setDate(dataEsperadaDate.getDate() - 1);
        dataEsperada = dataEsperadaDate.toISOString().split("T")[0];
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Busca métricas principais
   */
  public async getMetrics(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ) {
    const scheduleProgress = await this.getScheduleProgress(
      alunoId,
      client,
      empresaId,
    );

    const { focusTime, focusTimeDelta, classTime, exerciseTime } =
      await this.getFocusTime(alunoId, client, period, empresaId);

    const { questionsAnswered, periodLabel } = await this.getQuestionsAnswered(
      alunoId,
      client,
      period,
      empresaId,
    );

    const accuracy = await this.getAccuracy(alunoId, client, period, empresaId);

    const flashcardsReviewed = await this.getFlashcardsReviewed(
      alunoId,
      client,
      period,
      empresaId,
    );

    return {
      scheduleProgress,
      focusTime,
      focusTimeDelta,
      classTime,
      exerciseTime,
      questionsAnswered,
      questionsAnsweredPeriod: periodLabel,
      accuracy,
      flashcardsReviewed,
    };
  }

  /**
   * Calcula progresso do cronograma
   * Considera aulas concluídas (cronograma_itens.concluido) para evitar duplicação
   * Não conta tempo_estudos_concluido separadamente para não duplicar
   *
   * Usa a mesma lógica das páginas de calendário e cronograma: busca o cronograma mais recente
   */
  private async getScheduleProgress(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    empresaId?: string,
  ): Promise<number> {
    let query = client
      .from("cronogramas")
      .select("id")
      .eq("usuario_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data: cronograma } = await query.maybeSingle();

    if (!cronograma) return 0;

    // Buscar total de itens (aulas) no cronograma
    const { data: itens, error: itensError } = await client
      .from("cronograma_itens")
      .select("id, concluido")
      .eq("cronograma_id", cronograma.id);

    if (itensError || !itens || itens.length === 0) return 0;

    // Contar aulas concluídas (mesma lógica do calendário)
    const totalAulas = itens.length;
    const aulasConcluidas = itens.filter(
      (item) => item.concluido === true,
    ).length;

    // Calcular percentual baseado em aulas concluídas
    // Isso evita duplicação pois conta cada aula apenas uma vez
    // Usa a mesma fórmula do calendário: (concluídas / total) * 100
    return totalAulas > 0
      ? Math.round((aulasConcluidas / totalAulas) * 100)
      : 0;
  }

  /**
   * Calcula tempo focado e delta
   */
  private async getFocusTime(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ): Promise<{
    focusTime: string;
    focusTimeDelta: string;
    classTime: string;
    exerciseTime: string;
  }> {
    const inicioPeriodo = this.getPeriodStart(period);
    const fimPeriodo = new Date();

    const tempoPeriodo = await this.getStudyTimeSecondsForPeriod(
      alunoId,
      client,
      { start: inicioPeriodo, end: fimPeriodo, empresaId },
    );

    const inicioPeriodoAnterior = new Date(inicioPeriodo);
    const fimPeriodoAnterior = new Date(inicioPeriodo);

    const days = this.getPeriodDays(period);
    inicioPeriodoAnterior.setDate(inicioPeriodoAnterior.getDate() - days);

    const tempoPeriodoAnterior = await this.getStudyTimeSecondsForPeriod(
      alunoId,
      client,
      {
        start: inicioPeriodoAnterior,
        end: fimPeriodoAnterior,
        empresaId,
      },
    );

    // Formatar tempos
    const focusTime = this.formatSeconds(tempoPeriodo.total);
    const classTime = this.formatSeconds(tempoPeriodo.classSeconds);
    const exerciseTime = this.formatSeconds(tempoPeriodo.exerciseSeconds);

    // Calcular delta (apenas para o total)
    const delta = tempoPeriodo.total - tempoPeriodoAnterior.total;
    const deltaHoras = Math.abs(Math.floor(delta / 3600));
    const deltaMinutos = Math.abs(Math.floor((delta % 3600) / 60));
    const deltaFormatted =
      deltaHoras > 0 ? `${deltaHoras}h` : `${deltaMinutos}m`;
    const focusTimeDelta =
      delta >= 0 ? `+${deltaFormatted}` : `-${deltaFormatted}`;

    return { focusTime, focusTimeDelta, classTime, exerciseTime };
  }

  /**
   * Conta questões feitas
   */
  private async getQuestionsAnswered(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ): Promise<{ questionsAnswered: number; periodLabel: string }> {
    const inicioPeriodo = this.getPeriodStart(period);

    let query = client
      .from("progresso_atividades")
      .select("questoes_totais")
      .eq("usuario_id", alunoId)
      .eq("status", "Concluido")
      .gte("data_conclusao", inicioPeriodo.toISOString());
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data: progressos } = await query;

    const total =
      progressos?.reduce((acc, p) => acc + (p.questoes_totais || 0), 0) || 0;

    return {
      questionsAnswered: total,
      periodLabel:
        period === "semanal"
          ? "Essa semana"
          : period === "mensal"
            ? "Esse mês"
            : "Esse ano",
    };
  }

  /**
   * Calcula aproveitamento médio
   */
  private async getAccuracy(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ): Promise<number> {
    const inicioPeriodo = this.getPeriodStart(period);
    let query = client
      .from("progresso_atividades")
      .select("questoes_totais, questoes_acertos")
      .eq("usuario_id", alunoId)
      .eq("status", "Concluido")
      .gte("data_conclusao", inicioPeriodo.toISOString())
      .not("questoes_totais", "is", null)
      .gt("questoes_totais", 0);
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data: progressos } = await query;

    if (!progressos || progressos.length === 0) return 0;

    let totalQuestoes = 0;
    let totalAcertos = 0;

    progressos.forEach((p) => {
      totalQuestoes += p.questoes_totais || 0;
      totalAcertos += p.questoes_acertos || 0;
    });

    return totalQuestoes > 0
      ? Math.round((totalAcertos / totalQuestoes) * 100)
      : 0;
  }

  /**
   * Conta flashcards revisados
   */
  private async getFlashcardsReviewed(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ): Promise<number> {
    const inicioPeriodo = this.getPeriodStart(period);
    let query = client
      .from("progresso_flashcards")
      .select("flashcard_id")
      .eq("usuario_id", alunoId)
      .gte("updated_at", inicioPeriodo.toISOString());
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data: progressosFlashcards, error: queryError } = await query;

    if (queryError) {
      console.error(
        "[dashboard-analytics] Erro ao buscar flashcards revisados:",
        queryError,
      );
      return 0;
    }

    if (!progressosFlashcards || progressosFlashcards.length === 0) {
      return 0;
    }

    // Contar flashcards únicos (um flashcard pode ter múltiplas revisões)
    const flashcardsUnicos = new Set(
      progressosFlashcards
        .map((p) => p.flashcard_id)
        .filter((id): id is string => id !== null),
    );
    return flashcardsUnicos.size;
  }

  /**
   * Gera dados do heatmap (365 dias)
   */
  public async getHeatmapData(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: "semanal" | "mensal" | "anual" = "anual",
    empresaId?: string,
  ) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Normalizar para início do dia

    let inicioPeriodo: Date;
    let dias: number;

    // Calcular período baseado no parâmetro
    switch (period) {
      case "semanal":
        inicioPeriodo = new Date(hoje);
        inicioPeriodo.setDate(hoje.getDate() - 7);
        dias = 7;
        break;
      case "mensal":
        inicioPeriodo = new Date(hoje);
        inicioPeriodo.setDate(hoje.getDate() - 31);
        dias = 31;
        break;
      case "anual":
      default:
        inicioPeriodo = new Date(hoje);
        inicioPeriodo.setDate(hoje.getDate() - 365);
        dias = 365;
        break;
    }

    // NOVO: Heatmap considera o mesmo "tempo de estudo" do card:
    // - listas (sessões vinculadas a atividade)
    // - aulas assistidas (cronograma_itens concluído)

    const [sessRows, watchedRows] = await Promise.all([
      this.getListSessionsHeatmapRows(alunoId, client, {
        start: inicioPeriodo,
        empresaId,
      }),
      this.getWatchedClassesHeatmapRows(alunoId, client, {
        start: inicioPeriodo,
        empresaId,
      }),
    ]);

    // Criar mapa de dias
    const diasMap = new Map<string, number>();

    for (const row of sessRows) {
      const data = new Date(row.inicio).toISOString().split("T")[0];
      const minutos = Math.floor((row.seconds || 0) / 60);
      const atual = diasMap.get(data) || 0;
      diasMap.set(data, atual + minutos);
    }
    for (const row of watchedRows) {
      const data = new Date(row.dataConclusao).toISOString().split("T")[0];
      const minutos = Math.floor((row.seconds || 0) / 60);
      const atual = diasMap.get(data) || 0;
      diasMap.set(data, atual + minutos);
    }

    // Gerar array de dias
    const heatmap: Array<{ date: string; intensity: number }> = [];
    for (let i = 0; i < dias; i++) {
      const data = new Date(inicioPeriodo);
      data.setDate(inicioPeriodo.getDate() + i);
      const dataStr = data.toISOString().split("T")[0];

      const minutos = diasMap.get(dataStr) || 0;
      // Classificar intensidade: 0-30min=1, 30-60min=2, 60-120min=3, >120min=4
      let intensity = 0;
      if (minutos > 0) {
        if (minutos < 30) intensity = 1;
        else if (minutos < 60) intensity = 2;
        else if (minutos < 120) intensity = 3;
        else intensity = 4;
      }

      heatmap.push({ date: dataStr, intensity });
    }

    return heatmap;
  }

  /**
   * Calcula performance por disciplina/frente
   * Retorna todas as frentes dos cursos do aluno, mesmo sem progresso
   */
  public async getSubjectPerformance(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ) {
    // 1. Buscar cursos no escopo (respeita empresaId para alunos multi-org)
    const { cursoIds } = await this.resolveCursoScope(
      alunoId,
      client,
      empresaId,
    );

    if (cursoIds.length === 0) return [];

    // 2. Buscar disciplinas dos cursos
    const { data: cursosDisciplinas } = await client
      .from("cursos_disciplinas")
      .select("disciplina_id, curso_id")
      .in("curso_id", cursoIds);

    if (!cursosDisciplinas || cursosDisciplinas.length === 0) return [];

    const disciplinaIds = [
      ...new Set(
        cursosDisciplinas.map(
          (cd: { disciplina_id: string }) => cd.disciplina_id,
        ),
      ),
    ];

    // 3. Buscar TODAS as frentes dessas disciplinas (mesmo sem progresso)
    const { data: todasFrentes } = await client
      .from("frentes")
      .select("id, nome, disciplina_id, curso_id")
      .in("disciplina_id", disciplinaIds)
      .or(
        cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
          (cursoIds.length > 0 ? "," : "") +
          "curso_id.is.null",
      );

    if (!todasFrentes || todasFrentes.length === 0) return [];

    // Filtrar frentes que pertencem aos cursos ou são globais
    const frentesFiltradas = todasFrentes.filter(
      (f) => !f.curso_id || cursoIds.includes(f.curso_id),
    );

    // 4. Buscar disciplinas
    const disciplinaIdsFrentes = [
      ...new Set(
        frentesFiltradas
          .map((f) => f.disciplina_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const { data: disciplinas } = await client
      .from("disciplinas")
      .select("id, nome")
      .in("id", disciplinaIdsFrentes);

    const disciplinaMap = new Map(disciplinas?.map((d) => [d.id, d]) || []);

    // 5. Buscar progressos com questões (se houver)
    const inicioPeriodo = this.getPeriodStart(period);
    let progressosQuery = client
      .from("progresso_atividades")
      .select(
        `
        questoes_totais,
        questoes_acertos,
        atividade_id
      `,
      )
      .eq("usuario_id", alunoId)
      .eq("status", "Concluido")
      .gte("data_conclusao", inicioPeriodo.toISOString())
      .not("questoes_totais", "is", null)
      .gt("questoes_totais", 0);
    if (empresaId)
      progressosQuery = progressosQuery.eq("empresa_id", empresaId);
    const { data: progressos } = await progressosQuery;

    // 6. Se houver progressos, calcular performance por frente
    const performanceMap = new Map<
      string,
      { total: number; acertos: number; disciplina: string; frente: string }
    >();

    if (progressos && progressos.length > 0) {
      // Buscar atividades
      const atividadeIds = progressos
        .map((p) => p.atividade_id)
        .filter((id): id is string => Boolean(id));
      let atividadesQuery = client
        .from("atividades")
        .select("id, modulo_id")
        .in("id", atividadeIds);
      if (empresaId)
        atividadesQuery = atividadesQuery.eq("empresa_id", empresaId);
      const { data: atividades } = await atividadesQuery;

      if (atividades && atividades.length > 0) {
        // Buscar módulos
        const moduloIds = [
          ...new Set(
            atividades
              .map((a) => a.modulo_id)
              .filter((id): id is string => Boolean(id)),
          ),
        ];
        const { data: modulos } = await client
          .from("modulos")
          .select("id, frente_id")
          .in("id", moduloIds);

        if (modulos && modulos.length > 0) {
          // Criar mapas para lookup
          const atividadeModuloMap = new Map(
            atividades.map((a) => [a.id, a.modulo_id]),
          );
          const moduloFrenteMap = new Map(
            modulos.map((m) => [m.id, m.frente_id]),
          );
          const progressoMap = new Map(
            progressos.map((p) => [p.atividade_id, p]),
          );

          // Agrupar por disciplina/frente
          atividades.forEach((atividade) => {
            const progresso = progressoMap.get(atividade.id);
            if (!progresso) return;

            const moduloId = atividadeModuloMap.get(atividade.id);
            if (!moduloId) return;

            const frenteId = moduloFrenteMap.get(moduloId);
            if (!frenteId) return;

            const frente = frentesFiltradas.find((f) => f.id === frenteId);
            if (!frente) return;

            const disciplina = disciplinaMap.get(frente.disciplina_id || "");
            if (!disciplina) return;

            const key = `${disciplina.id}-${frente.id}`;
            const atual = performanceMap.get(key) || {
              total: 0,
              acertos: 0,
              disciplina: disciplina.nome,
              frente: frente.nome,
            };

            atual.total += progresso.questoes_totais || 0;
            atual.acertos += progresso.questoes_acertos || 0;
            performanceMap.set(key, atual);
          });
        }
      }
    }

    // 7. Criar lista final: todas as frentes, com ou sem progresso
    const subjects = frentesFiltradas
      .map((frente, index) => {
        const disciplina = disciplinaMap.get(frente.disciplina_id || "");
        if (!disciplina) return null;

        const key = `${disciplina.id}-${frente.id}`;
        const performance = performanceMap.get(key);

        if (performance) {
          // Frente com progresso: calcular score
          const score =
            performance.total > 0
              ? Math.round((performance.acertos / performance.total) * 100)
              : 0;
          return {
            id: index + 1,
            name: disciplina.nome,
            front: frente.nome,
            score,
            isNotStarted: false,
          };
        } else {
          // Frente sem progresso: score 0 e status "Não iniciada"
          return {
            id: index + 1,
            name: disciplina.nome,
            front: frente.nome,
            score: 0,
            isNotStarted: true,
          };
        }
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return subjects;
  }

  /**
   * Calcula eficiência de foco por dia da semana
   */
  public async getFocusEfficiency(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ) {
    const inicioPeriodo = this.getPeriodStart(period);

    let query = client
      .from("sessoes_estudo")
      .select(
        "inicio, tempo_total_bruto_segundos, tempo_total_liquido_segundos",
      )
      .eq("usuario_id", alunoId)
      .eq("status", "concluido")
      .gte("inicio", inicioPeriodo.toISOString());
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data: sessoes } = await query;

    // Agrupar por dia da semana
    const diasMap = new Map<number, { bruto: number; liquido: number }>();

    sessoes?.forEach((sessao) => {
      if (sessao.inicio) {
        const data = new Date(sessao.inicio);
        const diaSemana = data.getDay(); // 0 = domingo, 1 = segunda, etc.
        const atual = diasMap.get(diaSemana) || { bruto: 0, liquido: 0 };

        atual.bruto += sessao.tempo_total_bruto_segundos || 0;
        atual.liquido += sessao.tempo_total_liquido_segundos || 0;
        diasMap.set(diaSemana, atual);
      }
    });

    // Converter para formato esperado (Segunda = 1, Domingo = 0)
    const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const efficiency = [];

    // Segunda a Domingo
    for (let i = 1; i <= 7; i++) {
      const diaIndex = i === 7 ? 0 : i; // Domingo é 0
      const data = diasMap.get(diaIndex) || { bruto: 0, liquido: 0 };

      efficiency.push({
        day: diasSemana[diaIndex],
        grossTime: Math.floor(data.bruto / 60), // minutos
        netTime: Math.floor(data.liquido / 60), // minutos
      });
    }

    return efficiency;
  }

  /**
   * Distribuição por disciplina (wrapper para filtered)
   */
  public async getSubjectDistribution(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ): Promise<SubjectDistributionItem[]> {
    const filtered = await this.getSubjectDistributionFiltered(alunoId, {
      groupBy: "disciplina",
      scope: "curso",
      scopeId: undefined, // internal logic handles scope based on data
      period,
      empresaId,
    });
    return filtered.items;
  }

  /**
   * Calcula domínio estratégico
   */
  public async getStrategicDomain(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    empresaId?: string,
  ): Promise<StrategicDomain> {
    // Reusar a versão filtrável para manter consistência e respeitar o período selecionado.
    // (Mantemos a implementação antiga abaixo como fallback/legado.)
    try {
      const filtered = await this.getStrategicDomainFiltered(alunoId, {
        scope: "curso",
        scopeId: undefined,
        period,
        empresaId,
      });
      return filtered.data;
    } catch (e) {
      console.warn(
        "[dashboard-analytics] Falha ao calcular strategicDomain filtrado, usando fallback legado:",
        e,
      );
    }

    const empty: StrategicDomain = {
      baseModules: { flashcardsScore: null, questionsScore: null },
      highRecurrence: { flashcardsScore: null, questionsScore: null },
      recommendations: [],
    };

    const chunk = <T>(arr: T[], size: number): T[][] => {
      if (arr.length === 0) return [];
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
      return out;
    };

    const roundPercentFromAvgFeedback = (sum: number, count: number) => {
      if (count <= 0) return null;
      // avg(feedback) é 1..4 → converter para 0..100
      return Math.round((sum / count / 4) * 100);
    };

    const roundPercentFromRatio = (num: number, den: number) => {
      if (den <= 0) return null;
      return Math.round((num / den) * 100);
    };

    // 1) Resolver cursos do usuário (mesma lógica de getSubjectPerformance)
    const { data: professorData } = await client
      .from("usuarios")
      .select("id")
      .eq("id", alunoId)
      .maybeSingle();

    // Fallback: alguns usuários podem não ter registro em `usuarios`,
    // mas ainda assim devem ter acesso "tipo professor" (todos os cursos).
    let isProfessor = !!professorData;
    if (!isProfessor) {
      try {
        const { data: authUser } = await client.auth.admin.getUserById(alunoId);
        const role =
          (authUser?.user?.user_metadata?.role as string | undefined) ??
          undefined;
        if (role === "professor" || role === "usuario") {
          isProfessor = true;
        }
      } catch (e) {
        // Se falhar, mantém o comportamento atual (aluno).
        console.warn(
          "[dashboard-analytics] Não foi possível ler role do usuário via auth.admin:",
          e,
        );
      }
    }

    let cursoIds: string[] = [];

    if (isProfessor) {
      const { data: todosCursos } = await client.from("cursos").select("id");
      cursoIds = (todosCursos ?? []).map((c: { id: string }) => c.id);
    } else {
      const { data: alunosCursos } = await client
        .from("alunos_cursos")
        .select("curso_id")
        .eq("usuario_id", alunoId);
      cursoIds = (alunosCursos ?? []).map(
        (ac: { curso_id: string }) => ac.curso_id,
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[dashboard-analytics] strategicDomain: scope", {
        alunoId,
        isProfessor,
        cursoIdsCount: cursoIds.length,
      });
    }

    if (cursoIds.length === 0) return empty;

    // 2) Disciplinas dos cursos
    const { data: cursosDisciplinas } = await client
      .from("cursos_disciplinas")
      .select("disciplina_id, curso_id")
      .in("curso_id", cursoIds);

    if (process.env.NODE_ENV === "development") {
      console.log("[dashboard-analytics] strategicDomain: cursos_disciplinas", {
        rows: cursosDisciplinas?.length ?? 0,
      });
    }

    if (!cursosDisciplinas || cursosDisciplinas.length === 0) return empty;

    const disciplinaIds = [
      ...new Set(
        cursosDisciplinas.map(
          (cd: { disciplina_id: string }) => cd.disciplina_id,
        ),
      ),
    ];

    // 3) Frentes das disciplinas (curso_id do curso ou null)
    const { data: todasFrentes } = await client
      .from("frentes")
      .select("id, disciplina_id, curso_id")
      .in("disciplina_id", disciplinaIds)
      .or(
        cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
          (cursoIds.length > 0 ? "," : "") +
          "curso_id.is.null",
      );

    const frentesFiltradas = (todasFrentes ?? []).filter(
      (f: { curso_id: string | null }) =>
        !f.curso_id || cursoIds.includes(f.curso_id),
    );

    if (process.env.NODE_ENV === "development") {
      console.log("[dashboard-analytics] strategicDomain: frentes", {
        frentes: frentesFiltradas.length,
      });
    }

    if (frentesFiltradas.length === 0) return empty;

    const frenteIds = frentesFiltradas.map((f: { id: string }) => f.id);

    // 4) Módulos das frentes (curso_id do curso ou null)
    const { data: todosModulos } = await client
      .from("modulos")
      .select("id, nome, importancia, frente_id, curso_id")
      .in("frente_id", frenteIds)
      .or(
        cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
          (cursoIds.length > 0 ? "," : "") +
          "curso_id.is.null",
      );

    const modulosFiltrados = (todosModulos ?? []).filter(
      (m: { curso_id: string | null }) =>
        !m.curso_id || cursoIds.includes(m.curso_id),
    );

    if (process.env.NODE_ENV === "development") {
      const baseCount = modulosFiltrados.filter(
        (m: { importancia: ModuloImportancia | null }) =>
          m.importancia === "Base",
      ).length;
      const altaCount = modulosFiltrados.filter(
        (m: { importancia: ModuloImportancia | null }) =>
          m.importancia === "Alta",
      ).length;
      console.log("[dashboard-analytics] strategicDomain: modulos", {
        modulos: modulosFiltrados.length,
        baseCount,
        altaCount,
      });
    }

    if (modulosFiltrados.length === 0) return empty;

    const modulosById = new Map(
      modulosFiltrados.map(
        (m: {
          id: string;
          nome: string;
          importancia: ModuloImportancia | null;
        }) => [
          m.id,
          {
            id: m.id,
            nome: m.nome,
            importancia: (m.importancia ?? "Media") as ModuloImportancia,
          },
        ],
      ),
    );

    const baseModuleIds = modulosFiltrados
      .filter(
        (m: { importancia: ModuloImportancia | null }) =>
          m.importancia === "Base",
      )
      .map((m: { id: string }) => m.id);

    const highRecurrenceModuleIds = modulosFiltrados
      .filter(
        (m: { importancia: ModuloImportancia | null }) =>
          m.importancia === "Alta",
      )
      .map((m: { id: string }) => m.id);

    const strategicModuleIds = [
      ...new Set([...baseModuleIds, ...highRecurrenceModuleIds]),
    ];
    if (process.env.NODE_ENV === "development") {
      console.log("[dashboard-analytics] strategicDomain: strategicModuleIds", {
        baseModuleIds: baseModuleIds.length,
        highRecurrenceModuleIds: highRecurrenceModuleIds.length,
        total: strategicModuleIds.length,
      });
    }

    if (strategicModuleIds.length === 0) return empty;

    // 5) Flashcards (memória): mapear flashcard_id -> modulo_id e agregar feedback
    const flashcardIdToModuloId = new Map<string, string>();
    const flashAggByModulo = new Map<string, { sum: number; count: number }>();

    const { data: flashcardsRows } = await client
      .from("flashcards")
      .select("id, modulo_id")
      .in("modulo_id", strategicModuleIds);

    const flashcardIds = (flashcardsRows ?? [])
      .map((f: { id: string; modulo_id: string | null }) => {
        if (f.modulo_id) flashcardIdToModuloId.set(f.id, f.modulo_id);
        return f.id;
      })
      .filter(Boolean);

    if (process.env.NODE_ENV === "development") {
      console.log("[dashboard-analytics] strategicDomain: flashcards", {
        flashcardsInStrategicModules: flashcardIds.length,
      });
    }

    if (flashcardIds.length > 0) {
      const progressosFlashcards: Array<{
        flashcard_id: string;
        ultimo_feedback: number | null;
      }> = [];

      await Promise.all(
        chunk(flashcardIds, 900).map(async (idsChunk) => {
          const { data: progChunk, error: progErr } = await client
            .from("progresso_flashcards")
            .select("flashcard_id, ultimo_feedback")
            .eq("usuario_id", alunoId)
            .in("flashcard_id", idsChunk)
            .not("ultimo_feedback", "is", null);

          if (progErr) {
            console.error(
              "[dashboard-analytics] Erro ao buscar progresso_flashcards:",
              progErr,
            );
            return;
          }

          progressosFlashcards.push(
            ...((progChunk as Array<{
              flashcard_id: string;
              ultimo_feedback: number | null;
            }>) ?? []),
          );
        }),
      );

      for (const p of progressosFlashcards) {
        const moduloId = flashcardIdToModuloId.get(p.flashcard_id);
        const feedback = p.ultimo_feedback;
        if (!moduloId || feedback == null) continue;
        if (feedback < 1 || feedback > 4) continue;

        const curr = flashAggByModulo.get(moduloId) || { sum: 0, count: 0 };
        curr.sum += feedback;
        curr.count += 1;
        flashAggByModulo.set(moduloId, curr);
      }

      if (process.env.NODE_ENV === "development") {
        let totalCount = 0;
        for (const v of flashAggByModulo.values()) totalCount += v.count;
        console.log(
          "[dashboard-analytics] strategicDomain: progresso_flashcards",
          {
            rows: progressosFlashcards.length,
            aggregatedCount: totalCount,
            modulesWithEvidence: flashAggByModulo.size,
          },
        );
      }
    }

    // 6) Questões (aplicação): progresso_atividades -> atividades(modulo_id)
    const questionsAggByModulo = new Map<
      string,
      { acertos: number; totais: number }
    >();

    const { data: progressosAtividades, error: progAtvError } = await client
      .from("progresso_atividades")
      .select("atividade_id, questoes_totais, questoes_acertos")
      .eq("usuario_id", alunoId)
      .eq("status", "Concluido")
      .not("questoes_totais", "is", null)
      .gt("questoes_totais", 0);

    if (progAtvError) {
      console.error(
        "[dashboard-analytics] Erro ao buscar progresso_atividades:",
        progAtvError,
      );
    }

    if (process.env.NODE_ENV === "development") {
      console.log(
        "[dashboard-analytics] strategicDomain: progresso_atividades",
        {
          rows: progressosAtividades?.length ?? 0,
        },
      );
    }

    const atividadeIds = [
      ...new Set(
        (progressosAtividades ?? [])
          .map((p: { atividade_id: string | null }) => p.atividade_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const atividadeIdToModuloId = new Map<string, string>();

    await Promise.all(
      chunk(atividadeIds, 900).map(async (idsChunk) => {
        const { data: atividadesChunk, error: atvErr } = await client
          .from("atividades")
          .select("id, modulo_id")
          .in("id", idsChunk);

        if (atvErr) {
          console.error(
            "[dashboard-analytics] Erro ao buscar atividades:",
            atvErr,
          );
          return;
        }

        for (const a of (atividadesChunk ?? []) as Array<{
          id: string;
          modulo_id: string | null;
        }>) {
          if (a.modulo_id) atividadeIdToModuloId.set(a.id, a.modulo_id);
        }
      }),
    );

    for (const p of (progressosAtividades ?? []) as Array<{
      atividade_id: string;
      questoes_totais: number | null;
      questoes_acertos: number | null;
    }>) {
      const moduloId = atividadeIdToModuloId.get(p.atividade_id);
      if (!moduloId) continue;
      if (!strategicModuleIds.includes(moduloId)) continue;

      const totais = p.questoes_totais ?? 0;
      const acertos = p.questoes_acertos ?? 0;
      if (totais <= 0) continue;

      const curr = questionsAggByModulo.get(moduloId) || {
        acertos: 0,
        totais: 0,
      };
      curr.acertos += acertos;
      curr.totais += totais;
      questionsAggByModulo.set(moduloId, curr);
    }

    if (process.env.NODE_ENV === "development") {
      let totais = 0;
      for (const v of questionsAggByModulo.values()) totais += v.totais;
      console.log(
        "[dashboard-analytics] strategicDomain: questionsAggByModulo",
        {
          modulesWithEvidence: questionsAggByModulo.size,
          summedTotais: totais,
        },
      );
    }

    const axisFlashcardsScore = (moduleIds: string[]) => {
      let sum = 0;
      let count = 0;
      for (const id of moduleIds) {
        const agg = flashAggByModulo.get(id);
        if (!agg) continue;
        sum += agg.sum;
        count += agg.count;
      }
      return roundPercentFromAvgFeedback(sum, count);
    };

    const axisQuestionsScore = (moduleIds: string[]) => {
      let acertos = 0;
      let totais = 0;
      for (const id of moduleIds) {
        const agg = questionsAggByModulo.get(id);
        if (!agg) continue;
        acertos += agg.acertos;
        totais += agg.totais;
      }
      return roundPercentFromRatio(acertos, totais);
    };

    const moduleFlashcardsScore = (moduleId: string) => {
      const agg = flashAggByModulo.get(moduleId);
      if (!agg) return null;
      return roundPercentFromAvgFeedback(agg.sum, agg.count);
    };

    const moduleQuestionsScore = (moduleId: string) => {
      const agg = questionsAggByModulo.get(moduleId);
      if (!agg) return null;
      return roundPercentFromRatio(agg.acertos, agg.totais);
    };

    const buildReason = (flash: number | null, questions: number | null) => {
      if (
        flash != null &&
        questions != null &&
        Math.abs(flash - questions) >= 25
      ) {
        return "Gap entre memória e aplicação";
      }

      const threshold = 70;
      if (questions == null || (flash != null && flash <= (questions ?? 999))) {
        return flash != null && flash < threshold
          ? "Flashcards baixos (recall fraco)"
          : "Flashcards com inconsistência";
      }

      return questions < threshold
        ? "Acurácia baixa em questões"
        : "Questões com inconsistência";
    };

    const importanceOrder: Record<ModuloImportancia, number> = {
      Alta: 0,
      Base: 1,
      Media: 2,
      Baixa: 3,
    };

    type RecommendationWithRisk = StrategicDomainRecommendation & {
      risk: number;
    };

    const recommendationsWithRisk: RecommendationWithRisk[] = [];

    for (const moduloId of strategicModuleIds) {
      const modulo = modulosById.get(moduloId);
      if (!modulo) continue;

      const flash = moduleFlashcardsScore(moduloId);
      const questions = moduleQuestionsScore(moduloId);
      const risk =
        flash != null && questions != null
          ? Math.min(flash, questions)
          : (flash ?? questions);

      if (risk == null) continue;

      recommendationsWithRisk.push({
        moduloId,
        moduloNome: modulo.nome,
        importancia: modulo.importancia,
        flashcardsScore: flash,
        questionsScore: questions,
        reason: buildReason(flash, questions),
        risk,
      });
    }

    const recommendations: StrategicDomainRecommendation[] =
      recommendationsWithRisk
        .sort((a, b) => {
          if (a.risk !== b.risk) return a.risk - b.risk;
          const ia = importanceOrder[a.importancia] ?? 99;
          const ib = importanceOrder[b.importancia] ?? 99;
          return ia - ib;
        })
        .slice(0, 3)
        .map(({ risk: _risk, ...r }) => r);

    return {
      baseModules: {
        flashcardsScore: axisFlashcardsScore(baseModuleIds),
        questionsScore: axisQuestionsScore(baseModuleIds),
      },
      highRecurrence: {
        flashcardsScore: axisFlashcardsScore(highRecurrenceModuleIds),
        questionsScore: axisQuestionsScore(highRecurrenceModuleIds),
      },
      recommendations,
    };
  }

  // ============================================================================
  // Helpers: "tempo de estudo" (aulas assistidas + listas)
  // ============================================================================

  private async getLatestCronogramaId(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    empresaId?: string,
  ): Promise<string | null> {
    let query = client
      .from("cronogramas")
      .select("id")
      .eq("usuario_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (empresaId) query = query.eq("empresa_id", empresaId);
    const { data: cronograma } = await query.maybeSingle<{ id: string }>();
    return cronograma?.id ?? null;
  }

  private async getListSessionsRows(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    opts: { start: Date; end?: Date; empresaId?: string },
  ): Promise<StudyTimeRow[]> {
    // Obs: `sessoes_estudo.modulo_id` pode não existir em alguns bancos (migração pendente).
    // Mantemos fallback e inferimos modulo_id via join com `atividades` quando possível.
    type SessaoRow = {
      tempo_total_liquido_segundos: number | null;
      disciplina_id: string | null;
      frente_id: string | null;
      modulo_id?: string | null;
      atividade_relacionada_id?: string | null;
      atividades?:
        | { modulo_id?: string | null }
        | { modulo_id?: string | null }[]
        | null;
    };

    const buildBaseQuery = (selectCols: string) => {
      let q = client
        .from("sessoes_estudo")
        .select(selectCols)
        .eq("usuario_id", alunoId)
        .eq("status", "concluido")
        .not("atividade_relacionada_id", "is", null)
        .gte("inicio", opts.start.toISOString());
      if (opts.end) q = q.lt("inicio", opts.end.toISOString());
      if (opts.empresaId) q = q.eq("empresa_id", opts.empresaId);
      return q.returns<SessaoRow[]>();
    };

    let sessoes: SessaoRow[] | null = null;

    const attempt = await buildBaseQuery(
      "tempo_total_liquido_segundos, disciplina_id, frente_id, modulo_id, atividade_relacionada_id, atividades(modulo_id)",
    );

    if (attempt.error) {
      const msg = attempt.error.message || "";
      const isMissingModuloId =
        msg.includes("sessoes_estudo.modulo_id") &&
        msg.toLowerCase().includes("does not exist");
      if (!isMissingModuloId) {
        throw new Error(
          `Erro ao buscar sessões de listas: ${attempt.error.message}`,
        );
      }

      const fallback = await buildBaseQuery(
        "tempo_total_liquido_segundos, disciplina_id, frente_id, atividade_relacionada_id, atividades(modulo_id)",
      );
      if (fallback.error) {
        throw new Error(
          `Erro ao buscar sessões de listas: ${fallback.error.message}`,
        );
      }
      sessoes = fallback.data ?? [];
    } else {
      sessoes = attempt.data ?? [];
    }

    return (sessoes ?? []).map((r) => {
      const nested = r.atividades;
      const nestedModulo = Array.isArray(nested)
        ? (nested[0]?.modulo_id ?? null)
        : (nested?.modulo_id ?? null);
      return {
        seconds: r.tempo_total_liquido_segundos ?? 0,
        curso_id: null,
        disciplina_id: r.disciplina_id ?? null,
        frente_id: r.frente_id ?? null,
        modulo_id: r.modulo_id ?? nestedModulo ?? null,
      };
    });
  }

  private async getWatchedClassesRows(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    opts: { start: Date; end?: Date; empresaId?: string },
  ): Promise<StudyTimeRow[]> {
    const cronogramaId = await this.getLatestCronogramaId(
      alunoId,
      client,
      opts.empresaId,
    );
    if (!cronogramaId) return [];

    // tempo_estimado_minutos pode ser null; usamos fallback de 10min para não “zerar” o tempo.
    const TEMPO_PADRAO_MINUTOS = 10;

    let q = client
      .from("cronograma_itens")
      .select(
        "data_conclusao, aulas(tempo_estimado_minutos, curso_id, modulo_id, modulos(frente_id, frentes(disciplina_id)))",
      )
      .eq("cronograma_id", cronogramaId)
      .eq("concluido", true)
      .not("data_conclusao", "is", null)
      .gte("data_conclusao", opts.start.toISOString());

    if (opts.end) q = q.lt("data_conclusao", opts.end.toISOString());

    type Row = {
      data_conclusao: string | null;
      aulas:
        | {
            tempo_estimado_minutos: number | null;
            curso_id: string | null;
            modulo_id: string | null;
            modulos:
              | {
                  frente_id: string | null;
                  frentes:
                    | { disciplina_id: string | null }
                    | { disciplina_id: string | null }[]
                    | null;
                }
              | {
                  frente_id: string | null;
                  frentes:
                    | { disciplina_id: string | null }
                    | { disciplina_id: string | null }[]
                    | null;
                }[]
              | null;
          }
        | {
            tempo_estimado_minutos: number | null;
            curso_id: string | null;
            modulo_id: string | null;
            modulos:
              | {
                  frente_id: string | null;
                  frentes:
                    | { disciplina_id: string | null }
                    | { disciplina_id: string | null }[]
                    | null;
                }
              | {
                  frente_id: string | null;
                  frentes:
                    | { disciplina_id: string | null }
                    | { disciplina_id: string | null }[]
                    | null;
                }[]
              | null;
          }[]
        | null;
    };

    const { data, error } = await q;
    if (error) {
      throw new Error(`Erro ao buscar aulas assistidas: ${error.message}`);
    }

    const safeRows = ((data ?? []) as Row[]) ?? [];
    const out: StudyTimeRow[] = [];

    for (const item of safeRows) {
      const aula = Array.isArray(item.aulas) ? item.aulas[0] : item.aulas;
      if (!aula) continue;
      const mod = Array.isArray(aula.modulos) ? aula.modulos[0] : aula.modulos;
      const frenteId = mod?.frente_id ?? null;
      const fr = mod?.frentes;
      const disciplinaId = Array.isArray(fr)
        ? (fr[0]?.disciplina_id ?? null)
        : (fr?.disciplina_id ?? null);
      const minutos = aula.tempo_estimado_minutos ?? TEMPO_PADRAO_MINUTOS;
      const seconds = Math.max(0, Math.round(minutos * 60));

      out.push({
        seconds,
        curso_id: aula.curso_id ?? null,
        disciplina_id: disciplinaId,
        frente_id: frenteId,
        modulo_id: aula.modulo_id ?? null,
      });
    }

    return out;
  }

  private async getStudyTimeSecondsForPeriod(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    opts: { start: Date; end: Date; empresaId?: string },
  ): Promise<{ total: number; classSeconds: number; exerciseSeconds: number }> {
    const [listRows, watchedRows] = await Promise.all([
      this.getListSessionsRows(alunoId, client, {
        start: opts.start,
        end: opts.end,
        empresaId: opts.empresaId,
      }),
      this.getWatchedClassesRows(alunoId, client, {
        start: opts.start,
        end: opts.end,
        empresaId: opts.empresaId,
      }),
    ]);
    const exerciseSeconds = listRows.reduce(
      (acc, r) => acc + (r.seconds || 0),
      0,
    );
    const classSeconds = watchedRows.reduce(
      (acc, r) => acc + (r.seconds || 0),
      0,
    );
    return { total: exerciseSeconds + classSeconds, classSeconds, exerciseSeconds };
  }

  private async getListSessionsHeatmapRows(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    opts: { start: Date; empresaId?: string },
  ): Promise<Array<{ inicio: string; seconds: number }>> {
    const buildBaseQuery = (selectCols: string) => {
      let q = client
        .from("sessoes_estudo")
        .select(selectCols)
        .eq("usuario_id", alunoId)
        .eq("status", "concluido")
        .not("atividade_relacionada_id", "is", null)
        .gte("inicio", opts.start.toISOString());
      if (opts.empresaId) q = q.eq("empresa_id", opts.empresaId);
      return q.returns<SessaoRow[]>();
    };

    type SessaoRow = {
      inicio: string;
      tempo_total_liquido_segundos: number | null;
      modulo_id?: string | null;
      atividades?:
        | { modulo_id?: string | null }
        | { modulo_id?: string | null }[]
        | null;
    };

    const attempt = await buildBaseQuery(
      "inicio, tempo_total_liquido_segundos, modulo_id, atividades(modulo_id)",
    );
    if (!attempt.error) {
      return (attempt.data ?? []).map((r) => ({
        inicio: r.inicio,
        seconds: r.tempo_total_liquido_segundos ?? 0,
      }));
    }

    const msg = attempt.error.message || "";
    const isMissingModuloId =
      msg.includes("sessoes_estudo.modulo_id") &&
      msg.toLowerCase().includes("does not exist");
    if (!isMissingModuloId) {
      console.error(
        "[dashboard-analytics] Erro ao buscar sessões (heatmap):",
        attempt.error,
      );
      return [];
    }

    const fallback = await buildBaseQuery(
      "inicio, tempo_total_liquido_segundos, atividades(modulo_id)",
    );
    if (fallback.error) {
      console.error(
        "[dashboard-analytics] Erro ao buscar sessões (heatmap fallback):",
        fallback.error,
      );
      return [];
    }

    return (fallback.data ?? []).map((r) => ({
      inicio: r.inicio,
      seconds: r.tempo_total_liquido_segundos ?? 0,
    }));
  }

  private async getWatchedClassesHeatmapRows(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
    opts: { start: Date; empresaId?: string },
  ): Promise<Array<{ dataConclusao: string; seconds: number }>> {
    const cronogramaId = await this.getLatestCronogramaId(
      alunoId,
      client,
      opts.empresaId,
    );
    if (!cronogramaId) return [];

    const TEMPO_PADRAO_MINUTOS = 10;

    const { data, error } = await client
      .from("cronograma_itens")
      .select("data_conclusao, aulas(tempo_estimado_minutos)")
      .eq("cronograma_id", cronogramaId)
      .eq("concluido", true)
      .not("data_conclusao", "is", null)
      .gte("data_conclusao", opts.start.toISOString());

    if (error) {
      console.error(
        "[dashboard-analytics] Erro ao buscar aulas assistidas (heatmap):",
        error,
      );
      return [];
    }

    type Row = {
      data_conclusao: string | null;
      aulas:
        | { tempo_estimado_minutos: number | null }
        | { tempo_estimado_minutos: number | null }[]
        | null;
    };
    const safe = (((data ?? []) as Row[]) ?? []).filter(
      (r) => !!r.data_conclusao,
    );

    return safe.map((r) => {
      const aula = Array.isArray(r.aulas) ? r.aulas[0] : r.aulas;
      const minutos = aula?.tempo_estimado_minutos ?? TEMPO_PADRAO_MINUTOS;
      return {
        dataConclusao: r.data_conclusao as string,
        seconds: Math.max(0, Math.round(minutos * 60)),
      };
    });
  }

  // ============================================================
  // Novos metodos para o novo layout do dashboard
  // ============================================================

  /**
   * Retorna cursos do aluno com progresso calculado (aulas concluidas / total).
   */
  async getCoursesWithProgress(
    alunoId: string,
    empresaId?: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      category: string;
      imageUrl: string | null;
      score: number;
      progress: number;
      started: boolean;
    }>
  > {
    const client = getDatabaseClient();
    const { cursoIds } = await this.resolveCursoScope(alunoId, client, empresaId);
    if (cursoIds.length === 0) return [];

    const { data: cursos, error: cursosError } = await client
      .from("cursos")
      .select("id, nome, imagem_capa_url, disciplinas:disciplina_id(nome), aulas(count)")
      .in("id", cursoIds);

    if (cursosError) throw new Error(`Erro ao buscar cursos: ${cursosError.message}`);
    if (!cursos || cursos.length === 0) return [];

    // Buscar aulas concluídas em lote
    const { data: aulasConcluidasData, error: aulasConcluidasError } =
      await client
        .from("aulas_concluidas")
        .select("curso_id")
        .eq("usuario_id", alunoId)
        .in("curso_id", cursoIds);

    if (aulasConcluidasError) {
      console.error(
        "[dashboard-analytics] Erro ao buscar aulas concluídas:",
        aulasConcluidasError,
      );
    }

    const completedMap = new Map<string, number>();
    (aulasConcluidasData ?? []).forEach((row) => {
      if (row.curso_id) {
        completedMap.set(
          row.curso_id,
          (completedMap.get(row.curso_id) || 0) + 1,
        );
      }
    });

    // Calcular score global (baseado em aproveitamento de atividades do aluno)
    // Nota: A implementação original calculava o mesmo score para todos os cursos
    const { data: atividades } = await client
      .from("progresso_atividades")
      .select("questoes_totais, questoes_acertos")
      .eq("usuario_id", alunoId)
      .eq("status", "Concluido");

    let globalScore = 0;
    if (atividades && atividades.length > 0) {
      const totalQ = atividades.reduce(
        (sum, a) => sum + (a.questoes_totais || 0),
        0,
      );
      const acertos = atividades.reduce(
        (sum, a) => sum + (a.questoes_acertos || 0),
        0,
      );
      globalScore =
        totalQ > 0 ? Math.round((acertos / totalQ) * 50) / 10 : 0; // Scale to 0-5
    }

    const results = (
      cursos as unknown as Array<{
        id: string;
        nome: string;
        imagem_capa_url: string | null;
        disciplinas: { nome: string } | null;
        aulas: { count: number }[] | null;
      }>
    ).map((curso) => {
      const totalAulas = curso.aulas?.[0]?.count ?? 0;
      const concluidas = completedMap.get(curso.id) ?? 0;
      const progress = totalAulas > 0 ? Math.round((concluidas / totalAulas) * 100) : 0;

      return {
        id: curso.id,
        name: curso.nome,
        category:
          (curso.disciplinas as { nome: string } | null)?.nome ?? "Geral",
        imageUrl: curso.imagem_capa_url,
        score: Math.min(globalScore, 5),
        progress,
        started: concluidas > 0,
      };
    });

    return results.sort((a, b) => b.progress - a.progress);
  }

  /**
   * Retorna progresso agregado por mes (ultimos 6 meses).
   */
  async getProgressByMonth(
    alunoId: string,
    empresaId?: string,
  ): Promise<
    Array<{
      month: string;
      value: number;
    }>
  > {
    const client = getDatabaseClient();
    const { cursoIds } = await this.resolveCursoScope(alunoId, client, empresaId);
    if (cursoIds.length === 0) return [];

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data, error } = await client
      .from("aulas_concluidas")
      .select("created_at")
      .eq("usuario_id", alunoId)
      .in("curso_id", cursoIds)
      .gte("created_at", sixMonthsAgo.toISOString())
      .order("created_at", { ascending: true });

    if (error) throw new Error(`Erro ao buscar progresso mensal: ${error.message}`);

    const monthNames = [
      "Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];

    const monthMap = new Map<string, number>();

    // Inicializar ultimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, 0);
    }

    // Agregar dados
    for (const row of data ?? []) {
      if (!row.created_at) continue;
      const d = new Date(row.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthMap.has(key)) {
        monthMap.set(key, (monthMap.get(key) ?? 0) + 1);
      }
    }

    return Array.from(monthMap.entries()).map(([key, value]) => {
      const [, monthStr] = key.split("-");
      return {
        month: monthNames[parseInt(monthStr, 10) - 1],
        value,
      };
    });
  }

  /**
   * Retorna cronogramas (trilhas de aprendizado) com progresso.
   */
  async getLearningPaths(
    alunoId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      progress: number;
      completedModules: number;
      totalModules: number;
    }>
  > {
    const client = getDatabaseClient();

    const { data: cronogramas, error } = await client
      .from("cronogramas")
      .select("id, nome")
      .eq("usuario_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(2);

    if (error) throw new Error(`Erro ao buscar cronogramas: ${error.message}`);
    if (!cronogramas || cronogramas.length === 0) return [];

    const results = await Promise.all(
      cronogramas.map(async (cr) => {
        const { count: totalItens } = await client
          .from("cronograma_itens")
          .select("id", { count: "exact", head: true })
          .eq("cronograma_id", cr.id);

        const { count: concluidos } = await client
          .from("cronograma_itens")
          .select("id", { count: "exact", head: true })
          .eq("cronograma_id", cr.id)
          .eq("concluido", true);

        const total = totalItens ?? 0;
        const done = concluidos ?? 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;

        return {
          id: cr.id,
          name: cr.nome ?? "Cronograma",
          progress,
          completedModules: done,
          totalModules: total,
        };
      }),
    );

    return results;
  }

  /**
   * Retorna ranking de alunos (por horas de estudo) para o leaderboard.
   */
  async getLeaderboard(
    empresaId: string,
    limit = 4,
  ): Promise<
    Array<{
      id: string;
      name: string;
      points: number;
      avatarUrl: string | null;
    }>
  > {
    const client = getDatabaseClient();

    // Buscar alunos da empresa com tempo de estudo
    const { data: alunos, error } = await client
      .from("usuarios_empresas")
      .select("usuario_id, usuarios:usuario_id(id, nome_completo, foto_url)")
      .eq("empresa_id", empresaId)
      .eq("role", "aluno")
      .eq("ativo", true);

    if (error) throw new Error(`Erro ao buscar alunos: ${error.message}`);
    if (!alunos || alunos.length === 0) return [];

    const alunoIds = alunos
      .map((a) => {
        const u = a.usuarios as { id: string; nome_completo: string | null; foto_url: string | null } | null;
        return u?.id;
      })
      .filter(Boolean) as string[];

    if (alunoIds.length === 0) return [];

    // Buscar tempo de estudo de cada aluno
    const { data: sessoes, error: sessoesError } = await client
      .from("sessoes_estudo")
      .select("usuario_id, tempo_total_liquido_segundos")
      .in("usuario_id", alunoIds)
      .eq("status", "concluido");

    if (sessoesError) throw new Error(`Erro ao buscar sessoes: ${sessoesError.message}`);

    // Agregar por aluno
    const pointsMap = new Map<string, number>();
    for (const s of sessoes ?? []) {
      if (!s.usuario_id) continue;
      const current = pointsMap.get(s.usuario_id) ?? 0;
      pointsMap.set(s.usuario_id, current + (s.tempo_total_liquido_segundos ?? 0));
    }

    // Converter para horas e montar resultado
    const results = alunos
      .map((a) => {
        const u = a.usuarios as { id: string; nome_completo: string | null; foto_url: string | null } | null;
        if (!u) return null;
        const seconds = pointsMap.get(u.id) ?? 0;
        const hours = Math.round(seconds / 3600);
        return {
          id: u.id,
          name: u.nome_completo ?? "Aluno",
          points: hours,
          avatarUrl: u.foto_url,
        };
      })
      .filter(Boolean) as Array<{
        id: string;
        name: string;
        points: number;
        avatarUrl: string | null;
      }>;

    return results
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
  }
}
