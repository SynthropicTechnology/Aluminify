import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/app/shared/core/database.types";
import { fetchAllRows } from "@/app/shared/core/database/fetch-all-rows";
import {
  Student,
  CreateStudentInput,
  UpdateStudentInput,
  StudentCourseSummary,
} from "./student.types";

import type {
  PaginationParams,
  PaginationMeta,
} from "@/app/shared/types/dtos/api-responses";

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface StudentRepository {
  list(params?: PaginationParams): Promise<PaginatedResult<Student>>;
  findById(id: string): Promise<Student | null>;
  findByEmail(email: string): Promise<Student | null>;
  findByEmailIncludingDeleted(email: string): Promise<Student | null>;
  restoreSoftDeleted(id: string): Promise<void>;
  findByCpf(cpf: string): Promise<Student | null>;
  findByEnrollmentNumber(
    enrollmentNumber: string,
    empresaId?: string | null,
  ): Promise<Student | null>;
  create(payload: CreateStudentInput): Promise<Student>;
  update(id: string, payload: UpdateStudentInput): Promise<Student>;
  /** Revoga o acesso do aluno aos cursos da empresa (remove matrículas). Não faz soft delete em usuarios. */
  delete(id: string, empresaId: string): Promise<void>;
  findByEmpresa(empresaId: string): Promise<Student[]>;
  addCourses(studentId: string, courseIds: string[]): Promise<void>;
}

const TABLE = "usuarios";
const COURSE_LINK_TABLE = "alunos_cursos";
const COURSES_TABLE = "cursos";

function formatSupabaseError(error: unknown): string {
  if (!error) return "Erro desconhecido (vazio)";
  if (error instanceof Error) return error.message || "Erro sem mensagem";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as Record<string, unknown>;
    const code = e.code ? `[${String(e.code)}]` : "";
    const message =
      typeof e.message === "string" && e.message.trim()
        ? e.message
        : typeof e.error === "string" && e.error.trim()
          ? e.error
          : typeof e.details === "string" && e.details.trim()
            ? e.details
            : "";
    const details =
      e.details && typeof e.details === "string" && e.details !== message
        ? ` Detalhes: ${e.details}`
        : "";
    const hint = e.hint ? ` Hint: ${String(e.hint)}` : "";

    // Se ainda não temos mensagem, tentar serializar o objeto inteiro
    if (!code && !message && !details && !hint) {
      try {
        const serialized = JSON.stringify(error, null, 2);
        return serialized.length > 500
          ? `Erro do Supabase (objeto grande): ${serialized.substring(0, 500)}...`
          : `Erro do Supabase: ${serialized}`;
      } catch {
        // Se não conseguir serializar, tentar extrair propriedades conhecidas
        const keys = Object.keys(e);
        const values = keys
          .slice(0, 5)
          .map((k) => `${k}: ${String(e[k])}`)
          .join(", ");
        return `Erro do Supabase (${keys.length} propriedades): ${values}${keys.length > 5 ? "..." : ""}`;
      }
    }

    const result =
      `${[code, message].filter(Boolean).join(" ")}${details}${hint}`.trim();
    return result || "Erro do Supabase (sem mensagem legível)";
  }
  return String(error);
}

/** Escapa string para uso seguro em ilike (%, _, ', \). */
function escapeIlikePattern(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/'/g, "''");
}

// Use generated Database types instead of manual definitions
type StudentRow = Database["public"]["Tables"]["usuarios"]["Row"];
type StudentInsert = Database["public"]["Tables"]["usuarios"]["Insert"];
type StudentUpdate = Database["public"]["Tables"]["usuarios"]["Update"];

/**
 * Map database row to domain object
 *
 * Demonstrates proper handling of nullable fields from the database:
 * - nome_completo: string | null → fullName: string | null
 * - cpf: string | null → cpf: string | null
 * - telefone: string | null → phone: string | null
 * - data_nascimento: string | null → birthDate: Date | null (with conversion)
 * - endereco: string | null → address: string | null
 * - cep: string | null → zipCode: string | null
 * - numero_matricula: string | null → enrollmentNumber: string | null
 * - instagram: string | null → instagram: string | null
 * - twitter: string | null → twitter: string | null
 *
 * Best Practices:
 * - Preserve null values (don't convert to undefined or empty strings)
 * - Use ternary operator for type conversions (e.g., string to Date)
 * - Handle null explicitly when converting types
 *
 * For more information, see: docs/TYPESCRIPT_SUPABASE_GUIDE.md#nullable-fields
 */
function mapRow(
  row: StudentRow,
  courses: StudentCourseSummary[] = [],
): Student {
  return {
    id: row.id,
    empresaId: row.empresa_id ?? null,
    fullName: row.nome_completo,
    email: row.email,
    cpf: row.cpf,
    phone: row.telefone,
    birthDate: row.data_nascimento ? new Date(row.data_nascimento) : null,
    address: row.endereco,
    zipCode: row.cep,
    cidade: row.cidade ?? null,
    estado: row.estado ?? null,
    bairro: row.bairro ?? null,
    pais: row.pais ?? null,
    numeroEndereco: row.numero_endereco ?? null,
    complemento: row.complemento ?? null,
    enrollmentNumber: row.numero_matricula,
    instagram: row.instagram,
    twitter: row.twitter,
    hotmartId: row.hotmart_id ?? null,
    origemCadastro: row.origem_cadastro ?? null,
    ativo: row.ativo,
    progress: 0,
    courses,
    mustChangePassword: row.must_change_password,
    temporaryPassword: row.senha_temporaria,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quotaExtra: (row as any).quota_extra ?? 0,
  };
}

export class StudentRepositoryImpl implements StudentRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(params?: PaginationParams): Promise<PaginatedResult<Student>> {
    const page = params?.page ?? 1;
    const perPage = params?.perPage ?? 50;
    const sortBy = params?.sortBy ?? "nome_completo";
    const sortOrder = params?.sortOrder === "desc" ? false : true;

    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    // Filter by turmaId or courseId if provided
    let studentIdsToFilter: string[] | null = null;

    if (params?.turmaId) {
      // Filter by turma - get students in specific turma
      const turmaLinks = await fetchAllRows(
        this.client
          .from("alunos_turmas")
          .select("usuario_id")
          .eq("turma_id", params.turmaId),
      );

      studentIdsToFilter = turmaLinks.map((link) => link.usuario_id);
    } else if (params?.courseId) {
      // Filter by course - get students enrolled in specific course
      const courseLinks = await fetchAllRows(
        this.client
          .from(COURSE_LINK_TABLE)
          .select("usuario_id")
          .eq("curso_id", params.courseId),
      );

      studentIdsToFilter = courseLinks.map((link) => link.usuario_id);
    } else if (params?.empresaId) {
      // Listar apenas alunos matriculados em algum curso da empresa (alunos_cursos).
      // Assim usuários que só têm usuarios.empresa_id = X mas nenhuma matrícula não aparecem.
      const cursos = await fetchAllRows(
        this.client
          .from(COURSES_TABLE)
          .select("id")
          .eq("empresa_id", params.empresaId),
      );

      const cursoIds = cursos.map((c: { id: string }) => c.id);
      if (cursoIds.length === 0) {
        studentIdsToFilter = [];
      } else {
        const alunosCursos = await fetchAllRows(
          this.client
            .from(COURSE_LINK_TABLE)
            .select("usuario_id")
            .in("curso_id", cursoIds),
        );

        studentIdsToFilter = Array.from(
          new Set(
            alunosCursos.map(
              (ac: { usuario_id: string }) => ac.usuario_id,
            ),
          ),
        );
      }
    } else {
      // Sem turma/course/empresa: não aplicar filtro por IDs. O RLS em usuarios já restringe.
      studentIdsToFilter = null;
    }

    // If filtering by course/turma and no students found, return empty result
    if (studentIdsToFilter !== null && studentIdsToFilter.length === 0) {
      return {
        data: [],
        meta: {
          page,
          perPage,
          total: 0,
          totalPages: 0,
        },
      };
    }

    // Para count, selecione apenas `id` para evitar falhas por permissões em outras colunas.
    // Quando filtramos por curso/empresa/turma (studentIdsToFilter), a lista vem de matrículas
    // (alunos_cursos). Não exigir deleted_at IS NULL para não esconder alunos que tiveram apenas
    // o vínculo de staff removido (soft delete em usuarios) mas continuam matriculados.
    //
    // Quando há studentIdsToFilter (lista por empresa/curso/turma), NÃO exigir usuarios_empresas:
    // a matrícula em alunos_cursos/alunos_turmas já define "aluno" para essa listagem. Exigir
    // papel_base = 'aluno' em usuarios_empresas esconderia alunos que só têm matrícula (ex.: importados).

    const filterByEnrollment = studentIdsToFilter !== null;
    let queryBuilder = filterByEnrollment
      ? this.client.from(TABLE).select("id", { count: "exact", head: true })
      : this.client
          .from(TABLE)
          .select("id, usuarios_empresas!inner(papel_base)", {
            count: "exact",
            head: true,
          })
          .eq("usuarios_empresas.papel_base", "aluno");

    if (params?.status === "active") {
      queryBuilder = queryBuilder.eq("ativo", true);
    } else if (params?.status === "inactive") {
      queryBuilder = queryBuilder.eq("ativo", false);
    }

    if (studentIdsToFilter !== null) {
      // PostgreSQL tem limites práticos para cláusulas IN com muitos valores
      // Se a lista for muito grande (>10000), pode causar problemas de performance
      // Por enquanto, vamos usar a lista completa, mas adicionar log se for muito grande
      if (studentIdsToFilter.length > 10000) {
        console.warn(
          `Large studentIdsToFilter list (${studentIdsToFilter.length} items). ` +
            `This may cause performance issues.`,
        );
      }
      queryBuilder = queryBuilder.in("id", studentIdsToFilter);
    }

    const searchTerm = params?.query?.trim();
    if (searchTerm) {
      const q = escapeIlikePattern(searchTerm);
      queryBuilder = queryBuilder.or(
        `nome_completo.ilike.%${q}%,email.ilike.%${q}%,numero_matricula.ilike.%${q}%`,
      );
    }

    // Get total count
    let total = 0;
    let countError: unknown = null;

    try {
      const countResult = await queryBuilder;
      total = countResult.count ?? 0;
      countError = countResult.error;
    } catch (err) {
      countError = err;
    }

    if (countError) {
      const errorMessage = formatSupabaseError(countError);
      const isEmptyError =
        !errorMessage ||
        errorMessage.trim() === "" ||
        errorMessage.includes("vazio") ||
        errorMessage.includes("sem mensagem");

      if (isEmptyError) {
        console.warn(
          "Count query failed (unclear error), using fallback count from data.",
          {
            studentIdsToFilterLength: studentIdsToFilter?.length ?? null,
            hasQuery: !!searchTerm,
          },
        );
        total = -1;
      } else {
        console.error("Count error:", errorMessage);
        throw new Error(`Failed to count students: ${errorMessage}`);
      }
    }

    // Get paginated data (idem: quando lista é por matrícula, incluir mesmo com deleted_at set)
    let dataQuery = filterByEnrollment
      ? this.client
          .from(TABLE)
          .select("*")
          .order(sortBy, { ascending: sortOrder })
          .range(from, to)
      : this.client
          .from(TABLE)
          .select("*, usuarios_empresas!inner(papel_base)")
          .eq("usuarios_empresas.papel_base", "aluno")
          .order(sortBy, { ascending: sortOrder })
          .range(from, to);

    if (studentIdsToFilter !== null) {
      dataQuery = dataQuery.in("id", studentIdsToFilter);
    }

    if (params?.status === "active") {
      dataQuery = dataQuery.eq("ativo", true);
    } else if (params?.status === "inactive") {
      dataQuery = dataQuery.eq("ativo", false);
    }

    if (searchTerm) {
      const q = escapeIlikePattern(searchTerm);
      dataQuery = dataQuery.or(
        `nome_completo.ilike.%${q}%,email.ilike.%${q}%,numero_matricula.ilike.%${q}%`,
      );
    }

    const { data, error } = await dataQuery;

    if (error) {
      throw new Error(`Failed to list students: ${formatSupabaseError(error)}`);
    }

    // Se a contagem falhou, usar fallback: tentar diferentes estratégias
    if (total === -1) {
      let fallbackSuccess = false;

      // Estratégia 1: Tentar count sem head (retorna dados + count)
      try {
        let fallbackCountQuery = filterByEnrollment
          ? this.client
              .from(TABLE)
              .select("id", { count: "exact", head: false })
              .limit(1)
          : this.client
              .from(TABLE)
              .select("id, usuarios_empresas!inner(papel_base)", {
                count: "exact",
                head: false,
              })
              .eq("usuarios_empresas.papel_base", "aluno")
              .limit(1); // Apenas precisamos do count, não dos dados

        if (studentIdsToFilter !== null) {
          fallbackCountQuery = fallbackCountQuery.in("id", studentIdsToFilter);
        }
        if (params?.status === "active") {
          fallbackCountQuery = fallbackCountQuery.eq("ativo", true);
        } else if (params?.status === "inactive") {
          fallbackCountQuery = fallbackCountQuery.eq("ativo", false);
        }
        if (searchTerm) {
          const q = escapeIlikePattern(searchTerm);
          fallbackCountQuery = fallbackCountQuery.or(
            `nome_completo.ilike.%${q}%,email.ilike.%${q}%,numero_matricula.ilike.%${q}%`,
          );
        }

        const fallbackResult = await fallbackCountQuery;

        if (!fallbackResult.error && fallbackResult.count !== null) {
          total = fallbackResult.count;
          fallbackSuccess = true;
        }
      } catch (_e) {
        // Ignore and try next strategy
      }

      if (!fallbackSuccess) {
        // Se ainda falhar e temos dados, assumir que é a única página se < perPage
        if (data && data.length < perPage && data.length > 0) {
          total = data.length + from;
        } else {
          // Fallback final: apenas para evitar UI quebrada
          total = data
            ? data.length + from + (data.length === perPage ? 1 : 0)
            : 0;
        }
      }
    }

    // Attach additional info
    const studentsWithCourses = await this.attachCourses(
      (data as unknown as StudentRow[]) ?? [],
    );
    const studentsWithProgress = await this.attachProgress(studentsWithCourses);

    return {
      data: studentsWithProgress,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findById(id: string): Promise<Student | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch student: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const [student] = await this.attachCourses([data]);
    return student ?? null;
  }

  async findByEmail(email: string): Promise<Student | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch student by email: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const [student] = await this.attachCourses([data]);
    return student ?? null;
  }

  async findByEmailIncludingDeleted(email: string): Promise<Student | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch student by email: ${error.message}`);
    }

    if (!data) return null;

    const [student] = await this.attachCourses([data]);
    return student ?? null;
  }

  async restoreSoftDeleted(id: string): Promise<void> {
    const { error } = await this.client
      .from(TABLE)
      .update({ deleted_at: null })
      .eq("id", id);

    if (error) {
      throw new Error(
        `Failed to restore soft-deleted student: ${error.message}`,
      );
    }
  }

  async findByCpf(cpf: string): Promise<Student | null> {
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .eq("cpf", cpf)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch student by CPF: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    const [student] = await this.attachCourses([data]);
    return student ?? null;
  }

  async findByEnrollmentNumber(
    enrollmentNumber: string,
    empresaId?: string | null,
  ): Promise<Student | null> {
    let query = this.client
      .from(TABLE)
      .select("*")
      .eq("numero_matricula", enrollmentNumber);

    // Se empresaId foi fornecido, filtrar por empresa também
    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(
        `Failed to fetch student by enrollment number: ${error.message}`,
      );
    }

    if (!data) {
      return null;
    }

    const [student] = await this.attachCourses([data]);
    return student ?? null;
  }

  async create(payload: CreateStudentInput): Promise<Student> {
    // O ID deve sempre ser fornecido (vem do auth.users criado no service)
    if (!payload.id) {
      throw new Error(
        "Student ID is required. User must be created in auth.users first.",
      );
    }

    // Verificar se aluno já existe por ID (incluindo soft deleted)
    // Primeiro verifica sem soft delete
    let existingById = await this.findById(payload.id);

    // Se não encontrou, verifica incluindo soft deleted
    if (!existingById) {
      const { data: softDeletedData, error: softDeletedError } =
        await this.client
          .from(TABLE)
          .select("*")
          .eq("id", payload.id)
          .maybeSingle();

      if (softDeletedError) {
        throw new Error(
          `Failed to check existing student: ${softDeletedError.message}`,
        );
      }

      // Se encontrou com soft delete, restaurar (remover deleted_at)
      if (softDeletedData) {
        const { data: restoredData, error: restoreError } = await this.client
          .from(TABLE)
          .update({ deleted_at: null })
          .eq("id", payload.id)
          .select("*")
          .single();

        if (restoreError) {
          throw new Error(
            `Failed to restore soft-deleted student: ${restoreError.message}`,
          );
        }

        existingById = restoredData
          ? await this.attachCourses([restoredData]).then((s) => s[0] ?? null)
          : null;
      }
    }

    if (existingById) {
      // Aluno já existe (ou foi restaurado), atualizar apenas os cursos se necessário
      if (payload.courseIds && payload.courseIds.length > 0) {
        await this.setCourses(payload.id, payload.courseIds);
      }
      return existingById;
    }

    // Verificar se número de matrícula já existe em outro aluno da mesma empresa
    if (payload.enrollmentNumber && payload.empresaId) {
      const existingByEnrollment = await this.findByEnrollmentNumber(
        payload.enrollmentNumber,
        payload.empresaId,
      );
      if (existingByEnrollment && existingByEnrollment.id !== payload.id) {
        throw new Error(
          `Failed to create student: duplicate key value violates unique constraint "usuarios_empresa_matricula_unique"`,
        );
      }
    }

    // Cast para incluir empresa_id e novos campos Hotmart
    const insertData = {
      id: payload.id,
      empresa_id: payload.empresaId ?? null,
      nome_completo: payload.fullName || payload.email,
      email: payload.email.toLowerCase(),
      cpf: payload.cpf ?? null,
      telefone: payload.phone ?? null,
      data_nascimento: payload.birthDate ?? null,
      endereco: payload.address ?? null,
      cep: payload.zipCode ?? null,
      cidade: payload.cidade ?? null,
      estado: payload.estado ?? null,
      bairro: payload.bairro ?? null,
      pais: payload.pais ?? null,
      numero_endereco: payload.numeroEndereco ?? null,
      complemento: payload.complemento ?? null,
      numero_matricula: payload.enrollmentNumber ?? null,
      instagram: payload.instagram ?? null,
      twitter: payload.twitter ?? null,
      hotmart_id: payload.hotmartId ?? null,
      origem_cadastro: payload.origemCadastro ?? null,
      must_change_password: payload.mustChangePassword ?? false,
      senha_temporaria: payload.temporaryPassword ?? null,
    } as StudentInsert;

    const { data, error } = await this.client
      .from(TABLE)
      .insert(insertData)
      .select("*")
      .single();

    // Create usuarios_empresas binding for this student
    if (data && insertData.empresa_id) {
      const { error: vinculoError } = await this.client
        .from("usuarios_empresas")
        .upsert(
          {
            usuario_id: data.id,
            empresa_id: insertData.empresa_id,
            papel_base: "aluno",
            ativo: true,
          },
          { onConflict: "usuario_id,empresa_id,papel_base" },
        );

      if (vinculoError) {
        throw new Error(
          `Failed to create tenant binding (usuarios_empresas): ${formatSupabaseError(vinculoError)}`,
        );
      }
    }

    if (error) {
      // Verificar se é erro de constraint única (incluindo primary key)
      const errorMessage = error.message?.toLowerCase() || "";
      const errorCode = error.code || "";

      // PostgreSQL error codes: 23505 = unique_violation, 23503 = foreign_key_violation
      const isPrimaryKeyError =
        errorCode === "23505" &&
        (errorMessage.includes("usuarios_pkey") ||
          errorMessage.includes("primary key") ||
          errorMessage.includes("chave primária"));

      if (
        isPrimaryKeyError ||
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("unique constraint") ||
        errorMessage.includes("usuarios_pkey") ||
        errorMessage.includes("chave primária")
      ) {
        // Se for erro de primary key, pode ser race condition - tentar buscar o aluno existente
        // Primeiro tenta sem soft delete
        let existingStudent = await this.findById(payload.id);

        // Se não encontrou, tenta incluindo soft deleted
        if (!existingStudent) {
          const { data: softDeletedData } = await this.client
            .from(TABLE)
            .select("*")
            .eq("id", payload.id)
            .maybeSingle();

          if (softDeletedData) {
            // Restaurar soft deleted
            const { data: restoredData } = await this.client
              .from(TABLE)
              .update({ deleted_at: null })
              .eq("id", payload.id)
              .select("*")
              .single();

            if (restoredData) {
              const [restored] = await this.attachCourses([restoredData]);
              existingStudent = restored ?? null;
            }
          }
        }

        if (existingStudent) {
          // Aluno existe, apenas vincular cursos
          if (payload.courseIds && payload.courseIds.length > 0) {
            await this.setCourses(payload.id, payload.courseIds);
          }
          const updated = await this.findById(payload.id);
          return updated ?? existingStudent;
        }

        // Se não encontrou, lançar erro com mensagem clara
        throw new Error(
          `Failed to create student: valor duplicado viola restrição única "chave primária de usuarios"`,
        );
      }
      if (
        errorMessage.includes("usuarios_numero_matricula_key") ||
        errorMessage.includes("usuarios_empresa_matricula_unique") ||
        errorMessage.includes("usuarios_email_key") ||
        errorMessage.includes("usuarios_cpf_key")
      ) {
        throw new Error(`Failed to create student: ${error.message}`);
      }
      throw new Error(`Failed to create student: ${error.message}`);
    }

    if (!data) {
      throw new Error("Insert succeeded but no data returned");
    }

    await this.setCourses(data.id, payload.courseIds ?? []);

    const [student] = await this.attachCourses([data]);
    if (!student) {
      throw new Error("Failed to attach courses to created student");
    }
    return student;
  }

  async update(id: string, payload: UpdateStudentInput): Promise<Student> {
    const updateData: StudentUpdate = {};

    if (payload.fullName !== undefined) {
      updateData.nome_completo = payload.fullName ?? undefined;
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

    if (payload.birthDate !== undefined) {
      updateData.data_nascimento = payload.birthDate;
    }

    if (payload.address !== undefined) {
      updateData.endereco = payload.address;
    }

    if (payload.zipCode !== undefined) {
      updateData.cep = payload.zipCode;
    }

    if (payload.enrollmentNumber !== undefined) {
      updateData.numero_matricula = payload.enrollmentNumber;
    }

    if (payload.instagram !== undefined) {
      updateData.instagram = payload.instagram;
    }

    if (payload.twitter !== undefined) {
      updateData.twitter = payload.twitter;
    }

    if (payload.cidade !== undefined) {
      updateData.cidade = payload.cidade;
    }

    if (payload.estado !== undefined) {
      updateData.estado = payload.estado;
    }

    if (payload.bairro !== undefined) {
      updateData.bairro = payload.bairro;
    }

    if (payload.pais !== undefined) {
      updateData.pais = payload.pais;
    }

    if (payload.numeroEndereco !== undefined) {
      updateData.numero_endereco = payload.numeroEndereco;
    }

    if (payload.complemento !== undefined) {
      updateData.complemento = payload.complemento;
    }

    if (payload.hotmartId !== undefined) {
      updateData.hotmart_id = payload.hotmartId;
    }

    if (payload.origemCadastro !== undefined) {
      updateData.origem_cadastro = payload.origemCadastro;
    }

    if (payload.mustChangePassword !== undefined) {
      updateData.must_change_password = payload.mustChangePassword;
    }

    if (payload.temporaryPassword !== undefined) {
      updateData.senha_temporaria = payload.temporaryPassword;
    }

    if (payload.quotaExtra !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (updateData as any).quota_extra = payload.quotaExtra;
    }

    let data;

    if (Object.keys(updateData).length > 0) {
      const result = await this.client
        .from(TABLE)
        .update(updateData)
        .eq("id", id)
        .select("*")
        .single();

      if (result.error) {
        throw new Error(`Failed to update student: ${result.error.message}`);
      }
      data = result.data;
    } else {
      const result = await this.client
        .from(TABLE)
        .select("*")
        .eq("id", id)
        .single();

      if (result.error) {
        throw new Error(`Failed to fetch student: ${result.error.message}`);
      }
      data = result.data;
    }

    if (payload.courseIds) {
      await this.setCourses(id, payload.courseIds);
    }

    const [student] = await this.attachCourses([data]);
    return student;
  }

  async delete(id: string, empresaId: string): Promise<void> {
    // Revogar por empresa: remover apenas matrículas nos cursos dessa empresa; não soft-delete em usuarios
    const { data: cursoIds, error: cursosError } = await this.client
      .from(COURSES_TABLE)
      .select("id")
      .eq("empresa_id", empresaId);

    if (cursosError) {
      throw new Error(
        `Failed to fetch courses for empresa: ${cursosError.message}`,
      );
    }

    const ids = (cursoIds ?? []).map((c) => c.id);
    if (ids.length > 0) {
      const { error: deleteError } = await this.client
        .from(COURSE_LINK_TABLE)
        .delete()
        .eq("usuario_id", id)
        .in("curso_id", ids);

      if (deleteError) {
        throw new Error(
          `Failed to revoke student enrollments: ${deleteError.message}`,
        );
      }
    }

    // Se o usuário não tiver mais nenhuma matrícula e a empresa revogada era a "primária" dele, limpar empresa_id
    const { data: remaining } = await this.client
      .from(COURSE_LINK_TABLE)
      .select("usuario_id")
      .eq("usuario_id", id)
      .limit(1);

    if (!remaining || remaining.length === 0) {
      const { data: usuario } = await this.client
        .from(TABLE)
        .select("empresa_id")
        .eq("id", id)
        .single();
      if (usuario?.empresa_id === empresaId) {
        await this.client.from(TABLE).update({ empresa_id: null }).eq("id", id);
      }
    }
  }

  private async attachCourses(rows: StudentRow[]): Promise<Student[]> {
    if (!rows.length) {
      return [];
    }

    const studentIds = rows.map((row) => row.id);
    const courseMap = await this.fetchCourses(studentIds);

    return rows.map((row) => mapRow(row, courseMap.get(row.id) ?? []));
  }

  private async fetchCourses(
    studentIds: string[],
  ): Promise<Map<string, StudentCourseSummary[]>> {
    const map = new Map<string, StudentCourseSummary[]>();
    if (!studentIds.length) {
      return map;
    }

    const { data: links, error: linksError } = await this.client
      .from(COURSE_LINK_TABLE)
      .select("usuario_id, curso_id")
      .in("usuario_id", studentIds);

    if (linksError) {
      throw new Error(`Failed to fetch student courses: ${linksError.message}`);
    }

    const courseIds = Array.from(
      new Set((links ?? []).map((link) => link.curso_id)),
    );
    if (!courseIds.length) {
      return map;
    }

    const { data: courses, error: courseError } = await this.client
      .from(COURSES_TABLE)
      .select("id, nome")
      .in("id", courseIds);

    if (courseError) {
      throw new Error(`Failed to fetch courses: ${courseError.message}`);
    }

    const courseLookup = new Map<string, StudentCourseSummary>(
      (courses ?? []).map((course) => [
        course.id,
        { id: course.id, name: course.nome },
      ]),
    );

    (links ?? []).forEach((link) => {
      const course = courseLookup.get(link.curso_id);
      if (!course) {
        return;
      }

      if (!map.has(link.usuario_id)) {
        map.set(link.usuario_id, []);
      }
      map.get(link.usuario_id)!.push(course);
    });

    return map;
  }

  private async attachProgress(students: Student[]): Promise<Student[]> {
    if (!students.length) {
      return students;
    }

    const studentIds = students.map((s) => s.id);
    const allCourseIds = Array.from(
      new Set(students.flatMap((s) => s.courses.map((c) => c.id))),
    );

    if (!allCourseIds.length) {
      return students;
    }

    // Count total aulas per course
    const { data: aulasPerCourse, error: aulasError } = await this.client
      .from("aulas")
      .select("curso_id")
      .in("curso_id", allCourseIds);

    if (aulasError) {
      console.warn(`Failed to fetch aulas for progress: ${aulasError.message}`);
      return students;
    }

    const totalAulasByCourse = new Map<string, number>();
    (aulasPerCourse ?? []).forEach((a) => {
      totalAulasByCourse.set(
        a.curso_id,
        (totalAulasByCourse.get(a.curso_id) ?? 0) + 1,
      );
    });

    // Count completed aulas per student
    const { data: completions, error: completionsError } = await this.client
      .from("aulas_concluidas")
      .select("usuario_id")
      .in("usuario_id", studentIds);

    if (completionsError) {
      console.warn(
        `Failed to fetch aulas_concluidas for progress: ${completionsError.message}`,
      );
      return students;
    }

    const completedByStudent = new Map<string, number>();
    (completions ?? []).forEach((c) => {
      completedByStudent.set(
        c.usuario_id,
        (completedByStudent.get(c.usuario_id) ?? 0) + 1,
      );
    });

    return students.map((student) => {
      const totalAulas = student.courses.reduce(
        (sum, course) => sum + (totalAulasByCourse.get(course.id) ?? 0),
        0,
      );
      const completed = completedByStudent.get(student.id) ?? 0;
      const progress =
        totalAulas > 0 ? Math.round((completed / totalAulas) * 100) : 0;

      return { ...student, progress };
    });
  }

  async findByEmpresa(empresaId: string): Promise<Student[]> {
    // Buscar cursos da empresa
    const { data: cursos, error: cursosError } = await this.client
      .from(COURSES_TABLE)
      .select("id")
      .eq("empresa_id", empresaId);

    if (cursosError) {
      throw new Error(
        `Failed to fetch courses by empresa: ${cursosError.message}`,
      );
    }

    const cursoIds = (cursos ?? []).map((c: { id: string }) => c.id);

    if (!cursoIds.length) {
      return [];
    }

    // Buscar alunos matriculados nesses cursos
    const { data: alunosCursos, error: alunosCursosError } = await this.client
      .from(COURSE_LINK_TABLE)
      .select("usuario_id")
      .in("curso_id", cursoIds);

    if (alunosCursosError) {
      throw new Error(
        `Failed to fetch students by empresa: ${alunosCursosError.message}`,
      );
    }

    const alunoIds = Array.from(
      new Set(
        (alunosCursos ?? []).map((ac: { usuario_id: string }) => ac.usuario_id),
      ),
    );

    if (!alunoIds.length) {
      return [];
    }

    // Lista por empresa vem de alunos_cursos (matrículas). Incluir todos matriculados
    // mesmo com deleted_at set (staff removido), para não esconder alunos.
    const { data, error } = await this.client
      .from(TABLE)
      .select("*")
      .in("id", alunoIds)
      .order("nome_completo", { ascending: true });

    if (error) {
      throw new Error(`Failed to list students by empresa: ${error.message}`);
    }

    return this.attachCourses(data ?? []);
  }

  private async setCourses(
    studentId: string,
    courseIds: string[],
  ): Promise<void> {
    const { error: deleteError } = await this.client
      .from(COURSE_LINK_TABLE)
      .delete()
      .eq("usuario_id", studentId);

    if (deleteError) {
      throw new Error(
        `Failed to clear student courses: ${deleteError.message}`,
      );
    }

    if (!courseIds || !courseIds.length) {
      return;
    }

    const rows = courseIds.map((courseId) => ({
      usuario_id: studentId,
      curso_id: courseId,
    }));

    const { error: insertError } = await this.client
      .from(COURSE_LINK_TABLE)
      .insert(rows);
    if (insertError) {
      throw new Error(
        `Failed to link student to courses: ${insertError.message}`,
      );
    }
  }

  async addCourses(studentId: string, courseIds: string[]): Promise<void> {
    const uniqueCourseIds = Array.from(new Set(courseIds ?? [])).filter(
      Boolean,
    );
    if (!uniqueCourseIds.length) {
      return;
    }

    const rows = uniqueCourseIds.map((courseId) => ({
      usuario_id: studentId,
      curso_id: courseId,
    }));

    const { error } = await this.client.from(COURSE_LINK_TABLE).upsert(rows, {
      onConflict: "usuario_id,curso_id",
      ignoreDuplicates: true,
    });

    if (error) {
      throw new Error(`Failed to link student to courses: ${error.message}`);
    }
  }
}
