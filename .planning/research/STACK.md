# Technology Stack: SaaS Billing & Admin

**Project:** Aluminify -- SaaS Billing, Subscription Management & Superadmin Panel
**Researched:** 2026-03-23
**Mode:** Ecosystem (Stack dimension)

## Context

This is a **subsequent milestone** stack research. The core application stack is already defined and locked: Next.js 16, React 19, TypeScript 5, Supabase (PostgreSQL), Tailwind CSS v4, shadcn/ui, TanStack Query v5. Stripe SDK v20.4.1 is installed with partially-built checkout, portal, and webhook handling. This research focuses exclusively on what additional libraries, patterns, and configurations are needed for a production-grade SaaS billing system on top of the existing stack.

---

## Recommended Stack (Additions Only)

### Stripe SDK & Configuration

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `stripe` | `^20.4.1` (keep current) | Payment processing, subscriptions | Already installed. v20.4.1 is the latest npm release as of March 2026. No upgrade needed. The pinned API version is `2026-02-25.clover`. | HIGH |
| Stripe Smart Retries | Dashboard config | Automated dunning/payment recovery | Stripe's built-in ML-powered retry system. Recovers ~57% of failed recurring payments without any code. Configure in Dashboard > Billing > Revenue recovery > Retries. Set to 8 retries over 2 weeks. | HIGH |
| Stripe Customer Portal | Dashboard + API config | Tenant self-service billing management | Already partially implemented (`/api/stripe/portal`). Configure in Dashboard to enable: payment method updates, plan switching, cancellation with reason collection, invoice downloads. Zero additional code for the portal itself. | HIGH |
| Stripe Billing Emails | Dashboard config | Dunning emails, payment reminders, receipts | Configure in Dashboard > Settings > Emails. Enable: upcoming renewal reminders, failed payment notifications (branded with your logo), successful payment receipts. Stripe handles sending -- no custom email templates needed for dunning. | HIGH |

**Key decision: Do NOT add third-party dunning tools (ChurnKey, ChurnDog, ChurnBuster).** These tools cost $39-490/mo and are designed for companies at scale (10K+ subscribers). Stripe's built-in Smart Retries recover 42-57% of failed payments, which is sufficient for early-to-mid stage SaaS. Revisit only if involuntary churn exceeds 2% monthly and you have 500+ paying tenants.

### Webhook Resilience

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Database event log table | PostgreSQL (Supabase) | Webhook idempotency & audit trail | Create a `webhook_events` table with `stripe_event_id` as unique key. Use `INSERT ... ON CONFLICT DO NOTHING` for deduplication. This is the standard pattern -- no external library needed. Stripe retries events for up to 3 days with exponential backoff (immediately, 5min, 30min, 2h, 5h, 10h, then every 12h). | HIGH |
| Structured logging (Sentry) | `^10.38.0` (existing) | Webhook error tracking, monitoring | Replace the 19 `console.log` calls in webhook handler with Sentry breadcrumbs/errors. Already installed. Sentry captures errors in context, making webhook debugging vastly easier than parsing logs. | HIGH |

**Key decision: Do NOT add Hookdeck or Svix.** These webhook infrastructure services ($39-490/mo) solve problems at scales this project hasn't reached. The database-level idempotency pattern + Stripe's built-in retry mechanism + Sentry error tracking is sufficient. Stripe's Dashboard already provides event logs with 15-day replay capability.

### SaaS Metrics & Analytics

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `recharts` | `^3.6.0` (existing) | MRR/churn/revenue charts | Already installed. Use AreaChart for MRR trends, BarChart for plan distribution, LineChart for churn rate over time. No need for a separate charting library. | HIGH |
| Custom SQL queries (Supabase) | N/A | MRR, churn, LTV calculation | Calculate metrics directly from `subscriptions` and `subscription_plans` tables using PostgreSQL CTEs. MRR = SUM of active subscriptions * monthly price. Churn = canceled last month / active at start of month. No external analytics service needed at this stage. | HIGH |
| Historical metrics snapshots | PostgreSQL (Supabase) | Track metrics over time | Create a `saas_metrics_snapshots` table. Run a daily/weekly cron (Supabase pg_cron or Vercel Cron) to snapshot MRR, active count, churn rate, etc. Enables "MRR over last 12 months" charts that can't be derived from current-state-only tables. | MEDIUM |

**Key decision: Do NOT add ChartMogul, Baremetrics, or ProfitWell.** These are excellent tools but cost $0-250/mo and require data export/sync pipelines. The metrics needed (MRR, churn, plan distribution, LTV) are calculable from existing database tables. Build the metrics in-house first. Consider ChartMogul (free under $120K ARR) only when you need cohort analysis or investor-grade reporting.

### Input Validation & Type Safety

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `zod` | `^3.25.76` (existing) | API input validation for all Stripe routes | Already installed. The existing checkout and webhook routes lack Zod validation on inputs. Add schemas for checkout body (`{ plan_id: z.string().uuid(), billing_interval: z.enum(["month", "year"]) }`), superadmin action bodies, and webhook event type guards. | HIGH |
| Stripe TypeScript types | Built into `stripe` v20 | Type safety for Stripe objects | Already available via `import type { Stripe } from "stripe"`. The existing webhook handler uses type assertions (`as Stripe.Checkout.Session`) which is correct. Stripe v20+ has full TypeScript support with generics. | HIGH |

### Admin Dashboard Components

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@tanstack/react-table` | `^8.21.3` (existing) | Data tables for tenants, subscriptions, invoices | Already installed. Use for sortable, filterable, paginated tables in superadmin. Column definitions for subscription lists, tenant lists, invoice lists, webhook event logs. | HIGH |
| `@tanstack/react-query` | `^5.90.10` (existing) | Server state for superadmin data fetching | Already installed. Use `useQuery` for metrics/lists, `useMutation` for admin actions (cancel subscription, change plan). Enables optimistic updates and automatic cache invalidation. | HIGH |
| `sonner` | `^2.0.7` (existing) | Toast notifications for admin actions | Already installed. Show success/error toasts for subscription cancellations, plan changes, tenant operations. | HIGH |
| `date-fns` | `^4.1.0` (existing) | Date formatting for billing periods, invoices | Already installed. Format billing period dates, last payment dates, trial end dates in pt-BR locale. | HIGH |

### Email Notifications (Billing-Specific)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `nodemailer` | `^8.0.3` (existing) | Custom billing alerts to tenant admins | Already installed with SMTP configuration. Use for: subscription activation confirmation, grace period warnings (day 3 and day 6 of 7-day grace), plan change confirmation. Stripe handles dunning emails; this is for app-specific notifications. | HIGH |

---

## What NOT To Use (And Why)

| Category | Rejected | Why Not |
|----------|----------|---------|
| Dunning/recovery | ChurnKey, ChurnDog, ChurnBuster | $39-490/mo. Overkill for early-stage. Stripe Smart Retries (free, built-in) recover 42-57% of failed payments. Add third-party only if involuntary churn >2% at 500+ tenants. |
| SaaS analytics | ChartMogul, Baremetrics, ProfitWell | Metrics (MRR, churn, LTV) are calculable from existing DB tables. Free tiers exist but add integration complexity. Revisit at $120K+ ARR or when cohort analysis is needed. |
| Webhook infrastructure | Hookdeck, Svix | $39-490/mo. DB-level idempotency + Stripe retries + Sentry monitoring covers the need. These services solve reliability problems at 100K+ webhook events/day scale. |
| Payment form | Stripe Elements, custom forms | Project constraint: use Stripe Checkout (hosted). No PCI compliance burden. Already implemented. |
| Billing framework | Lago, Kill Bill, Recurly | These are full billing platforms. Stripe Billing already handles the core billing logic. Adding another layer creates unnecessary abstraction. |
| State management | Redux, Zustand | TanStack Query already handles server state. No client-only billing state complex enough to warrant a store. |
| Admin UI framework | Refine, AdminJS, React Admin | Superadmin already has a custom layout with shadcn/ui components. Adding an admin framework would mean rewriting existing UI and fighting two component systems. |

---

## Stripe Dashboard Configuration (No Code Required)

These are critical configurations that happen in the Stripe Dashboard, not in code. They are part of the stack because they directly affect billing behavior.

### Revenue Recovery Settings
```
Dashboard > Billing > Revenue recovery > Retries
- Enable Smart Retries: YES
- Number of retries: 8
- Retry window: 2 weeks
- After all retries fail: Mark subscription as "past_due" (NOT cancel)
```

### Customer Portal Settings
```
Dashboard > Settings > Billing > Customer portal
- Allow payment method updates: YES
- Allow subscription cancellation: YES
- Collect cancellation reason: YES
- Allow plan switching: YES (configure product catalog)
- Show invoice history: YES
```

### Email Settings
```
Dashboard > Settings > Emails
- Successful payment receipt: YES
- Failed payment notification: YES
- Upcoming renewal reminder: YES (send 3 days before)
- Invoice finalized: YES
```

### Webhook Configuration
```
Dashboard > Developers > Webhooks
Events to subscribe:
- checkout.session.completed
- invoice.paid
- invoice.payment_failed
- invoice.upcoming (ADD THIS -- 3-day warning)
- customer.subscription.created (ADD THIS)
- customer.subscription.updated
- customer.subscription.deleted
- customer.subscription.trial_will_end (ADD THIS -- trial ending soon)
- payment_intent.payment_failed (ADD THIS -- more granular failure info)
```

---

## Database Schema Additions

The existing schema has `subscriptions`, `subscription_plans`, `superadmins`, and `empresas.stripe_customer_id`. These additions are needed:

### webhook_events (NEW -- idempotency & audit)
```sql
CREATE TABLE webhook_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_event_id text UNIQUE NOT NULL,
    event_type text NOT NULL,
    status text DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'failed')),
    payload jsonb,
    error_message text,
    processing_time_ms integer,
    created_at timestamptz DEFAULT now() NOT NULL,
    processed_at timestamptz
);

CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at);
```

### saas_metrics_snapshots (NEW -- historical tracking)
```sql
CREATE TABLE saas_metrics_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    snapshot_date date UNIQUE NOT NULL,
    mrr_cents integer NOT NULL DEFAULT 0,
    active_subscriptions integer NOT NULL DEFAULT 0,
    trialing_subscriptions integer NOT NULL DEFAULT 0,
    past_due_subscriptions integer NOT NULL DEFAULT 0,
    canceled_subscriptions_30d integer NOT NULL DEFAULT 0,
    new_subscriptions_30d integer NOT NULL DEFAULT 0,
    churn_rate_percent numeric(5,2) DEFAULT 0,
    total_tenants integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL
);
```

### subscriptions table changes (ALTER)
```sql
-- Add trial tracking
ALTER TABLE subscriptions ADD COLUMN trial_start timestamptz;
ALTER TABLE subscriptions ADD COLUMN trial_end timestamptz;

-- Add payment failure tracking for dunning UI
ALTER TABLE subscriptions ADD COLUMN failed_payment_count integer DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN last_payment_error text;
```

---

## Architecture Fit

### How This Integrates With Existing Code

```
app/
  api/
    stripe/
      checkout/route.ts        # EXISTS -- add Zod validation
      portal/route.ts          # EXISTS -- add Zod validation
    webhooks/
      stripe/route.ts          # EXISTS -- add idempotency, Sentry, rate limiting
    superadmin/
      metricas/route.ts        # EXISTS -- expand with historical metrics, churn, LTV
      assinaturas/route.ts     # EXISTS -- add Zod validation
      assinaturas/[id]/route.ts  # EXISTS -- verify implementation
      empresas/route.ts        # NEW -- tenant CRUD management
      empresas/[id]/route.ts   # NEW -- tenant detail, activate/deactivate
      inadimplencia/route.ts   # NEW -- past_due tenants list, dunning status
      webhook-events/route.ts  # NEW -- webhook event log viewer
  superadmin/
    (dashboard)/
      empresas/                # NEW -- tenant management UI
      inadimplencia/           # NEW -- delinquency management UI
      webhook-log/             # NEW -- webhook event viewer UI
  shared/
    core/
      services/
        stripe.service.ts      # EXISTS -- keep singleton pattern
        billing-metrics.service.ts  # NEW -- MRR/churn/LTV calculations
```

### Data Flow for Webhook Processing

```
Stripe -> POST /api/webhooks/stripe
  1. Verify signature (stripe.webhooks.constructEvent)
  2. Check idempotency (INSERT webhook_events ON CONFLICT DO NOTHING)
  3. If duplicate -> return 200 immediately
  4. Process event (switch on event.type)
  5. Update subscriptions/empresas tables
  6. Update webhook_events status to 'processed'
  7. If error -> Update webhook_events status to 'failed', log to Sentry
  8. Return 200 (always, to prevent Stripe retries for non-transient errors)
```

---

## Installation

No new npm packages needed. All required libraries are already installed:

```bash
# Already in package.json:
# stripe ^20.4.1
# zod ^3.25.76
# @tanstack/react-query ^5.90.10
# @tanstack/react-table ^8.21.3
# recharts ^3.6.0
# sonner ^2.0.7
# date-fns ^4.1.0
# nodemailer ^8.0.3
# @sentry/nextjs ^10.38.0

# Zero new dependencies required.
```

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| Stripe SDK version | HIGH | Verified v20.4.1 is latest on npm as of March 2026. API version 2026-02-25.clover is current. |
| Smart Retries as dunning solution | HIGH | Official Stripe documentation confirms ML-based retry with 42-57% recovery rate. Free, built-in, no code needed. |
| Webhook idempotency pattern | HIGH | Standard PostgreSQL pattern confirmed across Stripe docs, Hookdeck guides, and multiple engineering blogs. `ON CONFLICT DO NOTHING` is the canonical approach. |
| No external SaaS analytics needed | MEDIUM | Correct for early stage. At $120K+ ARR or 500+ tenants, ChartMogul (free tier) or Baremetrics becomes worth the integration effort for cohort analysis. |
| No third-party dunning tools needed | MEDIUM | Correct for <500 tenants. ChurnKey claims 70% recovery vs Stripe's 42-57%, but the cost ($39-490/mo) and integration complexity aren't justified until involuntary churn is a measured, significant problem. |
| Database schema additions | HIGH | Standard SaaS patterns. webhook_events for idempotency is universally recommended. metrics_snapshots for historical tracking is the simplest approach without external analytics. |
| Zero new npm dependencies | HIGH | Verified every needed capability exists in already-installed packages. |

---

## Sources

### Stripe Official Documentation
- [How subscriptions work](https://docs.stripe.com/billing/subscriptions/overview)
- [Revenue recovery (Smart Retries)](https://docs.stripe.com/billing/revenue-recovery)
- [Automate payment retries](https://docs.stripe.com/billing/revenue-recovery/smart-retries)
- [Receive Stripe events (webhooks)](https://docs.stripe.com/webhooks)
- [Idempotent requests](https://docs.stripe.com/api/idempotent_requests)
- [Customer portal configuration](https://docs.stripe.com/customer-management/configure-portal)
- [Subscription schedules](https://docs.stripe.com/billing/subscriptions/subscription-schedules)
- [Automatic collection](https://docs.stripe.com/invoicing/automatic-collection)

### Stripe SDK & Versioning
- [stripe npm package](https://www.npmjs.com/package/stripe) -- confirmed v20.4.1 latest
- [Stripe Node.js releases](https://github.com/stripe/stripe-node/releases)
- [Stripe versioning and support policy](https://docs.stripe.com/sdks/versioning)
- [Stripe changelog](https://docs.stripe.com/changelog)

### Webhook Best Practices
- [Webhook handling best practices (Stigg)](https://www.stigg.io/blog-posts/best-practices-i-wish-we-knew-when-integrating-stripe-webhooks)
- [Complete Stripe webhook guide for Next.js (HookRelay)](https://www.hookrelay.io/guides/nextjs-webhook-stripe)
- [Implementing idempotency keys in Postgres (brandur.org)](https://brandur.org/idempotency-keys)
- [Hookdeck webhook idempotency guide](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency)

### Dunning & Recovery
- [Stripe Smart Retries FAQs (ChurnKey)](https://churnkey.co/blog/stripe-smart-retries/)
- [Stripe dunning best practices and limitations (ChurnKey)](https://churnkey.co/blog/stripe-dunning/)
- [ChurnDog vs Stripe dunning comparison](https://churndog.com/saas-news/churndog-vs-stripes-native-dunning-elevating-your-saas-revenue-recovery)
- [Smart Retries vs Rules-Based Dunning 2025 (Slicker)](https://www.slickerhq.com/resources/blog/smart-retries-vs-rules-based-dunning-2025-stripe-recurly-slicker-ai-benchmarks)

### SaaS Metrics
- [SQL query to calculate SaaS metrics (Redash)](https://blog.redash.io/sql-query-to-calculate-saas-metrics/)
- [Calculate MRR with Stripe using SQL (Weld)](https://weld.app/blog/how-do-you-calculate-mrr-with-stripe-using-sql)
- [Best MRR tracking software 2026 (QuantLedger)](https://www.quantledger.app/blog/best-mrr-tracking-software)
- [SaaS metrics KPIs and benchmarks 2026 (Visdum)](https://www.visdum.com/blog/saas-metrics)

### Architecture Patterns
- [Stripe subscription lifecycle in Next.js 2026 (Dev.to)](https://dev.to/thekarlesi/stripe-subscription-lifecycle-in-nextjs-the-complete-developer-guide-2026-4l9d)
- [SaaS architecture patterns with Next.js (Vladimir Siedykh)](https://vladimirsiedykh.com/blog/saas-architecture-patterns-nextjs)
- [Vercel Next.js subscription payments template](https://github.com/vercel/nextjs-subscription-payments)
