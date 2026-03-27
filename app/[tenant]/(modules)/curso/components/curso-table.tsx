'use client'

import * as React from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from '@tanstack/react-table'
import { ArrowUpDown, Pencil, Trash2, Plus, BookOpen, Search, Eye, Users, X } from 'lucide-react'
import { useParams, useRouter } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/shared/components/dataviz/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/app/shared/components/overlay/dialog'
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/shared/components/forms/form'
import { Input } from '@/app/shared/components/forms/input'
import { Textarea } from '@/app/shared/components/forms/textarea'
import { DatePicker } from '@/components/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/shared/components/forms/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/app/shared/components/forms/checkbox'
import { Switch } from '@/app/shared/components/forms/switch'
import { apiClient, ApiClientError } from '@/shared/library/api-client'
import { format, parse } from 'date-fns'
import { TableSkeleton } from '@/app/shared/components/ui/table-skeleton'


export type Curso = {
  id: string
  segmentId: string | null
  disciplineId: string | null // Mantido para compatibilidade
  disciplineIds?: string[] // Nova propriedade para múltiplas disciplinas
  name: string
  modality: 'EAD' | 'LIVE'
  modalityId?: string
  modalityData?: {
    id: string
    nome: string
    slug: string
  }
  type: 'Superextensivo' | 'Extensivo' | 'Intensivo' | 'Superintensivo' | 'Revisão'
  description: string | null
  year: number
  startDate: string | null
  endDate: string | null
  accessMonths: number | null
  planningUrl: string | null
  coverImageUrl: string | null
  usaTurmas?: boolean
  hotmartProductIds?: string[]
  hotmartProductId?: string | null
  createdAt: string
  updatedAt: string
}

export type Segmento = {
  id: string
  name: string
  slug: string
}

export type Disciplina = {
  id: string
  name: string
}

export type Modalidade = {
  id: string
  nome: string
  slug: string
}

function normalizeHotmartId(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // ID de produto Hotmart é numérico (e isso impede entradas malformadas)
  if (!/^\d+$/.test(trimmed)) return null
  return trimmed
}

function parseHotmartIdsFromText(text: string): { ids: string[]; invalidTokens: string[] } {
  // Permite colar lista com espaços, vírgulas, quebras de linha etc.
  const parts = text.split(/[\s,;]+/g).map((p) => p.trim()).filter(Boolean)

  const ids: string[] = []
  const invalidTokens: string[] = []

  for (const part of parts) {
    const normalized = normalizeHotmartId(part)
    if (normalized) ids.push(normalized)
    else invalidTokens.push(part)
  }

  return {
    ids: Array.from(new Set(ids)),
    invalidTokens: Array.from(new Set(invalidTokens)).slice(0, 5), // limitar para não estourar UI
  }
}

const cursoSchema = z.object({
  segmentId: z.string().optional().nullable(),
  disciplineId: z.string().optional().nullable(), // Mantido para compatibilidade
  disciplineIds: z.array(z.string()), // Nova propriedade para múltiplas disciplinas
  name: z.string().min(1, 'Nome é obrigatório'),
  modality: z.enum(['EAD', 'LIVE']).optional(), // Deprecated but kept for compatibility logic helper
  modalityId: z.string({ required_error: 'Modalidade é obrigatória' }).min(1, 'Modalidade é obrigatória'),
  type: z.enum(['Superextensivo', 'Extensivo', 'Intensivo', 'Superintensivo', 'Revisão'], {
    message: 'Tipo é obrigatório',
  }),
  description: z.string().optional().nullable(),
  year: z.number().min(2020, 'Ano inválido').max(2100, 'Ano inválido'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  accessMonths: z.number().optional().nullable(),
  planningUrl: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().url('URL inválida').optional().nullable()
  ) as z.ZodType<string | null | undefined>,
  coverImageUrl: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().url('URL inválida').optional().nullable()
  ) as z.ZodType<string | null | undefined>,
  usaTurmas: z.boolean(),
  hotmartProductIds: z
    .array(
      z
        .string()
        .trim()
        .min(1, 'ID inválido')
        .regex(/^\d+$/, 'O ID da Hotmart deve conter apenas números')
    )
    .default([])
    .refine((ids) => new Set(ids).size === ids.length, 'IDs duplicados'),
})

type CursoFormInput = z.input<typeof cursoSchema>
type CursoFormValues = z.output<typeof cursoSchema>

export function CursoTable() {
  const router = useRouter()
  const params = useParams()
  const tenant = params?.tenant as string
  const [data, setData] = React.useState<Curso[]>([])
  const [segmentos, setSegmentos] = React.useState<Segmento[]>([])
  const [disciplinas, setDisciplinas] = React.useState<Disciplina[]>([])
  const [modalidades, setModalidades] = React.useState<Modalidade[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [mounted, setMounted] = React.useState(false)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  const [editingCurso, setEditingCurso] = React.useState<Curso | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingCurso, setDeletingCurso] = React.useState<Curso | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [enrollmentCounts, setEnrollmentCounts] = React.useState<Record<string, number>>({})
  const [createHotmartIdDraft, setCreateHotmartIdDraft] = React.useState('')
  const [editHotmartIdDraft, setEditHotmartIdDraft] = React.useState('')
  const [createHotmartIdsHint, setCreateHotmartIdsHint] = React.useState<string | null>(null)
  const [editHotmartIdsHint, setEditHotmartIdsHint] = React.useState<string | null>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const createForm = useForm<CursoFormInput, undefined, CursoFormValues>({
    resolver: zodResolver(cursoSchema),
    defaultValues: {
      segmentId: null,
      disciplineId: null,
      disciplineIds: [],
      name: '',
      modality: 'EAD', // Deprecated default
      modalityId: '',
      type: 'Extensivo',
      description: null,
      year: new Date().getFullYear(),
      startDate: null,
      endDate: null,
      accessMonths: null,
      planningUrl: null,
      coverImageUrl: null,
      usaTurmas: false,
      hotmartProductIds: [],
    },
  })

  const editForm = useForm<CursoFormInput, undefined, CursoFormValues>({
    resolver: zodResolver(cursoSchema),
    defaultValues: {
      segmentId: null,
      disciplineId: null,
      disciplineIds: [],
      name: '',
      modality: 'EAD',
      modalityId: '',
      type: 'Extensivo',
      description: null,
      year: new Date().getFullYear(),
      startDate: null,
      endDate: null,
      accessMonths: null,
      planningUrl: null,
      coverImageUrl: null,
      usaTurmas: false,
      hotmartProductIds: [],
    },
  })

  const fetchModalidades = React.useCallback(async () => {
    try {
      const response = await apiClient.get<{ data: Modalidade[] }>('/api/curso/modalidades')
      if (response && 'data' in response) {
        setModalidades(response.data)
      }
    } catch (err) {
      console.error('Error fetching modalidades:', err)
    }
  }, [])

  const fetchSegmentos = React.useCallback(async () => {
    try {
      const response = await apiClient.get<{ data: Segmento[] }>('/api/curso/segmentos')
      if (response && 'data' in response) {
        setSegmentos(response.data)
      }
    } catch (err) {
      console.error('Error fetching segmentos:', err)
    }
  }, [])

  const fetchDisciplinas = React.useCallback(async () => {
    try {
      const response = await apiClient.get<{ data: Disciplina[] }>('/api/curso/disciplinas')
      if (response && 'data' in response) {
        setDisciplinas(response.data)
      }
    } catch (err) {
      console.error('Error fetching disciplinas:', err)
    }
  }, [])

  const fetchCursos = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get<{ data: Curso[] }>('/api/curso')
      if (response && 'data' in response) {
        setData(response.data)
      } else {
        setError('Resposta inválida da API')
      }
    } catch (err) {
      let errorMessage = 'Erro ao carregar cursos'
      if (err instanceof ApiClientError) {
        if (err.status === 500) {
          errorMessage = `Erro interno do servidor: ${err.data?.error || 'Erro desconhecido'}`
        } else if (err.status === 401) {
          errorMessage = 'Não autorizado. Faça login novamente.'
        } else if (err.status === 403) {
          errorMessage = 'Acesso negado.'
        } else {
          errorMessage = err.data?.error || err.message || errorMessage
        }
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      setError(errorMessage)
      console.error('Error fetching cursos:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchEnrollmentCounts = React.useCallback(async () => {
    try {
      const response = await apiClient.get<{ data: Record<string, number> }>('/api/curso/enrollments-count')
      if (response && 'data' in response) {
        setEnrollmentCounts(response.data)
      }
    } catch (err) {
      console.error('Error fetching enrollment counts:', err)
    }
  }, [])

  React.useEffect(() => {
    fetchCursos()
    fetchSegmentos()
    fetchDisciplinas()
    fetchModalidades()
    fetchEnrollmentCounts()
  }, [fetchCursos, fetchSegmentos, fetchDisciplinas, fetchModalidades, fetchEnrollmentCounts])

  const handleCreate = async (values: CursoFormValues) => {
    try {
      setIsSubmitting(true)
      setError(null)
      await apiClient.post<{ data: Curso }>('/api/curso', {
        ...values,
        segmentId: values.segmentId || undefined,
        disciplineId: values.disciplineId || undefined, // Mantido para compatibilidade
        disciplineIds: values.disciplineIds || [], // Sempre enviar array, mesmo se vazio
        modalityId: values.modalityId,
        planningUrl: values.planningUrl || undefined,
        coverImageUrl: values.coverImageUrl || undefined,
        usaTurmas: values.usaTurmas || false,
        hotmartProductIds: values.hotmartProductIds || [],
      })
      setSuccessMessage('Curso criado com sucesso!')
      setCreateDialogOpen(false)
      createForm.reset()
      setCreateHotmartIdDraft('')
      setCreateHotmartIdsHint(null)
      await fetchCursos()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      let errorMessage = 'Erro ao criar curso'
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          errorMessage = 'Não autorizado. Faça login novamente.'
        } else if (err.status === 403) {
          errorMessage = 'Acesso negado. Você precisa ser professor ou administrador.'
        } else if (err.status === 500) {
          errorMessage = `Erro interno do servidor: ${err.data?.error || err.message || 'Erro desconhecido'}`
        } else {
          errorMessage = err.data?.error || err.message || errorMessage
        }
      } else if (err instanceof Error) {
        errorMessage = err.message
      }
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (curso: Curso) => {
    setEditingCurso(curso)
    const hotmartIds = curso.hotmartProductIds?.length
      ? curso.hotmartProductIds
      : curso.hotmartProductId
        ? [curso.hotmartProductId]
        : []
    editForm.reset({
      segmentId: curso.segmentId,
      disciplineId: curso.disciplineId, // Mantido para compatibilidade
      disciplineIds: curso.disciplineIds || (curso.disciplineId ? [curso.disciplineId] : []),
      name: curso.name,
      modality: curso.modality,
      modalityId: curso.modalityId || '',
      type: curso.type,
      description: curso.description,
      year: curso.year,
      startDate: curso.startDate,
      endDate: curso.endDate,
      accessMonths: curso.accessMonths,
      planningUrl: curso.planningUrl,
      coverImageUrl: curso.coverImageUrl,
      usaTurmas: curso.usaTurmas || false,
      hotmartProductIds: hotmartIds,
    })
    setEditHotmartIdDraft('')
    setEditHotmartIdsHint(null)
    setEditDialogOpen(true)
  }

  const handleUpdate = async (values: CursoFormValues) => {
    if (!editingCurso) return

    try {
      setIsSubmitting(true)
      setError(null)
      await apiClient.put<{ data: Curso }>(`/api/curso/${editingCurso.id}`, {
        ...values,
        segmentId: values.segmentId || null,
        disciplineId: values.disciplineId || null, // Mantido para compatibilidade
        disciplineIds: values.disciplineIds || [], // Sempre enviar array, mesmo se vazio
        modalityId: values.modalityId,
        planningUrl: values.planningUrl || null,
        coverImageUrl: values.coverImageUrl || null,
        usaTurmas: values.usaTurmas,
        hotmartProductIds: values.hotmartProductIds || [],
      })
      setSuccessMessage('Curso atualizado com sucesso!')
      setEditDialogOpen(false)
      setEditingCurso(null)
      editForm.reset()
      setEditHotmartIdDraft('')
      setEditHotmartIdsHint(null)
      await fetchCursos()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof ApiClientError
        ? err.data?.error || err.message
        : 'Erro ao atualizar curso'
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (curso: Curso) => {
    setDeletingCurso(curso)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingCurso) return

    try {
      setIsSubmitting(true)
      setError(null)
      await apiClient.delete(`/api/curso/${deletingCurso.id}`)
      setSuccessMessage('Curso excluído com sucesso!')
      setDeleteDialogOpen(false)
      setDeletingCurso(null)
      await fetchCursos()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof ApiClientError
        ? err.data?.error || err.message
        : 'Erro ao excluir curso'
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<Curso>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Nome
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => <div className="font-medium">{row.getValue('name')}</div>,
    },
    {
      accessorKey: 'modality',
      header: 'Modalidade',
      cell: ({ row }) => <div>{row.original.modalityData?.nome || row.getValue('modality')}</div>,
    },
    {
      accessorKey: 'type',
      header: 'Tipo',
      cell: ({ row }) => <div>{row.getValue('type')}</div>,
    },
    {
      accessorKey: 'year',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Ano
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => <div>{row.getValue('year')}</div>,
    },
    {
      id: 'enrollmentCount',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Alunos
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const count = enrollmentCounts[row.original.id] || 0
        return (
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{count}</span>
          </div>
        )
      },
      sortingFn: (rowA, rowB) => {
        const countA = enrollmentCounts[rowA.original.id] || 0
        const countB = enrollmentCounts[rowB.original.id] || 0
        return countA - countB
      },
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Criado em
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => {
        const date = new Date(row.getValue('createdAt'))
        return <div>{date.toLocaleDateString('pt-BR')}</div>
      },
    },
    {
      id: 'actions',
      header: 'Ações',
      enableHiding: false,
      cell: ({ row }) => {
        const curso = row.original

        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => router.push(tenant ? `/${tenant}/curso/admin/${curso.id}` : `/curso/admin/${curso.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Visualizar alunos</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleEdit(curso)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  onClick={() => handleDeleteClick(curso)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Excluir</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
  })

  return (
    <TooltipProvider>
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8 px-4 pb-10 sm:px-6 lg:px-8">
        {error && (
          <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="rounded-md bg-green-500/15 p-3 text-sm text-green-600 dark:text-green-400">
            {successMessage}
          </div>
        )}

        <section className="flex flex-col gap-4 h-full min-h-150">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="page-title">Cursos</h1>
            <p className="page-subtitle">Gerencie os cursos do sistema</p>
          </div>
          <div className="flex items-center gap-2">
            {mounted ? (
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <button className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2">
                    <Plus className="w-5 h-5" strokeWidth={1.5} />
                    Novo Curso
                  </button>
                </DialogTrigger>
                <DialogContent fullScreenMobile className="md:max-w-2xl md:h-[90vh] md:flex md:flex-col md:overflow-hidden">
                  <DialogHeader className="pb-4 border-b">
                    <DialogTitle className="text-xl">Criar Curso</DialogTitle>
                    <DialogDescription>
                      Adicione um novo curso ao sistema.
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...createForm}>
                    <form onSubmit={createForm.handleSubmit(handleCreate)} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
                      {/* Seção: Identificação */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Identificação</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                          <FormField
                            control={createForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem className="sm:col-span-3">
                                <FormLabel>Nome *</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Matemática Básica" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="year"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Ano *</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="2024" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Seção: Configuração */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Configuração</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={createForm.control}
                            name="modalityId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Modalidade *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {modalidades.map((modality) => (
                                      <SelectItem key={modality.id} value={modality.id}>
                                        {modality.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tipo *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="Superextensivo">Superextensivo</SelectItem>
                                    <SelectItem value="Extensivo">Extensivo</SelectItem>
                                    <SelectItem value="Intensivo">Intensivo</SelectItem>
                                    <SelectItem value="Superintensivo">Superintensivo</SelectItem>
                                    <SelectItem value="Revisão">Revisão</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="accessMonths"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Meses de Acesso</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    placeholder="12"
                                    {...field}
                                    value={field.value || ''}
                                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={createForm.control}
                          name="usaTurmas"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                              <div className="space-y-0.5">
                                <FormLabel className="text-base">Habilitar Turmas</FormLabel>
                                <FormDescription>
                                  Permite organizar alunos em turmas dentro do curso (ex: Manhã, Tarde, Turno A).
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Seção: Categorização */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Categorização</h3>
                        <FormField
                          control={createForm.control}
                          name="segmentId"
                          render={({ field }) => (
                            <FormItem className="sm:max-w-xs">
                              <FormLabel>Segmento</FormLabel>
                              <Select
                                onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                                value={field.value || '__none__'}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o segmento" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="__none__">Nenhum</SelectItem>
                                  {segmentos.map((segmento) => (
                                    <SelectItem key={segmento.id} value={segmento.id}>
                                      {segmento.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="disciplineIds"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Disciplinas</FormLabel>
                              <FormDescription className="text-xs">
                                Selecione uma ou mais disciplinas para este curso
                              </FormDescription>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border rounded-lg p-4 bg-muted/30">
                                {disciplinas.map((disciplina) => (
                                  <div key={disciplina.id} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`create-discipline-${disciplina.id}`}
                                      checked={field.value?.includes(disciplina.id) || false}
                                      onCheckedChange={(checked) => {
                                        const currentValue = field.value || []
                                        if (checked) {
                                          field.onChange([...currentValue, disciplina.id])
                                        } else {
                                          field.onChange(currentValue.filter((id) => id !== disciplina.id))
                                        }
                                      }}
                                    />
                                    <label
                                      htmlFor={`create-discipline-${disciplina.id}`}
                                      className="text-sm leading-none cursor-pointer"
                                    >
                                      {disciplina.name}
                                    </label>
                                  </div>
                                ))}
                                {disciplinas.length === 0 && (
                                  <p className="text-sm text-muted-foreground col-span-full">
                                    Nenhuma disciplina cadastrada
                                  </p>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Seção: Descrição */}
                      <FormField
                        control={createForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Descrição</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Descrição do curso..."
                                {...field}
                                value={field.value || ''}
                                rows={3}
                                className="resize-none"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Seção: Período */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Período</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={createForm.control}
                            name="startDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data de Início</FormLabel>
                                <FormControl>
                                  <DatePicker
                                    value={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : null}
                                    onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : null)}
                                    placeholder="dd/mm/yyyy"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="endDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Data de Término</FormLabel>
                                <FormControl>
                                  <DatePicker
                                    value={field.value ? parse(field.value, 'yyyy-MM-dd', new Date()) : null}
                                    onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : null)}
                                    placeholder="dd/mm/yyyy"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Seção: Links */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Links</h3>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField
                            control={createForm.control}
                            name="planningUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL do Planejamento</FormLabel>
                                <FormControl>
                                  <Input
                                    type="url"
                                    placeholder="https://..."
                                    {...field}
                                    value={field.value || ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="coverImageUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL da Imagem de Capa</FormLabel>
                                <FormControl>
                                  <Input
                                    type="url"
                                    placeholder="https://..."
                                    {...field}
                                    value={field.value || ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      {/* Seção: Integrações */}
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Integrações</h3>
                        <FormField
                          control={createForm.control}
                          name="hotmartProductIds"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>IDs do Produto Hotmart</FormLabel>
                              <FormControl>
                                <div className="space-y-3">
                                  <div className="flex flex-wrap gap-2">
                                    {(field.value ?? []).length === 0 ? (
                                      <span className="text-sm text-muted-foreground">Nenhum ID adicionado</span>
                                    ) : (
                                      (field.value ?? []).map((id) => (
                                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                                          <span className="font-mono text-xs">{id}</span>
                                          <button
                                            type="button"
                                            className="rounded-sm hover:bg-muted/60 p-0.5"
                                            onClick={() =>
                                              field.onChange((field.value ?? []).filter((x) => x !== id))
                                            }
                                            aria-label={`Remover ID ${id}`}
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        </Badge>
                                      ))
                                    )}
                                  </div>

                                  <div className="flex gap-2">
                                    <Input
                                      placeholder="Digite um ID e pressione Enter"
                                      value={createHotmartIdDraft}
                                      onChange={(e) => setCreateHotmartIdDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                                          e.preventDefault()
                                          const { ids, invalidTokens } = parseHotmartIdsFromText(createHotmartIdDraft)
                                          if (ids.length > 0) {
                                            field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                            setCreateHotmartIdDraft('')
                                          }
                                          if (invalidTokens.length > 0) {
                                            setCreateHotmartIdsHint(
                                              `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                            )
                                          } else {
                                            setCreateHotmartIdsHint(null)
                                          }
                                        }
                                      }}
                                      onBlur={() => {
                                        const { ids, invalidTokens } = parseHotmartIdsFromText(createHotmartIdDraft)
                                        if (ids.length > 0) {
                                          field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                          setCreateHotmartIdDraft('')
                                        }
                                        if (invalidTokens.length > 0) {
                                          setCreateHotmartIdsHint(
                                            `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                          )
                                        } else if (ids.length > 0) {
                                          setCreateHotmartIdsHint(null)
                                        }
                                      }}
                                      onPaste={(e) => {
                                        const text = e.clipboardData.getData('text')
                                        const { ids, invalidTokens } = parseHotmartIdsFromText(text)
                                        if (ids.length > 0) {
                                          e.preventDefault()
                                          field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                        }
                                        if (invalidTokens.length > 0) {
                                          setCreateHotmartIdsHint(
                                            `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                          )
                                        }
                                      }}
                                    />
                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => {
                                        const { ids, invalidTokens } = parseHotmartIdsFromText(createHotmartIdDraft)
                                        if (ids.length > 0) {
                                          field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                          setCreateHotmartIdDraft('')
                                        }
                                        if (invalidTokens.length > 0) {
                                          setCreateHotmartIdsHint(
                                            `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                          )
                                        } else {
                                          setCreateHotmartIdsHint(null)
                                        }
                                      }}
                                    >
                                      Adicionar
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      onClick={async () => {
                                        try {
                                          const text = await navigator.clipboard.readText()
                                          const { ids, invalidTokens } = parseHotmartIdsFromText(text)
                                          if (ids.length > 0) {
                                            field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                          }
                                          if (invalidTokens.length > 0) {
                                            setCreateHotmartIdsHint(
                                              `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                            )
                                          } else if (ids.length > 0) {
                                            setCreateHotmartIdsHint(null)
                                          } else {
                                            setCreateHotmartIdsHint('Nada para importar da área de transferência.')
                                          }
                                        } catch {
                                          setCreateHotmartIdsHint('Não consegui ler a área de transferência. Use Ctrl+V no campo ao lado.')
                                        }
                                      }}
                                    >
                                      Colar e importar IDs
                                    </Button>
                                  </div>
                                </div>
                              </FormControl>
                              <FormDescription>
                                Os IDs ficam organizados em chips. Você pode digitar e confirmar com Enter/vírgula ou colar uma lista que o sistema separa automaticamente.
                              </FormDescription>
                              {createHotmartIdsHint ? (
                                <p className="text-sm text-muted-foreground">{createHotmartIdsHint}</p>
                              ) : null}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                      <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCreateDialogOpen(false)}
                          disabled={isSubmitting}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? 'Criando...' : 'Criar'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            ) : (
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
              >
                <Plus className="w-5 h-5" strokeWidth={1.5} />
                Novo Curso
              </button>
            )}
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Filtrar por nome..."
              className="w-full h-10 pl-9 pr-4 rounded-md border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors duration-200 motion-reduce:transition-none"
              value={(table.getColumn('name')?.getFilterValue() as string) ?? ''}
              onChange={(event) =>
                table.getColumn('name')?.setFilterValue(event.target.value)
              }
            />
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : table.getRowModel().rows?.length ? (
          <>
            {/* Mobile Card View */}
            <div className="block md:hidden space-y-4">
              {table.getRowModel().rows.map((row) => {
                const curso = row.original
                return (
                  <div key={row.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold">{curso.name}</h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">{curso.modality}</Badge>
                            <Badge variant="outline" className="text-xs">{curso.type}</Badge>
                            <Badge variant="outline" className="text-xs">{curso.year}</Badge>
                            <Badge variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {enrollmentCounts[curso.id] || 0} alunos
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => router.push(tenant ? `/${tenant}/curso/admin/${curso.id}` : `/curso/admin/${curso.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Visualizar alunos</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleEdit(curso)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(curso)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                      {curso.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{curso.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-hidden flex-1">
              <Table className="w-full text-left text-sm">
                <TableHeader className="border-b border-border">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="hover:bg-transparent">
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id} className="h-10 px-4 font-mono text-xs font-medium text-muted-foreground tracking-wider">
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className="group hover:bg-muted/50 transition-colors"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="p-4">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <section id="empty-state" className="flex-1 flex flex-col items-center justify-center min-h-100">
            <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-border">
              <BookOpen className="w-8 h-8 text-muted-foreground" strokeWidth={1} />
            </div>

            <h3 className="empty-state-title mb-2">Nenhum curso cadastrado</h3>
            <p className="section-subtitle text-center max-w-sm mb-8 leading-relaxed">
              Sua infraestrutura está pronta. Adicione cursos manualmente para começar a organizar seu conteúdo.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="h-10 px-6 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm flex items-center gap-2"
              >
                <Plus className="w-5 h-5" strokeWidth={1.5} />
                Adicionar Curso
              </button>
            </div>
          </section>
        )}

        {table.getRowModel().rows?.length > 0 && (
          <div className="border-t border-border px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Mostrando <strong>{table.getFilteredRowModel().rows.length}</strong> {table.getFilteredRowModel().rows.length === 1 ? 'resultado' : 'resultados'}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="px-3 py-1 border border-border bg-background rounded text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="px-3 py-1 border border-border bg-background rounded text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Próximo
              </button>
            </div>
          </div>
        )}

        </section>

        {/* Edit Dialog */}
        {mounted && editingCurso && (
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent fullScreenMobile className="md:max-w-2xl md:h-[90vh] md:flex md:flex-col md:overflow-hidden">
              <DialogHeader className="pb-4 border-b">
                <DialogTitle className="text-xl">Editar Curso</DialogTitle>
                <DialogDescription>
                  Atualize as informações do curso.
                </DialogDescription>
              </DialogHeader>
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(handleUpdate)} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
                  {/* Seção: Identificação */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Identificação</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                      <FormField
                        control={editForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-3">
                            <FormLabel>Nome *</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Matemática Básica" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="year"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Ano *</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="2024" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Seção: Configuração */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Configuração</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <FormField
                        control={editForm.control}
                        name="modalityId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Modalidade *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {modalidades.map((modality) => (
                                  <SelectItem key={modality.id} value={modality.id}>
                                    {modality.nome}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Superextensivo">Superextensivo</SelectItem>
                                <SelectItem value="Extensivo">Extensivo</SelectItem>
                                <SelectItem value="Intensivo">Intensivo</SelectItem>
                                <SelectItem value="Superintensivo">Superintensivo</SelectItem>
                                <SelectItem value="Revisão">Revisão</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="accessMonths"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Meses de Acesso</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="12"
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={editForm.control}
                      name="usaTurmas"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Habilitar Turmas</FormLabel>
                            <FormDescription>
                              Permite organizar alunos em turmas dentro do curso (ex: Manhã, Tarde, Turno A).
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Seção: Categorização */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Categorização</h3>
                    <FormField
                      control={editForm.control}
                      name="segmentId"
                      render={({ field }) => (
                        <FormItem className="sm:max-w-xs">
                          <FormLabel>Segmento</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                            value={field.value || '__none__'}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o segmento" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum</SelectItem>
                              {segmentos.map((segmento) => (
                                <SelectItem key={segmento.id} value={segmento.id}>
                                  {segmento.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editForm.control}
                      name="disciplineIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disciplinas</FormLabel>
                          <FormDescription className="text-xs">
                            Selecione uma ou mais disciplinas para este curso
                          </FormDescription>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border rounded-lg p-4 bg-muted/30">
                            {disciplinas.map((disciplina) => (
                              <div key={disciplina.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`edit-discipline-${disciplina.id}`}
                                  checked={field.value?.includes(disciplina.id) || false}
                                  onCheckedChange={(checked) => {
                                    const currentValue = field.value || []
                                    if (checked) {
                                      field.onChange([...currentValue, disciplina.id])
                                    } else {
                                      field.onChange(currentValue.filter((id) => id !== disciplina.id))
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`edit-discipline-${disciplina.id}`}
                                  className="text-sm leading-none cursor-pointer"
                                >
                                  {disciplina.name}
                                </label>
                              </div>
                            ))}
                            {disciplinas.length === 0 && (
                              <p className="text-sm text-muted-foreground col-span-full">
                                Nenhuma disciplina cadastrada
                              </p>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Seção: Descrição */}
                  <FormField
                    control={editForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descrição</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Descrição do curso..."
                            {...field}
                            value={field.value || ''}
                            rows={3}
                            className="resize-none"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Seção: Período */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Período</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Início</FormLabel>
                            <FormControl>
                              <DatePicker
                                value={field.value ? new Date(field.value) : null}
                                onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : null)}
                                placeholder="dd/mm/yyyy"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="endDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Término</FormLabel>
                            <FormControl>
                              <DatePicker
                                value={field.value ? new Date(field.value) : null}
                                onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : null)}
                                placeholder="dd/mm/yyyy"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Seção: Links */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Links</h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FormField
                        control={editForm.control}
                        name="planningUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL do Planejamento</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                placeholder="https://..."
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editForm.control}
                        name="coverImageUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL da Imagem de Capa</FormLabel>
                            <FormControl>
                              <Input
                                type="url"
                                placeholder="https://..."
                                {...field}
                                value={field.value || ''}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Seção: Integrações */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Integrações</h3>
                    <FormField
                      control={editForm.control}
                      name="hotmartProductIds"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>IDs do Produto Hotmart</FormLabel>
                          <FormControl>
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {(field.value ?? []).length === 0 ? (
                                  <span className="text-sm text-muted-foreground">Nenhum ID adicionado</span>
                                ) : (
                                  (field.value ?? []).map((id) => (
                                    <Badge key={id} variant="secondary" className="gap-1 pr-1">
                                      <span className="font-mono text-xs">{id}</span>
                                      <button
                                        type="button"
                                        className="rounded-sm hover:bg-muted/60 p-0.5"
                                        onClick={() =>
                                          field.onChange((field.value ?? []).filter((x) => x !== id))
                                        }
                                        aria-label={`Remover ID ${id}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </Badge>
                                  ))
                                )}
                              </div>

                              <div className="flex gap-2">
                                <Input
                                  placeholder="Digite um ID e pressione Enter"
                                  value={editHotmartIdDraft}
                                  onChange={(e) => setEditHotmartIdDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
                                      e.preventDefault()
                                      const { ids, invalidTokens } = parseHotmartIdsFromText(editHotmartIdDraft)
                                      if (ids.length > 0) {
                                        field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                        setEditHotmartIdDraft('')
                                      }
                                      if (invalidTokens.length > 0) {
                                        setEditHotmartIdsHint(
                                          `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                        )
                                      } else {
                                        setEditHotmartIdsHint(null)
                                      }
                                    }
                                  }}
                                  onBlur={() => {
                                    const { ids, invalidTokens } = parseHotmartIdsFromText(editHotmartIdDraft)
                                    if (ids.length > 0) {
                                      field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                      setEditHotmartIdDraft('')
                                    }
                                    if (invalidTokens.length > 0) {
                                      setEditHotmartIdsHint(
                                        `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                      )
                                    } else if (ids.length > 0) {
                                      setEditHotmartIdsHint(null)
                                    }
                                  }}
                                  onPaste={(e) => {
                                    const text = e.clipboardData.getData('text')
                                    const { ids, invalidTokens } = parseHotmartIdsFromText(text)
                                    if (ids.length > 0) {
                                      e.preventDefault()
                                      field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                    }
                                    if (invalidTokens.length > 0) {
                                      setEditHotmartIdsHint(
                                        `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                      )
                                    }
                                  }}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    const { ids, invalidTokens } = parseHotmartIdsFromText(editHotmartIdDraft)
                                    if (ids.length > 0) {
                                      field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                      setEditHotmartIdDraft('')
                                    }
                                    if (invalidTokens.length > 0) {
                                      setEditHotmartIdsHint(
                                        `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                      )
                                    } else {
                                      setEditHotmartIdsHint(null)
                                    }
                                  }}
                                >
                                  Adicionar
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={async () => {
                                    try {
                                      const text = await navigator.clipboard.readText()
                                      const { ids, invalidTokens } = parseHotmartIdsFromText(text)
                                      if (ids.length > 0) {
                                        field.onChange(Array.from(new Set([...(field.value ?? []), ...ids])))
                                      }
                                      if (invalidTokens.length > 0) {
                                        setEditHotmartIdsHint(
                                          `Ignorados (não numéricos): ${invalidTokens.join(', ')}${invalidTokens.length >= 5 ? '…' : ''}`
                                        )
                                      } else if (ids.length > 0) {
                                        setEditHotmartIdsHint(null)
                                      } else {
                                        setEditHotmartIdsHint('Nada para importar da área de transferência.')
                                      }
                                    } catch {
                                      setEditHotmartIdsHint('Não consegui ler a área de transferência. Use Ctrl+V no campo ao lado.')
                                    }
                                  }}
                                >
                                  Colar e importar IDs
                                </Button>
                              </div>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Os IDs ficam organizados em chips. Você pode digitar e confirmar com Enter/vírgula ou colar uma lista que o sistema separa automaticamente.
                          </FormDescription>
                          {editHotmartIdsHint ? (
                            <p className="text-sm text-muted-foreground">{editHotmartIdsHint}</p>
                          ) : null}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                  <DialogFooter className="pt-4 border-t gap-2 sm:gap-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditDialogOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Atualizando...' : 'Atualizar'}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}

        {/* Delete Alert Dialog */}
        {mounted && deletingCurso && (
          <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir o curso &quot;{deletingCurso.name}&quot;?
                  Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isSubmitting ? 'Excluindo...' : 'Excluir'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </TooltipProvider>
  )
}

