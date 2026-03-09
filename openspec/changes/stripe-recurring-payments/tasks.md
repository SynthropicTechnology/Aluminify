# Tasks: Integração Stripe para Pagamentos Recorrentes

## Phase 1 — Infrastructure

- [ ] 1.1 Install `stripe` Node.js SDK (`npm install stripe`)
- [ ] 1.2 Add environment variables to `.env.example`: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] 1.3 Update Zod validation in `app/shared/core/env.ts` with new Stripe env vars (server-only for secret key)
- [ ] 1.4 Create Stripe client singleton at `app/shared/core/services/stripe.service.ts` using `STRIPE_SECRET_KEY`

## Phase 2 — Database Schema

- [ ] 2.1 Create Supabase migration: `subscription_plans` table (name, slug, description, features, stripe IDs, prices, limits, display config, active flag)
- [ ] 2.2 Create Supabase migration: `subscriptions` table (empresa_id, plan_id, stripe IDs, status, billing_interval, period dates, payment tracking)
- [ ] 2.3 Create Supabase migration: alter `empresas` table — add `stripe_customer_id` (TEXT UNIQUE) and `subscription_id` (UUID FK to subscriptions)
- [ ] 2.4 Create RLS policies: `subscription_plans` read-public, `subscriptions` scoped by `empresa_id`
- [ ] 2.5 Regenerate database types: `app/shared/core/database.types.ts`
- [ ] 2.6 Create TypeScript types at `app/shared/types/entities/subscription.ts` (SubscriptionPlan, Subscription, CreatePlanInput, UpdatePlanInput, SubscriptionStatus, BillingInterval)
- [ ] 2.7 Seed initial plans matching current pricing tiers (Gratuito, Nuvem R$499/mês, Personalizado/Enterprise)

## Phase 3 — Stripe Webhook Handler

- [ ] 3.1 Create `app/api/webhooks/stripe/route.ts` with POST handler
- [ ] 3.2 Implement Stripe signature validation using `stripe.webhooks.constructEvent()` with raw body
- [ ] 3.3 Handle `checkout.session.completed`: create subscription row, update `empresas.plano` and `empresas.subscription_id`
- [ ] 3.4 Handle `invoice.paid`: update `subscriptions.last_payment_date`, confirm renewal, update `current_period_start/end`
- [ ] 3.5 Handle `invoice.payment_failed`: set `subscriptions.status = 'past_due'`
- [ ] 3.6 Handle `customer.subscription.updated`: update plan (upgrade/downgrade), billing interval, status, period
- [ ] 3.7 Handle `customer.subscription.deleted`: mark as canceled, set `canceled_at`
- [ ] 3.8 Implement idempotency: check `stripe_subscription_id` before processing to prevent duplicate operations
- [ ] 3.9 Add structured logging for webhook events (event type, subscription ID, empresa_id, result)

## Phase 4 — Checkout & Billing Portal API Routes

- [ ] 4.1 Create `app/api/stripe/checkout/route.ts` — POST: receive `plan_id`, `billing_interval`, `empresa_id`; create/retrieve Stripe Customer; create Checkout Session (mode: subscription); return session URL
- [ ] 4.2 Create `app/api/stripe/portal/route.ts` — POST: receive `empresa_id`; retrieve `stripe_customer_id` from empresas; create Billing Portal Session; return portal URL
- [ ] 4.3 Ensure Stripe Customer creation stores `stripe_customer_id` in `empresas` table
- [ ] 4.4 Add authentication guards (`requireUser`) to both API routes
- [ ] 4.5 Configure Stripe Customer Portal settings (allow upgrade/downgrade, cancel, update payment method) via Stripe Dashboard or API

## Phase 5 — Superadmin: Plan Management

- [ ] 5.1 Create `app/superadmin/planos/page.tsx` — server component listing all plans
- [ ] 5.2 Create plan list component with columns: name, price, billing intervals, limits, status, actions
- [ ] 5.3 Create plan form component (create/edit) with fields: name, slug, description, features, monthly price, yearly price, limits (max students, courses, storage), allowed modules, display order, featured flag, badge text
- [ ] 5.4 Implement create plan: call Stripe Products API + Prices API first, then save to `subscription_plans` with Stripe IDs
- [ ] 5.5 Implement edit plan: update Stripe Product metadata, create new Price if amount changed (archive old), update `subscription_plans`
- [ ] 5.6 Implement deactivate plan: set `active = false` in `subscription_plans`, archive Stripe Price
- [ ] 5.7 Create API routes at `app/api/superadmin/planos/` (GET list, POST create, PUT update, PATCH toggle active)

## Phase 6 — Superadmin: Subscription Overview

- [ ] 6.1 Create `app/superadmin/assinaturas/page.tsx` — server component listing all tenant subscriptions
- [ ] 6.2 Create subscription list component with columns: tenant name, plan, status, billing interval, next payment, amount, actions
- [ ] 6.3 Add filters: by status (active, past_due, canceled, unpaid), by plan, search by tenant name
- [ ] 6.4 Add tenant detail view: subscription history, payment history, current usage vs limits
- [ ] 6.5 Add superadmin actions: cancel subscription, change plan, extend trial
- [ ] 6.6 Create API routes at `app/api/superadmin/assinaturas/` (GET list, GET detail, POST actions)

## Phase 7 — Dynamic Pricing Page

- [ ] 7.1 Create `app/api/plans/route.ts` — public GET endpoint listing active plans from `subscription_plans` ordered by `display_order`
- [ ] 7.2 Refactor `app/(landing-page)/pricing/components/pricing-page.tsx` to fetch plans from API instead of hardcoded data
- [ ] 7.3 Maintain monthly/yearly toggle with real prices from database
- [ ] 7.4 Display plan features, limits, badge, and featured highlight from database
- [ ] 7.5 Add "Assinar" button that initiates Checkout Session flow (redirect to Stripe)
- [ ] 7.6 Handle free plan separately (no checkout, direct signup)
- [ ] 7.7 Add loading skeleton and error state for plan fetching

## Phase 8 — Tenant Plan Management Page

- [ ] 8.1 Create `app/[tenant]/(modules)/configuracoes/plano/page.tsx` — server component showing current plan
- [ ] 8.2 Create current plan card component: plan name, status badge, billing interval, next payment date, price
- [ ] 8.3 Create usage summary component: current students vs limit, courses vs limit, storage used vs limit
- [ ] 8.4 Add "Gerenciar Assinatura" button that opens Stripe Customer Portal
- [ ] 8.5 Add "Fazer Upgrade" button showing available plans with comparison
- [ ] 8.6 Handle checkout success callback: show confirmation after redirect from Stripe
- [ ] 8.7 Show alerts for approaching limits (80%, 90%, 100% thresholds)

## Phase 9 — Plan Limit Enforcement

- [ ] 9.1 Create utility `app/shared/core/services/plan-limits.service.ts` to check current usage against plan limits
- [ ] 9.2 Add limit check before creating new students (max_active_students)
- [ ] 9.3 Add limit check before creating new courses (max_courses)
- [ ] 9.4 Add module access check based on `allowed_modules` from plan
- [ ] 9.5 Return clear error messages with upgrade CTA when limits are reached
- [ ] 9.6 Add grace period logic for `past_due` subscriptions (configurable days before restricting access)

## Phase 10 — Testing & Validation

- [ ] 10.1 Write unit tests for Stripe webhook handler (mock Stripe events)
- [ ] 10.2 Write unit tests for plan limit enforcement service
- [ ] 10.3 Test checkout flow end-to-end with Stripe test mode
- [ ] 10.4 Test webhook idempotency (replay same event)
- [ ] 10.5 Test upgrade/downgrade via Customer Portal
- [ ] 10.6 Verify pricing page updates when plans are changed in superadmin
- [ ] 10.7 Verify tenant plan page reflects subscription status changes
- [ ] 10.8 Run `npm run check` — ensure lint, typecheck, and tests pass
