# Research Summary: SaaS Billing & Admin Stack

**Domain:** SaaS billing, subscription management, superadmin panel for multi-tenant educational platform
**Researched:** 2026-03-23
**Overall confidence:** HIGH

## Executive Summary

The existing Aluminify codebase already contains all the npm dependencies needed for a complete SaaS billing system. Stripe SDK v20.4.1 is the latest version (confirmed March 2026), and the partially-built integration covers ~70% of the checkout/portal/webhook flow. The primary gap is not in technology choices but in hardening what exists: webhook idempotency, structured error handling, input validation, and comprehensive metrics.

For dunning and payment recovery, Stripe's built-in Smart Retries (ML-powered, free) is the right choice at this stage. It recovers 42-57% of failed recurring payments without code or external services. Third-party dunning tools (ChurnKey, ChurnDog) claim higher recovery rates (up to 70%) but cost $39-490/mo and are designed for companies with 500+ subscribers dealing with measured involuntary churn problems.

SaaS metrics (MRR, churn, LTV) should be calculated directly from existing database tables using PostgreSQL CTEs, not through external analytics services. The project already has recharts for visualization and TanStack Table for data tables. A daily metrics snapshot table enables historical trend analysis without the complexity of data export pipelines.

The most impactful technical improvement is adding a `webhook_events` table for idempotency and audit. This is a universal best practice that the current implementation lacks -- the webhook handler has no deduplication, meaning Stripe's retry mechanism (up to 3 days) could cause duplicate processing.

## Key Findings

**Stack:** Zero new npm dependencies needed. All required libraries are already installed. Focus is on Stripe Dashboard configuration (Smart Retries, Customer Portal, billing emails) and database schema additions (webhook_events, saas_metrics_snapshots).

**Architecture:** Extend existing patterns -- API routes under `/api/superadmin/`, components under `app/superadmin/(dashboard)/`, services under `app/shared/core/services/`. Add `billing-metrics.service.ts` for MRR/churn calculation.

**Critical pitfall:** The webhook handler lacks idempotency. Stripe retries failed deliveries for up to 3 days with exponential backoff. Without event deduplication, a single checkout completion could create duplicate subscription records if the handler times out on first attempt.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Webhook Hardening & Foundation** - Fix what exists before building more
   - Addresses: Webhook idempotency, Sentry integration, Zod validation, rate limiting
   - Avoids: Building on unstable foundation, duplicate processing bugs

2. **Stripe Integration Completion & Testing** - Make billing actually work
   - Addresses: End-to-end checkout testing, Stripe Dashboard configuration, dunning setup
   - Avoids: Shipping untested payment code, missing revenue recovery

3. **Superadmin Tenant Management** - CRUD for empresas, activate/deactivate, usage views
   - Addresses: Tenant lifecycle management, superadmin operational needs
   - Avoids: No dependency on billing metrics, simpler to implement first

4. **SaaS Metrics & Delinquency Management** - Advanced analytics, inadimplencia tracking
   - Addresses: MRR/churn/LTV calculation, metrics snapshots, dunning visibility
   - Avoids: Premature optimization -- needs real subscription data to be useful

5. **Tenant Billing Experience** - Invoice history, payment alerts, plan page polish
   - Addresses: Tenant-facing billing UI, grace period warnings, payment status
   - Avoids: Building tenant UI before backend is solid

**Phase ordering rationale:**
- Phase 1 first because everything else depends on reliable webhook processing
- Phase 2 before 3-5 because billing must work before managing it
- Phase 3 before 4 because tenant CRUD is simpler and unblocks operational management
- Phase 4 before 5 because metrics inform tenant-facing decisions
- Phase 5 last because tenant billing experience depends on all backend work being complete

**Research flags for phases:**
- Phase 1: Standard patterns, unlikely to need research
- Phase 2: May need deeper research on Stripe test mode behavior and edge cases
- Phase 3: Standard CRUD, unlikely to need research
- Phase 4: MRR/churn SQL calculation patterns are well-documented, low risk
- Phase 5: Standard UI work, unlikely to need research

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All dependencies verified as current. Zero new packages needed. |
| Dunning/Recovery | HIGH | Stripe Smart Retries is well-documented, free, and sufficient for this stage. |
| Webhook Patterns | HIGH | Idempotency via database unique constraint is canonical pattern. |
| Metrics Approach | MEDIUM | In-house calculation is correct for now but will need revisiting at scale. |
| Dashboard Configuration | HIGH | Stripe Dashboard settings are well-documented with specific recommended values. |

## Gaps to Address

- Stripe test mode end-to-end validation needs hands-on testing (cannot be fully researched)
- Trial period management specifics depend on business decisions (trial length, conversion flow)
- Grace period behavior when subscription transitions past_due -> canceled needs testing
- `invoice.upcoming` webhook event handling is not yet implemented (needed for proactive alerts)
- pg_cron or Vercel Cron setup for daily metrics snapshots needs infrastructure-specific research
