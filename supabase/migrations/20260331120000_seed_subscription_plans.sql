-- Seed/update subscription plans for Aluminify
-- Planos: Gratuito (self-hosted), Nuvem (managed, Stripe), Personalizado (enterprise)

-- 1. Plano Gratuito (Self-Hosted) — sem Stripe
INSERT INTO public.subscription_plans (
  name, slug, description, features,
  price_monthly_cents, currency,
  allowed_modules, display_order, is_featured, active
) VALUES (
  'Gratuito',
  'gratuito',
  'Para quem tem equipe técnica e quer hospedar por conta própria.',
  '["Open source (Apache 2.0)", "Hospede onde quiser", "Todos os módulos incluídos", "Sem limite de alunos", "Comunidade no Discord"]'::jsonb,
  0, 'BRL',
  '[]'::jsonb, 1, false, true
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- 2. Plano Nuvem (Managed) — com Stripe
INSERT INTO public.subscription_plans (
  name, slug, description, features,
  stripe_product_id, stripe_price_id_monthly, stripe_price_id_yearly,
  price_monthly_cents, price_yearly_cents, currency,
  max_active_students, max_storage_mb,
  allowed_modules, extra_student_price_cents,
  display_order, is_featured, badge_text, active
) VALUES (
  'Nuvem',
  'nuvem',
  'A gente cuida de tudo pra você. Foque no que importa: ensinar.',
  '["Até 500 alunos ativos", "Cursos ilimitados", "10 GB de armazenamento", "Todos os módulos incluídos", "Hospedagem gerenciada", "Backups automáticos diários", "Suporte prioritário por email", "Domínio personalizado", "Branding completo (logo, cores, fontes)", "SSL incluso", "Trial de 14 dias grátis"]'::jsonb,
  'prod_UFcDWDYHu6Yn1y',
  'price_1TH79RGVx5Xzci4htGfuz6c5',
  'price_1TH7ExGVx5Xzci4hlzRtYagQ',
  49900, 479040, 'BRL',
  500, 10240,
  '[]'::jsonb, 100,
  2, true, 'Mais popular', true
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id_monthly = EXCLUDED.stripe_price_id_monthly,
  stripe_price_id_yearly = EXCLUDED.stripe_price_id_yearly,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  price_yearly_cents = EXCLUDED.price_yearly_cents,
  max_active_students = EXCLUDED.max_active_students,
  max_storage_mb = EXCLUDED.max_storage_mb,
  extra_student_price_cents = EXCLUDED.extra_student_price_cents,
  display_order = EXCLUDED.display_order,
  is_featured = EXCLUDED.is_featured,
  badge_text = EXCLUDED.badge_text,
  updated_at = now();

-- 3. Plano Personalizado (Enterprise) — sem Stripe, sob consulta
INSERT INTO public.subscription_plans (
  name, slug, description, features,
  price_monthly_cents, currency,
  allowed_modules, display_order, is_featured, active
) VALUES (
  'Personalizado',
  'personalizado',
  'Para grandes instituições com necessidades específicas.',
  '["Alunos ilimitados", "Cursos ilimitados", "Armazenamento ilimitado", "Todos os módulos incluídos", "Gerente de conta dedicado", "SLA garantido", "Integrações customizadas", "Onboarding assistido", "Suporte prioritário por chat e telefone", "Infraestrutura dedicada"]'::jsonb,
  0, 'BRL',
  '[]'::jsonb, 3, false, true
)
ON CONFLICT (slug) DO UPDATE SET
  description = EXCLUDED.description,
  features = EXCLUDED.features,
  display_order = EXCLUDED.display_order,
  badge_text = NULL,
  updated_at = now();
