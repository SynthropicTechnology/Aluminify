/**
 * Tipos de dominio para respostas do aluno.
 *
 * respostas_aluno e append-only: cada resposta a uma questao numa lista
 * fica gravada com sua `tentativa` (1-based). Refazer a lista incrementa
 * a tentativa em vez de sobrescrever — o historico de erros e tempo
 * por questao e preservado para metricas e revisao do professor.
 */

import type { LetraAlternativa, LetraGabarito, ContentBlock } from "./questao";

export interface RespostaAluno {
  id: string;
  empresaId: string;
  usuarioId: string;
  listaId: string;
  questaoId: string;
  tentativa: number;
  alternativaEscolhida: LetraAlternativa;
  correta: boolean;
  tempoRespostaSegundos: number | null;
  alternativasRiscadas: LetraAlternativa[];
  respondidaEm: Date;
}

/** Input do POST /api/listas/[id]/responder. */
export interface RegistrarRespostaInput {
  empresaId: string;
  usuarioId: string;
  listaId: string;
  questaoId: string;
  tentativa: number;
  alternativaEscolhida: LetraAlternativa;
  tempoRespostaSegundos?: number | null;
  alternativasRiscadas?: LetraAlternativa[];
}

/**
 * Resposta retornada pelo POST /responder quando modo = 'por_questao'.
 * Inclui gabarito e resolucao para feedback imediato.
 */
export interface RespostaPorQuestao {
  resposta: RespostaAluno;
  correta: boolean;
  gabarito: LetraGabarito;
  resolucaoTexto: ContentBlock[] | null;
  resolucaoVideoUrl: string | null;
}

/** Resposta retornada pelo POST /responder quando modo = 'ao_final'. */
export interface RespostaAoFinal {
  registrada: true;
  /** Quantas questoes a tentativa atual ja tem respondidas. */
  totalRespondidasNaTentativa: number;
  totalQuestoesNaLista: number;
}

/** Item do array retornado pelo GET /api/listas/[id]/resultado. */
export interface ItemResultado {
  questaoId: string;
  alternativaEscolhida: LetraAlternativa;
  correta: boolean;
  gabarito: LetraGabarito;
  resolucaoTexto: ContentBlock[] | null;
  resolucaoVideoUrl: string | null;
}

export interface ResumoResultado {
  total: number;
  acertos: number;
  /** Percentual de acertos arredondado para 2 casas decimais. */
  percentual: number;
}

export interface ResultadoLista {
  listaId: string;
  usuarioId: string;
  tentativa: number;
  itens: ItemResultado[];
  resumo: ResumoResultado;
}

/** Resposta do GET /api/listas/[id]/progresso. */
export interface ProgressoLista {
  listaId: string;
  usuarioId: string;
  tentativaAtual: number;
  totalQuestoes: number;
  totalRespondidas: number;
  finalizada: boolean;
}
