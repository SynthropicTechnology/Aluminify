'use client'

import * as React from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Users, Calendar, BookOpen, Search, Eye, ChevronDown, Settings } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/app/shared/components/forms/input'
import { Checkbox } from '@/app/shared/components/forms/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/shared/components/dataviz/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/shared/components/overlay/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/shared/components/ui/tabs'
import { TableSkeleton } from '@/app/shared/components/ui/table-skeleton'
import { apiClient } from '@/shared/library/api-client'
import { BulkActionsBar } from '@/app/[tenant]/(modules)/usuario/components/bulk-actions-bar'
import { TransferStudentsDialog } from '@/app/[tenant]/(modules)/usuario/components/transfer-students-dialog'
import type { CourseOption, Aluno } from '@/app/[tenant]/(modules)/usuario/components/aluno-table'
import { TurmasList } from './components/turmas-list'
import { CourseModulesPanel } from './components/course-modules-panel'
import { CourseQuotaPanel } from './components/course-quota-panel'

interface Student {
  id: string
  name: string
  email: string
  phone: string | null
  city: string | null
  state: string | null
}

interface Enrollment {
  id: string
  enrollmentDate: string
  startDate: string
  endDate: string
  active: boolean
  student: Student | null
}

interface CourseData {
  id: string
  name: string
  modality: string
  type: string
  year: number
  usaTurmas?: boolean
}

interface EnrollmentsResponse {
  data: {
    course: CourseData
    enrollments: Enrollment[]
    total: number
  }
}

export default function CourseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseId = params.id as string
  const tenant = params?.tenant as string
  const defaultTab = searchParams.get('tab') === 'config' ? 'config' : 'alunos'

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [course, setCourse] = React.useState<CourseData | null>(null)
  const [enrollments, setEnrollments] = React.useState<Enrollment[]>([])
  const [searchTerm, setSearchTerm] = React.useState('')
  const [courseOptions, setCourseOptions] = React.useState<CourseOption[]>([])

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [transferDialogOpen, setTransferDialogOpen] = React.useState(false)

  React.useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [enrollmentsResponse, coursesResponse] = await Promise.all([
          apiClient.get<EnrollmentsResponse>(`/api/curso/${courseId}/enrollments`),
          apiClient.get<{ data: { id: string; name: string }[] }>('/api/curso'),
        ])
        if (enrollmentsResponse?.data) {
          setCourse(enrollmentsResponse.data.course)
          setEnrollments(enrollmentsResponse.data.enrollments)
        }
        if (coursesResponse?.data) {
          setCourseOptions(coursesResponse.data.map((c) => ({ id: c.id, name: c.name })))
        }
      } catch (err) {
        console.error('Error fetching course enrollments:', err)
        setError('Erro ao carregar dados do curso')
      } finally {
        setLoading(false)
      }
    }

    if (courseId) {
      fetchData()
    }
  }, [courseId])

  const filteredEnrollments = React.useMemo(() => {
    if (!searchTerm) return enrollments
    const term = searchTerm.toLowerCase()
    return enrollments.filter((e) => {
      const student = e.student
      if (!student) return false
      return (
        student.name?.toLowerCase().includes(term) ||
        student.email?.toLowerCase().includes(term) ||
        student.city?.toLowerCase().includes(term)
      )
    })
  }, [enrollments, searchTerm])

  const activeCount = enrollments.filter((e) => e.active).length
  const inactiveCount = enrollments.filter((e) => !e.active).length

  // Convert enrollments to Aluno format for TransferStudentsDialog
  const selectedStudents: Aluno[] = React.useMemo(() => {
    return filteredEnrollments
      .filter((e) => e.student && selectedIds.has(e.student.id))
      .map((e) => ({
        id: e.student!.id,
        fullName: e.student!.name,
        email: e.student!.email,
        cpf: null,
        phone: e.student!.phone,
        birthDate: null,
        address: null,
        zipCode: null,
        enrollmentNumber: null,
        instagram: null,
        twitter: null,
        courses: course ? [{ id: course.id, name: course.name }] : [],
        mustChangePassword: false,
        temporaryPassword: null,
        createdAt: '',
        updatedAt: '',
      }))
  }, [filteredEnrollments, selectedIds, course])

  // Selection helpers
  const allStudentIds = React.useMemo(() => {
    return filteredEnrollments
      .filter((e) => e.student)
      .map((e) => e.student!.id)
  }, [filteredEnrollments])

  const isAllSelected = allStudentIds.length > 0 && allStudentIds.every((id) => selectedIds.has(id))
  const isSomeSelected = allStudentIds.some((id) => selectedIds.has(id)) && !isAllSelected

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(allStudentIds))
    }
  }

  const toggleSelect = (studentId: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(studentId)) {
      newSet.delete(studentId)
    } else {
      newSet.add(studentId)
    }
    setSelectedIds(newSet)
  }

  const selectN = (n: number) => {
    const ids = allStudentIds.slice(0, n)
    setSelectedIds(new Set(ids))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const handleTransferComplete = () => {
    clearSelection()
    // Refresh data
    if (courseId) {
      setLoading(true)
      apiClient.get<EnrollmentsResponse>(`/api/curso/${courseId}/enrollments`)
        .then((response) => {
          if (response?.data) {
            setCourse(response.data.course)
            setEnrollments(response.data.enrollments)
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8 px-4 pb-10 sm:px-6 lg:px-8">
        <div className="animate-pulse">
          <div className="h-8 w-64 bg-muted rounded mb-2" />
          <div className="h-4 w-96 bg-muted rounded" />
        </div>
        <TableSkeleton rows={5} columns={6} />
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="flex flex-col items-center justify-center min-h-100 gap-4">
        <p className="text-destructive">{error || 'Curso não encontrado'}</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-6 px-4 pb-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-border pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para cursos
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h1 className="page-title">{course.name}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{course.modality}</Badge>
                <Badge variant="outline">{course.type}</Badge>
                <Badge variant="secondary">{course.year}</Badge>
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="alunos">
              <Users className="h-4 w-4" />
              Alunos
            </TabsTrigger>
            <TabsTrigger value="config">
              <Settings className="h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          {/* Tab: Alunos */}
          <TabsContent value="alunos" className="flex flex-col gap-6">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border/40 bg-card/80 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500/15 to-indigo-500/15 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="metric-value">{enrollments.length}</p>
                    <p className="text-sm text-muted-foreground">Total de alunos</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/80 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500/15 to-green-500/15 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="metric-value">{activeCount}</p>
                    <p className="text-sm text-muted-foreground">Matrículas ativas</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-card/80 p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-linear-to-br from-amber-500/15 to-orange-500/15 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="metric-value">{inactiveCount}</p>
                    <p className="text-sm text-muted-foreground">Matrículas inativas</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Turmas Section - Only shown when usaTurmas is enabled */}
            {course.usaTurmas && (
              <TurmasList cursoId={courseId} cursoNome={course.name} />
            )}

            {/* Search and Selection */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
                <Input
                  type="text"
                  placeholder="Buscar aluno por nome, email ou cidade..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-10">
                    Selecionar
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => selectN(10)}>
                    10 primeiros
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectN(20)}>
                    20 primeiros
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => selectN(30)}>
                    30 primeiros
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedIds(new Set(allStudentIds))}>
                    Selecionar todos ({allStudentIds.length})
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={clearSelection}>
                    Limpar seleção
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Students Table */}
            {filteredEnrollments.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-75 border border-border/40 rounded-xl bg-muted/30">
                <Users className="w-12 h-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">
                  {searchTerm ? 'Nenhum aluno encontrado' : 'Nenhum aluno matriculado'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchTerm
                    ? 'Tente ajustar os termos de busca'
                    : 'Este curso ainda não possui alunos matriculados'}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="block md:hidden space-y-3">
                  {filteredEnrollments.map((enrollment) => {
                    const student = enrollment.student
                    if (!student) return null
                    const isSelected = selectedIds.has(student.id)

                    return (
                      <div
                        key={enrollment.id}
                        className={`rounded-xl border border-border/40 bg-card/80 p-4 shadow-sm hover:shadow-md transition-colors duration-200 motion-reduce:transition-none ${isSelected ? 'border-primary bg-primary/10' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(student.id)}
                            aria-label={`Selecionar ${student.name}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-medium">{student.name || 'Sem nome'}</h3>
                                <p className="text-sm text-muted-foreground">{student.email}</p>
                                {student.phone && (
                                  <p className="text-sm text-muted-foreground">{student.phone}</p>
                                )}
                                {(student.city || student.state) && (
                                  <p className="text-sm text-muted-foreground">
                                    {[student.city, student.state].filter(Boolean).join(', ')}
                                  </p>
                                )}
                              </div>
                              <Badge variant={enrollment.active ? 'default' : 'secondary'}>
                                {enrollment.active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </div>
                            <div className="mt-3 pt-3 border-t flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                Matrícula: {enrollment.enrollmentDate ? format(new Date(enrollment.enrollmentDate), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                              </span>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => router.push(tenant ? `/${tenant}/usuario/alunos?email=${student.email}` : `/usuario/alunos?email=${student.email}`)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver perfil do aluno</TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block rounded-xl border border-border/40 overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-12.5">
                          <Checkbox
                            checked={isAllSelected || (isSomeSelected && 'indeterminate')}
                            onCheckedChange={toggleSelectAll}
                            aria-label="Selecionar todos"
                          />
                        </TableHead>
                        <TableHead className="font-medium">Aluno</TableHead>
                        <TableHead className="font-medium">Email</TableHead>
                        <TableHead className="font-medium">Telefone</TableHead>
                        <TableHead className="font-medium">Cidade/Estado</TableHead>
                        <TableHead className="font-medium">Data Matrícula</TableHead>
                        <TableHead className="font-medium">Acesso até</TableHead>
                        <TableHead className="font-medium">Status</TableHead>
                        <TableHead className="w-17.5">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEnrollments.map((enrollment) => {
                        const student = enrollment.student
                        if (!student) return null
                        const isSelected = selectedIds.has(student.id)

                        return (
                          <TableRow
                            key={enrollment.id}
                            className={isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}
                            data-state={isSelected ? 'selected' : undefined}
                          >
                            <TableCell>
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelect(student.id)}
                                aria-label={`Selecionar ${student.name}`}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {student.name || 'Sem nome'}
                            </TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>{student.phone || '-'}</TableCell>
                            <TableCell>
                              {[student.city, student.state].filter(Boolean).join(', ') || '-'}
                            </TableCell>
                            <TableCell>
                              {enrollment.enrollmentDate ? format(new Date(enrollment.enrollmentDate), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell>
                              {enrollment.endDate ? format(new Date(enrollment.endDate), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={enrollment.active ? 'default' : 'secondary'}>
                                {enrollment.active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => router.push(tenant ? `/${tenant}/usuario/alunos?email=${student.email}` : `/usuario/alunos?email=${student.email}`)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Ver perfil do aluno</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-sm text-muted-foreground">
                  Mostrando {filteredEnrollments.length} de {enrollments.length} alunos
                  {selectedIds.size > 0 && ` · ${selectedIds.size} selecionado${selectedIds.size !== 1 ? 's' : ''}`}
                </div>
              </>
            )}

            {/* Bulk Actions Bar */}
            <BulkActionsBar
              selectedCount={selectedIds.size}
              onTransfer={() => setTransferDialogOpen(true)}
              onClearSelection={clearSelection}
            />

            {/* Transfer Students Dialog */}
            <TransferStudentsDialog
              open={transferDialogOpen}
              onOpenChange={setTransferDialogOpen}
              selectedStudents={selectedStudents}
              courses={courseOptions}
              currentCourseId={courseId}
              onTransferComplete={handleTransferComplete}
            />
          </TabsContent>

          {/* Tab: Configurações */}
          <TabsContent value="config" className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CourseModulesPanel courseId={courseId} />
              <CourseQuotaPanel courseId={courseId} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
