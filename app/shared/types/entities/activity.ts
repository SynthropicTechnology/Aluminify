/**
 * Tipos de Entidades do Sistema
 *
 * Define as interfaces para as principais entidades do banco de dados
 * relacionadas a atividades, disciplinas, cursos, módulos e frentes.
 */

// ============================================================================
// ATIVIDADE
// ============================================================================

import { TipoAtividade, StatusAtividade } from "../enums";

export interface Atividade {
  id: string;
  nome?: string; // Opt-in, some parts of the system use 'nome'
  titulo: string; // Required, matches DB 'titulo'
  modulo_id?: string;
  moduloId: string;
  tipo: TipoAtividade;
  frente_id?: string;
  disciplina_id?: string;
  curso_id?: string;
  status?: StatusAtividade | string; // Optional because it comes from progress
  arquivo_url?: string | null;
  arquivoUrl?: string | null;
  gabarito_url?: string | null;
  gabaritoUrl?: string | null;
  link_externo?: string | null;
  linkExterno?: string | null;
  obrigatorio: boolean;
  ordem_exibicao?: number | null;
  ordemExibicao: number;
  dataInicio?: string;
  dataConclusao?: string;
  questoesTotais?: number | null;
  questoesAcertos?: number | null;
  dificuldadePercebida?: number | null;
  anotacoesPessoais?: string | null;
  descricao?: string;
  created_at: string;
  updated_at: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string | null;
}

export interface AtividadeComProgressoEHierarquia extends Atividade {
  moduloNome: string;
  moduloNumero: number | null;
  frenteNome: string;
  frenteId: string;
  disciplinaNome: string;
  disciplinaId: string;
  cursoNome: string;
  cursoId: string;
  progressoStatus: StatusAtividade | null;
  progressoDataInicio: Date | null;
  progressoDataConclusao: Date | null;
  moduloAulasTotal: number;
  moduloAulasConcluidas: number;
}

export interface CreateAtividadeInput {
  moduloId: string;
  tipo: TipoAtividade;
  titulo: string;
  arquivoUrl?: string;
  gabaritoUrl?: string;
  linkExterno?: string;
  obrigatorio?: boolean;
  ordemExibicao?: number;
}

export interface UpdateAtividadeInput {
  moduloId?: string;
  tipo?: TipoAtividade;
  titulo?: string;
  arquivoUrl?: string | null;
  gabaritoUrl?: string | null;
  linkExterno?: string | null;
  obrigatorio?: boolean;
  ordemExibicao?: number;
}

export interface AtividadeComDetalhes extends Atividade {
  frente?: Frente;
  disciplina?: Disciplina;
  curso?: Curso;
  modulo?: Modulo;
}

// ============================================================================
// DISCIPLINA
// ============================================================================

export interface Disciplina {
  id: string;
  nome: string;
  curso_id: string;
  descricao?: string;
  cor?: string;
  icone?: string;
  ordem?: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DisciplinaComCurso extends Disciplina {
  curso?: Curso;
}

// ============================================================================
// CURSO
// ============================================================================

export interface Curso {
  id: string;
  nome: string;
  descricao?: string;
  segmento_id?: string;
  duracao_meses?: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CursoComDisciplinas extends Curso {
  disciplinas?: Disciplina[];
}

// ============================================================================
// MÓDULO
// ============================================================================

export interface Modulo {
  id: string;
  nome: string;
  numero_modulo: number;
  frente_id: string;
  descricao?: string;
  ordem?: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ModuloComFrente extends Modulo {
  frente?: Frente;
}

export interface ModuloComAtividades extends Modulo {
  atividades?: Atividade[];
}

// ============================================================================
// FRENTE
// ============================================================================

export interface Frente {
  id: string;
  nome: string;
  disciplina_id: string;
  descricao?: string;
  cor?: string;
  ordem?: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface FrenteComDisciplina extends Frente {
  disciplina?: Disciplina;
}

export interface FrenteComModulos extends Frente {
  modulos?: Modulo[];
}

// ============================================================================
// PROGRESSO
// ============================================================================

export interface ProgressoAtividade {
  id: string;
  aluno_id: string;
  atividade_id: string;
  status: "nao_iniciada" | "em_progresso" | "concluida" | "revisao";
  data_inicio?: string;
  data_conclusao?: string;
  tempo_gasto_minutos?: number;
  questoes_totais?: number;
  questoes_acertos?: number;
  dificuldade_percebida?: 1 | 2 | 3 | 4 | 5;
  anotacoes_pessoais?: string;
  created_at: string;
  updated_at: string;
}

export interface ProgressoAtividadeComDetalhes extends ProgressoAtividade {
  atividade?: AtividadeComDetalhes;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isAtividade(data: unknown): data is Atividade {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "nome" in data &&
    "frente_id" in data &&
    "disciplina_id" in data
  );
}

export function isDisciplina(data: unknown): data is Disciplina {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "nome" in data &&
    "curso_id" in data
  );
}

export function isCurso(data: unknown): data is Curso {
  return (
    typeof data === "object" && data !== null && "id" in data && "nome" in data
  );
}

export function isModulo(data: unknown): data is Modulo {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "nome" in data &&
    "numero_modulo" in data &&
    "frente_id" in data
  );
}

export function isFrente(data: unknown): data is Frente {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "nome" in data &&
    "disciplina_id" in data
  );
}

export function isProgressoAtividade(
  data: unknown,
): data is ProgressoAtividade {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    "aluno_id" in data &&
    "atividade_id" in data &&
    "status" in data
  );
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type AtividadeStatus = Atividade["status"];
export type ProgressoStatus = ProgressoAtividade["status"];
export type DificuldadePercebidaNivel = 1 | 2 | 3 | 4 | 5;

// ============================================================================
// FILTROS E ORDENAÇÃO
// ============================================================================

export interface FiltrosAtividade {
  disciplina_id?: string;
  curso_id?: string;
  frente_id?: string;
  modulo_id?: string;
  status?: AtividadeStatus;
  busca?: string;
}

export interface OrdenacaoAtividade {
  campo: "nome" | "created_at" | "updated_at" | "status";
  direcao: "asc" | "desc";
}

// ============================================================================
// SESSÃO DE ESTUDO
// ============================================================================

export type MetodoEstudo =
  | "pomodoro"
  | "livre"
  | "cronometro"
  | "timer"
  | "intervalo_curto"
  | "intervalo_longo";

export type LogPausaTipo = "pausa" | "retomada" | "manual" | "distracao";

export interface LogPausa {
  tipo: LogPausaTipo;
  timestamp?: string;
  inicio?: string;
  fim?: string;
}

export type SessaoStatus =
  | "em_andamento"
  | "pausada"
  | "finalizada"
  | "cancelada"
  | "concluido"
  | "descartado";

export interface SessaoEstudo {
  id: string;
  alunoId: string;
  moduloId?: string | null;
  disciplinaId?: string | null;
  frenteId?: string | null;
  atividadeRelacionadaId?: string | null;
  listaId?: string | null;
  tentativa?: number | null;
  metodoEstudo: MetodoEstudo;
  inicio: string;
  fim?: string | null;
  tempoTotalBrutoSegundos?: number | null;
  tempoTotalLiquidoSegundos?: number | null;
  logPausas?: LogPausa[] | null;
  status: SessaoStatus;
  nivelFoco?: number | null;
  createdAt: string;
  updatedAt?: string;

  // Legacy fields (deprecated)
  aluno_id?: string;
  modulo_id?: string | null;
  disciplina_id?: string | null;
  frente_id?: string | null;
  atividade_relacionada_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface IniciarSessaoInput {
  moduloId?: string | null;
  disciplinaId?: string | null;
  frenteId?: string | null;
  atividadeRelacionadaId?: string | null;
  listaId?: string | null;
  tentativa?: number | null;
  metodoEstudo: MetodoEstudo;
  inicioIso?: string;
  /** Tenant/empresa para isolamento multi-org; sessão é criada com empresa_id */
  empresaId?: string | null;
}

export interface FinalizarSessaoInput {
  sessaoId: string;
  fimIso?: string;
  logPausas?: LogPausa[];
  nivelFoco?: number;
  status?: SessaoStatus;
  // Legacy fields (deprecated)
  sessao_id?: string;
  tempo_total_minutos?: number;
  tempo_efetivo_minutos?: number;
}

export interface CalculoTempoResultado {
  tempoTotalBrutoSegundos: number;
  tempoTotalLiquidoSegundos: number;
  tempo_total_minutos: number;
  tempo_efetivo_minutos: number;
  pausas: LogPausa[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determina se uma atividade requer registro de desempenho (check qualificado)
 *
 * Check Simples (sem modal): Apenas Revisao
 * Check Qualificado (com modal): Todos os outros tipos
 *
 * @param tipo - Tipo da atividade
 * @returns true se requer desempenho, false caso contrário
 */
export function atividadeRequerDesempenho(
  tipo: string | undefined | null,
): boolean {
  if (!tipo) return false;
  // Check simples: Apenas Revisao
  // Check qualificado: Todos os outros tipos (incluindo Conceituario)
  return tipo !== "Revisao";
}
