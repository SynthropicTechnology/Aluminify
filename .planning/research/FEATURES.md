# Feature Landscape

**Domain:** SaaS Billing & Admin Platform for Multi-Tenant Educational Portal
**Researched:** 2026-03-23
**Overall Confidence:** HIGH (domain is well-understood; Stripe integration patterns are mature and well-documented)

## What Already Exists

Before mapping features, it is critical to acknowledge the ~70% existing foundation. The codebase already has:

**Superadmin side (existing):**
- Superadmin login with separate auth (`app/superadmin/(auth)/`)
- Metrics dashboard: MRR, active subscriptions, cancellations (30d), plan distribution, Stripe balance, billing interval breakdown
- Plan CRUD with full Stripe Product/Price sync (create, update, toggle active, archive prices)
- Subscription list with filters (status, plan, search by tenant name)
- Subscription detail page with Stripe data, invoice history, cancel action
- Invoice list via Stripe API with pagination
- Superadmin user management

**Tenant side (existing):**
- Plan management page showing current plan, status, billing interval, next payment
- Usage bars (students, courses) with warning/critical thresholds
- Upgrade flow via Stripe Checkout Sessions
- Stripe Billing Portal integration for self-service management
- Checkout success handling

**Webhook handler (existing):**
- `checkout.session.completed` -- creates local subscription record, links to empresa
- `invoice.paid` -- renews subscription, updates period
- `invoice.payment_failed` -- sets subscription to `past_due`
- `customer.subscription.updated` -- handles plan changes (upgrade/downgrade)
- `customer.subscription.deleted` -- marks subscription as canceled

**Data model (existing):**
- `subscription_plans` table with limits (students, courses, storage, modules), Stripe IDs, pricing
- `subscriptions` table with status, billing interval, period tracking, payment history
- `empresas` table with `stripe_customer_id`, `subscription_id`, legacy `plano` enum
- Free plan support (no Stripe, unlimited limits)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or unusable.

### Superadmin Side

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Tenant CRUD (empresas management)** | Superadmin cannot create, view, edit, or deactivate tenants directly. Currently no empresas management page exists in superadmin. | Medium | Need list page with search/filter, detail page showing tenant info + subscription + usage, create/edit forms, activate/deactivate toggle. The `empresas` table already has `ativo` field. |
| **Tenant detail with usage overview** | Superadmin needs to see a tenant's student count, course count, storage used, current plan, and subscription status in one place. | Medium | Requires aggregation queries across `usuarios_empresas`, `cursos`, `empresas.storage_used_mb`. Already have plan/subscription data in joins. |
| **Dunning/delinquency management view** | When tenants fail payment, superadmin needs visibility: who is past_due, for how long, what actions are available. | Low | Most data already flows via webhooks. Need a filtered view of `past_due` and `unpaid` subscriptions with days-overdue calculation and action buttons (contact, extend grace, force cancel). |
| **Webhook reliability (retry, logging, idempotency)** | Stripe webhooks are the single source of truth for subscription state. If a webhook fails silently, billing data drifts from reality. | Medium | Current handler has 19 `console.log` calls but no persistent logging, no retry tracking, no dead-letter handling. Need: webhook event log table, idempotency keys (partially done for checkout), failed event alerts. |
| **API input validation (Zod)** | 0 out of 155 API routes use runtime validation. All Stripe/superadmin routes accept unvalidated JSON. | Low | Straightforward Zod schema addition per route. Critical for billing routes that handle money. |
| **Rate limiting on billing routes** | Rate limit service exists but is used zero times. Billing routes (checkout, portal, webhook) are unprotected against abuse. | Low | Service already implemented at `app/shared/core/services/rate-limit/rate-limit.service.ts`. Just needs to be wired into API routes. |
| **Tenant payment history (tenant side)** | Tenant admin needs to see past invoices and payments without leaving the app to go to Stripe. | Low-Medium | Stripe Portal already provides this, but an in-app view builds trust and reduces friction. Could fetch from Stripe API (like superadmin detail page already does) or mirror invoice data locally via webhooks. |
| **Payment failure alerts (tenant side)** | When a payment fails, the tenant admin must see a clear banner/notification with instructions to update payment method. | Low | On `past_due` status, show prominent alert on dashboard and plan page. Link to Stripe Portal for payment method update. Status already tracked in `subscriptions` table. |
| **Structured logging (replace console.log)** | 1,421 console statements across 306 files, 19 in webhook handler alone. Production logs are noise. | Medium | Replace with structured logger. Critical for billing debugging. The middleware already has a log-level pattern to follow. |
| **End-to-end Stripe integration testing** | Current integration has never been tested. This is not a feature per se but a prerequisite for all billing features to be reliable. | High | Requires Stripe test mode setup, webhook testing with Stripe CLI, checkout flow testing. Must happen before any new billing features ship. |

### Tenant Side

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Plan comparison on upgrade page** | Tenant admin sees available plans but lacks side-by-side comparison (features, limits, pricing). | Low | Data exists in `subscription_plans.features`, `max_active_students`, `max_courses`, `max_storage_mb`. Current UI shows 3 features max. Need full comparison grid. |
| **Annual/monthly billing toggle** | Upgrade flow hardcodes `billing_interval: "month"`. Tenant cannot choose annual billing (even though plans have `price_yearly_cents`). | Low | Change is in `plan-management.tsx` `handleUpgrade()` -- add toggle, pass interval to checkout API. Backend already supports it. |
| **Subscription cancellation flow (in-app)** | Tenant can manage via Stripe Portal but there is no in-app cancellation with confirmation dialog, reason collection, or retention offers. | Medium | Better UX than redirecting to Stripe. Collect cancellation reason, optionally offer downgrade or discount. Still execute via Stripe API. |
| **Plan limit enforcement** | Plans define `max_active_students`, `max_courses`, `max_storage_mb` but there is no evidence these limits are enforced when creating students/courses. Usage bars show warnings but don't block actions. | Medium | Need middleware or service-level checks before student enrollment, course creation, file upload. Return clear error messages. Critical for monetization. |

---

## Differentiators

Features that set the platform apart. Not expected but valued by users and operators.

### Superadmin Side

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Advanced SaaS metrics (churn rate, LTV, cohort analysis)** | Current metrics are basic (MRR, active count, 30-day cancellations). Churn rate over time, customer LTV, and cohort retention tell the real story of business health. | High | Requires historical data tracking (MRR snapshots over time), cohort grouping by signup month, LTV = ARPU / churn rate. Best done as periodic aggregation job, not real-time queries. |
| **Revenue trend charts (MRR over time)** | Seeing MRR as a single number is less useful than seeing its trajectory. Growth, stagnation, or decline is immediately visible in a chart. | Medium | Need to store monthly MRR snapshots (cron job or webhook-driven). Render with a simple chart library. |
| **Proactive dunning automation** | Beyond marking subscriptions `past_due`, automatically: send email reminders, retry payment (Stripe Smart Retries handle this), escalate to superadmin after N days, restrict tenant access after grace period. | High | Stripe handles payment retries automatically via Smart Retries. Custom part: email notifications at configurable intervals, grace period configuration, access restriction logic. |
| **Tenant health score** | Composite metric: subscription status + payment history + usage level + days since last login. Helps superadmin prioritize outreach to at-risk tenants. | Medium | Mostly aggregation of existing data. Display as color-coded indicator in tenant list. |
| **Audit log for billing actions** | Track who did what: plan changes, cancellations, manual overrides. Essential for disputes and accountability. | Medium | New table `billing_audit_log` with actor, action, target, timestamp, metadata. Log from all superadmin actions and webhook events. |
| **Configurable grace period** | Allow superadmin to set how many days after payment failure before access is restricted (e.g., 7 days, 14 days, 30 days). Different tenants might get different grace periods. | Low-Medium | Add `grace_period_days` to plan or global config. Check against `subscriptions.current_period_end` + grace period in middleware. |
| **Manual subscription override** | Superadmin can manually extend a tenant's subscription, apply credits, or override status (e.g., grant free months for partners). | Medium | Needs careful implementation to stay in sync with Stripe. Best approach: apply credits/coupons via Stripe API, log override in audit log. |

### Tenant Side

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Trial period support** | Let new tenants try the platform for N days before requiring payment. Reduces friction for acquisition. | Medium | Stripe supports trial periods natively on subscriptions. Need: trial_days config on plans, trial status handling in UI, countdown display, trial-to-paid conversion flow. |
| **Usage analytics for tenant admin** | Show tenant admin their own usage trends: student growth, storage consumption, API calls. Helps them understand if they need to upgrade. | Medium | Aggregate data the platform already collects. Display in plan management page. Drives organic upgrades. |
| **Downgrade protection warnings** | When a tenant tries to downgrade to a plan with lower limits than their current usage, show what they would lose (e.g., "You have 150 students but Basic allows 50"). | Medium | Compare current usage against target plan limits. List conflicts. Require acknowledgment before proceeding. |
| **Billing email notifications** | Email tenant admin on: successful payment, upcoming renewal, payment failure, plan change confirmation. | Medium | Stripe can send some emails natively. For branded emails, use a transactional email service (Resend, SendGrid). Configure in Stripe or implement custom. |

---

## Anti-Features

Features to explicitly NOT build. These add complexity without proportional value for this project's stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Custom payment forms (Stripe Elements)** | PCI compliance burden, security risk, maintenance cost. Stripe Checkout handles everything. | Continue using Stripe Checkout Sessions and Stripe Portal. Already decided in project constraints. |
| **Usage-based / metered billing** | The business model is fixed plans with limits. Metered billing adds enormous complexity (usage tracking, aggregation, overage pricing). | Use plan limits (max_students, max_courses, max_storage) with hard/soft caps. Charge per extra student only if `extra_student_price_cents` is set, via manual upgrade. |
| **Multi-currency support** | Operation is BRL-only. Multi-currency adds Stripe configuration complexity, exchange rate handling, and reporting complications. | Hardcode BRL. Revisit only if international expansion becomes concrete. |
| **Multiple payment gateway integration** | Stripe already covers the use case. Adding PagSeguro/Mercado Pago doubles the integration surface and testing burden. | Stripe-only. Already decided in project constraints. |
| **Stripe Connect / marketplace sub-accounts** | This is a B2B SaaS, not a marketplace. Tenants don't need their own Stripe accounts. | Single Stripe account with customer objects per tenant. Already the current architecture. |
| **In-app support/ticketing** | Building a support system is a product in itself. Use dedicated tools. | Link to external support (email, Zendesk, Intercom). |
| **Complex proration UI** | Stripe handles proration automatically on plan changes. Building a custom proration calculator adds fragile logic. | Let Stripe calculate proration. Show the Stripe-calculated amount in confirmation dialogs. |
| **Invoice generation / NF-e** | Brazilian tax invoice (nota fiscal) generation is extremely complex. Dedicated services exist for this. | Integrate with a NF-e service (Nuvem Fiscal, eNotas) only if legally required. Separate concern from billing. |
| **Real-time usage tracking dashboard** | Real-time is unnecessary for plan limit enforcement. Near-real-time (refreshed on page load) is sufficient. | Query usage on demand. Cache with short TTL if needed. |

---

## Feature Dependencies

```
End-to-end Stripe testing
  |
  +--> Webhook reliability (logging, retry, idempotency)
  |      |
  |      +--> Dunning management view (depends on reliable status tracking)
  |      |
  |      +--> Payment failure alerts for tenant (depends on reliable status)
  |
  +--> API input validation (Zod on billing routes)
  |      |
  |      +--> Rate limiting on billing routes
  |
  +--> Plan limit enforcement
  |      |
  |      +--> Downgrade protection warnings (needs limit enforcement to matter)
  |      |
  |      +--> Usage analytics for tenant admin (needs usage tracking)
  |
  +--> Tenant CRUD in superadmin
  |      |
  |      +--> Tenant detail with usage overview
  |      |      |
  |      |      +--> Tenant health score
  |      |
  |      +--> Manual subscription override
  |
  +--> Structured logging
  |      |
  |      +--> Audit log for billing actions
  |
  +--> Trial period support (independent, Stripe-native)
  |
  +--> Annual/monthly billing toggle (independent, low effort)
  |
  +--> Advanced SaaS metrics
         |
         +--> Revenue trend charts (needs MRR snapshots)
```

Key insight: **End-to-end Stripe testing is the foundation.** Nothing else can be trusted until the existing integration is verified. Webhook reliability is the second critical dependency because all billing state flows through webhooks.

---

## MVP Recommendation

### Phase 1: Fix the Foundation (must do first)
1. **End-to-end Stripe integration testing** -- verify everything that exists actually works
2. **API input validation (Zod)** on all billing/superadmin routes
3. **Rate limiting** on billing routes (service exists, just wire it up)
4. **Structured logging** to replace console.log in billing code
5. **Webhook reliability** -- add event log table, improve idempotency
6. **Annual/monthly billing toggle** -- trivial fix, unlocks existing pricing

### Phase 2: Core Admin Features (table stakes)
1. **Tenant CRUD in superadmin** -- the biggest gap
2. **Tenant detail with usage overview**
3. **Dunning/delinquency management view**
4. **Payment failure alerts for tenant**
5. **Plan limit enforcement** -- critical for monetization
6. **Tenant payment history (in-app)**

### Phase 3: Growth Features (differentiators)
1. **Trial period support**
2. **Subscription cancellation flow with retention**
3. **Plan comparison grid**
4. **Downgrade protection warnings**
5. **Configurable grace period**
6. **Audit log for billing actions**

### Defer:
- **Advanced SaaS metrics / cohort analysis**: High complexity, needs historical data accumulation. Start collecting MRR snapshots early but build visualization later.
- **Tenant health score**: Nice-to-have. Implement after core admin features are solid.
- **Revenue trend charts**: Needs MRR snapshot infrastructure. Collect data from Phase 1, visualize in a later phase.
- **Manual subscription override**: Edge case. Use Stripe Dashboard directly until volume justifies in-app tooling.
- **Billing email notifications**: Stripe sends basic emails. Custom branded emails can come later.

---

## Sources

- Codebase analysis: direct inspection of `app/superadmin/`, `app/api/superadmin/`, `app/api/stripe/`, `app/api/webhooks/stripe/`, `app/[tenant]/(modules)/configuracoes/plano/`, `app/shared/types/entities/subscription.ts`, `app/shared/core/database.types.ts`
- [Zenskar: 7 Must-Have Features of SaaS Billing Platforms](https://www.zenskar.com/blog/saas-billing-platform-features)
- [Zuora: SaaS Invoicing Software Guide 2026](https://www.zuora.com/guides/saas-invoicing-software/)
- [Stripe: Automate Payment Retries (Smart Retries)](https://docs.stripe.com/billing/revenue-recovery/smart-retries)
- [Stripe: Dunning Management](https://stripe.com/resources/more/dunning-management-101-why-it-matters-and-key-tactics-for-businesses)
- [Stripe: Customer Portal Documentation](https://docs.stripe.com/customer-management)
- [Stripe: Self-Serve Subscription Portals](https://stripe.com/resources/more/self-serve-subscription-management-and-billing-portals)
- [Baremetrics: 5 Ways to Prevent Involuntary Churn](https://baremetrics.com/blog/involuntary-churn)
- [Signeasy: Grace Periods in SaaS Billing](https://signeasy.com/blog/engineering/grace-periods)
- [Amplitude: SaaS Cohort Analysis](https://amplitude.com/blog/saas-cohort-analysis)
- [Phoenix Strategy Group: Ultimate Guide to SaaS Dashboard Metrics](https://www.phoenixstrategy.group/blog/ultimate-guide-to-saas-dashboard-metrics)
- [Churnkey: Stripe Smart Retries Best Practices](https://churnkey.co/blog/stripe-smart-retries/)
- [Kinde: Dunning Strategies for SaaS](https://www.kinde.com/learn/billing/churn/dunning-strategies-for-saas-email-flows-and-retry-logic/)
