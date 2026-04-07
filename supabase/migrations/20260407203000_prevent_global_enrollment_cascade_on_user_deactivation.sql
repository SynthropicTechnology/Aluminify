-- Migration: Prevent global enrollment cascade on user deactivation
-- Description: Stops automatic DELETE in alunos_cursos/alunos_turmas when usuarios is deactivated.

BEGIN;

CREATE OR REPLACE FUNCTION public.cascade_usuario_deactivation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Legacy behavior removed:
  -- when usuarios.ativo/deleted_at changed, this function deleted all enrollments
  -- across tenants from alunos_cursos and alunos_turmas.
  --
  -- In multi-tenant context, user status updates may be tenant-scoped at application
  -- level and must not wipe global course links.
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.cascade_usuario_deactivation() IS
  'No-op trigger function. Prevents global enrollment deletion on usuarios deactivation.';

COMMIT;
