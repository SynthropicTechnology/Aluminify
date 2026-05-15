'use client'

import { useMemo } from 'react'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { BarChart3, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/dataviz/chart'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'

const DISCIPLINE_TOOLTIP_PARAGRAPHS = [
  'Aproveitamento médio dos alunos em cada disciplina, calculado como o total de questões corretas dividido pelo total de questões respondidas no período selecionado.',
  'Apenas disciplinas com pelo menos uma questão respondida no período aparecem aqui — disciplinas estudadas via aulas/flashcards mas sem listas de exercícios são exibidas só na lista lateral.',
  'Top 8 disciplinas exibidas, ordenadas pela maior taxa de acerto.',
]
import type { DisciplinaPerformance } from '@/app/[tenant]/(modules)/dashboard/types'

interface DisciplineChartProps {
  disciplinas: DisciplinaPerformance[]
}

function getBarColor(score: number): string {
  if (score >= 80) return 'var(--color-emerald-500, #10b981)'
  if (score >= 60) return 'var(--color-amber-500, #f59e0b)'
  if (score >= 40) return 'var(--color-orange-500, #f97316)'
  return 'var(--color-red-500, #ef4444)'
}

export function DisciplineChart({ disciplinas }: DisciplineChartProps) {
  // Apenas disciplinas com dados de aproveitamento entram no gráfico —
  // exibir uma barra de 0% que na verdade significa "sem questões respondidas"
  // distorceria o gráfico (que é especificamente sobre aproveitamento).
  const disciplinasComDados = useMemo(
    () => disciplinas.filter((d) => d.temDadosAproveitamento),
    [disciplinas]
  )

  const chartData = useMemo(() => {
    return disciplinasComDados
      .slice(0, 8)
      .sort((a, b) => b.aproveitamento - a.aproveitamento)
      .map((d) => ({
        name: d.name.length > 18 ? d.name.slice(0, 16) + '...' : d.name,
        fullName: d.name,
        aproveitamento: d.aproveitamento,
        alunos: d.alunosAtivos,
        questoes: d.totalQuestoes,
      }))
  }, [disciplinasComDados])

  const chartConfig: ChartConfig = useMemo(
    () => ({
      aproveitamento: {
        label: 'Aproveitamento',
        color: 'var(--chart-1)',
      },
    }),
    []
  )

  const totalQuestoes = disciplinasComDados.reduce((sum, d) => sum + d.totalQuestoes, 0)
  const statsText = `${disciplinasComDados.length} ${disciplinasComDados.length === 1 ? 'disciplina' : 'disciplinas'} · ${totalQuestoes.toLocaleString('pt-BR')} questões`

  if (disciplinasComDados.length === 0) {
    return (
      <Card className="group h-full overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
        <div className="h-0.5 bg-linear-to-r from-emerald-400 to-green-500" />
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-green-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h3 className="widget-title">Aproveitamento por Disciplina</h3>
          </div>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-muted/50">
              <BarChart3 className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Sem dados de aproveitamento
              </p>
              <p className="text-xs text-muted-foreground/70">
                Os dados aparecem quando alunos respondem questões nas disciplinas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const barHeight = 40
  const chartHeight = Math.max(200, chartData.length * barHeight + 40)

  return (
    <Card className="group h-full overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
      <div className="h-0.5 bg-linear-to-r from-emerald-400 to-green-500" />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-green-500">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="widget-title">Aproveitamento por Disciplina</h3>
              <p className="text-xs text-muted-foreground">{statsText}</p>
            </div>
          </div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help opacity-0 group-hover:opacity-100 transition-opacity" />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="end"
                className="max-w-70 p-4 text-sm"
                sideOffset={4}
              >
                <div className="space-y-3">
                  <p className="font-semibold border-b border-border pb-2">
                    Aproveitamento por Disciplina
                  </p>
                  <div className="space-y-2 text-muted-foreground">
                    {DISCIPLINE_TOOLTIP_PARAGRAPHS.map((p, i) => (
                      <p key={i} className="leading-relaxed">{p}</p>
                    ))}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
            <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={80}
              tick={{ fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--color-muted)', opacity: 0.3 }}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <div className="space-y-1">
                      <p className="font-medium">{item.payload.fullName}</p>
                      <p className="text-sm">Aproveitamento: {value}%</p>
                      <p className="text-xs text-muted-foreground">
                        {item.payload.alunos} alunos · {item.payload.questoes} questões
                      </p>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="aproveitamento"
              radius={[0, 6, 6, 0]}
              maxBarSize={28}
              label={{
                position: 'right',
                formatter: (v) => `${v}%`,
                fontSize: 12,
                fontWeight: 600,
                fill: 'var(--color-foreground)',
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.aproveitamento)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
