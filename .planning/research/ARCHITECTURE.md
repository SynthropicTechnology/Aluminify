# Architecture Patterns

**Domain:** SaaS Billing, Subscription Management & Admin Platform
**Researched:** 2026-03-23

## Recommended Architecture

The billing system integrates into Aluminify's existing modular monolith as a cross-cutting concern that touches three execution contexts: **Stripe (external source of truth)**, **Superadmin (platform operator)**, and **Tenant (subscriber)**. The architecture centers on Stripe as the canonical state owner for subscriptions and payments, with the local Supabase database acting as a synchronized read-optimized mirror plus operational metadata (grace periods, dunning state, webhook audit trail).

### System Boundary Diagram

```
                        STRIPE (Source of Truth)
                        ========================
                        Products, Prices, Subscriptions,
                        Customers, Invoices, Payment Methods
                              |               ^
                    webhooks  |               | API calls
                              v               |
    +---------------------------------------------------------+
    |                    ALUMINIFY (Next.js)                    |
    |                                                          |
    |  +------------------+     +---------------------------+  |
    |  | WEBHOOK GATEWAY  |     | STRIPE SERVICE LAYER      |  |
    |  | /api/webhooks/   |---->| stripe.service.ts         |  |
    |  | stripe           |     | (singleton Stripe client) |  |
    |  +--------+---------+     +---------------------------+  |
    |           |                          ^                    |
    |           v                          |                    |
    |  +------------------+     +----------+----------------+  |
    |  | WEBHOOK EVENT    |     | BILLING SERVICE LAYER     |  |
    |  | LOG (new table)  |     | billing.service.ts (new)  |  |
    |  | webhook_events   |     | dunning.service.ts (new)  |  |
    |  +------------------+     +---------------------------+  |
    |           |                    |              |           |
    |           v                    v              v           |
    |  +--------------------------------------------------+   |
    |  |          SUPABASE (PostgreSQL + RLS)               |   |
    |  |  subscriptions | subscription_plans | empresas     |   |
    |  |  webhook_events | dunning_actions (new tables)     |   |
    |  +--------------------------------------------------+   |
    |           ^                    ^              ^           |
    |           |                    |              |           |
    |  +------------------+  +------------------+              |
    |  | SUPERADMIN UI    |  | TENANT UI        |              |
    |  | /superadmin/*    |  | /[tenant]/       |              |
    |  | (platform ops)   |  | configuracoes/   |              |
    |  +------------------+  | plano            |              |
    |                        +------------------+              |
    +---------------------------------------------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Auth Context |
|-----------|---------------|-------------------|--------------|
| **Webhook Gateway** | Receive, verify, deduplicate, dispatch Stripe events | Stripe (inbound), Webhook Event Log, Billing Service | None (signature-verified) |
| **Webhook Event Log** | Idempotency, audit trail, replay capability | Webhook Gateway (writes), Superadmin UI (reads) | Service-role (bypasses RLS) |
| **Stripe Service** | Singleton Stripe SDK client, low-level API calls | Stripe API (outbound) | Service-role key |
| **Billing Service** | Subscription lifecycle, plan changes, checkout, portal | Stripe Service, Supabase, Plan Limits Service | Varies (user-scoped or service-role) |
| **Dunning Service** | Payment failure handling, grace period, tenant notification | Billing Service, Supabase | Service-role |
| **Metrics Service** | MRR, churn, LTV, cohort calculations | Supabase (read-only) | Service-role |
| **Superadmin API** | Platform management endpoints | All services above | `requireSuperadminForAPI()` |
| **Superadmin UI** | Dashboard, tenant management, billing ops | Superadmin API via TanStack Query | `requireSuperadmin()` |
| **Tenant Billing UI** | Plan page, invoice history, payment alerts | Tenant API + Stripe Portal/Checkout | `requireUser({ isAdmin })` |
| **Plan Limits Service** | Enforce plan constraints on tenant operations | Supabase (existing) | Service-role |

### Component Boundary Rules

1. **Stripe Service** is the only component that directly calls Stripe SDK. All other components go through it.
2. **Billing Service** orchestrates state changes. The webhook handler and API routes both delegate to it.
3. **Superadmin API routes** call services with service-role access (bypasses RLS). They never expose raw Stripe objects.
4. **Tenant API routes** call services with user-scoped access for local data, and service-role for Stripe operations (since RLS does not apply to Stripe).
5. **Webhook Gateway** returns 200 immediately after signature verification and event log insertion. Processing happens synchronously but with idempotency protection (current scale does not justify a job queue).

## Data Flow

### 1. Subscription Creation Flow

```
Tenant Admin clicks "Assinar"
    |
    v
POST /api/stripe/checkout
    |-- getAuthenticatedUser() -> verify isAdmin
    |-- billingService.createCheckoutSession(empresaId, planId, interval)
    |     |-- stripeService.getOrCreateCustomer(empresaId, email, nome)
    |     |-- stripeService.createCheckoutSession(customerId, priceId, metadata)
    |-- Return session.url
    |
    v
Browser redirects to Stripe Checkout (hosted)
    |
    v
Customer completes payment
    |
    v
Stripe fires checkout.session.completed webhook
    |
    v
POST /api/webhooks/stripe
    |-- Verify signature
    |-- Check webhook_events for idempotency (event.id)
    |-- INSERT into webhook_events (status: 'processing')
    |-- billingService.handleCheckoutCompleted(session)
    |     |-- Create local subscription record
    |     |-- Update empresas.plano, subscription_id, stripe_customer_id
    |-- UPDATE webhook_events (status: 'processed')
    |-- Return 200
```

### 2. Payment Failure / Dunning Flow

```
Stripe Smart Retries fails a payment
    |
    v
Stripe fires invoice.payment_failed webhook
    |
    v
POST /api/webhooks/stripe
    |-- Verify + deduplicate
    |-- billingService.handlePaymentFailed(invoice)
    |     |-- Update subscription status to 'past_due'
    |     |-- dunningService.initiateFlow(empresaId, invoice)
    |           |-- Record dunning_action (type: 'payment_failed')
    |           |-- Calculate grace period expiry (7 days from now)
    |           |-- Mark tenant for in-app notification
    |
    v
[Day 1-7: Grace period]
    |-- Tenant sees alert banner in dashboard
    |-- "Atualizar forma de pagamento" links to Stripe Portal
    |
    v
[If payment succeeds during retry window]
    Stripe fires invoice.paid webhook
        |-- billingService.handleInvoicePaid(invoice)
        |     |-- Update subscription status to 'active'
        |     |-- dunningService.resolveFlow(subscriptionId)
        |     |-- Clear in-app alerts
    |
    v
[If all retries exhausted]
    Stripe fires customer.subscription.deleted (or updated to 'canceled'/'unpaid')
        |-- billingService.handleSubscriptionDeleted(subscription)
        |     |-- Update subscription status
        |     |-- dunningService.recordTermination(empresaId)
        |-- Plan Limits Service blocks new resource creation
        |-- Tenant sees "Assinatura cancelada" state
```

### 3. Superadmin Dashboard Data Flow

```
Superadmin opens /superadmin (dashboard)
    |
    v
Server Component: requireSuperadmin()
    |
    v
Client Component: MetricsDashboard
    |-- TanStack Query: GET /api/superadmin/metricas
    |     |-- metricsService.getDashboardMetrics()
    |     |     |-- Query subscriptions (count by status)
    |     |     |-- Query subscription_plans (plan distribution)
    |     |     |-- Calculate MRR from local data
    |     |     |-- Query empresas (tenant count)
    |     |     |-- Calculate churn rate (30-day window)
    |     |     |-- Optional: stripe.balance.retrieve()
    |     |-- Return aggregated JSON
    |
    v
Superadmin drills into /superadmin/assinaturas/[id]
    |-- TanStack Query: GET /api/superadmin/assinaturas/[id]
    |     |-- Local subscription + plan + empresa from Supabase
    |     |-- Stripe subscription details (expanded)
    |     |-- Stripe invoices for this customer
    |-- Render SubscriptionDetail component
```

### 4. Webhook Event Audit Flow

```
Superadmin opens /superadmin/webhooks (new page)
    |
    v
GET /api/superadmin/webhooks
    |-- Query webhook_events table
    |-- Filter by: status, event_type, date_range
    |-- Return paginated results
    |
    v
Superadmin clicks "Replay" on a failed event
    |
    v
POST /api/superadmin/webhooks/[id]/replay
    |-- Fetch original event from Stripe: stripe.events.retrieve(event.stripe_event_id)
    |-- Re-run through billingService handler
    |-- Update webhook_events record with new status
```

## New Database Tables

### webhook_events

```sql
CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, processed, failed
    payload JSONB NOT NULL,
    processing_error TEXT,
    attempts INTEGER DEFAULT 0,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_events_stripe_event_id ON webhook_events (stripe_event_id);
CREATE INDEX idx_webhook_events_status ON webhook_events (status);
CREATE INDEX idx_webhook_events_event_type ON webhook_events (event_type);
CREATE INDEX idx_webhook_events_created_at ON webhook_events (created_at DESC);
```

**No RLS needed** -- this table is only accessed via service-role by webhook handler and superadmin.

### dunning_actions (optional, can be deferred)

```sql
CREATE TABLE dunning_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES empresas(id),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id),
    action_type TEXT NOT NULL,  -- payment_failed, grace_started, grace_expired, resolved, tenant_notified
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_dunning_actions_empresa ON dunning_actions (empresa_id, created_at DESC);
```

## Patterns to Follow

### Pattern 1: Webhook Idempotency Guard

**What:** Every webhook handler checks the `webhook_events` table before processing. If the `stripe_event_id` already exists with status `processed`, return 200 immediately.

**When:** Every webhook event, always.

**Example:**

```typescript
// In webhook route handler, after signature verification
async function processWebhookEvent(event: Stripe.Event, db: SupabaseClient) {
  // 1. Idempotency check: try to insert, fail on duplicate
  const { data: existing } = await db
    .from("webhook_events")
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.status === "processed") {
    return; // Already handled
  }

  // 2. Insert or update to 'processing'
  const { data: record } = await db
    .from("webhook_events")
    .upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      status: "processing",
      payload: event.data.object as unknown as Json,
      attempts: (existing?.attempts ?? 0) + 1,
    }, { onConflict: "stripe_event_id" })
    .select("id")
    .single();

  try {
    // 3. Dispatch to handler
    await dispatchEvent(event, db);

    // 4. Mark processed
    await db
      .from("webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", record!.id);
  } catch (error) {
    // 5. Mark failed with error details
    await db
      .from("webhook_events")
      .update({
        status: "failed",
        processing_error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", record!.id);
    throw error;
  }
}
```

### Pattern 2: Stripe as Source of Truth, Local as Cache

**What:** Treat Stripe as the canonical source for subscription state, prices, and invoices. The local `subscriptions` table is a synchronized mirror for fast queries and offline reads. Never trust local state over Stripe state.

**When:** Any time there is a discrepancy between local and Stripe data, Stripe wins.

**Key Rules:**
- Webhook updates local DB to match Stripe state (write direction: Stripe -> Local)
- Admin actions (cancel, change plan) go through Stripe API first, then let the webhook update local state (write direction: Local -> Stripe API -> Stripe fires webhook -> Local updated)
- Superadmin detail pages fetch fresh Stripe data alongside local data for verification
- Metrics calculations use local data for speed (acceptable staleness: seconds to minutes)

### Pattern 3: Subscription State Machine

**What:** Map Stripe's subscription statuses to application behavior through a clearly defined state machine with transitions driven exclusively by webhook events.

**States and Application Behavior:**

```
+-------------------+--------------------------------------+----------------------------+
| Stripe Status     | Application Behavior                 | Transition Trigger         |
+-------------------+--------------------------------------+----------------------------+
| trialing          | Full access, no billing yet           | checkout.session.completed |
|                   |                                      | (with trial_period_days)   |
+-------------------+--------------------------------------+----------------------------+
| active            | Full access, billing current           | invoice.paid               |
|                   |                                      | subscription.updated       |
+-------------------+--------------------------------------+----------------------------+
| past_due          | Full access during grace period       | invoice.payment_failed     |
|                   | (7 days), then restricted access      |                            |
|                   | In-app warning banner shown           |                            |
+-------------------+--------------------------------------+----------------------------+
| canceled          | Read-only access until period end,    | subscription.deleted       |
|                   | then downgrade to free plan           |                            |
+-------------------+--------------------------------------+----------------------------+
| unpaid            | Blocked: no new resources             | After all retries exhaust  |
|                   | Existing data preserved               |                            |
+-------------------+--------------------------------------+----------------------------+
| incomplete        | Checkout not finished                 | checkout created but       |
|                   | Treat as no subscription              | payment not completed      |
+-------------------+--------------------------------------+----------------------------+
| incomplete_expired| Terminal: treat as no subscription    | 23h timeout on incomplete  |
+-------------------+--------------------------------------+----------------------------+
| paused            | Read-only access                      | Manual pause by superadmin |
+-------------------+--------------------------------------+----------------------------+
```

**Transition Diagram (simplified):**

```
                    checkout.session.completed
                    (with trial)
                         |
                         v
    [incomplete] -----> [trialing] -----> [active]
         |                                  ^  |
         |              invoice.paid        |  | invoice.payment_failed
         |              +---------+---------+  |
         |              |                      v
         |              |                [past_due]
         |              |                   |    |
         |      invoice.paid                |    | all retries fail
         |              |                   |    v
         |              +-------------------+ [unpaid/canceled]
         |
         | 23h timeout
         v
    [incomplete_expired]
```

### Pattern 4: Grace Period Enforcement

**What:** When a subscription goes `past_due`, the tenant retains full access for a configurable grace period (default 7 days). After the grace period expires, write operations are blocked but read access continues. This is already partially implemented in `plan-limits.service.ts`.

**When:** Every write operation that creates resources (students, courses, etc.) checks grace period via `isWithinGracePeriod()`.

**Enhancement needed:** The current implementation uses `subscription.updated_at` as grace start, which is fragile (any update resets the clock). Change to use the timestamp of the first `invoice.payment_failed` event, stored in `subscriptions.past_due_since` (new column).

### Pattern 5: Layered Service Architecture

**What:** Follow the existing codebase pattern of services + route handlers, extending it for billing concerns.

**Service Layer Structure:**

```
app/shared/core/services/
  stripe.service.ts          (existing -- Stripe SDK singleton)
  billing.service.ts         (new -- subscription lifecycle orchestration)
  dunning.service.ts         (new -- payment failure handling)
  metrics.service.ts         (new -- SaaS metrics calculations)
  plan-limits.service.ts     (existing -- enforce plan constraints)
```

**Billing Service responsibilities:**
- `createCheckoutSession(empresaId, planId, interval)`
- `createPortalSession(empresaId)`
- `handleCheckoutCompleted(session)`
- `handleInvoicePaid(invoice)`
- `handlePaymentFailed(invoice)`
- `handleSubscriptionUpdated(subscription)`
- `handleSubscriptionDeleted(subscription)`
- `cancelSubscription(subscriptionId)` -- superadmin action
- `changePlan(subscriptionId, newPlanId)` -- superadmin action

This consolidates the scattered logic currently split across the webhook handler and API route handlers into a single service with clear responsibilities.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Dual-Write Without Webhook Confirmation

**What:** Updating local database AND calling Stripe API in the same request, then assuming both succeeded.

**Why bad:** If the Stripe call succeeds but the local write fails (or vice versa), the systems are out of sync. Even worse: if both appear to succeed but the Stripe call is eventually reversed (e.g., 3D Secure challenge fails), the local state is wrong.

**Instead:** For superadmin actions (cancel, change plan), call Stripe API only and return a "pending" response. Let the webhook update local state. The existing code already does this correctly for cancel/change_plan -- preserve this pattern.

### Anti-Pattern 2: Trusting Client-Reported Subscription State

**What:** Using query parameters, client-side state, or URL-based flags (like `session_id`) to determine subscription status.

**Why bad:** Users can manipulate URLs. The current code shows a success message based on `session_id` URL parameter without server-side verification.

**Instead:** After checkout redirect, verify the session via Stripe API or check that the webhook has already processed (query `webhook_events` for the checkout event). Show "Processando seu pagamento..." until webhook confirms.

### Anti-Pattern 3: Blocking Webhook Processing With Heavy I/O

**What:** Making multiple Stripe API calls inside the webhook handler (e.g., `stripe.subscriptions.retrieve()` after receiving `checkout.session.completed`).

**Why bad:** Stripe has a 20-second timeout for webhook responses. Extra API calls add latency and risk timeout, causing Stripe to retry the webhook (creating duplicates). The current webhook handler makes a `stripe.subscriptions.retrieve()` call inside `handleCheckoutSessionCompleted` and `handleInvoicePaid`.

**Instead:** Extract all needed data from the webhook event payload itself. The subscription object in `checkout.session.completed` already contains the subscription ID. For period data, use the subscription object directly from `customer.subscription.updated` (which Stripe fires immediately after checkout). If the retrieve call is truly needed, ensure idempotency protects against retry-induced duplicates (Pattern 1 solves this).

### Anti-Pattern 4: Creating a Separate Supabase Client in Webhook Handler

**What:** The current webhook handler creates its own Supabase client via `getServiceClient()` instead of using the shared `getDatabaseClient()`.

**Why bad:** Duplicated client creation logic, bypasses any centralized configuration (logging, timeouts), and diverges from the rest of the codebase.

**Instead:** Use the existing `getDatabaseClient()` from `app/shared/core/database/database.ts`. It already provides a service-role client that bypasses RLS.

## Scalability Considerations

| Concern | Current (<50 tenants) | At 500 tenants | At 5000 tenants |
|---------|----------------------|----------------|-----------------|
| **Webhook throughput** | Synchronous processing in route handler is fine | Still fine; Supabase handles concurrent writes | Consider job queue (pg_boss or BullMQ) for decoupled processing |
| **Metrics calculation** | Query all subscriptions in memory (current approach works) | Pre-aggregate into materialized view or summary table, refresh on schedule | Dedicated analytics pipeline; Stripe Revenue Recognition |
| **Invoice listing** | Direct Stripe API calls per-request (current) | Cache with short TTL; paginate aggressively | Sync invoices to local table via webhook (invoice.created, invoice.updated) |
| **Webhook event log** | Unbounded growth is fine for months | Add retention policy (DELETE older than 90 days) | Partition by month; archive to cold storage |
| **Plan limits checks** | Per-request DB query (current) | Cache plan limits in memory (5-min TTL) | Already using in-memory cache; add Redis if multi-instance |
| **Dashboard real-time** | Polling every 30s via TanStack Query staleTime | Same approach works | Consider Supabase Realtime for subscription status changes |

## Suggested Build Order (Dependencies)

The following ordering is driven by technical dependencies and risk reduction:

### Phase 1: Foundation (Webhook Reliability + Data Integrity)

**Build first because:** Everything else depends on reliable webhook processing. The current webhook handler has no idempotency protection, no event logging, and creates its own DB client. Fixing this is prerequisite for testing any billing flow.

1. Create `webhook_events` table + migration
2. Refactor webhook handler: use `getDatabaseClient()`, add idempotency guard, structured logging
3. Extract billing logic into `billing.service.ts`
4. Add Zod validation to all Stripe API route inputs
5. Add rate limiting to Stripe-facing routes

**Dependencies:** None (foundational)

### Phase 2: Subscription State Machine + Grace Period

**Build second because:** Correct state transitions are needed before building UI that depends on subscription status. The existing `plan-limits.service.ts` already enforces some constraints but relies on potentially stale state.

1. Add `past_due_since` column to `subscriptions` table
2. Implement full state machine in `billing.service.ts` (all Stripe status transitions)
3. Enhance `isWithinGracePeriod()` to use `past_due_since` instead of `updated_at`
4. Add `dunning.service.ts` with grace period tracking
5. Add in-app notification for payment failures (banner component in tenant layout)

**Dependencies:** Phase 1 (reliable webhook processing)

### Phase 3: Superadmin Tenant Management

**Build third because:** Superadmin needs to see and manage tenants before advanced metrics matter. The existing superadmin pages are operational but incomplete (no tenant CRUD, no dunning visibility).

1. Add tenant CRUD in superadmin (list/view/activate/deactivate empresas)
2. Add webhook event log viewer in superadmin (`/superadmin/webhooks`)
3. Add dunning dashboard (tenants with `past_due` subscriptions, days in grace period)
4. Add webhook replay capability for failed events
5. Enhance subscription detail page with Stripe data reconciliation view

**Dependencies:** Phase 1, Phase 2 (need reliable state + dunning data)

### Phase 4: Tenant Billing UI

**Build fourth because:** Tenant-facing billing UI depends on correct subscription state and reliable Stripe integration. The existing plan page works but needs invoice history, payment alerts, and better checkout confirmation.

1. Add invoice history page in tenant settings (`/[tenant]/configuracoes/faturas`)
2. Add payment alert banner (past_due state detection in tenant layout)
3. Improve checkout success flow (verify via webhook_events instead of URL param)
4. Add trial period UI (if trials are enabled)

**Dependencies:** Phase 1, Phase 2 (correct state), Phase 3 (superadmin can verify)

### Phase 5: Advanced Metrics + Analytics

**Build last because:** Metrics are a reporting layer that reads data produced by all other phases. No other feature depends on metrics.

1. Implement `metrics.service.ts` with MRR, churn rate, LTV calculations
2. Add cohort analysis (subscription age buckets)
3. Add time-series MRR chart (requires storing historical snapshots or calculating from events)
4. Add revenue forecasting based on current active subscriptions
5. Enhance superadmin dashboard with advanced charts

**Dependencies:** All previous phases (needs real subscription data flowing through the system)

## File Location Conventions

Following the existing codebase patterns:

```
app/
  shared/
    core/
      services/
        stripe.service.ts           (existing -- no changes needed)
        billing.service.ts          (new -- subscription lifecycle)
        dunning.service.ts          (new -- payment failure handling)
        metrics.service.ts          (new -- SaaS analytics)
        plan-limits.service.ts      (existing -- enhance grace period logic)
    types/
      entities/
        subscription.ts             (existing -- add WebhookEvent type, DunningAction type)
  api/
    webhooks/
      stripe/
        route.ts                    (existing -- refactor for idempotency + billing service)
    stripe/
      checkout/route.ts             (existing -- minor refactor to use billing service)
      portal/route.ts               (existing -- minor refactor to use billing service)
    superadmin/
      webhooks/
        route.ts                    (new -- webhook event log listing)
        [id]/
          replay/route.ts           (new -- webhook replay)
      empresas/
        route.ts                    (new -- tenant CRUD)
        [id]/route.ts               (new -- tenant detail/update)
      metricas/
        route.ts                    (existing -- enhance with new metrics service)
  superadmin/
    (dashboard)/
      webhooks/
        page.tsx                    (new -- webhook log viewer)
        components/
          webhook-list.tsx          (new)
      empresas/
        page.tsx                    (new -- tenant management)
        [id]/page.tsx               (new -- tenant detail)
        components/
          tenant-list.tsx           (new)
          tenant-detail.tsx         (new)
  [tenant]/
    (modules)/
      configuracoes/
        plano/
          page.tsx                  (existing -- enhance)
          components/
            plan-management.tsx     (existing -- enhance with alerts)
        faturas/
          page.tsx                  (new -- invoice history)
          components/
            invoice-list.tsx        (new)
```

## Sources

- Existing codebase analysis: webhook handler, stripe service, superadmin API routes, plan limits service, tenant plan page (HIGH confidence)
- [Stripe Subscription Lifecycle Documentation](https://docs.stripe.com/billing/subscriptions/overview) (HIGH confidence)
- [Stripe Smart Retries Documentation](https://docs.stripe.com/billing/revenue-recovery/smart-retries) (HIGH confidence)
- [Stripe Webhook Best Practices](https://docs.stripe.com/webhooks) (HIGH confidence)
- [Stripe Subscription States Analysis](https://solmaz.io/stripe-subscription-states) (MEDIUM confidence)
- [Webhook Idempotency Implementation](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) (MEDIUM confidence)
- [Stripe Webhook Best Practices](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) (MEDIUM confidence)
- [Dunning Strategies for SaaS](https://www.kinde.com/learn/billing/churn/dunning-strategies-for-saas-email-flows-and-retry-logic/) (MEDIUM confidence)
- [Supabase Stripe Sync Engine](https://github.com/supabase/stripe-sync-engine) (MEDIUM confidence -- reference only, not recommending direct use)
