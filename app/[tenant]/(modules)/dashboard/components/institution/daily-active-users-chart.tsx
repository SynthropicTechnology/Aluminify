'use client'

import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from 'recharts'
import { Activity, Info } from 'lucide-react'
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
import type {
  DailyActiveUsersPoint,
  DailyLoginsPoint,
  DashboardPeriod,
  LoginSummary,
} from '@/app/[tenant]/(modules)/dashboard/types'

interface DailyActiveUsersChartProps {
  data: DailyActiveUsersPoint[]
  loginsData: DailyLoginsPoint[]
  loginSummary: LoginSummary
  period: DashboardPeriod
}

function formatDateLabel(dateStr: string, period: DashboardPeriod): string {
  const date = new Date(dateStr + 'T00:00:00')
  if (period === 'semanal') {
    return date.toLocaleDateString('pt-BR', { weekday: 'short' })
  }
  if (period === 'mensal') {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

function formatTooltipDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

export function DailyActiveUsersChart({
  data,
  loginsData,
  loginSummary,
  period,
}: DailyActiveUsersChartProps) {
  const chartData = useMemo(() => {
    const loginMap = new Map(loginsData.map((item) => [item.date, item.uniqueLogins]))

    // Para período anual, agregamos por mês para evitar 365 pontos
    if (period === 'anual') {
      const byMonth = new Map<string, {
        sumActive: number
        sumLogins: number
        count: number
        sample: string
      }>()
      for (const point of data) {
        const monthKey = point.date.slice(0, 7) // YYYY-MM
        if (!byMonth.has(monthKey)) {
          byMonth.set(monthKey, {
            sumActive: 0,
            sumLogins: 0,
            count: 0,
            sample: point.date,
          })
        }
        const entry = byMonth.get(monthKey)!
        entry.sumActive += point.activeUsers
        entry.sumLogins += loginMap.get(point.date) ?? 0
        entry.count += 1
      }
      return Array.from(byMonth.entries()).map(([monthKey, entry]) => ({
        date: entry.sample,
        label: formatDateLabel(monthKey + '-01', 'anual'),
        activeUsers: Math.round(entry.sumActive / Math.max(entry.count, 1)),
        uniqueLogins: Math.round(entry.sumLogins / Math.max(entry.count, 1)),
      }))
    }

    return data.map((point) => ({
      date: point.date,
      label: formatDateLabel(point.date, period),
      activeUsers: point.activeUsers,
      uniqueLogins: loginMap.get(point.date) ?? 0,
    }))
  }, [data, loginsData, period])

  const stats = useMemo(() => {
    let maxStudy = 0
    let sumStudy = 0
    let maxLogin = 0
    let sumLogin = 0
    const loginMap = new Map(loginsData.map((item) => [item.date, item.uniqueLogins]))

    for (const point of data) {
      sumStudy += point.activeUsers
      if (point.activeUsers > maxStudy) maxStudy = point.activeUsers

      const loginCount = loginMap.get(point.date) ?? 0
      sumLogin += loginCount
      if (loginCount > maxLogin) maxLogin = loginCount
    }

    return {
      studyPeak: maxStudy,
      studyAverage: data.length > 0 ? Math.round(sumStudy / data.length) : 0,
      loginPeak: maxLogin,
      loginAverage: data.length > 0 ? Math.round(sumLogin / data.length) : 0,
    }
  }, [data, loginsData])

  const chartConfig: ChartConfig = useMemo(
    () => ({
      activeUsers: {
        label: 'Alunos ativos',
        color: 'var(--chart-2)',
      },
      uniqueLogins: {
        label: 'Logins únicos',
        color: 'var(--chart-4)',
      },
    }),
    []
  )

  const hasData = data.some((d) => d.activeUsers > 0)

  return (
    <Card className="group overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
      <div className="h-0.5 bg-linear-to-r from-violet-400 to-blue-500" />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-blue-500">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="widget-title">Alunos Ativos por Dia</h3>
              <p className="text-xs text-muted-foreground">
                Estudo pico/média: {stats.studyPeak}/{stats.studyAverage} · Login pico/média: {stats.loginPeak}/{stats.loginAverage}
              </p>
              {loginSummary.isPartialData && loginSummary.coverageStartDate ? (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                  Dados de login em formação desde {new Date(loginSummary.coverageStartDate).toLocaleDateString('pt-BR')}
                </p>
              ) : null}
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
                    Alunos Ativos por Dia
                  </p>
                  <div className="space-y-2 text-muted-foreground">
                    <p className="leading-relaxed">
                      Área roxa: alunos ativos por estudo no dia
                      (alunos únicos que iniciaram ao menos uma sessão de estudo).
                    </p>
                    <p className="leading-relaxed">
                      Linha ciano: alunos logados no app no dia
                      (alunos únicos que autenticaram). Assim você compara
                      acesso (login) com engajamento real (estudo).
                    </p>
                    <p className="leading-relaxed">
                      No modo anual, os dados são agregados por mês para manter legibilidade.
                    </p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-muted/50">
              <Activity className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Sem atividade registrada no período
            </p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="w-full [&_.recharts-wrapper]:h-[180px]! md:[&_.recharts-wrapper]:h-[220px]!"
            style={{ height: 220 }}
          >
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-violet-500, #8b5cf6)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-violet-500, #8b5cf6)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                opacity={0.3}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <ChartTooltip
                cursor={{
                  stroke: 'var(--color-violet-500, #8b5cf6)',
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item) => (
                      <div className="space-y-1">
                        <p className="font-medium">
                          {formatTooltipDate(item.payload.date)}
                        </p>
                        <p className="text-sm">
                          {value} {Number(value) === 1 ? 'aluno ativo' : 'alunos ativos'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.payload.uniqueLogins} {Number(item.payload.uniqueLogins) === 1 ? 'login único' : 'logins únicos'}
                        </p>
                      </div>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="activeUsers"
                stroke="var(--color-violet-500, #8b5cf6)"
                strokeWidth={2}
                fill="url(#dauGradient)"
              />
              <Line
                type="monotone"
                dataKey="uniqueLogins"
                stroke="var(--color-cyan-500, #06b6d4)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
