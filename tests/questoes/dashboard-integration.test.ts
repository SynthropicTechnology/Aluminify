/**
 * Testes de integração: respostas do banco de questões na dashboard
 *
 * Verifica que os helpers de dedup e agregação funcionam corretamente
 * ao combinar dados de progresso_atividades (legado) com respostas_aluno (banco de questões).
 */

import { DashboardAnalyticsService } from "@/app/[tenant]/(modules)/dashboard/services/dashboard-analytics.service";

// Mock do getDatabaseClient
const mockFrom = jest.fn();
const mockClient = { from: mockFrom } as any;

jest.mock("@/app/shared/core/database/database", () => ({
  getDatabaseClient: () => mockClient,
}));

jest.mock("@/app/shared/core/database/database-auth", () => ({
  getServiceRoleClient: () => mockClient,
}));

function mockQuery(data: any[] | null = [], error: any = null) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockReturnThis(),
    then: undefined,
  };
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: any) =>
        resolve({ data, error, count: data?.length ?? 0 });
    },
  });
  return chain;
}

describe("Dashboard Integration - Banco de Questões", () => {
  let service: DashboardAnalyticsService;

  beforeEach(() => {
    service = new DashboardAnalyticsService();
    jest.clearAllMocks();
  });

  describe("getListasComAtividadeIds (via getRespostasBancoQuestoes)", () => {
    it("deve excluir respostas de listas com atividade_id", async () => {
      const calls: string[] = [];

      mockFrom.mockImplementation((table: string) => {
        calls.push(table);

        if (table === "progresso_atividades") {
          return mockQuery([
            { questoes_totais: 5, questoes_acertos: 3 },
          ]);
        }

        if (table === "listas_exercicios") {
          return mockQuery([{ id: "lista-legacy" }]);
        }

        if (table === "respostas_aluno") {
          return mockQuery([
            { correta: true, lista_id: "lista-legacy" },
            { correta: true, lista_id: "lista-nova" },
            { correta: false, lista_id: "lista-nova" },
          ]);
        }

        return mockQuery([]);
      });

      const result = await (service as any).getQuestionsAnswered(
        "aluno-1",
        mockClient,
        "mensal",
        "emp-1",
      );

      // Legacy: 5 questoes
      // Banco: 3 respostas, mas 1 é de lista-legacy (excluída) -> 2
      // Total: 5 + 2 = 7
      expect(result.questionsAnswered).toBe(7);
    });

    it("deve contar todas respostas quando não há listas com atividade_id", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "progresso_atividades") {
          return mockQuery([{ questoes_totais: 3 }]);
        }
        if (table === "listas_exercicios") {
          return mockQuery([]);
        }
        if (table === "respostas_aluno") {
          return mockQuery([
            { correta: true, lista_id: "lista-1" },
            { correta: false, lista_id: "lista-1" },
            { correta: true, lista_id: "lista-2" },
          ]);
        }
        return mockQuery([]);
      });

      const result = await (service as any).getQuestionsAnswered(
        "aluno-1",
        mockClient,
        "mensal",
      );

      // Legacy: 3, Banco: 3 (nenhuma excluída) -> 6
      expect(result.questionsAnswered).toBe(6);
    });
  });

  describe("getAccuracy com dados combinados", () => {
    it("deve combinar aproveitamento de ambas as fontes", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "progresso_atividades") {
          return mockQuery([
            { questoes_totais: 10, questoes_acertos: 7 },
          ]);
        }
        if (table === "listas_exercicios") {
          return mockQuery([]);
        }
        if (table === "respostas_aluno") {
          return mockQuery([
            { correta: true, lista_id: "l1" },
            { correta: true, lista_id: "l1" },
            { correta: false, lista_id: "l1" },
            { correta: false, lista_id: "l1" },
            { correta: false, lista_id: "l1" },
          ]);
        }
        return mockQuery([]);
      });

      const result = await (service as any).getAccuracy(
        "aluno-1",
        mockClient,
        "mensal",
      );

      // Legacy: 7/10, Banco: 2/5 -> combined: 9/15 = 60%
      expect(result).toBe(60);
    });

    it("deve retornar 0 quando não há dados", async () => {
      mockFrom.mockImplementation(() => mockQuery([]));

      const result = await (service as any).getAccuracy(
        "aluno-1",
        mockClient,
        "mensal",
      );

      expect(result).toBe(0);
    });
  });

  describe("getQuestionBankMetrics", () => {
    it("deve retornar métricas vazias quando não há respostas", async () => {
      mockFrom.mockImplementation(() => mockQuery([]));

      const result = await service.getQuestionBankMetrics(
        "aluno-1",
        "mensal",
      );

      expect(result.totalRespondidas).toBe(0);
      expect(result.acertos).toBe(0);
      expect(result.erros).toBe(0);
      expect(result.tempoMedio).toBeNull();
      expect(result.performancePorDisciplina).toEqual([]);
      expect(result.evolucaoTemporal).toEqual([]);
      expect(result.topicosMaisErrados).toEqual([]);
    });

    it("deve agregar métricas por disciplina", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "respostas_aluno") {
          return mockQuery([
            { questao_id: "q1", correta: true, tempo_resposta_segundos: 30, respondida_em: "2026-05-01T10:00:00Z", lista_id: "l1" },
            { questao_id: "q2", correta: false, tempo_resposta_segundos: 45, respondida_em: "2026-05-01T11:00:00Z", lista_id: "l1" },
            { questao_id: "q3", correta: true, tempo_resposta_segundos: 20, respondida_em: "2026-05-02T10:00:00Z", lista_id: "l1" },
          ]);
        }
        if (table === "banco_questoes") {
          return mockQuery([
            { id: "q1", disciplina_id: "d1", frente_id: null, modulo_id: null },
            { id: "q2", disciplina_id: "d1", frente_id: null, modulo_id: null },
            { id: "q3", disciplina_id: "d2", frente_id: null, modulo_id: null },
          ]);
        }
        if (table === "disciplinas") {
          return mockQuery([
            { id: "d1", nome: "Matemática" },
            { id: "d2", nome: "Português" },
          ]);
        }
        if (table === "frentes") {
          return mockQuery([]);
        }
        if (table === "modulos") {
          return mockQuery([]);
        }
        return mockQuery([]);
      });

      const result = await service.getQuestionBankMetrics(
        "aluno-1",
        "mensal",
      );

      expect(result.totalRespondidas).toBe(3);
      expect(result.acertos).toBe(2);
      expect(result.erros).toBe(1);
      expect(result.tempoMedio).toBe(32); // (30+45+20)/3 = 31.67 -> 32

      expect(result.performancePorDisciplina).toHaveLength(2);
      const mat = result.performancePorDisciplina.find(
        (d) => d.disciplinaNome === "Matemática",
      );
      expect(mat?.total).toBe(2);
      expect(mat?.acertos).toBe(1);
      expect(mat?.percentual).toBe(50);

      const pt = result.performancePorDisciplina.find(
        (d) => d.disciplinaNome === "Português",
      );
      expect(pt?.total).toBe(1);
      expect(pt?.acertos).toBe(1);
      expect(pt?.percentual).toBe(100);

      expect(result.evolucaoTemporal).toHaveLength(2);
      expect(result.evolucaoTemporal[0].data).toBe("2026-05-01");
      expect(result.evolucaoTemporal[1].data).toBe("2026-05-02");
    });

    it("deve calcular tópicos mais errados com mínimo de 3 respostas", async () => {
      const respostas = [];
      for (let i = 0; i < 5; i++) {
        respostas.push({
          questao_id: `q${i}`,
          correta: i < 1,
          tempo_resposta_segundos: 30,
          respondida_em: "2026-05-01T10:00:00Z",
          lista_id: "l1",
        });
      }

      mockFrom.mockImplementation((table: string) => {
        if (table === "respostas_aluno") return mockQuery(respostas);
        if (table === "banco_questoes") {
          return mockQuery(
            respostas.map((r) => ({
              id: r.questao_id,
              disciplina_id: "d1",
              frente_id: "f1",
              modulo_id: null,
            })),
          );
        }
        if (table === "disciplinas") {
          return mockQuery([{ id: "d1", nome: "Matemática" }]);
        }
        if (table === "frentes") {
          return mockQuery([{ id: "f1", nome: "Álgebra" }]);
        }
        if (table === "modulos") return mockQuery([]);
        return mockQuery([]);
      });

      const result = await service.getQuestionBankMetrics("aluno-1", "mensal");

      expect(result.topicosMaisErrados.length).toBeGreaterThan(0);
      expect(result.topicosMaisErrados[0].disciplinaNome).toBe("Matemática");
      expect(result.topicosMaisErrados[0].frenteNome).toBe("Álgebra");
      expect(result.topicosMaisErrados[0].totalErros).toBe(4);
      expect(result.topicosMaisErrados[0].totalRespondidas).toBe(5);
      expect(result.topicosMaisErrados[0].percentualErro).toBe(80);
    });
  });
});
