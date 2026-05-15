'use client'

import { useMemo } from 'react'
import { Bar, BarChart, Cell, XAxis, YAxis } from 'recharts'
import { Layers, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/dataviz/chart'
import type { ServiceAdoptionItem } from '@/app/[tenant]/(modules)/dashboard/types'

interface ServiceAdoptionChartProps {
  items: ServiceAdoptionItem[]
}

function getBarColor(percentual: number): string {
  if (percentual >= 70) return 'var(--color-emerald-500, #10b981)'
  if (percentual >= 40) return 'var(--color-amber-500, #f59e0b)'
  if (percentual >= 15) return 'var(--color-orange-500, #f97316)'
  return 'var(--color-rose-500, #f43f5e)'
}

export function ServiceAdoptionChart({ items }: ServiceAdoptionChartProps) {
  const chartData = useMemo(() => {
    return [...items]
      .sort((a, b) => b.percentual - a.percentual)
      .map((item) => ({
        servico: item.servico,
        label: item.label,
        percentual: item.percentual,
        alunosAtivos: item.alunosAtivos,
        totalAlunos: item.totalAlunos,
      }))
  }, [items])

  const chartConfig: ChartConfig = useMemo(
    () => ({
      percentual: {
        label: 'Adoção',
        color: 'var(--chart-3)',
      },
    }),
    []
  )

  const totalAlunos = items[0]?.totalAlunos ?? 0
  const hasAnyAdoption = items.some((i) => i.alunosAtivos > 0)

  if (!hasAnyAdoption) {
    return (
      <Card className="overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
        <div className="h-0.5 bg-linear-to-r from-fuchsia-400 to-pink-500" />
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-fuchsia-500 to-pink-500">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="widget-title">Adoção de Serviços</h3>
              <p className="text-xs text-muted-foreground">
                Quantos alunos usam cada funcionalidade
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-muted/50">
              <Layers className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Sem adoção registrada no período
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const barHeight = 36
  const chartHeight = Math.max(220, chartData.length * barHeight + 40)

  return (
    <Card className="group overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
      <div className="h-0.5 bg-linear-to-r from-fuchsia-400 to-pink-500" />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-fuchsia-500 to-pink-500">
              <Layers className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="widget-title">Adoção de Serviços</h3>
              <p className="text-xs text-muted-foreground">
                % de alunos que usaram cada serviço · base: {totalAlunos}{' '}
                {totalAlunos === 1 ? 'aluno' : 'alunos'}
              </p>
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
                className="max-w-80 p-4 text-sm"
                sideOffset={4}
              >
                <div className="space-y-3">
                  <p className="font-semibold border-b border-border pb-2">
                    Adoção de Serviços
                  </p>
                  <div className="space-y-2 text-muted-foreground">
                    <p className="leading-relaxed">
                      Para cada funcionalidade da plataforma, mostra o
                      percentual de alunos da instituição que tiveram pelo
                      menos uma interação dentro do período selecionado,
                      considerando apenas dados do tenant atual.
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 text-xs leading-relaxed">
                      <li><strong>Sessões de Estudo:</strong> iniciaram cronômetro de estudo</li>
                      <li><strong>Cronogramas:</strong> geraram cronograma personalizado</li>
                      <li><strong>Flashcards:</strong> revisaram pelo menos um card</li>
                      <li><strong>Agendamentos:</strong> marcaram sessão com professor</li>
                      <li><strong>Chat com IA:</strong> conversaram com algum agente</li>
                      <li><strong>Atividades:</strong> registraram progresso em atividades de questões</li>
                    </ul>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <ChartContainer
          config={chartConfig}
          className="w-full"
          style={{ height: chartHeight }}
        >
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 36, left: 0, bottom: 0 }}
            barCategoryGap="20%"
          >
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
              dataKey="label"
              width={100}
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
                      <p className="font-medium">{item.payload.label}</p>
                      <p className="text-sm">{value}% de adoção</p>
                      <p className="text-xs text-muted-foreground">
                        {item.payload.alunosAtivos} de {item.payload.totalAlunos}{' '}
                        alunos
                      </p>
                    </div>
                  )}
                />
              }
            />
            <Bar
              dataKey="percentual"
              radius={[0, 6, 6, 0]}
              maxBarSize={26}
              label={{
                position: 'right',
                formatter: (v) => `${v}%`,
                fontSize: 12,
                fontWeight: 600,
                fill: 'var(--color-foreground)',
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry.percentual)} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
