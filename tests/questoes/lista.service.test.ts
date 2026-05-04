import { ListaService } from "@/app/shared/services/listas/lista.service";
import type { ListaRepository } from "@/app/shared/services/listas/lista.repository";
import type { RespostaRepository } from "@/app/shared/services/listas/resposta.repository";
import {
  ListaNotFoundError,
  ListaValidationError,
} from "@/app/shared/services/listas/errors";
import type {
  Lista,
  ListaComQuestoes,
  ListaResumo,
} from "@/app/shared/types/entities/lista";

const mockListaRepo = {
  list: jest.fn(),
  findById: jest.fn(),
  findByIdWithQuestoes: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  addQuestoes: jest.fn(),
  removeQuestao: jest.fn(),
  reorderQuestoes: jest.fn(),
  countQuestoes: jest.fn(),
} as unknown as jest.Mocked<ListaRepository>;

const mockRespostaRepo = {
  registrar: jest.fn(),
  findByUsuarioListaTentativa: jest.fn(),
  getMaxTentativa: jest.fn(),
  countRespostasNaTentativa: jest.fn(),
} as unknown as jest.Mocked<RespostaRepository>;

function makeLista(overrides?: Partial<Lista>): Lista {
  return {
    id: "lista-1",
    empresaId: "emp-1",
    atividadeId: null,
    createdBy: "user-1",
    titulo: "Lista Teste",
    descricao: null,
    tipo: "exercicio",
    modosCorrecaoPermitidos: "por_questao",
    embaralharQuestoes: false,
    embaralharAlternativas: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeListaResumo(overrides?: Partial<ListaResumo>): ListaResumo {
  return {
    ...makeLista(overrides),
    totalQuestoes: 1,
    disciplinas: [],
    ...overrides,
  };
}

function makeListaComQuestoes(overrides?: Partial<ListaComQuestoes>): ListaComQuestoes {
  return {
    ...makeLista(),
    questoes: [
      {
        id: "q-1",
        empresaId: "emp-1",
        numeroOriginal: 1,
        instituicao: null,
        ano: null,
        disciplina: null,
        dificuldade: null,
        textoBase: null,
        enunciado: [{ type: "paragraph", text: "Pergunta 1" }],
        gabarito: "A",
        resolucaoTexto: null,
        resolucaoVideoUrl: null,
        tags: [],
        importacaoJobId: null,
        createdBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        alternativas: [
          { id: "a1", letra: "a", texto: "Sim", imagemPath: null, ordem: 0 },
          { id: "a2", letra: "b", texto: "Nao", imagemPath: null, ordem: 1 },
        ],
      },
    ] as any,
    ...overrides,
  };
}

describe("ListaService", () => {
  let service: ListaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ListaService(mockListaRepo, mockRespostaRepo);
  });

  describe("list", () => {
    it("deve exigir empresaId", async () => {
      await expect(service.list("")).rejects.toThrow(ListaValidationError);
    });

    it("deve retornar listas da empresa", async () => {
      (mockListaRepo.list as jest.Mock).mockResolvedValue([makeListaResumo()]);
      const res = await service.list("emp-1");
      expect(res).toHaveLength(1);
    });

    it("deve retornar apenas listas com questoes disponiveis", async () => {
      (mockListaRepo.list as jest.Mock).mockResolvedValue([
        makeListaResumo({ id: "lista-vazia", totalQuestoes: 0 }),
        makeListaResumo({ id: "lista-disponivel", totalQuestoes: 24 }),
      ]);

      const res = await service.listAvailable("emp-1");

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("lista-disponivel");
    });
  });

  describe("getById", () => {
    it("deve lancar erro se nao encontrada", async () => {
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(null);
      await expect(service.getById("x")).rejects.toThrow(ListaNotFoundError);
    });

    it("deve lancar erro se empresa nao confere", async () => {
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(
        makeListaComQuestoes({ empresaId: "emp-1" }),
      );
      await expect(service.getById("lista-1", "emp-other")).rejects.toThrow(
        ListaNotFoundError,
      );
    });

    it("deve retornar lista com questoes", async () => {
      const lista = makeListaComQuestoes();
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      const res = await service.getById("lista-1", "emp-1");
      expect(res.questoes).toHaveLength(1);
    });
  });

  describe("create", () => {
    it("deve exigir titulo", async () => {
      await expect(
        service.create({ empresaId: "emp-1", titulo: "", createdBy: null }),
      ).rejects.toThrow(ListaValidationError);
    });

    it("deve criar lista valida", async () => {
      const lista = makeLista();
      (mockListaRepo.create as jest.Mock).mockResolvedValue(lista);
      const res = await service.create({
        empresaId: "emp-1",
        titulo: "Nova Lista",
        createdBy: "user-1",
      });
      expect(res.id).toBe("lista-1");
    });
  });

  describe("delete", () => {
    it("deve lancar erro se nao encontrada", async () => {
      (mockListaRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(service.delete("x")).rejects.toThrow(ListaNotFoundError);
    });

    it("deve chamar softDelete", async () => {
      (mockListaRepo.findById as jest.Mock).mockResolvedValue(makeLista());
      await service.delete("lista-1", "emp-1");
      expect(mockListaRepo.softDelete).toHaveBeenCalledWith("lista-1");
    });
  });

  describe("addQuestoes", () => {
    it("deve lancar erro se lista nao encontrada", async () => {
      (mockListaRepo.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        service.addQuestoes("x", ["q-1"], "emp-1"),
      ).rejects.toThrow(ListaNotFoundError);
    });

    it("deve lancar erro se empresa nao confere", async () => {
      (mockListaRepo.findById as jest.Mock).mockResolvedValue(
        makeLista({ empresaId: "emp-1" }),
      );
      await expect(
        service.addQuestoes("lista-1", ["q-1"], "emp-other"),
      ).rejects.toThrow(ListaNotFoundError);
    });
  });

  describe("getParaAluno", () => {
    it("deve ocultar lista sem questoes para aluno", async () => {
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(
        makeListaComQuestoes({ questoes: [] }),
      );

      await expect(
        service.getParaAluno("lista-1", "user-1", "emp-1"),
      ).rejects.toThrow(ListaNotFoundError);
      expect(mockRespostaRepo.getMaxTentativa).not.toHaveBeenCalled();
    });

    it("deve expor gabarito em modo por_questao quando ja respondeu", async () => {
      const lista = makeListaComQuestoes({ modosCorrecaoPermitidos: "por_questao" });
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.countRespostasNaTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.findByUsuarioListaTentativa as jest.Mock).mockResolvedValue([
        { questaoId: "q-1", alternativaEscolhida: "a", correta: true },
      ]);

      const res = await service.getParaAluno("lista-1", "user-1", "emp-1");
      const questao = res.questoes[0];
      expect((questao as any).gabarito).toBe("A");
    });

    it("nao deve expor gabarito em modo ao_final quando nao finalizou", async () => {
      const lista = makeListaComQuestoes({ modosCorrecaoPermitidos: "ao_final" });
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.countRespostasNaTentativa as jest.Mock).mockResolvedValue(0);
      (mockRespostaRepo.findByUsuarioListaTentativa as jest.Mock).mockResolvedValue([]);

      const res = await service.getParaAluno("lista-1", "user-1", "emp-1");
      const questao = res.questoes[0];
      expect((questao as any).gabarito).toBeUndefined();
    });
  });
});
