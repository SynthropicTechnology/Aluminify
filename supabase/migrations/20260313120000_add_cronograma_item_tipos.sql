-- Permite itens de cronograma sem aula (questões/revisão) no modo paralelo

ALTER TABLE public.cronograma_itens
  ADD COLUMN IF NOT EXISTS tipo TEXT,
  ADD COLUMN IF NOT EXISTS frente_id UUID,
  ADD COLUMN IF NOT EXISTS frente_nome_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS mensagem TEXT,
  ADD COLUMN IF NOT EXISTS duracao_sugerida_minutos INTEGER;

UPDATE public.cronograma_itens
SET tipo = 'aula'
WHERE tipo IS NULL;

ALTER TABLE public.cronograma_itens
  ALTER COLUMN tipo SET DEFAULT 'aula',
  ALTER COLUMN tipo SET NOT NULL,
  ALTER COLUMN aula_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_cronograma_itens_frente_id'
  ) THEN
    ALTER TABLE public.cronograma_itens
      ADD CONSTRAINT fk_cronograma_itens_frente_id
      FOREIGN KEY (frente_id)
      REFERENCES public.frentes(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_cronograma_itens_tipo'
  ) THEN
    ALTER TABLE public.cronograma_itens
      ADD CONSTRAINT chk_cronograma_itens_tipo
      CHECK (tipo IN ('aula', 'questoes_revisao'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_cronograma_itens_consistencia_tipo'
  ) THEN
    ALTER TABLE public.cronograma_itens
      ADD CONSTRAINT chk_cronograma_itens_consistencia_tipo
      CHECK (
        (tipo = 'aula' AND aula_id IS NOT NULL)
        OR
        (tipo = 'questoes_revisao' AND aula_id IS NULL AND duracao_sugerida_minutos IS NOT NULL AND duracao_sugerida_minutos > 0)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cronograma_itens_tipo
  ON public.cronograma_itens (cronograma_id, tipo);

CREATE INDEX IF NOT EXISTS idx_cronograma_itens_frente
  ON public.cronograma_itens (frente_id);
