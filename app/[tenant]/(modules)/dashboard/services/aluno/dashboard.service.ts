import type {
  DashboardData,
  DashboardGroupBy,
  DashboardPeriod,
  DashboardScopeLevel,
  FocusEfficiencyDay,
  HeatmapDay,
  Metrics,
  PerformanceItem,
  QuestionBankMetrics,
  StrategicDomain,
  StrategicDomainResponse,
  SubjectDistributionItem,
  SubjectDistributionResponse,
  SubjectPerformance,
  UserInfo,
} from "../../types";
import { apiClient, ApiClientError } from "@/app/shared/library/api-client";
import type { HeatmapPeriod } from "../../components/aluno/consistency-heatmap";

export interface DashboardServiceError extends Error {
  status?: number;
  isNetworkError?: boolean;
  isAuthError?: boolean;
}

/**
 * Converte HeatmapPeriod para DashboardPeriod
 * A API só aceita 'semanal', 'mensal' ou 'anual'
 * Mapeia: semestral -> anual
 */
function mapHeatmapPeriodToDashboardPeriod(
  period: HeatmapPeriod,
): DashboardPeriod {
  switch (period) {
    case "mensal":
      return "mensal";
    case "semestral":
      return "anual"; // Mapeia semestral para anual (mais próximo)
    case "anual":
      return "anual";
    default:
      return "anual"; // Fallback
  }
}

export interface FetchDashboardDataOptions {
  period?: HeatmapPeriod;
  /** Filter by organization ID (for multi-org students) */
  empresaId?: string | null;
}

/**
 * Service layer para buscar dados do Dashboard Analytics
 *
 * @param periodOrOptions - Período do heatmap ou objeto de opções
 * @returns Promise<DashboardData> - Dados completos do dashboard
 * @throws DashboardServiceError - Em caso de erro
 */
export async function fetchDashboardData(
  periodOrOptions: HeatmapPeriod | FetchDashboardDataOptions = "anual",
): Promise<DashboardData> {
  // Normalize options
  const options: FetchDashboardDataOptions =
    typeof periodOrOptions === "string"
      ? { period: periodOrOptions }
      : periodOrOptions;

  const heatmapPeriod = options.period ?? "anual";
  const period = mapHeatmapPeriodToDashboardPeriod(heatmapPeriod);
  const empresaId = options.empresaId;

  try {
    const params = new URLSearchParams({ period });
    if (empresaId) {
      params.set("empresa_id", empresaId);
    }

    const response = await apiClient.get<{ data: DashboardData }>(
      `/api/dashboard/metrics?${params.toString()}`,
    );

    if (response && "data" in response && response.data) {
      return response.data;
    }

    throw new Error("Resposta da API não tem formato esperado");
  } catch (error) {
    if (error instanceof ApiClientError) {
      // Erro de autenticação - re-lançar erro
      if (error.status === 401 || error.status === 403) {
        const authError: DashboardServiceError = new Error(
          "Não autorizado. Faça login novamente.",
        );
        authError.status = error.status;
        authError.isAuthError = true;
        throw authError;
      }

      // Em produção, re-lançar erro para tratamento no componente
      const serviceError: DashboardServiceError = new Error(
        error.data?.error ||
          error.message ||
          "Erro ao carregar dados do dashboard",
      );
      serviceError.status = error.status;
      serviceError.isNetworkError = error.status >= 500;
      throw serviceError;
    }

    // Erro desconhecido
    if (error instanceof Error) {
      const serviceError: DashboardServiceError = new Error(
        error.message || "Erro ao carregar dados do dashboard",
      );
      throw serviceError;
    }

    throw new Error("Erro desconhecido ao carregar dados do dashboard");
  }
}

export interface DashboardCourse {
  id: string;
  nome: string;
  empresa_id: string | null;
  empresaNome: string | null;
  empresaLogoUrl: string | null;
}

export async function fetchDashboardCourses(
  empresaId?: string | null,
): Promise<DashboardCourse[]> {
  const params = new URLSearchParams();
  if (empresaId) params.set("empresa_id", empresaId);
  const qs = params.toString();
  const response = await apiClient.get<{ data: DashboardCourse[] }>(
    `/api/dashboard/courses${qs ? `?${qs}` : ""}`,
  );
  return response.data ?? [];
}

export async function fetchSubjectDistribution(params: {
  groupBy: DashboardGroupBy;
  scope: DashboardScopeLevel;
  scopeId?: string;
  period?: DashboardPeriod;
  empresaId?: string | null;
}): Promise<SubjectDistributionResponse> {
  const period = params.period ?? "mensal";
  const qs = new URLSearchParams({
    group_by: params.groupBy,
    scope: params.scope,
    ...(params.scopeId ? { scope_id: params.scopeId } : {}),
    period,
    ...(params.empresaId ? { empresa_id: params.empresaId } : {}),
  });
  const response = await apiClient.get<{ data: SubjectDistributionResponse }>(
    `/api/dashboard/subject-distribution?${qs.toString()}`,
  );
  return response.data;
}

export async function fetchPerformance(params: {
  groupBy: DashboardGroupBy;
  scope: DashboardScopeLevel;
  scopeId?: string;
  period?: DashboardPeriod;
  empresaId?: string | null;
}): Promise<PerformanceItem[]> {
  const qs = new URLSearchParams({
    group_by: params.groupBy,
    scope: params.scope,
    ...(params.scopeId ? { scope_id: params.scopeId } : {}),
    ...(params.period ? { period: params.period } : {}),
    ...(params.empresaId ? { empresa_id: params.empresaId } : {}),
  });
  const response = await apiClient.get<{ data: PerformanceItem[] }>(
    `/api/dashboard/performance?${qs.toString()}`,
  );
  return response.data ?? [];
}

export async function fetchStrategicDomain(params: {
  scope: DashboardScopeLevel;
  scopeId?: string;
  period?: DashboardPeriod;
  empresaId?: string | null;
}): Promise<StrategicDomainResponse> {
  const qs = new URLSearchParams({
    scope: params.scope,
    ...(params.scopeId ? { scope_id: params.scopeId } : {}),
    ...(params.period ? { period: params.period } : {}),
    ...(params.empresaId ? { empresa_id: params.empresaId } : {}),
  });
  const response = await apiClient.get<{ data: StrategicDomainResponse }>(
    `/api/dashboard/strategic-domain?${qs.toString()}`,
  );
  return response.data;
}

// New API methods for granular data fetching

export async function fetchDashboardUser(
  empresaId?: string | null,
): Promise<UserInfo> {
  const params = new URLSearchParams();
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: UserInfo }>(
    `/api/dashboard/user?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

export async function fetchDashboardMetrics(
  period: DashboardPeriod = "anual",
  empresaId?: string | null,
): Promise<Metrics> {
  const params = new URLSearchParams({ period });
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: Metrics }>(
    `/api/dashboard/metrics?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

export async function fetchDashboardHeatmap(
  period: HeatmapPeriod = "anual",
  empresaId?: string | null,
): Promise<HeatmapDay[]> {
  const params = new URLSearchParams({ period });
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: HeatmapDay[] }>(
    `/api/dashboard/heatmap?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

export async function fetchDashboardSubjects(
  period: DashboardPeriod = "anual",
  empresaId?: string | null,
): Promise<SubjectPerformance[]> {
  const params = new URLSearchParams({ period });
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: SubjectPerformance[] }>(
    `/api/dashboard/subjects?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

export async function fetchDashboardEfficiency(
  period: DashboardPeriod = "anual",
  empresaId?: string | null,
): Promise<FocusEfficiencyDay[]> {
  const params = new URLSearchParams({ period });
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: FocusEfficiencyDay[] }>(
    `/api/dashboard/efficiency?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

export async function fetchDashboardStrategic(
  period: DashboardPeriod = "anual",
  empresaId?: string | null,
): Promise<StrategicDomain> {
  const params = new URLSearchParams({ period });
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: StrategicDomain }>(
    `/api/dashboard/strategic?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

export async function fetchDashboardDistribution(
  period: DashboardPeriod = "anual",
  empresaId?: string | null,
): Promise<SubjectDistributionItem[]> {
  const params = new URLSearchParams({ period });
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: SubjectDistributionItem[] }>(
    `/api/dashboard/distribution?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

export async function fetchQuestionBankMetrics(
  period: DashboardPeriod = "anual",
  empresaId?: string | null,
): Promise<QuestionBankMetrics> {
  const params = new URLSearchParams({ period });
  if (empresaId) params.set("empresa_id", empresaId);

  const response = await apiClient.get<{ data: QuestionBankMetrics }>(
    `/api/dashboard/question-metrics?${params.toString()}`,
    empresaId ? { tenantId: empresaId } : undefined,
  );
  return response.data;
}

// Re-exportar fetch functions do service principal
export {
  fetchLeaderboard,
} from "../dashboard.service";
