import { getDatabaseClient } from "@/app/shared/core/database/database";
import { fetchAllRows } from "@/app/shared/core/database/fetch-all-rows";
import {
  fetchAllRowsChunked,
  fetchCountChunked,
} from "@/app/shared/core/database/chunked-query";
import type {
  InstitutionDashboardData,
  InstitutionSummary,
  InstitutionEngagement,
  StudentRankingItem,
  ProfessorRankingItem,
  DisciplinaPerformance,
  DailyActiveUsersPoint,
  DailyLoginsPoint,
  LoginSummary,
  ServiceAdoptionItem,
  ServiceKey,
} from "@/app/[tenant]/(modules)/dashboard/types";
import type { HeatmapDay } from "@/app/[tenant]/(modules)/dashboard/types/student";

type DashboardPeriod = "semanal" | "mensal" | "anual";

const SERVICE_LABELS: Record<ServiceKey, string> = {
  sessoes_estudo: "Sessões de Estudo",
  cronogramas: "Cronogramas",
  flashcards: "Flashcards",
  agendamentos: "Agendamentos",
  ai_chat: "Chat com IA",
  progresso_atividades: "Atividades",
};

export class InstitutionAnalyticsService {
  /**
   * Busca IDs de usuários de uma empresa filtrados por papel_base.
   * Usa a tabela usuarios_empresas que possui enum_papel_base (aluno | professor | usuario).
   */
  private async getUserIdsByRole(
    empresaId: string,
    papelBase: "aluno" | "professor" | "usuario",
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<string[]> {
    const data = await fetchAllRows(
      client
        .from("usuarios_empresas")
        .select("usuario_id")
        .eq("empresa_id", empresaId)
        .eq("papel_base", papelBase)
        .eq("ativo", true)
        .is("deleted_at", null),
    );

    return data.map((r: { usuario_id: string }) => r.usuario_id);
  }

  /**
   * Conta usuários de uma empresa filtrados por papel_base.
   */
  private async countUsersByRole(
    empresaId: string,
    papelBase: "aluno" | "professor" | "usuario",
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<number> {
    const { count } = await client
      .from("usuarios_empresas")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId)
      .eq("papel_base", papelBase)
      .eq("ativo", true)
      .is("deleted_at", null);

    return count ?? 0;
  }

  /**
   * Busca dados agregados do dashboard da instituição
   */
  async getInstitutionDashboard(
    empresaId: string,
    period: DashboardPeriod = "mensal",
    userId?: string,
  ): Promise<InstitutionDashboardData> {
    const client = getDatabaseClient();

    // Fetch user IDs by role ONCE
    const [alunoIds, professorIds] = await Promise.all([
      this.getUserIdsByRole(empresaId, "aluno", client),
      this.getUserIdsByRole(empresaId, "professor", client),
    ]);

    // Buscar nome e logo da empresa
    const { data: empresa } = await client
      .from("empresas")
      .select("nome, logo_url")
      .eq("id", empresaId)
      .single();

    const empresaNome = empresa?.nome ?? "Instituição";
    const empresaLogoUrl = empresa?.logo_url ?? null;

    // Buscar nome do usuário (primeiro nome)
    let userName = "Usuário";
    if (userId) {
      const { data: usuario } = await client
        .from("usuarios")
        .select("nome_completo")
        .eq("id", userId)
        .maybeSingle();

      if (usuario?.nome_completo) {
        // Extrair primeiro nome
        userName = usuario.nome_completo.split(" ")[0];
      }
    }

    // Buscar métricas em paralelo com resiliência — falha individual não derruba o dashboard
    const results = await Promise.allSettled([
      this.getSummary(empresaId, client, period, alunoIds, professorIds),
      this.getEngagement(empresaId, client, period, alunoIds),
      this.getHeatmapData(empresaId, client, period, alunoIds),
      this.getStudentRanking(empresaId, client, period, 10, alunoIds),
      this.getProfessorRanking(empresaId, client, period, 10, professorIds),
      this.getPerformanceByDisciplina(empresaId, client, period, alunoIds),
      this.getDailyActiveUsers(client, period, alunoIds),
      this.getAlunosComCronograma(empresaId, client, alunoIds),
      this.getServiceAdoption(empresaId, client, period, alunoIds),
      this.getLoginSummary(empresaId, client, period, alunoIds.length),
      this.getDailyLogins(empresaId, client, period),
    ]);

    const defaultSummary: InstitutionSummary = {
      totalAlunos: alunoIds.length,
      totalProfessores: professorIds.length,
      totalCursos: 0,
      alunosAtivos: 0,
    };
    const defaultEngagement: InstitutionEngagement = {
      totalHorasEstudo: "0h 0m",
      horasEstudoDelta: "+0h",
      atividadesConcluidas: 0,
      taxaConclusao: 0,
      atividadesConcluidasBreakdown: {
        aulas: 0,
        atividades: 0,
        flashcards: 0,
      },
    };
    const defaultLoginSummary: LoginSummary = {
      alunosLogaram: 0,
      totalAlunos: alunoIds.length,
      taxaLogin: 0,
      logaramENaoEstudaram: 0,
      hasAnyData: false,
      isPartialData: false,
      coverageStartDate: null,
    };

    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        console.error(`[Institution Dashboard] Metric ${i} failed:`, result.reason);
      }
    }

    const summary = results[0].status === "fulfilled" ? results[0].value : defaultSummary;
    const engagement = results[1].status === "fulfilled" ? results[1].value : defaultEngagement;
    const heatmap = results[2].status === "fulfilled" ? results[2].value : [];
    const rankingAlunos = results[3].status === "fulfilled" ? results[3].value : [];
    const rankingProfessores = results[4].status === "fulfilled" ? results[4].value : [];
    const performanceByDisciplina = results[5].status === "fulfilled" ? results[5].value : [];
    const dailyActiveUsers = results[6].status === "fulfilled" ? results[6].value : [];
    const alunosComCronograma = results[7].status === "fulfilled" ? results[7].value : 0;
    const serviceAdoption = results[8].status === "fulfilled" ? results[8].value : [];
    const loginSummary = results[9].status === "fulfilled" ? results[9].value : defaultLoginSummary;
    const dailyLogins = results[10].status === "fulfilled" ? results[10].value : [];

    const safeLogaramENaoEstudaram = Math.max(
      0,
      loginSummary.alunosLogaram - summary.alunosAtivos,
    );
    const normalizedLoginSummary: LoginSummary = {
      ...loginSummary,
      totalAlunos: summary.totalAlunos,
      logaramENaoEstudaram: safeLogaramENaoEstudaram,
    };

    if (normalizedLoginSummary.alunosLogaram > summary.totalAlunos) {
      console.warn("[Institution Dashboard] Inconsistência de login detectada", {
        empresaId,
        alunosLogaram: normalizedLoginSummary.alunosLogaram,
        totalAlunos: summary.totalAlunos,
      });
    }

    return {
      empresaNome,
      empresaLogoUrl,
      userName,
      summary,
      engagement,
      heatmap,
      rankingAlunos,
      rankingProfessores,
      performanceByDisciplina,
      dailyActiveUsers,
      dailyLogins,
      alunosComCronograma,
      loginSummary: normalizedLoginSummary,
      serviceAdoption,
    };
  }

  /**
   * Busca resumo geral da instituição
   */
  private async getSummary(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    alunoIds: string[],
    professorIds: string[],
  ): Promise<InstitutionSummary> {
    // Buscar total de cursos
    const { count: totalCursos } = await client
      .from("cursos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresaId);

    // Alunos ativos no período selecionado
    const { startDate } = this.getPeriodDates(period);

    let alunosAtivos = 0;
    if (alunoIds.length > 0) {
      const alunosSessoes = await fetchAllRowsChunked(
        (ids) =>
          client
            .from("sessoes_estudo")
            .select("usuario_id")
            .in("usuario_id", ids)
            .gte("created_at", startDate.toISOString()),
        alunoIds,
      );

      const alunosComAtividade = new Set(
        alunosSessoes
          .filter((s: { usuario_id: string | null }): s is { usuario_id: string } => s.usuario_id !== null)
          .map((s: { usuario_id: string }) => s.usuario_id),
      );
      alunosAtivos = alunosComAtividade.size;
    }

    return {
      totalAlunos: alunoIds.length,
      totalProfessores: professorIds.length,
      totalCursos: totalCursos ?? 0,
      alunosAtivos,
    };
  }

  /**
   * Busca métricas de engajamento
   */
  private async getEngagement(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    alunoIds: string[],
  ): Promise<InstitutionEngagement> {
    const { startDate, previousStartDate, previousEndDate } =
      this.getPeriodDates(period);

    if (alunoIds.length === 0) {
      return {
        totalHorasEstudo: "0h 0m",
        horasEstudoDelta: "+0h",
        atividadesConcluidas: 0,
        taxaConclusao: 0,
      };
    }

    // Tempo de estudo atual
    const sessoesAtuais = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("sessoes_estudo")
          .select("tempo_total_liquido_segundos")
          .in("usuario_id", ids)
          .gte("created_at", startDate.toISOString()),
      alunoIds,
    );

    const segundosAtuais = sessoesAtuais.reduce(
      (acc: number, s: { tempo_total_liquido_segundos: number | null }) =>
        acc + (s.tempo_total_liquido_segundos ?? 0),
      0,
    );

    // Tempo de estudo período anterior
    const sessoesAnteriores = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("sessoes_estudo")
          .select("tempo_total_liquido_segundos")
          .in("usuario_id", ids)
          .gte("created_at", previousStartDate.toISOString())
          .lt("created_at", previousEndDate.toISOString()),
      alunoIds,
    );

    const segundosAnteriores = sessoesAnteriores.reduce(
      (acc: number, s: { tempo_total_liquido_segundos: number | null }) =>
        acc + (s.tempo_total_liquido_segundos ?? 0),
      0,
    );

    const horasAtuais = Math.floor(segundosAtuais / 3600);
    const minutosAtuais = Math.floor((segundosAtuais % 3600) / 60);
    const deltaHoras = Math.round((segundosAtuais - segundosAnteriores) / 3600);

    // Atividades concluídas no período: somar três fontes
    // 1. Itens de cronograma marcados como concluídos
    // 2. Progresso de atividades com status "Concluido"
    // 3. Flashcards revisados
    const cronogramaIds = await this.getCronogramaIdsByAlunos(alunoIds, client);
    const nowIso = new Date().toISOString();

    const [aulasConcluidas, atividadesConcluidasCount, flashcardsRevisados] =
      await Promise.all([
        cronogramaIds.length === 0
          ? Promise.resolve(0)
          : fetchCountChunked(
              (ids) =>
                client
                  .from("cronograma_itens")
                  .select("id", { count: "exact", head: true })
                  .in("cronograma_id", ids)
                  .eq("concluido", true)
                  .gte("data_conclusao", startDate.toISOString()),
              cronogramaIds,
            ),
        fetchCountChunked(
          (ids) =>
            client
              .from("progresso_atividades")
              .select("id", { count: "exact", head: true })
              .in("usuario_id", ids)
              .eq("status", "Concluido")
              .gte("data_conclusao", startDate.toISOString()),
          alunoIds,
        ),
        fetchCountChunked(
          (ids) =>
            client
              .from("progresso_flashcards")
              .select("id", { count: "exact", head: true })
              .in("usuario_id", ids)
              .gt("numero_revisoes", 0)
              .gte("updated_at", startDate.toISOString()),
          alunoIds,
        ),
      ]);

    const atividadesConcluidas =
      aulasConcluidas + atividadesConcluidasCount + flashcardsRevisados;

    // Taxa de conclusão: itens de cronograma cuja data_prevista cai no período
    // (denominator = "o que era pra ser feito até agora dentro do período")
    let taxaConclusao = 0;
    if (cronogramaIds.length > 0) {
      const itensPrevistosNoPeriodo = await fetchCountChunked(
        (ids) =>
          client
            .from("cronograma_itens")
            .select("id", { count: "exact", head: true })
            .in("cronograma_id", ids)
            .gte("data_prevista", startDate.toISOString())
            .lte("data_prevista", nowIso),
        cronogramaIds,
      );

      taxaConclusao =
        itensPrevistosNoPeriodo > 0
          ? Math.round((aulasConcluidas / itensPrevistosNoPeriodo) * 100)
          : 0;
    }

    return {
      totalHorasEstudo: `${horasAtuais}h ${minutosAtuais}m`,
      horasEstudoDelta: deltaHoras >= 0 ? `+${deltaHoras}h` : `${deltaHoras}h`,
      atividadesConcluidas,
      taxaConclusao,
      atividadesConcluidasBreakdown: {
        aulas: aulasConcluidas,
        atividades: atividadesConcluidasCount,
        flashcards: flashcardsRevisados,
      },
    };
  }

  /**
   * Helper para obter IDs dos cronogramas dos alunos
   */
  private async getCronogramaIdsByAlunos(
    alunoIds: string[],
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<string[]> {
    if (alunoIds.length === 0) return [];

    const cronogramas = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("cronogramas")
          .select("id")
          .in("usuario_id", ids),
      alunoIds,
    );

    return cronogramas.map((c: { id: string }) => c.id);
  }

  /**
   * Busca dados do heatmap institucional
   */
  private async getHeatmapData(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    alunoIds: string[],
  ): Promise<HeatmapDay[]> {
    const { startDate } = this.getPeriodDates(period);

    if (alunoIds.length === 0) {
      return this.generateEmptyHeatmap(startDate);
    }

    // Buscar sessões de estudo (incluindo usuario_id para calcular alunos ativos por dia)
    const sessoes = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("sessoes_estudo")
          .select("created_at, usuario_id, tempo_total_liquido_segundos")
          .in("usuario_id", ids)
          .gte("created_at", startDate.toISOString()),
      alunoIds,
    );

    // Agrupar por dia: total de segundos + set de usuários únicos
    const dayMap = new Map<string, number>();
    const activeStudentsByDay = new Map<string, Set<string>>();
    for (const sessao of sessoes) {
      if (!sessao.created_at) continue;
      const date = new Date(sessao.created_at).toISOString().split("T")[0];
      dayMap.set(
        date,
        (dayMap.get(date) ?? 0) + (sessao.tempo_total_liquido_segundos ?? 0),
      );
      if (sessao.usuario_id) {
        if (!activeStudentsByDay.has(date)) {
          activeStudentsByDay.set(date, new Set());
        }
        activeStudentsByDay.get(date)!.add(sessao.usuario_id);
      }
    }

    // Calcular tempo médio por aluno-ativo em cada dia (normalização institucional)
    const perStudentSecondsByDay = new Map<string, number>();
    for (const [date, totalSeconds] of dayMap.entries()) {
      const activeCount = activeStudentsByDay.get(date)?.size ?? 0;
      if (activeCount > 0) {
        perStudentSecondsByDay.set(date, totalSeconds / activeCount);
      }
    }

    // Calcular percentis dos valores não-zero para limiares dinâmicos
    const nonZeroValues = Array.from(perStudentSecondsByDay.values()).sort(
      (a, b) => a - b,
    );

    let p25 = 1800; // < 30 min
    let p50 = 3600; // < 1h
    let p75 = 7200; // < 2h
    if (nonZeroValues.length >= 5) {
      const pickPercentile = (p: number) => {
        const idx = Math.floor(nonZeroValues.length * p);
        return nonZeroValues[Math.min(idx, nonZeroValues.length - 1)];
      };
      p25 = pickPercentile(0.25);
      p50 = pickPercentile(0.5);
      p75 = pickPercentile(0.75);
    }

    // Gerar array de dias
    const today = new Date();
    const result: HeatmapDay[] = [];

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const perStudent = perStudentSecondsByDay.get(dateStr) ?? 0;

      let intensity = 0;
      if (perStudent > 0) {
        if (perStudent < p25) intensity = 1;
        else if (perStudent < p50) intensity = 2;
        else if (perStudent < p75) intensity = 3;
        else intensity = 4;
      }

      result.push({ date: dateStr, intensity });
    }

    return result;
  }

  /**
   * Gera heatmap vazio para o período
   */
  private generateEmptyHeatmap(startDate: Date): HeatmapDay[] {
    const today = new Date();
    const result: HeatmapDay[] = [];

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      result.push({ date: d.toISOString().split("T")[0], intensity: 0 });
    }

    return result;
  }

  /**
   * Busca ranking dos melhores alunos
   */
  async getStudentRanking(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    limit = 10,
    prefetchedAlunoIds?: string[],
  ): Promise<StudentRankingItem[]> {
    // Buscar apenas alunos da empresa (papel_base = 'aluno') if not provided
    let alunoIds = prefetchedAlunoIds;
    if (!alunoIds) {
      alunoIds = await this.getUserIdsByRole(empresaId, "aluno", client);
    }

    if (alunoIds.length === 0) return [];

    // 1. Calculate study time for ALL filtered students to determine ranking correctly
    const { startDate } = this.getPeriodDates(period);

    const sessoes = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("sessoes_estudo")
          .select("usuario_id, tempo_total_liquido_segundos")
          .in("usuario_id", ids)
          .gte("created_at", startDate.toISOString()),
      alunoIds,
    );

    // Agrupar tempo por aluno
    const tempoMap = new Map<string, number>();
    for (const sessao of sessoes) {
      if (!sessao.usuario_id) continue;
      const current = tempoMap.get(sessao.usuario_id) ?? 0;
      tempoMap.set(
        sessao.usuario_id,
        current + (sessao.tempo_total_liquido_segundos ?? 0),
      );
    }

    // 2. Identify top students based on time
    const rankedStudents = Array.from(tempoMap.entries())
        .map(([id, time]) => ({ id, time }))
        .sort((a, b) => b.time - a.time)
        .slice(0, limit);

    if (rankedStudents.length === 0) return [];

    const topStudentIds = rankedStudents.map(s => s.id);

    // 3. Fetch details ONLY for top students (bounded to `limit`, safe without chunking)
    const { data: usuarios } = await client
      .from("usuarios")
      .select("id, nome_completo")
      .in("id", topStudentIds);

    const usuarioMap = new Map(usuarios?.map((u: { id: string; nome_completo: string | null }) => [u.id, u]) ?? []);

    // 4. Calculate detailed metrics only for the winners (Bulk Fetch)
    // topStudentIds is bounded to `limit` (default 10), safe without chunking

    // Fetch sessions for streak calculation (approx last 365 days for all top students)
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 365);

    const allSessoes = await fetchAllRows(
      client
        .from("sessoes_estudo")
        .select("usuario_id, created_at")
        .in("usuario_id", topStudentIds)
        .gte("created_at", oneYearAgo.toISOString()),
    );

    // Group sessions by student
    const sessionsMap = new Map<string, string[]>();
    for (const s of allSessoes) {
        if (!s.usuario_id || !s.created_at) continue;
        if (!sessionsMap.has(s.usuario_id)) {
            sessionsMap.set(s.usuario_id, []);
        }
        sessionsMap.get(s.usuario_id)!.push(s.created_at);
    }

    // Fetch progress for aproveitamento — filtrado pelo período do ranking
    // para que o badge fique coerente com a janela de tempo de estudo.
    const allProgressos = await fetchAllRows(
      client
        .from("progresso_atividades")
        .select("usuario_id, questoes_totais, questoes_acertos")
        .in("usuario_id", topStudentIds)
        .gte("updated_at", startDate.toISOString()),
    );

    // Group progress by student
    const progressMap = new Map<string, { total: number; acertos: number }>();
    for (const p of allProgressos) {
        if (!p.usuario_id) continue;
        if (!progressMap.has(p.usuario_id)) {
            progressMap.set(p.usuario_id, { total: 0, acertos: 0 });
        }
        const stats = progressMap.get(p.usuario_id)!;
        stats.total += p.questoes_totais ?? 0;
        stats.acertos += p.questoes_acertos ?? 0;
    }

    const ranking: StudentRankingItem[] = rankedStudents.map((student) => {
        const usuario = usuarioMap.get(student.id) as { id: string; nome_completo: string | null } | undefined;
        const name = usuario?.nome_completo ?? "Aluno";

        // Calculate Streak
        const sessoesDates = sessionsMap.get(student.id) ?? [];
        const streak = this.calculateStreakFromDates(sessoesDates);

        // Calculate Aproveitamento
        const pStats = progressMap.get(student.id) || { total: 0, acertos: 0 };
        const temDadosAproveitamento = pStats.total > 0;
        const aproveitamento = temDadosAproveitamento
            ? Math.round((pStats.acertos / pStats.total) * 100)
            : 0;

        const segundos = student.time;
        const horas = Math.floor(segundos / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);

        return {
            id: student.id,
            name,
            avatarUrl: null,
            horasEstudo: `${horas}h ${minutos}m`,
            horasEstudoMinutos: Math.floor(segundos / 60),
            aproveitamento,
            temDadosAproveitamento,
            streakDays: streak
        };
    });

    ranking.sort((a, b) => b.horasEstudoMinutos - a.horasEstudoMinutos);

    return ranking;
  }

  /**
   * Helper para calcular streak a partir de uma lista de datas
   */
  private calculateStreakFromDates(datesIso: string[]): number {
    if (datesIso.length === 0) return 0;

    // Extrair datas únicas
    const datas = [
      ...new Set(
        datesIso.map((d) => new Date(d).toISOString().split("T")[0]),
      ),
    ]
      .sort()
      .reverse();

    // Contar dias consecutivos a partir de hoje
    let streak = 0;
    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < datas.length; i++) {
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() - i);
      const expectedDateStr = expectedDate.toISOString().split("T")[0];

      if (datas.includes(expectedDateStr)) {
        streak++;
      } else if (i === 0 && datas[0] !== today) {
        // Hoje não estudou, verificar se ontem estudou
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        if (datas[0] === yesterdayStr) {
          // Continuar contando a partir de ontem
          continue;
        }
        break;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Busca ranking dos professores
   */
  async getProfessorRanking(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    limit = 10,
    prefetchedProfIds?: string[],
  ): Promise<ProfessorRankingItem[]> {
    // Buscar apenas professores da empresa (papel_base = 'professor') if not provided
    let profIds = prefetchedProfIds;
    if (!profIds) {
      profIds = await this.getUserIdsByRole(empresaId, "professor", client);
    }

    if (profIds.length === 0) return [];

    // Buscar dados dos professores (limitado aos IDs de professores reais)
    // profIds bounded by .limit(100), safe without chunking
    const { data: professores } = await client
      .from("usuarios")
      .select("id, nome_completo, foto_url")
      .in("id", profIds)
      .limit(100);

    if (!professores || professores.length === 0) return [];

    const { startDate } = this.getPeriodDates(period);

    // Bulk fetch agendamentos for these professors
    // professores bounded by .limit(100), safe without chunking
    const agendamentos = await fetchAllRows(
      client
        .from("agendamentos")
        .select("professor_id, aluno_id, status")
        .in("professor_id", professores.map((p: { id: string }) => p.id))
        .gte("created_at", startDate.toISOString()),
    );

    // Aggregate in memory
    const statsMap = new Map<string, { realizados: number; alunosUnicos: Set<string> }>();

    for (const appt of agendamentos) {
        if (!statsMap.has(appt.professor_id)) {
            statsMap.set(appt.professor_id, { realizados: 0, alunosUnicos: new Set() });
        }
        const stats = statsMap.get(appt.professor_id)!;

        // Count unique students (any status? Original code filtered distinct aluno_id for ALL agendamentos >= 30 days)
        stats.alunosUnicos.add(appt.aluno_id);

        // Count completed
        if (appt.status === 'concluido') {
            stats.realizados++;
        }
    }

    const ranking: ProfessorRankingItem[] = professores.map((professor: { id: string; nome_completo: string | null; foto_url: string | null }) => {
        const stats = statsMap.get(professor.id) || { realizados: 0, alunosUnicos: new Set() };
        return {
            id: professor.id,
            name: professor.nome_completo ?? "Professor",
            avatarUrl: professor.foto_url ?? null,
            alunosAtendidos: stats.alunosUnicos.size,
            agendamentosRealizados: stats.realizados
        };
    });

    // Ordenar por alunos atendidos (maior primeiro)
    ranking.sort((a, b) => b.alunosAtendidos - a.alunosAtendidos);

    return ranking.slice(0, limit);
  }

  /**
   * Busca performance por disciplina
   */
  private async getPerformanceByDisciplina(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    prefetchedAlunoIds?: string[],
  ): Promise<DisciplinaPerformance[]> {
    // Buscar disciplinas da empresa
    const { data: disciplines } = await client
      .from("disciplinas")
      .select("id, nome")
      .eq("empresa_id", empresaId)
      .limit(20);

    if (!disciplines || disciplines.length === 0) return [];
    const disciplinaMap = new Map(disciplines.map((d: { id: string; nome: string }) => [d.id, d.nome]));

    // Buscar apenas alunos da empresa (papel_base = 'aluno') if not provided
    let alunoIds = prefetchedAlunoIds;
    if (!alunoIds) {
      alunoIds = await this.getUserIdsByRole(empresaId, "aluno", client);
    }

    if (alunoIds.length === 0) return [];

    const { startDate } = this.getPeriodDates(period);

    // Bulk fetch sessions (chunk on alunoIds, disciplina_id filter is bounded to max 20)
    const disciplinaIds = disciplines.map((d: { id: string }) => d.id);
    const sessoes = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("sessoes_estudo")
          .select("usuario_id, disciplina_id")
          .in("usuario_id", ids)
          .in("disciplina_id", disciplinaIds)
          .gte("created_at", startDate.toISOString()),
      alunoIds,
    );

    // Group sessions
    const sessionsByDisc = new Map<string, Set<string>>(); // discId -> Set<userId>
    for (const s of sessoes) {
        if (!s.disciplina_id || !s.usuario_id) continue;
        if (!sessionsByDisc.has(s.disciplina_id)) {
            sessionsByDisc.set(s.disciplina_id, new Set());
        }
        sessionsByDisc.get(s.disciplina_id)!.add(s.usuario_id);
    }

    // Bulk fetch progress with deep linking
    const progressos = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("progresso_atividades")
          .select(`
              usuario_id,
              questoes_totais,
              questoes_acertos,
              atividades!inner (
                  modulos!inner (
                      frentes!inner (
                          disciplina_id
                      )
                  )
              )
          `)
          .in("usuario_id", ids)
          .not("atividade_id", "is", null)
          .gte("updated_at", startDate.toISOString()),
      alunoIds,
    );

    // Group progress
    const progressByDisc = new Map<string, { total: number; acertos: number }>();

    // Type casting for deep response
    type DeepProgress = {
        usuario_id: string;
        questoes_totais: number | null;
        questoes_acertos: number | null;
        atividades: {
            modulos: {
                frentes: {
                    disciplina_id: string;
                } | null
            } | null
        } | null
    };

    for (const p of (progressos as unknown as DeepProgress[])) {
        const discId = p.atividades?.modulos?.frentes?.disciplina_id;
        if (!discId || !disciplinaMap.has(discId)) continue;

        if (!progressByDisc.has(discId)) {
            progressByDisc.set(discId, { total: 0, acertos: 0 });
        }
        const stats = progressByDisc.get(discId)!;
        stats.total += p.questoes_totais ?? 0;
        stats.acertos += p.questoes_acertos ?? 0;
    }

    // Assemble result
    const performance: DisciplinaPerformance[] = disciplines.map((d: { id: string; nome: string }) => {
        const activeStudents = sessionsByDisc.get(d.id)?.size ?? 0;

        if (activeStudents === 0) return null;

        const pStats = progressByDisc.get(d.id) || { total: 0, acertos: 0 };
        const temDadosAproveitamento = pStats.total > 0;
        const aproveitamento = temDadosAproveitamento
            ? Math.round((pStats.acertos / pStats.total) * 100)
            : 0;

        return {
            id: d.id,
            name: d.nome,
            aproveitamento,
            totalQuestoes: pStats.total,
            alunosAtivos: activeStudents,
            temDadosAproveitamento,
        };
    }).filter((p: DisciplinaPerformance | null): p is DisciplinaPerformance => p !== null);

    // Ordenar: disciplinas com dados de aproveitamento primeiro (maior %), depois sem dados
    performance.sort((a, b) => {
        if (a.temDadosAproveitamento !== b.temDadosAproveitamento) {
            return a.temDadosAproveitamento ? -1 : 1;
        }
        return b.aproveitamento - a.aproveitamento;
    });

    return performance;
  }

  /**
   * Conta usuários únicos com sessoes_estudo por dia (proxy de "alunos ativos por dia").
   * Não há tabela de auditoria de login no schema atual — sessoes_estudo é o melhor sinal disponível.
   */
  private async getDailyActiveUsers(
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    alunoIds: string[],
  ): Promise<DailyActiveUsersPoint[]> {
    const { startDate } = this.getPeriodDates(period);
    const today = new Date();

    if (alunoIds.length === 0) {
      return this.generateEmptyDailySeries(startDate, today);
    }

    const rows = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("sessoes_estudo")
          .select("created_at, usuario_id")
          .in("usuario_id", ids)
          .gte("created_at", startDate.toISOString()),
      alunoIds,
    );

    const usersByDay = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!r.created_at || !r.usuario_id) continue;
      const day = new Date(r.created_at).toISOString().split("T")[0];
      if (!usersByDay.has(day)) usersByDay.set(day, new Set());
      usersByDay.get(day)!.add(r.usuario_id);
    }

    const result: DailyActiveUsersPoint[] = [];
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const day = d.toISOString().split("T")[0];
      result.push({ date: day, activeUsers: usersByDay.get(day)?.size ?? 0 });
    }
    return result;
  }

  private generateEmptyDailySeries(
    startDate: Date,
    endDate: Date,
  ): DailyActiveUsersPoint[] {
    const result: DailyActiveUsersPoint[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      result.push({
        date: d.toISOString().split("T")[0],
        activeUsers: 0,
      });
    }
    return result;
  }

  /**
   * Resumo de login do tenant no período.
   * Usa tabela dedicada de eventos de login para separar "entrou no tenant" de "estudou".
   */
  private async getLoginSummary(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    totalAlunos: number,
  ): Promise<LoginSummary> {
    const { startDate } = this.getPeriodDates(period);
    const now = new Date();

    const { data: summaryData, error: summaryError } = await client.rpc(
      "get_tenant_login_summary" as never,
      {
        p_empresa_id: empresaId,
        p_start: startDate.toISOString(),
        p_end: now.toISOString(),
      } as never,
    );

    if (summaryError) {
      console.error(
        "[dashboard-institution] Erro ao carregar resumo de login:",
        summaryError,
      );
    }

    const summaryRow = (summaryData as Array<{
      alunos_logaram: number | null;
      total_eventos: number | null;
      primeiro_evento: string | null;
      ultimo_evento: string | null;
    }> | null)?.[0];

    const alunosLogaram = summaryRow?.alunos_logaram ?? 0;

    const { data: firstEventData, error: firstEventError } = await client.rpc(
      "get_tenant_login_first_event_at" as never,
      { p_empresa_id: empresaId } as never,
    );

    if (firstEventError) {
      console.error(
        "[dashboard-institution] Erro ao buscar primeira cobertura de login:",
        firstEventError,
      );
    }

    const coverageStartDate =
      typeof firstEventData === "string" ? firstEventData : null;

    const isPartialData =
      !!coverageStartDate && new Date(coverageStartDate) > startDate;

    return {
      alunosLogaram,
      totalAlunos,
      taxaLogin:
        totalAlunos > 0 ? Math.round((alunosLogaram / totalAlunos) * 100) : 0,
      logaramENaoEstudaram: 0,
      hasAnyData: !!coverageStartDate,
      isPartialData,
      coverageStartDate,
    };
  }

  /**
   * Série diária de logins únicos por tenant.
   */
  private async getDailyLogins(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
  ): Promise<DailyLoginsPoint[]> {
    const { startDate } = this.getPeriodDates(period);
    const endDate = new Date();

    const { data, error } = await client.rpc(
      "get_tenant_daily_logins" as never,
      {
        p_empresa_id: empresaId,
        p_start: startDate.toISOString().split("T")[0],
        p_end: endDate.toISOString().split("T")[0],
      } as never,
    );

    if (error) {
      console.error(
        "[dashboard-institution] Erro ao carregar série diária de logins:",
        error,
      );
      return this.generateEmptyDailyLogins(startDate, endDate);
    }

    const rows = (data as Array<{ day: string; unique_users: number }> | null) ?? [];

    if (rows.length === 0) {
      return this.generateEmptyDailyLogins(startDate, endDate);
    }

    return rows.map((row) => ({
      date: row.day,
      uniqueLogins: row.unique_users ?? 0,
    }));
  }

  private generateEmptyDailyLogins(
    startDate: Date,
    endDate: Date,
  ): DailyLoginsPoint[] {
    const result: DailyLoginsPoint[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      result.push({
        date: d.toISOString().split("T")[0],
        uniqueLogins: 0,
      });
    }
    return result;
  }

  /**
   * Conta alunos distintos que já geraram pelo menos um cronograma (cumulativo, não filtra período).
   */
  private async getAlunosComCronograma(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    alunoIds: string[],
  ): Promise<number> {
    if (alunoIds.length === 0) return 0;

    const rows = await fetchAllRowsChunked(
      (ids) =>
        client
          .from("cronogramas")
          .select("usuario_id")
          .in("usuario_id", ids)
          .eq("empresa_id", empresaId),
      alunoIds,
    );

    const unique = new Set<string>();
    for (const r of rows) {
      if (r.usuario_id) unique.add(r.usuario_id);
    }
    return unique.size;
  }

  /**
   * Calcula a adoção de cada serviço da plataforma pelo corpo discente no período.
   * Retorna, por serviço, quantos alunos únicos tiveram alguma atividade registrada.
   */
  private async getServiceAdoption(
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    period: DashboardPeriod,
    alunoIds: string[],
  ): Promise<ServiceAdoptionItem[]> {
    const totalAlunos = alunoIds.length;
    const buildEmpty = (): ServiceAdoptionItem[] =>
      (Object.keys(SERVICE_LABELS) as ServiceKey[]).map((servico) => ({
        servico,
        label: SERVICE_LABELS[servico],
        alunosAtivos: 0,
        totalAlunos,
        percentual: 0,
      }));

    if (totalAlunos === 0) return buildEmpty();

    const { startDate } = this.getPeriodDates(period);
    const since = startDate.toISOString();

    type UserIdRow = { usuario_id: string | null } | { user_id: string | null } | { aluno_id: string | null };

    const collectIds = (rows: UserIdRow[]): Set<string> => {
      const set = new Set<string>();
      for (const r of rows) {
        const id =
          ("usuario_id" in r && r.usuario_id) ||
          ("user_id" in r && r.user_id) ||
          ("aluno_id" in r && r.aluno_id) ||
          null;
        if (id) set.add(id);
      }
      return set;
    };

    const [
      sessoesRows,
      cronogramasRows,
      flashcardsRows,
      agendamentosRows,
      aiThreadRows,
      chatConversationRows,
      atividadesRows,
    ] = await Promise.all([
      fetchAllRowsChunked(
        (ids) =>
          client
            .from("sessoes_estudo")
            .select("usuario_id")
            .in("usuario_id", ids)
            .gte("created_at", since),
        alunoIds,
      ),
      fetchAllRowsChunked(
        (ids) =>
          client
            .from("cronogramas")
            .select("usuario_id")
            .in("usuario_id", ids)
            .eq("empresa_id", empresaId)
            .gte("created_at", since),
        alunoIds,
      ),
      fetchAllRowsChunked(
        (ids) =>
          client
            .from("progresso_flashcards")
            .select("usuario_id")
            .in("usuario_id", ids)
            .gt("numero_revisoes", 0)
            .gte("updated_at", since),
        alunoIds,
      ),
      fetchAllRowsChunked(
        (ids) =>
          client
            .from("agendamentos")
            .select("aluno_id")
            .in("aluno_id", ids)
            .eq("empresa_id", empresaId)
            .gte("created_at", since),
        alunoIds,
      ),
      fetchAllRowsChunked(
        (ids) =>
          client
            .from("ai_agent_threads")
            .select("user_id")
            .in("user_id", ids)
            .eq("empresa_id", empresaId)
            .gte("created_at", since),
        alunoIds,
      ),
      fetchAllRowsChunked(
        (ids) =>
          client
            .from("chat_conversations")
            .select("user_id")
            .in("user_id", ids)
            .eq("empresa_id", empresaId)
            .gte("created_at", since),
        alunoIds,
      ),
      fetchAllRowsChunked(
        (ids) =>
          client
            .from("progresso_atividades")
            .select("usuario_id")
            .in("usuario_id", ids)
            .gte("updated_at", since),
        alunoIds,
      ),
    ]);

    const aiChatSet = new Set<string>([
      ...collectIds(aiThreadRows as UserIdRow[]),
      ...collectIds(chatConversationRows as UserIdRow[]),
    ]);

    const counts: Record<ServiceKey, number> = {
      sessoes_estudo: collectIds(sessoesRows as UserIdRow[]).size,
      cronogramas: collectIds(cronogramasRows as UserIdRow[]).size,
      flashcards: collectIds(flashcardsRows as UserIdRow[]).size,
      agendamentos: collectIds(agendamentosRows as UserIdRow[]).size,
      ai_chat: aiChatSet.size,
      progresso_atividades: collectIds(atividadesRows as UserIdRow[]).size,
    };

    for (const [service, count] of Object.entries(counts)) {
      if (count > totalAlunos) {
        console.warn(
          "[dashboard-institution] Adoção acima da base detectada",
          {
            empresaId,
            service,
            count,
            totalAlunos,
          },
        );
      }
    }

    return (Object.keys(SERVICE_LABELS) as ServiceKey[]).map((servico) => ({
      servico,
      label: SERVICE_LABELS[servico],
      alunosAtivos: counts[servico],
      totalAlunos,
      percentual: totalAlunos > 0
        ? Math.round((counts[servico] / totalAlunos) * 100)
        : 0,
    }));
  }

  /**
   * Calcula datas do período
   */
  private getPeriodDates(period: DashboardPeriod): {
    startDate: Date;
    previousStartDate: Date;
    previousEndDate: Date;
  } {
    const now = new Date();
    let startDate: Date;
    let previousStartDate: Date;
    let previousEndDate: Date;

    switch (period) {
      case "semanal":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        previousEndDate = new Date(startDate);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setDate(previousStartDate.getDate() - 7);
        break;
      case "mensal":
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        previousEndDate = new Date(startDate);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setMonth(previousStartDate.getMonth() - 1);
        break;
      case "anual":
      default:
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        previousEndDate = new Date(startDate);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
        break;
    }

    return { startDate, previousStartDate, previousEndDate };
  }
}
