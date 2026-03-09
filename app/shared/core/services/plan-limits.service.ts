import { getDatabaseClient } from "@/app/shared/core/database/database";

export interface PlanLimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number | null;
  message?: string;
}

export interface PlanLimits {
  max_active_students: number | null;
  max_courses: number | null;
  max_storage_mb: number | null;
  allowed_modules: string[];
}

const GRACE_PERIOD_DAYS = 7; // Days of access after subscription goes past_due

/**
 * Get the plan limits for a tenant.
 * Returns limits from the subscription plan, or default free-tier limits if no active subscription.
 */
export async function getPlanLimits(empresaId: string): Promise<PlanLimits> {
  const db = getDatabaseClient();

  const { data: empresa } = await db
    .from("empresas")
    .select("subscription_id")
    .eq("id", empresaId)
    .single();

  if (!empresa?.subscription_id) {
    // Free tier defaults
    return {
      max_active_students: 50,
      max_courses: 3,
      max_storage_mb: 512,
      allowed_modules: [],
    };
  }

  const { data: subscription } = await db
    .from("subscriptions")
    .select("status, plan_id, subscription_plans (*)")
    .eq("id", empresa.subscription_id)
    .single();

  if (!subscription) {
    return {
      max_active_students: 50,
      max_courses: 3,
      max_storage_mb: 512,
      allowed_modules: [],
    };
  }

  const plan = subscription.subscription_plans as {
    max_active_students: number | null;
    max_courses: number | null;
    max_storage_mb: number | null;
    allowed_modules: unknown;
  } | null;

  if (!plan) {
    return {
      max_active_students: 50,
      max_courses: 3,
      max_storage_mb: 512,
      allowed_modules: [],
    };
  }

  return {
    max_active_students: plan.max_active_students,
    max_courses: plan.max_courses,
    max_storage_mb: plan.max_storage_mb,
    allowed_modules: Array.isArray(plan.allowed_modules)
      ? (plan.allowed_modules as string[])
      : [],
  };
}

/**
 * Check if a tenant can add more active students.
 * Also blocks if subscription is past grace period.
 */
export async function checkStudentLimit(
  empresaId: string
): Promise<PlanLimitCheckResult> {
  // Check grace period first
  const withinGrace = await isWithinGracePeriod(empresaId);
  if (!withinGrace) {
    return {
      allowed: false,
      current: 0,
      limit: 0,
      message: "Sua assinatura está vencida. Regularize o pagamento para continuar adicionando alunos.",
    };
  }

  const limits = await getPlanLimits(empresaId);

  if (!limits.max_active_students) {
    return { allowed: true, current: 0, limit: null };
  }

  const db = getDatabaseClient();
  const { count } = await db
    .from("usuarios_empresas")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("papel_base", "aluno");

  const current = count || 0;
  const allowed = current < limits.max_active_students;

  return {
    allowed,
    current,
    limit: limits.max_active_students,
    message: allowed
      ? undefined
      : `Limite de ${limits.max_active_students} alunos ativos atingido. Faça upgrade do seu plano para adicionar mais alunos.`,
  };
}

/**
 * Check if a tenant can create more courses.
 * Also blocks if subscription is past grace period.
 */
export async function checkCourseLimit(
  empresaId: string
): Promise<PlanLimitCheckResult> {
  // Check grace period first
  const withinGrace = await isWithinGracePeriod(empresaId);
  if (!withinGrace) {
    return {
      allowed: false,
      current: 0,
      limit: 0,
      message: "Sua assinatura está vencida. Regularize o pagamento para continuar criando cursos.",
    };
  }

  const limits = await getPlanLimits(empresaId);

  if (!limits.max_courses) {
    return { allowed: true, current: 0, limit: null };
  }

  const db = getDatabaseClient();
  const { count } = await db
    .from("cursos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const current = count || 0;
  const allowed = current < limits.max_courses;

  return {
    allowed,
    current,
    limit: limits.max_courses,
    message: allowed
      ? undefined
      : `Limite de ${limits.max_courses} cursos atingido. Faça upgrade do seu plano para criar mais cursos.`,
  };
}

/**
 * Check if a tenant has access to a specific module.
 */
export async function checkModuleAccess(
  empresaId: string,
  moduleSlug: string
): Promise<{ allowed: boolean; message?: string }> {
  const limits = await getPlanLimits(empresaId);

  // Empty array = all modules allowed (enterprise/unlimited)
  if (limits.allowed_modules.length === 0) {
    return { allowed: true };
  }

  const allowed = limits.allowed_modules.includes(moduleSlug);

  return {
    allowed,
    message: allowed
      ? undefined
      : `O módulo "${moduleSlug}" não está disponível no seu plano atual. Faça upgrade para acessar.`,
  };
}

/**
 * Check if a tenant's subscription is within the grace period after going past_due.
 * Returns true if the tenant should still have access.
 */
export async function isWithinGracePeriod(
  empresaId: string
): Promise<boolean> {
  const db = getDatabaseClient();

  const { data: empresa } = await db
    .from("empresas")
    .select("subscription_id")
    .eq("id", empresaId)
    .single();

  if (!empresa?.subscription_id) return true; // No subscription = free tier

  const { data: subscription } = await db
    .from("subscriptions")
    .select("status, updated_at")
    .eq("id", empresa.subscription_id)
    .single();

  if (!subscription) return true;

  if (subscription.status === "active" || subscription.status === "trialing") {
    return true;
  }

  if (subscription.status === "past_due") {
    const updatedAt = new Date(subscription.updated_at);
    const gracePeriodEnd = new Date(updatedAt);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + GRACE_PERIOD_DAYS);

    return new Date() < gracePeriodEnd;
  }

  // canceled, unpaid, paused
  return false;
}
