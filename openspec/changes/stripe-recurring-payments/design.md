## Context

O Aluminify é uma plataforma SaaS multi-tenant para instituições de ensino. A monetização depende de assinaturas recorrentes dos tenants (instituições). Atualmente o sistema financeiro trata apenas vendas de cursos (B2C via Hotmart), sem infraestrutura para cobrança recorrente da plataforma (B2B).

A pricing page exibe 3 tiers hardcoded (Gratuito, Nuvem R$499/mês, Personalizado), sem checkout funcional. O campo `empresas.plano` armazena o tier mas sem vínculo a pagamentos reais.

O padrão de integração com provedores de pagamento já está estabelecido via Hotmart (webhook handler, `payment_providers` table, `FinancialServiceImpl`).

## Goals / Non-Goals

**Goals:**
- Permitir ao superadmin criar, editar e gerenciar planos de assinatura sem usar o dashboard do Stripe
- Automatizar cobrança recorrente dos tenants via Stripe Subscriptions
- Oferecer autoatendimento aos tenants (upgrade, downgrade, cancelar, atualizar pagamento)
- Tornar a pricing page dinâmica, alimentada pelo banco de dados
- Manter consistência com os padrões existentes do projeto (webhook handler, service layer, multi-tenant)

**Non-Goals:**
- Migrar o sistema de vendas de cursos (Hotmart) para Stripe — o Hotmart continua como provider para B2C
- Implementar Stripe Connect (marketplace) — cada tenant não processa pagamentos pelo Stripe
- Implementar metered billing baseado em uso em tempo real — limites serão verificados por contagem, não por uso contínuo
- Suportar múltiplas moedas — BRL apenas na fase inicial
- Implementar trial automático do Stripe — trial será gerenciado internamente

## Decisions

### D1: Stripe Checkout Sessions para pagamento (não Elements)

**Decision:** Usar Stripe Checkout Sessions (hosted page) em vez de Stripe Elements (embedded form).

**Rationale:**
- PCI compliance automático (SAQ A) — sem necessidade de lidar com dados de cartão
- Suporte nativo a PIX, boleto e cartão sem implementação adicional
- UI otimizada pelo Stripe (conversão, responsividade, i18n)
- Menor superfície de código e manutenção
- Integração mais rápida — redirect em vez de componentes custom

**Alternatives considered:**
- **Stripe Elements:** Maior controle visual, mas requer PCI SAQ A-EP, mais código, tratamento manual de erros de pagamento. Descartado por complexidade desnecessária.
- **Payment Links:** Muito simples, sem controle programático. Descartado.

### D2: Stripe Customer Portal para gestão de assinatura

**Decision:** Usar o Stripe Billing Portal hospedado para que tenants gerenciem suas assinaturas.

**Rationale:**
- Upgrade/downgrade/cancelar/atualizar método de pagamento sem implementação custom
- Stripe calcula proration automaticamente em mudanças de plano
- Reduz drasticamente o escopo de implementação no frontend
- Segurança: dados de pagamento nunca trafegam pelo nosso servidor

**Alternatives considered:**
- **Custom subscription management UI:** Controle total mas requer implementar proration, retry logic, gestão de método de pagamento. Descartado por complexidade excessiva.

### D3: Tabela local `subscription_plans` sincronizada com Stripe

**Decision:** Manter uma tabela local `subscription_plans` como source of truth para exibição, sincronizada bidirecionalmente com Stripe Products/Prices.

**Rationale:**
- A pricing page e a área do tenant precisam de acesso rápido sem chamar a API do Stripe a cada request
- Permite adicionar campos locais (features list, limites, ordem de exibição) que não existem no Stripe
- IDs do Stripe (`stripe_product_id`, `stripe_price_id`) são armazenados para sync
- Ao criar/editar no superadmin, o Stripe é atualizado primeiro, depois o banco local
- Webhooks do Stripe podem atualizar o banco local se houver mudança no dashboard (defesa em profundidade)

**Alternatives considered:**
- **Stripe como source of truth:** Chamar API a cada page load. Descartado por latência, rate limits, e impossibilidade de adicionar metadados custom.
- **Banco local sem sync:** Dados podem ficar inconsistentes com Stripe. Descartado.

### D4: Webhook global (não multi-tenant) para Stripe

**Decision:** Usar um único endpoint de webhook Stripe (`/api/webhooks/stripe`) com a chave `STRIPE_WEBHOOK_SECRET` global, diferente do padrão por-empresa usado no Hotmart.

**Rationale:**
- A conta Stripe é do **dono do sistema** (superadmin), não de cada tenant
- Diferente do Hotmart onde cada tenant tem sua conta, aqui há uma única conta Stripe
- O `stripe_customer_id` na tabela `empresas` mapeia eventos do Stripe para o tenant correto
- Simplifica configuração — um webhook secret, um endpoint

**Alternatives considered:**
- **Webhook por empresa (padrão Hotmart):** Não faz sentido porque todos os tenants usam a mesma conta Stripe do superadmin. Descartado.

### D5: Modelo de dados para planos e assinaturas

**Decision:** Duas novas tabelas separadas: `subscription_plans` (catálogo de planos) e `subscriptions` (assinaturas ativas), com referência em `empresas`.

**Schema `subscription_plans`:**
```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                          -- "Nuvem", "Enterprise"
  slug TEXT NOT NULL UNIQUE,                   -- "nuvem", "enterprise"
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]',        -- ["Até 500 alunos", "Suporte prioritário"]

  -- Stripe sync
  stripe_product_id TEXT UNIQUE,               -- prod_xxx
  stripe_price_id_monthly TEXT,                -- price_xxx (mensal)
  stripe_price_id_yearly TEXT,                 -- price_xxx (anual)

  -- Preços (local, para exibição)
  price_monthly_cents INTEGER NOT NULL,        -- 49900 = R$499,00
  price_yearly_cents INTEGER,                  -- 479900 = R$4.799,00 (desconto anual)
  currency TEXT NOT NULL DEFAULT 'BRL',

  -- Limites do plano
  max_active_students INTEGER,                 -- null = ilimitado
  max_courses INTEGER,                         -- null = ilimitado
  max_storage_mb INTEGER,                      -- null = ilimitado
  allowed_modules JSONB DEFAULT '[]',          -- ["flashcards", "sala-de-estudos", "ai-agents"]
  extra_student_price_cents INTEGER,           -- 100 = R$1,00 por aluno extra

  -- Display
  display_order INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,  -- Destaque na pricing page
  badge_text TEXT,                             -- "Mais popular", "Melhor custo-benefício"

  -- Status
  active BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Schema `subscriptions`:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES empresas(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),

  -- Stripe sync
  stripe_subscription_id TEXT UNIQUE,          -- sub_xxx
  stripe_customer_id TEXT NOT NULL,            -- cus_xxx

  -- Status
  status TEXT NOT NULL DEFAULT 'active',       -- active | past_due | canceled | unpaid | trialing | paused
  billing_interval TEXT NOT NULL,              -- 'month' | 'year'

  -- Período
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at TIMESTAMPTZ,                       -- Data agendada de cancelamento
  canceled_at TIMESTAMPTZ,                     -- Data efetiva do cancelamento

  -- Pagamento
  last_payment_date TIMESTAMPTZ,
  last_payment_amount_cents INTEGER,
  next_payment_date TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Alteração em `empresas`:**
```sql
ALTER TABLE empresas
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN subscription_id UUID REFERENCES subscriptions(id);
```

**Rationale:**
- Separação clara entre catálogo (planos) e instâncias (assinaturas)
- `subscription_plans` é global (sem `empresa_id`) pois planos são definidos pelo superadmin
- `subscriptions` tem `empresa_id` para isolamento multi-tenant
- Campos de limites em `subscription_plans` permitem enforcement sem consultar Stripe
- `features` como JSONB para flexibilidade na exibição da pricing page

### D6: Fluxo de checkout para novos tenants

**Decision:** O fluxo de checkout criará automaticamente um Stripe Customer a partir dos dados do tenant e redirecionará para Stripe Checkout Session.

**Fluxo:**
```
1. Tenant clica "Assinar" na pricing page ou área de configurações
2. API /api/stripe/checkout recebe: plan_id, billing_interval, empresa_id
3. Backend verifica/cria Stripe Customer (usando email do admin do tenant)
4. Cria Checkout Session com:
   - mode: 'subscription'
   - customer: stripe_customer_id
   - price: stripe_price_id do plano
   - success_url: /[tenant]/configuracoes/plano?session_id={CHECKOUT_SESSION_ID}
   - cancel_url: /[tenant]/configuracoes/plano
   - metadata: { empresa_id, plan_id }
5. Retorna session.url → frontend redireciona
6. Stripe processa pagamento
7. Webhook checkout.session.completed → cria subscription no banco, atualiza empresa.plano
```

### D7: Tratamento de webhook events

**Decision:** Tratar os seguintes eventos com prioridade:

| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Criar `subscriptions` row, atualizar `empresas.plano` e `empresas.subscription_id` |
| `invoice.paid` | Atualizar `subscriptions.last_payment_date`, confirmar renovação |
| `invoice.payment_failed` | Marcar `subscriptions.status = 'past_due'`, notificar tenant |
| `customer.subscription.updated` | Atualizar plano (upgrade/downgrade), período, status |
| `customer.subscription.deleted` | Marcar como cancelada, agendar downgrade para plano gratuito |

**Idempotência:** Usar `stripe_subscription_id` como chave de deduplicação. Verificar se o evento já foi processado antes de aplicar mudanças.

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| Webhook delivery failure | Stripe retry automático (até 3 dias). Implementar reconciliação manual no superadmin. |
| Inconsistência banco local vs Stripe | Sync bidirecional: superadmin → Stripe API, Stripe webhooks → banco local. |
| Stripe API rate limits | Cache local de planos. Checkout/Portal sessions são operações pontuais. |
| Segurança das credenciais | `STRIPE_SECRET_KEY` server-only, nunca exposto ao client. Validação de webhook signature obrigatória. |
| Migração de tenants existentes | Tenants existentes mantêm plano atual. Migração gradual: ao acessar checkout, vincula ao Stripe. |

## Migration Plan

### Step 1: Schema Migration
- Criar tabelas `subscription_plans` e `subscriptions` via Supabase migration
- Adicionar campos em `empresas`
- Criar RLS policies para `subscriptions` (tenant isolation)
- `subscription_plans` sem RLS (público para leitura, superadmin para escrita)

### Step 2: Seed Initial Plans
- Inserir planos iniciais baseados nos tiers atuais (Gratuito, Nuvem, Enterprise)
- Sincronizar com Stripe Products/Prices via script

### Step 3: Incremental Rollout
- Deploy webhook handler primeiro (passivo, apenas recebe)
- Deploy superadmin CRUD de planos
- Deploy checkout + portal
- Refatorar pricing page por último

## Open Questions

1. **Q:** O plano "Gratuito" deve existir no Stripe como produto com preço zero, ou ser tratado apenas localmente?
   - **Recommendation:** Tratar localmente. Sem Stripe Customer para plano gratuito. Simplifica o fluxo.

2. **Q:** Como lidar com o "extra student pricing" (R$1,00 por aluno extra além do limite do plano)?
   - **Recommendation:** Fase 2. Implementar via Stripe metered billing ou cobrança manual pelo superadmin. Não incluir no escopo inicial.

3. **Q:** Tenants existentes com plano definido em `empresas.plano` devem ser migrados automaticamente para o novo modelo?
   - **Recommendation:** Não. Manter campo `empresas.plano` como fallback. Quando o tenant assinar via Stripe, o novo modelo assume precedência.
