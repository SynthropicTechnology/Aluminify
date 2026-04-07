import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/shared/core/database.types";
import type {
  Coupon,
  CreateCouponInput,
  UpdateCouponInput,
  DiscountType,
} from "./financial.types";

import type { PaginationMeta } from "@/app/shared/types/dtos/api-responses";

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CouponListParams {
  empresaId: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "code" | "created_at" | "valid_until";
  sortOrder?: "asc" | "desc";
}

export interface CouponRepository {
  list(params: CouponListParams): Promise<PaginatedResult<Coupon>>;
  findById(id: string): Promise<Coupon | null>;
  findByCode(empresaId: string, code: string): Promise<Coupon | null>;
  create(payload: CreateCouponInput): Promise<Coupon>;
  update(id: string, payload: UpdateCouponInput): Promise<Coupon>;
  delete(id: string): Promise<void>;
  incrementUse(id: string): Promise<Coupon>;
}

const TABLE = "coupons";

type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];
type CouponInsert = Database["public"]["Tables"]["coupons"]["Insert"];
type CouponUpdate = Database["public"]["Tables"]["coupons"]["Update"];

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
function mapRow(row: CouponRow): Coupon {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    code: row.code,
    description: row.description,
    discountType: row.discount_type as DiscountType,
    discountValue: row.discount_value,
    maxUses: row.max_uses,
    currentUses: row.current_uses,
    validFrom: new Date(row.valid_from),
    validUntil: row.valid_until ? new Date(row.valid_until) : null,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Map domain input to database insert
 */
function mapToInsert(input: CreateCouponInput): CouponInsert {
  return {
    empresa_id: input.empresaId,
    code: input.code.toUpperCase(),
    description: input.description ?? null,
    discount_type: input.discountType ?? "percentage",
    discount_value: input.discountValue,
    max_uses: input.maxUses ?? null,
    current_uses: 0,
    valid_from: input.validFrom?.toISOString() ?? new Date().toISOString(),
    valid_until: input.validUntil?.toISOString() ?? null,
    active: input.active ?? true,
  };
}

/**
 * Map domain input to database update
 */
function mapToUpdate(input: UpdateCouponInput): CouponUpdate {
  const update: CouponUpdate = {};

  if (input.code !== undefined) update.code = input.code.toUpperCase();
  if (input.description !== undefined) update.description = input.description;
  if (input.discountType !== undefined) update.discount_type = input.discountType;
  if (input.discountValue !== undefined) update.discount_value = input.discountValue;
  if (input.maxUses !== undefined) update.max_uses = input.maxUses;
  if (input.validFrom !== undefined) update.valid_from = input.validFrom?.toISOString();
  if (input.validUntil !== undefined) update.valid_until = input.validUntil?.toISOString() ?? null;
  if (input.active !== undefined) update.active = input.active;

  return update;
}

export class CouponRepositoryImpl implements CouponRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(params: CouponListParams): Promise<PaginatedResult<Coupon>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const sortBy = params.sortBy ?? "code";
    const sortOrder = params.sortOrder === "desc" ? false : true;

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Count query
    let countQuery = this.client
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", params.empresaId);

    if (params.active !== undefined) countQuery = countQuery.eq("active", params.active);

    const { count, error: countError } = await countQuery;
    let total = count ?? 0;

    if (countError) {
      const errorMessage = formatSupabaseError(countError);
      if (isUnclearCountError(errorMessage)) {
        console.warn("Coupons count falhou sem detalhes. Usando fallback.", {
          page,
          pageSize,
          empresaId: params.empresaId,
        });
        total = -1;
      } else {
        throw new Error(`Failed to count coupons: ${errorMessage}`);
      }
    }

    // Data query
    let dataQuery = this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", params.empresaId)
      .order(sortBy, { ascending: sortOrder })
      .range(from, to);

    if (params.active !== undefined) dataQuery = dataQuery.eq("active", params.active);

    const { data, error } = await dataQuery;

    if (error) {
      throw new Error(`Failed to list coupons: ${formatSupabaseError(error)}`);
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

  async findById(id: string): Promise<Coupon | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to find coupon: ${formatSupabaseError(error)}`);
    }

    return data ? mapRow(data) : null;
  }

  async findByCode(empresaId: string, code: string): Promise<Coupon | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("code", code.toUpperCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to find coupon: ${formatSupabaseError(error)}`);
    }

    return data ? mapRow(data) : null;
  }

  async create(payload: CreateCouponInput): Promise<Coupon> {
    const insert = mapToInsert(payload);

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create coupon: ${formatSupabaseError(error)}`);
    }

    return mapRow(data);
  }

  async update(id: string, payload: UpdateCouponInput): Promise<Coupon> {
    const update = mapToUpdate(payload);

    const { data, error } = await this.client
      .from(TABLE)
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update coupon: ${formatSupabaseError(error)}`);
    }

    return mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete coupon: ${formatSupabaseError(error)}`);
    }
  }

  async incrementUse(id: string): Promise<Coupon> {
    // Get current coupon
    const coupon = await this.findById(id);
    if (!coupon) {
      throw new Error("Coupon not found");
    }

    // Check if max uses reached
    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      throw new Error("Coupon max uses reached");
    }

    // Increment
    const { data, error } = await this.client
      .from(TABLE)
      .update({ current_uses: coupon.currentUses + 1 })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to increment coupon use: ${formatSupabaseError(error)}`);
    }

    return mapRow(data);
  }

  /**
   * Validate if coupon can be used
   */
  async validateCoupon(empresaId: string, code: string): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
    const coupon = await this.findByCode(empresaId, code);

    if (!coupon) {
      return { valid: false, error: "Cupom não encontrado" };
    }

    if (!coupon.active) {
      return { valid: false, error: "Cupom inativo" };
    }

    const now = new Date();
    if (coupon.validFrom > now) {
      return { valid: false, error: "Cupom ainda não é válido" };
    }

    if (coupon.validUntil && coupon.validUntil < now) {
      return { valid: false, error: "Cupom expirado" };
    }

    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      return { valid: false, error: "Cupom atingiu o limite de uso" };
    }

    return { valid: true, coupon };
  }
}

/**
 * Factory function to create a CouponRepository instance
 */
export function createCouponRepository(client: SupabaseClient): CouponRepository {
  return new CouponRepositoryImpl(client);
}
