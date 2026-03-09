import { requireUser } from "@/shared/core/auth";
import { getDatabaseClient } from "@/shared/core/database/database";
import { PlanManagement } from "./components/plan-management";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plano | Configurações",
};

export default async function PlanoPage() {
  const user = await requireUser({ allowedRoles: ["usuario"] });

  if (!user.empresaId) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Nenhuma empresa vinculada.
      </div>
    );
  }

  const db = getDatabaseClient();

  // Get current subscription with plan details
  const { data: empresa } = await db
    .from("empresas")
    .select("subscription_id, stripe_customer_id, plano")
    .eq("id", user.empresaId)
    .single();

  let subscription = null;
  let plan = null;

  if (empresa?.subscription_id) {
    const { data: sub } = await db
      .from("subscriptions")
      .select("*, subscription_plans (*)")
      .eq("id", empresa.subscription_id)
      .single();

    if (sub) {
      subscription = sub;
      plan = sub.subscription_plans;
    }
  }

  // Get available plans for upgrade
  const { data: availablePlans } = await db
    .from("subscription_plans")
    .select(
      "id, name, slug, description, features, price_monthly_cents, price_yearly_cents, max_active_students, max_courses, max_storage_mb, is_featured, badge_text"
    )
    .eq("active", true)
    .order("display_order");

  // Get current usage counts
  const { count: studentCount } = await db
    .from("usuarios_empresas")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", user.empresaId)
    .eq("papel_base", "aluno");

  const { count: courseCount } = await db
    .from("cursos")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", user.empresaId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Plano</h2>
        <p className="text-muted-foreground">
          Gerencie sua assinatura e limites do plano.
        </p>
      </div>
      <PlanManagement
        subscription={subscription}
        currentPlan={plan}
        currentPlanoLegacy={empresa?.plano || null}
        hasStripeCustomer={!!empresa?.stripe_customer_id}
        availablePlans={availablePlans || []}
        usage={{
          students: studentCount || 0,
          courses: courseCount || 0,
        }}
        tenantSlug={user.empresaSlug || ""}
      />
    </div>
  );
}
