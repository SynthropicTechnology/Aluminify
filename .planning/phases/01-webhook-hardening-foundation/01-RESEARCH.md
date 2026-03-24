# Phase 1: Webhook Hardening & Foundation - Research

**Researched:** 2026-03-24
**Domain:** Stripe Webhook Reliability, API Input Validation, Structured Logging
**Confidence:** HIGH

## Summary

Phase 1 is a foundational infrastructure hardening phase with zero UI changes and zero new npm dependencies. The existing Stripe webhook handler at `app/api/webhooks/stripe/route.ts` has 19 `console.log/error` statements, no idempotency protection (no `webhook_events` table, no `stripe_event_id` tracking), creates its own Supabase client instead of using the shared `getDatabaseClient()`, and applies incremental state updates per event type rather than fetching current Stripe state. All 9 billing-related API routes (webhook, checkout, portal, 5 superadmin routes, and faturas) lack Zod input validation, and none use the existing `rateLimitService`.

The work decomposes into five distinct streams: (1) create `webhook_events` table via Supabase migration, (2) refactor webhook handler for idempotency + single-sync pattern + structured logging, (3) add Zod validation schemas to all 9 billing routes, (4) wire rate limiting into checkout/portal/webhook routes, and (5) create a lightweight structured logger utility. All streams are independent except the webhook refactor depends on the migration being applied first.

**Primary recommendation:** Implement the single-sync pattern (`syncStripeSubscriptionToLocal()`) that fetches current state from Stripe on every webhook event, combined with a `webhook_events` table for idempotency deduplication. Replace all `console.log` with a simple JSON structured logger in `app/shared/core/services/logger.service.ts`. Use Sentry (already installed) for error capture.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Use Sentry for errors/alerts + a lightweight custom structured logger for stdout (zero new dependencies). Replace all 19 console.log statements in the webhook handler with structured log entries (JSON format with event type, status, duration, stripe_event_id).
- **D-02:** The custom logger should be a simple utility in `app/shared/core/services/` that wraps `console.log`/`console.error` with structured JSON output (timestamp, level, context, message). Not a full logging framework.

### Claude's Discretion
- **Webhook failure behavior:** Persist failed events in `webhook_events` table with `failed` status, rely on Stripe's automatic retry (up to 3 days), surface in superadmin UI in Phase 2.
- **DB migrations:** Use Supabase migrations in `supabase/migrations/` to create `webhook_events` table (consistent with existing migration pattern).
- **Single-sync pattern:** Create `syncStripeSubscriptionToLocal(subscriptionId)` function that always fetches current Stripe state via `stripe.subscriptions.retrieve()` and upserts into local DB. Every webhook event type calls this single function instead of applying incremental updates.
- **Zod validation scope:** Apply Zod schemas to all 9 Stripe/billing/superadmin route files. Prioritize webhook route and checkout/portal routes.
- **Rate limiting configuration:** Use existing `rateLimitService` from `app/shared/core/services/rate-limit/rate-limit.service.ts`. Apply to `/api/stripe/checkout`, `/api/stripe/portal`, and `/api/webhooks/stripe`.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STRP-01 | Webhook handler is idempotent (table `webhook_events` with `stripe_event_id` UNIQUE, deduplication via INSERT ON CONFLICT) | Webhook idempotency guard pattern (Architecture Pattern 1), `webhook_events` table schema, PostgreSQL UNIQUE constraint + upsert |
| STRP-02 | Webhook handler uses single-sync pattern (`syncStripeSubscriptionToLocal()`) -- fetches current Stripe state instead of incremental updates | Single-sync function pattern (Architecture Pattern 2), `stripe.subscriptions.retrieve()` usage, atomic local DB upsert |
| STRP-03 | All billing routes validate input with Zod schemas | Zod schema patterns for each route, existing `zod ^3.25.76` package, zero Zod usage currently in API routes |
| STRP-04 | Rate limiting applied on billing routes using existing service | `rateLimitService.checkLimit()` integration pattern, existing per-tenant sliding window implementation |
| STRP-05 | Structured logging replaces all `console.log` in webhook handler and billing routes | Logger service pattern (D-01/D-02), Sentry `captureException()` for errors, JSON stdout format |
| RESIL-01 | Webhook events persisted in `webhook_events` table with status (received, processed, failed) | `webhook_events` table schema, status lifecycle (processing -> processed/failed), JSONB payload storage |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack locked:** Next.js 16 App Router + React 19 + TypeScript 5 (strict) + Supabase + Stripe -- do not change
- **Zero new npm dependencies:** All needed libraries already installed (stripe ^20.4.1, zod ^3.25.76, @sentry/nextjs ^10.38.0)
- **File names:** kebab-case, components PascalCase
- **Language:** Portuguese (Brazilian) in code/UI
- **Database client:** Use `getDatabaseClient()` from `app/shared/core/database/database.ts` for service-role operations (webhook handler currently creates its own -- must switch)
- **Unused variables:** Prefix with `_` (ESLint rule)
- **Tests:** Jest with `tests/*.test.ts` pattern, config in `jest.config.js`, run via `npm run test`
- **Quick validation:** `npm run check:quick` (lint + typecheck + colors, no tests)
- **Full validation:** `npm run check` (lint + typecheck + color validation + tests)
- **Migrations:** Supabase migrations in `supabase/migrations/` with `YYYYMMDDHHMMSS_description.sql` format

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | `^20.4.1` (latest on npm) | Stripe SDK -- signature verification, subscription retrieval, webhook processing | Already installed, API version `2026-02-25.clover` |
| `zod` | `^3.25.76` (npm latest: 4.3.6) | Input validation schemas for all API route bodies/params | Already installed at ^3.25.76; project uses Zod extensively (env.ts, forms). Do NOT upgrade to v4 in this phase -- breaking changes |
| `@sentry/nextjs` | `^10.38.0` (npm latest: 10.45.0) | Error capture, breadcrumbs for webhook processing | Already installed and configured with server config |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@supabase/supabase-js` | `^2.84.0` | Database operations via `getDatabaseClient()` | All webhook and API route DB operations |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom structured logger | pino, winston | Decision D-01 explicitly requires zero new deps; custom logger is ~30 lines |
| webhook_events table | Hookdeck, Svix | $39-490/mo overkill for current scale (<50 tenants) |
| In-memory rate limit | Redis-based rate limit | In-memory `rateLimitService` already exists and works for single-instance deployment |

**Installation:**
```bash
# Zero new packages needed -- all already installed
```

## Architecture Patterns

### Recommended Project Structure (new/modified files only)
```
app/
  shared/
    core/
      services/
        logger.service.ts           # NEW: structured JSON logger utility
        billing.service.ts          # NEW: syncStripeSubscriptionToLocal() + event dispatch
  api/
    webhooks/
      stripe/
        route.ts                    # MODIFY: idempotency, single-sync, structured logging, rate limit
    stripe/
      checkout/route.ts             # MODIFY: Zod validation, rate limit, structured logging
      portal/route.ts               # MODIFY: Zod validation, rate limit, structured logging
    superadmin/
      assinaturas/route.ts          # MODIFY: Zod validation, structured logging
      assinaturas/[id]/route.ts     # MODIFY: Zod validation, structured logging
      planos/route.ts               # MODIFY: Zod validation, structured logging
      faturas/route.ts              # MODIFY: Zod validation, structured logging
      metricas/route.ts             # MODIFY: Zod validation, structured logging
  shared/
    types/
      entities/
        subscription.ts             # MODIFY: add WebhookEvent type
supabase/
  migrations/
    YYYYMMDDHHMMSS_create_webhook_events.sql  # NEW: webhook_events table
tests/
  unit/
    stripe/
      webhook-handler.test.ts       # MODIFY: update for new idempotency + sync patterns
```

### Pattern 1: Webhook Idempotency Guard
**What:** Every webhook event is checked against `webhook_events` table before processing. Duplicate `stripe_event_id` values are silently skipped with a 200 response.
**When to use:** Every single webhook event, always -- before any business logic.
**Example:**
```typescript
// Source: Architecture research + Stripe docs on webhook best practices
async function processWebhookEvent(event: Stripe.Event, db: SupabaseClient<Database>) {
  // 1. Check if already processed
  const { data: existing } = await db
    .from("webhook_events")
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.status === "processed") {
    logger.info("webhook", "Duplicate event skipped", { stripe_event_id: event.id });
    return; // Idempotent: already handled
  }

  // 2. Upsert to 'processing' status
  const { data: record } = await db
    .from("webhook_events")
    .upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      status: "processing",
      payload: event.data.object as unknown as Json,
    }, { onConflict: "stripe_event_id" })
    .select("id")
    .single();

  const startTime = Date.now();

  try {
    // 3. Dispatch to handler
    await dispatchEvent(event, db);

    // 4. Mark processed
    await db
      .from("webhook_events")
      .update({
        status: "processed",
        processed_at: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
      })
      .eq("id", record!.id);
  } catch (error) {
    // 5. Mark failed
    await db
      .from("webhook_events")
      .update({
        status: "failed",
        processing_error: error instanceof Error ? error.message : String(error),
        processing_time_ms: Date.now() - startTime,
      })
      .eq("id", record!.id);
    throw error; // Re-throw so Stripe retries
  }
}
```

### Pattern 2: Single-Sync Function (syncStripeSubscriptionToLocal)
**What:** A single function that fetches the current Stripe subscription state via `stripe.subscriptions.retrieve()` and atomically writes it to the local database. Every webhook event type that relates to a subscription calls this same function.
**When to use:** After any subscription-related webhook event (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`).
**Why:** Eliminates split-brain state, makes ordering irrelevant (always fetches latest), makes idempotency trivial (latest state always wins).
**Example:**
```typescript
// Source: t3dotgg/stripe-recommendations pattern + Stripe official guidance
async function syncStripeSubscriptionToLocal(
  stripeSubscriptionId: string,
  db: SupabaseClient<Database>,
  metadata?: { empresa_id?: string; plan_id?: string }
): Promise<void> {
  const stripe = getStripeClient();
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const period = getSubscriptionPeriod(stripeSub);

  // Resolve plan from Stripe price ID
  const currentPriceId = stripeSub.items.data[0]?.price?.id;
  let planId = metadata?.plan_id;

  if (currentPriceId && !planId) {
    const { data: matchingPlan } = await db
      .from("subscription_plans")
      .select("id, slug")
      .or(`stripe_price_id_monthly.eq.${currentPriceId},stripe_price_id_yearly.eq.${currentPriceId}`)
      .maybeSingle();
    planId = matchingPlan?.id;
  }

  // Determine billing interval
  const interval = stripeSub.items.data[0]?.price?.recurring?.interval || "month";
  const stripeCustomerId = typeof stripeSub.customer === "string"
    ? stripeSub.customer
    : stripeSub.customer?.id ?? "";

  // Upsert subscription (create if not exists, update if exists)
  const subscriptionData = {
    stripe_subscription_id: stripeSubscriptionId,
    stripe_customer_id: stripeCustomerId,
    status: stripeSub.status as SubscriptionStatus,
    billing_interval: interval === "year" ? "year" : "month",
    current_period_start: new Date(period.current_period_start * 1000).toISOString(),
    current_period_end: new Date(period.current_period_end * 1000).toISOString(),
    cancel_at: stripeSub.cancel_at
      ? new Date(stripeSub.cancel_at * 1000).toISOString()
      : null,
    canceled_at: stripeSub.canceled_at
      ? new Date(stripeSub.canceled_at * 1000).toISOString()
      : null,
    ...(planId ? { plan_id: planId } : {}),
    ...(metadata?.empresa_id ? { empresa_id: metadata.empresa_id } : {}),
  };

  // Check if exists
  const { data: existing } = await db
    .from("subscriptions")
    .select("id, empresa_id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle();

  if (existing) {
    await db
      .from("subscriptions")
      .update(subscriptionData)
      .eq("id", existing.id);
  } else {
    // Insert requires empresa_id and plan_id
    if (!metadata?.empresa_id || !planId) {
      throw new Error(`Cannot create subscription without empresa_id and plan_id: ${stripeSubscriptionId}`);
    }
    await db
      .from("subscriptions")
      .insert({
        ...subscriptionData,
        empresa_id: metadata.empresa_id,
        plan_id: planId,
      });
  }

  // Sync empresas.plano enum (keep dual-source in sync until deprecated)
  const empresaId = existing?.empresa_id || metadata?.empresa_id;
  if (empresaId && planId) {
    const { data: plan } = await db
      .from("subscription_plans")
      .select("slug")
      .eq("id", planId)
      .single();

    if (plan) {
      const planoMapping: Record<string, "basico" | "profissional" | "enterprise"> = {
        gratuito: "basico",
        nuvem: "profissional",
        personalizado: "enterprise",
      };
      const planoValue = planoMapping[plan.slug] || "profissional";

      await db
        .from("empresas")
        .update({ plano: planoValue })
        .eq("id", empresaId);
    }
  }
}
```

### Pattern 3: Structured Logger Utility
**What:** A lightweight JSON logger wrapping `console.log`/`console.error` with structured output.
**When to use:** All logging in webhook handler and billing routes. Replaces raw `console.log`.
**Example:**
```typescript
// app/shared/core/services/logger.service.ts
// Source: Decision D-01/D-02 from CONTEXT.md

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, unknown>;
}

function formatLog(level: LogLevel, context: string, message: string, data?: Record<string, unknown>): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    context,
    message,
    ...(data ? { data } : {}),
  };
}

export const logger = {
  info(context: string, message: string, data?: Record<string, unknown>): void {
    console.log(JSON.stringify(formatLog("info", context, message, data)));
  },
  warn(context: string, message: string, data?: Record<string, unknown>): void {
    console.warn(JSON.stringify(formatLog("warn", context, message, data)));
  },
  error(context: string, message: string, data?: Record<string, unknown>): void {
    console.error(JSON.stringify(formatLog("error", context, message, data)));
  },
  debug(context: string, message: string, data?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === "development") {
      console.log(JSON.stringify(formatLog("debug", context, message, data)));
    }
  },
};
```

### Pattern 4: Rate Limiting Integration
**What:** Wire the existing `rateLimitService` into billing API routes.
**When to use:** At the top of every billing route handler, before any business logic.
**Key detail:** The webhook endpoint should use IP-based rate limiting (no authenticated user), while checkout/portal routes use `empresaId`-based limiting.
**Example:**
```typescript
// For authenticated routes (checkout, portal)
import { rateLimitService } from "@/shared/core/services/rate-limit/rate-limit.service";

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user?.empresaId) { /* 401 */ }

  if (!rateLimitService.checkLimit(user.empresaId)) {
    return NextResponse.json(
      { error: "Muitas requisicoes. Tente novamente em alguns segundos." },
      { status: 429 }
    );
  }
  // ... rest of handler
}

// For webhook route (IP-based since no auth)
export async function POST(request: NextRequest) {
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";

  if (!rateLimitService.checkLimit(`webhook:${clientIp}`)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }
  // ... rest of handler
}
```

### Pattern 5: Zod Validation Wrapper
**What:** Define Zod schemas for each route's input and validate at the top of the handler.
**When to use:** Every POST/PUT/PATCH handler that accepts a request body, and GET handlers with query params.
**Example:**
```typescript
import { z } from "zod";

// Schema definitions (co-located in route file or in shared types)
const checkoutSchema = z.object({
  plan_id: z.string().uuid("plan_id deve ser um UUID valido"),
  billing_interval: z.enum(["month", "year"]).default("month"),
});

// In handler
export async function POST(request: NextRequest) {
  // ... auth check

  const body = await request.json();
  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados invalidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { plan_id, billing_interval } = parsed.data;
  // ... rest of handler with typed, validated data
}
```

### Anti-Patterns to Avoid
- **Creating Supabase client in webhook handler:** Current code calls `getServiceClient()` which creates a new client per request. Use `getDatabaseClient()` from `app/shared/core/database/database.ts` instead.
- **Module-scope `NextResponse.json()` objects:** Currently 4 files create `const UNAUTHORIZED = NextResponse.json(...)` at module scope. Response bodies can only be read once. Replace with factory functions: `const unauthorized = () => NextResponse.json(...)`.
- **Leaking error details in webhook responses:** Current code returns `Webhook signature verification failed: ${message}` which exposes internals. Return generic error messages.
- **GET handler on webhook endpoint:** Current code exposes a GET handler listing handled event types -- information leakage. Remove it entirely.
- **Returning 500 on webhook processing errors:** Non-transient errors (bad data, missing fields) should return 200 to prevent Stripe from retrying endlessly. Only return 500 for truly transient errors (DB connection failure).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook deduplication | Custom in-memory event tracker | PostgreSQL `webhook_events` table with UNIQUE constraint on `stripe_event_id` | Survives restarts, provides audit trail, enables replay |
| Rate limiting | Custom middleware | Existing `rateLimitService` singleton | Already built, tested, per-tenant sliding window |
| Subscription state derivation | Custom state machine from events | `stripe.subscriptions.retrieve()` (single-sync pattern) | Stripe is the source of truth; always fetch current state |
| Error tracking | Custom error aggregation | Sentry `captureException()` (already installed) | Full stack traces, breadcrumbs, alerting, already configured |
| Schema validation | Manual `if (!field)` checks | Zod `.safeParse()` | Type inference, clear error messages, composable schemas |

**Key insight:** Every piece of infrastructure this phase needs already exists -- either as a Supabase table pattern, an installed npm package, or an existing service. The work is wiring things together, not building new systems.

## Common Pitfalls

### Pitfall 1: Returning 500 to Stripe on Non-Transient Errors
**What goes wrong:** Webhook handler throws on bad data (missing metadata, unknown plan slug) and returns 500. Stripe retries for 72 hours, flooding the endpoint with the same unprocessable event.
**Why it happens:** Default error handling treats all errors as transient.
**How to avoid:** Distinguish transient errors (DB connection failure) from permanent errors (missing metadata). Return 200 for permanent errors after logging/persisting to `webhook_events` as `failed`. Return 500 only for transient errors so Stripe retries.
**Warning signs:** `webhook_events` table filling with repeated `failed` records for the same `stripe_event_id`.

### Pitfall 2: Race Condition on Idempotency Check
**What goes wrong:** Two identical webhook deliveries arrive simultaneously. Both check `webhook_events` table, both find no existing record, both proceed to process.
**Why it happens:** SELECT-then-INSERT is not atomic.
**How to avoid:** Use `INSERT ... ON CONFLICT (stripe_event_id) DO NOTHING` or Supabase `.upsert()` with `onConflict: "stripe_event_id"`. The UNIQUE constraint guarantees only one insert succeeds. The second request's upsert becomes a no-op if status is already `processing`.
**Warning signs:** Duplicate subscription records for the same `stripe_subscription_id`.

### Pitfall 3: Webhook Handler Timeout
**What goes wrong:** The single-sync pattern adds a `stripe.subscriptions.retrieve()` call, increasing total processing time. If total time exceeds Stripe's 20-second timeout, Stripe marks delivery as failed and retries.
**Why it happens:** Multiple API calls (retrieve subscription + DB reads + DB writes) inside the webhook handler.
**How to avoid:** The idempotency guard makes retries harmless -- even if Stripe retries due to timeout, the second delivery will be deduplicated. At current scale (<50 tenants), processing should complete well under 10 seconds. Monitor `processing_time_ms` in `webhook_events`.
**Warning signs:** `processing_time_ms` consistently above 5000 in `webhook_events` table.

### Pitfall 4: handleSubscriptionDeleted Not Updating empresas.plano
**What goes wrong:** Current code only sets `subscriptions.status = "canceled"` but never resets `empresas.plano` to the free tier, so the tenant retains paid-tier access after cancellation.
**How to avoid:** The `syncStripeSubscriptionToLocal()` function handles all state transitions, including updating `empresas.plano` based on the current subscription status. When status is `canceled`, the plano should be reset or kept in sync with the plan the subscription was on (the single-sync function resolves this centrally).
**Warning signs:** Tenants with `subscriptions.status = "canceled"` but `empresas.plano = "profissional"`.

### Pitfall 5: Zod Validation Breaking Existing Clients
**What goes wrong:** Adding strict Zod validation rejects requests that previously worked (e.g., extra fields, missing optional fields with defaults).
**Why it happens:** Zod's default behavior rejects unknown properties.
**How to avoid:** Use `.passthrough()` or `.strip()` on Zod schemas during the transition. Ensure all current request formats are tested before deploying.
**Warning signs:** 400 errors in billing routes after deploying validation changes.

## Code Examples

### webhook_events Migration SQL
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_webhook_events.sql
-- Source: Architecture research ARCHITECTURE.md + STACK.md recommendations

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'processed', 'failed')),
    payload JSONB,
    processing_error TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    processed_at TIMESTAMPTZ
);

-- Index for deduplication lookups (primary use case)
CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events (stripe_event_id);

-- Index for status-based queries (superadmin monitoring in Phase 2)
CREATE INDEX idx_webhook_events_status ON webhook_events (status);

-- Index for event type filtering
CREATE INDEX idx_webhook_events_event_type ON webhook_events (event_type);

-- Index for chronological listing (newest first)
CREATE INDEX idx_webhook_events_created_at ON webhook_events (created_at DESC);

-- No RLS policy needed: accessed only via service-role by webhook handler and superadmin
COMMENT ON TABLE webhook_events IS 'Stripe webhook event log for idempotency and audit trail';
```

### Zod Schemas for All 9 Routes

```typescript
// Checkout POST body
const checkoutBodySchema = z.object({
  plan_id: z.string().uuid(),
  billing_interval: z.enum(["month", "year"]).default("month"),
});

// Portal POST body (empty -- no body required, but validate anyway)
const portalBodySchema = z.object({}).optional();

// Superadmin assinaturas POST body
const subscriptionActionSchema = z.object({
  action: z.enum(["cancel", "change_plan"]),
  subscription_id: z.string().uuid(),
  plan_id: z.string().uuid().optional(),
}).refine(
  (data) => data.action !== "change_plan" || data.plan_id,
  { message: "plan_id e obrigatorio para change_plan", path: ["plan_id"] }
);

// Superadmin assinaturas GET query params
const subscriptionListQuerySchema = z.object({
  status: z.enum(["active", "past_due", "canceled", "unpaid", "trialing", "paused"]).optional(),
  plan_id: z.string().uuid().optional(),
  search: z.string().optional(),
});

// Superadmin planos POST body
const createPlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  features: z.array(z.string()).default([]),
  price_monthly_cents: z.number().int().min(0),
  price_yearly_cents: z.number().int().min(0).optional(),
  currency: z.string().default("BRL"),
  max_active_students: z.number().int().positive().optional(),
  max_courses: z.number().int().positive().optional(),
  max_storage_mb: z.number().int().positive().optional(),
  allowed_modules: z.array(z.string()).default([]),
  extra_student_price_cents: z.number().int().min(0).optional(),
  display_order: z.number().int().default(0),
  is_featured: z.boolean().default(false),
  badge_text: z.string().optional(),
});

// Superadmin planos PUT body
const updatePlanSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  price_monthly_cents: z.number().int().min(0).optional(),
  price_yearly_cents: z.number().int().min(0).nullable().optional(),
  max_active_students: z.number().int().positive().nullable().optional(),
  max_courses: z.number().int().positive().nullable().optional(),
  max_storage_mb: z.number().int().positive().nullable().optional(),
  allowed_modules: z.array(z.string()).optional(),
  extra_student_price_cents: z.number().int().min(0).nullable().optional(),
  display_order: z.number().int().optional(),
  is_featured: z.boolean().optional(),
  badge_text: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

// Superadmin planos PATCH body
const togglePlanSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean(),
});

// Superadmin faturas GET query params
const invoiceListQuerySchema = z.object({
  customer: z.string().optional(),
  subscription: z.string().optional(),
  status: z.enum(["draft", "open", "paid", "uncollectible", "void"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  starting_after: z.string().optional(),
});
```

### Module-Scope Response Fix
```typescript
// BEFORE (bug: Response body can only be read once)
const UNAUTHORIZED = NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

// AFTER (factory function: creates new Response each time)
const unauthorized = () => NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
```

### WebhookEvent Type
```typescript
// Add to app/shared/types/entities/subscription.ts
export interface WebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  status: "processing" | "processed" | "failed";
  payload: Record<string, unknown> | null;
  processing_error: string | null;
  processing_time_ms: number | null;
  created_at: string;
  processed_at: string | null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `invoice.subscription` (direct field) | `invoice.parent.subscription_details.subscription` | Stripe API v20 (2026-02-25) | Codebase already uses the v20 pattern via `getSubscriptionIdFromInvoice()` helper |
| Per-event incremental state updates | Single-sync function fetches current Stripe state | Industry consensus ~2024 | Eliminates ordering bugs, partial writes, missed-event drift |
| `console.log` for webhook debugging | Structured JSON logging + Sentry for errors | Standard practice | Enables log aggregation, alerting, production debugging |

**Deprecated/outdated:**
- `invoice.subscription` direct access -- removed in Stripe v20. The codebase already handles this correctly.
- Zod v3 to v4 migration available but NOT recommended in this phase (v4 has breaking API changes).

## Open Questions

1. **Should `syncStripeSubscriptionToLocal` handle `checkout.session.completed` differently than other events?**
   - What we know: Checkout sessions carry `metadata` (empresa_id, plan_id) that subscription events do not. The sync function needs this metadata for initial subscription creation.
   - What's unclear: Whether to extract metadata from the checkout session and pass it to the sync function, or to rely on Stripe subscription metadata being set during checkout.
   - Recommendation: Extract metadata from the checkout session event and pass it to `syncStripeSubscriptionToLocal()` as an optional parameter. For all other events, the subscription already exists locally, so no metadata is needed.

2. **Should the webhook handler return 200 immediately and process asynchronously?**
   - What we know: Stripe has a 20-second timeout. Current handler makes 2-4 DB queries and 1 Stripe API call per event. At current scale, this completes in <2 seconds.
   - What's unclear: Whether Next.js 16 supports `waitUntil()` reliably for background processing.
   - Recommendation: Keep synchronous processing for now. The idempotency guard makes retries harmless. Monitor `processing_time_ms` and switch to async only if timeouts occur.

3. **Should we update the database types file after creating webhook_events table?**
   - What we know: `database.types.ts` is auto-generated and should not be manually edited. But the `webhook_events` table needs type support.
   - What's unclear: Whether the implementer has access to `supabase gen types` to regenerate.
   - Recommendation: Plan task should include a step to regenerate types after migration. If not possible, create manual types in `subscription.ts` and use them directly.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest ^30.2.0 with ts-jest |
| Config file | `jest.config.js` (exists, configured) |
| Quick run command | `npx jest tests/unit/stripe/ --no-coverage` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STRP-01 | Duplicate events are silently deduplicated | unit | `npx jest tests/unit/stripe/webhook-handler.test.ts -x` | Exists (needs update for idempotency via webhook_events table) |
| STRP-02 | syncStripeSubscriptionToLocal fetches current state and upserts | unit | `npx jest tests/unit/stripe/billing-service.test.ts -x` | Wave 0 |
| STRP-03 | Malformed input rejected with clear Zod errors | unit | `npx jest tests/unit/stripe/route-validation.test.ts -x` | Wave 0 |
| STRP-04 | Excessive requests return 429 | unit | `npx jest tests/unit/stripe/rate-limiting.test.ts -x` | Wave 0 |
| STRP-05 | Structured log entries produced (JSON format) | unit | `npx jest tests/unit/stripe/logger.test.ts -x` | Wave 0 |
| RESIL-01 | Events persisted with status lifecycle | unit | `npx jest tests/unit/stripe/webhook-handler.test.ts -x` | Exists (needs update for persistence testing) |

### Sampling Rate
- **Per task commit:** `npx jest tests/unit/stripe/ --no-coverage`
- **Per wave merge:** `npm run check`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/stripe/billing-service.test.ts` -- covers STRP-02 (syncStripeSubscriptionToLocal unit tests)
- [ ] `tests/unit/stripe/route-validation.test.ts` -- covers STRP-03 (Zod validation for all 9 routes)
- [ ] `tests/unit/stripe/rate-limiting.test.ts` -- covers STRP-04 (rate limit integration in billing routes)
- [ ] `tests/unit/stripe/logger.test.ts` -- covers STRP-05 (structured logger output format)
- [ ] Update `tests/unit/stripe/webhook-handler.test.ts` -- covers STRP-01/RESIL-01 (currently tests event structure only, needs idempotency and persistence tests)

## Existing Code Analysis

### Current Webhook Handler Issues (19 console statements counted)
| Line | Issue | Fix |
|------|-------|-----|
| 26-40 | Creates own Supabase client `getServiceClient()` | Replace with `getDatabaseClient()` |
| 84, 93-98, 111, 123, 151, 172-177, 194, 215-218, 233, 247, 292-297, 312, 359, 362-363, 402, 406-410, 415-418 | Raw `console.log/error` | Replace with `logger.info/error/warn` |
| 116-125 | Partial idempotency (checks subscription, not event ID) | Replace with `webhook_events` table check on `event.id` |
| 353-356 | Leaks error message in response | Return generic error |
| 428-441 | GET handler exposes handled events list | Remove entirely |
| 365 | Creates new DB client per request | Use cached `getDatabaseClient()` |
| 300-313 | `handleSubscriptionDeleted` does not update `empresas.plano` | Single-sync handles this |

### Routes Requiring Zod Validation (9 total)
| Route | Methods | Current Validation | Needs |
|-------|---------|-------------------|-------|
| `/api/webhooks/stripe` | POST | Stripe signature only | Event type validation (handled by Stripe SDK) |
| `/api/stripe/checkout` | POST | Manual `if (!plan_id)` | Zod body schema |
| `/api/stripe/portal` | POST | Auth only | Zod body schema (empty/optional) |
| `/api/superadmin/assinaturas` | GET, POST | Manual `if (!action)` | Zod query params + body schema |
| `/api/superadmin/assinaturas/[id]` | GET | None | Zod param validation |
| `/api/superadmin/planos` | GET, POST, PUT, PATCH | Manual `if (!name)` | Zod body schemas for POST/PUT/PATCH |
| `/api/superadmin/faturas` | GET | None | Zod query params |
| `/api/superadmin/metricas` | GET | None | No input to validate (query only) |

### Module-Scope Response Bug (4 files)
| File | Line | Variable |
|------|------|----------|
| `app/api/superadmin/assinaturas/route.ts` | 15 | `UNAUTHORIZED` |
| `app/api/superadmin/assinaturas/[id]/route.ts` | 10 | `UNAUTHORIZED` |
| `app/api/superadmin/planos/route.ts` | 18 | `UNAUTHORIZED` |
| `app/api/superadmin/faturas/route.ts` | 12 | `UNAUTHORIZED` |

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis: `app/api/webhooks/stripe/route.ts` (442 lines, 19 console statements, no idempotency)
- Direct codebase analysis: `app/api/stripe/checkout/route.ts` (139 lines, no Zod validation)
- Direct codebase analysis: `app/api/stripe/portal/route.ts` (65 lines, no Zod validation)
- Direct codebase analysis: `app/api/superadmin/assinaturas/route.ts` (184 lines, module-scope Response)
- Direct codebase analysis: `app/api/superadmin/assinaturas/[id]/route.ts` (114 lines, module-scope Response)
- Direct codebase analysis: `app/api/superadmin/planos/route.ts` (291 lines, module-scope Response)
- Direct codebase analysis: `app/api/superadmin/faturas/route.ts` (74 lines, module-scope Response)
- Direct codebase analysis: `app/api/superadmin/metricas/route.ts` (128 lines)
- Direct codebase analysis: `app/shared/core/services/rate-limit/rate-limit.service.ts` (174 lines, ready to use)
- Direct codebase analysis: `app/shared/core/services/stripe.service.ts` (20 lines, singleton factory)
- Direct codebase analysis: `app/shared/core/database/database.ts` (171 lines, cached service-role client)
- Direct codebase analysis: `sentry.server.config.ts` (Sentry configured with DSN, tracesSampleRate: 1)
- `.planning/research/PITFALLS.md` -- 15 domain pitfalls with evidence from codebase
- `.planning/research/ARCHITECTURE.md` -- webhook_events schema, single-sync pattern, state machine
- `.planning/research/STACK.md` -- zero new deps needed, schema additions

### Secondary (MEDIUM confidence)
- Stripe webhook best practices: events not delivered in order, 20-second timeout, 72-hour retry window
- t3dotgg/stripe-recommendations: single-sync-function pattern consensus
- npm registry: stripe@20.4.1 (latest), zod@4.3.6 (latest, NOT upgrading from 3.25.76), @sentry/nextjs@10.45.0 (latest)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages verified as installed, versions confirmed against npm registry
- Architecture: HIGH -- patterns derived from codebase analysis + Stripe official guidance + community consensus
- Pitfalls: HIGH -- every pitfall evidenced by specific line numbers in existing code
- Zod schemas: HIGH -- derived directly from current request/response types in each route

**Research date:** 2026-03-24
**Valid until:** 2026-04-23 (30 days -- stable infrastructure patterns)
