-- Migration: Fast cronograma counters for institutional dashboard
-- Description:
--   Avoids many PostgREST count requests over cronograma_itens by aggregating
--   completion and planned-item counters in a single SQL function.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_cronogramas_empresa_usuario_id
    ON public.cronogramas (empresa_id, usuario_id, id);

CREATE INDEX IF NOT EXISTS idx_cronograma_itens_cronograma_dates
    ON public.cronograma_itens (cronograma_id, data_conclusao, data_prevista);

CREATE OR REPLACE FUNCTION public.get_tenant_cronograma_engagement_counts(
    p_empresa_id uuid,
    p_student_ids uuid[],
    p_start timestamptz,
    p_end timestamptz DEFAULT now()
)
RETURNS TABLE (
    aulas_concluidas bigint,
    itens_previstos bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        COUNT(*) FILTER (
            WHERE ci.concluido = true
              AND ci.data_conclusao >= p_start
        ) AS aulas_concluidas,
        COUNT(*) FILTER (
            WHERE ci.data_prevista >= p_start
              AND ci.data_prevista <= p_end
        ) AS itens_previstos
    FROM public.cronograma_itens ci
    INNER JOIN public.cronogramas c ON c.id = ci.cronograma_id
    WHERE c.empresa_id = p_empresa_id
      AND c.usuario_id = ANY(p_student_ids);
$$;

COMMENT ON FUNCTION public.get_tenant_cronograma_engagement_counts(uuid, uuid[], timestamptz, timestamptz) IS
    'Conta itens de cronograma concluídos e previstos para alunos de um tenant em uma única consulta.';

COMMIT;
