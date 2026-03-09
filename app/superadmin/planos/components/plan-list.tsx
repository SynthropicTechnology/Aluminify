"use client";

import { useState } from "react";
import { PlanForm } from "./plan-form";
import type { Database } from "@/lib/database.types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];

interface PlanListProps {
  initialPlans: Plan[];
}

export function PlanList({ initialPlans }: PlanListProps) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function refreshPlans() {
    const res = await fetch("/api/superadmin/planos");
    const data = await res.json();
    if (data.plans) setPlans(data.plans);
  }

  async function toggleActive(plan: Plan) {
    setLoading(plan.id);
    try {
      await fetch("/api/superadmin/planos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: plan.id, active: !plan.active }),
      });
      await refreshPlans();
    } finally {
      setLoading(null);
    }
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => {
          setEditingPlan(null);
          setShowForm(true);
        }}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Novo Plano
      </button>

      {showForm && (
        <PlanForm
          plan={editingPlan}
          onClose={() => {
            setShowForm(false);
            setEditingPlan(null);
          }}
          onSaved={async () => {
            setShowForm(false);
            setEditingPlan(null);
            await refreshPlans();
          }}
        />
      )}

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">Nome</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Preço Mensal
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Preço Anual
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Limites
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Stripe
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">{plan.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {plan.slug}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {plan.price_monthly_cents > 0
                    ? formatCurrency(plan.price_monthly_cents)
                    : "Grátis"}
                </td>
                <td className="px-4 py-3 text-sm">
                  {plan.price_yearly_cents
                    ? formatCurrency(plan.price_yearly_cents)
                    : "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <div>
                      Alunos: {plan.max_active_students ?? "∞"}
                    </div>
                    <div>
                      Cursos: {plan.max_courses ?? "∞"}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {plan.stripe_product_id ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Sincronizado
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      Local
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      plan.active
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {plan.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingPlan(plan);
                        setShowForm(true);
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleActive(plan)}
                      disabled={loading === plan.id}
                      className="text-sm text-muted-foreground hover:underline disabled:opacity-50"
                    >
                      {loading === plan.id
                        ? "..."
                        : plan.active
                          ? "Desativar"
                          : "Ativar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
