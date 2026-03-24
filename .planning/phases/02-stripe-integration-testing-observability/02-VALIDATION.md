---
phase: 02
slug: stripe-integration-testing-observability
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-03-24
---

# Phase 02 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest |
| **Config file** | jest.config.js |
| **Quick run command** | `npx jest tests/unit/stripe/webhook-events.service.test.ts tests/unit/stripe/webhook-observability-api.test.ts --no-coverage` |
| **Full suite command** | `npx jest tests/unit/stripe/*.test.ts --no-coverage` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest <task-related-files> --no-coverage`
- **After every plan wave:** Run `npx jest tests/unit/stripe/*.test.ts --no-coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | RESIL-02 | unit | `npx jest tests/unit/stripe/webhook-events.service.test.ts --no-coverage` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | RESIL-02 | integration | `npx jest tests/integration/stripe/webhook-replay-flow.test.ts --no-coverage` | ✅ | ⬜ pending |
| 02-02-01 | 02 | 2 | RESIL-03 | unit | `npx jest tests/unit/stripe/webhook-observability-api.test.ts --no-coverage` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 2 | RESIL-03 | integration | `npx jest tests/unit/stripe/webhook-log-ui.test.tsx --no-coverage` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 2 | STRP-06 | integration | `npx jest tests/integration/stripe/billing-lifecycle.test.ts --no-coverage` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 2 | STRP-07 | smoke | `npx jest tests/unit/stripe/stripe-dashboard-checklist.test.ts --no-coverage` | ✅ | ⬜ pending |

*Status: ⬜ pending - ✅ green - ❌ red - ⚠ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Smart Retries habilitado no Stripe Dashboard | STRP-07 | Configuracao externa fora do repo | Seguir `docs/guides/stripe-dashboard-checklist.md` e anexar capturas no UAT |
| Billing emails habilitados no Stripe | STRP-07 | Configuracao externa fora do repo | Validar toggles no Stripe Dashboard -> Billing settings |
| Replay real com Stripe CLI contra webhook endpoint | STRP-06, RESIL-02 | Depende de chaves/ambiente real | Executar `stripe trigger` + `scripts/replay-webhook-event.ts` em ambiente autenticado |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
