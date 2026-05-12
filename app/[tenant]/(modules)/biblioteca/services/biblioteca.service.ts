import { createClient } from "@/app/shared/core/client";
import {
  StatusAtividade,
  DificuldadePercebida,
} from "@/app/[tenant]/(modules)/sala-de-estudos/services/atividades";
import {
  AtividadeComProgresso,
  CursoComDisciplinas,
  DisciplinaComFrentes,
  FrenteComModulos,
  ModuloComAtividades,
} from "../types";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";

function formatSupabaseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null) {
    const supabaseError = error as Record<string, unknown>;
    const message = supabaseError.message;
    const details = supabaseError.details;
    const hint = supabaseError.hint;
    const code = supabaseError.code;

    const parts: string[] = [];
    if (code) parts.push(`[${code}]`);
    if (message) parts.push(String(message));
    if (details) parts.push(`Detalhes: ${String(details)}`);
    if (hint) parts.push(`Hint: ${String(hint)}`);

    return parts.length > 0 ? parts.join(" - ") : JSON.stringify(error);
  }

  return String(error);
}

export async function fetchBibliotecaData(
  alunoId: string | null,
  userRole: string | null,
  activeOrgId?: string,
): Promise<{
  atividades: AtividadeComProgresso[];
  estrutura: CursoComDisciplinas[];
  cursos: Array<{ id: string; nome: string }>;
  disciplinas: Array<{ id: string; nome: string }>;
  frentes: Array<{ id: string; nome: string; disciplina_id: string }>;
}> {
  const supabase = createClient();

  if (!alunoId || !userRole) {
    return {
      atividades: [],
      estrutura: [],
      cursos: [],
      disciplinas: [],
      frentes: [],
    };
  }

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      const errorMsg = formatSupabaseError(sessionError);
      throw new Error(`Erro de autenticação: ${errorMsg}`);
    }

    if (!session) {
      throw new Error("Sessão não encontrada. Faça login novamente.");
    }

    // ALUNO: buscar via backend (mesmo padrão do cronograma)
    if (userRole !== "professor" && userRole !== "usuario") {
      const url = new URL(
        `/api/sala-de-estudos/atividades/aluno/${alunoId}`,
        window.location.origin,
      );
      if (activeOrgId) {
        url.searchParams.set("empresa_id", activeOrgId);
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error || "Erro ao carregar atividades do aluno",
        );
      }

      const payload = (await response.json()) as {
        data?: AtividadeComProgresso[];
      };
      const atividadesComProgresso = (payload.data || []).slice();

      if (atividadesComProgresso.length === 0) {
        const cursoIds = await fetchCanonicalCourseIdsForStudent(
          supabase,
          alunoId,
          activeOrgId,
        );

        const { data: cursosDoAluno } = cursoIds.length > 0
          ? await supabase
            .from("cursos")
            .select("id, nome")
            .in("id", cursoIds)
            .order("nome")
          : { data: [] };

        return {
          atividades: [],
          estrutura: [],
          cursos: cursosDoAluno ?? [],
          disciplinas: [],
          frentes: [],
        };
      }

      atividadesComProgresso.sort((a, b) => {
        if (a.cursoNome !== b.cursoNome)
          return a.cursoNome.localeCompare(b.cursoNome);
        if (a.disciplinaNome !== b.disciplinaNome)
          return a.disciplinaNome.localeCompare(b.disciplinaNome);
        if (a.frenteNome !== b.frenteNome)
          return a.frenteNome.localeCompare(b.frenteNome);
        const numA = a.moduloNumero ?? 0;
        const numB = b.moduloNumero ?? 0;
        if (numA !== numB) return numA - numB;
        return (a.ordemExibicao ?? 0) - (b.ordemExibicao ?? 0);
      });

      const estrutura = buildStructure(atividadesComProgresso);
      const { cursos, disciplinas, frentes } =
        extractMetadataFromStructure(estrutura);

      return {
        atividades: atividadesComProgresso,
        estrutura,
        cursos,
        disciplinas,
        frentes,
      };
    }

    // PROFESSOR Logic (Replicated from sala-estudos-client)
    let cursoIds: string[] = [];

    if (userRole === "professor" || userRole === "usuario") {
      const { data: cursosData, error: cursosError } = await supabase
        .from("cursos")
        .select("id")
        .order("nome", { ascending: true });

      if (cursosError) {
        const errorMsg = formatSupabaseError(cursosError);
        throw new Error(`Erro ao buscar cursos: ${errorMsg}`);
      }
      cursoIds = cursosData?.map((c) => c.id) || [];
    } else {
      cursoIds = await fetchCanonicalCourseIdsForStudent(
        supabase,
        alunoId,
        activeOrgId,
      );
    }

    if (cursoIds.length === 0) {
      return {
        atividades: [],
        estrutura: [],
        cursos: [],
        disciplinas: [],
        frentes: [],
      };
    }

    // Fetch related entities (Hierarchy: Curso -> Disciplina -> Frente -> Modulo -> Atividade)
    const { data: cursosDisciplinas, error: cdError } = await supabase
      .from("cursos_disciplinas")
      .select("disciplina_id, curso_id")
      .in("curso_id", cursoIds);

    if (cdError)
      throw new Error(
        `Erro ao buscar cursos_disciplinas: ${formatSupabaseError(cdError)}`,
      );
    if (!cursosDisciplinas?.length)
      return {
        atividades: [],
        estrutura: [],
        cursos: [],
        disciplinas: [],
        frentes: [],
      };

    const disciplinaIds = [
      ...new Set(cursosDisciplinas.map((cd) => cd.disciplina_id)),
    ];

    const { data: frentesData, error: frentesError } = await supabase
      .from("frentes")
      .select("id, nome, disciplina_id, curso_id")
      .in("disciplina_id", disciplinaIds);

    if (frentesError) throw frentesError;
    if (!frentesData?.length)
      return {
        atividades: [],
        estrutura: [],
        cursos: [],
        disciplinas: [],
        frentes: [],
      };

    const frentesFiltradas = frentesData.filter(
      (f) => !f.curso_id || cursoIds.includes(f.curso_id),
    );
    const frenteIds = frentesFiltradas.map((f) => f.id);

    const { data: modulosData, error: modulosError } = await supabase
      .from("modulos")
      .select("id, nome, numero_modulo, frente_id")
      .in("frente_id", frenteIds)
      .order("numero_modulo", { ascending: true, nullsFirst: false });

    if (modulosError)
      throw new Error(
        `Erro ao buscar módulos: ${formatSupabaseError(modulosError)}`,
      );
    if (!modulosData?.length)
      return {
        atividades: [],
        estrutura: [],
        cursos: [],
        disciplinas: [],
        frentes: [],
      };

    // Deduplicate modules
    const uniqueModulosMap = new Map<string, (typeof modulosData)[number]>();
    modulosData.forEach((m) => uniqueModulosMap.set(m.id, m));
    const uniqueModulos = Array.from(uniqueModulosMap.values());
    const moduloIds = uniqueModulos.map((m) => m.id);

    const { data: atividadesData, error: atividadesError } = await supabase
      .from("atividades")
      .select("*")
      .in("modulo_id", moduloIds)
      .order("ordem_exibicao", { ascending: true, nullsFirst: false });

    if (atividadesError)
      throw new Error(
        `Erro ao buscar atividades: ${formatSupabaseError(atividadesError)}`,
      );
    if (!atividadesData)
      return {
        atividades: [],
        estrutura: [],
        cursos: [],
        disciplinas: [],
        frentes: [],
      };

    // Fetch progress
    const atividadeIds = atividadesData.map((a) => a.id);
    const BATCH_SIZE = 100;
    const progressosData: Array<{
      atividade_id: string;
      status: string | null;
      data_inicio: string | null;
      data_conclusao: string | null;
      questoes_totais: number | null;
      questoes_acertos: number | null;
      dificuldade_percebida: string | null;
      anotacoes_pessoais: string | null;
    }> = [];

    if (atividadeIds.length > 0) {
      for (let i = 0; i < atividadeIds.length; i += BATCH_SIZE) {
        const batch = atividadeIds.slice(i, i + BATCH_SIZE);
        const { data: batchData, error: progressosError } = await supabase
          .from("progresso_atividades")
          .select(
            "atividade_id, status, data_inicio, data_conclusao, questoes_totais, questoes_acertos, dificuldade_percebida, anotacoes_pessoais",
          )
          .eq("usuario_id", alunoId)
          .in("atividade_id", batch);

        if (progressosError)
          throw new Error(
            `Erro ao buscar progressos: ${formatSupabaseError(progressosError)}`,
          );
        if (batchData)
          progressosData.push(
            ...batchData.filter(
              (p): p is typeof p & { atividade_id: string } => !!p.atividade_id,
            ),
          );
      }
    }

    const progressosMap = new Map(
      progressosData.map((p) => [
        p.atividade_id,
        {
          status: p.status,
          dataInicio: p.data_inicio,
          dataConclusao: p.data_conclusao,
          questoesTotais: p.questoes_totais ?? null,
          questoesAcertos: p.questoes_acertos ?? null,
          dificuldadePercebida: p.dificuldade_percebida ?? null,
          anotacoesPessoais: p.anotacoes_pessoais ?? null,
        },
      ]),
    );

    // Additional info for mapping
    const { data: disciplinasData } = await supabase
      .from("disciplinas")
      .select("id, nome")
      .in("id", disciplinaIds);
    const disciplinasMap = new Map(
      (disciplinasData || []).map((d) => [d.id, d]),
    );

    const { data: cursosDataInfo } = await supabase
      .from("cursos")
      .select("id, nome")
      .in("id", cursoIds);
    const cursosMap = new Map((cursosDataInfo || []).map((c) => [c.id, c]));

    const modulosMap = new Map(uniqueModulos.map((m) => [m.id, m]));
    const frentesMap = new Map(frentesFiltradas.map((f) => [f.id, f]));

    const cursoDisciplinaMap = new Map<string, string[]>();
    cursosDisciplinas.forEach((cd) => {
      if (!cursoDisciplinaMap.has(cd.curso_id))
        cursoDisciplinaMap.set(cd.curso_id, []);
      cursoDisciplinaMap.get(cd.curso_id)!.push(cd.disciplina_id);
    });

    const atividadesComProgresso: AtividadeComProgresso[] = [];
    for (const atividade of atividadesData) {
      if (!atividade.modulo_id) continue;
      const modulo = modulosMap.get(atividade.modulo_id);
      if (!modulo || !modulo.frente_id) continue;
      const frente = frentesMap.get(modulo.frente_id);
      if (!frente || !frente.disciplina_id) continue;
      const disciplina = disciplinasMap.get(frente.disciplina_id);
      if (!disciplina) continue;

      let cursoId: string | null = null;
      let cursoNome: string | null = null;

      for (const [cid, discIds] of cursoDisciplinaMap.entries()) {
        if (discIds.includes(frente.disciplina_id)) {
          cursoId = cid;
          cursoNome = cursosMap.get(cid)?.nome || null;
          break;
        }
      }

      if (!cursoId && frente.curso_id) {
        cursoId = frente.curso_id;
        cursoNome = cursosMap.get(frente.curso_id)?.nome || null;
      }

      if (!cursoId || !cursoNome) continue;

      const progresso = progressosMap.get(atividade.id);

      atividadesComProgresso.push({
        id: atividade.id,
        moduloId: atividade.modulo_id,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        arquivoUrl: atividade.arquivo_url,
        gabaritoUrl: atividade.gabarito_url,
        linkExterno: atividade.link_externo,
        obrigatorio: atividade.obrigatorio ?? false,
        ordemExibicao: atividade.ordem_exibicao ?? 0,
        createdBy: atividade.created_by || null,
        createdAt: atividade.created_at || "1970-01-01T00:00:00.000Z",
        updatedAt: atividade.updated_at || "1970-01-01T00:00:00.000Z",
        moduloNome: modulo.nome,
        moduloNumero: modulo.numero_modulo,
        frenteNome: frente.nome,
        frenteId: frente.id,
        disciplinaNome: disciplina.nome,
        disciplinaId: disciplina.id,
        cursoNome,
        cursoId,
        progressoStatus: (progresso?.status as StatusAtividade) || null,
        progressoDataInicio: progresso?.dataInicio || null,
        progressoDataConclusao: progresso?.dataConclusao || null,
        questoesTotais: progresso?.questoesTotais ?? null,
        questoesAcertos: progresso?.questoesAcertos ?? null,
        dificuldadePercebida:
          (progresso?.dificuldadePercebida as DificuldadePercebida) ?? null,
        anotacoesPessoais: progresso?.anotacoesPessoais ?? null,
      });
    }

    atividadesComProgresso.sort((a, b) => {
      if (a.cursoNome !== b.cursoNome)
        return a.cursoNome.localeCompare(b.cursoNome);
      if (a.disciplinaNome !== b.disciplinaNome)
        return a.disciplinaNome.localeCompare(b.disciplinaNome);
      if (a.frenteNome !== b.frenteNome)
        return a.frenteNome.localeCompare(b.frenteNome);
      const numA = a.moduloNumero ?? 0;
      const numB = b.moduloNumero ?? 0;
      if (numA !== numB) return numA - numB;
      return (a.ordemExibicao ?? 0) - (b.ordemExibicao ?? 0);
    });

    const estrutura = buildStructure(atividadesComProgresso);
    const { cursos, disciplinas, frentes } =
      extractMetadataFromStructure(estrutura);

    return {
      atividades: atividadesComProgresso,
      estrutura,
      cursos,
      disciplinas,
      frentes,
    };
  } catch (err) {
    console.error("Erro ao carregar dados da biblioteca:", err);
    throw err;
  }
}

function buildStructure(
  atividades: AtividadeComProgresso[],
): CursoComDisciplinas[] {
  const estrutura: CursoComDisciplinas[] = [];
  const cursosMap = new Map<string, CursoComDisciplinas>();
  const disciplinasMap = new Map<string, DisciplinaComFrentes>();
  const frentesMap = new Map<string, FrenteComModulos>();
  const modulosMap = new Map<string, ModuloComAtividades>();

  atividades.forEach((atividade) => {
    // Curso
    if (!cursosMap.has(atividade.cursoId)) {
      const curso: CursoComDisciplinas = {
        id: atividade.cursoId,
        nome: atividade.cursoNome,
        disciplinas: [],
      };
      cursosMap.set(atividade.cursoId, curso);
      estrutura.push(curso);
    }
    const curso = cursosMap.get(atividade.cursoId)!;

    // Disciplina
    const discKey = `${atividade.cursoId}-${atividade.disciplinaId}`;
    if (!disciplinasMap.has(discKey)) {
      const disciplina: DisciplinaComFrentes = {
        id: atividade.disciplinaId,
        nome: atividade.disciplinaNome,
        frentes: [],
      };
      disciplinasMap.set(discKey, disciplina);
      curso.disciplinas.push(disciplina);
    }
    const disciplina = disciplinasMap.get(discKey)!;

    // Frente
    const frenteKey = `${atividade.disciplinaId}-${atividade.frenteId}`;
    if (!frentesMap.has(frenteKey)) {
      const frente: FrenteComModulos = {
        id: atividade.frenteId,
        nome: atividade.frenteNome,
        disciplinaId: atividade.disciplinaId,
        modulos: [],
      };
      frentesMap.set(frenteKey, frente);
      disciplina.frentes.push(frente);
    }
    const frente = frentesMap.get(frenteKey)!;

    // Modulo
    if (!modulosMap.has(atividade.moduloId)) {
      const modulo: ModuloComAtividades = {
        id: atividade.moduloId,
        nome: atividade.moduloNome,
        numeroModulo: atividade.moduloNumero,
        frenteId: atividade.frenteId,
        atividades: [],
      };
      modulosMap.set(atividade.moduloId, modulo);
      frente.modulos.push(modulo);
    }
    const modulo = modulosMap.get(atividade.moduloId)!;

    modulo.atividades.push(atividade);
  });

  return estrutura;
}

function extractMetadataFromStructure(estrutura: CursoComDisciplinas[]) {
  const cursos = estrutura.map((c) => ({ id: c.id, nome: c.nome }));
  const disciplinas: Array<{ id: string; nome: string }> = [];
  const frentes: Array<{ id: string; nome: string; disciplina_id: string }> =
    [];

  const seenDisciplinas = new Set<string>();
  const seenFrentes = new Set<string>();

  estrutura.forEach((c) => {
    c.disciplinas.forEach((d) => {
      if (!seenDisciplinas.has(d.id)) {
        disciplinas.push({ id: d.id, nome: d.nome });
        seenDisciplinas.add(d.id);
      }
      d.frentes.forEach((f) => {
        if (!seenFrentes.has(f.id)) {
          frentes.push({
            id: f.id,
            nome: f.nome,
            disciplina_id: f.disciplinaId,
          });
          seenFrentes.add(f.id);
        }
      });
    });
  });

  return { cursos, disciplinas, frentes };
}
