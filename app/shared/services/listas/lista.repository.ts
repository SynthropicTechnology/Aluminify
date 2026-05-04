import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/shared/core/database.types";
import type {
  Lista,
  ListaResumo,
  ListaComQuestoes,
  TipoLista,
  ModosCorrecaoPermitidos,
  CreateListaInput,
  UpdateListaInput,
} from "@/app/shared/types/entities/lista";
import {
  mapQuestaoComAlternativas,
  type QuestaoRow,
  type AlternativaRow,
} from "@/app/shared/services/questoes/questao.repository";

type ListaRow = Database["public"]["Tables"]["listas_exercicios"]["Row"];

export interface ListaRepository {
  list(empresaId: string): Promise<ListaResumo[]>;
  findById(id: string): Promise<Lista | null>;
  findByIdWithQuestoes(id: string): Promise<ListaComQuestoes | null>;
  create(input: CreateListaInput): Promise<Lista>;
  update(id: string, input: UpdateListaInput): Promise<Lista>;
  softDelete(id: string): Promise<void>;
  addQuestoes(
    listaId: string,
    questaoIds: string[],
    empresaId: string,
  ): Promise<void>;
  removeQuestao(listaId: string, questaoId: string): Promise<void>;
  reorderQuestoes(
    listaId: string,
    ordens: Array<{ questaoId: string; ordem: number }>,
  ): Promise<void>;
  countQuestoes(listaId: string): Promise<number>;
}

function mapListaRow(row: ListaRow): Lista {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    atividadeId: row.atividade_id,
    createdBy: row.created_by,
    titulo: row.titulo,
    descricao: row.descricao,
    tipo: row.tipo as TipoLista,
    modosCorrecaoPermitidos: row.modos_correcao_permitidos as ModosCorrecaoPermitidos,
    embaralharQuestoes: row.embaralhar_questoes,
    embaralharAlternativas: row.embaralhar_alternativas,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export { mapListaRow };
export type { ListaRow };

export class ListaRepositoryImpl implements ListaRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async getActiveQuestionCountsByList(
    empresaId: string,
  ): Promise<Map<string, number>> {
    const { data, error } = await this.client
      .from("listas_exercicios_questoes")
      .select("lista_id, banco_questoes!inner(id)")
      .eq("empresa_id", empresaId)
      .is("banco_questoes.deleted_at", null);

    if (error) {
      throw new Error(`Failed to count active questoes: ${error.message}`);
    }

    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ lista_id: string }>) {
      counts.set(row.lista_id, (counts.get(row.lista_id) ?? 0) + 1);
    }

    return counts;
  }

  private async getDisciplinasByList(
    empresaId: string,
  ): Promise<Map<string, string[]>> {
    const { data, error } = await this.client
      .from("listas_exercicios_questoes")
      .select("lista_id, banco_questoes!inner(disciplina)")
      .eq("empresa_id", empresaId)
      .is("banco_questoes.deleted_at", null);

    if (error) {
      throw new Error(`Failed to get disciplinas: ${error.message}`);
    }

    const grouped = new Map<string, Set<string>>();
    for (const row of (data ?? []) as unknown as Array<{
      lista_id: string;
      banco_questoes: { disciplina: string | null };
    }>) {
      const disc = row.banco_questoes?.disciplina;
      if (!disc) continue;
      const set = grouped.get(row.lista_id) ?? new Set();
      set.add(disc);
      grouped.set(row.lista_id, set);
    }

    const result = new Map<string, string[]>();
    for (const [listaId, set] of grouped) {
      result.set(listaId, Array.from(set).sort());
    }
    return result;
  }

  async list(empresaId: string): Promise<ListaResumo[]> {
    const { data, error } = await this.client
      .from("listas_exercicios")
      .select("*")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list listas: ${error.message}`);
    }

    const [activeQuestionCounts, disciplinasByList] = await Promise.all([
      this.getActiveQuestionCountsByList(empresaId),
      this.getDisciplinasByList(empresaId),
    ]);

    return ((data ?? []) as ListaRow[]).map((row) => ({
      ...mapListaRow(row),
      totalQuestoes: activeQuestionCounts.get(row.id) ?? 0,
      disciplinas: disciplinasByList.get(row.id) ?? [],
    }));
  }

  async findById(id: string): Promise<Lista | null> {
    const { data, error } = await this.client
      .from("listas_exercicios")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch lista: ${error.message}`);
    }

    return data ? mapListaRow(data) : null;
  }

  async findByIdWithQuestoes(id: string): Promise<ListaComQuestoes | null> {
    const { data: listaRow, error: listaError } = await this.client
      .from("listas_exercicios")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (listaError) {
      throw new Error(`Failed to fetch lista: ${listaError.message}`);
    }
    if (!listaRow) return null;

    const { data: listaQuestoes, error: lqError } = await this.client
      .from("listas_exercicios_questoes")
      .select("questao_id, ordem")
      .eq("lista_id", id)
      .order("ordem", { ascending: true });

    if (lqError) {
      throw new Error(`Failed to fetch lista questoes: ${lqError.message}`);
    }

    const questaoIds = (listaQuestoes ?? []).map((lq) => lq.questao_id);
    if (questaoIds.length === 0) {
      return { ...mapListaRow(listaRow), questoes: [] };
    }

    const { data: questaoRows, error: qError } = await this.client
      .from("banco_questoes")
      .select("*")
      .in("id", questaoIds)
      .is("deleted_at", null);

    if (qError) {
      throw new Error(`Failed to fetch questoes: ${qError.message}`);
    }

    const { data: altRows, error: altError } = await this.client
      .from("banco_questoes_alternativas")
      .select("*")
      .in("questao_id", questaoIds)
      .order("ordem", { ascending: true });

    if (altError) {
      throw new Error(`Failed to fetch alternativas: ${altError.message}`);
    }

    const questaoMap = new Map<string, QuestaoRow>();
    for (const q of (questaoRows ?? []) as QuestaoRow[]) {
      questaoMap.set(q.id, q);
    }

    const altsByQuestao = new Map<string, AlternativaRow[]>();
    for (const alt of (altRows ?? []) as AlternativaRow[]) {
      const arr = altsByQuestao.get(alt.questao_id) ?? [];
      arr.push(alt);
      altsByQuestao.set(alt.questao_id, arr);
    }

    const questoes = (listaQuestoes ?? [])
      .map((lq) => {
        const qRow = questaoMap.get(lq.questao_id);
        if (!qRow) return null;
        return mapQuestaoComAlternativas(
          qRow,
          altsByQuestao.get(lq.questao_id) ?? [],
        );
      })
      .filter(Boolean) as NonNullable<
      ReturnType<typeof mapQuestaoComAlternativas>
    >[];

    return { ...mapListaRow(listaRow), questoes };
  }

  async create(input: CreateListaInput): Promise<Lista> {
    const { data, error } = await this.client
      .from("listas_exercicios")
      .insert({
        empresa_id: input.empresaId,
        created_by: input.createdBy,
        titulo: input.titulo,
        descricao: input.descricao ?? null,
        tipo: input.tipo ?? "exercicio",
        modos_correcao_permitidos: input.modosCorrecaoPermitidos ?? "por_questao",
        embaralhar_questoes: input.embaralharQuestoes ?? false,
        embaralhar_alternativas: input.embaralharAlternativas ?? false,
        atividade_id: input.atividadeId ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create lista: ${error.message}`);
    }

    if (input.questaoIds && input.questaoIds.length > 0) {
      await this.addQuestoes(data.id, input.questaoIds, input.empresaId);
    }

    return mapListaRow(data);
  }

  async update(id: string, input: UpdateListaInput): Promise<Lista> {
    const updateData: Record<string, unknown> = {};

    if (input.titulo !== undefined) updateData.titulo = input.titulo;
    if (input.descricao !== undefined) updateData.descricao = input.descricao;
    if (input.tipo !== undefined) updateData.tipo = input.tipo;
    if (input.modosCorrecaoPermitidos !== undefined)
      updateData.modos_correcao_permitidos = input.modosCorrecaoPermitidos;
    if (input.embaralharQuestoes !== undefined)
      updateData.embaralhar_questoes = input.embaralharQuestoes;
    if (input.embaralharAlternativas !== undefined)
      updateData.embaralhar_alternativas = input.embaralharAlternativas;
    if (input.atividadeId !== undefined)
      updateData.atividade_id = input.atividadeId;

    const { data, error } = await this.client
      .from("listas_exercicios")
      .update(updateData)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update lista: ${error.message}`);
    }

    return mapListaRow(data);
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.client
      .from("listas_exercicios")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to soft-delete lista: ${error.message}`);
    }
  }

  async addQuestoes(
    listaId: string,
    questaoIds: string[],
    empresaId: string,
  ): Promise<void> {
    const { data: existing } = await this.client
      .from("listas_exercicios_questoes")
      .select("ordem")
      .eq("lista_id", listaId)
      .order("ordem", { ascending: false })
      .limit(1);

    const maxOrdem = existing?.[0]?.ordem ?? -1;

    const payload = questaoIds.map((questaoId, idx) => ({
      lista_id: listaId,
      questao_id: questaoId,
      empresa_id: empresaId,
      ordem: maxOrdem + 1 + idx,
    }));

    const { error } = await this.client
      .from("listas_exercicios_questoes")
      .insert(payload);

    if (error) {
      throw new Error(`Failed to add questoes to lista: ${error.message}`);
    }
  }

  async removeQuestao(listaId: string, questaoId: string): Promise<void> {
    const { error } = await this.client
      .from("listas_exercicios_questoes")
      .delete()
      .eq("lista_id", listaId)
      .eq("questao_id", questaoId);

    if (error) {
      throw new Error(`Failed to remove questao from lista: ${error.message}`);
    }
  }

  async reorderQuestoes(
    listaId: string,
    ordens: Array<{ questaoId: string; ordem: number }>,
  ): Promise<void> {
    await Promise.all(
      ordens.map(({ questaoId, ordem }) =>
        this.client
          .from("listas_exercicios_questoes")
          .update({ ordem })
          .eq("lista_id", listaId)
          .eq("questao_id", questaoId),
      ),
    );
  }

  async countQuestoes(listaId: string): Promise<number> {
    const { data, error } = await this.client
      .from("listas_exercicios_questoes")
      .select("questao_id, banco_questoes!inner(id)")
      .eq("lista_id", listaId)
      .is("banco_questoes.deleted_at", null);

    if (error) {
      throw new Error(`Failed to count questoes: ${error.message}`);
    }

    return data?.length ?? 0;
  }
}
