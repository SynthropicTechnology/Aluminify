"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, AlertTriangle, ExternalLink } from "lucide-react";

interface PlanManagementProps {
  subscription: {
    id: string;
    status: string;
    billing_interval: string;
    current_period_end: string | null;
    next_payment_date: string | null;
    last_payment_amount_cents: number | null;
    canceled_at: string | null;
  } | null;
  currentPlan: {
    id: string;
    name: string;
    slug: string;
    price_monthly_cents: number;
    price_yearly_cents: number | null;
    max_active_students: number | null;
    max_courses: number | null;
    max_storage_mb: number | null;
    features: unknown;
  } | null;
  currentPlanoLegacy: string | null;
  hasStripeCustomer: boolean;
  availablePlans: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    features: unknown;
    price_monthly_cents: number;
    price_yearly_cents: number | null;
    max_active_students: number | null;
    max_courses: number | null;
    max_storage_mb: number | null;
    is_featured: boolean;
    badge_text: string | null;
  }[];
  usage: {
    students: number;
    courses: number;
  };
  tenantSlug: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Ativa", className: "bg-green-100 text-green-700" },
  past_due: { label: "Pagamento pendente", className: "bg-yellow-100 text-yellow-700" },
  canceled: { label: "Cancelada", className: "bg-red-100 text-red-700" },
  unpaid: { label: "Não paga", className: "bg-red-100 text-red-700" },
  trialing: { label: "Período de teste", className: "bg-blue-100 text-blue-700" },
};

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

function UsageBar({ current, max, label }: { current: number; max: number | null; label: string }) {
  if (!max) {
    return (
      <div className="text-sm">
        <div className="flex justify-between mb-1">
          <span className="text-muted-foreground">{label}</span>
          <span>{current} / Ilimitado</span>
        </div>
      </div>
    );
  }

  const percentage = Math.min((current / max) * 100, 100);
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 100;

  return (
    <div className="text-sm">
      <div className="flex justify-between mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={isCritical ? "text-destructive font-medium" : isWarning ? "text-yellow-600 font-medium" : ""}>
          {current} / {max}
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isCritical ? "bg-destructive" : isWarning ? "bg-yellow-500" : "bg-primary"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isCritical && (
        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Limite atingido. Faça upgrade para continuar adicionando.
        </p>
      )}
      {isWarning && !isCritical && (
        <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Próximo do limite ({Math.round(percentage)}%).
        </p>
      )}
    </div>
  );
}

export function PlanManagement({
  subscription,
  currentPlan,
  currentPlanoLegacy,
  hasStripeCustomer,
  availablePlans,
  usage,
}: PlanManagementProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [portalLoading, setPortalLoading] = useState(false);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleUpgrade(planId: string) {
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, billing_interval: "month" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // handle error
    }
  }

  const statusInfo = subscription
    ? STATUS_LABELS[subscription.status] || { label: subscription.status, className: "bg-gray-100 text-gray-600" }
    : null;

  const planName = currentPlan?.name || currentPlanoLegacy || "Sem plano";

  return (
    <div className="space-y-6">
      {/* Checkout success message */}
      {sessionId && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          Assinatura realizada com sucesso! Seu plano já está ativo.
        </div>
      )}

      {/* Current Plan Card */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Plano Atual</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Plano</p>
            <p className="text-lg font-semibold">{planName}</p>
          </div>
          {subscription && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ${statusInfo?.className}`}>
                  {statusInfo?.label}
                </span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Intervalo</p>
                <p className="font-medium">
                  {subscription.billing_interval === "year" ? "Anual" : "Mensal"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Próximo pagamento</p>
                <p className="font-medium">
                  {formatDate(subscription.next_payment_date || subscription.current_period_end)}
                </p>
              </div>
            </>
          )}
          {currentPlan && (
            <div>
              <p className="text-sm text-muted-foreground">Valor</p>
              <p className="font-medium">
                {currentPlan.price_monthly_cents > 0
                  ? subscription?.billing_interval === "year" && currentPlan.price_yearly_cents
                    ? `${formatCurrency(currentPlan.price_yearly_cents)}/ano`
                    : `${formatCurrency(currentPlan.price_monthly_cents)}/mês`
                  : "Gratuito"}
              </p>
            </div>
          )}
        </div>

        {hasStripeCustomer && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4" />
              {portalLoading ? "Abrindo..." : "Gerenciar Assinatura"}
            </button>
          </div>
        )}
      </div>

      {/* Usage Summary */}
      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Uso Atual</h3>
        <div className="space-y-4">
          <UsageBar
            current={usage.students}
            max={currentPlan?.max_active_students ?? null}
            label="Alunos ativos"
          />
          <UsageBar
            current={usage.courses}
            max={currentPlan?.max_courses ?? null}
            label="Cursos"
          />
        </div>
      </div>

      {/* Available Plans for Upgrade */}
      {availablePlans.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Fazer Upgrade</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {availablePlans
              .filter((p) => p.id !== currentPlan?.id)
              .map((plan) => {
                const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
                const isFree = plan.price_monthly_cents === 0;
                const isEnterprise = plan.slug === "personalizado";

                return (
                  <div
                    key={plan.id}
                    className={`rounded-lg border p-4 ${plan.is_featured ? "border-primary shadow-sm" : ""}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold">{plan.name}</h4>
                      {plan.badge_text && (
                        <span className="text-[10px] font-bold text-primary uppercase">
                          {plan.badge_text}
                        </span>
                      )}
                    </div>
                    <p className="text-lg font-bold mb-2">
                      {isEnterprise
                        ? "Sob consulta"
                        : isFree
                          ? "Grátis"
                          : `${formatCurrency(plan.price_monthly_cents)}/mês`}
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 mb-4">
                      {features.slice(0, 3).map((f, i) => (
                        <li key={i} className="flex gap-1.5">
                          <Check className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!isEnterprise && !isFree && (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        className="w-full rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Assinar
                      </button>
                    )}
                    {isEnterprise && (
                      <a
                        href="mailto:contato@aluminify.com"
                        className="block w-full rounded-md border px-3 py-1.5 text-xs font-medium text-center hover:bg-muted"
                      >
                        Falar com a gente
                      </a>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
