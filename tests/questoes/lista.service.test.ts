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
  listPaginated: jest.fn(),
  getRelatorioData: jest.fn(),
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

  describe("getRelatorio", () => {
    function makeRelatorioData(overrides?: Partial<ReturnType<typeof defaultRelatorioData>>) {
      return { ...defaultRelatorioData(), ...overrides };
    }

    function defaultRelatorioData() {
      return {
        respostas: [] as Array<{
          usuario_id: string;
          questao_id: string;
          lista_id: string;
          correta: boolean;
          tempo_resposta_segundos: number | null;
          tentativa: number;
        }>,
        questoes: [] as Array<{
          id: string;
          disciplina: string | null;
          disciplina_id: string | null;
          frente_id: string | null;
          modulo_id: string | null;
          codigo: string | null;
          numero_original: number | null;
        }>,
        listas: [] as Array<{
          id: string;
          titulo: string;
          tipo: string;
          total_questoes: number;
        }>,
        usuarios: [] as Array<{ id: string; nome: string }>,
        frentes: [] as Array<{ id: string; nome: string }>,
        modulos: [] as Array<{ id: string; nome: string; frente_id: string | null; numero_modulo: number | null }>,
        cursos: [] as Array<{ id: string; nome: string }>,
        matriculas: [] as Array<{ usuario_id: string; curso_id: string }>,
      };
    }

    it("deve exigir empresaId", async () => {
      await expect(service.getRelatorio("")).rejects.toThrow(ListaValidationError);
    });

    it("deve retornar dados vazios quando não há listas", async () => {
      (mockListaRepo.getRelatorioData as jest.Mock).mockResolvedValue(makeRelatorioData());
      const res = await service.getRelatorio("emp-1");
      expect(res.resumo.totalListas).toBe(0);
      expect(res.resumo.totalAlunos).toBe(0);
      expect(res.resumo.aproveitamentoMedio).toBeNull();
      expect(res.porLista).toEqual([]);
      expect(res.porDisciplina).toEqual([]);
      expect(res.ranking).toEqual([]);
      expect(res.maisErradas).toEqual([]);
    });

    it("deve calcular métricas por lista corretamente", async () => {
      (mockListaRepo.getRelatorioData as jest.Mock).mockResolvedValue(makeRelatorioData({
        listas: [
          { id: "l1", titulo: "Lista 1", tipo: "exercicio", total_questoes: 3 },
        ],
        questoes: [
          { id: "q1", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 1 },
          { id: "q2", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 2 },
          { id: "q3", disciplina: "Português", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 3 },
        ],
        usuarios: [
          { id: "u1", nome: "Aluno 1" },
          { id: "u2", nome: "Aluno 2" },
        ],
        respostas: [
          { usuario_id: "u1", questao_id: "q1", lista_id: "l1", correta: true, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u1", questao_id: "q2", lista_id: "l1", correta: false, tempo_resposta_segundos: 45, tentativa: 1 },
          { usuario_id: "u1", questao_id: "q3", lista_id: "l1", correta: true, tempo_resposta_segundos: 20, tentativa: 1 },
          { usuario_id: "u2", questao_id: "q1", lista_id: "l1", correta: true, tempo_resposta_segundos: 25, tentativa: 1 },
          { usuario_id: "u2", questao_id: "q2", lista_id: "l1", correta: true, tempo_resposta_segundos: 35, tentativa: 1 },
        ],
      }));

      const res = await service.getRelatorio("emp-1");

      expect(res.resumo.totalListas).toBe(1);
      expect(res.resumo.totalAlunos).toBe(2);

      const lista = res.porLista[0];
      expect(lista.titulo).toBe("Lista 1");
      expect(lista.totalQuestoes).toBe(3);
      expect(lista.totalAlunosIniciaram).toBe(2);
      expect(lista.totalAlunosFinalizaram).toBe(1);
      expect(lista.aproveitamento).toBe(80); // 4/5 = 80%
      expect(lista.tempoMedio).toBe(31); // (30+45+20+25+35)/5 = 31
    });

    it("deve usar apenas última tentativa para cálculos", async () => {
      (mockListaRepo.getRelatorioData as jest.Mock).mockResolvedValue(makeRelatorioData({
        listas: [
          { id: "l1", titulo: "Lista 1", tipo: "exercicio", total_questoes: 1 },
        ],
        questoes: [
          { id: "q1", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 1 },
        ],
        usuarios: [{ id: "u1", nome: "Aluno 1" }],
        respostas: [
          { usuario_id: "u1", questao_id: "q1", lista_id: "l1", correta: false, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u1", questao_id: "q1", lista_id: "l1", correta: true, tempo_resposta_segundos: 20, tentativa: 2 },
        ],
      }));

      const res = await service.getRelatorio("emp-1");

      expect(res.porLista[0].aproveitamento).toBe(100);
      expect(res.ranking[0].acertos).toBe(1);
      expect(res.ranking[0].percentual).toBe(100);
    });

    it("deve agregar desempenho por disciplina", async () => {
      (mockListaRepo.getRelatorioData as jest.Mock).mockResolvedValue(makeRelatorioData({
        listas: [
          { id: "l1", titulo: "Lista 1", tipo: "exercicio", total_questoes: 3 },
        ],
        questoes: [
          { id: "q1", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 1 },
          { id: "q2", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 2 },
          { id: "q3", disciplina: "Português", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 3 },
        ],
        usuarios: [{ id: "u1", nome: "Aluno 1" }],
        respostas: [
          { usuario_id: "u1", questao_id: "q1", lista_id: "l1", correta: true, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u1", questao_id: "q2", lista_id: "l1", correta: false, tempo_resposta_segundos: 40, tentativa: 1 },
          { usuario_id: "u1", questao_id: "q3", lista_id: "l1", correta: true, tempo_resposta_segundos: 20, tentativa: 1 },
        ],
      }));

      const res = await service.getRelatorio("emp-1");

      expect(res.porDisciplina).toHaveLength(2);
      const mat = res.porDisciplina.find((d) => d.disciplina === "Matemática");
      expect(mat?.total).toBe(2);
      expect(mat?.acertos).toBe(1);
      expect(mat?.percentual).toBe(50);

      const pt = res.porDisciplina.find((d) => d.disciplina === "Português");
      expect(pt?.total).toBe(1);
      expect(pt?.acertos).toBe(1);
      expect(pt?.percentual).toBe(100);
    });

    it("deve ordenar ranking por percentual decrescente", async () => {
      (mockListaRepo.getRelatorioData as jest.Mock).mockResolvedValue(makeRelatorioData({
        listas: [
          { id: "l1", titulo: "Lista 1", tipo: "exercicio", total_questoes: 2 },
        ],
        questoes: [
          { id: "q1", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 1 },
          { id: "q2", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 2 },
        ],
        usuarios: [
          { id: "u1", nome: "Aluno Fraco" },
          { id: "u2", nome: "Aluno Forte" },
        ],
        respostas: [
          { usuario_id: "u1", questao_id: "q1", lista_id: "l1", correta: false, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u1", questao_id: "q2", lista_id: "l1", correta: false, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u2", questao_id: "q1", lista_id: "l1", correta: true, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u2", questao_id: "q2", lista_id: "l1", correta: true, tempo_resposta_segundos: 30, tentativa: 1 },
        ],
      }));

      const res = await service.getRelatorio("emp-1");

      expect(res.ranking[0].nome).toBe("Aluno Forte");
      expect(res.ranking[0].percentual).toBe(100);
      expect(res.ranking[1].nome).toBe("Aluno Fraco");
      expect(res.ranking[1].percentual).toBe(0);
    });

    it("deve listar questões mais erradas com mínimo de 3 respostas", async () => {
      (mockListaRepo.getRelatorioData as jest.Mock).mockResolvedValue(makeRelatorioData({
        listas: [
          { id: "l1", titulo: "Lista 1", tipo: "exercicio", total_questoes: 2 },
        ],
        questoes: [
          { id: "q1", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: "MAT-01", numero_original: 1 },
          { id: "q2", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 2 },
        ],
        usuarios: [
          { id: "u1", nome: "A1" },
          { id: "u2", nome: "A2" },
          { id: "u3", nome: "A3" },
        ],
        respostas: [
          { usuario_id: "u1", questao_id: "q1", lista_id: "l1", correta: false, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u2", questao_id: "q1", lista_id: "l1", correta: false, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u3", questao_id: "q1", lista_id: "l1", correta: false, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u1", questao_id: "q2", lista_id: "l1", correta: true, tempo_resposta_segundos: 30, tentativa: 1 },
          { usuario_id: "u2", questao_id: "q2", lista_id: "l1", correta: true, tempo_resposta_segundos: 30, tentativa: 1 },
        ],
      }));

      const res = await service.getRelatorio("emp-1");

      expect(res.maisErradas).toHaveLength(1);
      expect(res.maisErradas[0].questaoId).toBe("q1");
      expect(res.maisErradas[0].codigo).toBe("MAT-01");
      expect(res.maisErradas[0].percentualAcerto).toBe(0);
      expect(res.maisErradas[0].total).toBe(3);
    });

    it("deve excluir listas sem questões do relatório", async () => {
      (mockListaRepo.getRelatorioData as jest.Mock).mockResolvedValue(makeRelatorioData({
        listas: [
          { id: "l1", titulo: "Lista Vazia", tipo: "exercicio", total_questoes: 0 },
          { id: "l2", titulo: "Lista Com Questões", tipo: "simulado", total_questoes: 1 },
        ],
        questoes: [{ id: "q1", disciplina: "Matemática", disciplina_id: null, frente_id: null, modulo_id: null, codigo: null, numero_original: 1 }],
        usuarios: [{ id: "u1", nome: "A1" }],
        respostas: [
          { usuario_id: "u1", questao_id: "q1", lista_id: "l2", correta: true, tempo_resposta_segundos: 30, tentativa: 1 },
        ],
      }));

      const res = await service.getRelatorio("emp-1");

      expect(res.resumo.totalListas).toBe(1);
      expect(res.porLista).toHaveLength(1);
      expect(res.porLista[0].titulo).toBe("Lista Com Questões");
    });
  });
});
