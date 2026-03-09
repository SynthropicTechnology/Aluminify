import { getDatabaseClient } from "@/shared/core/database/database";
import { SubscriptionList } from "./components/subscription-list";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gestão de Assinaturas | Superadmin",
};

export default async function AssinaturasPage() {
  const db = getDatabaseClient();

  const { data: subscriptions } = await db
    .from("subscriptions")
    .select(
      `
      *,
      subscription_plans (id, name, slug, price_monthly_cents, price_yearly_cents),
      empresas (id, nome, slug)
    `
    )
    .order("created_at", { ascending: false });

  const { data: plans } = await db
    .from("subscription_plans")
    .select("id, name")
    .eq("active", true)
    .order("display_order");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Assinaturas</h2>
        <p className="text-muted-foreground">
          Visão geral de todas as assinaturas dos tenants.
        </p>
      </div>
      <SubscriptionList
        initialSubscriptions={subscriptions || []}
        plans={plans || []}
      />
    </div>
  );
}
