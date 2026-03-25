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
import { ArrowUpDown, Pencil, Trash2, Plus, GraduationCap, Search } from 'lucide-react'
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/shared/components/forms/form'
import { Input } from '@/app/shared/components/forms/input'
import { Textarea } from '@/app/shared/components/forms/textarea'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import { apiClient, ApiClientError } from '@/shared/library/api-client'
import { TableSkeleton } from '@/app/shared/components/ui/table-skeleton'
import { formatBRPhone, formatCPF, isValidBRPhone, isValidCPF } from '@/shared/library/br'

export type Professor = {
  id: string
  fullName: string
  email: string
  cpf: string | null
  phone: string | null
  pixKey: string | null
  biography: string | null
  photoUrl: string | null
  specialty: string | null
  createdAt: string
  updatedAt: string
}

const professorSchema = z.object({
  fullName: z.string().min(1, 'Nome completo é obrigatório'),
  email: z.string().email('Email inválido').min(1, 'Email é obrigatório'),
  cpf: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.trim() === '' || isValidCPF(v), 'CPF inválido'),
  phone: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || v.trim() === '' || isValidBRPhone(v), 'Telefone inválido'),
  pixKey: z.string().optional().nullable(),
  biography: z.string().optional().nullable(),
  photoUrl: z.string().url('URL inválida').optional().nullable().or(z.literal('')),
  specialty: z.string().optional().nullable(),
})

type ProfessorFormValues = z.infer<typeof professorSchema>

export function ProfessorTable() {
  const [data, setData] = React.useState<Professor[]>([])
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
  const [editingProfessor, setEditingProfessor] = React.useState<Professor | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deletingProfessor, setDeletingProfessor] = React.useState<Professor | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const createForm = useForm<ProfessorFormValues>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      fullName: '',
      email: '',
      cpf: null,
      phone: null,
      pixKey: null,
      biography: null,
      photoUrl: null,
      specialty: null,
    },
  })

  const editForm = useForm<ProfessorFormValues>({
    resolver: zodResolver(professorSchema),
    defaultValues: {
      fullName: '',
      email: '',
      cpf: null,
      phone: null,
      pixKey: null,
      biography: null,
      photoUrl: null,
      specialty: null,
    },
  })

  const fetchProfessores = React.useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.get<{ data: Professor[] }>('/api/usuario/professores')
      if (response && 'data' in response) {
        setData(response.data)
      } else {
        setError('Resposta inválida da API')
      }
    } catch (err) {
      let errorMessage = 'Erro ao carregar professores'
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
      console.error('Error fetching professores:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchProfessores()
  }, [fetchProfessores])

  const handleCreate = async (values: ProfessorFormValues) => {
    try {
      setIsSubmitting(true)
      setError(null)
      await apiClient.post<{ data: Professor }>('/api/usuario/professores', {
        ...values,
        cpf: values.cpf || undefined,
        phone: values.phone || undefined,
        pixKey: values.pixKey || undefined,
        biography: values.biography || undefined,
        photoUrl: values.photoUrl || undefined,
        specialty: values.specialty || undefined,
      })
      setSuccessMessage('Professor criado com sucesso!')
      setCreateDialogOpen(false)
      createForm.reset()
      await fetchProfessores()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      let errorMessage = 'Erro ao criar professor'
      if (err instanceof ApiClientError) {
        if (err.status === 401) {
          errorMessage = 'Não autorizado. Faça login novamente.'
        } else if (err.status === 403) {
          errorMessage = 'Acesso negado.'
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

  const handleEdit = (professor: Professor) => {
    setEditingProfessor(professor)
    editForm.reset({
      fullName: professor.fullName,
      email: professor.email,
      cpf: professor.cpf,
      phone: professor.phone,
      pixKey: professor.pixKey,
      biography: professor.biography,
      photoUrl: professor.photoUrl,
      specialty: professor.specialty,
    })
    setEditDialogOpen(true)
  }

  const handleUpdate = async (values: ProfessorFormValues) => {
    if (!editingProfessor) return

    try {
      setIsSubmitting(true)
      setError(null)
      // Preparar payload - só incluir campos que foram alterados ou que têm valores válidos
      const updatePayload: {
        fullName?: string
        email?: string
        cpf?: string | null
        phone?: string | null
        pixKey?: string | null
        biography?: string | null
        photoUrl?: string | null
        specialty?: string | null
      } = {}

      // Sempre incluir fullName e email (são obrigatórios)
      if (values.fullName !== undefined) {
        updatePayload.fullName = values.fullName
      }
      if (values.email !== undefined) {
        updatePayload.email = values.email
      }

      // Campos opcionais
      updatePayload.cpf = values.cpf || null
      updatePayload.phone = values.phone || null
      updatePayload.pixKey = values.pixKey || null
      updatePayload.biography = values.biography || null
      updatePayload.photoUrl = values.photoUrl || null
      updatePayload.specialty = values.specialty || null

      await apiClient.put<{ data: Professor }>(`/api/usuario/professores/${editingProfessor.id}`, updatePayload)
      setSuccessMessage('Professor atualizado com sucesso!')
      setEditDialogOpen(false)
      setEditingProfessor(null)
      editForm.reset()
      await fetchProfessores()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof ApiClientError
        ? err.data?.error || err.message
        : 'Erro ao atualizar professor'
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClick = (professor: Professor) => {
    setDeletingProfessor(professor)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deletingProfessor) return

    try {
      setIsSubmitting(true)
      setError(null)
      await apiClient.delete(`/api/usuario/professores/${deletingProfessor.id}`)
      setSuccessMessage('Professor excluído com sucesso!')
      setDeleteDialogOpen(false)
      setDeletingProfessor(null)
      await fetchProfessores()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      const errorMessage = err instanceof ApiClientError
        ? err.data?.error || err.message
        : 'Erro ao excluir professor'
      setError(errorMessage)
      setTimeout(() => setError(null), 5000)
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<Professor>[] = [
    {
      accessorKey: 'fullName',
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
      cell: ({ row }) => <div className="font-medium">{row.getValue('fullName')}</div>,
    },
    {
      accessorKey: 'email',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
      cell: ({ row }) => <div>{row.getValue('email')}</div>,
    },
    {
      accessorKey: 'specialty',
      header: 'Especialidade',
      cell: ({ row }) => <div>{row.getValue('specialty') || '-'}</div>,
    },
    {
      accessorKey: 'phone',
      header: 'Telefone',
      cell: ({ row }) => <div>{row.getValue('phone') || '-'}</div>,
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
        const professor = row.original

        return (
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleEdit(professor)}
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
                  onClick={() => handleDeleteClick(professor)}
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
          <h1 className="page-title">Professores</h1>
          <p className="page-subtitle">Gerencie os professores do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          {mounted ? (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex h-9 md:h-8 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90 hover:shadow-md">
                  <Plus className="w-5 h-5" strokeWidth={1.5} />
                  Novo Professor
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] md:max-w-4xl">
                <DialogHeader>
                  <DialogTitle>Criar Professor</DialogTitle>
                  <DialogDescription>
                    Adicione um novo professor ao sistema.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField
                        control={createForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo *</FormLabel>
                            <FormControl>
                              <Input placeholder="João Silva" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email *</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="joao@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField
                        control={createForm.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="000.000.000-00"
                                inputMode="numeric"
                                maxLength={14}
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(formatCPF(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={createForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="(11) 99999-9999"
                                inputMode="numeric"
                                maxLength={15}
                                {...field}
                                value={field.value || ''}
                                onChange={(e) => field.onChange(formatBRPhone(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <FormField
                        control={createForm.control}
                        name="pixKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Chave PIX</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="CPF, email, telefone ou chave aleatória"
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
                        name="specialty"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Especialidade</FormLabel>
                            <FormControl>
                              <Input placeholder="Ex: Matemática, Física" {...field} value={field.value || ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={createForm.control}
                      name="biography"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Biografia</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Biografia do professor..."
                              {...field}
                              value={field.value || ''}
                              rows={2}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="photoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL da Foto</FormLabel>
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
                    <DialogFooter>
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
              className="flex h-9 md:h-8 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90 hover:shadow-md"
            >
              <Plus className="w-5 h-5" strokeWidth={1.5} />
              Novo Professor
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 w-5 h-5 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Filtrar por nome ou email..."
            className="w-full h-10 rounded-xl border border-border/40 bg-card/50 pl-9 pr-4 text-sm placeholder:text-muted-foreground shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={(table.getColumn('fullName')?.getFilterValue() as string) ?? ''}
            onChange={(event) => {
              const value = event.target.value
              table.getColumn('fullName')?.setFilterValue(value)
              table.getColumn('email')?.setFilterValue(value)
            }}
          />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} columns={7} />
      ) : table.getRowModel().rows?.length ? (
        <>
          {/* Mobile Card View */}
          <div className="block md:hidden space-y-4">
            {table.getRowModel().rows.map((row) => {
              const professor = row.original
              return (
                <div key={row.id} className="rounded-xl border border-border/40 bg-card/80 p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{professor.fullName}</h3>
                        <p className="text-sm text-muted-foreground">{professor.email}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => handleEdit(professor)}
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
                              onClick={() => handleDeleteClick(professor)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Excluir</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {professor.specialty && (
                        <div>
                          <span className="text-muted-foreground">Especialidade: </span>
                          <span>{professor.specialty}</span>
                        </div>
                      )}
                      {professor.phone && (
                        <div>
                          <span className="text-muted-foreground">Telefone: </span>
                          <span>{professor.phone}</span>
                        </div>
                      )}
                      {professor.cpf && (
                        <div>
                          <span className="text-muted-foreground">CPF: </span>
                          <span>{professor.cpf}</span>
                        </div>
                      )}
                      {professor.pixKey && (
                        <div>
                          <span className="text-muted-foreground">Chave PIX: </span>
                          <span>{professor.pixKey}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden flex-1">
            <Table className="w-full text-left text-sm">
              <TableHeader className="border-b border-border/40">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} className="h-10 px-4 font-mono text-xs font-medium text-muted-foreground uppercase tracking-wider">
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
        <section id="empty-state" className="flex flex-1 flex-col items-center justify-center min-h-100">
          <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center mb-6 border border-border">
            <GraduationCap className="w-8 h-8 text-muted-foreground" strokeWidth={1} />
          </div>

          <h3 className="empty-state-title mb-2">Nenhum professor cadastrado</h3>
          <p className="section-subtitle text-center max-w-sm mb-8 leading-relaxed">
            Sua infraestrutura está pronta. Adicione professores manualmente para organizar sua equipe.
          </p>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateDialogOpen(true)}
              className="flex h-9 md:h-8 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary/90 hover:shadow-md"
            >
              <Plus className="w-5 h-5" strokeWidth={1.5} />
              Adicionar Professor
            </button>
          </div>
        </section>
      )}

      {table.getRowModel().rows?.length > 0 && (
        <div className="border-t border-border/40 px-4 py-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Mostrando <strong>{table.getFilteredRowModel().rows.length}</strong> resultados
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1 border border-border/40 bg-card/50 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
            >
              Anterior
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1 border border-border/40 bg-card/50 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Próximo
            </button>
          </div>
        </div>
      )}

      </section>

      {/* Edit Dialog */}
      {mounted && editingProfessor && (
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-[95vw] md:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Editar Professor</DialogTitle>
              <DialogDescription>
                Atualize as informações do professor.
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={editForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input placeholder="João Silva" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="joao@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={editForm.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="000.000.000-00"
                            inputMode="numeric"
                            maxLength={14}
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(formatCPF(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="(11) 99999-9999"
                            inputMode="numeric"
                            maxLength={15}
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(formatBRPhone(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <FormField
                    control={editForm.control}
                    name="pixKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave PIX</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="CPF, email, telefone ou chave aleatória"
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
                    name="specialty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Especialidade</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Matemática, Física" {...field} value={field.value || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={editForm.control}
                  name="biography"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Biografia</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Biografia do professor..."
                          {...field}
                          value={field.value || ''}
                          rows={2}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="photoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL da Foto</FormLabel>
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
                <DialogFooter>
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
      {mounted && deletingProfessor && (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o professor &quot;{deletingProfessor.fullName}&quot;?
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

