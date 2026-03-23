import {
  Student,
  CreateStudentInput,
  UpdateStudentInput,
} from "./student.types";
import {
  StudentRepository,
  StudentRepositoryImpl,
  PaginatedResult,
} from "./student.repository";
import {
  StudentConflictError,
  StudentNotFoundError,
  StudentValidationError,
} from "./errors";
import { UserBaseService } from "./user-base.service";
import { getDatabaseClient } from "@/app/shared/core/database/database";
import type { PaginationParams } from "@/app/shared/types/dtos/api-responses";
import { normalizeCpf } from "@/app/shared/library/br";
import { SupabaseClient } from "@supabase/supabase-js";

const FULL_NAME_MIN_LENGTH = 3;
const FULL_NAME_MAX_LENGTH = 200;
const EMAIL_MAX_LENGTH = 255;
const CPF_LENGTH = 11;
const ZIP_CODE_LENGTH = 8;
const ENROLLMENT_NUMBER_MAX_LENGTH = 50;
const SOCIAL_HANDLE_MAX_LENGTH = 100;
const COURSE_MIN_SELECTION = 1;

export class StudentService extends UserBaseService {
  constructor(private readonly repository: StudentRepository) {
    super();
  }

  async list(params?: PaginationParams): Promise<PaginatedResult<Student>> {
    return this.repository.list(params);
  }

  async create(payload: CreateStudentInput): Promise<Student> {
    const email = this.validateEmail(payload.email);

    const existingByEmail = await this.repository.findByEmail(email);
    if (existingByEmail) {
      // Aluno já existe no sistema (possivelmente em outra empresa)
      // Permitir vínculo cross-tenant - criar vínculo em usuarios_empresas e vincular aos cursos
      // O empresa_id "primário" do aluno permanece inalterado para compatibilidade

      // Criar vínculo em usuarios_empresas para a nova empresa (se empresaId fornecido)
      if (payload.empresaId) {
        const db = getDatabaseClient();
        await db.from("usuarios_empresas").upsert(
          {
            usuario_id: existingByEmail.id,
            empresa_id: payload.empresaId,
            papel_base: "aluno",
            ativo: true,
          },
          { onConflict: "usuario_id,empresa_id,papel_base", ignoreDuplicates: true },
        );
      }

      const courseIds =
        payload.courseIds && payload.courseIds.length > 0
          ? this.validateCourseIds(payload.courseIds)
          : [];

      if (courseIds.length > 0) {
        await this.repository.addCourses(existingByEmail.id, courseIds);
      }

      const updated = await this.repository.findById(existingByEmail.id);
      return updated ?? existingByEmail;
    }

    // Validar courseIds - permitir vazio se temporaryPassword for fornecida ou CPF fornecido
    const courseIds =
      payload.courseIds && payload.courseIds.length > 0
        ? this.validateCourseIds(payload.courseIds)
        : [];
    let courses: Awaited<ReturnType<typeof this.fetchCourses>> = [];

    if (courseIds.length > 0) {
      courses = await this.fetchCourses(courseIds);
      if (courses.length !== courseIds.length) {
        throw new StudentValidationError(
          "Um ou mais cursos selecionados são inválidos.",
        );
      }
    }

    if (payload.cpf) {
      const cpf = this.validateCpf(payload.cpf);
      const existingByCpf = await this.repository.findByCpf(cpf);
      if (existingByCpf) {
        // Se o CPF pertence a outro e-mail, bloqueia (divergência de identidade)
        if (existingByCpf.email && existingByCpf.email !== email) {
          throw new StudentConflictError(
            "Este CPF já está cadastrado para outro aluno. Use o cadastro existente e apenas vincule ao curso.",
          );
        }

        // CPF encontrado com mesmo e-mail (ou sem e-mail): permitir vínculo cross-tenant
        if (payload.empresaId) {
          const db = getDatabaseClient();
          await db.from("usuarios_empresas").upsert(
            {
              usuario_id: existingByCpf.id,
              empresa_id: payload.empresaId,
              papel_base: "aluno",
              ativo: true,
            },
            { onConflict: "usuario_id,empresa_id,papel_base", ignoreDuplicates: true },
          );
        }

        if (courseIds.length > 0) {
          await this.repository.addCourses(existingByCpf.id, courseIds);
        }

        const updated = await this.repository.findById(existingByCpf.id);
        return updated ?? existingByCpf;
      }
    }

    if (payload.enrollmentNumber) {
      const enrollmentNumber = this.validateEnrollmentNumber(
        payload.enrollmentNumber,
      );
      // Verificar duplicata apenas dentro da mesma empresa
      const existingByEnrollment = await this.repository.findByEnrollmentNumber(
        enrollmentNumber,
        payload.empresaId ?? undefined,
      );
      if (existingByEnrollment) {
        throw new StudentConflictError(
          `Student with enrollment number "${enrollmentNumber}" already exists in this empresa`,
        );
      }
    }

    const fullName = payload.fullName
      ? this.validateFullName(payload.fullName)
      : undefined;
    const phone = payload.phone ? this.validatePhone(payload.phone) : undefined;
    const zipCode = payload.zipCode
      ? this.validateZipCode(payload.zipCode)
      : undefined;
    const birthDate = payload.birthDate
      ? this.validateDate(payload.birthDate)
      : undefined;
    const instagram = payload.instagram
      ? this.validateSocialHandle(payload.instagram)
      : undefined;
    const twitter = payload.twitter
      ? this.validateSocialHandle(payload.twitter)
      : undefined;

    const cpf = payload.cpf ? this.validateCpf(payload.cpf) : undefined;
    let temporaryPassword = payload.temporaryPassword?.trim();

    if (!temporaryPassword) {
      // Se não há cursos, precisa fornecer CPF ou senha temporária
      if (courseIds.length === 0) {
        if (!cpf) {
          throw new StudentValidationError(
            "Informe o CPF ou defina manualmente a senha temporária para o aluno quando não há cursos.",
          );
        }
        // Gerar senha usando CPF
        temporaryPassword = this.generateDefaultPassword(cpf);
      } else {
        // Se há cursos, precisa de CPF ou senha temporária para gerar senha padrão
        if (!cpf) {
          throw new StudentValidationError(
            "Informe o CPF ou defina manualmente a senha temporária para o aluno.",
          );
        }
        temporaryPassword = this.generateDefaultPassword(cpf);
      }
    }

    if (temporaryPassword.length < 8) {
      throw new StudentValidationError(
        "A senha temporária deve ter pelo menos 8 caracteres.",
      );
    }

    // Se o ID não foi fornecido, precisamos criar o usuário no auth.users primeiro
    let studentId = payload.id;
    if (!studentId) {
      try {
        const authResult = await this.createAuthUser({
          email,
          password: temporaryPassword,
          fullName: fullName,
          role: "aluno",
          empresaId: payload.empresaId,
          mustChangePassword: true,
        });

        studentId = authResult.userId;
      } catch (error: unknown) {
        const err = error as Error;
        if (err.message?.includes("Conflict")) {
          throw new StudentConflictError(err.message);
        }
        throw error;
      }
    }

    // Verificar novamente se o aluno já existe por ID (pode existir se o auth user já existia)
    // Isso previne erros de primary key quando o usuário já existe no auth mas o aluno também já existe
    const existingById = await this.repository.findById(studentId);
    if (existingById) {
      // Aluno já existe, apenas vincular aos cursos se necessário
      const courseIds =
        payload.courseIds && payload.courseIds.length > 0
          ? this.validateCourseIds(payload.courseIds)
          : [];

      if (courseIds.length > 0) {
        await this.repository.addCourses(existingById.id, courseIds);
      }

      const updated = await this.repository.findById(existingById.id);
      return updated ?? existingById;
    }

    let student: Student;
    try {
      student = await this.repository.create({
        id: studentId,
        empresaId: payload.empresaId,
        fullName,
        email,
        cpf,
        phone,
        birthDate: birthDate?.toISOString().split("T")[0],
        address: payload.address?.trim() || undefined,
        zipCode,
        enrollmentNumber: payload.enrollmentNumber
          ? this.validateEnrollmentNumber(payload.enrollmentNumber)
          : undefined,
        instagram,
        twitter,
        courseIds,
        mustChangePassword: true,
        temporaryPassword,
      });
    } catch (error: unknown) {
      const err = error as Error;
      const errorMessage = err.message?.toLowerCase() || "";

      // Verificar se é erro de constraint única (duplicate key)
      // Incluindo erro de primary key (alunos_pkey ou "chave primária")
      const isPrimaryKeyError =
        errorMessage.includes("usuarios_pkey") ||
        errorMessage.includes("chave primária") ||
        errorMessage.includes("primary key");

      if (
        isPrimaryKeyError ||
        errorMessage.includes("duplicate key") ||
        errorMessage.includes("unique constraint") ||
        errorMessage.includes("usuarios_numero_matricula_key") ||
        errorMessage.includes("usuarios_empresa_matricula_unique") ||
        errorMessage.includes("usuarios_email_key") ||
        errorMessage.includes("usuarios_cpf_key")
      ) {
        // Se for erro de primary key, tentar buscar o aluno existente e vincular cursos
        if (isPrimaryKeyError) {
          // Tentar buscar por ID primeiro
          let existingStudent = await this.repository.findById(studentId);

          // Se não encontrou, tentar buscar por email
          if (!existingStudent) {
            existingStudent = await this.repository.findByEmail(email);
          }

          if (existingStudent) {
            // Aluno existe, apenas vincular cursos
            const courseIdsToLink =
              payload.courseIds && payload.courseIds.length > 0
                ? this.validateCourseIds(payload.courseIds)
                : [];

            if (courseIdsToLink.length > 0) {
              await this.repository.addCourses(
                existingStudent.id,
                courseIdsToLink,
              );
            }

            const updated = await this.repository.findById(existingStudent.id);
            return updated ?? existingStudent;
          }
        }

        // Para outros erros de constraint, verificar se é por email (aluno já existe)
        if (
          errorMessage.includes("usuarios_email_key") ||
          errorMessage.includes("duplicate key")
        ) {
          const existingByEmail = await this.repository.findByEmail(email);
          if (existingByEmail) {
            // Aluno existe por email, vincular cursos
            const courseIdsToLink =
              payload.courseIds && payload.courseIds.length > 0
                ? this.validateCourseIds(payload.courseIds)
                : [];

            if (courseIdsToLink.length > 0) {
              await this.repository.addCourses(
                existingByEmail.id,
                courseIdsToLink,
              );
            }

            const updated = await this.repository.findById(existingByEmail.id);
            return updated ?? existingByEmail;
          }
        }

        throw new StudentConflictError(
          err.message || "Aluno já existe no sistema",
        );
      }
      throw error;
    }

    // Vincular aluno à turma se turmaId foi fornecido
    if (payload.turmaId) {
      try {
        const { createTurmaService } =
          await import("@/app/[tenant]/(modules)/curso/services/turma");
        const turmaService = createTurmaService(getDatabaseClient());
        await turmaService.vincularAluno(payload.turmaId, student.id);
      } catch (turmaError) {
        console.error("Error linking student to turma:", turmaError);
      }
    }

    return student;
  }

  async update(id: string, payload: UpdateStudentInput): Promise<Student> {
    await this.ensureExists(id);

    const updateData: UpdateStudentInput = {};

    if (payload.fullName !== undefined) {
      updateData.fullName = payload.fullName
        ? this.validateFullName(payload.fullName)
        : null;
    }

    if (payload.email !== undefined) {
      const email = this.validateEmail(payload.email);
      const existingByEmail = await this.repository.findByEmail(email);
      if (existingByEmail && existingByEmail.id !== id) {
        throw new StudentConflictError(
          `Student with email "${email}" already exists`,
        );
      }
      updateData.email = email;
    }

    if (payload.cpf !== undefined) {
      if (payload.cpf) {
        const cpf = this.validateCpf(payload.cpf);
        const existingByCpf = await this.repository.findByCpf(cpf);
        if (existingByCpf && existingByCpf.id !== id) {
          throw new StudentConflictError(
            `Student with CPF "${cpf}" already exists`,
          );
        }
        updateData.cpf = cpf;
      } else {
        updateData.cpf = null;
      }
    }

    if (payload.phone !== undefined) {
      updateData.phone = payload.phone
        ? this.validatePhone(payload.phone)
        : null;
    }

    if (payload.birthDate !== undefined) {
      updateData.birthDate = payload.birthDate
        ? this.validateDate(payload.birthDate).toISOString().split("T")[0]
        : null;
    }

    if (payload.address !== undefined) {
      updateData.address = payload.address?.trim() || null;
    }

    if (payload.zipCode !== undefined) {
      updateData.zipCode = payload.zipCode
        ? this.validateZipCode(payload.zipCode)
        : null;
    }

    if (payload.enrollmentNumber !== undefined) {
      if (payload.enrollmentNumber) {
        const enrollmentNumber = this.validateEnrollmentNumber(
          payload.enrollmentNumber,
        );
        // Buscar empresa_id do aluno atual para verificar duplicata na mesma empresa
        const currentStudent = await this.repository.findById(id);
        const empresaId = currentStudent?.empresaId ?? undefined;

        const existingByEnrollment =
          await this.repository.findByEnrollmentNumber(
            enrollmentNumber,
            empresaId,
          );
        if (existingByEnrollment && existingByEnrollment.id !== id) {
          throw new StudentConflictError(
            `Student with enrollment number "${enrollmentNumber}" already exists in this empresa`,
          );
        }
        updateData.enrollmentNumber = enrollmentNumber;
      } else {
        updateData.enrollmentNumber = null;
      }
    }

    if (payload.instagram !== undefined) {
      updateData.instagram = payload.instagram
        ? this.validateSocialHandle(payload.instagram)
        : null;
    }

    if (payload.twitter !== undefined) {
      updateData.twitter = payload.twitter
        ? this.validateSocialHandle(payload.twitter)
        : null;
    }

    if (payload.courseIds !== undefined) {
      const courseIds = this.validateCourseIds(payload.courseIds);
      const courses = await this.fetchCourses(courseIds);
      if (courses.length !== courseIds.length) {
        throw new StudentValidationError(
          "Um ou mais cursos selecionados são inválidos.",
        );
      }
      updateData.courseIds = courseIds;
    }

    if (payload.temporaryPassword !== undefined) {
      if (payload.temporaryPassword === null || payload.temporaryPassword === "") {
        // Limpar a senha temporária (usado no fluxo de primeiro acesso)
        updateData.temporaryPassword = null;
      } else {
        const sanitizedPassword = payload.temporaryPassword.trim();
        if (sanitizedPassword.length < 8) {
          throw new StudentValidationError(
            "A senha temporária deve ter pelo menos 8 caracteres.",
          );
        }

        await this.updateAuthPassword(id, sanitizedPassword, true);
        updateData.temporaryPassword = sanitizedPassword;
        updateData.mustChangePassword = true;
      }
    }

    if (payload.mustChangePassword !== undefined) {
      updateData.mustChangePassword = payload.mustChangePassword;
    }

    if (payload.quotaExtra !== undefined) {
      if (payload.quotaExtra < 0) {
        throw new StudentValidationError("Quota extra cannot be negative");
      }
      updateData.quotaExtra = payload.quotaExtra;
    }

    return this.repository.update(id, updateData);
  }

  async delete(id: string, empresaId: string): Promise<void> {
    await this.ensureExists(id);
    await this.repository.delete(id, empresaId);
  }

  async getById(id: string): Promise<Student> {
    return this.ensureExists(id);
  }

  async findById(id: string): Promise<Student | null> {
    return this.repository.findById(id);
  }

  async findByEmail(email: string): Promise<Student | null> {
    return this.repository.findByEmail(email);
  }

  async addCourses(studentId: string, courseIds: string[]): Promise<void> {
    return this.repository.addCourses(studentId, courseIds);
  }

  async findByEmailIncludingDeleted(email: string): Promise<Student | null> {
    return this.repository.findByEmailIncludingDeleted(email);
  }

  async restoreSoftDeleted(id: string): Promise<void> {
    return this.repository.restoreSoftDeleted(id);
  }

  private validateFullName(fullName?: string): string {
    const trimmed = fullName?.trim();
    if (!trimmed) {
      throw new StudentValidationError("Full name cannot be empty");
    }

    if (trimmed.length < FULL_NAME_MIN_LENGTH) {
      throw new StudentValidationError(
        `Full name must have at least ${FULL_NAME_MIN_LENGTH} characters`,
      );
    }

    if (trimmed.length > FULL_NAME_MAX_LENGTH) {
      throw new StudentValidationError(
        `Full name must have at most ${FULL_NAME_MAX_LENGTH} characters`,
      );
    }

    return trimmed;
  }

  private validateEmail(email?: string): string {
    const trimmed = email?.trim().toLowerCase();
    if (!trimmed) {
      throw new StudentValidationError("Email is required");
    }

    if (trimmed.length > EMAIL_MAX_LENGTH) {
      throw new StudentValidationError(
        `Email must have at most ${EMAIL_MAX_LENGTH} characters`,
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      throw new StudentValidationError("Invalid email format");
    }

    return trimmed;
  }

  private validateCpf(cpf?: string): string {
    let cleaned = normalizeCpf(cpf || "");
    // Regra: se vier com 8, 9 ou 10 dígitos, completa com 0 à esquerda até 11.
    // Aceita qualquer quantidade de dígitos, mas completa apenas se estiver entre 8-10.
    if (cleaned.length >= 8 && cleaned.length <= 10) {
      cleaned = cleaned.padStart(CPF_LENGTH, "0");
    }
    if (!cleaned || cleaned.length !== CPF_LENGTH) {
      throw new StudentValidationError(
        `CPF must have exactly ${CPF_LENGTH} digits`,
      );
    }
    return cleaned;
  }

  private validatePhone(phone?: string): string {
    // Regra para importação (e sistema): aceitar qualquer quantidade de dígitos,
    // com DDD ou sem DDD, com ou sem código 55, 8 ou 9 dígitos.
    // Persistimos apenas os números, sem validação de tamanho.
    const cleaned = (phone ?? "").replace(/\D/g, "");
    if (!cleaned) {
      throw new StudentValidationError("Phone cannot be empty");
    }
    return cleaned;
  }

  private validateZipCode(zipCode?: string): string {
    const cleaned = zipCode?.replace(/\D/g, "");
    if (!cleaned || cleaned.length !== ZIP_CODE_LENGTH) {
      throw new StudentValidationError(
        `ZIP code must have exactly ${ZIP_CODE_LENGTH} digits`,
      );
    }

    return cleaned;
  }

  private validateEnrollmentNumber(enrollmentNumber?: string): string {
    const trimmed = enrollmentNumber?.trim();
    if (!trimmed) {
      throw new StudentValidationError("Enrollment number cannot be empty");
    }

    if (trimmed.length > ENROLLMENT_NUMBER_MAX_LENGTH) {
      throw new StudentValidationError(
        `Enrollment number must have at most ${ENROLLMENT_NUMBER_MAX_LENGTH} characters`,
      );
    }

    return trimmed;
  }

  private validateSocialHandle(handle?: string): string {
    const trimmed = handle?.trim();
    if (!trimmed) {
      throw new StudentValidationError("Social handle cannot be empty");
    }

    if (trimmed.length > SOCIAL_HANDLE_MAX_LENGTH) {
      throw new StudentValidationError(
        `Social handle must have at most ${SOCIAL_HANDLE_MAX_LENGTH} characters`,
      );
    }

    return trimmed;
  }

  private validateDate(dateString?: string): Date {
    if (!dateString) {
      throw new StudentValidationError("Date is required");
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new StudentValidationError("Invalid date format");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date > today) {
      throw new StudentValidationError("Birth date cannot be in the future");
    }

    return date;
  }

  private async ensureExists(id: string): Promise<Student> {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new StudentNotFoundError(`Student with id "${id}" was not found`);
    }

    return student;
  }

  private validateCourseIds(courseIds?: string[]): string[] {
    if (!courseIds || courseIds.length < COURSE_MIN_SELECTION) {
      throw new StudentValidationError(
        "Selecione pelo menos um curso para o aluno.",
      );
    }

    const unique = Array.from(new Set(courseIds));
    const sanitized = unique.map((id) => id.trim()).filter(Boolean);

    if (!sanitized.length) {
      throw new StudentValidationError(
        "Selecione pelo menos um curso para o aluno.",
      );
    }

    return sanitized;
  }

  private async fetchCourses(
    courseIds: string[],
  ): Promise<{ id: string; name: string }[]> {
    if (!courseIds.length) {
      return [];
    }

    const { data, error } = await getDatabaseClient()
      .from("cursos")
      .select("id, nome")
      .in("id", courseIds);

    if (error) {
      throw new Error(`Failed to fetch courses: ${error.message}`);
    }

    return (
      data?.map((course) => ({
        id: course.id,
        name: course.nome,
      })) ?? []
    );
  }

  private generateDefaultPassword(cpf: string): string {
    // A senha temporária será apenas os números do CPF
    return cpf.replace(/\D/g, "");
  }

  private async updateAuthPassword(
    userId: string,
    newPassword: string,
    mustChangePassword: boolean,
  ): Promise<void> {
    await super.updateAuthUser(userId, {
      password: newPassword,
      mustChangePassword: mustChangePassword,
    });
  }
}

export function createStudentService(client: SupabaseClient): StudentService {
  const repository = new StudentRepositoryImpl(client);
  return new StudentService(repository);
}
