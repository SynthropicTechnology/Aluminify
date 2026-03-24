# Requirements: Aluminify SaaS Billing & Admin

**Defined:** 2026-03-23
**Core Value:** Gestão financeira de recorrência end-to-end — superadmin administra tenants e cobranças, tenant paga e gerencia sua assinatura.

## v1 Requirements

Requirements para o milestone atual. Cada um mapeia para fases do roadmap.

### Fundação Stripe

- [x] **STRP-01**: Webhook handler é idempotente (tabela `webhook_events` com `stripe_event_id` UNIQUE, deduplicação via INSERT ON CONFLICT)
- [x] **STRP-02**: Webhook handler usa padrão single-sync (`syncStripeSubscriptionToLocal()`) — busca estado atual do Stripe em vez de aplicar updates incrementais
- [ ] **STRP-03**: Todas as rotas de billing (`/api/stripe/*`, `/api/superadmin/*`) validam input com Zod schemas
- [ ] **STRP-04**: Rate limiting aplicado nas rotas de billing (checkout, portal, webhook) usando o serviço existente
- [x] **STRP-05**: Logging estruturado substitui todos os `console.log` no webhook handler e rotas de billing
- [ ] **STRP-06**: Integração Stripe testada end-to-end (checkout → webhook → subscription ativa → renovação → falha → cancelamento)
- [ ] **STRP-07**: Stripe Dashboard configurado: Smart Retries ativado, Customer Portal configurado, emails de billing habilitados

### Superadmin — Gestão de Tenants

- [ ] **TENT-01**: Superadmin pode listar todos os tenants com busca, filtros (status, plano, inadimplência) e paginação
- [ ] **TENT-02**: Superadmin pode visualizar detalhes de um tenant (dados da empresa, assinatura, uso vs. limites do plano)
- [ ] **TENT-03**: Superadmin pode criar um novo tenant manualmente (empresa + admin user)
- [ ] **TENT-04**: Superadmin pode editar dados de um tenant (nome, slug, configurações)
- [ ] **TENT-05**: Superadmin pode ativar/desativar um tenant (campo `ativo` em `empresas`)
- [ ] **TENT-06**: Superadmin pode ver uso do tenant (alunos ativos, cursos, storage) comparado com limites do plano

### Superadmin — Gestão Financeira

- [ ] **FINC-01**: Superadmin pode ver lista de tenants inadimplentes (past_due) com dias de atraso e valor pendente
- [ ] **FINC-02**: Superadmin pode configurar período de carência (grace period) global ou por plano
- [ ] **FINC-03**: Superadmin pode forçar cancelamento de assinatura de um tenant
- [ ] **FINC-04**: Superadmin pode estender assinatura manualmente (via Stripe API — créditos/cupons)
- [ ] **FINC-05**: Métricas SaaS: MRR calculado corretamente (considerando billing interval mensal/anual), churn rate, taxa de inadimplência
- [ ] **FINC-06**: Log de auditoria para ações de billing (quem fez o quê, quando, em qual tenant)
- [ ] **FINC-07**: API route `GET /api/superadmin/assinaturas/[id]` implementada (UI de detalhe já existe mas API falta)

### Tenant — Billing & Pagamento

- [ ] **TBIL-01**: Tenant admin pode ver histórico de faturas e pagamentos dentro do app (sem ir ao Stripe Portal)
- [ ] **TBIL-02**: Tenant admin vê alerta visível quando pagamento está atrasado (banner no dashboard + página de plano)
- [ ] **TBIL-03**: Tenant admin pode escolher entre billing mensal ou anual ao fazer upgrade (toggle já tem dados, falta UI)
- [ ] **TBIL-04**: Tenant admin pode ver comparação side-by-side dos planos disponíveis (features, limites, preços)
- [ ] **TBIL-05**: Tenant admin tem fluxo de cancelamento in-app com coleta de motivo e oferta de retenção (downgrade/desconto)
- [ ] **TBIL-06**: Tenant admin vê aviso ao tentar downgrade quando uso atual excede limites do plano alvo

### Enforcement de Planos

- [ ] **PLAN-01**: Limites de plano são enforced: criação de aluno bloqueada quando `max_active_students` atingido
- [ ] **PLAN-02**: Limites de plano são enforced: criação de curso bloqueada quando `max_courses` atingido
- [ ] **PLAN-03**: Limites de plano são enforced: upload de arquivo bloqueado quando `max_storage_mb` atingido
- [ ] **PLAN-04**: Módulos restritos por plano: `allowed_modules` é verificado antes de dar acesso a módulos premium
- [ ] **PLAN-05**: Acesso do tenant é restrito quando assinatura está cancelada ou após grace period expirar (downgrade para free ou bloqueio)

### Resiliência & Observabilidade

- [x] **RESIL-01**: Eventos de webhook são persistidos em tabela `webhook_events` com status (received, processed, failed)
- [ ] **RESIL-02**: Webhook events com falha podem ser re-processados (replay) via superadmin ou script
- [ ] **RESIL-03**: Superadmin pode ver log de eventos de webhook recentes com status e payload resumido

## v2 Requirements

Reconhecidos mas deferidos. Não no roadmap atual.

### Métricas Avançadas

- **METR-01**: Análise de cohort por mês de signup (retenção ao longo do tempo)
- **METR-02**: Customer Lifetime Value (LTV) calculado e exibido por tenant
- **METR-03**: Gráficos de tendência de MRR ao longo do tempo (requer snapshots históricos)
- **METR-04**: Health score por tenant (composição de status, pagamentos, uso, último login)

### Trial & Onboarding

- **TRIAL-01**: Suporte a trial period configurável por plano (N dias grátis antes de cobrar)
- **TRIAL-02**: UI de countdown do trial com CTA de conversão
- **TRIAL-03**: Fluxo automático trial → paid (checkout session no final do trial)

### Comunicação

- **COMM-01**: Emails transacionais brandados (pagamento confirmado, falha, lembrete de renovação)
- **COMM-02**: Superadmin pode enviar broadcast para todos os tenants

### Notas Fiscais

- **NFE-01**: Integração com serviço de NF-e (Nuvem Fiscal, eNotas) para emissão automática

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom payment forms (Stripe Elements) | PCI compliance burden; Stripe Checkout já cobre |
| Usage-based / metered billing | Modelo é plano fixo com limites; complexidade desnecessária |
| Multi-currency | Operação BRL-only por enquanto |
| Múltiplos gateways (PagSeguro, MP) | Stripe-only; decisão de projeto |
| Stripe Connect / marketplace | B2B SaaS, não marketplace |
| In-app support/ticketing | Usar ferramenta externa (Zendesk, Intercom) |
| Proration calculator customizado | Stripe calcula proration automaticamente |
| Real-time usage tracking | Near-real-time (refresh on load) é suficiente |
| Mobile app | Web-first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STRP-01 | Phase 1: Webhook Hardening & Foundation | Complete |
| STRP-02 | Phase 1: Webhook Hardening & Foundation | Complete |
| STRP-03 | Phase 1: Webhook Hardening & Foundation | Pending |
| STRP-04 | Phase 1: Webhook Hardening & Foundation | Pending |
| STRP-05 | Phase 1: Webhook Hardening & Foundation | Complete |
| RESIL-01 | Phase 1: Webhook Hardening & Foundation | Complete |
| STRP-06 | Phase 2: Stripe Integration Testing & Observability | Pending |
| STRP-07 | Phase 2: Stripe Integration Testing & Observability | Pending |
| RESIL-02 | Phase 2: Stripe Integration Testing & Observability | Pending |
| RESIL-03 | Phase 2: Stripe Integration Testing & Observability | Pending |
| TENT-01 | Phase 3: Superadmin Tenant Management | Pending |
| TENT-02 | Phase 3: Superadmin Tenant Management | Pending |
| TENT-03 | Phase 3: Superadmin Tenant Management | Pending |
| TENT-04 | Phase 3: Superadmin Tenant Management | Pending |
| TENT-05 | Phase 3: Superadmin Tenant Management | Pending |
| TENT-06 | Phase 3: Superadmin Tenant Management | Pending |
| FINC-01 | Phase 4: SaaS Metrics & Delinquency Management | Pending |
| FINC-02 | Phase 4: SaaS Metrics & Delinquency Management | Pending |
| FINC-03 | Phase 4: SaaS Metrics & Delinquency Management | Pending |
| FINC-04 | Phase 4: SaaS Metrics & Delinquency Management | Pending |
| FINC-05 | Phase 4: SaaS Metrics & Delinquency Management | Pending |
| FINC-06 | Phase 4: SaaS Metrics & Delinquency Management | Pending |
| FINC-07 | Phase 4: SaaS Metrics & Delinquency Management | Pending |
| TBIL-01 | Phase 5: Tenant Billing Experience | Pending |
| TBIL-02 | Phase 5: Tenant Billing Experience | Pending |
| TBIL-03 | Phase 5: Tenant Billing Experience | Pending |
| TBIL-04 | Phase 5: Tenant Billing Experience | Pending |
| TBIL-05 | Phase 5: Tenant Billing Experience | Pending |
| TBIL-06 | Phase 5: Tenant Billing Experience | Pending |
| PLAN-01 | Phase 6: Plan Enforcement | Pending |
| PLAN-02 | Phase 6: Plan Enforcement | Pending |
| PLAN-03 | Phase 6: Plan Enforcement | Pending |
| PLAN-04 | Phase 6: Plan Enforcement | Pending |
| PLAN-05 | Phase 6: Plan Enforcement | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after roadmap creation*
