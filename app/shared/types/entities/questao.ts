/**
 * Tipos de dominio do banco de questoes.
 *
 * Os campos seguem camelCase (idiomatico do projeto). Quando a migration
 * 20260428000000_create_sistema_questoes for aplicada e database.types.ts
 * for regenerado, os repositorios podem importar
 * `Database["public"]["Tables"]["banco_questoes"]["Row"]` para mapear
 * snake_case -> camelCase via funcao `mapRow` (mesmo padrao usado em
 * atividade.repository.ts e demais).
 */

export type DificuldadeQuestao = "facil" | "medio" | "dificil";

export type LetraAlternativa = "a" | "b" | "c" | "d" | "e";
export type LetraGabarito = "A" | "B" | "C" | "D" | "E";

/**
 * Bloco de conteudo dentro de texto_base, enunciado ou resolucao_texto.
 * Permite preservar a ordem de paragrafos, imagens e formulas extraidos
 * do Word original.
 */
export type ContentBlock =
  | { type: "paragraph"; text: string }
  | {
      type: "image";
      storagePath: string;
      alt?: string;
      width?: number;
      height?: number;
    }
  | { type: "math"; latex: string };

export interface Alternativa {
  id: string;
  questaoId: string;
  empresaId: string;
  letra: LetraAlternativa;
  texto: string;
  imagemPath: string | null;
  correta: boolean;
  ordem: number;
}

/** Versao resumida usada em listagens (sem alternativas/resolucao). */
export interface QuestaoResumo {
  id: string;
  empresaId: string;
  codigo: string | null;
  numeroOriginal: number | null;
  instituicao: string | null;
  ano: number | null;
  disciplina: string | null;
  disciplinaId: string | null;
  frenteId: string | null;
  moduloId: string | null;
  dificuldade: DificuldadeQuestao | null;
  enunciado: ContentBlock[];
  gabarito: LetraGabarito;
  tags: string[];
  importacaoJobId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Versao completa para a tela do aluno e para edicao. */
export interface QuestaoComAlternativas extends QuestaoResumo {
  textoBase: ContentBlock[] | null;
  resolucaoTexto: ContentBlock[] | null;
  resolucaoVideoUrl: string | null;
  alternativas: Alternativa[];
  createdBy: string | null;
}

/** Input do POST /api/questoes. */
export interface CreateQuestaoInput {
  empresaId: string;
  createdBy: string | null;
  numeroOriginal?: number | null;
  instituicao?: string | null;
  ano?: number | null;
  disciplina?: string | null;
  disciplinaId?: string | null;
  frenteId?: string | null;
  moduloId?: string | null;
  dificuldade?: DificuldadeQuestao | null;
  textoBase?: ContentBlock[] | null;
  enunciado: ContentBlock[];
  gabarito: LetraGabarito;
  resolucaoTexto?: ContentBlock[] | null;
  resolucaoVideoUrl?: string | null;
  tags?: string[];
  importacaoJobId?: string | null;
  alternativas: Array<{
    letra: LetraAlternativa;
    texto: string;
    imagemPath?: string | null;
  }>;
}

/** Input do PATCH /api/questoes/[id] (todos os campos opcionais). */
export interface UpdateQuestaoInput {
  numeroOriginal?: number | null;
  instituicao?: string | null;
  ano?: number | null;
  disciplina?: string | null;
  disciplinaId?: string | null;
  frenteId?: string | null;
  moduloId?: string | null;
  dificuldade?: DificuldadeQuestao | null;
  textoBase?: ContentBlock[] | null;
  enunciado?: ContentBlock[];
  gabarito?: LetraGabarito;
  resolucaoTexto?: ContentBlock[] | null;
  resolucaoVideoUrl?: string | null;
  tags?: string[];
  /** Quando definido, substitui completamente o conjunto de alternativas. */
  alternativas?: Array<{
    letra: LetraAlternativa;
    texto: string;
    imagemPath?: string | null;
  }>;
}

/** Filtros de listagem para o GET /api/questoes. */
export interface ListQuestoesFilter {
  empresaId: string;
  disciplina?: string;
  disciplinaId?: string;
  frenteId?: string;
  moduloId?: string;
  instituicao?: string;
  ano?: number;
  dificuldade?: DificuldadeQuestao;
  tags?: string[];
  /** Busca textual em enunciado (full-text simples — implementacao no service). */
  search?: string;
  limit?: number;
  cursor?: string | null;
}

export interface PaginatedQuestoes {
  data: QuestaoResumo[];
  nextCursor: string | null;
}
