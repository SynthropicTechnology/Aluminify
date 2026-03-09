"use client";

import { useState } from "react";

interface SubscriptionRow {
  id: string;
  empresa_id: string;
  plan_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string;
  status: string;
  billing_interval: string;
  current_period_end: string | null;
  next_payment_date: string | null;
  last_payment_amount_cents: number | null;
  created_at: string;
  canceled_at: string | null;
  subscription_plans: {
    id: string;
    name: string;
    slug: string;
    price_monthly_cents: number;
    price_yearly_cents: number | null;
  } | null;
  empresas: {
    id: string;
    nome: string;
    slug: string;
  } | null;
}

interface SubscriptionListProps {
  initialSubscriptions: SubscriptionRow[];
  plans: { id: string; name: string }[];
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-green-100 text-green-700" },
  past_due: { label: "Inadimplente", className: "bg-yellow-100 text-yellow-700" },
  canceled: { label: "Cancelada", className: "bg-red-100 text-red-700" },
  unpaid: { label: "Não paga", className: "bg-red-100 text-red-700" },
  trialing: { label: "Trial", className: "bg-blue-100 text-blue-700" },
  paused: { label: "Pausada", className: "bg-gray-100 text-gray-600" },
};

export function SubscriptionList({
  initialSubscriptions,
  plans,
}: SubscriptionListProps) {
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [statusFilter, setStatusFilter] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [search, setSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = subscriptions.filter((sub) => {
    if (statusFilter && sub.status !== statusFilter) return false;
    if (planFilter && sub.plan_id !== planFilter) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      const tenantName = sub.empresas?.nome?.toLowerCase() || "";
      if (!tenantName.includes(searchLower)) return false;
    }
    return true;
  });

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(cents / 100);
  }

  function formatDate(date: string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("pt-BR");
  }

  async function handleAction(action: "cancel" | "change_plan", subscriptionId: string, planId?: string) {
    setActionLoading(subscriptionId);
    try {
      const res = await fetch("/api/superadmin/assinaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          subscription_id: subscriptionId,
          plan_id: planId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh
        const refreshRes = await fetch("/api/superadmin/assinaturas");
        const refreshData = await refreshRes.json();
        if (refreshData.subscriptions) setSubscriptions(refreshData.subscriptions);
      }
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por tenant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativa</option>
          <option value="past_due">Inadimplente</option>
          <option value="canceled">Cancelada</option>
          <option value="unpaid">Não paga</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">Todos os planos</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">Tenant</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Plano</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Intervalo</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Próximo Pagamento</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Valor</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma assinatura encontrada.
                </td>
              </tr>
            ) : (
              filtered.map((sub) => {
                const statusInfo = STATUS_LABELS[sub.status] || {
                  label: sub.status,
                  className: "bg-gray-100 text-gray-600",
                };
                const plan = sub.subscription_plans;
                const amount =
                  sub.billing_interval === "year"
                    ? plan?.price_yearly_cents
                    : plan?.price_monthly_cents;

                return (
                  <tr key={sub.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {sub.empresas?.nome || "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {sub.empresas?.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {plan?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sub.billing_interval === "year" ? "Anual" : "Mensal"}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {formatDate(sub.next_payment_date || sub.current_period_end)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {amount ? formatCurrency(amount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {sub.status === "active" && (
                          <button
                            onClick={() => handleAction("cancel", sub.id)}
                            disabled={actionLoading === sub.id}
                            className="text-sm text-destructive hover:underline disabled:opacity-50"
                          >
                            {actionLoading === sub.id ? "..." : "Cancelar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} assinatura{filtered.length !== 1 ? "s" : ""}{" "}
        {statusFilter || planFilter || search ? "(filtrado)" : ""}
      </div>
    </div>
  );
}
