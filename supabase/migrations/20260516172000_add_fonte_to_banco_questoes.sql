-- Migration: Add source citation blocks to banco_questoes
-- Description:
--   Stores bibliographic/source citation content separately from texto_base
--   and enunciado, preserving rich ContentBlock JSON.

ALTER TABLE public.banco_questoes
  ADD COLUMN IF NOT EXISTS fonte JSONB;
