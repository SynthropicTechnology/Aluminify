'use client'

import { useMemo, useState } from 'react'
import type { HeatmapDay } from '../types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/shared/components/overlay/tooltip'
import { Info, CalendarOff } from 'lucide-react'
import { cn } from '@/app/shared/library/utils'

export type HeatmapPeriod = 'semanal' | 'mensal' | 'anual'

interface ConsistencyHeatmapProps {
  data: HeatmapDay[]
  period?: HeatmapPeriod
  onPeriodChange?: (period: HeatmapPeriod) => void
  showPeriodButtons?: boolean
  tooltipParagraphs?: string[]
}

const DEFAULT_TOOLTIP_PARAGRAPHS = [
  'Este gráfico mostra sua frequência de estudo ao longo do tempo.',
  'Cores mais escuras significam mais tempo de estudo.',
]

const DAY_LABELS = ['Seg', '', 'Qua', '', 'Sex', '', 'Dom']
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getIntensityClass(intensity: number) {
  switch (intensity) {
    case 0:
      return 'bg-muted/40 hover:bg-muted/60'
    case 1:
      return 'bg-emerald-500/40 hover:bg-emerald-500/50 dark:bg-emerald-400/40 dark:hover:bg-emerald-400/50'
    case 2:
      return 'bg-emerald-500/60 hover:bg-emerald-500/70 dark:bg-emerald-400/60 dark:hover:bg-emerald-400/70'
    case 3:
      return 'bg-emerald-500/80 hover:bg-emerald-500/90 dark:bg-emerald-400/80 dark:hover:bg-emerald-400/90'
    case 4:
      return 'bg-emerald-500 hover:bg-emerald-500/90 dark:bg-emerald-400 dark:hover:bg-emerald-400/90'
    default:
      return 'bg-muted/40'
  }
}

function getIntensityLabel(intensity: number) {
  switch (intensity) {
    case 0: return 'Sem atividade'
    case 1: return 'Pouca atividade'
    case 2: return 'Atividade moderada'
    case 3: return 'Boa atividade'
    case 4: return 'Atividade intensa'
    default: return ''
  }
}

export function ConsistencyHeatmap({
  data,
  period: externalPeriod,
  onPeriodChange,
  showPeriodButtons = true,
  tooltipParagraphs = DEFAULT_TOOLTIP_PARAGRAPHS,
}: ConsistencyHeatmapProps) {
  const [internalPeriod, setInternalPeriod] = useState<HeatmapPeriod>('anual')
  const period = externalPeriod ?? internalPeriod

  const handlePeriodChange = (newPeriod: HeatmapPeriod) => {
    if (!externalPeriod) {
      setInternalPeriod(newPeriod)
    }
    onPeriodChange?.(newPeriod)
  }

  const getGridCols = () => {
    switch (period) {
      case 'semanal':
        return 'grid-cols-7'
      case 'mensal':
        return 'grid-cols-[repeat(31,minmax(0,1fr))]'
      case 'anual':
        return 'grid-cols-53'
      default:
        return 'grid-cols-53'
    }
  }

  // Calculate month label positions for the annual view
  const monthPositions = useMemo(() => {
    if (period !== 'anual' || data.length === 0) return []

    const positions: Array<{ label: string; col: number }> = []
    let lastMonth = -1

    for (let i = 0; i < data.length; i++) {
      const day = data[i]
      if (!day.date) continue
      const date = new Date(day.date + 'T00:00:00')
      const month = date.getMonth()
      if (month !== lastMonth) {
        const col = Math.floor(i / 7)
        positions.push({ label: MONTH_LABELS[month], col })
        lastMonth = month
      }
    }
    return positions
  }, [data, period])

  const showDayLabels = period === 'anual' || period === 'mensal'

  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="widget-title">Constância de Estudo</h2>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" align="start" className="max-w-xs">
                  <div className="space-y-2 text-sm">
                    {tooltipParagraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {showPeriodButtons && (
            <div className="flex gap-1">
              {(['semanal', 'mensal', 'anual'] as HeatmapPeriod[]).map((p) => (
                <Button
                  key={p}
                  variant={period === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePeriodChange(p)}
                  className="text-xs h-7 px-2.5"
                >
                  {p === 'semanal' ? 'Semanal' : p === 'mensal' ? 'Mensal' : 'Anual'}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Empty State */}
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 min-h-40">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-muted/50">
              <CalendarOff className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Sem dados de atividade</p>
              <p className="text-xs text-muted-foreground/70">O gráfico de calor mostrará sua constância de estudos.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Month labels for annual view */}
            {period === 'anual' && monthPositions.length > 0 && (
              <div className="overflow-x-auto overflow-y-hidden mb-1">
                <div className="relative min-w-max" style={{ paddingLeft: showDayLabels ? '2rem' : 0 }}>
                  <div className="grid grid-cols-53 gap-0.75">
                    {Array.from({ length: 53 }).map((_, colIdx) => {
                      const match = monthPositions.find((m) => m.col === colIdx)
                      return (
                        <div key={colIdx} className="text-[10px] text-muted-foreground leading-none">
                          {match?.label ?? ''}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Heatmap grid */}
            <div className="overflow-x-auto overflow-y-hidden">
              <div className="flex min-w-max">
                {/* Day-of-week labels */}
                {showDayLabels && (
                  <div className="flex flex-col gap-0.75 mr-1.5 pt-0">
                    {DAY_LABELS.map((label, i) => (
                      <div
                        key={i}
                        className="text-[10px] text-muted-foreground leading-none flex items-center justify-end"
                        style={{ height: 14, width: '1.5rem' }}
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                )}

                {/* Grid cells */}
                <div className={cn('grid gap-0.75 flex-1', getGridCols())}>
                  {data.map((day, index) => (
                    <TooltipProvider key={`${day.date}-${index}`} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'size-3.5 rounded-sm cursor-default transition-colors',
                              getIntensityClass(day.intensity)
                            )}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{day.date}</p>
                          <p className="text-muted-foreground">{getIntensityLabel(day.intensity)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
              <span>Menos</span>
              <div className="flex gap-1">
                <div className="size-3.5 rounded-sm bg-muted/40" />
                <div className="size-3.5 rounded-sm bg-emerald-500/40 dark:bg-emerald-400/40" />
                <div className="size-3.5 rounded-sm bg-emerald-500/60 dark:bg-emerald-400/60" />
                <div className="size-3.5 rounded-sm bg-emerald-500/80 dark:bg-emerald-400/80" />
                <div className="size-3.5 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
              </div>
              <span>Mais</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
