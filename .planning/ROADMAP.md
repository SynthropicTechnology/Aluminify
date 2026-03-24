# Roadmap: Aluminify SaaS Billing & Admin

## Overview

Transform Aluminify from a partially-integrated billing system into a complete SaaS management platform. The journey starts by hardening the untested Stripe foundation (webhook idempotency, validation, single-sync pattern), then validates it end-to-end, builds superadmin operational tools for tenant and financial management, delivers a polished tenant billing experience, and finally enforces plan limits across the platform. Every phase builds on the previous -- billing must be reliable before it can be managed, managed before it can be displayed, and displayed before it can be enforced.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Webhook Hardening & Foundation** - Make the existing Stripe integration reliable with idempotency, validation, rate limiting, and structured logging
- [ ] **Phase 2: Stripe Integration Testing & Observability** - Validate the full billing lifecycle end-to-end and enable webhook monitoring/replay
- [ ] **Phase 3: Superadmin Tenant Management** - CRUD and operational management of tenants with usage visibility
- [ ] **Phase 4: SaaS Metrics & Delinquency Management** - Financial analytics, inadimplencia tracking, and billing administration tools
- [ ] **Phase 5: Tenant Billing Experience** - Invoice history, payment alerts, plan comparison, and cancellation flow for tenant admins
- [ ] **Phase 6: Plan Enforcement** - Enforce subscription limits and restrict access for canceled/expired tenants

## Phase Details

### Phase 1: Webhook Hardening & Foundation
**Goal**: Stripe webhook processing is reliable, idempotent, and observable -- eliminating the split-brain risk between Stripe and the local database
**Depends on**: Nothing (first phase)
**Requirements**: STRP-01, STRP-02, STRP-03, STRP-04, STRP-05, RESIL-01
**Success Criteria** (what must be TRUE):
  1. Duplicate Stripe webhook deliveries are silently deduplicated -- processing the same event twice produces no side effects
  2. Subscription state in the local database always reflects the current Stripe state after any webhook event (single-sync pattern)
  3. All billing API routes reject malformed input with clear validation errors (Zod schemas)
  4. Billing routes are rate-limited -- excessive requests return 429 responses
  5. Webhook processing produces structured log entries (not console.log) with event type, status, and duration
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md -- Foundation: structured logger utility, WebhookEvent type, webhook_events migration
- [ ] 01-02-PLAN.md -- Webhook handler refactor: idempotency, single-sync pattern, structured logging
- [ ] 01-03-PLAN.md -- Route hardening: Zod validation, rate limiting, module-scope bug fixes

### Phase 2: Stripe Integration Testing & Observability
**Goal**: The complete billing lifecycle is verified working end-to-end and webhook events are visible and replayable
**Depends on**: Phase 1
**Requirements**: STRP-06, STRP-07, RESIL-02, RESIL-03
**Success Criteria** (what must be TRUE):
  1. A tenant can complete the full lifecycle: checkout -> subscription active -> invoice paid -> payment failure -> retry -> cancellation, with correct local state at each step
  2. Stripe Dashboard has Smart Retries enabled, Customer Portal configured, and billing emails active
  3. Failed webhook events can be re-processed (replayed) from the superadmin panel or via script
  4. Superadmin can view a log of recent webhook events with status (received/processed/failed) and summary payload
**Plans**: TBD

### Phase 3: Superadmin Tenant Management
**Goal**: Superadmin can fully manage the tenant lifecycle -- create, view, edit, activate/deactivate, and monitor usage
**Depends on**: Phase 2
**Requirements**: TENT-01, TENT-02, TENT-03, TENT-04, TENT-05, TENT-06
**Success Criteria** (what must be TRUE):
  1. Superadmin can list all tenants with search, filtering by status/plan/delinquency, and pagination
  2. Superadmin can view a tenant detail page showing company data, current subscription, and usage vs. plan limits
  3. Superadmin can create a new tenant (empresa + initial admin user) and edit existing tenant data
  4. Superadmin can activate or deactivate a tenant, and the tenant's access reflects the change immediately
**Plans**: TBD
**UI hint**: yes

### Phase 4: SaaS Metrics & Delinquency Management
**Goal**: Superadmin has financial visibility into the SaaS business -- accurate metrics, delinquency tracking, and tools to act on billing issues
**Depends on**: Phase 3
**Requirements**: FINC-01, FINC-02, FINC-03, FINC-04, FINC-05, FINC-06, FINC-07
**Success Criteria** (what must be TRUE):
  1. Superadmin can view accurate MRR (accounting for monthly/annual intervals), churn rate, and delinquency rate on the dashboard
  2. Superadmin can see a list of delinquent tenants (past_due) with days overdue and pending amounts
  3. Superadmin can force-cancel a subscription, extend it manually (credits/coupons), and configure grace periods
  4. Every billing action by a superadmin is logged in an audit trail (who did what, when, to which tenant)
  5. The subscription detail API route (`GET /api/superadmin/assinaturas/[id]`) exists and the UI loads correctly
**Plans**: TBD
**UI hint**: yes

### Phase 5: Tenant Billing Experience
**Goal**: Tenant admins can manage their billing entirely within the app -- view invoices, understand their plan, handle upgrades/downgrades, and cancel with a guided flow
**Depends on**: Phase 4
**Requirements**: TBIL-01, TBIL-02, TBIL-03, TBIL-04, TBIL-05, TBIL-06
**Success Criteria** (what must be TRUE):
  1. Tenant admin can view their full invoice and payment history within the app (without navigating to Stripe Portal)
  2. Tenant admin sees a visible alert (banner on dashboard + plan page) when payment is overdue
  3. Tenant admin can compare plans side-by-side (features, limits, prices) and toggle between monthly/annual billing
  4. Tenant admin can cancel their subscription through an in-app flow that collects a reason and offers retention alternatives (downgrade/discount)
  5. Tenant admin sees a warning when attempting to downgrade to a plan whose limits are exceeded by current usage
**Plans**: TBD
**UI hint**: yes

### Phase 6: Plan Enforcement
**Goal**: Subscription plan limits are actively enforced across the platform -- tenants cannot exceed their plan's boundaries and lose access when subscriptions expire
**Depends on**: Phase 5
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04, PLAN-05
**Success Criteria** (what must be TRUE):
  1. Creating a student is blocked with a clear message when the tenant has reached `max_active_students`
  2. Creating a course is blocked with a clear message when the tenant has reached `max_courses`
  3. Uploading a file is blocked with a clear message when the tenant has reached `max_storage_mb`
  4. Access to premium modules is denied when the tenant's plan does not include them in `allowed_modules`
  5. A tenant with a canceled subscription or expired grace period is downgraded to free tier or blocked from access entirely
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Webhook Hardening & Foundation | 0/3 | Planning complete | - |
| 2. Stripe Integration Testing & Observability | 0/TBD | Not started | - |
| 3. Superadmin Tenant Management | 0/TBD | Not started | - |
| 4. SaaS Metrics & Delinquency Management | 0/TBD | Not started | - |
| 5. Tenant Billing Experience | 0/TBD | Not started | - |
| 6. Plan Enforcement | 0/TBD | Not started | - |
