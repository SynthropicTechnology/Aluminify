-- Migration: Enable audit trail for alunos_cursos links
-- Description: Registra histórico de inserção e remoção de vínculos aluno-curso.

BEGIN;

CREATE TABLE IF NOT EXISTS public.alunos_cursos_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation text NOT NULL CHECK (operation IN ('INSERT', 'DELETE')),
  usuario_id uuid NOT NULL,
  curso_id uuid NOT NULL,
  empresa_id uuid,
  curso_nome text,
  empresa_nome text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alunos_cursos_audit_usuario_changed_at
  ON public.alunos_cursos_audit (usuario_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_alunos_cursos_audit_empresa_changed_at
  ON public.alunos_cursos_audit (empresa_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_alunos_cursos_audit_curso_changed_at
  ON public.alunos_cursos_audit (curso_id, changed_at DESC);

ALTER TABLE public.alunos_cursos_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages alunos_cursos_audit" ON public.alunos_cursos_audit;
CREATE POLICY "Service role manages alunos_cursos_audit"
  ON public.alunos_cursos_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.log_alunos_cursos_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_curso_id uuid;
  v_usuario_id uuid;
  v_empresa_id uuid;
  v_curso_nome text;
  v_empresa_nome text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_curso_id := NEW.curso_id;
    v_usuario_id := NEW.usuario_id;
  ELSIF TG_OP = 'DELETE' THEN
    v_curso_id := OLD.curso_id;
    v_usuario_id := OLD.usuario_id;
  ELSE
    RETURN NULL;
  END IF;

  SELECT
    c.empresa_id,
    c.nome,
    e.nome
  INTO
    v_empresa_id,
    v_curso_nome,
    v_empresa_nome
  FROM public.cursos c
  LEFT JOIN public.empresas e ON e.id = c.empresa_id
  WHERE c.id = v_curso_id;

  INSERT INTO public.alunos_cursos_audit (
    operation,
    usuario_id,
    curso_id,
    empresa_id,
    curso_nome,
    empresa_nome,
    changed_by
  )
  VALUES (
    TG_OP,
    v_usuario_id,
    v_curso_id,
    v_empresa_id,
    v_curso_nome,
    v_empresa_nome,
    (SELECT auth.uid())
  );

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.log_alunos_cursos_audit() IS
  'Audita insercoes e remocoes da tabela alunos_cursos.';

DROP TRIGGER IF EXISTS trg_log_alunos_cursos_audit ON public.alunos_cursos;
CREATE TRIGGER trg_log_alunos_cursos_audit
  AFTER INSERT OR DELETE ON public.alunos_cursos
  FOR EACH ROW
  EXECUTE FUNCTION public.log_alunos_cursos_audit();

-- Snapshot inicial dos vínculos atuais para baseline de auditoria.
INSERT INTO public.alunos_cursos_audit (
  operation,
  usuario_id,
  curso_id,
  empresa_id,
  curso_nome,
  empresa_nome,
  changed_by
)
SELECT
  'INSERT',
  ac.usuario_id,
  ac.curso_id,
  c.empresa_id,
  c.nome,
  e.nome,
  NULL
FROM public.alunos_cursos ac
JOIN public.cursos c ON c.id = ac.curso_id
LEFT JOIN public.empresas e ON e.id = c.empresa_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.alunos_cursos_audit a
  WHERE a.operation = 'INSERT'
    AND a.usuario_id = ac.usuario_id
    AND a.curso_id = ac.curso_id
);

COMMIT;
