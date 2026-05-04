/**
 * Tipos TypeScript para o Dashboard Analytics do Aluno
 */

export interface UserInfo {
  name: string;
  email: string;
  avatarUrl: string;
  streakDays: number;
}

export interface Metrics {
  scheduleProgress: number; // Percentual (0-100)
  focusTime: string; // Tempo de estudo total (aulas assistidas + listas), formato "12h 30m"
  focusTimeDelta: string; // Diferença vs período anterior, formato "+2h" ou "-1h"
  classTime: string; // Tempo de aulas assistidas, formato "1h 20m"
  exerciseTime: string; // Tempo de exercícios (modo foco), formato "45m"
  questionsAnswered: number;
  questionsAnsweredPeriod: string; // Ex: "Essa semana"
  accuracy: number; // Percentual (0-100)
  flashcardsReviewed: number;
}

export interface HeatmapDay {
  date: string; // Formato ISO: "2023-01-01"
  intensity: number; // 0 = nenhum, 1-4 = intensidade crescente
}

export interface SubjectPerformance {
  id: number;
  name: string; // Nome da disciplina
  front: string; // Nome da frente
  score: number; // Percentual (0-100)
  isNotStarted?: boolean; // true se não houver progresso
}

export interface FocusEfficiencyDay {
  day: string; // "Seg", "Ter", "Qua", etc.
  grossTime: number; // Tempo bruto em minutos
  netTime: number; // Tempo líquido em minutos
}

export type ModuloImportancia = "Base" | "Alta" | "Media" | "Baixa";

export interface StrategicDomainAxis {
  flashcardsScore: number | null; // Percentual (0-100) ou null (sem evidência)
  questionsScore: number | null; // Percentual (0-100) ou null (sem evidência)
}

export interface StrategicDomainRecommendation {
  moduloId: string;
  moduloNome: string;
  importancia: ModuloImportancia;
  flashcardsScore: number | null; // Percentual (0-100) ou null (sem evidência)
  questionsScore: number | null; // Percentual (0-100) ou null (sem evidência)
  reason: string;
}

export interface StrategicDomain {
  baseModules: StrategicDomainAxis;
  highRecurrence: StrategicDomainAxis;
  recommendations: StrategicDomainRecommendation[];
}

export interface SubjectDistributionItem {
  name: string;
  percentage: number; // Percentual (0-100)
  color: string; // Cor em formato hex ou Tailwind class
}

export type DashboardScopeLevel = "curso" | "disciplina" | "frente" | "modulo";
export type DashboardGroupBy = "curso" | "disciplina" | "frente" | "modulo";
export type DashboardPeriod = "semanal" | "mensal" | "anual";

export interface SubjectDistributionExtendedItem extends SubjectDistributionItem {
  id?: string | null;
  seconds?: number;
  prettyTime?: string;
}

export interface SubjectDistributionResponse {
  totalSeconds: number;
  totalHours: number;
  items: SubjectDistributionExtendedItem[];
}

export interface PerformanceItem {
  id: string;
  name: string;
  subLabel?: string | null;
  score: number; // Percentual (0-100)
  isNotStarted: boolean;
  // Quando groupBy = 'modulo'
  moduloNumero?: number | null;
  importancia?: ModuloImportancia | null;
}

export interface StrategicDomainModuleItem {
  moduloId: string;
  moduloNome: string;
  importancia: ModuloImportancia;
  flashcardsScore: number | null;
  questionsScore: number | null;
  risk: number | null;
}

export interface StrategicDomainResponse {
  data: StrategicDomain;
  modules: StrategicDomainModuleItem[];
}

export interface DashboardData {
  user: UserInfo;
  metrics: Metrics;
  heatmap: HeatmapDay[];
  subjects: SubjectPerformance[];
  focusEfficiency: FocusEfficiencyDay[];
  strategicDomain: StrategicDomain;
  subjectDistribution: SubjectDistributionItem[];
}
export interface QuestionBankMetrics {
  totalRespondidas: number;
  acertos: number;
  erros: number;
  tempoMedio: number | null;
  performancePorDisciplina: QuestionPerformanceBySubject[];
  evolucaoTemporal: QuestionEvolutionPoint[];
  topicosMaisErrados: MostMissedTopic[];
}

export interface QuestionPerformanceBySubject {
  disciplinaId: string;
  disciplinaNome: string;
  total: number;
  acertos: number;
  percentual: number;
}

export interface QuestionEvolutionPoint {
  data: string;
  total: number;
  acertos: number;
  percentual: number;
}

export interface MostMissedTopic {
  disciplinaId: string;
  disciplinaNome: string;
  frenteNome: string | null;
  moduloNome: string | null;
  totalErros: number;
  totalRespondidas: number;
  percentualErro: number;
}

export * from './institution';
export * from './professor';
