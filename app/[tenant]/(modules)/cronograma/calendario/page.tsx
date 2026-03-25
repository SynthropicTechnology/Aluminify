import { redirect } from 'next/navigation'
import { createClient } from '@/app/shared/core/server'
import { resolveEmpresaIdFromTenant } from '@/app/shared/core/resolve-empresa-from-tenant'
import { CalendarioStandalonePage } from './calendario-standalone'

export default async function CronogramaCalendarioPage({
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

  const { data: cronogramas } = await supabase
    .from('cronogramas')
    .select('id, nome, data_inicio, data_fim, modalidade_estudo, created_at, curso_alvo_id, cursos(nome)')
    .eq('usuario_id', user.id)
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: false })

  return (
    <CalendarioStandalonePage
      cronogramas={(cronogramas || []).map(c => ({
        id: c.id,
        nome: c.nome,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        modalidade_estudo: c.modalidade_estudo,
        curso_alvo_id: c.curso_alvo_id ?? null,
        curso_nome: (c.cursos as { nome: string } | null)?.nome ?? null,
      }))}
    />
  )
}
