"use server";

import { createClient } from "@/app/shared/core/server";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";

/**
 * Busca as turmas vinculadas a cada recorrência.
 * Retorna um mapa recorrencia_id → turma_ids[].
 * Se uma recorrência não tem turmas vinculadas, ela NÃO aparece no mapa.
 */
export async function getRecorrenciaTurmas(
  recorrenciaIds: string[],
): Promise<Record<string, string[]>> {
  if (recorrenciaIds.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agendamento_recorrencia_turmas")
    .select("recorrencia_id, turma_id")
    .in("recorrencia_id", recorrenciaIds);

  if (error) {
    console.error("Error fetching recorrencia turmas:", error);
    return {};
  }

  const map: Record<string, string[]> = {};
  for (const row of data || []) {
    if (!map[row.recorrencia_id]) {
      map[row.recorrencia_id] = [];
    }
    map[row.recorrencia_id].push(row.turma_id);
  }
  return map;
}

/**
 * Busca os cursos vinculados a cada recorrência.
 * Retorna um mapa recorrencia_id → curso_ids[].
 * Se uma recorrência não tem cursos vinculados, ela NÃO aparece no mapa.
 */
export async function getRecorrenciaCursos(
  recorrenciaIds: string[],
): Promise<Record<string, string[]>> {
  if (recorrenciaIds.length === 0) return {};

  const supabase = await createClient();
  // A tabela agendamento_recorrencia_cursos pode não existir em ambientes antigos.
  // Nesses casos, retornamos vazio para manter compatibilidade.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("agendamento_recorrencia_cursos")
    .select("recorrencia_id, curso_id")
    .in("recorrencia_id", recorrenciaIds);

  if (error) {
    console.error("Error fetching recorrencia cursos:", error);
    return {};
  }

  const map: Record<string, string[]> = {};
  for (const row of data || []) {
    if (!map[row.recorrencia_id]) {
      map[row.recorrencia_id] = [];
    }
    map[row.recorrencia_id].push(row.curso_id);
  }
  return map;
}

/**
 * Busca os IDs das turmas ativas onde o aluno está matriculado.
 */
export async function getAlunoTurmaIds(
  alunoId: string,
  empresaId: string,
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("alunos_turmas")
    .select("turma_id, turmas!inner(ativo, empresa_id)")
    .eq("usuario_id", alunoId)
    .eq("turmas.empresa_id", empresaId)
    .eq("turmas.ativo", true);

  if (error) {
    console.error("Error fetching aluno turma ids:", error);
    return [];
  }

  return (data || []).map((row) => row.turma_id);
}

/**
 * Busca os IDs dos cursos onde o aluno está matriculado (camada canônica
 * e também via alunos_turmas -> turmas.curso_id).
 */
export async function getAlunoCursoIds(
  alunoId: string,
  empresaId: string,
): Promise<string[]> {
  const supabase = await createClient();

  const [{ data: cursosViaTurma, error: turmaError }, directCursoIds] =
    await Promise.all([
      supabase
        .from("alunos_turmas")
        .select("turmas!inner(curso_id, empresa_id, ativo)")
        .eq("usuario_id", alunoId)
        .eq("turmas.empresa_id", empresaId)
        .eq("turmas.ativo", true),
      fetchCanonicalCourseIdsForStudent(supabase, alunoId, empresaId),
    ]);

  if (turmaError) {
    console.error("Error fetching aluno curso ids via turma:", turmaError);
  }

  const turmaCursoIds = (cursosViaTurma || []).map(
    (row) => (row.turmas as unknown as { curso_id: string })?.curso_id,
  ).filter(Boolean) as string[];

  return Array.from(new Set([...directCursoIds, ...turmaCursoIds]));
}

/**
 * Busca turmas ativas do tenant para o seletor de turmas no RecorrenciaManager.
 */
export async function getTurmasForSelector(
  empresaId: string,
): Promise<Array<{ id: string; nome: string; cursoNome: string; cursoId: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("id, nome, curso_id, cursos!inner(nome)")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Error fetching turmas for selector:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    nome: row.nome,
    cursoNome: (row.cursos as unknown as { nome: string })?.nome ?? "",
    cursoId: row.curso_id,
  }));
}

/**
 * Busca cursos do tenant para informar estado do seletor por curso.
 */
export async function getCursosForSelector(
  empresaId: string,
): Promise<Array<{ id: string; nome: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cursos")
    .select("id, nome")
    .eq("empresa_id", empresaId)
    .order("nome", { ascending: true });

  if (error) {
    console.error("Error fetching cursos for selector:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    nome: row.nome,
  }));
}

/**
 * Filtra recorrências com base nas turmas vinculadas e na matrícula do aluno.
 *
 * Regras:
 * - Se a recorrência NÃO tem turmas no mapa → incluir (acesso universal)
 * - Se a recorrência TEM turmas → incluir apenas se o aluno está matriculado em pelo menos uma
 */
export async function filterRecorrenciasByTurma<
  T extends { id?: string },
>(
  recorrencias: T[],
  recorrenciaTurmasMap: Record<string, string[]>,
  alunoTurmaIds: string[],
): Promise<T[]> {
  return recorrencias.filter((rec) => {
    const recId = rec.id;
    if (!recId) return true;

    const turmaIds = recorrenciaTurmasMap[recId];
    // Sem turmas vinculadas → acesso universal
    if (!turmaIds || turmaIds.length === 0) return true;

    // Com turmas → verificar se aluno está em pelo menos uma
    return turmaIds.some((turmaId) => alunoTurmaIds.includes(turmaId));
  });
}

/**
 * Filtra recorrências com regras combinadas de turma/curso:
 * - Se tiver turmas vinculadas: exige match por turma.
 * - Senão, se tiver cursos vinculados: exige match por curso.
 * - Sem vínculos: acesso universal.
 */
export async function filterRecorrenciasByAudience<
  T extends { id?: string },
>(
  recorrencias: T[],
  recorrenciaTurmasMap: Record<string, string[]>,
  alunoTurmaIds: string[],
  recorrenciaCursosMap: Record<string, string[]>,
  alunoCursoIds: string[],
): Promise<T[]> {
  return recorrencias.filter((rec) => {
    const recId = rec.id;
    if (!recId) return true;

    const turmaIds = recorrenciaTurmasMap[recId] || [];
    if (turmaIds.length > 0) {
      return turmaIds.some((turmaId) => alunoTurmaIds.includes(turmaId));
    }

    const cursoIds = recorrenciaCursosMap[recId] || [];
    if (cursoIds.length > 0) {
      return cursoIds.some((cursoId) => alunoCursoIds.includes(cursoId));
    }

    return true;
  });
}
