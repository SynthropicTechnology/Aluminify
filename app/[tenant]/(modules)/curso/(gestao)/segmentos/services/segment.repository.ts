import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/shared/core/database.types";
import {
  Segment,
  CreateSegmentInput,
  UpdateSegmentInput,
} from "./segment.types";
import type {
  PaginationParams,
  PaginationMeta,
} from "@/app/shared/types/dtos/api-responses";

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SegmentRepository {
  list(params?: PaginationParams): Promise<PaginatedResult<Segment>>;
  findById(id: string): Promise<Segment | null>;
  findByName(name: string, empresaId?: string): Promise<Segment | null>;
  findBySlug(slug: string, empresaId?: string): Promise<Segment | null>;
  create(payload: CreateSegmentInput): Promise<Segment>;
  update(id: string, payload: UpdateSegmentInput): Promise<Segment>;
  delete(id: string): Promise<void>;
}

const TABLE = "segmentos";

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

// Use generated Database types instead of manual definitions
type SegmentRow = Database["public"]["Tables"]["segmentos"]["Row"];
type SegmentInsert = Database["public"]["Tables"]["segmentos"]["Insert"];
type SegmentUpdate = Database["public"]["Tables"]["segmentos"]["Update"];

function mapRow(row: SegmentRow): Segment {
  return {
    id: row.id,
    name: row.nome,
    slug: row.slug,
    empresaId: row.empresa_id,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SegmentRepositoryImpl implements SegmentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(params?: PaginationParams): Promise<PaginatedResult<Segment>> {
    const page = params?.page ?? 1;
    const perPage = params?.perPage ?? 50;
    const sortBy = params?.sortBy ?? "nome";
    const sortOrder = params?.sortOrder === "desc" ? false : true;

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Get total count
    const { count, error: countError } = await this.client
      .from(TABLE)
      .select("*", { count: "exact", head: true });

    let total = count ?? 0;
    if (countError) {
      const errorMessage = formatCountError(countError);
      if (isUnclearCountError(errorMessage)) {
        console.warn("Segments count falhou sem detalhes. Usando fallback.", {
          page,
          perPage,
        });
        total = -1;
      } else {
        throw new Error(`Failed to count segments: ${errorMessage}`);
      }
    }

    // Get paginated data
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .order(sortBy, { ascending: sortOrder })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to list segments: ${error.message}`);
    }

    if (total === -1) {
      const pageSizeFromData = (data ?? []).length;
      total = page > 1 ? from + pageSizeFromData : pageSizeFromData;
    }

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    return {
      data: (data ?? []).map(mapRow),
      meta: {
        page,
        perPage,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<Segment | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch segment: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async findByName(name: string, empresaId?: string): Promise<Segment | null> {
    let query = this.client.from(TABLE).select("*").eq("nome", name);

    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    // Limit 1 to prevent generic error if multiple rows exist (duplicate data)
    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch segment by name: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async findBySlug(slug: string, empresaId?: string): Promise<Segment | null> {
    let query = this.client.from(TABLE).select("*").eq("slug", slug);

    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    // Limit 1 to prevent generic error if multiple rows exist (duplicate data)
    const { data, error } = await query.limit(1).maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch segment by slug: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async create(payload: CreateSegmentInput): Promise<Segment> {
    const insertData: SegmentInsert = {
      nome: payload.name,
      slug: payload.slug ?? null,
      empresa_id: payload.empresaId,
      created_by: payload.createdBy,
    };

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create segment: ${error.message}`);
    }

    return mapRow(data);
  }

  async update(id: string, payload: UpdateSegmentInput): Promise<Segment> {
    const updateData: SegmentUpdate = {};

    if (payload.name !== undefined) {
      updateData.nome = payload.name;
    }

    if (payload.slug !== undefined) {
      updateData.slug = payload.slug;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update segment: ${error.message}`);
    }

    return mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete segment: ${error.message}`);
    }
  }
}
