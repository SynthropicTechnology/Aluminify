# Domain Pitfalls

**Domain:** SaaS Billing & Subscription Management (Stripe + Supabase Multi-Tenant)
**Researched:** 2026-03-23
**Specific to:** Aluminify -- adding billing to an existing multi-tenant educational portal

---

## Critical Pitfalls

Mistakes that cause data corruption, revenue loss, or require architectural rewrites.

---

### Pitfall 1: Split-Brain State Between Stripe and Local Database

**What goes wrong:** The local `subscriptions` table and `empresas.plano` diverge from Stripe's actual subscription state. A tenant shows as "active" locally but is actually canceled in Stripe, or vice versa. Revenue dashboards display incorrect MRR because local data is stale.

**Why it happens:** The current webhook handler updates local state per-event (e.g., `handleSubscriptionUpdated` writes specific fields from the event payload). If a webhook is missed, arrives out of order, or the handler crashes after partial writes, the local database permanently drifts from Stripe. The current code has **no reconciliation mechanism** -- there is no periodic sync, no "fetch current state from Stripe" fallback, and no way to detect drift.

**Evidence in codebase:**
- `app/api/webhooks/stripe/route.ts` handles 5 event types independently, each writing different fields
- `handleSubscriptionUpdated` (line 236-298) writes `plan_id`, `status`, `billing_interval`, `cancel_at` but does NOT update `empresas.plano` unless the price actually changed -- meaning a status change to "canceled" in Stripe leaves `empresas.plano` unchanged
- `handleSubscriptionDeleted` (line 300-313) sets `status: "canceled"` but never resets `empresas.plano` to a free tier
- The `empresas` table has BOTH `plano` (enum: basico/profissional/enterprise) and `subscription_id` (FK) -- two sources of truth for "what plan is this tenant on"
- MRR calculation in `/api/superadmin/metricas/route.ts` uses local `subscription_plans.price_monthly_cents`, not Stripe's actual charge amounts

**Consequences:**
- Tenants retain paid features after cancellation (revenue loss)
- Superadmin dashboard shows phantom MRR
- Support tickets from tenants who paid but show as unpaid
- Manual Stripe dashboard checks become the only reliable source of truth

**Prevention:**
1. Adopt the **single-sync-function pattern**: create a `syncStripeSubscriptionToLocal(stripeCustomerId)` function that fetches the full subscription state from Stripe's API and writes it atomically to the local DB. Every webhook event triggers this same function instead of per-event handlers. This eliminates ordering bugs, partial writes, and missed-event drift.
2. Add a **nightly reconciliation job** that iterates all `empresas` with `stripe_customer_id` and calls the sync function, logging any discrepancies.
3. Make Stripe the single source of truth for subscription state. The local DB is a read cache, not a parallel state machine.

**Detection:**
- Add a health check that compares `subscriptions.status` against `stripe.subscriptions.retrieve()` for a sample of tenants
- Alert when `empresas.plano` does not match the expected plan for `subscriptions.plan_id`
- Log discrepancies when the webhook handler finds `localSub.status !== stripeSubscription.status`

**Phase:** Must be addressed in the first phase (Stripe integration review/fix) before any other billing work builds on top of this foundation.

**Confidence:** HIGH -- the t3dotgg/stripe-recommendations repo, Stripe's own docs, and multiple production post-mortems all converge on this pattern.

---

### Pitfall 2: Webhook Handler Is Not Idempotent (Despite Appearance)

**What goes wrong:** Duplicate webhook deliveries cause duplicate database operations or corrupt state. Stripe retries failed webhooks for up to 72 hours with exponential backoff. The handler processes the same event multiple times.

**Why it happens:** The current `handleCheckoutSessionCompleted` has an idempotency check (line 116-125: checks if `stripe_subscription_id` already exists). However, the other four handlers (`handleInvoicePaid`, `handleInvoicePaymentFailed`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`) have **no idempotency protection**. They blindly update on every call.

**Evidence in codebase:**
- `handleInvoicePaid` (line 180-219): overwrites `last_payment_date` and `status` every time, even if this event was already processed
- `handleInvoicePaymentFailed` (line 221-234): sets `status: "past_due"` unconditionally -- a retry of an old failure event could override a subsequent successful payment
- No `stripe_event_id` tracking anywhere -- no `webhook_events` table, no processed-event deduplication
- The handler does not store `event.id` or `event.created` timestamps

**Consequences:**
- An old `invoice.payment_failed` retry arrives AFTER `invoice.paid`, reverting the subscription to `past_due` when it should be `active`
- `last_payment_date` gets overwritten with stale timestamps
- Out-of-order events are the norm, not the exception -- Stripe explicitly documents this

**Prevention:**
1. **Store processed event IDs**: create a `stripe_webhook_events` table with columns `event_id` (unique), `event_type`, `processed_at`, `stripe_created_at`. Check before processing; skip if already seen.
2. **Use event timestamps for ordering**: compare `event.created` against the subscription's `updated_at` timestamp. Discard events older than the last processed event for that subscription.
3. Better yet, adopt the single-sync-function pattern (Pitfall 1) which makes idempotency trivial -- you always fetch and write the current state regardless of which event triggered it.

**Detection:**
- Log `event.id` and check for duplicates in monitoring
- Track `event.created` vs `subscription.updated_at` to detect out-of-order processing
- Alert on status "downgrades" (active -> past_due) that happen within seconds of an upgrade

**Phase:** Must be addressed in the first phase alongside Pitfall 1.

**Confidence:** HIGH -- Stripe docs explicitly state events are not delivered in order. The current code has demonstrable ordering vulnerabilities.

---

### Pitfall 3: Race Condition Between Checkout Return and Webhook Arrival

**What goes wrong:** User completes Stripe Checkout, gets redirected to the success URL (`/{tenant}/configuracoes/plano?session_id={CHECKOUT_SESSION_ID}`), but the webhook has not yet arrived. The UI shows "no active subscription" or stale data. User panics, retries checkout, creates duplicate subscriptions.

**Why it happens:** Stripe webhooks are asynchronous and typically arrive 1-5 seconds after checkout completion, but can be delayed much longer. The current success URL includes `session_id` but the codebase has no code that uses it -- the success page presumably just renders the current subscription state from the local DB, which has not been updated yet.

**Evidence in codebase:**
- `app/api/stripe/checkout/route.ts` line 122: `success_url: ${baseUrl}/${tenantSlug}/configuracoes/plano?session_id={CHECKOUT_SESSION_ID}` -- passes session ID but nothing consumes it
- No `/api/stripe/verify-session` or similar endpoint exists to synchronously check checkout status
- No client-side polling mechanism found in the codebase
- Stripe's "Limit customers to one subscription" setting is not referenced anywhere, meaning duplicate checkouts are possible

**Consequences:**
- Users see contradictory state (paid but no active plan)
- Double-subscription creation if user retries
- Support burden from confused users
- Revenue complications from duplicate charges

**Prevention:**
1. **Eager sync on success page**: when the success page loads with `session_id`, make a server-side call to `stripe.checkout.sessions.retrieve(sessionId)` to get the subscription ID, then call `syncStripeSubscriptionToLocal()` immediately. Do not wait for the webhook.
2. **Client-side polling fallback**: if the subscription is not yet visible, poll every 2 seconds for up to 30 seconds with exponential backoff.
3. **Enable "Limit customers to one subscription"** in Stripe Dashboard settings to prevent duplicate subscriptions.
4. **Create the Stripe Customer before checkout** (currently done correctly in the checkout route), and verify no active subscription exists before creating a new checkout session.

**Detection:**
- Monitor for multiple `checkout.session.completed` events with the same `empresa_id` within a short window
- Track time between checkout success redirect and subscription appearing in local DB
- Alert on `subscriptions` table having multiple active records for the same `empresa_id`

**Phase:** First phase (Stripe integration review/fix). The success page handling is a fundamental UX issue.

**Confidence:** HIGH -- this is among the most commonly reported Stripe integration issues, documented by Stripe themselves and across community resources.

---

### Pitfall 4: Non-Atomic Stripe + Database Operations Create Orphaned Resources

**What goes wrong:** Plan creation in `/api/superadmin/planos` creates a Stripe Product + Prices first, then inserts into the local database. If the database insert fails (unique constraint, network error, etc.), Stripe has orphaned products/prices with no local reference. There is no cleanup or rollback.

**Why it happens:** Distributed transactions across Stripe API and Supabase are fundamentally impossible -- there is no two-phase commit. The current code assumes both operations succeed sequentially.

**Evidence in codebase:**
- `app/api/superadmin/planos/route.ts` POST handler (lines 78-133): creates Stripe product, monthly price, optional yearly price, THEN inserts into `subscription_plans`. If the insert at line 107 fails, Stripe resources are leaked.
- PUT handler (lines 175-237): archives old Stripe prices and creates new ones before updating local DB. Failure at line 230 leaves archived prices and orphaned new prices.
- PATCH handler (lines 267-275): updates Stripe price active status, then updates local DB. If DB update fails, Stripe prices are in wrong state.
- No `try/catch` with Stripe cleanup in any handler

**Consequences:**
- Orphaned Stripe products/prices accumulate
- Stripe dashboard shows products that don't exist in local system
- Re-creating the plan fails because slug is now taken in Stripe metadata
- Price IDs in Stripe don't match local records after partial failures

**Prevention:**
1. **Create in local DB first** (without Stripe IDs), then create Stripe resources, then update local DB with Stripe IDs. On Stripe failure, delete the local record. Local DB operations are easier to roll back.
2. **Alternatively, create Stripe resources first, then insert locally in a try/catch that cleans up Stripe on failure**: `stripe.products.update(productId, { active: false })` if the DB insert fails.
3. **Add a reconciliation script** that finds Stripe products/prices without corresponding local records and marks them inactive.
4. **Store the operation as a "pending" state** with a background job that completes it.

**Detection:**
- Periodically list Stripe products and compare against `subscription_plans`
- Monitor for 500 errors on plan creation endpoints
- Log Stripe resource IDs at creation time for audit trail

**Phase:** Second phase (superadmin enhancements), since plan CRUD is an admin operation with lower frequency.

**Confidence:** HIGH -- this is a well-documented distributed systems problem. The current code has zero rollback handling.

---

### Pitfall 5: Webhook Endpoint Has No Rate Limiting and Leaks Stack Traces

**What goes wrong:** The webhook endpoint at `/api/webhooks/stripe` is publicly accessible (no auth check besides Stripe signature verification, which is correct). But it has no rate limiting, meaning an attacker can flood it with invalid requests to cause DB connection exhaustion. Additionally, the error response at line 354 includes the raw error message, which could leak implementation details.

**Why it happens:** The rate-limit service exists (`app/shared/core/services/rate-limit/rate-limit.service.ts`) but is not used anywhere. API routes have no input validation (0 out of 155 routes use Zod, per CONCERNS.md). The webhook handler creates a new database client on every request (line 365).

**Evidence in codebase:**
- `app/api/webhooks/stripe/route.ts` line 354: `error: "Webhook signature verification failed: ${message}"` -- leaks internal error details
- Line 402: `console.log("[Stripe Webhook] Unhandled event type:", event.type)` -- no rate limiting on unhandled events (an attacker could send thousands of valid-signature events of unhandled types)
- Line 415-418: error response includes `error.message` and `error.stack` in console output
- The `getServiceClient()` function at line 26 creates a new Supabase client per request (not pooled)
- GET handler at line 428 exposes the list of handled events, providing reconnaissance information

**Consequences:**
- DDoS via webhook endpoint floods database connections
- Error messages reveal internal implementation details
- GET endpoint reveals which events are handled (information leakage for targeted attacks)
- No audit trail of failed webhook attempts

**Prevention:**
1. **Remove the GET handler** entirely -- webhook endpoints should only accept POST
2. **Add IP allowlisting for Stripe's webhook IPs** (Stripe publishes their IP ranges) or rely solely on signature verification
3. **Rate limit the endpoint**: allow ~100 requests per minute (Stripe's burst rate). Use the existing `rateLimitService` or a simple IP-based counter
4. **Sanitize error responses**: return generic "Invalid request" for all error cases. Never include the actual error message
5. **Remove `error.stack` from logs** in production -- use structured logging instead
6. **Pool the database client**: use `getDatabaseClient()` from `app/shared/core/database/database.ts` instead of creating a local client

**Detection:**
- Monitor webhook endpoint request rate
- Alert on signature verification failure spikes (indicates attack attempt)
- Track unique IP addresses hitting the webhook endpoint

**Phase:** First phase -- security hardening is prerequisite to going live with real payments.

**Confidence:** HIGH -- security issues are directly observable in the code.

---

## Moderate Pitfalls

---

### Pitfall 6: Tenant Feature Access Not Gated by Subscription Status

**What goes wrong:** A tenant's subscription expires, payment fails, or is canceled, but they continue accessing all platform features because there is no middleware or guard checking subscription status on protected routes.

**Why it happens:** The `empresas.plano` field determines feature access, but the webhook handler does not always update it (see Pitfall 1). Even if it did, there is no middleware checking `plano` against allowed features for each request. The `subscription_plans.allowed_modules` and `max_*` limit fields exist in the schema but are not enforced anywhere in the codebase.

**Evidence in codebase:**
- `subscription_plans` has `max_active_students`, `max_courses`, `max_storage_mb`, `allowed_modules` columns -- but no code references these for enforcement
- `app/shared/core/middleware.logic.ts` handles auth routing but has no subscription/plan checks
- No `checkSubscriptionLimits()` or `requireActivePlan()` utility exists
- `handleSubscriptionDeleted` sets status to "canceled" but does not update `empresas.plano` or restrict access

**Prevention:**
1. **Create a `requireActivePlan()` middleware** that checks `subscriptions.status` (not just `empresas.plano`) on every authenticated request
2. **Implement a grace period**: on payment failure, set a 7-14 day grace period before restricting access. Store `grace_period_end` on the subscription.
3. **Enforce plan limits in services**: add `checkPlanLimits(empresaId, resource)` checks in course creation, student enrollment, etc.
4. **Add a "subscription status" banner** in the tenant UI that shows warnings for past_due, approaching limit, etc.

**Detection:**
- Query for tenants where `subscriptions.status = 'canceled'` but `empresas.plano != 'basico'`
- Monitor feature usage against plan limits
- Track tenants accessing features after subscription expiration

**Phase:** Second or third phase -- requires plan limit enforcement infrastructure.

**Confidence:** HIGH -- the schema has limit fields but no enforcement code exists.

---

### Pitfall 7: MRR and Financial Metrics Are Inaccurate

**What goes wrong:** The superadmin metrics dashboard shows estimated MRR based on `subscription_plans.price_monthly_cents * active_subscription_count`, which ignores: yearly billing (dividing by 12), discounts/coupons, prorated charges, currency differences, and actual Stripe charge amounts.

**Why it happens:** The metrics endpoint (lines 51-65 of `/api/superadmin/metricas/route.ts`) calculates MRR by summing `plan.price_monthly_cents` for each active subscription. It does not account for `billing_interval` (yearly subscriptions should contribute `price_yearly_cents / 12`), and it ignores actual Stripe payment data entirely.

**Evidence in codebase:**
- `app/api/superadmin/metricas/route.ts` lines 63-65: `planDistribution[sub.plan_id].revenue_cents += plan.price_monthly_cents` -- adds full monthly price regardless of billing interval
- Lines 68-71: `estimatedMRR` is the sum of monthly prices, not actual revenue
- No churn rate calculation (requirement listed in PROJECT.md)
- No LTV or cohort analysis

**Prevention:**
1. **Calculate MRR correctly**: for monthly subs, use `price_monthly_cents`; for yearly subs, use `price_yearly_cents / 12`. Factor in the subscription's actual billing interval.
2. **Use Stripe's actual charge data** for revenue metrics where possible (via `stripe.invoices.list`)
3. **Build incremental metrics**: track MRR changes as events occur (new subscription = +MRR, cancellation = -MRR, upgrade = +delta) rather than recalculating from scratch each time
4. **Separate estimated vs actual revenue**: show both "plan-based MRR estimate" and "actual collected revenue from Stripe"

**Detection:**
- Compare displayed MRR against Stripe Dashboard's reported MRR
- Cross-check monthly counts: yearly subscribers should not contribute full monthly price to MRR

**Phase:** Third phase (advanced metrics). The current "estimated" approach is acceptable for MVP if clearly labeled.

**Confidence:** HIGH -- the math error is directly visible in the code.

---

### Pitfall 8: No Webhook Event Logging or Replay Capability

**What goes wrong:** When a webhook fails or causes unexpected behavior, there is no way to investigate what happened or replay the event. The only evidence is ephemeral `console.log` output (19 statements) that disappears when the serverless function instance dies.

**Why it happens:** The handler logs to console but does not persist webhook events to a database table. Stripe retains event data for 30 days in the dashboard, but there is no local record for correlation with local state changes.

**Evidence in codebase:**
- 19 `console.log/error` calls in the webhook handler with no structured logging
- No `webhook_events` or `stripe_events` table in the database schema
- No correlation ID between webhook events and local state changes
- When `handleInvoicePaid` silently returns because `subscription` is null (line 193-196), there is no record that this event was received but unprocessable

**Prevention:**
1. **Create a `stripe_webhook_events` table**: columns for `event_id` (unique), `event_type`, `stripe_created_at`, `processed_at`, `status` (received/processed/failed/skipped), `payload` (JSONB), `error_message`, `processing_time_ms`
2. **Log every event on receipt**, update status after processing
3. **Build a webhook replay endpoint** (superadmin-only) that re-processes a stored event
4. **Replace console.log with structured logging** that includes event ID, subscription ID, and processing outcome
5. **Add a Stripe webhook event viewer** in the superadmin panel

**Detection:**
- Query `stripe_webhook_events` for failed/skipped events
- Compare event counts against Stripe's webhook delivery logs
- Alert on events that are received but not processed (status = 'skipped')

**Phase:** First phase -- essential for debugging the initial Stripe integration testing.

**Confidence:** HIGH -- the lack of event persistence is directly observable.

---

### Pitfall 9: Plan Price Changes Do Not Migrate Existing Subscribers

**What goes wrong:** When a superadmin changes a plan's price, the code archives the old Stripe Price and creates a new one. But existing subscribers remain on the old (now archived) price. The local `subscription_plans` table now shows the new price, creating a mismatch between what existing subscribers actually pay and what the system thinks they pay.

**Why it happens:** Stripe Prices are immutable by design. When you "change" a price, you create a new Price object and archive the old one. Existing subscriptions continue using the old Price ID until explicitly migrated. The current PUT handler in `/api/superadmin/planos/route.ts` updates the local `price_monthly_cents` but does not update any existing subscriptions.

**Evidence in codebase:**
- `app/api/superadmin/planos/route.ts` PUT handler (lines 179-209): creates new Stripe Price, archives old one, updates `subscription_plans` table
- No call to `stripe.subscriptions.update()` for existing subscribers on this plan
- MRR calculation uses `plan.price_monthly_cents` (the new price) even though active subscribers are on the old price
- No migration path or "apply price change to existing subscribers" option

**Prevention:**
1. **Separate "catalog price" from "subscriber price"**: the plan table shows the current catalog price for new subscribers. Track actual subscriber prices via Stripe's subscription items.
2. **Implement a "price migration" flow**: when changing prices, offer options: (a) apply to new subscribers only (grandfather existing), (b) apply to all at next renewal, (c) apply immediately with proration
3. **Never archive a Stripe Price that has active subscriptions** -- instead, mark the local plan as "new price for new subscribers" and keep the old price active in Stripe
4. **Use Stripe's subscription schedule API** for planned price changes

**Detection:**
- Compare `subscription.items.data[0].price.unit_amount` from Stripe against `subscription_plans.price_monthly_cents` for active subscriptions
- Alert when price archival leaves orphaned subscribers on old prices

**Phase:** Second phase -- plan management enhancement.

**Confidence:** HIGH -- Stripe's price immutability is well-documented and the current code does not account for it.

---

### Pitfall 10: Dual Source of Truth for Tenant Plan (`empresas.plano` vs `subscriptions.plan_id`)

**What goes wrong:** The system has two places that define what plan a tenant is on: `empresas.plano` (an enum: basico/profissional/enterprise) and `subscriptions.plan_id` (FK to `subscription_plans`). These can disagree, and different parts of the codebase may check different fields.

**Why it happens:** The `empresas.plano` enum predates the subscription system -- it was the original way to categorize tenants. The subscription system added `subscriptions.plan_id` as a proper FK. The webhook handler tries to keep them in sync via `planoMapping` (line 48-52), but this mapping is lossy: it maps plan slugs to one of three enums, meaning any plan that doesn't map perfectly will default to "profissional" (line 161).

**Evidence in codebase:**
- `empresas.plano` is `enum_plano_empresa: "basico" | "profissional" | "enterprise"` (database.types.ts line 4014)
- `subscriptions.plan_id` is a proper UUID FK to `subscription_plans`
- `planoMapping` in webhook handler: `{ gratuito: "basico", nuvem: "profissional", personalizado: "enterprise" }` -- only 3 slugs mapped, any other slug defaults to "profissional"
- `handleCheckoutSessionCompleted` updates both (lines 155-170), but `handleSubscriptionDeleted` only updates `subscriptions.status`, not `empresas.plano`
- It's unclear which field the rest of the application checks for feature access

**Prevention:**
1. **Deprecate `empresas.plano`** as the source of truth for subscription tier. Use `subscriptions.plan_id` -> `subscription_plans` exclusively.
2. **Keep `empresas.plano` as a denormalized cache** that is always derived from the subscription state, never set independently
3. **Create a utility function** `getTenantPlan(empresaId)` that resolves the canonical plan from `subscriptions`, with fallback to `empresas.plano` for legacy tenants without subscriptions
4. **Add a database trigger** that updates `empresas.plano` whenever `subscriptions` is modified for that empresa

**Detection:**
- Query for mismatches: `SELECT * FROM empresas e JOIN subscriptions s ON s.empresa_id = e.id JOIN subscription_plans sp ON sp.id = s.plan_id WHERE planoMapping(sp.slug) != e.plano`
- Log warnings when `empresas.plano` is updated to a different value than expected

**Phase:** First phase -- this is foundational to correct subscription state management.

**Confidence:** HIGH -- the dual-source-of-truth is directly visible in the schema and code.

---

## Minor Pitfalls

---

### Pitfall 11: Webhook Handler Timeout Risk on Vercel/Serverless

**What goes wrong:** The webhook handler makes multiple Stripe API calls within each event handler (e.g., `handleCheckoutSessionCompleted` calls `stripe.subscriptions.retrieve()` on line 129, then does multiple DB writes). On serverless platforms, functions timeout at 10-30 seconds. Stripe expects a 200 response within 20 seconds.

**Prevention:**
1. Return 200 immediately after signature verification and event storage
2. Process the event asynchronously using `waitUntil()` (Next.js) or a background job queue
3. If synchronous processing is required, ensure the total processing time stays under 10 seconds

**Phase:** First phase -- affects reliability of all webhook processing.

---

### Pitfall 12: No Handling of `customer.subscription.created` Event

**What goes wrong:** The webhook handler handles `checkout.session.completed` for initial subscription creation, but does not handle `customer.subscription.created`. If a subscription is created outside of checkout (e.g., via Stripe Dashboard, API direct call, or Stripe Billing Portal upgrade), the local database is never updated.

**Prevention:**
1. Handle `customer.subscription.created` in addition to `checkout.session.completed`
2. Use the single-sync-function pattern so all subscription events trigger the same state reconciliation
3. Add `customer.subscription.paused` and `customer.subscription.resumed` if pause functionality is planned

**Phase:** First phase -- essential for complete event coverage.

---

### Pitfall 13: `stripe_customer_id` Required on Insert but Customer May Not Exist

**What goes wrong:** The `subscriptions` table has `stripe_customer_id` as a required column (NOT NULL in schema: `stripe_customer_id: string` in Insert type). For free plans without Stripe, there is no customer ID to store. The current free plan handling (mentioned in PROJECT.md) bypasses the subscription table entirely, but this creates inconsistency -- free tenants have no subscription record.

**Prevention:**
1. Allow `stripe_customer_id` to be nullable on the `subscriptions` table (or create Stripe customers for all tenants, even free ones)
2. Create subscription records for free plans with `status: 'active'` and null Stripe IDs
3. Ensure the plan enforcement logic works for both free (no Stripe) and paid (with Stripe) tenants

**Phase:** Second phase -- free plan handling refinement.

---

### Pitfall 14: Checkout Route Uses `request.headers.get("origin")` for Return URLs

**What goes wrong:** The checkout route (line 110) uses `request.headers.get("origin")` to build success/cancel URLs. The `Origin` header can be spoofed or missing (e.g., in API calls from mobile apps, server-side calls, or certain browser configurations). The fallback is `process.env.NEXT_PUBLIC_SUPABASE_URL` which is the Supabase URL, not the application URL.

**Prevention:**
1. Use a dedicated `NEXT_PUBLIC_APP_URL` or `APP_BASE_URL` environment variable for constructing callback URLs
2. Never derive application URLs from request headers in security-sensitive contexts
3. Validate that the constructed URL matches expected domain patterns

**Phase:** First phase -- small fix with significant security implications.

---

### Pitfall 15: Superadmin API Routes Reuse the Same `NextResponse.json()` Object

**What goes wrong:** Multiple superadmin API routes define `const UNAUTHORIZED = NextResponse.json(...)` at module scope (e.g., `/api/superadmin/planos/route.ts` line 18, `/api/superadmin/assinaturas/route.ts` line 15). In Node.js, `NextResponse.json()` creates a single Response object. Returning the same Response object from multiple requests may cause issues with response body consumption, since a Response body can only be read once.

**Prevention:**
1. Create the unauthorized response inside the handler function, not at module scope
2. Use a factory function: `const unauthorized = () => NextResponse.json({ error: "..." }, { status: 401 })`

**Phase:** First phase -- trivial fix during code review.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Stripe integration review/fix | Split-brain state (1), non-idempotent webhooks (2), checkout race condition (3) | Implement single-sync-function pattern, add webhook event table, add eager sync on checkout return |
| Stripe integration review/fix | Webhook security (5), webhook logging (8), event coverage (12) | Add rate limiting, remove GET handler, persist events, handle all subscription events |
| Stripe integration review/fix | Dual source of truth (10), return URL spoofing (14), module-scope responses (15) | Deprecate `empresas.plano` as authority, use env var for URLs, use factory functions |
| Superadmin enhancements | Non-atomic Stripe+DB operations (4), price migration gap (9) | Add rollback handling to plan CRUD, implement price migration flow |
| Tenant subscription management | Feature gating gap (6), free plan inconsistency (13) | Implement `requireActivePlan()` middleware, normalize free plan subscription records |
| Advanced metrics | Inaccurate MRR calculation (7) | Fix billing interval handling, use Stripe invoice data for actual revenue |
| Payment recovery / dunning | Webhook timeout (11) | Process events asynchronously, return 200 immediately |

---

## Sources

- [t3dotgg/stripe-recommendations](https://github.com/t3dotgg/stripe-recommendations) -- single-sync-function pattern, customer creation before checkout, eager sync on success page (HIGH confidence)
- [Stripe: Using webhooks with subscriptions](https://docs.stripe.com/billing/subscriptions/webhooks) -- event types, ordering not guaranteed (HIGH confidence)
- [Stripe: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) -- idempotency key best practices (HIGH confidence)
- [Stripe: Automate payment retries (Smart Retries)](https://docs.stripe.com/billing/revenue-recovery/smart-retries) -- dunning automation (HIGH confidence)
- [Stripe: Prorations](https://docs.stripe.com/billing/subscriptions/prorations) -- price change impact on existing subscribers (HIGH confidence)
- [Stripe: Receive events in your webhook endpoint](https://docs.stripe.com/webhooks) -- signature verification, retry behavior, 20-second timeout (HIGH confidence)
- [Stigg: Best practices for Stripe webhooks](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks) -- event processing, async handling (MEDIUM confidence)
- [excessivecoding.com: Billing webhook race condition solution guide](https://excessivecoding.com/blog/billing-webhook-race-condition-solution-guide) -- checkout return race condition patterns (MEDIUM confidence)
- [Pedro Alonso: Stripe Webhooks - Solving Race Conditions](https://www.pedroalonso.net/blog/stripe-webhooks-solving-race-conditions/) -- race condition prevention patterns (MEDIUM confidence)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) -- service role key behavior, RLS bypass (HIGH confidence)
- [Hookdeck: Webhook Security Vulnerabilities Guide](https://hookdeck.com/webhooks/guides/webhook-security-vulnerabilities-guide) -- replay attacks, SSRF, rate limiting (MEDIUM confidence)
- [Stripe CLI webhook ordering issue #418](https://github.com/stripe/stripe-cli/issues/418) -- confirmed out-of-order event delivery (HIGH confidence)
- [Laravel Cashier webhook ordering issue #1201](https://github.com/laravel/cashier-stripe/issues/1201) -- real-world ordering bugs in production framework (MEDIUM confidence)
- Direct codebase analysis of `app/api/webhooks/stripe/route.ts`, `app/api/stripe/checkout/route.ts`, `app/api/superadmin/planos/route.ts`, `app/api/superadmin/assinaturas/route.ts`, `app/api/superadmin/metricas/route.ts` (HIGH confidence)

---

*Pitfalls audit: 2026-03-23*
