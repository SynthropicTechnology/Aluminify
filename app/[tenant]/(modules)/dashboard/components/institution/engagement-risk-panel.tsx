'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Mail, Phone, UsersRound } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/shared/components/dataviz/table'
import { ScrollArea } from '@/app/shared/components/ui/scroll-area'
import { downloadFile } from '@/shared/library/download-file'
import type {
  StudentEngagementContact,
  StudentEngagementFilter,
  StudentEngagementRow,
  StudentEngagementSummary,
} from '@/app/[tenant]/(modules)/dashboard/types'
import { EngagementStatusBadge } from './engagement-status-badge'
import { ContactActions } from './contact-actions'
import { cn } from '@/lib/utils'

interface EngagementRiskPanelProps {
  summary: StudentEngagementSummary
  students: StudentEngagementRow[]
  period: 'semanal' | 'mensal' | 'anual'
  activeFilter: StudentEngagementFilter
  onFilterChange: (filter: StudentEngagementFilter) => void
}

const FILTERS: Array<{ id: StudentEngagementFilter; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'sem_acesso', label: 'Sem acesso' },
  { id: 'acessou_sem_estudo', label: 'Acessou e não estudou' },
  { id: 'sem_cronograma', label: 'Sem cronograma' },
  { id: 'baixo_engajamento', label: 'Baixo engajamento' },
  { id: 'sem_conclusao', label: 'Sem conclusão' },
]

function formatDate(value: string | null): string {
  if (!value) return 'Nunca'
  return new Date(value).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

async function copyText(value: string, successMessage: string) {
  if (!value.trim()) {
    toast.warning('Não há dados para copiar.')
    return
  }
  try {
    await navigator.clipboard.writeText(value)
    toast.success(successMessage)
  } catch {
    toast.error('Não foi possível copiar automaticamente.')
  }
}

export function EngagementRiskPanel({
  summary,
  students,
  period,
  activeFilter,
  onFilterChange,
}: EngagementRiskPanelProps) {
  const [rows, setRows] = useState(students)
  const [isLoadingRows, setIsLoadingRows] = useState(false)
  const [rowsError, setRowsError] = useState<string | null>(null)

  useEffect(() => {
    setRows(students)
  }, [students])

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadRows() {
      setIsLoadingRows(true)
      setRowsError(null)
      try {
        const params = new URLSearchParams({
          period,
          filter: activeFilter,
          includeEngaged: 'false',
        })
        const response = await fetch(
          `/api/dashboard/institution/students/engagement?${params.toString()}`,
          { signal: controller.signal },
        )
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error(payload?.error || 'Erro ao carregar alunos')
        }

        if (!cancelled && Array.isArray(payload?.data?.students)) {
          setRows(payload.data.students as StudentEngagementRow[])
        }
      } catch (error) {
        if (cancelled || controller.signal.aborted) return
        setRowsError(error instanceof Error ? error.message : 'Erro ao carregar alunos')
      } finally {
        if (!cancelled) setIsLoadingRows(false)
      }
    }

    void loadRows()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [activeFilter, period])

  const filteredRows = useMemo(() => {
    if (activeFilter === 'todos') return rows
    return rows.filter((student) => student.status === activeFilter)
  }, [activeFilter, rows])

  const visibleRows = filteredRows.slice(0, 50)

  const handleContactRecorded = (
    studentId: string,
    contact: StudentEngagementContact,
  ) => {
    setRows((current) =>
      current.map((student) =>
        student.id === studentId ? { ...student, lastContact: contact } : student,
      ),
    )
    toast.success('Contato registrado no histórico.')
  }

  const handleExport = async () => {
    const params = new URLSearchParams({
      period,
      filter: activeFilter,
      format: 'csv',
      includeEngaged: 'false',
    })
    await downloadFile({
      url: `/api/dashboard/institution/students/engagement?${params.toString()}`,
      fallbackFilename: `alunos-engajamento-${period}-${activeFilter}.csv`,
    })
  }

  return (
    <Card
      id="alunos-atencao"
      className="group overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5"
    >
      <div className="h-0.5 bg-linear-to-r from-rose-400 to-amber-500" />
      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-rose-500 to-amber-500">
              <UsersRound className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="widget-title">Alunos que precisam de atenção</h3>
              <p className="text-xs text-muted-foreground">
                {isLoadingRows ? 'Carregando alunos...' : `${filteredRows.length} aluno(s) no filtro atual`} · {summary.withoutAccess} sem acesso ·{' '}
                {summary.loggedWithoutStudy} acessaram sem estudar
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Última atualização: {new Date(summary.generatedAt).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                copyText(
                  filteredRows.map((student) => student.email).filter(Boolean).join('; '),
                  'Lista de e-mails copiada.',
                )
              }
            >
              <Mail className="mr-2 h-4 w-4" />
              E-mails
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                copyText(
                  filteredRows.map((student) => student.telefone).filter(Boolean).join('\n'),
                  'Lista de telefones copiada.',
                )
              }
            >
              <Phone className="mr-2 h-4 w-4" />
              Telefones
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFilterChange(filter.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                activeFilter === filter.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {!summary.flashcardsAvailable && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            Nenhum flashcard cadastrado nesta instituição. O uso de flashcards ficará zerado até que
            existam cards vinculados ao tenant.
          </div>
        )}

        {rowsError && (
          <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {rowsError}. Tente trocar o filtro ou atualizar a dashboard.
          </div>
        )}

        {isLoadingRows ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed">
            <p className="text-sm text-muted-foreground">Carregando lista de alunos...</p>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-dashed">
            <p className="text-sm text-muted-foreground">
              Nenhum aluno encontrado para este filtro.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[520px] rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último acesso</TableHead>
                  <TableHead>Estudo</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="min-w-64 whitespace-normal">
                      <div className="space-y-1">
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {student.cursos.slice(0, 2).join(', ') || 'Sem curso identificado'}
                          {student.cursos.length > 2 ? ` +${student.cursos.length - 2}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {student.email || 'Sem e-mail'} · {student.telefone || 'Sem telefone'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <EngagementStatusBadge
                        status={student.status}
                        label={student.statusLabel}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{formatDate(student.lastLoginAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        {student.loginsNoPeriodo} login(s)
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm tabular-nums">{student.studyTimeLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        {student.completionsNoPeriodo} conclusão(ões)
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {student.lastContact
                          ? `Último: ${formatDate(student.lastContact.contactedAt)}`
                          : 'Ainda não contatado'}
                      </div>
                      {student.recoveredAfterContact && (
                        <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Recuperado
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <ContactActions
                        student={student}
                        onContactRecorded={handleContactRecorded}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredRows.length > visibleRows.length && (
              <p className="p-3 text-center text-xs text-muted-foreground">
                Mostrando os primeiros {visibleRows.length} de {filteredRows.length}. Use exportar
                para baixar a lista completa.
              </p>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
