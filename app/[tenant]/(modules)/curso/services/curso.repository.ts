import { SupabaseClient } from "@supabase/supabase-js";
import {
  Curso,
  CreateCursoInput,
  UpdateCursoInput,
  Modality,
  CourseType,
} from "./curso.types";
import type {
  PaginationParams,
  PaginationMeta,
} from "@/app/shared/types/dtos/api-responses";

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CursoRepository {
  list(
    params?: PaginationParams,
    empresaId?: string,
  ): Promise<PaginatedResult<Curso>>;
  findById(id: string): Promise<Curso | null>;
  create(payload: CreateCursoInput): Promise<Curso>;
  update(id: string, payload: UpdateCursoInput): Promise<Curso>;
  delete(id: string): Promise<void>;
  findByEmpresa(empresaId: string): Promise<Curso[]>;
  segmentExists(segmentId: string): Promise<boolean>;
  disciplineExists(disciplineId: string): Promise<boolean>;
  getExistingDisciplineIds(disciplineIds: string[]): Promise<string[]>;
  setCourseDisciplines(
    courseId: string,
    disciplineIds: string[],
  ): Promise<void>;
  getCourseDisciplines(courseId: string): Promise<string[]>;
}

const TABLE = "cursos";
const SEGMENT_TABLE = "segmentos";
const DISCIPLINE_TABLE = "disciplinas";
const COURSE_DISCIPLINES_TABLE = "cursos_disciplinas";
const COURSE_HOTMART_PRODUCTS_TABLE = "cursos_hotmart_products";

function formatCountError(error: unknown): string {
  if (!error) return "Erro desconhecido (vazio)";
  if (error instanceof Error) return error.message || "Erro sem mensagem";
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isUnclearCountError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return true;
  if (
    normalized.includes("sem mensagem") ||
    normalized.includes("vazio") ||
    normalized.includes("unknown error")
  ) {
    return true;
  }
  return /"message"\s*:\s*""/i.test(message);
}

type CourseRow = {
  id: string;
  empresa_id: string;
  segmento_id: string | null;
  disciplina_id: string | null;
  nome: string;
  modalidade: Modality;
  modalidade_id: string | null;
  tipo: CourseType;
  descricao: string | null;
  ano_vigencia: number;
  data_inicio: string | null;
  data_termino: string | null;
  meses_acesso: number | null;
  planejamento_url: string | null;
  imagem_capa_url: string | null;
  usa_turmas: boolean;
  created_at: string;
  updated_at: string;
};

async function mapRow(row: CourseRow, client: SupabaseClient): Promise<Curso> {
  // Buscar IDs de disciplinas relacionadas
  const disciplineIds = await getCourseDisciplinesFromDb(row.id, client);
  const hotmartProductIds = await getCourseHotmartProductIdsFromDb(row.id, client);

  return {
    id: row.id,
    empresaId: row.empresa_id,
    segmentId: row.segmento_id ?? null,
    disciplineId: row.disciplina_id ?? null, // Mantido para compatibilidade
    disciplineIds, // Nova propriedade
    name: row.nome,
    modality: row.modalidade,
    modalityId: row.modalidade_id ?? undefined,
    type: row.tipo,
    description: row.descricao,
    year: row.ano_vigencia,
    startDate: row.data_inicio ? new Date(row.data_inicio) : null,
    endDate: row.data_termino ? new Date(row.data_termino) : null,
    accessMonths: row.meses_acesso,
    planningUrl: row.planejamento_url,
    coverImageUrl: row.imagem_capa_url,
    usaTurmas: row.usa_turmas ?? false,
    hotmartProductIds,
    hotmartProductId: hotmartProductIds[0] ?? null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function getCourseDisciplinesFromDb(
  courseId: string,
  client: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await client
    .from(COURSE_DISCIPLINES_TABLE)
    .select("disciplina_id")
    .eq("curso_id", courseId);

  if (error) {
    console.error(`Failed to fetch course disciplines: ${error.message}`);
    return [];
  }

  return (data ?? []).map(
    (row: { disciplina_id: string }) => row.disciplina_id,
  );
}

async function getCourseHotmartProductIdsFromDb(
  courseId: string,
  client: SupabaseClient,
): Promise<string[]> {
  const { data, error } = await client
    .from(COURSE_HOTMART_PRODUCTS_TABLE)
    .select("hotmart_product_id, created_at")
    .eq("curso_id", courseId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error(`Failed to fetch course Hotmart product IDs: ${error.message}`);
    return [];
  }

  return (data ?? [])
    .map((row: { hotmart_product_id: string }) => row.hotmart_product_id)
    .filter((id) => typeof id === "string" && id.trim().length > 0);
}

function normalizeHotmartProductIds(ids: string[]): string[] {
  const normalized = ids
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter((id) => id.length > 0);
  return Array.from(new Set(normalized));
}

async function setCourseHotmartProductIdsInDb(
  client: SupabaseClient,
  params: {
    courseId: string;
    empresaId: string;
    hotmartProductIds: string[];
  },
): Promise<void> {
  const hotmartProductIds = normalizeHotmartProductIds(params.hotmartProductIds);

  // 1) Inserir primeiro (evita perda de dados caso haja conflito de unicidade)
  if (hotmartProductIds.length > 0) {
    const insertData = hotmartProductIds.map((hotmartProductId) => ({
      empresa_id: params.empresaId,
      curso_id: params.courseId,
      hotmart_product_id: hotmartProductId,
    }));

    const { error: insertError } = await client
      .from(COURSE_HOTMART_PRODUCTS_TABLE)
      .upsert(insertData, { onConflict: "curso_id,hotmart_product_id" });

    if (insertError) {
      throw new Error(
        `Failed to set course Hotmart product IDs: ${insertError.message}`,
      );
    }
  }

  // 2) Remover os que não estão mais na lista (ou todos, se lista vazia)
  let deleteQuery = client
    .from(COURSE_HOTMART_PRODUCTS_TABLE)
    .delete()
    .eq("curso_id", params.courseId);

  if (hotmartProductIds.length > 0) {
    deleteQuery = deleteQuery.not(
      "hotmart_product_id",
      "in",
      `(${hotmartProductIds.map((id) => `"${id.replaceAll('"', '\\"')}"`).join(",")})`,
    );
  }

  const { error: deleteError } = await deleteQuery;
  if (deleteError) {
    throw new Error(
      `Failed to remove outdated course Hotmart product IDs: ${deleteError.message}`,
    );
  }
}

export class CursoRepositoryImpl implements CursoRepository {
  constructor(private readonly client: SupabaseClient) {}

  // Map English property names to Portuguese column names
  private mapSortByToColumn(sortBy: string): string {
    const columnMap: Record<string, string> = {
      name: "nome",
      modality: "modalidade",
      type: "tipo",
      description: "descricao",
      year: "ano_vigencia",
      startDate: "data_inicio",
      endDate: "data_termino",
      accessMonths: "meses_acesso",
      planningUrl: "planejamento_url",
      coverImageUrl: "imagem_capa_url",
      createdAt: "created_at",
      updatedAt: "updated_at",
      empresaId: "empresa_id",
      segmentId: "segmento_id",
      disciplineId: "disciplina_id",
    };
    return columnMap[sortBy] || sortBy;
  }

  async list(
    params?: PaginationParams,
    empresaId?: string,
  ): Promise<PaginatedResult<Curso>> {
    const page = params?.page ?? 1;
    const perPage = params?.perPage ?? 50;
    const sortByParam = params?.sortBy ?? "nome";
    const sortBy = this.mapSortByToColumn(sortByParam);
    const sortOrder = params?.sortOrder === "desc" ? false : true;

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Get total count
    let countQuery = this.client
      .from(TABLE)
      .select("*", { count: "exact", head: true });
    if (empresaId) {
      countQuery = countQuery.eq("empresa_id", empresaId);
    }
    const { count, error: countError } = await countQuery;
    let total = count ?? 0;

    if (countError) {
      const errorMessage = formatCountError(countError);
      if (isUnclearCountError(errorMessage)) {
        console.warn("Courses count falhou sem detalhes. Usando fallback.", {
          page,
          perPage,
          hasEmpresaFilter: !!empresaId,
        });
        total = -1;
      } else {
        throw new Error(`Failed to count courses: ${errorMessage}`);
      }
    }

    // Get paginated data
    let dataQuery = this.client
      .from(TABLE)
      .select("*")
      .order(sortBy, { ascending: sortOrder })
      .range(from, to);
    if (empresaId) {
      dataQuery = dataQuery.eq("empresa_id", empresaId);
    }
    const { data, error } = await dataQuery;

    if (error) {
      throw new Error(`Failed to list courses: ${error.message}`);
    }

    if (total === -1) {
      const pageSizeFromData = (data ?? []).length;
      total = page > 1 ? from + pageSizeFromData : pageSizeFromData;
    }

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    const courses = await Promise.all(
      (data ?? []).map((row) => mapRow(row, this.client)),
    );

    return {
      data: courses,
      meta: {
        page,
        perPage,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<Curso | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch course: ${error.message}`);
    }

    return data ? await mapRow(data, this.client) : null;
  }

  async create(payload: CreateCursoInput): Promise<Curso> {
    // Determinar disciplineIds: usar disciplineIds se fornecido, senão usar disciplineId (compatibilidade)
    const disciplineIds =
      payload.disciplineIds ??
      (payload.disciplineId ? [payload.disciplineId] : []);

    const insertData: Record<string, unknown> = {
      empresa_id: payload.empresaId,
      segmento_id: payload.segmentId ?? null,
      disciplina_id: disciplineIds.length > 0 ? disciplineIds[0] : null, // Manter primeira disciplina para compatibilidade
      nome: payload.name,
      modalidade: payload.modality,
      modalidade_id: payload.modalityId ?? null,
      tipo: payload.type,
      descricao: payload.description ?? null,
      ano_vigencia: payload.year,
      data_inicio: payload.startDate ?? null,
      data_termino: payload.endDate ?? null,
      meses_acesso: payload.accessMonths ?? null,
      planejamento_url: payload.planningUrl ?? null,
      imagem_capa_url: payload.coverImageUrl ?? null,
      usa_turmas: payload.usaTurmas ?? false,
    };

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create course: ${error.message}`);
    }

    // Inserir relacionamentos de disciplinas
    if (disciplineIds.length > 0) {
      await this.setCourseDisciplines(data.id, disciplineIds);
    }

    // Inserir mapeamentos Hotmart (curso pode ter múltiplos IDs)
    const hotmartProductIds =
      payload.hotmartProductIds ??
      (payload.hotmartProductId ? [payload.hotmartProductId] : []);
    if (hotmartProductIds.length > 0) {
      await setCourseHotmartProductIdsInDb(this.client, {
        courseId: data.id,
        empresaId: payload.empresaId,
        hotmartProductIds,
      });
    }

    return await mapRow(data, this.client);
  }

  async update(id: string, payload: UpdateCursoInput): Promise<Curso> {
    const updateData: Record<string, unknown> = {};

    if (payload.segmentId !== undefined) {
      updateData.segmento_id = payload.segmentId;
    }

    // Se disciplineIds foi fornecido, usar ele; senão, se disciplineId foi fornecido, usar ele
    if (payload.disciplineIds !== undefined) {
      // Atualizar relacionamentos de disciplinas
      await this.setCourseDisciplines(id, payload.disciplineIds);
      // Atualizar disciplina_id para compatibilidade (primeira disciplina)
      updateData.disciplina_id =
        payload.disciplineIds.length > 0 ? payload.disciplineIds[0] : null;
    } else if (payload.disciplineId !== undefined) {
      updateData.disciplina_id = payload.disciplineId;
      // Atualizar relacionamentos também
      await this.setCourseDisciplines(
        id,
        payload.disciplineId ? [payload.disciplineId] : [],
      );
    }

    if (payload.name !== undefined) {
      updateData.nome = payload.name;
    }

    if (payload.modality !== undefined) {
      updateData.modalidade = payload.modality;
    }

    if (payload.modalityId !== undefined) {
      updateData.modalidade_id = payload.modalityId;
    }

    if (payload.type !== undefined) {
      updateData.tipo = payload.type;
    }

    if (payload.description !== undefined) {
      updateData.descricao = payload.description;
    }

    if (payload.year !== undefined) {
      updateData.ano_vigencia = payload.year;
    }

    if (payload.startDate !== undefined) {
      updateData.data_inicio = payload.startDate;
    }

    if (payload.endDate !== undefined) {
      updateData.data_termino = payload.endDate;
    }

    if (payload.accessMonths !== undefined) {
      updateData.meses_acesso = payload.accessMonths;
    }

    if (payload.planningUrl !== undefined) {
      updateData.planejamento_url = payload.planningUrl;
    }

    if (payload.coverImageUrl !== undefined) {
      updateData.imagem_capa_url = payload.coverImageUrl;
    }

    if (payload.usaTurmas !== undefined) {
      updateData.usa_turmas = payload.usaTurmas;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update course: ${error.message}`);
    }

    // Atualizar mapeamentos Hotmart
    // Prioridade: hotmartProductIds > hotmartProductId (legado)
    if (payload.hotmartProductIds !== undefined) {
      await setCourseHotmartProductIdsInDb(this.client, {
        courseId: id,
        empresaId: data.empresa_id,
        hotmartProductIds: payload.hotmartProductIds,
      });
    } else if (payload.hotmartProductId !== undefined) {
      await setCourseHotmartProductIdsInDb(this.client, {
        courseId: id,
        empresaId: data.empresa_id,
        hotmartProductIds: payload.hotmartProductId ? [payload.hotmartProductId] : [],
      });
    }

    return await mapRow(data, this.client);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete course: ${error.message}`);
    }
  }

  async segmentExists(segmentId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(SEGMENT_TABLE)
      .select("id")
      .eq("id", segmentId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check segment existence: ${error.message}`);
    }

    return !!data;
  }

  async disciplineExists(disciplineId: string): Promise<boolean> {
    const { data, error } = await this.client
      .from(DISCIPLINE_TABLE)
      .select("id")
      .eq("id", disciplineId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to check discipline existence: ${error.message}`);
    }

    return !!data;
  }

  async getExistingDisciplineIds(disciplineIds: string[]): Promise<string[]> {
    if (disciplineIds.length === 0) return [];

    const { data, error } = await this.client
      .from(DISCIPLINE_TABLE)
      .select("id")
      .in("id", disciplineIds);

    if (error) {
      throw new Error(
        `Failed to check disciplines existence: ${error.message}`,
      );
    }

    return (data ?? []).map((row) => row.id);
  }

  async setCourseDisciplines(
    courseId: string,
    disciplineIds: string[],
  ): Promise<void> {
    // Remover relacionamentos existentes
    const { error: deleteError } = await this.client
      .from(COURSE_DISCIPLINES_TABLE)
      .delete()
      .eq("curso_id", courseId);

    if (deleteError) {
      throw new Error(
        `Failed to remove course disciplines: ${deleteError.message}`,
      );
    }

    // Inserir novos relacionamentos
    if (disciplineIds.length > 0) {
      const insertData = disciplineIds.map((disciplinaId) => ({
        curso_id: courseId,
        disciplina_id: disciplinaId,
      }));

      const { error: insertError } = await this.client
        .from(COURSE_DISCIPLINES_TABLE)
        .insert(insertData);

      if (insertError) {
        throw new Error(
          `Failed to set course disciplines: ${insertError.message}`,
        );
      }
    }
  }

  async getCourseDisciplines(courseId: string): Promise<string[]> {
    return getCourseDisciplinesFromDb(courseId, this.client);
  }

  async findByEmpresa(empresaId: string): Promise<Curso[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nome", { ascending: true });

    if (error) {
      throw new Error(`Failed to list courses by empresa: ${error.message}`);
    }

    return Promise.all((data ?? []).map((row) => mapRow(row, this.client)));
  }
}
