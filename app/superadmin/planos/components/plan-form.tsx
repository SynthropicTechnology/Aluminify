"use client";

import { useState } from "react";
import type { Database } from "@/lib/database.types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];

interface PlanFormProps {
  plan: Plan | null;
  onClose: () => void;
  onSaved: () => void;
}

export function PlanForm({ plan, onClose, onSaved }: PlanFormProps) {
  const isEditing = !!plan;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(plan?.name || "");
  const [slug, setSlug] = useState(plan?.slug || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [featuresText, setFeaturesText] = useState(
    Array.isArray(plan?.features)
      ? (plan.features as string[]).join("\n")
      : ""
  );
  const [priceMonthly, setPriceMonthly] = useState(
    plan ? (plan.price_monthly_cents / 100).toString() : ""
  );
  const [priceYearly, setPriceYearly] = useState(
    plan?.price_yearly_cents
      ? (plan.price_yearly_cents / 100).toString()
      : ""
  );
  const [maxStudents, setMaxStudents] = useState(
    plan?.max_active_students?.toString() || ""
  );
  const [maxCourses, setMaxCourses] = useState(
    plan?.max_courses?.toString() || ""
  );
  const [maxStorage, setMaxStorage] = useState(
    plan?.max_storage_mb?.toString() || ""
  );
  const [displayOrder, setDisplayOrder] = useState(
    plan?.display_order?.toString() || "0"
  );
  const [isFeatured, setIsFeatured] = useState(plan?.is_featured || false);
  const [badgeText, setBadgeText] = useState(plan?.badge_text || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const features = featuresText
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);
    const priceMonthCents = Math.round(parseFloat(priceMonthly || "0") * 100);
    const priceYearCents = priceYearly
      ? Math.round(parseFloat(priceYearly) * 100)
      : undefined;

    const payload = {
      ...(isEditing ? { id: plan.id } : {}),
      name,
      slug,
      description,
      features,
      price_monthly_cents: priceMonthCents,
      price_yearly_cents: priceYearCents,
      max_active_students: maxStudents ? parseInt(maxStudents) : null,
      max_courses: maxCourses ? parseInt(maxCourses) : null,
      max_storage_mb: maxStorage ? parseInt(maxStorage) : null,
      display_order: parseInt(displayOrder || "0"),
      is_featured: isFeatured,
      badge_text: badgeText || null,
    };

    try {
      const res = await fetch("/api/superadmin/planos", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Erro ao salvar plano");
        return;
      }

      onSaved();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">
        {isEditing ? `Editar: ${plan.name}` : "Novo Plano"}
      </h3>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEditing) {
                  setSlug(
                    e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, "-")
                      .replace(/^-|-$/g, "")
                  );
                }
              }}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Slug</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              disabled={isEditing}
              className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Features (uma por linha)
          </label>
          <textarea
            value={featuresText}
            onChange={(e) => setFeaturesText(e.target.value)}
            rows={4}
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder={"Até 500 alunos ativos\nSuporte prioritário\nBackups automáticos"}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Preço Mensal (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceMonthly}
              onChange={(e) => setPriceMonthly(e.target.value)}
              required
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Preço Anual (R$) — opcional
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={priceYearly}
              onChange={(e) => setPriceYearly(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Max Alunos
            </label>
            <input
              type="number"
              min="0"
              value={maxStudents}
              onChange={(e) => setMaxStudents(e.target.value)}
              placeholder="Ilimitado"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Max Cursos
            </label>
            <input
              type="number"
              min="0"
              value={maxCourses}
              onChange={(e) => setMaxCourses(e.target.value)}
              placeholder="Ilimitado"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Storage (MB)
            </label>
            <input
              type="number"
              min="0"
              value={maxStorage}
              onChange={(e) => setMaxStorage(e.target.value)}
              placeholder="Ilimitado"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Ordem de exibição
            </label>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Badge</label>
            <input
              type="text"
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              placeholder="Mais popular"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded"
              />
              Destaque na pricing page
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Plano"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
