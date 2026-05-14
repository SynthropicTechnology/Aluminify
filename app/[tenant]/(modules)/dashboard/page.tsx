import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/app/shared/core/auth'
import { createClient } from '@/app/shared/core/server'

export const metadata: Metadata = {
  title: 'Dashboard'
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ tenant: string }>
}) {
  const user = await requireUser()

  // Se for aluno, carrega o Dashboard de Aluno
  if (user.role === 'aluno') {
    const { default: StudentDashboardClientPage } = await import(
      './components/aluno/student-dashboard'
    )

    return <StudentDashboardClientPage />
  }

  const { tenant } = await params

  // Verificar se precisa completar cadastro da empresa (Lógica existente mantida)
  let shouldRedirectToComplete = false

  if (user.empresaId) {
    try {
      const supabase = await createClient()
      const { data: empresa, error } = await supabase
        .from('empresas')
        .select('cnpj, email_contato, telefone')
        .eq('id', user.empresaId)
        .maybeSingle()

      if (!error && empresa) {
        const cnpjVazio = !empresa.cnpj || empresa.cnpj.trim() === ''
        const emailVazio = !empresa.email_contato || empresa.email_contato.trim() === ''
        const telefoneVazio = !empresa.telefone || empresa.telefone.trim() === ''
        shouldRedirectToComplete = cnpjVazio && emailVazio && telefoneVazio
      }
    } catch (error) {
      console.error('Erro ao verificar empresa:', error)
    }
  }

  if (shouldRedirectToComplete) {
    redirect(`/${tenant}/empresa/completar`)
  }

  // Se é admin da empresa, mostrar dashboard da instituição
  // Caso contrário, mostrar dashboard do professor
  if (user.isAdmin) {
    const { default: InstitutionDashboardClient } = await import(
      './components/institution/institution-dashboard-client'
    )

    return <InstitutionDashboardClient />
  }

  const { default: ProfessorDashboardClient } = await import(
    './components/professor/dashboard-client'
  )

  return <ProfessorDashboardClient />
}
