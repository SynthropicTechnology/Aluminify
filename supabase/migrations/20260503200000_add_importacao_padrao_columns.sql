-- Migration: Add default metadata columns to importacao_questoes_jobs
-- Description:
--   Adds columns for storing user-selected defaults during upload:
--   instituicao_padrao, ano_padrao, dificuldade_padrao, tags_padrao.
--   These defaults flow through to all imported questions when publishing.
-- Date: 2026-05-03

ALTER TABLE public.importacao_questoes_jobs
  ADD COLUMN IF NOT EXISTS instituicao_padrao TEXT,
  ADD COLUMN IF NOT EXISTS ano_padrao INTEGER,
  ADD COLUMN IF NOT EXISTS dificuldade_padrao public.enum_dificuldade_questao,
  ADD COLUMN IF NOT EXISTS tags_padrao TEXT[] NOT NULL DEFAULT '{}';
