import {
  Curso,
  CreateCursoInput,
  UpdateCursoInput,
  Modality,
  CourseType,
} from "./curso.types";
import { CursoRepository, PaginatedResult } from "./curso.repository";
import { CourseValidationError, CourseNotFoundError } from "./errors";
import { PaginationParams } from "@/app/shared/types/dtos/api-responses";

const VALID_MODALITIES: Modality[] = ["EAD", "LIVE"];
const VALID_COURSE_TYPES: CourseType[] = [
  "Superextensivo",
  "Extensivo",
  "Intensivo",
  "Superintensivo",
  "Revisão",
];

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 1000;
const YEAR_MIN = 2000;
const YEAR_MAX = 2100;
const ACCESS_MONTHS_MIN = 1;
const ACCESS_MONTHS_MAX = 36;

export class CursoService {
  constructor(private readonly repository: CursoRepository) {}

  async list(
    params?: PaginationParams,
    empresaId?: string,
  ): Promise<PaginatedResult<Curso>> {
    const result = await this.repository.list(params, empresaId);

    // Invalidar cache de estrutura se necessário (embora listagem geralmente use cache próprio)
    // Aqui não invalidamos, apenas retornamos
    // O cache é gerenciado nos métodos de mutação (create, update, delete)

    return result;
  }

  async create(payload: CreateCursoInput): Promise<Curso> {
    // Validar empresaId é obrigatório
    if (!payload.empresaId) {
      throw new CourseValidationError("Empresa é obrigatória");
    }

    const name = this.validateName(payload.name);
    const modality = this.validateModality(payload.modality);
    const type = this.validateCourseType(payload.type);
    const year = this.validateYear(payload.year);
    const description = payload.description
      ? this.validateDescription(payload.description)
      : undefined;
    const accessMonths = this.validateAccessMonths(payload.accessMonths);

    if (!payload.startDate) {
      throw new CourseValidationError("Data de início é obrigatória");
    }
    if (!payload.endDate) {
      throw new CourseValidationError("Data de término é obrigatória");
    }
    const startDate = this.validateDate(payload.startDate);
    const endDate = this.validateDate(payload.endDate);

    // Hotmart IDs (curso pode ter múltiplos). Prioridade: hotmartProductIds > hotmartProductId (legado)
    const hotmartProductIds = this.normalizeHotmartProductIds(
      payload.hotmartProductIds ??
        (payload.hotmartProductId ? [payload.hotmartProductId] : []),
    );

    if (startDate && endDate && startDate > endDate) {
      throw new CourseValidationError(
        "Data de início deve ser anterior ou igual à data de término",
      );
    }

    if (!payload.segmentId) {
      throw new CourseValidationError("Segmento é obrigatório");
    }
    await this.ensureSegmentExists(payload.segmentId);

    // Validar disciplinas: usar disciplineIds se fornecido, senão usar disciplineId (compatibilidade)
    const disciplineIds =
      payload.disciplineIds ??
      (payload.disciplineId ? [payload.disciplineId] : []);

    if (disciplineIds.length === 0) {
      throw new CourseValidationError(
        "Selecione pelo menos uma disciplina",
      );
    }

    if (disciplineIds.length > 0) {
      const uniqueIds = Array.from(new Set(disciplineIds));
      const existingIds =
        await this.repository.getExistingDisciplineIds(uniqueIds);

      if (existingIds.length !== uniqueIds.length) {
        const existingSet = new Set(existingIds);
        for (const id of uniqueIds) {
          if (!existingSet.has(id)) {
            throw new CourseValidationError(
              `Disciplina com id "${id}" não encontrada`,
            );
          }
        }
      }
    }

    const course = await this.repository.create({
      empresaId: payload.empresaId,
      segmentId: payload.segmentId ?? undefined,
      disciplineId: payload.disciplineId ?? undefined, // Mantido para compatibilidade
      disciplineIds: disciplineIds, // Nova propriedade
      name,
      modality,
      modalityId: payload.modalityId ?? undefined,
      type,
      description,
      year,
      startDate: startDate?.toISOString().split("T")[0],
      endDate: endDate?.toISOString().split("T")[0],
      accessMonths,
      planningUrl: payload.planningUrl ?? undefined,
      coverImageUrl: payload.coverImageUrl ?? undefined,
      hotmartProductIds,
      hotmartProductId: payload.hotmartProductId ?? undefined,
    });

    // Invalidar cache de estrutura hierárquica e listagem (por empresa)
    const { courseStructureCacheService, cacheService } =
      await import("@/app/shared/core/services/cache");
    await courseStructureCacheService.invalidateCourse(course.id);
    await cacheService.del(`courses:list:empresa:${payload.empresaId}:all`);
    // Também limpar cache legado (sem empresa) para segurança
    await cacheService.del("courses:list:all");

    return course;
  }

  async update(id: string, payload: UpdateCursoInput): Promise<Curso> {
    await this.ensureExists(id);

    const updateData: UpdateCursoInput = {};

    if (payload.name !== undefined) {
      updateData.name = this.validateName(payload.name);
    }

    if (payload.modality !== undefined) {
      updateData.modality = this.validateModality(payload.modality);
    }

    if (payload.type !== undefined) {
      updateData.type = this.validateCourseType(payload.type);
    }

    if (payload.year !== undefined) {
      updateData.year = this.validateYear(payload.year);
    }

    if (payload.description !== undefined) {
      updateData.description = payload.description
        ? this.validateDescription(payload.description)
        : null;
    }

    if (payload.accessMonths !== undefined) {
      updateData.accessMonths = payload.accessMonths
        ? this.validateAccessMonths(payload.accessMonths)
        : null;
    }

    if (payload.startDate !== undefined) {
      updateData.startDate = payload.startDate
        ? this.validateDate(payload.startDate).toISOString().split("T")[0]
        : null;
    }

    if (payload.endDate !== undefined) {
      updateData.endDate = payload.endDate
        ? this.validateDate(payload.endDate).toISOString().split("T")[0]
        : null;
    }

    if (
      updateData.startDate &&
      updateData.endDate &&
      updateData.startDate > updateData.endDate
    ) {
      throw new CourseValidationError(
        "Data de início deve ser anterior ou igual à data de término",
      );
    }

    if (payload.segmentId !== undefined) {
      if (payload.segmentId) {
        await this.ensureSegmentExists(payload.segmentId);
      }
      updateData.segmentId = payload.segmentId;
    }

    // Validar disciplinas se fornecidas
    if (payload.disciplineIds !== undefined) {
      if (payload.disciplineIds.length > 0) {
        const uniqueIds = Array.from(new Set(payload.disciplineIds));
        const existingIds =
          await this.repository.getExistingDisciplineIds(uniqueIds);

        if (existingIds.length !== uniqueIds.length) {
          const existingSet = new Set(existingIds);
          for (const id of uniqueIds) {
            if (!existingSet.has(id)) {
              throw new CourseValidationError(
                `Disciplina com id "${id}" não encontrada`,
              );
            }
          }
        }
      }
      updateData.disciplineIds = payload.disciplineIds;
    } else if (payload.disciplineId !== undefined) {
      // Compatibilidade: se disciplineId foi fornecido, validar e converter para array
      if (payload.disciplineId) {
        await this.ensureDisciplineExists(payload.disciplineId);
        updateData.disciplineIds = [payload.disciplineId];
      } else {
        updateData.disciplineIds = [];
      }
      updateData.disciplineId = payload.disciplineId; // Mantido para compatibilidade
    }

    if (payload.planningUrl !== undefined) {
      updateData.planningUrl = payload.planningUrl;
    }

    if (payload.coverImageUrl !== undefined) {
      updateData.coverImageUrl = payload.coverImageUrl;
    }

    if (payload.usaTurmas !== undefined) {
      updateData.usaTurmas = payload.usaTurmas;
    }

    if (payload.hotmartProductId !== undefined) {
      updateData.hotmartProductId = payload.hotmartProductId;
    }

    if (payload.hotmartProductIds !== undefined) {
      updateData.hotmartProductIds =
        this.normalizeHotmartProductIds(payload.hotmartProductIds);
    }

    const course = await this.repository.update(id, updateData);

    // Invalidar cache de estrutura hierárquica e listagem (por empresa)
    const { courseStructureCacheService, cacheService } =
      await import("@/app/shared/core/services/cache");
    await courseStructureCacheService.invalidateCourse(id);
    if (course.empresaId) {
      await cacheService.del(`courses:list:empresa:${course.empresaId}:all`);
    }
    await cacheService.del("courses:list:all");

    return course;
  }

  private normalizeHotmartProductIds(ids: string[]): string[] {
    const normalized = ids
      .map((id) => (typeof id === "string" ? id.trim() : ""))
      .filter((id) => id.length > 0);
    return Array.from(new Set(normalized));
  }

  async delete(id: string): Promise<void> {
    const course = await this.ensureExists(id);
    await this.repository.delete(id);

    // Invalidar cache de estrutura hierárquica e listagem (por empresa)
    const { courseStructureCacheService, cacheService } =
      await import("@/app/shared/core/services/cache");
    await courseStructureCacheService.invalidateCourse(id);
    if (course.empresaId) {
      await cacheService.del(`courses:list:empresa:${course.empresaId}:all`);
    }
    await cacheService.del("courses:list:all");
  }

  async getById(id: string): Promise<Curso> {
    return this.ensureExists(id);
  }

  private validateName(name?: string): string {
    const trimmed = name?.trim();
    if (!trimmed) {
      throw new CourseValidationError("Nome é obrigatório");
    }

    if (trimmed.length < NAME_MIN_LENGTH) {
      throw new CourseValidationError(
        `Nome deve ter pelo menos ${NAME_MIN_LENGTH} caracteres`,
      );
    }

    if (trimmed.length > NAME_MAX_LENGTH) {
      throw new CourseValidationError(
        `Nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres`,
      );
    }

    return trimmed;
  }

  private validateModality(modality?: Modality): Modality {
    if (!modality) {
      throw new CourseValidationError("Modalidade é obrigatória");
    }

    if (!VALID_MODALITIES.includes(modality)) {
      throw new CourseValidationError(
        `Modalidade deve ser uma das seguintes: ${VALID_MODALITIES.join(", ")}`,
      );
    }

    return modality;
  }

  private validateCourseType(type?: CourseType): CourseType {
    if (!type) {
      throw new CourseValidationError("Tipo é obrigatório");
    }

    if (!VALID_COURSE_TYPES.includes(type)) {
      throw new CourseValidationError(
        `Tipo deve ser um dos seguintes: ${VALID_COURSE_TYPES.join(", ")}`,
      );
    }

    return type;
  }

  private validateDescription(description?: string): string {
    const trimmed = description?.trim();
    if (!trimmed) {
      return "";
    }

    if (trimmed.length > DESCRIPTION_MAX_LENGTH) {
      throw new CourseValidationError(
        `Descrição deve ter no máximo ${DESCRIPTION_MAX_LENGTH} caracteres`,
      );
    }

    return trimmed;
  }

  private validateYear(year?: number): number {
    if (year === undefined || year === null) {
      throw new CourseValidationError("Ano é obrigatório");
    }

    if (!Number.isInteger(year) || year < YEAR_MIN || year > YEAR_MAX) {
      throw new CourseValidationError(
        `Ano deve ser um número inteiro entre ${YEAR_MIN} e ${YEAR_MAX}`,
      );
    }

    return year;
  }

  private validateAccessMonths(months?: number | null): number {
    if (months === undefined || months === null) {
      throw new CourseValidationError("Meses de acesso é obrigatório");
    }

    if (
      !Number.isInteger(months) ||
      months < ACCESS_MONTHS_MIN ||
      months > ACCESS_MONTHS_MAX
    ) {
      throw new CourseValidationError(
        `Meses de acesso deve ser um número inteiro entre ${ACCESS_MONTHS_MIN} e ${ACCESS_MONTHS_MAX}`,
      );
    }

    return months;
  }

  private validateDate(dateString?: string): Date {
    if (!dateString) {
      throw new CourseValidationError("Data é obrigatória");
    }

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new CourseValidationError("Formato de data inválido");
    }

    return date;
  }

  private async ensureExists(id: string): Promise<Curso> {
    const course = await this.repository.findById(id);
    if (!course) {
      throw new CourseNotFoundError(`Curso com id "${id}" não encontrado`);
    }

    return course;
  }

  private async ensureSegmentExists(segmentId: string): Promise<void> {
    const exists = await this.repository.segmentExists(segmentId);
    if (!exists) {
      throw new CourseValidationError(
        `Segmento com id "${segmentId}" não encontrado`,
      );
    }
  }

  private async ensureDisciplineExists(disciplineId: string): Promise<void> {
    const exists = await this.repository.disciplineExists(disciplineId);
    if (!exists) {
      throw new CourseValidationError(
        `Disciplina com id "${disciplineId}" não encontrada`,
      );
    }
  }
}
