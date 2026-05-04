-- Add question identification code system
-- Format: {PREFIXO}{00001} e.g. CDF00001, TN00002

-- 1. Add codigo_prefixo to empresas (auto-generated from slug, editable by admin)
ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS codigo_prefixo TEXT;

-- 2. Add codigo to banco_questoes (unique per tenant, auto-generated)
ALTER TABLE banco_questoes
  ADD COLUMN IF NOT EXISTS codigo TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_banco_questoes_codigo
  ON banco_questoes (empresa_id, codigo)
  WHERE deleted_at IS NULL;

-- 3. Function to generate prefix from slug
--    "cdf" → "CDF", "terra-negra" → "TN", "jana-rabelo" → "JR"
--    Takes first letter of each word (split by -), uppercased, max 5 chars
CREATE OR REPLACE FUNCTION generate_codigo_prefixo(slug TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  parts TEXT[];
  prefix TEXT := '';
  i INT;
BEGIN
  IF slug IS NULL OR slug = '' THEN
    RETURN 'Q';
  END IF;

  parts := string_to_array(slug, '-');

  IF array_length(parts, 1) = 1 THEN
    -- Single word: take up to 3 first characters uppercased
    prefix := UPPER(LEFT(slug, 3));
  ELSE
    -- Multiple words: take first letter of each word
    FOR i IN 1..array_length(parts, 1) LOOP
      prefix := prefix || UPPER(LEFT(parts[i], 1));
    END LOOP;
  END IF;

  -- Ensure at least 1 char, max 5
  IF prefix = '' THEN prefix := 'Q'; END IF;
  RETURN LEFT(prefix, 5);
END;
$$;

-- 4. Backfill existing empresas that don't have a prefix yet
UPDATE empresas
SET codigo_prefixo = generate_codigo_prefixo(slug)
WHERE codigo_prefixo IS NULL;

-- 5. Trigger: auto-set codigo_prefixo on empresa insert if not provided
CREATE OR REPLACE FUNCTION trg_empresas_set_codigo_prefixo()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.codigo_prefixo IS NULL OR NEW.codigo_prefixo = '' THEN
    NEW.codigo_prefixo := generate_codigo_prefixo(NEW.slug);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresas_set_codigo_prefixo ON empresas;
CREATE TRIGGER trg_empresas_set_codigo_prefixo
  BEFORE INSERT ON empresas
  FOR EACH ROW
  EXECUTE FUNCTION trg_empresas_set_codigo_prefixo();

-- 6. Function to generate next questao codigo for a given empresa
CREATE OR REPLACE FUNCTION generate_next_questao_codigo(p_empresa_id UUID)
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_prefixo TEXT;
  v_max_seq INT;
  v_next_seq INT;
BEGIN
  SELECT codigo_prefixo INTO v_prefixo
  FROM empresas
  WHERE id = p_empresa_id;

  IF v_prefixo IS NULL THEN
    v_prefixo := 'Q';
  END IF;

  -- Find the highest existing sequence number for this empresa
  SELECT COALESCE(MAX(
    CASE
      WHEN codigo ~ ('^' || v_prefixo || '[0-9]+$')
      THEN CAST(SUBSTRING(codigo FROM LENGTH(v_prefixo) + 1) AS INT)
      ELSE 0
    END
  ), 0)
  INTO v_max_seq
  FROM banco_questoes
  WHERE empresa_id = p_empresa_id
    AND codigo IS NOT NULL;

  v_next_seq := v_max_seq + 1;

  RETURN v_prefixo || LPAD(v_next_seq::TEXT, 5, '0');
END;
$$;

-- 7. Trigger: auto-set codigo on banco_questoes insert
CREATE OR REPLACE FUNCTION trg_banco_questoes_set_codigo()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
    NEW.codigo := generate_next_questao_codigo(NEW.empresa_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_banco_questoes_set_codigo ON banco_questoes;
CREATE TRIGGER trg_banco_questoes_set_codigo
  BEFORE INSERT ON banco_questoes
  FOR EACH ROW
  EXECUTE FUNCTION trg_banco_questoes_set_codigo();

-- 8. Backfill existing questoes that don't have a codigo
DO $$
DECLARE
  r RECORD;
  v_codigo TEXT;
BEGIN
  FOR r IN
    SELECT id, empresa_id
    FROM banco_questoes
    WHERE codigo IS NULL
    ORDER BY created_at ASC, id ASC
  LOOP
    v_codigo := generate_next_questao_codigo(r.empresa_id);
    UPDATE banco_questoes SET codigo = v_codigo WHERE id = r.id;
  END LOOP;
END;
$$;
