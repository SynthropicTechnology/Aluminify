import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/app/shared/core/server'
import { UsuarioRepositoryImpl } from '@/app/[tenant]/(modules)/usuario/services'
import { EquipeClientPage } from './components/client-page'
import { requireUser } from '@/app/shared/core/auth'

export const metadata: Metadata = {
  title: 'Equipe'
}

interface PageProps {
  searchParams: Promise<{ papelTipo?: string }>
}

export default async function EquipePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const user = await requireUser()

  if (!user.empresaId) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const usuarioRepository = new UsuarioRepositoryImpl(supabase)

  // Verificar se o usuário atual é admin (buscando no vínculo direto)
  const { data: vinculo } = await supabase
    .from("usuarios_empresas")
    .select("is_admin")
    .eq("usuario_id", user.id)
    .eq("empresa_id", user.empresaId)
    .maybeSingle()

  const currentUserIsAdmin = vinculo?.is_admin || false

  const papelTipoFilter = resolvedSearchParams.papelTipo || undefined

  const usuarios = await usuarioRepository.listSummaryByEmpresa(user.empresaId, true)

  return (
    <EquipeClientPage
      usuarios={usuarios}
      initialFilter={papelTipoFilter}
      currentUserIsAdmin={currentUserIsAdmin}
    />
  )
}
