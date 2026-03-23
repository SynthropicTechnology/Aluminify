# Aluminify — SaaS Billing & Admin Completo

## What This Is

Portal educacional white-label multi-tenant (Aluminify) que precisa de uma infraestrutura completa de gestão SaaS: área de superadmin para administração da plataforma e gestão financeira de recorrência, e área do tenant para gestão de faturas, pagamentos e assinatura. A integração com Stripe já foi iniciada (~70%) mas não foi testada.

## Core Value

Gestão financeira de recorrência end-to-end funcionando — superadmin consegue administrar tenants e cobranças, tenant consegue pagar e gerenciar sua assinatura.

## Requirements

### Validated

- ✓ Login separado de superadmin com auth independente — existing
- ✓ Dashboard de métricas básicas (MRR, assinaturas ativas, distribuição de planos) — existing
- ✓ CRUD de planos de assinatura com sync Stripe (produto + preços) — existing
- ✓ Listagem e gestão de assinaturas (cancelar, trocar plano) — existing
- ✓ Listagem de faturas via Stripe API — existing
- ✓ Gestão de usuários superadmin — existing
- ✓ Checkout de assinatura via Stripe Checkout Sessions — existing
- ✓ Portal de billing Stripe para tenant — existing
- ✓ Webhook handler Stripe (checkout.completed, invoice.paid, payment_failed, subscription.updated, subscription.deleted) — existing
- ✓ Planos gratuitos sem Stripe — existing
- ✓ Página de configuração de plano no tenant — existing

### Active

- [ ] Revisão e correção da integração Stripe existente (não testada)
- [ ] Gestão completa de tenants no superadmin (CRUD empresas, visualizar uso, ativar/desativar)
- [ ] Gestão de inadimplência no superadmin (tenants atrasados, dunning, alertas)
- [ ] Métricas SaaS avançadas (churn, inadimplência, LTV, cohort)
- [ ] Histórico de faturas e pagamentos no tenant
- [ ] Alertas de pagamento atrasado / fatura vencida no tenant
- [ ] Recuperação automática de pagamento falho (retry, dunning)
- [ ] Gestão de trial periods
- [ ] Resiliência de webhooks (retry, logs, replay)
- [ ] Rate limiting nas rotas Stripe

### Out of Scope

- Stripe Connect / marketplace com sub-accounts — complexidade desnecessária para modelo SaaS simples
- Usage-based billing / metered pricing — modelo é plano fixo com recorrência
- Multi-currency — operação apenas em BRL por enquanto
- Integração com outros gateways (PagSeguro, Mercado Pago) — Stripe only
- Mobile app — web-first
- Suporte/ticketing integrado — usar ferramenta externa

## Context

- Projeto brownfield: Next.js 16 + React 19 + TypeScript 5 + Supabase + Stripe
- Superadmin existe em `app/superadmin/` com layout próprio e auth separada
- Stripe SDK v20.4.1 instalado com checkout, portal e webhooks implementados
- Webhook handler tem 19 console.log em produção — precisa cleanup
- Rotas Stripe sem rate limiting nem validação Zod dos inputs
- Nenhuma das funcionalidades Stripe foi testada end-to-end
- Tabelas já existem: `superadmins`, `subscriptions`, `subscription_plans`
- Tabela `empresas` já tem `stripe_customer_id`, `subscription_id`, `plano`
- API route `GET /api/superadmin/assinaturas/[id]` não existe (UI espera)
- Sistema de roles usa `PapelBase` + `isAdmin` (RoleTipo é deprecated)

## Constraints

- **Tech stack**: Next.js 16 App Router + Supabase + Stripe — stack já definida, não mudar
- **UI**: Tailwind CSS v4 + shadcn/ui — manter consistência com o resto do sistema
- **Idioma**: Interface em português brasileiro
- **Auth**: Superadmin tem auth completamente separada dos tenants
- **RLS**: Dados de tenant isolados via Supabase RLS policies
- **Stripe**: Usar Stripe Checkout (não custom payment forms) — PCI compliance sem esforço

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Stripe como único gateway | Simplificação, SDK maduro, suporte a recorrência nativo | — Pending |
| Auth superadmin separada | Isolamento total da área administrativa | ✓ Good |
| Sync bidirecional planos↔Stripe | Single source of truth no Stripe, mirror local | — Pending |
| Revisar antes de expandir | Integração existente não testada, corrigir primeiro | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-23 after initialization*
