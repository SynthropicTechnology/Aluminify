import { QuestaoService } from "@/app/shared/services/questoes/questao.service";
import type { QuestaoRepository } from "@/app/shared/services/questoes/questao.repository";
import {
  QuestaoNotFoundError,
  QuestaoValidationError,
} from "@/app/shared/services/questoes/errors";
import type {
  QuestaoComAlternativas,
  CreateQuestaoInput,
} from "@/app/shared/types/entities/questao";

const mockRepo = {
  list: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
} as unknown as jest.Mocked<QuestaoRepository>;

function makeQuestao(overrides?: Partial<QuestaoComAlternativas>): QuestaoComAlternativas {
  return {
    id: "q-1",
    empresaId: "emp-1",
    numeroOriginal: 1,
    instituicao: null,
    ano: null,
    disciplina: "Matematica",
    dificuldade: null,
    textoBase: null,
    enunciado: [{ type: "paragraph", text: "Qual o valor de x?" }],
    gabarito: "A",
    resolucaoTexto: null,
    resolucaoVideoUrl: null,
    tags: [],
    importacaoJobId: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    alternativas: [
      { id: "a1", letra: "a", texto: "1", imagemPath: null, ordem: 0 },
      { id: "a2", letra: "b", texto: "2", imagemPath: null, ordem: 1 },
    ],
    ...overrides,
  } as QuestaoComAlternativas;
}

describe("QuestaoService", () => {
  let service: QuestaoService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new QuestaoService(mockRepo);
  });

  describe("list", () => {
    it("deve exigir empresaId", async () => {
      await expect(service.list({ empresaId: "" })).rejects.toThrow(
        QuestaoValidationError,
      );
    });

    it("deve retornar lista paginada", async () => {
      const result = { data: [makeQuestao()], nextCursor: null };
      (mockRepo.list as jest.Mock).mockResolvedValue(result);
      const res = await service.list({ empresaId: "emp-1" });
      expect(res.data).toHaveLength(1);
      expect(mockRepo.list).toHaveBeenCalledWith({ empresaId: "emp-1" });
    });
  });

  describe("getById", () => {
    it("deve lancar erro se nao encontrada", async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.getById("q-999")).rejects.toThrow(
        QuestaoNotFoundError,
      );
    });

    it("deve lancar erro se empresaId nao confere", async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(
        makeQuestao({ empresaId: "emp-1" }),
      );
      await expect(service.getById("q-1", "emp-other")).rejects.toThrow(
        QuestaoNotFoundError,
      );
    });

    it("deve retornar questao com alternativas", async () => {
      const q = makeQuestao();
      (mockRepo.findById as jest.Mock).mockResolvedValue(q);
      const res = await service.getById("q-1", "emp-1");
      expect(res.id).toBe("q-1");
    });
  });

  describe("create", () => {
    const validInput: CreateQuestaoInput = {
      empresaId: "emp-1",
      createdBy: "user-1",
      enunciado: [{ type: "paragraph", text: "Pergunta" }],
      gabarito: "A",
      alternativas: [
        { letra: "a", texto: "Opcao A", imagemPath: null, ordem: 0 },
        { letra: "b", texto: "Opcao B", imagemPath: null, ordem: 1 },
      ],
    };

    it("deve exigir empresaId", async () => {
      await expect(
        service.create({ ...validInput, empresaId: "" }),
      ).rejects.toThrow(QuestaoValidationError);
    });

    it("deve exigir enunciado", async () => {
      await expect(
        service.create({ ...validInput, enunciado: [] }),
      ).rejects.toThrow(QuestaoValidationError);
    });

    it("deve exigir gabarito", async () => {
      await expect(
        service.create({ ...validInput, gabarito: "" as any }),
      ).rejects.toThrow(QuestaoValidationError);
    });

    it("deve exigir minimo de 2 alternativas", async () => {
      await expect(
        service.create({
          ...validInput,
          alternativas: [{ letra: "a", texto: "Unica", imagemPath: null, ordem: 0 }],
        }),
      ).rejects.toThrow("Minimo de 2 alternativas");
    });

    it("deve validar gabarito corresponde a alternativa existente", async () => {
      await expect(
        service.create({ ...validInput, gabarito: "C" }),
      ).rejects.toThrow("nao corresponde a nenhuma alternativa");
    });

    it("deve criar questao valida", async () => {
      const q = makeQuestao();
      (mockRepo.create as jest.Mock).mockResolvedValue(q);
      const res = await service.create(validInput);
      expect(res.id).toBe("q-1");
      expect(mockRepo.create).toHaveBeenCalledWith(validInput);
    });
  });

  describe("delete", () => {
    it("deve lancar erro se nao encontrada", async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.delete("q-999")).rejects.toThrow(
        QuestaoNotFoundError,
      );
    });

    it("deve lancar erro se empresa nao confere", async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(
        makeQuestao({ empresaId: "emp-1" }),
      );
      await expect(service.delete("q-1", "emp-other")).rejects.toThrow(
        QuestaoNotFoundError,
      );
    });

    it("deve chamar softDelete", async () => {
      (mockRepo.findById as jest.Mock).mockResolvedValue(makeQuestao());
      await service.delete("q-1", "emp-1");
      expect(mockRepo.softDelete).toHaveBeenCalledWith("q-1");
    });
  });
});
