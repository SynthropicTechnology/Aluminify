-- Add lista_id and tentativa to sessoes_estudo for tracking study sessions
-- during question list resolution (pause/resume support)

ALTER TABLE public.sessoes_estudo
  ADD COLUMN IF NOT EXISTS lista_id UUID REFERENCES public.listas_exercicios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tentativa INTEGER;

CREATE INDEX IF NOT EXISTS idx_sessoes_estudo_lista_tentativa
  ON public.sessoes_estudo(usuario_id, lista_id, tentativa)
  WHERE lista_id IS NOT NULL;
