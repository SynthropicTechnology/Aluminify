## Why

O Aluminify precisa de um sistema de cobrança recorrente para monetizar a plataforma SaaS. Atualmente:

- A **pricing page** exibe planos hardcoded sem funcionalidade de checkout
- A tabela `empresas` tem campo `plano` (basico/profissional/enterprise) mas sem vínculo a assinaturas reais
- O módulo financeiro suporta Hotmart para vendas de cursos, mas não há infraestrutura para **assinaturas da plataforma** (B2B)
- O **superadmin** não possui gestão de planos nem visibilidade sobre assinaturas dos tenants
- Não há fluxo de upgrade/downgrade para os tenants gerenciarem seus próprios planos

A integração com Stripe resolve todas essas lacunas: cobrança recorrente automática, gestão de planos via API, portal de autoatendimento para tenants, e painel completo para o superadmin.

## What Changes

### P0 — Infraestrutura Stripe

- Instalar SDK `stripe` (Node.js)
- Adicionar variáveis de ambiente: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Atualizar validação Zod em `app/shared/core/env.ts`
- Criar service layer `app/shared/core/services/stripe.service.ts` com cliente Stripe singleton

### P0 — Modelo de Dados

- Criar migration: tabela `subscription_plans` (planos do sistema sincronizados com Stripe Products/Prices)
- Criar migration: tabela `subscriptions` (assinaturas ativas dos tenants vinculadas ao Stripe)
- Alterar tabela `empresas`: adicionar campos `stripe_customer_id` e `subscription_id`
- Adicionar tipos TypeScript em `app/shared/types/entities/subscription.ts`

### P0 — Webhook Handler Stripe

- Criar `app/api/webhooks/stripe/route.ts` seguindo padrão do Hotmart
- Validar assinatura via `stripe.webhooks.constructEvent()`
- Tratar eventos: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Atualizar status da assinatura e plano do tenant automaticamente

### P1 — Superadmin: Gestão de Planos

- Criar página `app/superadmin/planos/page.tsx` — CRUD de planos
- Criar/editar plano sincroniza com Stripe Products + Prices API
- Suportar preços mensais e anuais por plano
- Definir limites por plano (max alunos ativos, módulos habilitados, storage)

### P1 — Superadmin: Gestão de Assinaturas

- Criar página `app/superadmin/assinaturas/page.tsx` — visão de todos os tenants
- Listar tenants com status da assinatura, plano atual, próxima cobrança
- Ações: cancelar assinatura, alterar plano, ver histórico de pagamentos
- Filtros por status (ativa, inadimplente, cancelada, trial)

### P1 — Checkout e Billing Portal

- API route `app/api/stripe/checkout/route.ts` — criar Checkout Session (mode: subscription)
- API route `app/api/stripe/portal/route.ts` — criar Billing Portal Session
- Checkout redireciona para página hospedada do Stripe (PCI compliance automático)
- Portal permite upgrade/downgrade/cancelar/atualizar método de pagamento

### P2 — Pricing Page Dinâmica

- Criar API pública `app/api/plans/route.ts` — listar planos ativos de `subscription_plans`
- Refatorar `app/(landing-page)/pricing/components/pricing-page.tsx` para buscar planos do banco
- Manter toggle mensal/anual funcional com preços reais
- Botão "Assinar" inicia fluxo de Checkout Session

### P2 — Área do Tenant: Gestão do Plano

- Criar página `app/[tenant]/(modules)/configuracoes/plano/page.tsx`
- Exibir plano atual, status, próxima cobrança, limites de uso
- Botão "Gerenciar Assinatura" abre Stripe Customer Portal
- Alertas para limites próximos (ex: 90% dos alunos ativos permitidos)

### P3 — Enforcement de Limites

- Middleware para verificar limites do plano (max alunos, módulos)
- Bloquear ações que excedam limites com mensagem clara
- Grace period configurável para inadimplência

## Capabilities

### New Capabilities
- `stripe-integration`: Stripe SDK setup, webhook handler, Checkout Sessions, Billing Portal
- `subscription-plans-management`: CRUD de planos no superadmin, sync com Stripe Products/Prices, gestão de assinaturas, enforcement de limites
- `dynamic-pricing-page`: Pricing page dinâmica alimentada pelo banco de dados

### Modified Capabilities
- `financial`: Extensão do modelo financeiro para suportar assinaturas recorrentes da plataforma
- `landing-page`: Pricing page passa de hardcoded para dinâmica
- `data-model`: Novas tabelas `subscription_plans` e `subscriptions`, campos em `empresas`

## Impact

### Files Affected

**New Files:**
- `app/shared/core/services/stripe.service.ts`
- `app/shared/types/entities/subscription.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/stripe/checkout/route.ts`
- `app/api/stripe/portal/route.ts`
- `app/api/plans/route.ts`
- `app/superadmin/planos/` (page + components)
- `app/superadmin/assinaturas/` (page + components)
- `app/[tenant]/(modules)/configuracoes/plano/` (page + components)

**Modified Files:**
- `app/shared/core/env.ts` — novas env vars Stripe
- `app/shared/core/database.types.ts` — regenerado após migrations
- `app/(landing-page)/pricing/components/pricing-page.tsx` — dados dinâmicos
- `.env.example` — documentar novas variáveis

### Database Changes
- **NEW TABLE:** `subscription_plans` — definição dos planos com IDs do Stripe
- **NEW TABLE:** `subscriptions` — assinaturas ativas dos tenants
- **ALTER TABLE:** `empresas` — adicionar `stripe_customer_id`, `subscription_id`

### Breaking Changes
- **Nenhuma.** A pricing page será refatorada mas mantém compatibilidade visual. Planos existentes no campo `empresas.plano` serão migrados para o novo modelo.

### Risk Assessment
- **Moderado.** Integração com serviço externo (Stripe) requer tratamento cuidadoso de webhooks, idempotência e segurança de credenciais. Mitigado pelo padrão já estabelecido com Hotmart.
