import { redirect } from 'next/navigation'
import { createClient } from '@/app/shared/core/server'
import { resolveEmpresaIdFromTenant } from '@/app/shared/core/resolve-empresa-from-tenant'
import { CronogramaLandingPage } from '../components/cronograma-landing-page'

export default async function CronogramaPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const { tenant } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/${tenant}/auth/login`)

  const empresaId = await resolveEmpresaIdFromTenant(tenant || '')
  if (!empresaId) redirect(`/${tenant}/dashboard`)

  // Fetch all cronogramas for this user with progress counts
  const { data: cronogramas } = await supabase
    .from('cronogramas')
    .select('id, nome, data_inicio, data_fim, modalidade_estudo, created_at, curso_alvo_id, cursos(nome)')
    .eq('usuario_id', user.id)
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  // Get item counts for each cronograma
  const cronogramaIds = (cronogramas || []).map(c => c.id)

  let itemCounts: Record<string, { total: number; done: number }> = {}
  if (cronogramaIds.length > 0) {
    const { data: items } = await supabase
      .from('cronograma_itens')
      .select('cronograma_id, concluido')
      .in('cronograma_id', cronogramaIds)

    if (items) {
      itemCounts = items.reduce((acc, item) => {
        const cid = item.cronograma_id as string
        if (!acc[cid]) acc[cid] = { total: 0, done: 0 }
        acc[cid].total++
        if (item.concluido) acc[cid].done++
        return acc
      }, {} as Record<string, { total: number; done: number }>)
    }
  }

  const cronogramaSummaries = (cronogramas || []).map(c => ({
    id: c.id,
    nome: c.nome,
    data_inicio: c.data_inicio,
    data_fim: c.data_fim,
    modalidade_estudo: c.modalidade_estudo,
    created_at: c.created_at,
    curso_alvo_id: c.curso_alvo_id ?? null,
    curso_nome: (c.cursos as { nome: string } | null)?.nome ?? null,
    total_itens: itemCounts[c.id]?.total ?? 0,
    itens_concluidos: itemCounts[c.id]?.done ?? 0,
  }))

  // Verifica se o aluno está matriculado em algum curso desta empresa
  const { count: matriculasCount } = await supabase
    .from('alunos_cursos')
    .select('curso_id, cursos!inner(empresa_id)', { count: 'exact', head: true })
    .eq('usuario_id', user.id)
    .eq('cursos.empresa_id', empresaId)

  const hasBaseContent = (matriculasCount ?? 0) > 0

  return (
    <CronogramaLandingPage
      cronogramas={cronogramaSummaries}
      hasBaseContent={hasBaseContent}
    />
  )
}
