"use server";

import { createClient } from "@/app/shared/core/server";

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
 * Busca turmas ativas do tenant para o seletor de turmas no RecorrenciaManager.
 */
export async function getTurmasForSelector(
  empresaId: string,
): Promise<Array<{ id: string; nome: string; cursoNome: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("turmas")
    .select("id, nome, cursos!inner(nome)")
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
