/**
 * Tipos de dominio para listas de exercicios (simulados).
 *
 * Uma lista e uma colecao ordenada de questoes do banco, opcionalmente
 * vinculada a uma `atividade` existente. O modo de correcao define se
 * o aluno ve gabarito apos cada questao ou somente apos finalizar.
 */

import type { QuestaoComAlternativas, QuestaoResumo } from "./questao";

export type ModoCorrecao = "por_questao" | "ao_final";

export interface Lista {
  id: string;
  empresaId: string;
  atividadeId: string | null;
  createdBy: string | null;
  titulo: string;
  descricao: string | null;
  modoCorrecao: ModoCorrecao;
  embaralharQuestoes: boolean;
  embaralharAlternativas: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Lista com sua relacao de questoes — usada por GET /api/listas/[id]. */
export interface ListaComQuestoes extends Lista {
  /** Questoes na ordem definida em listas_exercicios_questoes.ordem. */
  questoes: QuestaoComAlternativas[];
}

/**
 * Versao "modo aluno" de uma questao dentro de uma lista — exclui
 * gabarito e resolucao quando modo_correcao = 'ao_final' e o aluno
 * ainda nao finalizou.
 */
export interface QuestaoEmListaParaAluno
  extends Omit<
    QuestaoComAlternativas,
    "resolucaoTexto" | "resolucaoVideoUrl" | "gabarito" | "alternativas"
  > {
  alternativas: Array<{
    id: string;
    letra: import("./questao").LetraAlternativa;
    texto: string;
    imagemPath: string | null;
    ordem: number;
    /** correta nunca e exposta para o aluno antes de responder. */
  }>;
  /** Presente apenas quando modo = 'por_questao' OU lista finalizada. */
  gabarito?: import("./questao").LetraGabarito;
  resolucaoTexto?: import("./questao").ContentBlock[] | null;
  resolucaoVideoUrl?: string | null;
}

export interface ListaParaAluno extends Lista {
  questoes: QuestaoEmListaParaAluno[];
  /** Numero da tentativa atual do aluno (>= 1). */
  tentativaAtual: number;
  /** Indica se a tentativa atual ja foi finalizada. */
  finalizada: boolean;
}

export interface CreateListaInput {
  empresaId: string;
  createdBy: string | null;
  titulo: string;
  descricao?: string | null;
  modoCorrecao?: ModoCorrecao;
  embaralharQuestoes?: boolean;
  embaralharAlternativas?: boolean;
  atividadeId?: string | null;
  questaoIds?: string[];
}

export interface UpdateListaInput {
  titulo?: string;
  descricao?: string | null;
  modoCorrecao?: ModoCorrecao;
  embaralharQuestoes?: boolean;
  embaralharAlternativas?: boolean;
  atividadeId?: string | null;
}

export interface ReorderQuestoesInput {
  ordens: Array<{ questaoId: string; ordem: number }>;
}

/** Item retornado pelo GET /api/listas (sem questoes em detalhe). */
export interface ListaResumo extends Lista {
  totalQuestoes: number;
}

export type { QuestaoResumo };
