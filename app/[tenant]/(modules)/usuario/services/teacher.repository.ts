/**
 * Teacher Repository
 *
 * Provides data access methods for the usuarios table with full type safety.
 *
 * Type Safety Patterns:
 * - Uses generated Database types from lib/database.types.ts
 * - Insert operations use TeacherInsert type (enforces required fields)
 * - Update operations use TeacherUpdate type (all fields optional)
 * - Query results are properly typed (not 'never')
 *
 * Example Usage:
 * ```typescript
 * const repository = new TeacherRepositoryImpl(client);
 *
 * // Create with type-safe insert
 * const teacher = await repository.create({
 *   id: userId,
 *   empresaId: 'empresa-123',
 *   fullName: 'John Doe',
 *   email: 'john@example.com',
 *   // Optional fields can be omitted
 * });
 *
 * // Update with partial data
 * const updated = await repository.update(teacherId, {
 *   phone: '+55 11 98765-4321',
 *   // Only include fields to update
 * });
 * ```
 *
 * For detailed documentation, see: docs/TYPESCRIPT_SUPABASE_GUIDE.md
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  Teacher,
  CreateTeacherInput,
  UpdateTeacherInput,
} from "./teacher.types";
import type {
  PaginationParams,
  PaginationMeta,
} from "@/app/shared/types/dtos/api-responses";
import type { Database } from "@/app/shared/core/database.types";

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface TeacherRepository {
  list(params?: PaginationParams): Promise<PaginatedResult<Teacher>>;
  findById(id: string): Promise<Teacher | null>;
  findByEmail(email: string): Promise<Teacher | null>;
  findByCpf(cpf: string): Promise<Teacher | null>;
  create(payload: CreateTeacherInput): Promise<Teacher>;
  update(id: string, payload: UpdateTeacherInput): Promise<Teacher>;
  delete(id: string): Promise<void>;
  findByEmpresa(empresaId: string): Promise<Teacher[]>;
  setAsAdmin(teacherId: string, isAdmin: boolean): Promise<void>;
}

const TABLE = "usuarios";

/**
 * Database Type Aliases
 *
 * These types are extracted from the generated Database interface and provide
 * type safety for all database operations.
 *
 * - TeacherRow: Complete row returned by SELECT queries
 * - TeacherInsert: Type for INSERT operations (required + optional fields)
 * - TeacherUpdate: Type for UPDATE operations (all fields optional)
 *
 * Benefits:
 * - Types automatically stay in sync with database schema
 * - No manual type maintenance required
 * - Compile-time validation of column names and types
 *
 * @example
 * ```typescript
 * // Insert requires all non-nullable fields without defaults
 * const insertData: TeacherInsert = {
 *   id: userId,              // Required
 *   empresa_id: empresaId,   // Required
 *   nome_completo: 'John',   // Required
 *   email: 'john@test.com',  // Required
 *   cpf: null,               // Optional (nullable)
 * };
 *
 * // Update allows partial updates (all fields optional)
 * const updateData: TeacherUpdate = {
 *   telefone: '+55 11 98765-4321', // Only update phone
 * };
 * ```
 */
type TeacherRow = Database["public"]["Tables"]["usuarios"]["Row"];
type TeacherInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
type TeacherUpdate = Database["public"]["Tables"]["usuarios"]["Update"];

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

function mapRow(row: TeacherRow): Teacher {
  return {
    id: row.id,
    empresaId: row.empresa_id ?? "",
    isAdmin: false, // Admin status determined from usuarios_empresas
    fullName: row.nome_completo,
    email: row.email,
    cpf: row.cpf,
    phone: row.telefone,
    pixKey: row.chave_pix,
    biography: row.biografia,
    photoUrl: row.foto_url,
    specialty: row.especialidade,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class TeacherRepositoryImpl implements TeacherRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async list(params?: PaginationParams): Promise<PaginatedResult<Teacher>> {
    const page = params?.page ?? 1;
    const perPage = params?.perPage ?? 50;
    const sortBy = params?.sortBy ?? "nome_completo";
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
        console.warn("Teachers count falhou sem detalhes. Usando fallback.", {
          page,
          perPage,
        });
        total = -1;
      } else {
        throw new Error(`Failed to count teachers: ${errorMessage}`);
      }
    }

    // Get paginated data
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .order(sortBy, { ascending: sortOrder })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to list teachers: ${error.message}`);
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

  async findById(id: string): Promise<Teacher | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch teacher: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async findByEmail(email: string): Promise<Teacher | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch teacher by email: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async findByCpf(cpf: string): Promise<Teacher | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("cpf", cpf)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch teacher by CPF: ${error.message}`);
    }

    return data ? mapRow(data) : null;
  }

  async create(payload: CreateTeacherInput): Promise<Teacher> {
    /**
     * Type-Safe Insert Operation
     *
     * The TeacherInsert type enforces:
     * - Required fields: id, empresa_id, nome_completo, email
     * - Optional fields: cpf, telefone, biografia, foto_url, especialidade
     * - Nullable fields can be set to null or omitted
     *
     * TypeScript will show compile errors if:
     * - Required fields are missing
     * - Field types don't match the schema
     * - Invalid field names are used
     */
    const insertData: TeacherInsert = {
      id: payload.id ?? "", // ID is required (comes from auth.users)
      nome_completo: payload.fullName,
      email: payload.email.toLowerCase(),
      empresa_id: payload.empresaId as string,
      cpf: payload.cpf ?? null,
      telefone: payload.phone ?? null,
      chave_pix: payload.pixKey ?? null,
      biografia: payload.biography ?? null,
      foto_url: payload.photoUrl ?? null,
      especialidade: payload.specialty ?? null,
    };

    // Validate ID is provided
    if (!insertData.id) {
      throw new Error(
        "Teacher ID is required. User must be created in auth.users first.",
      );
    }

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insertData)
      .select("*")
      .single();

    // Create usuarios_empresas binding for this teacher
    if (data) {
      await this.client
        .from("usuarios_empresas")
        .upsert(
          {
            usuario_id: data.id,
            empresa_id: insertData.empresa_id,
            papel_base: "professor",
            is_admin: payload.isAdmin ?? false,
            ativo: true,
          },
          { onConflict: "usuario_id,empresa_id,papel_base" },
        )
        .then(({ error: vinculoError }) => {
          if (vinculoError) {
            console.error(
              "[TeacherRepo] Failed to create usuarios_empresas binding:",
              vinculoError,
            );
          }
        });
    }

    if (error) {
      throw new Error(`Failed to create teacher: ${error.message}`);
    }

    return mapRow(data);
  }

  async update(id: string, payload: UpdateTeacherInput): Promise<Teacher> {
    /**
     * Type-Safe Update Operation
     *
     * The TeacherUpdate type makes all fields optional, allowing partial updates.
     *
     * Best Practices:
     * - Only include fields that need to be updated
     * - Use null to explicitly clear nullable fields
     * - Use undefined to skip fields (they won't be updated)
     *
     * Example:
     * ```typescript
     * // Update only phone and clear biography
     * const updateData: TeacherUpdate = {
     *   telefone: '+55 11 98765-4321',
     *   biografia: null, // Explicitly clear
     *   // Other fields are not included, so they won't be updated
     * };
     * ```
     */
    const updateData: TeacherUpdate = {};

    if (payload.fullName !== undefined) {
      updateData.nome_completo = payload.fullName;
    }

    if (payload.email !== undefined) {
      updateData.email = payload.email.toLowerCase();
    }

    if (payload.cpf !== undefined) {
      updateData.cpf = payload.cpf;
    }

    if (payload.phone !== undefined) {
      updateData.telefone = payload.phone;
    }

    if (payload.pixKey !== undefined) {
      updateData.chave_pix = payload.pixKey;
    }

    if (payload.biography !== undefined) {
      updateData.biografia = payload.biography;
    }

    if (payload.photoUrl !== undefined) {
      updateData.foto_url = payload.photoUrl;
    }

    if (payload.specialty !== undefined) {
      updateData.especialidade = payload.specialty;
    }

    const { data, error } = await this.client
      .from(TABLE)
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update teacher: ${error.message}`);
    }

    return mapRow(data);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq("id", id);

    if (error) {
      throw new Error(`Failed to delete teacher: ${error.message}`);
    }
  }

  async findByEmpresa(empresaId: string): Promise<Teacher[]> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nome_completo", { ascending: true });

    if (error) {
      throw new Error(`Failed to list teachers by empresa: ${error.message}`);
    }

    return (data ?? []).map(mapRow);
  }

  async setAsAdmin(teacherId: string, isAdmin: boolean): Promise<void> {
    const { error } = await this.client
      .from("usuarios_empresas")
      .update({ is_admin: isAdmin })
      .eq("usuario_id", teacherId);

    if (error) {
      throw new Error(
        `Failed to update teacher admin status: ${error.message}`,
      );
    }
  }
}
