/**
 * Tipos de dominio para jobs de importacao de Word.
 *
 * O parser produz um array de QuestaoParseada (definido em
 * app/shared/library/parser/types.ts no Marco 4). O job persiste esse
 * array em questoes_json para que a tela de revisao possa edita-lo via
 * PATCH antes do POST /publicar persistir no banco.
 */

import type {
  ContentBlock,
  DificuldadeQuestao,
  LetraGabarito,
  LetraAlternativa,
} from "./questao";

export type StatusImportacao =
  | "processando"
  | "revisao"
  | "publicado"
  | "erro";

export interface ParseWarning {
  /** Numero da questao no Word original (se determinavel). */
  questao?: number;
  /** Codigo curto para classificacao (ex: "OMML_FALLBACK", "MISSING_GABARITO"). */
  code: string;
  message: string;
}

/**
 * Forma estavel de cada questao dentro de questoes_json — versao "shared"
 * usada pelo backend e pela tela de revisao do frontend. O parser pode
 * usar uma forma interna mais rica (ContentBlock com Buffer de imagem)
 * que e convertida para esta antes de persistir no JSONB.
 */
export interface QuestaoParseadaSerializada {
  numero: number;
  instituicao: string | null;
  ano: number | null;
  dificuldade: DificuldadeQuestao | null;
  textoBase: ContentBlock[];
  enunciado: ContentBlock[];
  alternativas: Array<{
    letra: LetraAlternativa;
    texto: string;
    /** Caminho no bucket questoes-assets (preenchido apos upload). */
    imagemPath?: string | null;
  }>;
  gabarito: LetraGabarito;
  resolucao: ContentBlock[];
}

export interface ImportacaoJob {
  id: string;
  empresaId: string;
  createdBy: string | null;
  originalFilename: string;
  originalStoragePath: string;
  status: StatusImportacao;
  questoesExtraidas: number;
  questoesJson: QuestaoParseadaSerializada[] | null;
  warnings: ParseWarning[];
  errorMessage: string | null;
  disciplina: string | null;
  moduloId: string | null;
  listaId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Input do PATCH /api/importacao/[id] (tela de revisao). */
export interface UpdateImportacaoInput {
  questoesJson?: QuestaoParseadaSerializada[];
  disciplina?: string | null;
  moduloId?: string | null;
}

/** Input do POST /api/importacao/[id]/publicar. */
export interface PublicarImportacaoInput {
  /** Tipo de atividade auto-criada quando moduloId esta presente. Default: 'Lista_Mista'. */
  tipoAtividade?: string;
  /** Titulo da lista criada. Default: <disciplina> - <data>. */
  tituloLista?: string;
  /** Modo de correcao da lista criada. Default: 'por_questao'. */
  modoCorrecao?: import("./lista").ModoCorrecao;
}
