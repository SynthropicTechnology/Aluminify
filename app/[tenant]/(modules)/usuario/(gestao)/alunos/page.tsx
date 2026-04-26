import type { Metadata } from 'next'
import { createClient } from '@/app/shared/core/server'
import { createStudentService } from '@/app/[tenant]/(modules)/usuario/services/student.service'
import { createCursoService } from '@/app/[tenant]/(modules)/curso/services'
import { AlunosClientPage } from './components/client-page'
import { requireTenantUser } from '@/app/shared/core/tenant'

export const metadata: Metadata = {
  title: 'Alunos'
}

export default async function AlunosPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>
  searchParams: Promise<{
    page?: string
    query?: string
    courseId?: string
    turmaId?: string
    status?: string
    cronograma?: string
  }>
}) {
  const { tenant } = await params
  // Valida que o usuário pertence ao tenant da URL
  const { tenantId } = await requireTenantUser(tenant, { allowedRoles: ['usuario'] })

  const { page: pageStr, query: queryStr, courseId: courseIdStr, turmaId: turmaIdStr, status: statusStr, cronograma: cronogramaStr } =
    await searchParams

  const page = Number(pageStr) || 1
  const query = queryStr || ''
  const courseId = courseIdStr || undefined
  const turmaId = turmaIdStr || undefined
  const status = (statusStr === 'active' || statusStr === 'inactive') ? statusStr : undefined
  const cronograma = (cronogramaStr === 'yes' || cronogramaStr === 'no') ? cronogramaStr : undefined

  // Usar cliente com contexto do usuário para respeitar RLS
  const supabase = await createClient()
  const studentService = createStudentService(supabase)
  const cursoService = createCursoService(supabase)

  const [studentsResult, coursesResult, allStudentsMetaResult] = await Promise.all([
    studentService.list({ page, perPage: 10, query, courseId, turmaId, status, cronograma, empresaId: tenantId }),
    cursoService.list({ perPage: 100, sortBy: 'name', sortOrder: 'asc' }, tenantId),
    // Para mostrar o total geral no topo (independente de filtros)
    studentService.list({ page: 1, perPage: 1, empresaId: tenantId }),
  ])

  const { data: students, meta } = studentsResult
  const { data: courses } = coursesResult
  const totalAll = allStudentsMetaResult.meta?.total ?? 0
  const studentIds = students.map((student) => student.id)
  const { data: cronogramasRows } = studentIds.length > 0
    ? await supabase
      .from('cronogramas')
      .select('usuario_id')
      .eq('empresa_id', tenantId)
      .in('usuario_id', studentIds)
    : { data: [] }

  const cronogramaStatusByStudentId = Object.fromEntries(
    (cronogramasRows ?? [])
      .map((row) => row.usuario_id)
      .filter((id): id is string => Boolean(id))
      .map((id) => [id, true])
  )

  // Map courses to lighter object with usaTurmas info
  const coursesSimple = courses.map(c => ({ id: c.id, name: c.name, usaTurmas: c.usaTurmas ?? false }))

  return (
    <AlunosClientPage
      students={students}
      meta={meta}
      courses={coursesSimple}
      totalAll={totalAll}
      cronogramaStatusByStudentId={cronogramaStatusByStudentId}
    />
  )
}
