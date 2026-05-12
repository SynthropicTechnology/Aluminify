import { SupabaseClient } from "@supabase/supabase-js";
import { fetchCanonicalCourseIdsForStudent } from "@/app/shared/core/enrollments/canonical-enrollments";

// ============================================
// Types
// ============================================

export interface PlantaoQuotaInfo {
  totalQuota: number;
  usedThisMonth: number;
  remaining: number;
  hasQuotaConfigured: boolean;
}

export interface CursoPlantaoQuota {
  id: string;
  cursoId: string;
  empresaId: string;
  quotaMensal: number;
}

// ============================================
// Service
// ============================================

export class PlantaoQuotaService {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Get plantao quota for a specific course
   */
  async getQuotaForCourse(cursoId: string): Promise<number> {
    const { data, error } = await this.client
      .from("curso_plantao_quotas")
      .select("quota_mensal")
      .eq("curso_id", cursoId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch plantao quota: ${error.message}`);
    }

    return data?.quota_mensal ?? 0;
  }

  /**
   * Set plantao quota for a course
   */
  async setQuotaForCourse(
    cursoId: string,
    empresaId: string,
    quotaMensal: number,
    userId: string,
  ): Promise<void> {
    const { error } = await this.client.from("curso_plantao_quotas").upsert(
      {
        curso_id: cursoId,
        empresa_id: empresaId,
        quota_mensal: quotaMensal,
        updated_by: userId,
        created_by: userId,
      },
      { onConflict: "curso_id" },
    );

    if (error) {
      throw new Error(`Failed to set plantao quota: ${error.message}`);
    }
  }

  /**
   * Set extra plantao quota for a student
   */
  async setStudentExtraQuota(
    userId: string,
    quotaExtra: number,
  ): Promise<void> {
    const { error } = await this.client
      .from("usuarios")
      .update({ quota_extra: quotaExtra })
      .eq("id", userId);

    if (error) {
      throw new Error(`Failed to set student extra quota: ${error.message}`);
    }
  }

  /**
   * Get student's total quota, usage this month, and remaining
   */
  async getStudentQuotaInfo(
    usuarioId: string,
    empresaId: string,
  ): Promise<PlantaoQuotaInfo> {
    const anoMes = this.getCurrentAnoMes();

    const enrolledCursoIds = await fetchCanonicalCourseIdsForStudent(
      this.client,
      usuarioId,
      empresaId,
    );
    let hasQuotaConfigured = false;

    if (enrolledCursoIds.length > 0) {
      const { count, error: countError } = await this.client
        .from("curso_plantao_quotas")
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .in("curso_id", enrolledCursoIds);

      if (countError) {
        throw new Error(
          `Failed to check quota configuration: ${countError.message}`,
        );
      }

      hasQuotaConfigured = (count ?? 0) > 0;
    }

    // Get total quota from enrolled courses
    const { data: quotaData, error: quotaError } = await this.client.rpc(
      "get_student_plantao_quota",
      {
        p_usuario_id: usuarioId,
        p_empresa_id: empresaId,
      },
    );

    if (quotaError) {
      throw new Error(`Failed to fetch student quota: ${quotaError.message}`);
    }

    const totalQuota = quotaData ?? 0;

    // Get current month usage
    const { data: usageData, error: usageError } = await this.client.rpc(
      "get_student_plantao_usage",
      {
        p_usuario_id: usuarioId,
        p_empresa_id: empresaId,
        p_ano_mes: anoMes,
      },
    );

    if (usageError) {
      throw new Error(`Failed to fetch student usage: ${usageError.message}`);
    }

    const usedThisMonth = usageData ?? 0;
    const remaining = Math.max(totalQuota - usedThisMonth, 0);

    return { totalQuota, usedThisMonth, remaining, hasQuotaConfigured };
  }

  /**
   * Increment usage count when a plantao is booked
   */
  async incrementUsage(usuarioId: string, empresaId: string): Promise<void> {
    const { error } = await this.client.rpc("increment_plantao_usage", {
      p_usuario_id: usuarioId,
      p_empresa_id: empresaId,
      p_ano_mes: this.getCurrentAnoMes(),
    });

    if (error) {
      throw new Error(`Failed to increment plantao usage: ${error.message}`);
    }
  }

  /**
   * Decrement usage count when a plantao is cancelled
   */
  async decrementUsage(usuarioId: string, empresaId: string): Promise<void> {
    const { error } = await this.client.rpc("decrement_plantao_usage", {
      p_usuario_id: usuarioId,
      p_empresa_id: empresaId,
      p_ano_mes: this.getCurrentAnoMes(),
    });

    if (error) {
      throw new Error(`Failed to decrement plantao usage: ${error.message}`);
    }
  }

  private getCurrentAnoMes(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  }
}
