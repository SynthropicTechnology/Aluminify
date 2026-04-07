-- Migration: Create tenant_login_events for institutional dashboard metrics
-- Description:
--   1. Create login event table scoped by tenant
--   2. Apply RLS read policy for tenant admins
--   3. Add indexes for period and user aggregation queries
--   4. Add helper functions for summary and daily series

BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_login_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    source text NOT NULL DEFAULT 'password',
    occurred_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_login_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can view login events" ON public.tenant_login_events;
CREATE POLICY "Tenant admins can view login events"
    ON public.tenant_login_events
    FOR SELECT
    TO authenticated
    USING (
        public.is_empresa_admin((SELECT auth.uid()), tenant_login_events.empresa_id)
    );

CREATE INDEX IF NOT EXISTS idx_tenant_login_events_empresa_occurred
    ON public.tenant_login_events (empresa_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_login_events_empresa_usuario_occurred
    ON public.tenant_login_events (empresa_id, usuario_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.get_tenant_login_summary(
    p_empresa_id uuid,
    p_start timestamptz,
    p_end timestamptz DEFAULT now()
)
RETURNS TABLE (
    alunos_logaram bigint,
    total_eventos bigint,
    primeiro_evento timestamptz,
    ultimo_evento timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        COUNT(DISTINCT tle.usuario_id) AS alunos_logaram,
        COUNT(*) AS total_eventos,
        MIN(tle.occurred_at) AS primeiro_evento,
        MAX(tle.occurred_at) AS ultimo_evento
    FROM public.tenant_login_events tle
    WHERE tle.empresa_id = p_empresa_id
      AND tle.occurred_at >= p_start
      AND tle.occurred_at <= p_end;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_login_first_event_at(
    p_empresa_id uuid
)
RETURNS timestamptz
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT MIN(tle.occurred_at)
    FROM public.tenant_login_events tle
    WHERE tle.empresa_id = p_empresa_id;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_daily_logins(
    p_empresa_id uuid,
    p_start date,
    p_end date
)
RETURNS TABLE (
    day date,
    unique_users bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    WITH days AS (
        SELECT generate_series(p_start, p_end, interval '1 day')::date AS day
    ),
    grouped AS (
        SELECT
            tle.occurred_at::date AS day,
            COUNT(DISTINCT tle.usuario_id) AS unique_users
        FROM public.tenant_login_events tle
        WHERE tle.empresa_id = p_empresa_id
          AND tle.occurred_at::date BETWEEN p_start AND p_end
        GROUP BY tle.occurred_at::date
    )
    SELECT
        d.day,
        COALESCE(g.unique_users, 0) AS unique_users
    FROM days d
    LEFT JOIN grouped g ON g.day = d.day
    ORDER BY d.day;
$$;

COMMENT ON TABLE public.tenant_login_events IS
    'Eventos de login bem-sucedido por tenant para métricas institucionais.';
COMMENT ON FUNCTION public.get_tenant_login_summary(uuid, timestamptz, timestamptz) IS
    'Retorna resumo de logins por tenant no intervalo informado.';
COMMENT ON FUNCTION public.get_tenant_login_first_event_at(uuid) IS
    'Retorna a data do primeiro evento de login registrado no tenant.';
COMMENT ON FUNCTION public.get_tenant_daily_logins(uuid, date, date) IS
    'Retorna série diária de usuários únicos que logaram no tenant.';

COMMIT;
