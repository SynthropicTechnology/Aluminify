import { getDatabaseClient } from "@/app/shared/core/database/database";
import { fetchAllRows } from "@/app/shared/core/database/fetch-all-rows";
import type {
  ProfessorDashboardData,
  ProfessorSummary,
  ProfessorDisciplinaPerformance,
} from "@/app/[tenant]/(modules)/dashboard/types";
import type { StudentUnderCare } from "@/app/[tenant]/(modules)/usuario/types";
import type { UpcomingAppointment } from "@/app/[tenant]/(modules)/agendamentos/types/types";

export class ProfessorAnalyticsService {
  /**
   * Busca dados agregados do dashboard do professor
   */
  async getProfessorDashboard(
    professorId: string,
    empresaId: string,
  ): Promise<ProfessorDashboardData> {
    const client = getDatabaseClient();

    // Buscar nome do professor
    const { data: professor } = await client
      .from("usuarios")
      .select("nome_completo")
      .eq("id", professorId)
      .single();

    const professorNome = professor?.nome_completo ?? "Professor";

    // Buscar métricas em paralelo
    const [summary, alunos, agendamentos, performanceAlunos] =
      await Promise.all([
        this.getSummary(professorId, client),
        this.getStudentsUnderCare(professorId, empresaId, client),
        this.getUpcomingAppointments(professorId, client, 10),
        this.getPerformanceAlunos(professorId, empresaId, client),
      ]);

    return {
      professorNome,
      summary,
      alunos,
      agendamentos,
      performanceAlunos,
    };
  }

  /**
   * Busca resumo do professor
   */
  private async getSummary(
    professorId: string,
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<ProfessorSummary> {
    // Buscar alunos únicos atendidos
    const agendamentosTodos = await fetchAllRows(
      client
        .from("agendamentos")
        .select("aluno_id")
        .eq("professor_id", professorId),
    );

    const alunosUnicos = new Set(
      agendamentosTodos.map((a) => a.aluno_id),
    );

    // Buscar agendamentos pendentes
    const { count: agendamentosPendentes } = await client
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", professorId)
      .eq("status", "pendente")
      .gte("data_inicio", new Date().toISOString());

    // Buscar agendamentos realizados no mês
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { count: agendamentosRealizadosMes } = await client
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("professor_id", professorId)
      .eq("status", "concluido")
      .gte("data_inicio", inicioMes.toISOString());

    // Buscar próximo agendamento
    const { data: proximoAgendamentoData } = await client
      .from("agendamentos")
      .select("data_inicio")
      .eq("professor_id", professorId)
      .in("status", ["pendente", "confirmado"])
      .gte("data_inicio", new Date().toISOString())
      .order("data_inicio", { ascending: true })
      .limit(1)
      .maybeSingle();

    return {
      alunosAtendidos: alunosUnicos.size,
      agendamentosPendentes: agendamentosPendentes ?? 0,
      agendamentosRealizadosMes: agendamentosRealizadosMes ?? 0,
      proximoAgendamento: proximoAgendamentoData?.data_inicio ?? null,
    };
  }

  /**
   * Busca alunos sob tutela do professor (via agendamentos)
   */
  async getStudentsUnderCare(
    professorId: string,
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
    limit = 20,
  ): Promise<StudentUnderCare[]> {
    // Buscar agendamentos do professor
    const { data: agendamentos } = await client
      .from("agendamentos")
      .select("aluno_id")
      .eq("professor_id", professorId)
      .order("data_inicio", { ascending: false })
      .limit(100);

    if (!agendamentos || agendamentos.length === 0) return [];

    // Extrair IDs únicos de alunos
    const alunoIdsUnicos = [...new Set(agendamentos.map((a) => a.aluno_id))].slice(0, limit);

    // Buscar dados dos alunos
    const { data: alunos } = await client
      .from("usuarios")
      .select("id, nome_completo, empresa_id")
      .in("id", alunoIdsUnicos)
      .eq("empresa_id", empresaId);

    if (!alunos || alunos.length === 0) return [];

    // Bulk fetch courses
    const alunosCursos = await fetchAllRows(
      client
        .from("alunos_cursos")
        .select(`
          usuario_id,
          cursos!inner(nome)
        `)
        .in("usuario_id", alunoIdsUnicos),
    );

    const cursosMap = new Map();
    alunosCursos.forEach((ac) => {
        cursosMap.set(ac.usuario_id, ac.cursos?.nome ?? "Sem curso");
    });

    // Bulk fetch progress metrics (Aproveitamento)
    const progressos = await fetchAllRows(
      client
        .from("progresso_atividades")
        .select("usuario_id, questoes_totais, questoes_acertos")
        .in("usuario_id", alunoIdsUnicos),
    );

    const aprovStats = new Map<string, { total: number; acertos: number }>();
    progressos.forEach(p => {
        if (!p.usuario_id) return;
        if (!aprovStats.has(p.usuario_id)) aprovStats.set(p.usuario_id, { total: 0, acertos: 0 });
        const s = aprovStats.get(p.usuario_id)!;
        s.total += p.questoes_totais ?? 0;
        s.acertos += p.questoes_acertos ?? 0;
    });

    // Bulk fetch Last Session (max created_at)
    // We fetch sessions from last 60 days to be safe
    const lookbackDate = new Date();
    lookbackDate.setDate(lookbackDate.getDate() - 60);
    const sessions = await fetchAllRows(
      client
        .from("sessoes_estudo")
        .select("usuario_id, created_at")
        .in("usuario_id", alunoIdsUnicos)
        .gte("created_at", lookbackDate.toISOString()),
    );

    const lastSessionMap = new Map<string, string>();
    sessions.forEach(s => {
        if (!s.usuario_id || !s.created_at) return;
        const current = lastSessionMap.get(s.usuario_id);
        if (!current || new Date(s.created_at) > new Date(current)) {
            lastSessionMap.set(s.usuario_id, s.created_at);
        }
    });

    const result: StudentUnderCare[] = [];

    for (const aluno of alunos) {
        const cursoNome = cursosMap.get(aluno.id) ?? "Sem curso";
        const stats = aprovStats.get(aluno.id);
        const aproveitamento = stats && stats.total > 0 ? Math.round((stats.acertos / stats.total) * 100) : 0;
        const ultimaAtividade = lastSessionMap.get(aluno.id) ?? null;

        // Still using per-student query for this complex metric, but others are bulked
        const progresso = await this.getStudentProgress(aluno.id, client);

        result.push({
            id: aluno.id,
            name: aluno.nome_completo ?? "Aluno",
            avatarUrl: null,
            cursoNome,
            progresso,
            ultimaAtividade,
            aproveitamento
        });
    }

    // Ordenar por última atividade (mais recente primeiro)
    result.sort((a, b) => {
      if (!a.ultimaAtividade && !b.ultimaAtividade) return 0;
      if (!a.ultimaAtividade) return 1;
      if (!b.ultimaAtividade) return -1;
      return (
        new Date(b.ultimaAtividade).getTime() -
        new Date(a.ultimaAtividade).getTime()
      );
    });

    return result;
  }

  /**
   * Calcula progresso do aluno baseado no cronograma
   */
  private async getStudentProgress(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<number> {
    // Buscar cronograma do aluno
    const { data: cronograma } = await client
      .from("cronogramas")
      .select("id")
      .eq("usuario_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!cronograma) return 0;

    // Contar itens totais e assistidos
    const { count: totalItens } = await client
      .from("cronograma_itens")
      .select("id", { count: "exact", head: true })
      .eq("cronograma_id", cronograma.id);

    const { count: itensAssistidos } = await client
      .from("cronograma_itens")
      .select("id", { count: "exact", head: true })
      .eq("cronograma_id", cronograma.id)
      .eq("concluido", true);

    if (!totalItens || totalItens === 0) return 0;
    return Math.round(((itensAssistidos ?? 0) / totalItens) * 100);
  }

  /**
   * Calcula aproveitamento do aluno (usando progresso_atividades)
   */
  private async getStudentAproveitamento(
    alunoId: string,
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<number> {
    const { data: progressos } = await client
      .from("progresso_atividades")
      .select("questoes_totais, questoes_acertos")
      .eq("usuario_id", alunoId);

    if (!progressos || progressos.length === 0) return 0;

    let totalQuestoes = 0;
    let totalAcertos = 0;
    for (const p of progressos) {
      totalQuestoes += p.questoes_totais ?? 0;
      totalAcertos += p.questoes_acertos ?? 0;
    }

    if (totalQuestoes === 0) return 0;
    return Math.round((totalAcertos / totalQuestoes) * 100);
  }

  /**
   * Busca próximos agendamentos
   */
  async getUpcomingAppointments(
    professorId: string,
    client: ReturnType<typeof getDatabaseClient>,
    limit = 10,
  ): Promise<UpcomingAppointment[]> {
    const { data: agendamentos } = await client
      .from("agendamentos")
      .select("id, aluno_id, data_inicio, data_fim, status, observacoes")
      .eq("professor_id", professorId)
      .in("status", ["pendente", "confirmado"])
      .gte("data_inicio", new Date().toISOString())
      .order("data_inicio", { ascending: true })
      .limit(limit);

    if (!agendamentos || agendamentos.length === 0) return [];

    // Buscar nomes dos alunos
    const alunoIds = [...new Set(agendamentos.map((a) => a.aluno_id))];
    const { data: alunos } = await client
      .from("usuarios")
      .select("id, nome_completo")
      .in("id", alunoIds);

    const alunoMap = new Map(
      (alunos ?? []).map((a) => [a.id, a.nome_completo]),
    );

    return agendamentos.map((agendamento) => {
      // Calculate duration in minutes from data_inicio to data_fim
      const inicio = new Date(agendamento.data_inicio);
      const fim = new Date(agendamento.data_fim);
      const duracao = Math.round((fim.getTime() - inicio.getTime()) / 60000);

      // Map DB status to interface status (concluido -> realizado)
      const statusMap: Record<string, UpcomingAppointment["status"]> = {
        pendente: "pendente",
        confirmado: "confirmado",
        cancelado: "cancelado",
        concluido: "realizado",
      };

      return {
        id: agendamento.id,
        alunoId: agendamento.aluno_id,
        alunoNome: alunoMap.get(agendamento.aluno_id) ?? "Aluno",
        alunoAvatar: null,
        dataHora: agendamento.data_inicio,
        duracao: duracao > 0 ? duracao : 60,
        status: statusMap[agendamento.status] ?? "pendente",
        titulo: null,
        notas: agendamento.observacoes ?? null,
      };
    });
  }

  /**
   * Busca performance dos alunos por disciplina (usando progresso_atividades)
   */
  private async getPerformanceAlunos(
    professorId: string,
    empresaId: string,
    client: ReturnType<typeof getDatabaseClient>,
  ): Promise<ProfessorDisciplinaPerformance[]> {
    // Buscar alunos com agendamentos com este professor
    const agendamentos = await fetchAllRows(
      client
        .from("agendamentos")
        .select("aluno_id")
        .eq("professor_id", professorId),
    );

    if (agendamentos.length === 0) return [];

    const alunoIds = [...new Set(agendamentos.map((a) => a.aluno_id))];

    // Buscar disciplinas da empresa
    const { data: disciplinas } = await client
      .from("disciplinas")
      .select("id, nome")
      .eq("empresa_id", empresaId)
      .limit(10);

    if (!disciplinas || disciplinas.length === 0) return [];
    const disciplinaMap = new Map(disciplinas.map((d: { id: string; nome: string }) => [d.id, d.nome]));

    // Bulk fetch sessions
    const sessoes = await fetchAllRows(
      client
        .from("sessoes_estudo")
        .select("usuario_id, disciplina_id")
        .in("usuario_id", alunoIds)
        .in("disciplina_id", disciplinas.map((d: { id: string }) => d.id)),
    );

    // Group sessions
    const sessionsByDisc = new Map<string, Set<string>>();
    for (const s of sessoes) {
        if (!s.disciplina_id || !s.usuario_id) continue;
        if (!sessionsByDisc.has(s.disciplina_id)) {
            sessionsByDisc.set(s.disciplina_id, new Set());
        }
        sessionsByDisc.get(s.disciplina_id)!.add(s.usuario_id);
    }

    // Bulk fetch progress with deep linking
    const progressos = await fetchAllRows(
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
        .in("usuario_id", alunoIds)
        .not("atividade_id", "is", null),
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

    const performance: ProfessorDisciplinaPerformance[] = disciplinas.map((d: { id: string; nome: string }) => {
        const activeStudents = sessionsByDisc.get(d.id)?.size ?? 0;
        if (activeStudents === 0) return null;

        const pStats = progressByDisc.get(d.id) || { total: 0, acertos: 0 };
        const aproveitamentoMedio = pStats.total > 0
            ? Math.round((pStats.acertos / pStats.total) * 100)
            : 0;

        return {
            id: d.id,
            name: d.nome,
            aproveitamentoMedio,
            totalAlunos: activeStudents
        };
    }).filter((p: ProfessorDisciplinaPerformance | null): p is ProfessorDisciplinaPerformance => p !== null);

    // Ordenar por aproveitamento (maior primeiro)
    performance.sort((a, b) => b.aproveitamentoMedio - a.aproveitamentoMedio);

    return performance;
  }
}
