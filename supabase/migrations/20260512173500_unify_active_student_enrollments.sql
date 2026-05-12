-- Unifica a leitura de alunos ativos/matriculados sem remover a fonte operacional atual.
--
-- Estratégia:
-- 1. `alunos_cursos` continua sendo o vínculo operacional aluno-curso.
-- 2. `matriculas` passa a ser sincronizada para carregar estado/período de acesso.
-- 3. Views/RPCs centralizam diagnósticos e contagens canônicas.

BEGIN;

ALTER TABLE public.matriculas
  ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_alunos_cursos_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matriculas_data_acesso_check'
      AND conrelid = 'public.matriculas'::regclass
  ) THEN
    ALTER TABLE public.matriculas
      ADD CONSTRAINT matriculas_data_acesso_check
      CHECK (data_fim_acesso >= data_inicio_acesso);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_matriculas_usuario_curso_empresa
  ON public.matriculas (usuario_id, curso_id, empresa_id);

CREATE INDEX IF NOT EXISTS idx_matriculas_empresa_ativo_periodo
  ON public.matriculas (empresa_id, ativo, data_inicio_acesso, data_fim_acesso);

-- Antes de aplicar unicidade para matrícula ativa, inativa duplicidades lógicas
-- mantendo a linha mais recente como ativa.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY usuario_id, curso_id, empresa_id
      ORDER BY updated_at DESC, data_matricula DESC, created_at DESC, id DESC
    ) AS rn
  FROM public.matriculas
  WHERE ativo = true
    AND usuario_id IS NOT NULL
    AND curso_id IS NOT NULL
    AND empresa_id IS NOT NULL
)
UPDATE public.matriculas m
SET
  ativo = false,
  origem = CASE
    WHEN m.origem = 'manual' THEN 'duplicate_inactivated'
    ELSE m.origem
  END,
  synced_at = now(),
  updated_at = now()
FROM ranked r
WHERE m.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_matriculas_active_usuario_curso_empresa
  ON public.matriculas (usuario_id, curso_id, empresa_id)
  WHERE ativo = true
    AND usuario_id IS NOT NULL
    AND curso_id IS NOT NULL
    AND empresa_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_matricula_empresa_from_curso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_empresa_id uuid;
BEGIN
  IF NEW.curso_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.empresa_id
  INTO v_empresa_id
  FROM public.cursos c
  WHERE c.id = NEW.curso_id;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Curso % sem empresa_id para matricula', NEW.curso_id;
  END IF;

  IF NEW.empresa_id IS NOT NULL AND NEW.empresa_id <> v_empresa_id THEN
    RAISE EXCEPTION 'matriculas.empresa_id (%) diverge de cursos.empresa_id (%)', NEW.empresa_id, v_empresa_id;
  END IF;

  NEW.empresa_id := v_empresa_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_matricula_empresa_from_curso ON public.matriculas;
CREATE TRIGGER trg_set_matricula_empresa_from_curso
  BEFORE INSERT OR UPDATE OF curso_id, empresa_id
  ON public.matriculas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_matricula_empresa_from_curso();

CREATE OR REPLACE FUNCTION public.sync_matricula_from_alunos_cursos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usuario_id uuid;
  v_curso_id uuid;
  v_empresa_id uuid;
  v_created_at timestamptz;
  v_inicio date;
  v_fim date;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_usuario_id := NEW.usuario_id;
    v_curso_id := NEW.curso_id;
    v_created_at := COALESCE(NEW.created_at, now());

    SELECT
      c.empresa_id,
      COALESCE(c.data_inicio, v_created_at::date, current_date),
      COALESCE(
        c.data_termino,
        CASE
          WHEN c.meses_acesso IS NOT NULL
            THEN (COALESCE(c.data_inicio, v_created_at::date, current_date)
              + make_interval(months => c.meses_acesso)
              - interval '1 day')::date
          ELSE date '2099-12-31'
        END
      )
    INTO v_empresa_id, v_inicio, v_fim
    FROM public.cursos c
    WHERE c.id = v_curso_id;

    IF v_empresa_id IS NULL THEN
      RAISE EXCEPTION 'Curso % sem empresa_id para sincronizar matricula', v_curso_id;
    END IF;

    WITH target_matricula AS (
      SELECT m.id
      FROM public.matriculas m
      WHERE m.usuario_id = v_usuario_id
        AND m.curso_id = v_curso_id
        AND m.empresa_id = v_empresa_id
      ORDER BY
        m.ativo DESC,
        m.updated_at DESC,
        m.data_matricula DESC,
        m.created_at DESC,
        m.id DESC
      LIMIT 1
    )
    UPDATE public.matriculas m
    SET
      ativo = true,
      origem = CASE
        WHEN m.origem IN ('alunos_cursos_deleted', 'duplicate_inactivated') THEN 'alunos_cursos_sync'
        ELSE m.origem
      END,
      source_alunos_cursos_created_at = COALESCE(m.source_alunos_cursos_created_at, v_created_at),
      synced_at = now(),
      updated_at = now(),
      data_inicio_acesso = COALESCE(m.data_inicio_acesso, v_inicio),
      data_fim_acesso = COALESCE(m.data_fim_acesso, v_fim)
    FROM target_matricula target
    WHERE m.id = target.id;

    IF FOUND THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.matriculas (
      usuario_id,
      curso_id,
      empresa_id,
      data_matricula,
      data_inicio_acesso,
      data_fim_acesso,
      ativo,
      origem,
      source_alunos_cursos_created_at,
      synced_at
    )
    VALUES (
      v_usuario_id,
      v_curso_id,
      v_empresa_id,
      v_created_at,
      v_inicio,
      v_fim,
      true,
      'alunos_cursos_sync',
      v_created_at,
      now()
    );

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT c.empresa_id
    INTO v_empresa_id
    FROM public.cursos c
    WHERE c.id = OLD.curso_id;

    UPDATE public.matriculas m
    SET
      ativo = false,
      origem = CASE
        WHEN m.origem IN ('alunos_cursos_sync', 'alunos_cursos_migration') THEN 'alunos_cursos_deleted'
        ELSE m.origem
      END,
      synced_at = now(),
      updated_at = now()
    WHERE m.usuario_id = OLD.usuario_id
      AND m.curso_id = OLD.curso_id
      AND m.empresa_id = v_empresa_id
      AND m.ativo = true;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_matricula_from_alunos_cursos_insert ON public.alunos_cursos;
CREATE TRIGGER trg_sync_matricula_from_alunos_cursos_insert
  AFTER INSERT ON public.alunos_cursos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_matricula_from_alunos_cursos();

DROP TRIGGER IF EXISTS trg_sync_matricula_from_alunos_cursos_delete ON public.alunos_cursos;
CREATE TRIGGER trg_sync_matricula_from_alunos_cursos_delete
  AFTER DELETE ON public.alunos_cursos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_matricula_from_alunos_cursos();

-- Backfill idempotente: todo vínculo operacional passa a ter matrícula formal.
INSERT INTO public.matriculas (
  usuario_id,
  curso_id,
  empresa_id,
  data_matricula,
  data_inicio_acesso,
  data_fim_acesso,
  ativo,
  origem,
  source_alunos_cursos_created_at,
  synced_at
)
SELECT
  ac.usuario_id,
  ac.curso_id,
  c.empresa_id,
  COALESCE(ac.created_at, now()),
  COALESCE(c.data_inicio, ac.created_at::date, current_date),
  COALESCE(
    c.data_termino,
    CASE
      WHEN c.meses_acesso IS NOT NULL
        THEN (COALESCE(c.data_inicio, ac.created_at::date, current_date)
          + make_interval(months => c.meses_acesso)
          - interval '1 day')::date
      ELSE date '2099-12-31'
    END
  ),
  true,
  'alunos_cursos_migration',
  ac.created_at,
  now()
FROM public.alunos_cursos ac
JOIN public.cursos c ON c.id = ac.curso_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.matriculas m
  WHERE m.usuario_id = ac.usuario_id
    AND m.curso_id = ac.curso_id
    AND m.empresa_id = c.empresa_id
);

-- Linhas ativas em matriculas sem vínculo operacional ganham o vínculo em alunos_cursos.
INSERT INTO public.alunos_cursos (usuario_id, curso_id, created_at)
SELECT DISTINCT
  m.usuario_id,
  m.curso_id,
  COALESCE(m.created_at, m.data_matricula, now())
FROM public.matriculas m
WHERE m.ativo = true
  AND m.usuario_id IS NOT NULL
  AND m.curso_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.alunos_cursos ac
    WHERE ac.usuario_id = m.usuario_id
      AND ac.curso_id = m.curso_id
  )
ON CONFLICT (usuario_id, curso_id) DO NOTHING;

CREATE OR REPLACE VIEW public.alunos_matriculas_canonicas
WITH (security_invoker = true)
AS
WITH ac_base AS (
  SELECT
    ac.usuario_id,
    ac.curso_id,
    c.empresa_id,
    ac.created_at AS aluno_curso_created_at
  FROM public.alunos_cursos ac
  JOIN public.cursos c ON c.id = ac.curso_id
),
m_ranked AS (
  SELECT
    m.*,
    row_number() OVER (
      PARTITION BY m.usuario_id, m.curso_id, m.empresa_id
      ORDER BY m.ativo DESC, m.updated_at DESC, m.data_matricula DESC, m.created_at DESC, m.id DESC
    ) AS rn
  FROM public.matriculas m
  WHERE m.usuario_id IS NOT NULL
    AND m.curso_id IS NOT NULL
    AND m.empresa_id IS NOT NULL
),
m_latest AS (
  SELECT *
  FROM m_ranked
  WHERE rn = 1
),
joined AS (
  SELECT
    COALESCE(ac.usuario_id, m.usuario_id) AS usuario_id,
    COALESCE(ac.curso_id, m.curso_id) AS curso_id,
    COALESCE(ac.empresa_id, m.empresa_id) AS empresa_id,
    ac.usuario_id IS NOT NULL AS has_alunos_cursos,
    m.id IS NOT NULL AS has_matricula,
    m.id AS matricula_id,
    COALESCE(m.ativo, true) AS matricula_ativa,
    COALESCE(m.data_inicio_acesso, ac.aluno_curso_created_at::date, current_date) AS data_inicio_acesso,
    COALESCE(m.data_fim_acesso, date '2099-12-31') AS data_fim_acesso,
    COALESCE(m.data_matricula, ac.aluno_curso_created_at) AS data_matricula,
    m.origem
  FROM ac_base ac
  FULL JOIN m_latest m
    ON m.usuario_id = ac.usuario_id
   AND m.curso_id = ac.curso_id
   AND m.empresa_id = ac.empresa_id
)
SELECT
  j.usuario_id,
  j.curso_id,
  j.empresa_id,
  j.has_alunos_cursos,
  j.has_matricula,
  j.matricula_id,
  j.matricula_ativa,
  j.data_inicio_acesso,
  j.data_fim_acesso,
  j.data_matricula,
  j.origem,
  u.ativo AS usuario_ativo,
  u.deleted_at AS usuario_deleted_at,
  (
    u.ativo = true
    AND u.deleted_at IS NULL
    AND (
      (j.has_alunos_cursos AND (NOT j.has_matricula OR j.matricula_ativa = true))
      OR (NOT j.has_alunos_cursos AND j.has_matricula AND j.matricula_ativa = true)
    )
  ) AS ativo_operacional,
  (
    current_date BETWEEN j.data_inicio_acesso AND j.data_fim_acesso
  ) AS vigente_hoje
FROM joined j
JOIN public.usuarios u ON u.id = j.usuario_id;

CREATE OR REPLACE VIEW public.alunos_matriculas_diagnostico
WITH (security_invoker = true)
AS
WITH ac AS (
  SELECT DISTINCT
    c.empresa_id,
    ac.usuario_id
  FROM public.alunos_cursos ac
  JOIN public.cursos c ON c.id = ac.curso_id
),
m AS (
  SELECT DISTINCT
    m.empresa_id,
    m.usuario_id
  FROM public.matriculas m
  WHERE m.ativo = true
    AND m.usuario_id IS NOT NULL
    AND m.empresa_id IS NOT NULL
),
invalid_dates AS (
  SELECT
    empresa_id,
    count(*) AS total
  FROM public.matriculas
  WHERE data_fim_acesso < data_inicio_acesso
  GROUP BY empresa_id
),
pairs AS (
  SELECT empresa_id, usuario_id FROM ac
  UNION
  SELECT empresa_id, usuario_id FROM m
)
SELECT
  e.id AS empresa_id,
  count(DISTINCT ac.usuario_id) AS alunos_em_alunos_cursos,
  count(DISTINCT m.usuario_id) AS alunos_em_matriculas_ativas,
  count(DISTINCT pairs.usuario_id) FILTER (WHERE ac.usuario_id IS NOT NULL AND m.usuario_id IS NOT NULL) AS alunos_em_ambas,
  count(DISTINCT pairs.usuario_id) FILTER (WHERE ac.usuario_id IS NOT NULL AND m.usuario_id IS NULL) AS somente_alunos_cursos,
  count(DISTINCT pairs.usuario_id) FILTER (WHERE ac.usuario_id IS NULL AND m.usuario_id IS NOT NULL) AS somente_matriculas_ativas,
  COALESCE(max(invalid_dates.total), 0) AS matriculas_datas_invalidas
FROM public.empresas e
LEFT JOIN pairs ON pairs.empresa_id = e.id
LEFT JOIN ac ON ac.empresa_id = pairs.empresa_id
  AND ac.usuario_id = pairs.usuario_id
LEFT JOIN m ON m.empresa_id = e.id
  AND m.usuario_id = pairs.usuario_id
LEFT JOIN invalid_dates ON invalid_dates.empresa_id = e.id
GROUP BY e.id;

CREATE OR REPLACE FUNCTION public.get_alunos_ativos_matriculados(
  p_empresa_id uuid,
  p_data_ref date DEFAULT current_date,
  p_curso_id uuid DEFAULT NULL
)
RETURNS TABLE (
  usuario_id uuid,
  curso_id uuid,
  empresa_id uuid,
  has_alunos_cursos boolean,
  has_matricula boolean,
  matricula_id uuid
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT
    c.usuario_id,
    c.curso_id,
    c.empresa_id,
    c.has_alunos_cursos,
    c.has_matricula,
    c.matricula_id
  FROM public.alunos_matriculas_canonicas c
  WHERE c.empresa_id = p_empresa_id
    AND (p_curso_id IS NULL OR c.curso_id = p_curso_id)
    AND c.ativo_operacional = true
    AND p_data_ref BETWEEN c.data_inicio_acesso AND c.data_fim_acesso;
$$;

GRANT SELECT ON public.alunos_matriculas_canonicas TO authenticated;
GRANT SELECT ON public.alunos_matriculas_diagnostico TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_alunos_ativos_matriculados(uuid, date, uuid) TO authenticated;

COMMENT ON VIEW public.alunos_matriculas_canonicas IS
  'Camada canonica de leitura para vinculos aluno-curso durante a transicao entre alunos_cursos e matriculas.';

COMMENT ON VIEW public.alunos_matriculas_diagnostico IS
  'Diagnostico de divergencias entre alunos_cursos e matriculas por empresa.';

COMMENT ON FUNCTION public.get_alunos_ativos_matriculados(uuid, date, uuid) IS
  'Retorna alunos ativos e matriculados por empresa/data usando a camada canonica.';

COMMIT;
