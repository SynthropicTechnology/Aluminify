-- Migration: Add disciplina_id, frente_id, modulo_id to banco_questoes and importacao_questoes_jobs
-- Description:
--   Adds optional FK columns for linking questoes to the course structure
--   (disciplina → frente → modulo). The existing TEXT 'disciplina' column
--   is kept for backwards compatibility and free-text values.
--   Also adds disciplina_id and frente_id to importacao_questoes_jobs so the
--   full hierarchy chosen at upload time flows through to published questoes.
-- Date: 2026-05-03

-- banco_questoes
ALTER TABLE public.banco_questoes
  ADD COLUMN IF NOT EXISTS disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frente_id UUID REFERENCES public.frentes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS modulo_id UUID REFERENCES public.modulos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_banco_questoes_disciplina_id
  ON public.banco_questoes(empresa_id, disciplina_id)
  WHERE deleted_at IS NULL AND disciplina_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_banco_questoes_frente_id
  ON public.banco_questoes(frente_id)
  WHERE deleted_at IS NULL AND frente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_banco_questoes_modulo_id
  ON public.banco_questoes(modulo_id)
  WHERE deleted_at IS NULL AND modulo_id IS NOT NULL;

-- importacao_questoes_jobs
ALTER TABLE public.importacao_questoes_jobs
  ADD COLUMN IF NOT EXISTS disciplina_id UUID REFERENCES public.disciplinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS frente_id UUID REFERENCES public.frentes(id) ON DELETE SET NULL;
