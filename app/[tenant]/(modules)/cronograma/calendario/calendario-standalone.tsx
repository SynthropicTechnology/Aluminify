'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CalendarCheck, Plus, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/shared/components/forms/select'
import { PageShell } from '@/app/shared/components/layout/page-shell'
import { ScheduleCalendarView } from '../components/schedule-calendar-view'

interface CronogramaSummary {
  id: string
  nome: string | null
  data_inicio: string
  data_fim: string
  modalidade_estudo: string
  curso_alvo_id: string | null
  curso_nome: string | null
}

interface CalendarioStandalonePageProps {
  cronogramas: CronogramaSummary[]
}

export function CalendarioStandalonePage({ cronogramas }: CalendarioStandalonePageProps) {
  const router = useRouter()
  const params = useParams()
  const tenant = params?.tenant as string

  const [selectedCronogramaId, setSelectedCronogramaId] = useState<string>(
    cronogramas.length > 1 ? 'all' : (cronogramas.length > 0 ? cronogramas[0].id : ''),
  )

  const navigateTo = (path: string) => {
    router.push(tenant ? `/${tenant}${path}` : path)
  }

  if (cronogramas.length === 0) {
    return (
      <PageShell
        title="Calendário"
        subtitle="Visualize seu cronograma no formato de calendário"
      >
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <CalendarCheck className="h-12 w-12 text-muted-foreground/50" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Nenhum cronograma encontrado</p>
            <p className="text-sm text-muted-foreground">
              Crie um cronograma de estudo para visualizar o calendário.
            </p>
          </div>
          <Button onClick={() => navigateTo('/cronograma/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Gerar cronograma
          </Button>
        </div>
      </PageShell>
    )
  }

  const getCronogramaLabel = (c: CronogramaSummary) => {
    if (c.curso_nome) {
      return `${c.curso_nome} — ${c.nome || 'Cronograma'}`
    }
    return c.nome || 'Cronograma sem nome'
  }

  return (
    <PageShell
      title="Calendário"
      subtitle="Visualize seu cronograma no formato de calendário"
      actions={
        <Button variant="ghost" size="sm" onClick={() => navigateTo('/cronograma')}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      {cronogramas.length > 1 && (
        <div className="flex items-center gap-2">
          <Select value={selectedCronogramaId} onValueChange={setSelectedCronogramaId}>
            <SelectTrigger className="w-full sm:w-80">
              <SelectValue placeholder="Selecione um cronograma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Todos os cursos
              </SelectItem>
              {cronogramas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {getCronogramaLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedCronogramaId === 'all' ? (
        <ScheduleCalendarView
          key="all"
          cronogramaIds={cronogramas.map(c => c.id)}
          mode="consolidated"
        />
      ) : selectedCronogramaId ? (
        <ScheduleCalendarView
          key={selectedCronogramaId}
          cronogramaId={selectedCronogramaId}
        />
      ) : null}
    </PageShell>
  )
}
