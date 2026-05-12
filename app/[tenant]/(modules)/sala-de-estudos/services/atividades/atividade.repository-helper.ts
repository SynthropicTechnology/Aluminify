// Helper function para listar atividades do aluno
// Este arquivo será usado pelo repository

import { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";
import {
  AtividadeComProgressoEHierarquia,
  Atividade,
  TipoAtividade,
} from "./atividade.types";

type AtividadeRow = {
  id: string;
  modulo_id: string;
  tipo: TipoAtividade;
  titulo: string;
  arquivo_url: string | null;
  gabarito_url: string | null;
  link_externo: string | null;
  obrigatorio: boolean;
  ordem_exibicao: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: AtividadeRow): Atividade {
  return {
    id: row.id,
    titulo: row.titulo,
    nome: row.titulo, // Map titulo to nome for compatibility
    moduloId: row.modulo_id,
    modulo_id: row.modulo_id,
    tipo: row.tipo,
    arquivoUrl: row.arquivo_url,
    arquivo_url: row.arquivo_url,
    gabaritoUrl: row.gabarito_url,
    gabarito_url: row.gabarito_url,
    linkExterno: row.link_externo,
    link_externo: row.link_externo,
    obrigatorio: row.obrigatorio ?? true,
    ordemExibicao: row.ordem_exibicao ?? 0,
    ordem_exibicao: row.ordem_exibicao,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    created_at: row.created_at,
    updatedAt: new Date(row.updated_at),
    updated_at: row.updated_at,
  };
}

export async function listByAlunoMatriculasHelper(
  client: SupabaseClient,
  alunoId: string,
  empresaId?: string,
): Promise<AtividadeComProgressoEHierarquia[]> {
  const cursoIds = await fetchCanonicalCourseIdsForStudent(
    client,
    alunoId,
    empresaId,
  );

  if (cursoIds.length === 0) {
    return [];
  }

  const { data: cursosPermitidos, error: cursosPermitidosError } = await client
    .from("cursos")
    .select("id, empresa_id")
    .in("id", cursoIds);

  if (cursosPermitidosError) {
    throw new Error(
      `Failed to fetch canonical course empresas: ${cursosPermitidosError.message}`,
    );
  }

  const allowedEmpresaIds = [
    ...new Set(
      (cursosPermitidos ?? [])
        .map((curso) => curso.empresa_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];

  // 2. Buscar cursos_disciplinas para esses cursos
  const { data: cursosDisciplinas, error: cdError } = await client
    .from("cursos_disciplinas")
    .select("disciplina_id, curso_id")
    .in("curso_id", cursoIds);

  if (cdError) {
    throw new Error(`Failed to fetch cursos_disciplinas: ${cdError.message}`);
  }

  if (!cursosDisciplinas || cursosDisciplinas.length === 0) {
    return [];
  }

  const disciplinaIds = [
    ...new Set(cursosDisciplinas.map((cd) => cd.disciplina_id)),
  ];

  // 3. Buscar frentes dessas disciplinas (considerar curso_id e null)
  const { data: frentes, error: frentesError } = await client
    .from("frentes")
    .select("id, nome, disciplina_id, curso_id")
    .in("disciplina_id", disciplinaIds)
    .or(
      cursoIds.map((cid) => `curso_id.eq.${cid}`).join(",") +
        (cursoIds.length > 0 ? "," : "") +
        "curso_id.is.null",
    );

  if (frentesError) {
    throw new Error(`Failed to fetch frentes: ${frentesError.message}`);
  }

  // Filtrar frentes que pertencem aos cursos do aluno ou são globais (curso_id null)
  const frentesFiltradas = (frentes || []).filter(
    (f) => !f.curso_id || cursoIds.includes(f.curso_id),
  );

  if (frentesFiltradas.length === 0) {
    return [];
  }

  const frenteIds = frentesFiltradas.map((f) => f.id);

  // 4. Buscar módulos dessas frentes
  const { data: modulos, error: modulosError } = await client
    .from("modulos")
    .select("id, nome, numero_modulo, frente_id")
    .in("frente_id", frenteIds)
    .order("numero_modulo", { ascending: true, nullsFirst: false });

  if (modulosError) {
    throw new Error(`Failed to fetch modulos: ${modulosError.message}`);
  }

  if (!modulos || modulos.length === 0) {
    return [];
  }

  const moduloIds = modulos.map((m) => m.id);

  // 5. Buscar atividades desses módulos
  // IMPORTANTE (multi-org):
  // `atividades` tem `empresa_id`. Se um módulo/frente for "global" (curso_id null),
  // sem este filtro poderíamos trazer atividades de outra empresa do mesmo aluno.
  let atividadesQuery = client
    .from("atividades")
    .select("*")
    .in("modulo_id", moduloIds);
  if (empresaId) {
    atividadesQuery = atividadesQuery.eq("empresa_id", empresaId);
  } else if (allowedEmpresaIds.length > 0) {
    atividadesQuery = atividadesQuery.in("empresa_id", allowedEmpresaIds);
  }
  const { data: atividades, error: atividadesError } = await atividadesQuery.order(
    "ordem_exibicao",
    { ascending: true, nullsFirst: false },
  );

  if (atividadesError) {
    throw new Error(`Failed to fetch atividades: ${atividadesError.message}`);
  }

  if (!atividades || atividades.length === 0) {
    return [];
  }

  // 6. Buscar progresso do aluno para essas atividades (incluindo campos de desempenho)
  const atividadeIds = atividades.map((a) => a.id);
  let progressosQuery = client
    .from("progresso_atividades")
    .select(
      "atividade_id, status, data_inicio, data_conclusao, questoes_totais, questoes_acertos, dificuldade_percebida, anotacoes_pessoais",
    )
    .eq("usuario_id", alunoId)
    .in("atividade_id", atividadeIds);
  if (empresaId) {
    progressosQuery = progressosQuery.eq("empresa_id", empresaId);
  } else if (allowedEmpresaIds.length > 0) {
    progressosQuery = progressosQuery.in("empresa_id", allowedEmpresaIds);
  }
  const { data: progressos, error: progressosError } = await progressosQuery;

  if (progressosError) {
    throw new Error(`Failed to fetch progressos: ${progressosError.message}`);
  }

  const progressosMap = new Map(
    (progressos || []).map((p) => [
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

  // 6b. Buscar aulas por módulo e aulas concluídas pelo aluno
  // para determinar quais módulos o aluno já "assistiu" (aulas concluídas)
  const { data: aulasDoModulo, error: aulasError } = await client
    .from("aulas")
    .select("id, modulo_id")
    .in("modulo_id", moduloIds);

  if (aulasError) {
    throw new Error(`Failed to fetch aulas: ${aulasError.message}`);
  }

  // Contar total de aulas por módulo
  const aulasTotalPorModulo = new Map<string, number>();
  const aulaIdsPorModulo = new Map<string, string[]>();
  (aulasDoModulo || []).forEach((aula) => {
    if (!aula.modulo_id) return;
    aulasTotalPorModulo.set(
      aula.modulo_id,
      (aulasTotalPorModulo.get(aula.modulo_id) ?? 0) + 1,
    );
    const ids = aulaIdsPorModulo.get(aula.modulo_id) ?? [];
    ids.push(aula.id);
    aulaIdsPorModulo.set(aula.modulo_id, ids);
  });

  // Buscar aulas concluídas pelo aluno (sem .in() para evitar limite de URL do PostgREST)
  const aulasConcluidasPorModulo = new Map<string, number>();

  if (aulasTotalPorModulo.size > 0) {
    const { data: aulasConcluidas, error: aulasConcluidasError } = await client
      .from("aulas_concluidas")
      .select("aula_id")
      .eq("usuario_id", alunoId);

    if (aulasConcluidasError) {
      throw new Error(
        `Failed to fetch aulas_concluidas: ${aulasConcluidasError.message}`,
      );
    }

    // Mapear aula_id → modulo_id para contar concluídas por módulo
    const aulaToModulo = new Map<string, string>();
    (aulasDoModulo || []).forEach((a) => {
      if (a.modulo_id) aulaToModulo.set(a.id, a.modulo_id);
    });

    (aulasConcluidas || []).forEach((ac) => {
      const moduloId = aulaToModulo.get(ac.aula_id);
      if (moduloId) {
        aulasConcluidasPorModulo.set(
          moduloId,
          (aulasConcluidasPorModulo.get(moduloId) ?? 0) + 1,
        );
      }
    });
  }

  // 7. Buscar disciplinas
  const { data: disciplinas, error: discError } = await client
    .from("disciplinas")
    .select("id, nome")
    .in("id", disciplinaIds);

  if (discError) {
    throw new Error(`Failed to fetch disciplinas: ${discError.message}`);
  }

  const disciplinasMap = new Map((disciplinas || []).map((d) => [d.id, d]));

  // 8. Buscar cursos
  const { data: cursos, error: cursosError } = await client
    .from("cursos")
    .select("id, nome")
    .in("id", cursoIds);

  if (cursosError) {
    throw new Error(`Failed to fetch cursos: ${cursosError.message}`);
  }

  const cursosMap = new Map((cursos || []).map((c) => [c.id, c]));

  // 9. Mapear tudo junto
  const modulosMap = new Map(modulos.map((m) => [m.id, m]));
  const frentesMap = new Map(frentesFiltradas.map((f) => [f.id, f]));

  // Criar mapa curso-disciplina
  const cursoDisciplinaMap = new Map<string, string[]>();
  cursosDisciplinas.forEach((cd) => {
    const key = cd.curso_id;
    if (!cursoDisciplinaMap.has(key)) {
      cursoDisciplinaMap.set(key, []);
    }
    cursoDisciplinaMap.get(key)!.push(cd.disciplina_id);
  });

  const resultado: AtividadeComProgressoEHierarquia[] = [];

  for (const atividade of atividades) {
    const atividadeMapped = mapRow(atividade as AtividadeRow);
    const modulo = modulosMap.get(atividade.modulo_id);
    if (!modulo) continue;

    const frente = frentesMap.get(modulo.frente_id);
    if (!frente) continue;

    const disciplina = disciplinasMap.get(frente.disciplina_id);
    if (!disciplina) continue;

    // Encontrar o curso que tem essa disciplina
    let cursoId: string | null = null;
    let cursoNome: string | null = null;

    for (const [cid, discIds] of cursoDisciplinaMap.entries()) {
      if (discIds.includes(frente.disciplina_id)) {
        cursoId = cid;
        const curso = cursosMap.get(cid);
        if (curso) {
          cursoNome = curso.nome;
        }
        break;
      }
    }

    // Se não encontrou por disciplina, verificar se a frente pertence a um curso específico
    if (!cursoId && frente.curso_id) {
      cursoId = frente.curso_id;
      const curso = cursosMap.get(frente.curso_id);
      if (curso) {
        cursoNome = curso.nome;
      }
    }

    if (!cursoId || !cursoNome) continue;

    const progresso = progressosMap.get(atividade.id);

    resultado.push({
      ...atividadeMapped,
      moduloNome: modulo.nome,
      moduloNumero: modulo.numero_modulo,
      frenteNome: frente.nome,
      frenteId: frente.id,
      disciplinaNome: disciplina.nome,
      disciplinaId: disciplina.id,
      cursoNome,
      cursoId,
      progressoStatus: progresso?.status || null,
      progressoDataInicio: progresso?.dataInicio
        ? new Date(progresso.dataInicio)
        : null,
      progressoDataConclusao: progresso?.dataConclusao
        ? new Date(progresso.dataConclusao)
        : null,
      // Campos de desempenho
      questoesTotais: progresso?.questoesTotais ?? null,
      questoesAcertos: progresso?.questoesAcertos ?? null,
      dificuldadePercebida: progresso?.dificuldadePercebida ?? null,
      anotacoesPessoais: progresso?.anotacoesPessoais ?? null,
      // Dados de conclusão de aulas do módulo
      moduloAulasTotal: aulasTotalPorModulo.get(modulo.id) ?? 0,
      moduloAulasConcluidas: aulasConcluidasPorModulo.get(modulo.id) ?? 0,
    });
  }

  // 10. Ordenar resultado (já deve estar ordenado pelas queries, mas garantir)
  resultado.sort((a, b) => {
    if (a.cursoNome !== b.cursoNome) {
      return a.cursoNome.localeCompare(b.cursoNome);
    }
    if (a.disciplinaNome !== b.disciplinaNome) {
      return a.disciplinaNome.localeCompare(b.disciplinaNome);
    }
    if (a.frenteNome !== b.frenteNome) {
      return a.frenteNome.localeCompare(b.frenteNome);
    }
    const numA = a.moduloNumero ?? 0;
    const numB = b.moduloNumero ?? 0;
    if (numA !== numB) {
      return numA - numB;
    }
    return (a.ordemExibicao ?? 0) - (b.ordemExibicao ?? 0);
  });

  return resultado;
}
