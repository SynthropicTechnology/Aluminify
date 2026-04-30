-- Migration: Create sistema de questoes (banco + listas + respostas + importacao)
-- Description:
--   Tabelas para questoes interativas que substituem PDFs anexados a atividades.
--   Inclui banco de questoes, alternativas, listas/simulados, respostas do aluno
--   (com suporte a multiplas tentativas), e jobs de importacao a partir de Word.
--   RLS via usuarios_empresas (papel_base + is_admin). Convencao alinhada com
--   migrations recentes (ex: papeis simplification em 2026-02-06).
-- Author: Sistema-Questoes (Marco 1)
-- Date: 2026-04-28


-- =============================================
-- 1. ENUMS
-- =============================================

CREATE TYPE public.enum_dificuldade_questao AS ENUM ('facil', 'medio', 'dificil');
CREATE TYPE public.enum_modo_correcao AS ENUM ('por_questao', 'ao_final');
CREATE TYPE public.enum_status_importacao AS ENUM ('processando', 'revisao', 'publicado', 'erro');


-- =============================================
-- 2. TABELAS
-- =============================================

-- 2.1 banco_questoes — entidade central
-- Conteudo (texto_base, enunciado, resolucao_texto) em JSONB como array de
-- ContentBlock { paragraph | image | math } para preservar imagens/formulas
-- intercaladas com fidelidade ao Word original.
CREATE TABLE public.banco_questoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    numero_original INTEGER,
    instituicao TEXT,
    ano INTEGER,
    disciplina TEXT,
    dificuldade public.enum_dificuldade_questao,

    texto_base JSONB,
    enunciado JSONB NOT NULL,
    gabarito TEXT NOT NULL CHECK (gabarito IN ('A','B','C','D','E')),

    resolucao_texto JSONB,
    resolucao_video_url TEXT,

    tags TEXT[] NOT NULL DEFAULT '{}',
    importacao_job_id UUID,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_banco_questoes_empresa
    ON public.banco_questoes(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_banco_questoes_disciplina
    ON public.banco_questoes(empresa_id, disciplina) WHERE deleted_at IS NULL;
CREATE INDEX idx_banco_questoes_instituicao
    ON public.banco_questoes(empresa_id, instituicao) WHERE deleted_at IS NULL;
CREATE INDEX idx_banco_questoes_dificuldade
    ON public.banco_questoes(empresa_id, dificuldade) WHERE deleted_at IS NULL;
CREATE INDEX idx_banco_questoes_importacao
    ON public.banco_questoes(importacao_job_id) WHERE importacao_job_id IS NOT NULL;
CREATE INDEX idx_banco_questoes_tags
    ON public.banco_questoes USING gin(tags);


-- 2.2 banco_questoes_alternativas
-- Letra em minuscula (a-e). Coluna correta e derivada do gabarito da questao
-- na importacao/insercao para facilitar queries sem JOIN.
CREATE TABLE public.banco_questoes_alternativas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    questao_id UUID NOT NULL REFERENCES public.banco_questoes(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

    letra TEXT NOT NULL CHECK (letra IN ('a','b','c','d','e')),
    texto TEXT NOT NULL,
    imagem_path TEXT,
    correta BOOLEAN NOT NULL DEFAULT FALSE,

    ordem INTEGER NOT NULL DEFAULT 0,

    UNIQUE(questao_id, letra)
);

CREATE INDEX idx_alternativas_questao ON public.banco_questoes_alternativas(questao_id);
CREATE INDEX idx_alternativas_empresa ON public.banco_questoes_alternativas(empresa_id);


-- 2.3 listas_exercicios — simulados/listas
-- Vinculo opcional com `atividades` (tabela existente) via atividade_id;
-- quando preenchido, finalizar a lista atualiza progresso_atividades.
CREATE TABLE public.listas_exercicios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    atividade_id UUID REFERENCES public.atividades(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    titulo TEXT NOT NULL,
    descricao TEXT,
    modo_correcao public.enum_modo_correcao NOT NULL DEFAULT 'por_questao',
    embaralhar_questoes BOOLEAN NOT NULL DEFAULT FALSE,
    embaralhar_alternativas BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_listas_empresa
    ON public.listas_exercicios(empresa_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_listas_atividade
    ON public.listas_exercicios(atividade_id) WHERE atividade_id IS NOT NULL;


-- 2.4 listas_exercicios_questoes (relacao N:N ordenada)
CREATE TABLE public.listas_exercicios_questoes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lista_id UUID NOT NULL REFERENCES public.listas_exercicios(id) ON DELETE CASCADE,
    questao_id UUID NOT NULL REFERENCES public.banco_questoes(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,

    ordem INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(lista_id, questao_id)
);

CREATE INDEX idx_lista_questoes_lista_ordem
    ON public.listas_exercicios_questoes(lista_id, ordem);
CREATE INDEX idx_lista_questoes_questao
    ON public.listas_exercicios_questoes(questao_id);


-- 2.5 respostas_aluno
-- tentativa: 1-based. Refazer a lista cria respostas com tentativa = max+1
-- preservando o historico — UNIQUE(usuario_id, lista_id, questao_id, tentativa).
-- empresa_id NOT NULL (opcao explicita: progresso_atividades teve NULL como
-- divida historica, nao replicar).
CREATE TABLE public.respostas_aluno (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lista_id UUID NOT NULL REFERENCES public.listas_exercicios(id) ON DELETE CASCADE,
    questao_id UUID NOT NULL REFERENCES public.banco_questoes(id) ON DELETE CASCADE,

    tentativa INTEGER NOT NULL DEFAULT 1 CHECK (tentativa >= 1),
    alternativa_escolhida TEXT NOT NULL CHECK (alternativa_escolhida IN ('a','b','c','d','e')),
    correta BOOLEAN NOT NULL,
    tempo_resposta_segundos INTEGER CHECK (tempo_resposta_segundos IS NULL OR tempo_resposta_segundos >= 0),
    alternativas_riscadas TEXT[] NOT NULL DEFAULT '{}',

    respondida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(usuario_id, lista_id, questao_id, tentativa)
);

CREATE INDEX idx_respostas_usuario_lista
    ON public.respostas_aluno(usuario_id, lista_id, tentativa);
CREATE INDEX idx_respostas_questao ON public.respostas_aluno(questao_id);
CREATE INDEX idx_respostas_empresa ON public.respostas_aluno(empresa_id);


-- 2.6 importacao_questoes_jobs
-- modulo_id (nullable): quando preenchido, /publicar cria automaticamente
-- uma atividade do tipo configuravel (default 'Lista_Mista') vinculada ao modulo.
CREATE TABLE public.importacao_questoes_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    original_filename TEXT NOT NULL,
    original_storage_path TEXT NOT NULL,
    status public.enum_status_importacao NOT NULL DEFAULT 'processando',

    questoes_extraidas INTEGER NOT NULL DEFAULT 0,
    questoes_json JSONB,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    error_message TEXT,

    disciplina TEXT,
    modulo_id UUID REFERENCES public.modulos(id) ON DELETE SET NULL,
    lista_id UUID REFERENCES public.listas_exercicios(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_importacao_empresa ON public.importacao_questoes_jobs(empresa_id);
CREATE INDEX idx_importacao_status ON public.importacao_questoes_jobs(empresa_id, status);
CREATE INDEX idx_importacao_modulo
    ON public.importacao_questoes_jobs(modulo_id) WHERE modulo_id IS NOT NULL;


-- 2.7 FK retroativa banco_questoes.importacao_job_id → importacao_questoes_jobs.id
-- Definida apos a criacao do job (referencia circular nao-ciclica entre tabelas).
ALTER TABLE public.banco_questoes
    ADD CONSTRAINT banco_questoes_importacao_job_fk
    FOREIGN KEY (importacao_job_id)
    REFERENCES public.importacao_questoes_jobs(id)
    ON DELETE SET NULL;


-- =============================================
-- 3. TRIGGERS DE updated_at
-- =============================================
-- Reusa a funcao public.handle_updated_at() existente
-- (criada em 20250119_create_handle_updated_at_function.sql)

CREATE TRIGGER handle_updated_at_banco_questoes
    BEFORE UPDATE ON public.banco_questoes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_listas_exercicios
    BEFORE UPDATE ON public.listas_exercicios
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_importacao_questoes_jobs
    BEFORE UPDATE ON public.importacao_questoes_jobs
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- (alternativas, listas_questoes e respostas_aluno nao tem updated_at por design:
--  alternativas sao recriadas junto com a questao; listas_questoes apenas reordenam;
--  respostas sao append-only com nova tentativa em vez de update.)


-- =============================================
-- 4. RLS
-- =============================================

ALTER TABLE public.banco_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_questoes_alternativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas_exercicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listas_exercicios_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respostas_aluno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacao_questoes_jobs ENABLE ROW LEVEL SECURITY;


-- 4.1 banco_questoes — leitura para qualquer membro ativo da empresa;
-- escrita restrita a professor/usuario/admin; UPDATE/DELETE: criador ou admin.

CREATE POLICY "banco_questoes_select" ON public.banco_questoes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = banco_questoes.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );

CREATE POLICY "banco_questoes_insert" ON public.banco_questoes
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = banco_questoes.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (ue.papel_base IN ('professor','usuario') OR ue.is_admin = true)
        )
    );

CREATE POLICY "banco_questoes_update" ON public.banco_questoes
    FOR UPDATE TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = banco_questoes.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    )
    WITH CHECK (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = banco_questoes.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );

CREATE POLICY "banco_questoes_delete" ON public.banco_questoes
    FOR DELETE TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = banco_questoes.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );


-- 4.2 banco_questoes_alternativas — espelha a questao via JOIN

CREATE POLICY "alternativas_select" ON public.banco_questoes_alternativas
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = banco_questoes_alternativas.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );

CREATE POLICY "alternativas_insert" ON public.banco_questoes_alternativas
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = banco_questoes_alternativas.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (ue.papel_base IN ('professor','usuario') OR ue.is_admin = true)
        )
    );

CREATE POLICY "alternativas_update" ON public.banco_questoes_alternativas
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.banco_questoes q
            JOIN public.usuarios_empresas ue ON ue.empresa_id = q.empresa_id
            WHERE q.id = banco_questoes_alternativas.questao_id
            AND ue.usuario_id = (SELECT auth.uid())
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (q.created_by = (SELECT auth.uid()) OR ue.is_admin = true)
        )
    );

CREATE POLICY "alternativas_delete" ON public.banco_questoes_alternativas
    FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.banco_questoes q
            JOIN public.usuarios_empresas ue ON ue.empresa_id = q.empresa_id
            WHERE q.id = banco_questoes_alternativas.questao_id
            AND ue.usuario_id = (SELECT auth.uid())
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (q.created_by = (SELECT auth.uid()) OR ue.is_admin = true)
        )
    );


-- 4.3 listas_exercicios

CREATE POLICY "listas_select" ON public.listas_exercicios
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = listas_exercicios.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );

CREATE POLICY "listas_insert" ON public.listas_exercicios
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = listas_exercicios.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (ue.papel_base IN ('professor','usuario') OR ue.is_admin = true)
        )
    );

CREATE POLICY "listas_update" ON public.listas_exercicios
    FOR UPDATE TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = listas_exercicios.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    )
    WITH CHECK (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = listas_exercicios.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );

CREATE POLICY "listas_delete" ON public.listas_exercicios
    FOR DELETE TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = listas_exercicios.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );


-- 4.4 listas_exercicios_questoes — gerenciamento (insert/update/delete) restrito
-- ao criador da lista ou admin; leitura para todos da empresa.

CREATE POLICY "lista_questoes_select" ON public.listas_exercicios_questoes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = listas_exercicios_questoes.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );

CREATE POLICY "lista_questoes_modify" ON public.listas_exercicios_questoes
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.listas_exercicios l
            JOIN public.usuarios_empresas ue ON ue.empresa_id = l.empresa_id
            WHERE l.id = listas_exercicios_questoes.lista_id
            AND ue.usuario_id = (SELECT auth.uid())
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (l.created_by = (SELECT auth.uid()) OR ue.is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.listas_exercicios l
            JOIN public.usuarios_empresas ue ON ue.empresa_id = l.empresa_id
            WHERE l.id = listas_exercicios_questoes.lista_id
            AND ue.usuario_id = (SELECT auth.uid())
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (l.created_by = (SELECT auth.uid()) OR ue.is_admin = true)
        )
    );


-- 4.5 respostas_aluno
-- Aluno: SELECT/INSERT apenas das proprias respostas (usuario_id = auth.uid()).
-- Staff (professor/usuario/admin) ativo da empresa: SELECT de qualquer resposta
-- da empresa para metricas e revisao. Sem UPDATE/DELETE — append-only.

CREATE POLICY "respostas_select_propria" ON public.respostas_aluno
    FOR SELECT TO authenticated
    USING (usuario_id = (SELECT auth.uid()));

CREATE POLICY "respostas_select_staff" ON public.respostas_aluno
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = respostas_aluno.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (ue.papel_base IN ('professor','usuario') OR ue.is_admin = true)
        )
    );

CREATE POLICY "respostas_insert" ON public.respostas_aluno
    FOR INSERT TO authenticated
    WITH CHECK (
        usuario_id = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = respostas_aluno.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );


-- 4.6 importacao_questoes_jobs — restrito a staff da empresa

CREATE POLICY "importacao_select" ON public.importacao_questoes_jobs
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = importacao_questoes_jobs.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (ue.papel_base IN ('professor','usuario') OR ue.is_admin = true)
        )
    );

CREATE POLICY "importacao_insert" ON public.importacao_questoes_jobs
    FOR INSERT TO authenticated
    WITH CHECK (
        created_by = (SELECT auth.uid())
        AND EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = importacao_questoes_jobs.empresa_id
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
            AND (ue.papel_base IN ('professor','usuario') OR ue.is_admin = true)
        )
    );

CREATE POLICY "importacao_update" ON public.importacao_questoes_jobs
    FOR UPDATE TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = importacao_questoes_jobs.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    )
    WITH CHECK (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = importacao_questoes_jobs.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );

CREATE POLICY "importacao_delete" ON public.importacao_questoes_jobs
    FOR DELETE TO authenticated
    USING (
        created_by = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.usuarios_empresas ue
            WHERE ue.usuario_id = (SELECT auth.uid())
            AND ue.empresa_id = importacao_questoes_jobs.empresa_id
            AND ue.is_admin = true
            AND ue.ativo = true
            AND ue.deleted_at IS NULL
        )
    );


-- =============================================
-- 5. COMENTARIOS
-- =============================================

COMMENT ON TABLE public.banco_questoes IS
    'Banco central de questoes interativas. Conteudo (texto_base, enunciado, resolucao_texto) em JSONB como array de ContentBlock para preservar imagens/formulas intercaladas.';
COMMENT ON COLUMN public.banco_questoes.texto_base IS
    'Array de ContentBlock para contextualizacao antes do enunciado (pode ser null).';
COMMENT ON COLUMN public.banco_questoes.enunciado IS
    'Array de ContentBlock com a pergunta propriamente dita.';
COMMENT ON COLUMN public.banco_questoes.gabarito IS
    'Letra da alternativa correta (A-E maiuscula).';
COMMENT ON COLUMN public.banco_questoes.dificuldade IS
    'Dificuldade da questao. Parser mapeia: Omega -> facil, Omega-Omega -> medio, Omega-Omega-Omega -> dificil.';

COMMENT ON TABLE public.respostas_aluno IS
    'Resposta individual do aluno a uma questao dentro de uma lista. Append-only: refazer a lista cria respostas com tentativa = max+1, preservando historico.';
COMMENT ON COLUMN public.respostas_aluno.tentativa IS
    'Numero da tentativa (1-based). UNIQUE com (usuario_id, lista_id, questao_id).';
COMMENT ON COLUMN public.respostas_aluno.alternativas_riscadas IS
    'Letras que o aluno riscou antes de responder (ferramenta de eliminacao).';

COMMENT ON TABLE public.importacao_questoes_jobs IS
    'Job de importacao de Word. Persiste o resultado do parse em questoes_json para revisao antes de publicar; status governa a transicao processando -> revisao -> publicado.';
COMMENT ON COLUMN public.importacao_questoes_jobs.questoes_json IS
    'Resultado do parser (array de QuestaoParseada). Editavel via PATCH antes de /publicar.';
COMMENT ON COLUMN public.importacao_questoes_jobs.warnings IS
    'Array de warnings emitidos pelo parser (ex: formula OMML que nao converteu para LaTeX).';
