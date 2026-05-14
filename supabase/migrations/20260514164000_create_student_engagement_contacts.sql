-- Migration: Create student engagement contact history
-- Description:
--   Stores manual outreach attempts made from the institutional dashboard.
--   This enables recovery metrics after administrators contact non-engaged students.

BEGIN;

CREATE TABLE IF NOT EXISTS public.student_engagement_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    admin_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
    channel text NOT NULL CHECK (channel IN ('whatsapp', 'email', 'phone', 'manual')),
    reason text NOT NULL CHECK (
        reason IN (
            'sem_acesso',
            'acessou_sem_estudo',
            'sem_cronograma',
            'baixo_engajamento',
            'sem_conclusao'
        )
    ),
    message_template text,
    notes text,
    contacted_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_engagement_contacts_empresa_contacted
    ON public.student_engagement_contacts (empresa_id, contacted_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_engagement_contacts_student_contacted
    ON public.student_engagement_contacts (student_id, contacted_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_engagement_contacts_admin_contacted
    ON public.student_engagement_contacts (admin_id, contacted_at DESC);

ALTER TABLE public.student_engagement_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can view engagement contacts" ON public.student_engagement_contacts;
CREATE POLICY "Tenant admins can view engagement contacts"
    ON public.student_engagement_contacts
    FOR SELECT
    TO authenticated
    USING (
        public.is_empresa_admin((SELECT auth.uid()), student_engagement_contacts.empresa_id)
    );

DROP POLICY IF EXISTS "Tenant admins can insert engagement contacts" ON public.student_engagement_contacts;
CREATE POLICY "Tenant admins can insert engagement contacts"
    ON public.student_engagement_contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        admin_id = (SELECT auth.uid())
        AND public.is_empresa_admin((SELECT auth.uid()), student_engagement_contacts.empresa_id)
    );

COMMENT ON TABLE public.student_engagement_contacts IS
    'Histórico de contatos feitos por administradores para recuperar engajamento de alunos.';

COMMIT;
