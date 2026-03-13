export interface FeriasPeriodo {
  inicio: string;
  fim: string;
}

export interface GerarCronogramaInput {
  aluno_id: string;
  data_inicio: string;
  data_fim: string;
  ferias: FeriasPeriodo[];
  horas_dia: number;
  dias_semana: number;
  prioridade_minima: number;
  disciplinas_ids: string[];
  modalidade: 'paralelo' | 'sequencial';
  curso_alvo_id?: string;
  nome?: string;
  ordem_frentes_preferencia?: string[];
  modulos_ids?: string[];
  excluir_aulas_concluidas?: boolean;
  velocidade_reproducao?: number; // 1.00, 1.25, 1.50, 2.00
}

export interface AulaCompleta {
  id: string;
  nome: string;
  numero_aula: number | null;
  tempo_estimado_minutos: number | null;
  prioridade: number | null;
  modulo_id: string;
  modulo_nome: string;
  numero_modulo: number | null;
  frente_id: string;
  frente_nome: string;
  disciplina_id: string;
  disciplina_nome: string;
}

export interface FrenteDistribuicao {
  frente_id: string;
  frente_nome: string;
  aulas: AulaCompleta[];
  custo_total: number;
  peso: number;
}

export interface SemanaInfo {
  numero: number;
  data_inicio: Date;
  data_fim: Date;
  is_ferias: boolean;
  capacidade_minutos: number;
}

interface ItemDistribuicaoBase {
  cronograma_id: string;
  semana_numero: number;
  ordem_na_semana: number;
}

export interface ItemDistribuicaoAula extends ItemDistribuicaoBase {
  tipo: "aula";
  aula_id: string;
  frente_id: string | null;
  frente_nome_snapshot: string | null;
  mensagem: string | null;
  duracao_sugerida_minutos: null;
}

export interface ItemDistribuicaoQuestoesRevisao extends ItemDistribuicaoBase {
  tipo: "questoes_revisao";
  aula_id: null;
  frente_id: string;
  frente_nome_snapshot: string;
  mensagem: string;
  duracao_sugerida_minutos: number;
}

export type ItemDistribuicao =
  | ItemDistribuicaoAula
  | ItemDistribuicaoQuestoesRevisao;

export interface CronogramaEstatisticas {
  total_aulas: number;
  total_semanas: number;
  semanas_uteis: number;
  capacidade_total_minutos: number;
  custo_total_minutos: number;
  frentes_distribuidas: number;
}

/**
 * Representa o cronograma gerado com seus atributos
 */
export interface CronogramaDetalhado {
  id: string;
  aluno_id: string;
  curso_alvo_id: string | null;
  nome: string;
  data_inicio: string;
  data_fim: string;
  dias_estudo_semana: number;
  horas_estudo_dia: number;
  periodos_ferias: FeriasPeriodo[];
  prioridade_minima: number;
  modalidade_estudo: 'paralelo' | 'sequencial';
  disciplinas_selecionadas: string[];
  ordem_frentes_preferencia: string[] | null;
  modulos_selecionados: string[] | null;
  excluir_aulas_concluidas: boolean;
  velocidade_reproducao: number;
  created_at: string;
  updated_at: string;
}

export interface GerarCronogramaResult {
  success: true;
  cronograma: CronogramaDetalhado;
  estatisticas: CronogramaEstatisticas;
}

export interface TempoInsuficienteDetalhes {
  horas_necessarias: number;
  horas_disponiveis: number;
  horas_dia_necessarias: number;
  horas_dia_atual: number;
}

export interface CronogramaSemanasDias {
  id: string;
  cronograma_id: string;
  dias_semana: number[]; // Array de 0-6 (0=domingo, 1=segunda, ..., 6=sábado)
  created_at: Date;
  updated_at: Date;
}

export interface AtualizarDistribuicaoDiasInput {
  cronograma_id: string;
  dias_semana: number[]; // Array de 0-6
}

export interface RecalcularDatasResult {
  success: true;
  itens_atualizados: number;
}

export interface SemanaEstatisticas {
  semana_numero: number;
  data_inicio: string; // ISO string
  data_fim: string; // ISO string
  capacidade_minutos: number; // Tempo disponível (horas_dia * dias_semana * 60)
  tempo_usado_minutos: number; // Tempo usado (soma dos custos das aulas)
  tempo_disponivel_minutos: number; // Tempo restante (capacidade - usado)
  percentual_usado: number; // Percentual de uso (0-100+)
  is_ferias: boolean;
  total_aulas: number;
  aulas_concluidas: number;
  aulas_pendentes: number;
}

export interface EstatisticasSemanasResult {
  success: true;
  semanas: SemanaEstatisticas[];
  resumo: {
    total_semanas: number;
    semanas_uteis: number;
    semanas_ferias: number;
    capacidade_total_minutos: number;
    tempo_total_usado_minutos: number;
    tempo_total_disponivel_minutos: number;
    percentual_medio_usado: number;
    total_aulas: number;
    total_aulas_concluidas: number;
    semanas_sobrecarregadas: number; // Semanas com percentual > 100%
  };
}

