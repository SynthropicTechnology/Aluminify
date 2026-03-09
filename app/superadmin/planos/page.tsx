import { getDatabaseClient } from "@/shared/core/database/database";
import { PlanList } from "./components/plan-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestão de Planos | Superadmin",
};

export default async function PlanosPage() {
  const db = getDatabaseClient();

  const { data: plans } = await db
    .from("subscription_plans")
    .select("*")
    .order("display_order", { ascending: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Planos de Assinatura
          </h2>
          <p className="text-muted-foreground">
            Gerencie os planos da plataforma. Alterações são sincronizadas com o
            Stripe automaticamente.
          </p>
        </div>
      </div>
      <PlanList initialPlans={plans || []} />
    </div>
  );
}
