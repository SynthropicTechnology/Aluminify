'use client'

import { useState, useMemo } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Checkbox } from '@/app/shared/components/forms/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/app/shared/components/feedback/progress'
import { Card, CardContent } from '@/components/ui/card'
import { format, addDays } from 'date-fns'
import { GripVertical } from 'lucide-react'
import { createClient } from '@/app/shared/core/client'
import { cn } from '@/shared/library/utils'

interface CronogramaItem {
  id: string
  tipo: 'aula' | 'questoes_revisao'
  aula_id: string | null
  frente_id: string | null
  frente_nome_snapshot: string | null
  mensagem: string | null
  duracao_sugerida_minutos: number | null
  semana_numero: number
  ordem_na_semana: number
  concluido: boolean
  data_conclusao: string | null
  aulas: {
    id: string
    nome: string
    numero_aula: number | null
    tempo_estimado_minutos: number | null
    curso_id: string | null
    modulos: {
      id: string
      nome: string
      numero_modulo: number | null
      frentes: {
        id: string
        nome: string
        disciplinas: {
          id: string
          nome: string
        } | null
      } | null
    } | null
  } | null
}

const getItemTempoMinutos = (item: CronogramaItem) => {
  if (item.tipo === 'questoes_revisao') {
    return item.duracao_sugerida_minutos || 0
  }
  return item.aulas?.tempo_estimado_minutos || 0
}

interface ScheduleListProps {
  itensPorSemana: Record<number, CronogramaItem[]>
  dataInicio: string
  dataFim: string
  periodosFerias: Array<{ inicio: string; fim: string }>
  modalidade: 'paralelo' | 'sequencial'
  cronogramaId: string
  onToggleConcluido: (itemId: string, concluido: boolean) => void
  onUpdate: (updater: (prev: Record<number, CronogramaItem[]>) => Record<number, CronogramaItem[]>) => void
}

const formatTempo = (minutes: number) => {
  const rounded = Math.max(0, Math.round(minutes))
  const hours = Math.floor(rounded / 60)
  const mins = rounded % 60

  const parts = []
  if (hours > 0) {
    parts.push(`${hours}h`)
  }
  if (mins > 0) {
    parts.push(`${mins} min`)
  }

  if (parts.length === 0) {
    return '0 min'
  }

  return parts.join(' ')
}

function AulaItem({
  item,
  onToggleConcluido,
}: {
  item: CronogramaItem
  onToggleConcluido: (itemId: string, concluido: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const disciplinaNome = item.aulas?.modulos?.frentes?.disciplinas?.nome
  const frenteNome = item.aulas?.modulos?.frentes?.nome
  const moduloNome = item.aulas?.modulos?.nome
  const moduloNumero = item.aulas?.modulos?.numero_modulo
  const isQuestoesRevisao = item.tipo === 'questoes_revisao'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors",
        item.concluido && "opacity-60"
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing shrink-0"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {!isQuestoesRevisao && (
        <Checkbox
          checked={item.concluido}
          onCheckedChange={(checked) =>
            onToggleConcluido(item.id, checked as boolean)
          }
          className="shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="flex-1 min-w-0">
        {isQuestoesRevisao ? (
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                Questões e revisão
              </Badge>
              {item.frente_nome_snapshot && (
                <Badge variant="outline" className="text-xs whitespace-nowrap text-muted-foreground">
                  {item.frente_nome_snapshot}
                </Badge>
              )}
            </div>
            <span className="text-sm">
              {item.mensagem || 'Você acabou o conteúdo desta frente. Use este tempo para questões e revisão.'}
            </span>
          </div>
        ) : item.aulas ? (
          <div className="flex flex-col gap-1">
            {/* Linha 1: Disciplina, Frente, Módulo */}
            <div className="flex flex-wrap items-center gap-1.5">
              {disciplinaNome && (
                <Badge variant="default" className="text-xs whitespace-nowrap">
                  {disciplinaNome}
                </Badge>
              )}
              {frenteNome && (
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {frenteNome}
                </Badge>
              )}
              {(moduloNumero || moduloNome) && (
                <Badge variant="outline" className="text-xs whitespace-nowrap text-muted-foreground">
                  {moduloNumero ? `M${moduloNumero}` : ''}{moduloNumero && moduloNome ? ' · ' : ''}{moduloNome || ''}
                </Badge>
              )}
            </div>
            {/* Linha 2: Número da aula + Nome da aula */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">
                Aula {item.aulas.numero_aula || 'N/A'}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className={cn("text-sm truncate", item.concluido && "line-through")}>
                {item.aulas.nome}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Aula não disponível{item.aula_id ? ` (ID: ${item.aula_id})` : ''}
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
        {getItemTempoMinutos(item) > 0
          ? formatTempo(getItemTempoMinutos(item))
          : '--'}
      </div>
    </div>
  )
}

export function ScheduleList({
  itensPorSemana,
  dataInicio,
  dataFim,
  periodosFerias,
  modalidade: _modalidade,
  cronogramaId: _cronogramaId,
  onToggleConcluido,
  onUpdate,
}: ScheduleListProps) {
  void _cronogramaId // Marked as intentionally unused
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Calcular todas as semanas do período (data_inicio até data_fim)
  const todasSemanas = useMemo(() => {
    const dataInicioDate = new Date(dataInicio)
    const dataFimDate = new Date(dataFim)
    const weeks: number[] = []
    let semanaNumero = 1
    const dataAtual = new Date(dataInicioDate)

    while (dataAtual <= dataFimDate) {
      weeks.push(semanaNumero)
      dataAtual.setDate(dataAtual.getDate() + 7)
      semanaNumero++
    }
    return weeks
  }, [dataInicio, dataFim])

  // Usar todas as semanas, não apenas as que têm itens
  const semanas = todasSemanas

  // Pre-calculate sorted items for each week
  const sortedItemsByWeek = useMemo(() => {
    const result: Record<number, CronogramaItem[]> = {}
    semanas.forEach((semana) => {
      const itens = itensPorSemana[semana] || []
      result[semana] = [...itens].sort((a, b) => {
        const discA = a.aulas?.modulos?.frentes?.disciplinas?.nome || ''
        const discB = b.aulas?.modulos?.frentes?.disciplinas?.nome || ''
        if (discA !== discB) return discA.localeCompare(discB)

        const frenteA = a.aulas?.modulos?.frentes?.nome || ''
        const frenteB = b.aulas?.modulos?.frentes?.nome || ''
        if (frenteA !== frenteB) return frenteA.localeCompare(frenteB)

        const modA = a.aulas?.modulos?.numero_modulo || 0
        const modB = b.aulas?.modulos?.numero_modulo || 0
        if (modA !== modB) return modA - modB

        const aulaA = a.aulas?.numero_aula || 0
        const aulaB = b.aulas?.numero_aula || 0
        return aulaA - aulaB
      })
    })
    return result
  }, [semanas, itensPorSemana])

  const getSemanaDates = (semanaNumero: number) => {
    const inicio = new Date(dataInicio)
    const inicioSemana = addDays(inicio, (semanaNumero - 1) * 7)
    const fimSemana = addDays(inicioSemana, 6)
    return { inicioSemana, fimSemana }
  }

  // Verificar se uma semana é período de férias
  const isSemanaFerias = (semanaNumero: number): boolean => {
    const { inicioSemana, fimSemana } = getSemanaDates(semanaNumero)

    for (const periodo of periodosFerias || []) {
      const inicioFerias = new Date(periodo.inicio)
      const fimFerias = new Date(periodo.fim)

      // Verificar se a semana se sobrepõe ao período de férias
      if (
        (inicioSemana >= inicioFerias && inicioSemana <= fimFerias) ||
        (fimSemana >= inicioFerias && fimSemana <= fimFerias) ||
        (inicioSemana <= inicioFerias && fimSemana >= fimFerias)
      ) {
        return true
      }
    }
    return false
  }

  // Encontrar a última semana com aulas
  const semanasComAulas = Object.keys(itensPorSemana)
    .map(Number)
    .filter(semana => (itensPorSemana[semana] || []).length > 0)

  const ultimaSemanaComAulas = semanasComAulas.length > 0
    ? Math.max(...semanasComAulas)
    : 0

  // Verificar se o cronograma terminou antes do tempo disponível
  const cronogramaTerminouAntes = ultimaSemanaComAulas > 0 && ultimaSemanaComAulas < semanas.length

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const itemId = active.id as string
    const overId = over.id as string

    // Encontrar o item atual e sua semana
    let itemAtual: CronogramaItem | null = null
    let semanaAtual = 0

    for (const [semana, itens] of Object.entries(itensPorSemana)) {
      const item = itens.find((i) => i.id === itemId)
      if (item) {
        itemAtual = item
        semanaAtual = Number(semana)
        break
      }
    }

    if (!itemAtual) return

    // Verificar se está sendo arrastado para outro item (reordenação)
    const itemSobre = Object.values(itensPorSemana)
      .flat()
      .find((i) => i.id === overId)

    if (itemSobre && itemSobre.semana_numero === semanaAtual) {
      // Reordenação dentro da mesma semana
      const itens = [...itensPorSemana[semanaAtual]]
      const oldIndex = itens.findIndex((i) => i.id === itemId)
      const newIndex = itens.findIndex((i) => i.id === overId)

      if (oldIndex !== newIndex && newIndex !== -1) {
        const newItems = arrayMove(itens, oldIndex, newIndex)
        const itensAtualizados = newItems.map((item, index) => ({
          ...item,
          ordem_na_semana: index + 1,
        }))

        // Atualizar no banco
        const supabase = createClient()
        for (const item of itensAtualizados) {
          // Type assertion needed because database types are currently out of sync with actual schema
          await supabase
            .from('cronograma_itens')
            .update({ ordem_na_semana: item.ordem_na_semana })
            .eq('id', item.id)
        }

        // Atualizar estado local
        onUpdate((prev) => {
          if (!prev) return prev
          const newPrev: Record<number, CronogramaItem[]> = {}
          for (const [weekNum, items] of Object.entries(prev)) {
            newPrev[Number(weekNum)] = items.map((item: CronogramaItem) => {
              const updated = itensAtualizados.find((i) => i.id === item.id)
              return updated || item
            })
          }
          return newPrev
        })
      }
    }
  }

  const activeItem = activeId
    ? Object.values(itensPorSemana)
      .flat()
      .find((item) => item.id === activeId)
    : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Accordion type="multiple" className="w-full">
        {semanas.map((semana) => {
          const itens = itensPorSemana[semana] || []
          const itensAula = itens.filter((item) => item.tipo === 'aula')
          const concluidos = itensAula.filter((item) => item.concluido).length
          const totalAulasSemana = itensAula.length
          const { inicioSemana, fimSemana } = getSemanaDates(semana)

          const temAulas = itens && itens.length > 0
          const isFerias = isSemanaFerias(semana)
          const isAposTermino = cronogramaTerminouAntes && semana > ultimaSemanaComAulas

          const itensOrdenados = sortedItemsByWeek[semana] || []

          return (
            <AccordionItem key={semana} value={`semana-${semana}`}>
              <AccordionTrigger>
                <div className="flex items-center justify-between w-full mr-4">
                  <div className="flex items-center gap-4">
                    <span className="font-semibold">
                      Semana {semana} ({format(inicioSemana, 'dd/MM')} - {format(fimSemana, 'dd/MM')})
                    </span>
                    {!temAulas && isFerias && (
                      <Badge variant="secondary" className="text-xs">
                        Período de Descanso
                      </Badge>
                    )}
                    {!temAulas && isAposTermino && (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-900 border-green-200 dark:bg-green-950/40 dark:text-green-100 dark:border-green-800">
                        Já acabou? Então bora pra revisão!
                      </Badge>
                    )}
                  </div>
                  {temAulas && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex flex-col items-end gap-1">
                        <span>
                          {concluidos} de {totalAulasSemana} aulas
                        </span>
                        {(() => {
                          const tempoAulas = itensAula.reduce((acc, item) => {
                            return acc + getItemTempoMinutos(item)
                          }, 0)
                          const tempoQuestoes = itens
                            .filter((item) => item.tipo === 'questoes_revisao')
                            .reduce((acc, item) => acc + getItemTempoMinutos(item), 0)
                          const tempoAnotacoesExercicios = tempoAulas * 0.5
                          const tempoTotal = tempoAulas + tempoAnotacoesExercicios + tempoQuestoes
                          return (
                            <span className="text-xs">
                              {formatTempo(tempoTotal)}
                            </span>
                          )
                        })()}
                      </div>
                      <Progress
                        value={totalAulasSemana > 0 ? (concluidos / totalAulasSemana) * 100 : 0}
                        className="w-24 h-2"
                      />
                    </div>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-2 space-y-4">
                  {temAulas && (
                    <div className="bg-muted/50 p-3 rounded-lg border">
                      <h4 className="font-semibold text-sm mb-2">Previsão de Tempo - Semana {semana}</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Aulas:</span>
                          <p className="font-medium">
                            {formatTempo(
                              itensAula.reduce(
                                (acc, item) => acc + getItemTempoMinutos(item),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Questões/Revisão:</span>
                          <p className="font-medium">
                            {formatTempo(
                              itens.reduce(
                                (acc, item) =>
                                  acc +
                                  (item.tipo === 'questoes_revisao'
                                    ? getItemTempoMinutos(item)
                                    : getItemTempoMinutos(item) * 0.5),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <p className="font-semibold">
                            {formatTempo(
                              itens.reduce(
                                (acc, item) =>
                                  acc +
                                  (item.tipo === 'questoes_revisao'
                                    ? getItemTempoMinutos(item)
                                    : getItemTempoMinutos(item) * 1.5),
                                0,
                              ),
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!temAulas ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {isFerias ? (
                        <p>Período de descanso - Nenhuma aula agendada</p>
                      ) : isAposTermino ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-green-700">Já acabou? Então bora pra revisão!</p>
                          <p className="text-sm">Você concluiu todas as aulas do cronograma antes do previsto. Use este tempo para revisar o conteúdo estudado!</p>
                        </div>
                      ) : (
                        <p>Nenhuma aula agendada para esta semana</p>
                      )}
                    </div>
                  ) : (
                    <SortableContext
                      items={itensOrdenados.map((item) => item.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-1">
                        {itensOrdenados.map((item) => (
                          <AulaItem
                            key={item.id}
                            item={item}
                            onToggleConcluido={onToggleConcluido}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
      <DragOverlay>
        {activeItem ? (
          <Card className="w-full">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <GripVertical className="h-4 w-4 text-muted-foreground mt-1" />
                {activeItem.aulas && (
                  <div className="flex-1">
                    <Badge variant="outline" className="text-xs mb-1">
                      Aula {activeItem.aulas.numero_aula || 'N/A'}
                    </Badge>
                    <p className="text-sm font-medium">{activeItem.aulas.nome}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}