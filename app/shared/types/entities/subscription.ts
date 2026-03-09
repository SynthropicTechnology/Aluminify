/**
 * Tipos de entidades de assinaturas e planos
 */

// ============================================================================
// Enums
// ============================================================================

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "trialing"
  | "paused";

export type BillingInterval = "month" | "year";

// ============================================================================
// Subscription Plan (catálogo de planos)
// ============================================================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  features: string[];

  // Stripe sync
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;

  // Preços
  price_monthly_cents: number;
  price_yearly_cents: number | null;
  currency: string;

  // Limites
  max_active_students: number | null;
  max_courses: number | null;
  max_storage_mb: number | null;
  allowed_modules: string[];
  extra_student_price_cents: number | null;

  // Display
  display_order: number;
  is_featured: boolean;
  badge_text: string | null;

  // Status
  active: boolean;

  created_at: string;
  updated_at: string;
}

export interface CreatePlanInput {
  name: string;
  slug: string;
  description?: string;
  features?: string[];
  price_monthly_cents: number;
  price_yearly_cents?: number;
  currency?: string;
  max_active_students?: number;
  max_courses?: number;
  max_storage_mb?: number;
  allowed_modules?: string[];
  extra_student_price_cents?: number;
  display_order?: number;
  is_featured?: boolean;
  badge_text?: string;
}

export interface UpdatePlanInput {
  name?: string;
  description?: string;
  features?: string[];
  price_monthly_cents?: number;
  price_yearly_cents?: number;
  max_active_students?: number | null;
  max_courses?: number | null;
  max_storage_mb?: number | null;
  allowed_modules?: string[];
  extra_student_price_cents?: number | null;
  display_order?: number;
  is_featured?: boolean;
  badge_text?: string | null;
  active?: boolean;
}

// ============================================================================
// Subscription (instância de assinatura de um tenant)
// ============================================================================

export interface Subscription {
  id: string;
  empresa_id: string;
  plan_id: string;

  // Stripe sync
  stripe_subscription_id: string | null;
  stripe_customer_id: string;

  // Status
  status: SubscriptionStatus;
  billing_interval: BillingInterval;

  // Período
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;

  // Pagamento
  last_payment_date: string | null;
  last_payment_amount_cents: number | null;
  next_payment_date: string | null;

  // Metadata
  metadata: Record<string, unknown>;

  created_at: string;
  updated_at: string;

  // Relations (populated when joined)
  plan?: SubscriptionPlan;
}

// ============================================================================
// Public Plan (para exibição na pricing page, sem dados internos)
// ============================================================================

export interface PublicPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  features: string[];
  price_monthly_cents: number;
  price_yearly_cents: number | null;
  currency: string;
  max_active_students: number | null;
  max_courses: number | null;
  max_storage_mb: number | null;
  extra_student_price_cents: number | null;
  display_order: number;
  is_featured: boolean;
  badge_text: string | null;
}
