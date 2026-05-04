import { RespostaService } from "@/app/shared/services/listas/resposta.service";
import type { RespostaRepository } from "@/app/shared/services/listas/resposta.repository";
import type { ListaRepository } from "@/app/shared/services/listas/lista.repository";
import {
  ListaNotFoundError,
  RespostaValidationError,
} from "@/app/shared/services/listas/errors";
import type { ListaComQuestoes } from "@/app/shared/types/entities/lista";

const mockRespostaRepo = {
  registrar: jest.fn(),
  findByUsuarioListaTentativa: jest.fn(),
  getMaxTentativa: jest.fn(),
  countRespostasNaTentativa: jest.fn(),
  getPercentualAcertoPorQuestao: jest.fn(),
} as unknown as jest.Mocked<RespostaRepository>;

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

function makeListaComQuestoes(): ListaComQuestoes {
  return {
    id: "lista-1",
    empresaId: "emp-1",
    atividadeId: null,
    createdBy: null,
    titulo: "Lista",
    descricao: null,
    tipo: "exercicio",
    modosCorrecaoPermitidos: "por_questao",
    embaralharQuestoes: false,
    embaralharAlternativas: false,
    createdAt: new Date(),
    updatedAt: new Date(),
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
        enunciado: [{ type: "paragraph", text: "Pergunta" }],
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
  };
}

describe("RespostaService", () => {
  let service: RespostaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RespostaService(mockRespostaRepo, mockListaRepo);
  });

  describe("responder", () => {
    it("deve lancar erro se lista nao encontrada", async () => {
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(null);
      await expect(
        service.responder("lista-x", "user-1", "emp-1", {
          questaoId: "q-1",
          alternativaEscolhida: "a",
        }),
      ).rejects.toThrow(ListaNotFoundError);
    });

    it("deve lancar erro se empresa nao confere", async () => {
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(
        makeListaComQuestoes(),
      );
      await expect(
        service.responder("lista-1", "user-1", "emp-other", {
          questaoId: "q-1",
          alternativaEscolhida: "a",
        }),
      ).rejects.toThrow(ListaNotFoundError);
    });

    it("deve lancar erro se questao nao pertence a lista", async () => {
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(
        makeListaComQuestoes(),
      );
      await expect(
        service.responder("lista-1", "user-1", "emp-1", {
          questaoId: "q-other",
          alternativaEscolhida: "a",
        }),
      ).rejects.toThrow(RespostaValidationError);
    });

    it("deve registrar resposta correta em modo por_questao", async () => {
      const lista = makeListaComQuestoes();
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(0);
      const resposta = {
        id: "r-1",
        empresaId: "emp-1",
        usuarioId: "user-1",
        listaId: "lista-1",
        questaoId: "q-1",
        tentativa: 1,
        alternativaEscolhida: "a",
        correta: true,
        tempoRespostaSegundos: null,
        alternativasRiscadas: [],
        respondidaEm: new Date(),
      };
      (mockRespostaRepo.registrar as jest.Mock).mockResolvedValue(resposta);

      const res = await service.responder("lista-1", "user-1", "emp-1", {
        questaoId: "q-1",
        alternativaEscolhida: "a",
      });

      expect(res).toHaveProperty("correta", true);
      expect(res).toHaveProperty("gabarito", "A");
    });

    it("deve registrar resposta em modo ao_final", async () => {
      const lista = makeListaComQuestoes();
      lista.modosCorrecaoPermitidos = "ao_final";
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(0);
      (mockRespostaRepo.registrar as jest.Mock).mockResolvedValue({
        id: "r-1",
        correta: true,
      });
      (mockRespostaRepo.countRespostasNaTentativa as jest.Mock).mockResolvedValue(1);

      const res = await service.responder("lista-1", "user-1", "emp-1", {
        questaoId: "q-1",
        alternativaEscolhida: "a",
      });

      expect(res).toHaveProperty("registrada", true);
      expect(res).toHaveProperty("totalRespondidasNaTentativa", 1);
    });

    it("deve detectar resposta duplicada", async () => {
      const lista = makeListaComQuestoes();
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(0);
      (mockRespostaRepo.registrar as jest.Mock).mockRejectedValue(
        new Error("DUPLICATE_RESPOSTA"),
      );

      await expect(
        service.responder("lista-1", "user-1", "emp-1", {
          questaoId: "q-1",
          alternativaEscolhida: "a",
        }),
      ).rejects.toThrow("Questao ja respondida nesta tentativa");
    });

    it("deve iniciar tentativa 1 quando nenhuma existe", async () => {
      const lista = makeListaComQuestoes();
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(0);
      (mockRespostaRepo.registrar as jest.Mock).mockResolvedValue({
        id: "r-1", correta: false,
      });

      await service.responder("lista-1", "user-1", "emp-1", {
        questaoId: "q-1",
        alternativaEscolhida: "b",
      });

      expect(mockRespostaRepo.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ tentativa: 1 }),
      );
    });

    it("deve incrementar tentativa quando anterior esta completa", async () => {
      const lista = makeListaComQuestoes();
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.countRespostasNaTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.registrar as jest.Mock).mockResolvedValue({
        id: "r-2", correta: true,
      });

      await service.responder("lista-1", "user-1", "emp-1", {
        questaoId: "q-1",
        alternativaEscolhida: "a",
      });

      expect(mockRespostaRepo.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ tentativa: 2 }),
      );
    });
  });

  describe("getProgresso", () => {
    it("deve retornar progresso zerado sem tentativas", async () => {
      (mockListaRepo.countQuestoes as jest.Mock).mockResolvedValue(5);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(0);

      const res = await service.getProgresso("lista-1", "user-1");
      expect(res.tentativaAtual).toBe(1);
      expect(res.totalRespondidas).toBe(0);
      expect(res.finalizada).toBe(false);
    });

    it("deve indicar finalizada quando todas respondidas", async () => {
      (mockListaRepo.countQuestoes as jest.Mock).mockResolvedValue(2);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.countRespostasNaTentativa as jest.Mock).mockResolvedValue(2);

      const res = await service.getProgresso("lista-1", "user-1");
      expect(res.finalizada).toBe(true);
    });
  });

  describe("getResultado", () => {
    it("deve lancar erro se nenhuma tentativa encontrada", async () => {
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(
        makeListaComQuestoes(),
      );
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(0);

      await expect(
        service.getResultado("lista-1", "user-1"),
      ).rejects.toThrow("Nenhuma tentativa encontrada");
    });

    it("deve calcular acertos e percentual", async () => {
      const lista = makeListaComQuestoes();
      (mockListaRepo.findByIdWithQuestoes as jest.Mock).mockResolvedValue(lista);
      (mockRespostaRepo.getMaxTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.countRespostasNaTentativa as jest.Mock).mockResolvedValue(1);
      (mockRespostaRepo.findByUsuarioListaTentativa as jest.Mock).mockResolvedValue([
        {
          questaoId: "q-1",
          alternativaEscolhida: "a",
          correta: true,
          tempoRespostaSegundos: 30,
          respondidaEm: new Date(),
        },
      ]);
      (mockRespostaRepo.getPercentualAcertoPorQuestao as jest.Mock).mockResolvedValue(
        new Map([["q-1", 75]]),
      );

      const res = await service.getResultado("lista-1", "user-1");
      expect(res.resumo.acertos).toBe(1);
      expect(res.resumo.total).toBe(1);
      expect(res.resumo.percentual).toBe(100);
      expect(res.itens[0].tempoRespostaSegundos).toBe(30);
      expect(res.itens[0].percentualAcertoGeral).toBe(75);
    });
  });
});
