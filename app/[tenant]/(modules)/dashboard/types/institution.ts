/**
 * Tipos TypeScript para o Dashboard da Instituição
 *
 * Usado quando o usuário tem papel administrativo (admin, professor_admin)
 */

import type { HeatmapDay } from "@/app/[tenant]/(modules)/dashboard/types/student";

export interface InstitutionSummary {
  totalAlunos: number;
  totalProfessores: number;
  totalCursos: number;
  alunosAtivos: number;
}

export interface InstitutionEngagement {
  totalHorasEstudo: string; // Formato "XXXh XXm"
  horasEstudoDelta: string; // Formato "+Xh" ou "-Xh"
  atividadesConcluidas: number;
  taxaConclusao: number; // Percentual (0-100)
  atividadesConcluidasBreakdown?: {
    aulas: number;
    atividades: number;
    flashcards: number;
  };
}

export interface DailyActiveUsersPoint {
  date: string; // "YYYY-MM-DD"
  activeUsers: number;
}

export interface DailyLoginsPoint {
  date: string; // "YYYY-MM-DD"
  uniqueLogins: number;
}

export interface LoginSummary {
  alunosLogaram: number;
  totalAlunos: number;
  taxaLogin: number; // Percentual (0-100)
  logaramENaoEstudaram: number;
  hasAnyData: boolean;
  isPartialData: boolean;
  coverageStartDate: string | null; // Data do primeiro evento de login no tenant
}

export type ServiceKey =
  | "sessoes_estudo"
  | "cronogramas"
  | "flashcards"
  | "agendamentos"
  | "ai_chat"
  | "progresso_atividades";

export interface ServiceAdoptionItem {
  servico: ServiceKey;
  label: string;
  alunosAtivos: number;
  totalAlunos: number;
  percentual: number; // 0-100
}

export interface StudentRankingItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  horasEstudo: string; // Formato "XXh XXm"
  horasEstudoMinutos: number; // Para ordenação
  aproveitamento: number; // Percentual (0-100)
  temDadosAproveitamento: boolean; // false quando o aluno não respondeu nenhuma questão no período
  streakDays: number;
}

export interface ProfessorRankingItem {
  id: string;
  name: string;
  avatarUrl: string | null;
  alunosAtendidos: number;
  agendamentosRealizados: number;
}

export interface DisciplinaPerformance {
  id: string;
  name: string;
  aproveitamento: number; // Percentual (0-100)
  totalQuestoes: number;
  alunosAtivos: number;
  temDadosAproveitamento: boolean; // false quando totalQuestoes === 0
}

export interface InstitutionDashboardData {
  empresaNome: string;
  empresaLogoUrl: string | null;
  userName: string;
  summary: InstitutionSummary;
  engagement: InstitutionEngagement;
  heatmap: HeatmapDay[];
  rankingAlunos: StudentRankingItem[];
  rankingProfessores: ProfessorRankingItem[];
  performanceByDisciplina: DisciplinaPerformance[];
  dailyActiveUsers: DailyActiveUsersPoint[];
  dailyLogins: DailyLoginsPoint[];
  alunosComCronograma: number;
  loginSummary: LoginSummary;
  serviceAdoption: ServiceAdoptionItem[];
}

// Response types para API
export interface InstitutionDashboardResponse {
  success: boolean;
  data?: InstitutionDashboardData;
  error?: string;
}
