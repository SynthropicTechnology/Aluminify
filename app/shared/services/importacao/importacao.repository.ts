import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/shared/core/database.types";
import type {
  ImportacaoJob,
  StatusImportacao,
  QuestaoParseadaSerializada,
  ParseWarning,
} from "@/app/shared/types/entities/importacao";

type ImportacaoRow =
  Database["public"]["Tables"]["importacao_questoes_jobs"]["Row"];

export interface ImportacaoRepository {
  create(input: {
    empresaId: string;
    createdBy: string | null;
    originalFilename: string;
    originalStoragePath: string;
  }): Promise<ImportacaoJob>;
  findById(id: string): Promise<ImportacaoJob | null>;
  list(empresaId: string): Promise<ImportacaoJob[]>;
  updateStatus(
    id: string,
    status: StatusImportacao,
    extra?: {
      questoesExtraidas?: number;
      questoesJson?: QuestaoParseadaSerializada[];
      warnings?: ParseWarning[];
      errorMessage?: string | null;
      listaId?: string | null;
    },
  ): Promise<ImportacaoJob>;
  updateQuestoesJson(
    id: string,
    questoesJson: QuestaoParseadaSerializada[],
    extra?: {
      disciplina?: string | null;
      disciplinaId?: string | null;
      frenteId?: string | null;
      moduloId?: string | null;
      instituicaoPadrao?: string | null;
      anoPadrao?: number | null;
      dificuldadePadrao?: string | null;
      tagsPadrao?: string[];
    },
  ): Promise<ImportacaoJob>;
  updateMetadata(
    id: string,
    meta: {
      disciplina?: string | null;
      disciplinaId?: string | null;
      frenteId?: string | null;
      moduloId?: string | null;
      instituicaoPadrao?: string | null;
      anoPadrao?: number | null;
      dificuldadePadrao?: string | null;
      tagsPadrao?: string[];
    },
  ): Promise<ImportacaoJob>;
  delete(id: string): Promise<void>;
}

function mapImportacaoRow(row: ImportacaoRow): ImportacaoJob {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    createdBy: row.created_by,
    originalFilename: row.original_filename,
    originalStoragePath: row.original_storage_path,
    status: row.status as StatusImportacao,
    questoesExtraidas: row.questoes_extraidas,
    questoesJson: row.questoes_json as QuestaoParseadaSerializada[] | null,
    warnings: (row.warnings ?? []) as unknown as ParseWarning[],
    errorMessage: row.error_message,
    disciplina: row.disciplina,
    disciplinaId: row.disciplina_id,
    frenteId: row.frente_id,
    moduloId: row.modulo_id,
    listaId: row.lista_id,
    instituicaoPadrao: row.instituicao_padrao ?? null,
    anoPadrao: row.ano_padrao ?? null,
    dificuldadePadrao: row.dificuldade_padrao as ImportacaoJob["dificuldadePadrao"] ?? null,
    tagsPadrao: row.tags_padrao ?? [],
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class ImportacaoRepositoryImpl implements ImportacaoRepository {
  constructor(private readonly client: SupabaseClient) {}

  async create(input: {
    empresaId: string;
    createdBy: string | null;
    originalFilename: string;
    originalStoragePath: string;
  }): Promise<ImportacaoJob> {
    const { data, error } = await this.client
      .from("importacao_questoes_jobs")
      .insert({
        empresa_id: input.empresaId,
        created_by: input.createdBy,
        original_filename: input.originalFilename,
        original_storage_path: input.originalStoragePath,
        status: "processando",
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create importacao job: ${error.message}`);
    }

    return mapImportacaoRow(data);
  }

  async findById(id: string): Promise<ImportacaoJob | null> {
    const { data, error } = await this.client
      .from("importacao_questoes_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch importacao job: ${error.message}`);
    }

    return data ? mapImportacaoRow(data) : null;
  }

  async list(empresaId: string): Promise<ImportacaoJob[]> {
    const { data, error } = await this.client
      .from("importacao_questoes_jobs")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list importacao jobs: ${error.message}`);
    }

    return (data ?? []).map(mapImportacaoRow);
  }

  async updateStatus(
    id: string,
    status: StatusImportacao,
    extra?: {
      questoesExtraidas?: number;
      questoesJson?: QuestaoParseadaSerializada[];
      warnings?: ParseWarning[];
      errorMessage?: string | null;
      listaId?: string | null;
    },
  ): Promise<ImportacaoJob> {
    const updateData: Record<string, unknown> = { status };

    if (extra?.questoesExtraidas !== undefined) {
      updateData.questoes_extraidas = extra.questoesExtraidas;
    }
    if (extra?.questoesJson !== undefined) {
      updateData.questoes_json = extra.questoesJson;
    }
    if (extra?.warnings !== undefined) {
      updateData.warnings = extra.warnings;
    }
    if (extra?.errorMessage !== undefined) {
      updateData.error_message = extra.errorMessage;
    }
    if (extra?.listaId !== undefined) {
      updateData.lista_id = extra.listaId;
    }

    const { data, error } = await this.client
      .from("importacao_questoes_jobs")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update importacao job: ${error.message}`);
    }

    return mapImportacaoRow(data);
  }

  async updateQuestoesJson(
    id: string,
    questoesJson: QuestaoParseadaSerializada[],
    extra?: {
      disciplina?: string | null;
      disciplinaId?: string | null;
      frenteId?: string | null;
      moduloId?: string | null;
      instituicaoPadrao?: string | null;
      anoPadrao?: number | null;
      dificuldadePadrao?: string | null;
      tagsPadrao?: string[];
    },
  ): Promise<ImportacaoJob> {
    const updateData: Record<string, unknown> = {
      questoes_json: questoesJson,
      questoes_extraidas: questoesJson.length,
    };

    if (extra?.disciplina !== undefined) {
      updateData.disciplina = extra.disciplina;
    }
    if (extra?.disciplinaId !== undefined) {
      updateData.disciplina_id = extra.disciplinaId;
    }
    if (extra?.frenteId !== undefined) {
      updateData.frente_id = extra.frenteId;
    }
    if (extra?.moduloId !== undefined) {
      updateData.modulo_id = extra.moduloId;
    }
    if (extra?.instituicaoPadrao !== undefined) {
      updateData.instituicao_padrao = extra.instituicaoPadrao;
    }
    if (extra?.anoPadrao !== undefined) {
      updateData.ano_padrao = extra.anoPadrao;
    }
    if (extra?.dificuldadePadrao !== undefined) {
      updateData.dificuldade_padrao = extra.dificuldadePadrao;
    }
    if (extra?.tagsPadrao !== undefined) {
      updateData.tags_padrao = extra.tagsPadrao;
    }

    const { data, error } = await this.client
      .from("importacao_questoes_jobs")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(
        `Failed to update importacao questoes: ${error.message}`,
      );
    }

    return mapImportacaoRow(data);
  }

  async updateMetadata(
    id: string,
    meta: {
      disciplina?: string | null;
      disciplinaId?: string | null;
      frenteId?: string | null;
      moduloId?: string | null;
      instituicaoPadrao?: string | null;
      anoPadrao?: number | null;
      dificuldadePadrao?: string | null;
      tagsPadrao?: string[];
    },
  ): Promise<ImportacaoJob> {
    const updateData: Record<string, unknown> = {};

    if (meta.disciplina !== undefined) updateData.disciplina = meta.disciplina;
    if (meta.disciplinaId !== undefined) updateData.disciplina_id = meta.disciplinaId;
    if (meta.frenteId !== undefined) updateData.frente_id = meta.frenteId;
    if (meta.moduloId !== undefined) updateData.modulo_id = meta.moduloId;
    if (meta.instituicaoPadrao !== undefined) updateData.instituicao_padrao = meta.instituicaoPadrao;
    if (meta.anoPadrao !== undefined) updateData.ano_padrao = meta.anoPadrao;
    if (meta.dificuldadePadrao !== undefined) updateData.dificuldade_padrao = meta.dificuldadePadrao;
    if (meta.tagsPadrao !== undefined) updateData.tags_padrao = meta.tagsPadrao;

    if (Object.keys(updateData).length === 0) {
      const job = await this.findById(id);
      if (!job) throw new Error(`Importacao job ${id} not found`);
      return job;
    }

    const { data, error } = await this.client
      .from("importacao_questoes_jobs")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update importacao metadata: ${error.message}`);
    }

    return mapImportacaoRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from("importacao_questoes_jobs")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete importacao job: ${error.message}`);
    }
  }
}
