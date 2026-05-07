import { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuestaoResumo,
  QuestaoComAlternativas,
  Alternativa,
  CreateQuestaoInput,
  UpdateQuestaoInput,
  ListQuestoesFilter,
  PaginatedQuestoes,
  ContentBlock,
  LetraGabarito,
  LetraAlternativa,
  DificuldadeQuestao,
} from "@/app/shared/types/entities/questao";
import type { Database } from "@/app/shared/core/database.types";

type QuestaoRow = Database["public"]["Tables"]["banco_questoes"]["Row"];
type AlternativaRow =
  Database["public"]["Tables"]["banco_questoes_alternativas"]["Row"];

export interface QuestaoRepository {
  list(filter: ListQuestoesFilter): Promise<PaginatedQuestoes>;
  findById(id: string): Promise<QuestaoComAlternativas | null>;
  create(input: CreateQuestaoInput): Promise<QuestaoComAlternativas>;
  update(
    id: string,
    input: UpdateQuestaoInput,
  ): Promise<QuestaoComAlternativas>;
  softDelete(id: string): Promise<void>;
}

function mapQuestaoResumo(row: QuestaoRow): QuestaoResumo {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    codigo: (row as Record<string, unknown>).codigo as string | null ?? null,
    numeroOriginal: row.numero_original,
    instituicao: row.instituicao,
    ano: row.ano,
    disciplina: row.disciplina,
    disciplinaId: row.disciplina_id,
    frenteId: row.frente_id,
    moduloId: row.modulo_id,
    dificuldade: row.dificuldade as DificuldadeQuestao | null,
    enunciado: row.enunciado as unknown as ContentBlock[],
    gabarito: row.gabarito as LetraGabarito,
    tags: row.tags,
    areaConhecimento: (row as Record<string, unknown>).area_conhecimento as string | null ?? null,
    competenciasEnem: ((row as Record<string, unknown>).competencias_enem as string[] | null) ?? [],
    habilidadesEnem: ((row as Record<string, unknown>).habilidades_enem as string[] | null) ?? [],
    importacaoJobId: row.importacao_job_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapAlternativa(row: AlternativaRow): Alternativa {
  return {
    id: row.id,
    questaoId: row.questao_id,
    empresaId: row.empresa_id,
    letra: row.letra as LetraAlternativa,
    texto: row.texto,
    imagemPath: row.imagem_path,
    correta: row.correta,
    ordem: row.ordem,
  };
}

function mapQuestaoComAlternativas(
  row: QuestaoRow,
  alternativaRows: AlternativaRow[],
): QuestaoComAlternativas {
  return {
    ...mapQuestaoResumo(row),
    textoBase: row.texto_base as unknown as ContentBlock[] | null,
    resolucaoTexto: row.resolucao_texto as unknown as ContentBlock[] | null,
    resolucaoVideoUrl: row.resolucao_video_url,
    alternativas: alternativaRows.map(mapAlternativa),
    createdBy: row.created_by,
  };
}

export { mapQuestaoResumo, mapAlternativa, mapQuestaoComAlternativas };
export type { QuestaoRow, AlternativaRow };

export class QuestaoRepositoryImpl implements QuestaoRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filter: ListQuestoesFilter): Promise<PaginatedQuestoes> {
    const limit = Math.min(filter.limit ?? 20, 100);

    let query = this.client
      .from("banco_questoes")
      .select("*")
      .eq("empresa_id", filter.empresaId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (filter.disciplinaId) {
      query = query.eq("disciplina_id", filter.disciplinaId);
    } else if (filter.disciplina) {
      query = query.eq("disciplina", filter.disciplina);
    }
    if (filter.frenteId) {
      query = query.eq("frente_id", filter.frenteId);
    }
    if (filter.moduloId) {
      query = query.eq("modulo_id", filter.moduloId);
    }
    if (filter.instituicao) {
      query = query.eq("instituicao", filter.instituicao);
    }
    if (filter.ano !== undefined) {
      query = query.eq("ano", filter.ano);
    }
    if (filter.dificuldade) {
      query = query.eq("dificuldade", filter.dificuldade);
    }
    if (filter.tags && filter.tags.length > 0) {
      query = query.contains("tags", filter.tags);
    }
    if (filter.areaConhecimento) {
      query = query.eq("area_conhecimento", filter.areaConhecimento);
    }
    if (filter.competenciasEnem && filter.competenciasEnem.length > 0) {
      query = query.contains("competencias_enem", filter.competenciasEnem);
    }
    if (filter.habilidadesEnem && filter.habilidadesEnem.length > 0) {
      query = query.contains("habilidades_enem", filter.habilidadesEnem);
    }
    if (filter.cursor) {
      const sep = filter.cursor.indexOf("|");
      if (sep > 0) {
        const cursorDate = filter.cursor.slice(0, sep);
        const cursorId = filter.cursor.slice(sep + 1);
        query = query.or(
          `created_at.lt.${cursorDate},and(created_at.eq.${cursorDate},id.lt.${cursorId})`,
        );
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list questoes: ${error.message}`);
    }

    const rows = data ?? [];
    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasMore && pageRows.length > 0) {
      const last = pageRows[pageRows.length - 1];
      nextCursor = `${last.created_at}|${last.id}`;
    }

    return {
      data: pageRows.map(mapQuestaoResumo),
      nextCursor,
    };
  }

  async findById(id: string): Promise<QuestaoComAlternativas | null> {
    const { data: row, error } = await this.client
      .from("banco_questoes")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch questao: ${error.message}`);
    }
    if (!row) return null;

    const { data: altRows, error: altError } = await this.client
      .from("banco_questoes_alternativas")
      .select("*")
      .eq("questao_id", id)
      .order("ordem", { ascending: true });

    if (altError) {
      throw new Error(`Failed to fetch alternativas: ${altError.message}`);
    }

    return mapQuestaoComAlternativas(row, altRows ?? []);
  }

  async create(input: CreateQuestaoInput): Promise<QuestaoComAlternativas> {
    const { data: questaoRow, error: questaoError } = await this.client
      .from("banco_questoes")
      .insert({
        empresa_id: input.empresaId,
        created_by: input.createdBy,
        numero_original: input.numeroOriginal ?? null,
        instituicao: input.instituicao ?? null,
        ano: input.ano ?? null,
        disciplina: input.disciplina ?? null,
        disciplina_id: input.disciplinaId ?? null,
        frente_id: input.frenteId ?? null,
        modulo_id: input.moduloId ?? null,
        dificuldade: input.dificuldade ?? null,
        texto_base: input.textoBase ?? null,
        enunciado: input.enunciado as unknown as Record<string, unknown>[],
        gabarito: input.gabarito,
        resolucao_texto: input.resolucaoTexto ?? null,
        resolucao_video_url: input.resolucaoVideoUrl ?? null,
        tags: input.tags ?? [],
        area_conhecimento: input.areaConhecimento ?? null,
        competencias_enem: input.competenciasEnem ?? [],
        habilidades_enem: input.habilidadesEnem ?? [],
        importacao_job_id: input.importacaoJobId ?? null,
      })
      .select("*")
      .single();

    if (questaoError) {
      throw new Error(`Failed to create questao: ${questaoError.message}`);
    }

    const altPayload = input.alternativas.map((alt, idx) => ({
      questao_id: questaoRow.id,
      empresa_id: input.empresaId,
      letra: alt.letra,
      texto: alt.texto,
      imagem_path: alt.imagemPath ?? null,
      correta: alt.letra === input.gabarito.toLowerCase(),
      ordem: idx,
    }));

    const { data: altRows, error: altError } = await this.client
      .from("banco_questoes_alternativas")
      .insert(altPayload)
      .select("*");

    if (altError) {
      throw new Error(`Failed to create alternativas: ${altError.message}`);
    }

    const sortedAlts = (altRows ?? []).sort((a, b) => a.ordem - b.ordem);
    return mapQuestaoComAlternativas(questaoRow, sortedAlts);
  }

  async update(
    id: string,
    input: UpdateQuestaoInput,
  ): Promise<QuestaoComAlternativas> {
    const updateData: Record<string, unknown> = {};

    if (input.numeroOriginal !== undefined)
      updateData.numero_original = input.numeroOriginal;
    if (input.instituicao !== undefined)
      updateData.instituicao = input.instituicao;
    if (input.ano !== undefined) updateData.ano = input.ano;
    if (input.disciplina !== undefined)
      updateData.disciplina = input.disciplina;
    if (input.disciplinaId !== undefined)
      updateData.disciplina_id = input.disciplinaId;
    if (input.frenteId !== undefined)
      updateData.frente_id = input.frenteId;
    if (input.moduloId !== undefined)
      updateData.modulo_id = input.moduloId;
    if (input.dificuldade !== undefined)
      updateData.dificuldade = input.dificuldade;
    if (input.textoBase !== undefined) updateData.texto_base = input.textoBase;
    if (input.enunciado !== undefined) updateData.enunciado = input.enunciado;
    if (input.gabarito !== undefined) updateData.gabarito = input.gabarito;
    if (input.resolucaoTexto !== undefined)
      updateData.resolucao_texto = input.resolucaoTexto;
    if (input.resolucaoVideoUrl !== undefined)
      updateData.resolucao_video_url = input.resolucaoVideoUrl;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.areaConhecimento !== undefined)
      updateData.area_conhecimento = input.areaConhecimento;
    if (input.competenciasEnem !== undefined)
      updateData.competencias_enem = input.competenciasEnem;
    if (input.habilidadesEnem !== undefined)
      updateData.habilidades_enem = input.habilidadesEnem;

    if (Object.keys(updateData).length > 0) {
      const { error } = await this.client
        .from("banco_questoes")
        .update(updateData)
        .eq("id", id)
        .is("deleted_at", null);

      if (error) {
        throw new Error(`Failed to update questao: ${error.message}`);
      }
    }

    if (input.alternativas !== undefined) {
      const { data: current, error: fetchError } = await this.client
        .from("banco_questoes")
        .select("empresa_id, gabarito")
        .eq("id", id)
        .single();

      if (fetchError) {
        throw new Error(
          `Failed to fetch questao for alternativas update: ${fetchError.message}`,
        );
      }

      const gabarito = (input.gabarito ?? current.gabarito).toLowerCase();

      const { error: delError } = await this.client
        .from("banco_questoes_alternativas")
        .delete()
        .eq("questao_id", id);

      if (delError) {
        throw new Error(
          `Failed to delete existing alternativas: ${delError.message}`,
        );
      }

      const altPayload = input.alternativas.map((alt, idx) => ({
        questao_id: id,
        empresa_id: current.empresa_id,
        letra: alt.letra,
        texto: alt.texto,
        imagem_path: alt.imagemPath ?? null,
        correta: alt.letra === gabarito,
        ordem: idx,
      }));

      const { error: insertError } = await this.client
        .from("banco_questoes_alternativas")
        .insert(altPayload);

      if (insertError) {
        throw new Error(
          `Failed to insert alternativas: ${insertError.message}`,
        );
      }
    } else if (input.gabarito !== undefined) {
      const gabarito = input.gabarito.toLowerCase();

      await this.client
        .from("banco_questoes_alternativas")
        .update({ correta: false })
        .eq("questao_id", id);

      await this.client
        .from("banco_questoes_alternativas")
        .update({ correta: true })
        .eq("questao_id", id)
        .eq("letra", gabarito);
    }

    const result = await this.findById(id);
    if (!result) {
      throw new Error(`Questao ${id} not found after update`);
    }
    return result;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await this.client
      .from("banco_questoes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to soft-delete questao: ${error.message}`);
    }
  }
}
