-- Add ENEM classification columns to banco_questoes
-- area_conhecimento: one of the 4 ENEM knowledge areas
-- competencias_enem: array of competency codes (e.g. "C1", "C2") scoped to the area
-- habilidades_enem: array of skill codes (e.g. "H1", "H15") scoped to the area

ALTER TABLE banco_questoes
  ADD COLUMN IF NOT EXISTS area_conhecimento TEXT,
  ADD COLUMN IF NOT EXISTS competencias_enem TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS habilidades_enem TEXT[] NOT NULL DEFAULT '{}';

-- GIN indexes for array containment queries
CREATE INDEX IF NOT EXISTS idx_banco_questoes_competencias_enem
  ON banco_questoes USING GIN (competencias_enem);

CREATE INDEX IF NOT EXISTS idx_banco_questoes_habilidades_enem
  ON banco_questoes USING GIN (habilidades_enem);

-- B-tree index for area filtering
CREATE INDEX IF NOT EXISTS idx_banco_questoes_area_conhecimento
  ON banco_questoes (area_conhecimento)
  WHERE area_conhecimento IS NOT NULL;
