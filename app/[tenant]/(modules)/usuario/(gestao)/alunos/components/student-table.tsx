"use client"

import { useState, useEffect } from 'react'
import { Eye, Trash2, UserCog } from 'lucide-react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Student } from '@/app/shared/types/entities/user'
import { createClient } from '@/app/shared/core/client'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/app/shared/components/overlay/tooltip"
import { Button } from "@/components/ui/button"
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { DeleteStudentDialog } from './delete-student-dialog'
import { toast } from '@/hooks/use-toast'
import type { PaginationMeta } from '@/app/shared/types/dtos/api-responses'

interface StudentTableProps {
    students: Student[]
    meta: PaginationMeta
    cronogramaStatusByStudentId?: Record<string, boolean>
}

export function StudentTable({
    students,
    meta,
    cronogramaStatusByStudentId = {},
}: StudentTableProps) {
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [studentToDelete, setStudentToDelete] = useState<Student | null>(null)
    const router = useRouter()
    const params = useParams()
    const tenant = params?.tenant as string
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        setMounted(true)
    }, [])

    const goToPage = (page: number) => {
        const nextPage = Math.max(1, page)
        const params = new URLSearchParams(searchParams)
        params.set('page', String(nextPage))
        router.push(`${pathname}?${params.toString()}`)
    }

    const handleDeleteClick = (student: Student) => {
        setStudentToDelete(student)
        setDeleteDialogOpen(true)
    }

    const handleViewAsStudent = async (studentId: string) => {
        setLoadingId(studentId)
        try {
            // Obter token de autenticação
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
                body: JSON.stringify({ studentId }),
            })

            const data = await response.json().catch(() => ({ error: 'Erro desconhecido' }))

            if (!response.ok) {
                console.error('Erro na resposta da API:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: data,
                })
                toast({
                    variant: 'destructive',
                    title: 'Erro ao visualizar como aluno',
                    description: data.error || `Não foi possível iniciar a visualização. Tente novamente.`,
                })
                return
            }

            if (data.success) {
                toast({
                    title: 'Modo visualização ativado',
                    description: 'Você está visualizando a plataforma como este aluno.',
                })
                // Aguardar um pouco para garantir que o cookie foi definido
                await new Promise(resolve => setTimeout(resolve, 100))
                router.push(tenant ? `/${tenant}/dashboard` : '/dashboard')
                router.refresh()
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Erro ao visualizar como aluno',
                    description: data.error || 'Não foi possível iniciar a visualização.',
                })
            }
        } catch (error) {
            console.error('Erro ao iniciar visualização:', error)
            toast({
                variant: 'destructive',
                title: 'Erro inesperado',
                description: 'Ocorreu um erro ao processar a solicitação. Tente novamente.',
            })
        } finally {
            setLoadingId(null)
        }
    }

    return (
        <TooltipProvider>
            <div className="flex flex-1 flex-col gap-4">
                <ResponsiveTable
                    data={students}
                    getRowKey={(student) => student.id}
                    emptyMessage="Nenhum aluno encontrado com esses filtros."
                    columns={[
                        {
                            key: "fullName",
                            label: "Aluno",
                            isPrimary: true,
                            render: (_value, student) => {
                                const initials = student.fullName
                                    ? student.fullName
                                          .split(' ')
                                          .map((n) => n[0])
                                          .join('')
                                          .substring(0, 2)
                                          .toUpperCase()
                                    : '??'

                                return (
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
                                            {initials}
                                        </div>
                                        <div>
                                            <div className="font-medium text-foreground">
                                                {student.fullName || 'Sem nome'}
                                            </div>
                                            <div className="font-mono text-xs text-muted-foreground">
                                                {student.email}
                                            </div>
                                        </div>
                                    </div>
                                )
                            },
                        },
                        {
                            key: "courses",
                            label: "Cursos",
                            render: (_value, student) => {
                                const courseCount = student.courses?.length ?? 0
                                if (!student.courses || student.courses.length === 0) {
                                    return <span className="text-xs text-muted-foreground">-</span>
                                }

                                return (
                                    <span className="inline-flex flex-wrap items-center gap-1">
                                        <span className="text-xs text-muted-foreground sm:hidden">
                                            {courseCount} curso(s)
                                        </span>
                                        <span className="hidden flex-wrap gap-1 sm:inline-flex">
                                            {student.courses.map((course) => (
                                                <span
                                                    key={course.id}
                                                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border"
                                                >
                                                    {course.name}
                                                </span>
                                            ))}
                                        </span>
                                    </span>
                                )
                            },
                        },
                        {
                            key: "ativo",
                            label: "Status",
                            isImportant: true,
                            render: (_value, student) => {
                                const status = student.ativo ? 'Ativo' : 'Inativo'
                                return (
                                    <span
                                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                                            status === 'Ativo'
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-red-50 text-red-700 border-red-200'
                                        }`}
                                    >
                                        {status}
                                    </span>
                                )
                            },
                        },
                        {
                            key: "progress",
                            label: "Progresso",
                            isImportant: true,
                            render: (_value, student) => {
                                const status = student.ativo ? 'Ativo' : 'Inativo'
                                const progress = student.progress ?? 0

                                return (
                                    <span className="inline-flex items-center gap-2">
                                        <span className="font-mono text-xs text-muted-foreground sm:hidden">
                                            {progress}%
                                        </span>
                                        <span className="hidden items-center gap-2 sm:inline-flex">
                                            <span className="h-1.5 w-24 bg-muted/50 rounded-full overflow-hidden">
                                                <span
                                                    className={`h-full block rounded-full ${
                                                        status === 'Ativo'
                                                            ? 'bg-primary/80'
                                                            : 'bg-muted-foreground/30'
                                                    }`}
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </span>
                                            <span className="font-mono text-xs text-muted-foreground">
                                                {progress}%
                                            </span>
                                        </span>
                                    </span>
                                )
                            },
                        },
                        {
                            key: "cronograma",
                            label: "Cronograma",
                            isImportant: true,
                            render: (_value, student) => {
                                const hasCronograma = Boolean(cronogramaStatusByStudentId[student.id])

                                return (
                                    <span
                                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                                            hasCronograma
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                                        }`}
                                    >
                                        {hasCronograma ? 'Sim' : 'Não'}
                                    </span>
                                )
                            },
                        },
                    ]}
                    renderActions={(student) =>
                        mounted ? (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() =>
                                                router.push(
                                                    tenant
                                                        ? `/${tenant}/usuario/alunos/${student.id}`
                                                        : `/usuario/alunos/${student.id}`
                                                )
                                            }
                                        >
                                            <UserCog className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Ver Perfil</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => handleViewAsStudent(student.id)}
                                            disabled={loadingId === student.id}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        {loadingId === student.id ? 'Carregando...' : 'Visualizar como Aluno'}
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                            onClick={() => handleDeleteClick(student)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Excluir Aluno</TooltipContent>
                                </Tooltip>
                            </>
                        ) : (
                            <>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                                    <UserCog className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                                    <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </>
                        )
                    }
                />

                <div className="border-t border-border px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-muted-foreground">
                        {meta.total === 0 ? (
                            <>Mostrando <strong>0</strong> resultados</>
                        ) : (
                            <>
                                Mostrando{' '}
                                <strong>{(meta.page - 1) * meta.perPage + 1}</strong>
                                {'-'}
                                <strong>{Math.min(meta.page * meta.perPage, meta.total)}</strong>
                                {' '}de <strong>{meta.total}</strong>
                            </>
                        )}
                        {meta.totalPages > 1 ? <> • Página <strong>{meta.page}</strong> de <strong>{meta.totalPages}</strong></> : null}
                    </span>
                    <div className="flex w-full gap-2 sm:w-auto">
                        <button
                            className="flex-1 px-3 py-1 border border-border bg-background rounded text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 sm:flex-none"
                            disabled={meta.page <= 1}
                            onClick={() => goToPage(meta.page - 1)}
                        >
                            Anterior
                        </button>
                        <button
                            className="flex-1 px-3 py-1 border border-border bg-background rounded text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50 sm:flex-none"
                            disabled={meta.page >= meta.totalPages}
                            onClick={() => goToPage(meta.page + 1)}
                        >
                            Próximo
                        </button>
                    </div>
                </div>
            </div>

            <DeleteStudentDialog
                student={studentToDelete}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </TooltipProvider>
    )
}
