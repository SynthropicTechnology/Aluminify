'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Hash,
  Instagram,
  Twitter,
  Edit,
  Trash2,
  Eye,
  Key,
  BookOpen,
  Clock,
  Globe,
  Plus,
  X,
  Loader2,
  Check,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/shared/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/shared/components/overlay/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/shared/components/ui/command'
import { toast } from '@/hooks/use-toast'
import { apiClient } from '@/shared/library/api-client'
import { createClient } from '@/app/shared/core/client'
import { StudentEditForm } from './student-edit-form'

interface StudentData {
  id: string
  empresaId: string | null
  fullName: string | null
  email: string
  cpf: string | null
  phone: string | null
  birthDate: string | null
  address: string | null
  zipCode: string | null
  cidade: string | null
  estado: string | null
  bairro: string | null
  pais: string | null
  numeroEndereco: string | null
  complemento: string | null
  enrollmentNumber: string | null
  instagram: string | null
  twitter: string | null
  hotmartId: string | null
  origemCadastro: string | null
  courses: { id: string; name: string }[]
  courseIds: string[]
  mustChangePassword: boolean
  temporaryPassword: string | null
  createdAt: string
  updatedAt: string
  quotaExtra?: number
}

interface StudentDetailsProps {
  student: StudentData
  onUpdate: () => void
}

function formatCPF(cpf: string | null): string {
  if (!cpf) return '-'
  if (cpf.length === 11) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return cpf
}

function formatPhone(phone: string | null): string {
  if (!phone) return '-'
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

function formatZipCode(zipCode: string | null): string {
  if (!zipCode) return '-'
  const cleaned = zipCode.replace(/\D/g, '')
  if (cleaned.length === 8) {
    return cleaned.replace(/(\d{5})(\d{3})/, '$1-$2')
  }
  return zipCode
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  try {
    return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR })
  } catch {
    return '-'
  }
}

function formatDateTime(dateString: string): string {
  try {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return '-'
  }
}

function InfoRow({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div className="flex items-start justify-between py-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        {Icon && <Icon className="h-4 w-4" />}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-right max-w-[60%] wrap-break-words">{value}</span>
    </div>
  )
}

export function StudentDetails({ student, onUpdate }: StudentDetailsProps) {
  const router = useRouter()
  const params = useParams()
  const tenant = params?.tenant as string
  const [isEditing, setIsEditing] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [isImpersonating, setIsImpersonating] = React.useState(false)

  // Course management state
  const [removeCourseDialogOpen, setRemoveCourseDialogOpen] = React.useState(false)
  const [courseToRemove, setCourseToRemove] = React.useState<{ id: string; name: string } | null>(null)
  const [isRemovingCourse, setIsRemovingCourse] = React.useState(false)
  const [addCourseDialogOpen, setAddCourseDialogOpen] = React.useState(false)
  const [availableCourses, setAvailableCourses] = React.useState<{ id: string; name: string }[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = React.useState(false)
  const [isAddingCourse, setIsAddingCourse] = React.useState(false)
  const [selectedCourseToAdd, setSelectedCourseToAdd] = React.useState<string | null>(null)

  const handleRemoveCourse = async () => {
    if (!courseToRemove) return
    try {
      setIsRemovingCourse(true)
      const updatedCourseIds = student.courseIds.filter(id => id !== courseToRemove.id)
      await apiClient.put(`/api/usuario/alunos/${student.id}`, {
        courseIds: updatedCourseIds,
      })
      toast({
        title: 'Curso removido',
        description: `O aluno foi removido do curso "${courseToRemove.name}".`,
      })
      onUpdate()
    } catch (error) {
      console.error('Error removing course:', error)
      toast({
        variant: 'destructive',
        title: 'Erro ao remover curso',
        description: 'Não foi possível remover o aluno do curso. Tente novamente.',
      })
    } finally {
      setIsRemovingCourse(false)
      setRemoveCourseDialogOpen(false)
      setCourseToRemove(null)
    }
  }

  const handleOpenAddCourseDialog = async () => {
    setAddCourseDialogOpen(true)
    setSelectedCourseToAdd(null)
    setIsLoadingCourses(true)
    try {
      const supabase = createClient()
      let query = supabase
        .from('cursos')
        .select('id, nome')
        .order('nome', { ascending: true })
      if (student.empresaId) {
        query = query.eq('empresa_id', student.empresaId)
      }
      const { data, error } = await query
      if (error) throw error
      setAvailableCourses((data ?? []).map(c => ({ id: c.id, name: c.nome })))
    } catch (error) {
      console.error('Error fetching courses:', error)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar cursos',
        description: 'Não foi possível carregar a lista de cursos.',
      })
      setAddCourseDialogOpen(false)
    } finally {
      setIsLoadingCourses(false)
    }
  }

  const handleAddCourse = async (courseId: string) => {
    try {
      setIsAddingCourse(true)
      const updatedCourseIds = [...student.courseIds, courseId]
      await apiClient.put(`/api/usuario/alunos/${student.id}`, {
        courseIds: updatedCourseIds,
      })
      const addedCourse = availableCourses.find(c => c.id === courseId)
      toast({
        title: 'Curso adicionado',
        description: `O aluno foi adicionado ao curso "${addedCourse?.name ?? 'selecionado'}".`,
      })
      setAddCourseDialogOpen(false)
      onUpdate()
    } catch (error) {
      console.error('Error adding course:', error)
      toast({
        variant: 'destructive',
        title: 'Erro ao adicionar curso',
        description: 'Não foi possível adicionar o aluno ao curso. Tente novamente.',
      })
    } finally {
      setIsAddingCourse(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)
      await apiClient.delete(`/api/usuario/alunos/${student.id}`)
      toast({
        title: 'Aluno excluído',
        description: 'O aluno foi excluído com sucesso.',
      })
      router.push(tenant ? `/${tenant}/usuario/alunos` : '/usuario/alunos')
    } catch (error) {
      console.error('Error deleting student:', error)
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir o aluno. Tente novamente.',
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleViewAsStudent = async () => {
    setIsImpersonating(true)
    try {
      const supabase = createClient()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()

      if (sessionError || !session) {
        toast({
          variant: 'destructive',
          title: 'Sessão expirada',
          description: 'Faça login novamente para continuar.',
        })
        return
      }

      const response = await fetch('/api/auth/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ studentId: student.id }),
      })

      const data = await response.json().catch(() => ({ error: 'Erro desconhecido' }))

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Erro ao visualizar como aluno',
          description: data.error || 'Não foi possível iniciar a visualização.',
        })
        return
      }

      if (data.success) {
        toast({
          title: 'Modo visualização ativado',
          description: 'Você está visualizando a plataforma como este aluno.',
        })
        // Força navegação completa para garantir que o novo cookie httpOnly
        // de impersonação seja considerado no SSR da próxima página.
        await new Promise(resolve => setTimeout(resolve, 120))
        window.location.href = tenant ? `/${tenant}/dashboard` : '/dashboard'
      }
    } catch (error) {
      console.error('Error impersonating:', error)
      toast({
        variant: 'destructive',
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao processar a solicitação.',
      })
    } finally {
      setIsImpersonating(false)
    }
  }

  const fullAddress = [
    student.address,
    student.numeroEndereco ? `nº ${student.numeroEndereco}` : null,
    student.complemento,
    student.bairro,
    student.cidade,
    student.estado,
    student.pais,
  ].filter(Boolean).join(', ') || '-'

  if (isEditing) {
    return (
      <StudentEditForm
        student={student}
        onCancel={() => setIsEditing(false)}
        onSuccess={() => {
          setIsEditing(false)
          onUpdate()
        }}
      />
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6 h-full pb-10">
        {/* Header */}
        <header className="flex flex-col gap-4 border-b border-border/40 pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit -ml-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para alunos
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-muted/50 border border-border/40 flex items-center justify-center text-xl font-bold text-muted-foreground">
                {student.fullName
                  ? student.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                  : '??'}
              </div>
              <div>
                <h1 className="page-title">{student.fullName || 'Sem nome'}</h1>
                <p className="text-muted-foreground">{student.email}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {student.mustChangePassword && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      <Key className="mr-1 h-3 w-3" />
                      Senha temporária
                    </Badge>
                  )}
                  {student.courses.length > 0 && (
                    <Badge variant="secondary">
                      <BookOpen className="mr-1 h-3 w-3" />
                      {student.courses.length} curso{student.courses.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleViewAsStudent}
                    disabled={isImpersonating}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Ver como aluno
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Visualizar plataforma como este aluno</TooltipContent>
              </Tooltip>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            </div>
          </div>
        </header>

        {/* Content Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Informacoes Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Nome completo" value={student.fullName || '-'} />
              <InfoRow label="CPF" value={formatCPF(student.cpf)} icon={Hash} />
              <InfoRow label="Data de nascimento" value={formatDate(student.birthDate)} icon={Calendar} />
              <InfoRow label="Matrícula" value={student.enrollmentNumber || '-'} icon={Hash} />
            </CardContent>
          </Card>

          {/* Contato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Mail className="h-5 w-5" />
                Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Email" value={student.email} icon={Mail} />
              <InfoRow label="Telefone" value={formatPhone(student.phone)} icon={Phone} />
              <InfoRow label="Instagram" value={student.instagram || '-'} icon={Instagram} />
              <InfoRow label="Twitter" value={student.twitter || '-'} icon={Twitter} />
            </CardContent>
          </Card>

          {/* Endereco */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-5 w-5" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Endereço completo" value={fullAddress} />
              <InfoRow label="CEP" value={formatZipCode(student.zipCode)} />
              <InfoRow label="País" value={student.pais || 'Brasil'} icon={Globe} />
            </CardContent>
          </Card>

          {/* Status da Conta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-5 w-5" />
                Status da Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <InfoRow label="Cadastrado em" value={formatDateTime(student.createdAt)} />
              <InfoRow label="Última atualização" value={formatDateTime(student.updatedAt)} />
              <InfoRow label="Origem do cadastro" value={student.origemCadastro || 'Manual'} />
              {student.hotmartId && (
                <InfoRow label="ID Hotmart" value={student.hotmartId} />
              )}
              {student.quotaExtra !== undefined && (
                <InfoRow label="Quota Extra de Plantão" value={`${student.quotaExtra}`} icon={BookOpen} />
              )}
              {student.mustChangePassword && student.temporaryPassword && (
                <InfoRow label="Senha temporária" value={student.temporaryPassword} icon={Key} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Cursos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                Cursos Matriculados
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenAddCourseDialog}
              >
                <Plus className="mr-2 h-4 w-4" />
                Adicionar curso
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {student.courses.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum curso matriculado.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {student.courses.map((course) => (
                  <Badge
                    key={course.id}
                    variant="outline"
                    className="cursor-pointer hover:bg-muted/50 pr-1 gap-1"
                  >
                    <span
                      onClick={() => router.push(tenant ? `/${tenant}/curso/admin/${course.id}` : `/curso/admin/${course.id}`)}
                    >
                      {course.name}
                    </span>
                    <button
                      type="button"
                      className="ml-1 rounded-full p-0.5 hover:bg-muted/50 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCourseToRemove(course)
                        setRemoveCourseDialogOpen(true)
                      }}
                      aria-label={`Remover ${course.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o aluno <strong>{student.fullName || student.email}</strong>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Remove Course Dialog */}
        <AlertDialog open={removeCourseDialogOpen} onOpenChange={setRemoveCourseDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover curso</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o aluno <strong>{student.fullName || student.email}</strong> do curso <strong>{courseToRemove?.name}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRemovingCourse} onClick={() => setCourseToRemove(null)}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveCourse}
                disabled={isRemovingCourse}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isRemovingCourse ? 'Removendo...' : 'Remover'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Add Course Dialog */}
        <Dialog open={addCourseDialogOpen} onOpenChange={setAddCourseDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar curso</DialogTitle>
              <DialogDescription>
                Selecione um curso para matricular o aluno.
              </DialogDescription>
            </DialogHeader>
            {isLoadingCourses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Command className="rounded-lg border">
                <CommandInput placeholder="Buscar curso..." />
                <CommandList>
                  <CommandEmpty>Nenhum curso disponível.</CommandEmpty>
                  <CommandGroup>
                    {availableCourses
                      .filter(course => !student.courseIds.includes(course.id))
                      .map((course) => (
                        <CommandItem
                          key={course.id}
                          value={course.name}
                          onSelect={() => setSelectedCourseToAdd(course.id)}
                        >
                          <Check className={`mr-2 h-4 w-4 ${selectedCourseToAdd === course.id ? 'opacity-100' : 'opacity-0'}`} />
                          {course.name}
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddCourseDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => selectedCourseToAdd && handleAddCourse(selectedCourseToAdd)}
                disabled={!selectedCourseToAdd || isAddingCourse}
              >
                {isAddingCourse ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  'Adicionar'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
