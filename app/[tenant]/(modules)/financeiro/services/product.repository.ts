import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/app/shared/core/database.types";
import type {
  Product,
  CreateProductInput,
  UpdateProductInput,
  Provider,
} from "./financial.types";

import type { PaginationMeta } from "@/app/shared/types/dtos/api-responses";

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ProductListParams {
  empresaId: string;
  cursoId?: string;
  provider?: Provider;
  active?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "name" | "price_cents" | "created_at";
  sortOrder?: "asc" | "desc";
}

export interface ProductRepository {
  list(params: ProductListParams): Promise<PaginatedResult<Product>>;
  findById(id: string): Promise<Product | null>;
  findByProviderProductId(
    empresaId: string,
    provider: Provider,
    providerProductId: string
  ): Promise<Product | null>;
  create(payload: CreateProductInput): Promise<Product>;
  update(id: string, payload: UpdateProductInput): Promise<Product>;
  delete(id: string): Promise<void>;
}

const TABLE = "products";

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];

function formatSupabaseError(error: unknown): string {
  if (!error) return "Unknown error (empty)";
  if (error instanceof Error) return error.message || "Error without message";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    const code = e.code ? `[${String(e.code)}]` : "";
    const message =
      typeof e.message === "string" && e.message.trim()
        ? e.message
        : typeof e.error === "string" && e.error.trim()
          ? e.error
          : "";
    const details = e.details ? ` Details: ${String(e.details)}` : "";
    const hint = e.hint ? ` Hint: ${String(e.hint)}` : "";

    if (code || message || details || hint) {
      return `${[code, message].filter(Boolean).join(" ")}${details}${hint}`.trim();
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown error (non-serializable object)";
    }
  }
  return String(error);
}

function isUnclearCountError(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return true;
  if (
    normalized.includes("sem mensagem") ||
    normalized.includes("vazio") ||
    normalized.includes("unknown error") ||
    normalized.includes("empty")
  ) {
    return true;
  }
  return /"message"\s*:\s*""/i.test(message);
}

/**
 * Map database row to domain object
 */
function mapRow(row: ProductRow): Product {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    cursoId: row.curso_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    provider: row.provider as Provider,
    providerProductId: row.provider_product_id,
    providerOfferId: row.provider_offer_id,
    active: row.active,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Map domain input to database insert
 */
function mapToInsert(input: CreateProductInput): ProductInsert {
  return {
    empresa_id: input.empresaId,
    curso_id: input.cursoId ?? null,
    name: input.name,
    description: input.description ?? null,
    price_cents: input.priceCents,
    currency: input.currency ?? "BRL",
    provider: input.provider ?? "internal",
    provider_product_id: input.providerProductId ?? null,
    provider_offer_id: input.providerOfferId ?? null,
    active: input.active ?? true,
    metadata: (input.metadata ?? {}) as Json,
  };
}

/**
 * Map domain input to database update
 */
function mapToUpdate(input: UpdateProductInput): ProductUpdate {
  const update: ProductUpdate = {};

  if (input.cursoId !== undefined) update.curso_id = input.cursoId;
  if (input.name !== undefined) update.name = input.name;
  if (input.description !== undefined) update.description = input.description;
  if (input.priceCents !== undefined) update.price_cents = input.priceCents;
  if (input.currency !== undefined) update.currency = input.currency;
  if (input.providerProductId !== undefined) update.provider_product_id = input.providerProductId;
  if (input.providerOfferId !== undefined) update.provider_offer_id = input.providerOfferId;
  if (input.active !== undefined) update.active = input.active;
  if (input.metadata !== undefined) update.metadata = input.metadata as Json;

  return update;
}

export class ProductRepositoryImpl implements ProductRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(params: ProductListParams): Promise<PaginatedResult<Product>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const sortBy = params.sortBy ?? "name";
    const sortOrder = params.sortOrder === "desc" ? false : true;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Count query
    let countQuery = this.client
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", params.empresaId);

    if (params.cursoId) countQuery = countQuery.eq("curso_id", params.cursoId);
    if (params.provider) countQuery = countQuery.eq("provider", params.provider);
    if (params.active !== undefined) countQuery = countQuery.eq("active", params.active);

    const { count, error: countError } = await countQuery;
    let total = count ?? 0;

    if (countError) {
      const errorMessage = formatSupabaseError(countError);
      if (isUnclearCountError(errorMessage)) {
        console.warn("Products count falhou sem detalhes. Usando fallback.", {
          page,
          pageSize,
          empresaId: params.empresaId,
        });
        total = -1;
      } else {
        throw new Error(`Failed to count products: ${errorMessage}`);
      }
    }

    // Data query
    let dataQuery = this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", params.empresaId)
      .order(sortBy, { ascending: sortOrder })
      .range(from, to);

    if (params.cursoId) dataQuery = dataQuery.eq("curso_id", params.cursoId);
    if (params.provider) dataQuery = dataQuery.eq("provider", params.provider);
    if (params.active !== undefined) dataQuery = dataQuery.eq("active", params.active);

    const { data, error } = await dataQuery;

    if (error) {
      throw new Error(`Failed to list products: ${formatSupabaseError(error)}`);
    }

    if (total === -1) {
      const pageSizeFromData = (data ?? []).length;
      total = page > 1 ? from + pageSizeFromData : pageSizeFromData;
    }
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: (data || []).map(mapRow),
      meta: {
        page,
        perPage: pageSize,
        total,
        totalPages,
      },
    };
  }

  async findById(id: string): Promise<Product | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to find product: ${formatSupabaseError(error)}`);
    }

    return data ? mapRow(data) : null;
  }

  async findByProviderProductId(
    empresaId: string,
    provider: Provider,
    providerProductId: string
  ): Promise<Product | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .eq("provider_product_id", providerProductId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to find product: ${formatSupabaseError(error)}`);
    }

    return data ? mapRow(data) : null;
  }

  async create(payload: CreateProductInput): Promise<Product> {
    const insert = mapToInsert(payload);

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create product: ${formatSupabaseError(error)}`);
    }

    return mapRow(data);
  }

  async update(id: string, payload: UpdateProductInput): Promise<Product> {
    const update = mapToUpdate(payload);

    const { data, error } = await this.client
      .from(TABLE)
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product: ${formatSupabaseError(error)}`);
    }

    return mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete product: ${formatSupabaseError(error)}`);
    }
  }

  /**
   * Upsert product by provider product ID (for sync operations)
   */
  async upsertByProviderProductId(
    payload: CreateProductInput
  ): Promise<{ product: Product; created: boolean }> {
    if (!payload.providerProductId) {
      const product = await this.create(payload);
      return { product, created: true };
    }

    const existing = await this.findByProviderProductId(
      payload.empresaId,
      payload.provider ?? "internal",
      payload.providerProductId
    );

    if (existing) {
      const product = await this.update(existing.id, {
        name: payload.name,
        description: payload.description,
        priceCents: payload.priceCents,
        cursoId: payload.cursoId,
        providerOfferId: payload.providerOfferId,
        active: payload.active,
        metadata: payload.metadata,
      });
      return { product, created: false };
    }

    const product = await this.create(payload);
    return { product, created: true };
  }
}

/**
 * Factory function to create a ProductRepository instance
 */
export function createProductRepository(client: SupabaseClient): ProductRepository {
  return new ProductRepositoryImpl(client);
}
