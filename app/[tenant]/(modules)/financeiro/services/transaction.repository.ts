import { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/app/shared/core/database.types";
import type {
  Transaction,
  CreateTransactionInput,
  UpdateTransactionInput,
  TransactionStats,
  TransactionListParams,
  TransactionStatus,
  Provider,
} from "./financial.types";

import type { PaginationMeta } from "@/app/shared/types/dtos/api-responses";

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface TransactionRepository {
  list(params: TransactionListParams): Promise<PaginatedResult<Transaction>>;
  findById(id: string): Promise<Transaction | null>;
  findByProviderTransactionId(
    empresaId: string,
    provider: Provider,
    providerTxId: string
  ): Promise<Transaction | null>;
  create(payload: CreateTransactionInput): Promise<Transaction>;
  update(id: string, payload: UpdateTransactionInput): Promise<Transaction>;
  getStats(empresaId: string, dateFrom?: Date, dateTo?: Date): Promise<TransactionStats>;
  upsertByProviderTransactionId(
    payload: CreateTransactionInput
  ): Promise<{ transaction: Transaction; created: boolean }>;
}

const TABLE = "transactions";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];
type TransactionUpdate = Database["public"]["Tables"]["transactions"]["Update"];

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
function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    empresaId: row.empresa_id,
    alunoId: row.usuario_id,
    productId: row.product_id,
    couponId: row.coupon_id,
    provider: row.provider as Provider,
    providerTransactionId: row.provider_transaction_id,
    status: row.status as TransactionStatus,
    amountCents: row.amount_cents,
    currency: row.currency,
    paymentMethod: row.payment_method as Transaction["paymentMethod"],
    installments: row.installments,
    buyerEmail: row.buyer_email,
    buyerName: row.buyer_name,
    buyerDocument: row.buyer_document,
    providerData: (row.provider_data as Record<string, unknown>) ?? {},
    saleDate: new Date(row.sale_date),
    confirmationDate: row.confirmation_date ? new Date(row.confirmation_date) : null,
    refundDate: row.refund_date ? new Date(row.refund_date) : null,
    refundAmountCents: row.refund_amount_cents,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Map domain input to database insert
 */
function mapToInsert(input: CreateTransactionInput): TransactionInsert {
  return {
    empresa_id: input.empresaId,
    usuario_id: input.alunoId ?? null,
    product_id: input.productId ?? null,
    coupon_id: input.couponId ?? null,
    provider: input.provider ?? "manual",
    provider_transaction_id: input.providerTransactionId ?? null,
    status: input.status ?? "pending",
    amount_cents: input.amountCents,
    currency: input.currency ?? "BRL",
    payment_method: input.paymentMethod ?? null,
    installments: input.installments ?? 1,
    buyer_email: input.buyerEmail,
    buyer_name: input.buyerName ?? null,
    buyer_document: input.buyerDocument ?? null,
    provider_data: (input.providerData ?? {}) as Json,
    sale_date: input.saleDate?.toISOString() ?? new Date().toISOString(),
    confirmation_date: input.confirmationDate?.toISOString() ?? null,
  };
}

/**
 * Map domain input to database update
 */
function mapToUpdate(input: UpdateTransactionInput): TransactionUpdate {
  const update: TransactionUpdate = {};

  if (input.alunoId !== undefined) update.usuario_id = input.alunoId;
  if (input.productId !== undefined) update.product_id = input.productId;
  if (input.couponId !== undefined) update.coupon_id = input.couponId;
  if (input.status !== undefined) update.status = input.status;
  if (input.amountCents !== undefined) update.amount_cents = input.amountCents;
  if (input.paymentMethod !== undefined) update.payment_method = input.paymentMethod;
  if (input.installments !== undefined) update.installments = input.installments;
  if (input.buyerName !== undefined) update.buyer_name = input.buyerName;
  if (input.buyerDocument !== undefined) update.buyer_document = input.buyerDocument;
  if (input.providerData !== undefined) update.provider_data = input.providerData as Json;
  if (input.confirmationDate !== undefined) {
    update.confirmation_date = input.confirmationDate?.toISOString() ?? null;
  }
  if (input.refundDate !== undefined) {
    update.refund_date = input.refundDate?.toISOString() ?? null;
  }
  if (input.refundAmountCents !== undefined) {
    update.refund_amount_cents = input.refundAmountCents;
  }

  return update;
}

export class TransactionRepositoryImpl implements TransactionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(params: TransactionListParams): Promise<PaginatedResult<Transaction>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const sortBy = params.sortBy ?? "sale_date";
    const sortOrder = params.sortOrder === "asc";

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Count query
    let countQuery = this.client
      .from(TABLE)
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", params.empresaId);

    // Apply filters to count
    if (params.status) countQuery = countQuery.eq("status", params.status);
    if (params.provider) countQuery = countQuery.eq("provider", params.provider);
    if (params.productId) countQuery = countQuery.eq("product_id", params.productId);
    if (params.alunoId) countQuery = countQuery.eq("usuario_id", params.alunoId);
    if (params.buyerEmail) countQuery = countQuery.ilike("buyer_email", `%${params.buyerEmail}%`);
    if (params.dateFrom) countQuery = countQuery.gte("sale_date", params.dateFrom.toISOString());
    if (params.dateTo) countQuery = countQuery.lte("sale_date", params.dateTo.toISOString());

    const { count, error: countError } = await countQuery;
    let total = count ?? 0;

    if (countError) {
      const errorMessage = formatSupabaseError(countError);
      if (isUnclearCountError(errorMessage)) {
        console.warn("Transactions count falhou sem detalhes. Usando fallback.", {
          page,
          pageSize,
          empresaId: params.empresaId,
        });
        total = -1;
      } else {
        throw new Error(`Failed to count transactions: ${errorMessage}`);
      }
    }

    // Data query
    let dataQuery = this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", params.empresaId)
      .order(sortBy, { ascending: sortOrder })
      .range(from, to);

    // Apply filters to data
    if (params.status) dataQuery = dataQuery.eq("status", params.status);
    if (params.provider) dataQuery = dataQuery.eq("provider", params.provider);
    if (params.productId) dataQuery = dataQuery.eq("product_id", params.productId);
    if (params.alunoId) dataQuery = dataQuery.eq("usuario_id", params.alunoId);
    if (params.buyerEmail) dataQuery = dataQuery.ilike("buyer_email", `%${params.buyerEmail}%`);
    if (params.dateFrom) dataQuery = dataQuery.gte("sale_date", params.dateFrom.toISOString());
    if (params.dateTo) dataQuery = dataQuery.lte("sale_date", params.dateTo.toISOString());

    const { data, error } = await dataQuery;

    if (error) {
      throw new Error(`Failed to list transactions: ${formatSupabaseError(error)}`);
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

  async findById(id: string): Promise<Transaction | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to find transaction: ${formatSupabaseError(error)}`);
    }

    return data ? mapRow(data) : null;
  }

  async findByProviderTransactionId(
    empresaId: string,
    provider: Provider,
    providerTxId: string
  ): Promise<Transaction | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("provider", provider)
      .eq("provider_transaction_id", providerTxId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to find transaction: ${formatSupabaseError(error)}`);
    }

    return data ? mapRow(data) : null;
  }

  async create(payload: CreateTransactionInput): Promise<Transaction> {
    const insert = mapToInsert(payload);

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insert)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create transaction: ${formatSupabaseError(error)}`);
    }

    return mapRow(data);
  }

  async update(id: string, payload: UpdateTransactionInput): Promise<Transaction> {
    const update = mapToUpdate(payload);

    const { data, error } = await this.client
      .from(TABLE)
      .update(update)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update transaction: ${formatSupabaseError(error)}`);
    }

    return mapRow(data);
  }

  async getStats(
    empresaId: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<TransactionStats> {
    let query = this.client
      .from(TABLE)
      .select("status, amount_cents, payment_method")
      .eq("empresa_id", empresaId)
      .eq("status", "approved");

    if (dateFrom) query = query.gte("sale_date", dateFrom.toISOString());
    if (dateTo) query = query.lte("sale_date", dateTo.toISOString());

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get transaction stats: ${formatSupabaseError(error)}`);
    }

    const transactions = data || [];

    // Calculate stats
    const totalAmountCents = transactions.reduce((sum, t) => sum + t.amount_cents, 0);
    const transactionCount = transactions.length;
    const averageTicketCents = transactionCount > 0 ? Math.round(totalAmountCents / transactionCount) : 0;

    // Count by payment method
    const byPaymentMethod: Record<string, number> = {};
    transactions.forEach((t) => {
      const method = t.payment_method || "unknown";
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + 1;
    });

    // For status breakdown, we need a separate query
    const { data: statusData, error: statusError } = await this.client
      .from(TABLE)
      .select("status")
      .eq("empresa_id", empresaId);

    if (statusError) {
      throw new Error(`Failed to get transaction status stats: ${formatSupabaseError(statusError)}`);
    }

    const byStatus: Record<TransactionStatus, number> = {
      pending: 0,
      approved: 0,
      cancelled: 0,
      refunded: 0,
      disputed: 0,
      chargeback: 0,
    };

    (statusData || []).forEach((t) => {
      const status = t.status as TransactionStatus;
      if (byStatus[status] !== undefined) {
        byStatus[status]++;
      }
    });

    return {
      totalAmountCents,
      transactionCount,
      averageTicketCents,
      byStatus,
      byPaymentMethod,
    };
  }

  /**
   * Create or update a transaction based on provider transaction ID (upsert)
   * Used for idempotent webhook handling
   */
  async upsertByProviderTransactionId(
    payload: CreateTransactionInput
  ): Promise<{ transaction: Transaction; created: boolean }> {
    if (!payload.providerTransactionId) {
      const transaction = await this.create(payload);
      return { transaction, created: true };
    }

    const existing = await this.findByProviderTransactionId(
      payload.empresaId,
      payload.provider ?? "manual",
      payload.providerTransactionId
    );

    if (existing) {
      const transaction = await this.update(existing.id, {
        status: payload.status,
        alunoId: payload.alunoId,
        productId: payload.productId,
        amountCents: payload.amountCents,
        paymentMethod: payload.paymentMethod,
        installments: payload.installments,
        buyerName: payload.buyerName,
        buyerDocument: payload.buyerDocument,
        providerData: payload.providerData,
        confirmationDate: payload.confirmationDate,
      });
      return { transaction, created: false };
    }

    const transaction = await this.create(payload);
    return { transaction, created: true };
  }
}

/**
 * Factory function to create a TransactionRepository instance
 */
export function createTransactionRepository(
  client: SupabaseClient
): TransactionRepository {
  return new TransactionRepositoryImpl(client);
}
