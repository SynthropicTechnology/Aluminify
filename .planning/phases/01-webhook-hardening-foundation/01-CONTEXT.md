# Phase 1: Webhook Hardening & Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the existing Stripe webhook integration reliable: add idempotency via `webhook_events` table, implement single-sync pattern (`syncStripeSubscriptionToLocal()`), add Zod validation and rate limiting to all billing routes, and replace all console.log with structured logging. This is foundational infrastructure — no new features, no UI changes.

</domain>

<decisions>
## Implementation Decisions

### Logging Strategy
- **D-01:** Use Sentry for errors/alerts + a lightweight custom structured logger for stdout (zero new dependencies). Replace all 19 console.log statements in the webhook handler with structured log entries (JSON format with event type, status, duration, stripe_event_id).
- **D-02:** The custom logger should be a simple utility in `app/shared/core/services/` that wraps `console.log`/`console.error` with structured JSON output (timestamp, level, context, message). Not a full logging framework.

### Claude's Discretion
- **Webhook failure behavior:** Claude decides. Recommended: persist failed events in `webhook_events` table with `failed` status, rely on Stripe's automatic retry (up to 3 days), surface in superadmin UI in Phase 2.
- **DB migrations:** Claude decides. Recommended: use Supabase migrations in `supabase/migrations/` to create `webhook_events` table (consistent with existing migration pattern).
- **Single-sync pattern:** Claude decides. Recommended: create `syncStripeSubscriptionToLocal(subscriptionId)` function that always fetches current Stripe state via `stripe.subscriptions.retrieve()` and upserts into local DB. Every webhook event type calls this single function instead of applying incremental updates.
- **Zod validation scope:** Claude decides. Apply Zod schemas to all 9 Stripe/billing/superadmin route files. Prioritize webhook route and checkout/portal routes.
- **Rate limiting configuration:** Claude decides. Use existing `rateLimitService` from `app/shared/core/services/rate-limit/rate-limit.service.ts`. Apply to `/api/stripe/checkout`, `/api/stripe/portal`, and `/api/webhooks/stripe`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Stripe Integration (existing code to modify)
- `app/api/webhooks/stripe/route.ts` — Current webhook handler (19 console.log, no idempotency, incremental updates)
- `app/api/stripe/checkout/route.ts` — Checkout session creation
- `app/api/stripe/portal/route.ts` — Billing portal session creation
- `app/shared/core/services/stripe.service.ts` — Stripe client singleton factory

### Superadmin Billing Routes (need validation)
- `app/api/superadmin/assinaturas/route.ts` — Subscription management (cancel, change plan)
- `app/api/superadmin/assinaturas/[id]/route.ts` — Subscription detail
- `app/api/superadmin/planos/route.ts` — Plan CRUD with Stripe sync
- `app/api/superadmin/faturas/route.ts` — Invoice listing from Stripe
- `app/api/superadmin/metricas/route.ts` — SaaS metrics

### Reusable Services
- `app/shared/core/services/rate-limit/rate-limit.service.ts` — Existing rate limit service (in-memory sliding window, per-tenant)

### Database
- `supabase/migrations/` — Existing migration files (pattern to follow for webhook_events table)

### Research
- `.planning/research/PITFALLS.md` — 15 domain-specific pitfalls including split-brain, idempotency, race conditions
- `.planning/research/ARCHITECTURE.md` — Subscription state machine, webhook reliability patterns
- `.planning/research/STACK.md` — Zero new deps needed, webhook_events table schema recommendation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rateLimitService` (`app/shared/core/services/rate-limit/rate-limit.service.ts`) — Full rate limit implementation with per-tenant sliding window. Ready to use, just needs to be wired into billing routes.
- `getDatabaseClient()` (`app/shared/core/database/database.ts`) — Service-role client for webhook handler (already used correctly).
- `stripe.service.ts` — Singleton Stripe client factory. Already initialized with correct API version.
- Sentry (`@sentry/nextjs`) — Already installed and configured. Use `Sentry.captureException()` for errors, `Sentry.addBreadcrumb()` for tracking.

### Established Patterns
- API routes use `NextRequest`/`NextResponse` pattern in `route.ts` files
- Auth middleware wraps handlers: `requireSuperadmin()`, `requireSuperadminForAPI()`
- Database operations use `getDatabaseClient()` for admin ops
- Supabase migrations in `supabase/migrations/` with timestamped filenames

### Integration Points
- Webhook handler at `app/api/webhooks/stripe/route.ts` is the primary target — needs full rewrite of event processing logic
- All 5 superadmin billing routes need Zod validation wrappers added
- Rate limit service needs to be imported and called at the start of billing route handlers
- New `webhook_events` table requires a Supabase migration file

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. User trusts Claude on technical decisions for this infrastructure phase. Key constraint: zero new npm dependencies.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-webhook-hardening-foundation*
*Context gathered: 2026-03-23*
