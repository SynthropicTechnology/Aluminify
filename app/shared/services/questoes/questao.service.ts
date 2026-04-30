import type {
  QuestaoComAlternativas,
  CreateQuestaoInput,
  UpdateQuestaoInput,
  ListQuestoesFilter,
  PaginatedQuestoes,
} from "@/app/shared/types/entities/questao";
import type { QuestaoRepository } from "./questao.repository";
import { QuestaoNotFoundError, QuestaoValidationError } from "./errors";

export class QuestaoService {
  constructor(private readonly repository: QuestaoRepository) {}

  async list(filter: ListQuestoesFilter): Promise<PaginatedQuestoes> {
    if (!filter.empresaId) {
      throw new QuestaoValidationError("empresaId is required");
    }
    return this.repository.list(filter);
  }

  async getById(
    id: string,
    empresaId?: string,
  ): Promise<QuestaoComAlternativas> {
    const questao = await this.ensureExists(id);
    if (empresaId && questao.empresaId !== empresaId) {
      throw new QuestaoNotFoundError(id);
    }
    return questao;
  }

  async create(input: CreateQuestaoInput): Promise<QuestaoComAlternativas> {
    if (!input.empresaId) {
      throw new QuestaoValidationError("empresaId is required");
    }
    if (!input.enunciado || input.enunciado.length === 0) {
      throw new QuestaoValidationError("enunciado is required");
    }
    if (!input.gabarito) {
      throw new QuestaoValidationError("gabarito is required");
    }
    if (!input.alternativas || input.alternativas.length < 2) {
      throw new QuestaoValidationError(
        "Minimo de 2 alternativas obrigatorio",
      );
    }

    const gabaritoLower = input.gabarito.toLowerCase();
    const hasGabaritoAlternativa = input.alternativas.some(
      (a) => a.letra === gabaritoLower,
    );
    if (!hasGabaritoAlternativa) {
      throw new QuestaoValidationError(
        `Gabarito '${input.gabarito}' nao corresponde a nenhuma alternativa`,
      );
    }

    return this.repository.create(input);
  }

  async update(
    id: string,
    input: UpdateQuestaoInput,
    empresaId?: string,
  ): Promise<QuestaoComAlternativas> {
    const existing = await this.ensureExists(id);
    if (empresaId && existing.empresaId !== empresaId) {
      throw new QuestaoNotFoundError(id);
    }

    if (input.gabarito && input.alternativas) {
      const gabaritoLower = input.gabarito.toLowerCase();
      const hasGabaritoAlternativa = input.alternativas.some(
        (a) => a.letra === gabaritoLower,
      );
      if (!hasGabaritoAlternativa) {
        throw new QuestaoValidationError(
          `Gabarito '${input.gabarito}' nao corresponde a nenhuma alternativa`,
        );
      }
    }

    return this.repository.update(id, input);
  }

  async delete(id: string, empresaId?: string): Promise<void> {
    const existing = await this.ensureExists(id);
    if (empresaId && existing.empresaId !== empresaId) {
      throw new QuestaoNotFoundError(id);
    }
    await this.repository.softDelete(id);
  }

  private async ensureExists(id: string): Promise<QuestaoComAlternativas> {
    const questao = await this.repository.findById(id);
    if (!questao) {
      throw new QuestaoNotFoundError(id);
    }
    return questao;
  }
}
