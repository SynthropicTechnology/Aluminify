---
phase: 02-stripe-integration-testing-observability
status: complete
created: 2026-03-24
updated: 2026-03-24
---

# Phase 02 Research

## Objective

Definir a estrategia tecnica para validar o ciclo completo de billing Stripe e entregar observabilidade/replay de webhooks no superadmin.

## Current Baseline

- Webhook Stripe idempotente com persistencia em `webhook_events` ja existe em `app/api/webhooks/stripe/route.ts`.
- Tabela e status de eventos (`processing|processed|failed`) ja existem via migration da fase 1.
- Superadmin ja possui padrao de listagem com API + componente client-side em `app/superadmin/(dashboard)/faturas/components/invoice-list.tsx`.
- Rotas superadmin usam auth dedicada em `requireSuperadminForAPI()`.

## Gaps For Phase 02

- Nao existe rota/listagem de eventos de webhook para superadmin (RESIL-03).
- Nao existe endpoint/script de replay de eventos com falha (RESIL-02).
- Nao existe suite automatizada para ciclo end-to-end de billing (STRP-06).
- Nao existe contrato rastreavel no repo para configuracao Stripe Dashboard (STRP-07).

## Recommended Technical Strategy

1. Criar service dedicado para `webhook_events` (listagem filtrada + replay transacional).
2. Expor API superadmin para:
   - `GET /api/superadmin/webhooks` (log observavel)
   - `POST /api/superadmin/webhooks/replay` (reprocessamento)
3. Entregar pagina superadmin de observabilidade reaproveitando o padrao de `faturas`.
4. Adicionar script CLI para replay pontual via `node scripts/replay-webhook-event.ts --event <evt_id>`.
5. Adicionar testes unitarios/integracao para ciclo de billing e replay.
6. Formalizar checklist de configuracao Stripe Dashboard versionado no repo para auditoria e handoff operacional.

## Risks And Mitigations

- Risco: replay duplicar efeitos colaterais.
  - Mitigacao: replay somente para status `failed`; antes de replay validar estado atual no Stripe e atualizar status em `webhook_events`.
- Risco: testes E2E flakey por dependencia de rede.
  - Mitigacao: separar testes de contrato (mock Stripe) de passos manuais com Stripe CLI real em UAT.
- Risco: UI superadmin sem pagina dedicada no menu.
  - Mitigacao: criar rota e item de navegacao no mesmo plano para evitar feature oculta.

## Validation Architecture

- Framework principal: Jest (ja padrao no repo)
- Quick check por tarefa: `npx jest tests/unit/stripe/*.test.ts --no-coverage`
- Check por plano: suites especificas por arquivo
- Validacao manual complementar: Stripe Dashboard (Smart Retries, Customer Portal, billing emails)

## Requirement Mapping

- STRP-06: suite de ciclo de billing + evidencias de estado local por etapa
- STRP-07: checklist versionado + guia de verificacao operacional Stripe
- RESIL-02: replay via API superadmin e script CLI
- RESIL-03: log de webhook visivel no superadmin com status e payload resumido
