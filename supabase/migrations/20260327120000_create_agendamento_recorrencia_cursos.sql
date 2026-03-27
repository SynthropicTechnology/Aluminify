-- Migration: Create agendamento_recorrencia_cursos table
-- Description: Vincula regras de recorrência a cursos para permitir restrição
-- por curso mesmo quando o curso não usa turmas.

create table if not exists public.agendamento_recorrencia_cursos (
    id uuid default gen_random_uuid() primary key,
    recorrencia_id uuid not null references public.agendamento_recorrencia(id) on delete cascade,
    curso_id uuid not null references public.cursos(id) on delete cascade,
    empresa_id uuid not null references public.empresas(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    constraint unique_recorrencia_curso unique (recorrencia_id, curso_id)
);

comment on table public.agendamento_recorrencia_cursos is 'Tabela associativa que vincula regras de recorrência a cursos. Se a recorrência não tiver turmas vinculadas e tiver cursos vinculados, apenas alunos matriculados nesses cursos podem ver e agendar os slots.';

alter table public.agendamento_recorrencia_cursos enable row level security;

create policy "Professores veem cursos de suas recorrencias"
    on public.agendamento_recorrencia_cursos
    for select
    to authenticated
    using (
        empresa_id = public.get_user_empresa_id()
    );

create policy "Professores podem vincular cursos as suas recorrencias"
    on public.agendamento_recorrencia_cursos
    for insert
    to authenticated
    with check (
        empresa_id = public.get_user_empresa_id()
        and exists (
            select 1 from public.agendamento_recorrencia ar
            where ar.id = recorrencia_id
            and ar.professor_id = (select auth.uid())
        )
    );

create policy "Professores podem desvincular cursos de suas recorrencias"
    on public.agendamento_recorrencia_cursos
    for delete
    to authenticated
    using (
        empresa_id = public.get_user_empresa_id()
        and exists (
            select 1 from public.agendamento_recorrencia ar
            where ar.id = recorrencia_id
            and ar.professor_id = (select auth.uid())
        )
    );

create index if not exists idx_recorrencia_cursos_recorrencia_id
    on public.agendamento_recorrencia_cursos(recorrencia_id);

create index if not exists idx_recorrencia_cursos_curso_id
    on public.agendamento_recorrencia_cursos(curso_id);

create index if not exists idx_recorrencia_cursos_empresa_id
    on public.agendamento_recorrencia_cursos(empresa_id);
