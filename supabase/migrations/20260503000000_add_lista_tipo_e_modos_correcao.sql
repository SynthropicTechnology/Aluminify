-- Migration: Add tipo and modos_correcao_permitidos to listas_exercicios
-- Description:
--   1. Creates enum_tipo_lista ('exercicio', 'simulado', 'outro')
--   2. Adds tipo column (default 'exercicio')
--   3. Adds modos_correcao_permitidos ('por_questao', 'ao_final', 'ambos')
--      replacing the previous modo_correcao column.
--      Existing 'por_questao' rows keep 'por_questao', 'ao_final' keep 'ao_final'.
--   4. Drops old modo_correcao column and enum after migration.
-- Author: Sistema-Questoes
-- Date: 2026-05-03

-- 1. New enums
CREATE TYPE public.enum_tipo_lista AS ENUM ('exercicio', 'simulado', 'outro');
CREATE TYPE public.enum_modos_correcao AS ENUM ('por_questao', 'ao_final', 'ambos');

-- 2. Add new columns
ALTER TABLE public.listas_exercicios
    ADD COLUMN tipo public.enum_tipo_lista NOT NULL DEFAULT 'exercicio',
    ADD COLUMN modos_correcao_permitidos public.enum_modos_correcao NOT NULL DEFAULT 'por_questao';

-- 3. Migrate existing data from modo_correcao to modos_correcao_permitidos
UPDATE public.listas_exercicios
SET modos_correcao_permitidos = CASE
    WHEN modo_correcao = 'ao_final' THEN 'ao_final'::public.enum_modos_correcao
    ELSE 'por_questao'::public.enum_modos_correcao
END;

-- 4. Drop old column and enum
ALTER TABLE public.listas_exercicios DROP COLUMN modo_correcao;
DROP TYPE public.enum_modo_correcao;
