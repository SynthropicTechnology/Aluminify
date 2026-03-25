'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { RefreshCw, AlertCircle, Users, Calendar, CheckCircle2, Target, Clock, BookOpen, CalendarDays, Trophy, BarChart3 } from 'lucide-react'
import type { ProfessorDashboardData } from '@/app/[tenant]/(modules)/dashboard/types'
import {
  fetchProfessorDashboardData,
  type ProfessorDashboardServiceError,
} from '@/app/shared/core/services/professorDashboardService'
import { MetricCard } from '../aluno/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { StudentsUnderCareList } from '@/app/[tenant]/(modules)/usuario/components/students-under-care-list'
import { UpcomingAppointments } from '@/app/[tenant]/(modules)/agendamentos/components/upcoming-appointments'
import { DashboardSkeleton } from '../dashboard-skeleton'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/app/shared/components/feedback/alert'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'
import { useTheme } from 'next-themes'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function performanceBarColor(value: number): string {
  if (value >= 80) return '#10b981'
  if (value >= 60) return '#f59e0b'
  if (value >= 40) return '#f97316'
  return '#ef4444'
}

function rankBg(rank: number): string {
  if (rank === 1) return 'bg-amber-100 dark:bg-amber-900/30'
  if (rank === 2) return 'bg-slate-100 dark:bg-slate-800/40'
  if (rank === 3) return 'bg-orange-100 dark:bg-orange-900/20'
  return ''
}

function rankTextColor(rank: number): string {
  if (rank === 1) return 'text-amber-600 dark:text-amber-400'
  if (rank === 2) return 'text-slate-500 dark:text-slate-300'
  if (rank === 3) return 'text-orange-600 dark:text-orange-400'
  return 'text-muted-foreground'
}

// ---------------------------------------------------------------------------
// Custom Tooltip for Recharts
// ---------------------------------------------------------------------------

interface ChartTooltipPayload {
  name: string
  performance: number
  students: number
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: ChartTooltipPayload }>
}) {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      <p className="text-sm font-medium">{data.name}</p>
      <p className="text-xs text-muted-foreground">
        Desempenho: <span className="font-semibold tabular-nums">{data.performance}%</span>
      </p>
      <p className="text-xs text-muted-foreground">
        Alunos: <span className="font-semibold tabular-nums">{data.students}</span>
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Intervalo de refresh automático (5 minutos)
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfessorDashboardClient() {
  const [data, setData] = useState<ProfessorDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, setIsRefreshing] = useState(false)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const { resolvedTheme } = useTheme()

  const loadDashboardData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      setError(null)

      const dashboardData = await fetchProfessorDashboardData()
      setData(dashboardData)
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)

      let errorMessage = 'Erro ao carregar dados do dashboard'
      if (err instanceof Error) {
        errorMessage = err.message

        if ((err as ProfessorDashboardServiceError).isAuthError) {
          errorMessage = 'Sua sessão expirou. Por favor, faça login novamente.'
        } else if ((err as ProfessorDashboardServiceError).isNetworkError) {
          errorMessage =
            'Erro de conexão. Verifique sua internet e tente novamente.'
        }
      }

      setError(errorMessage)

      if ((err as ProfessorDashboardServiceError).isAuthError) {
        setData(null)
      }
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  // Carregamento inicial
  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Refresh automático
  useEffect(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current)
    }

    refreshIntervalRef.current = setInterval(() => {
      loadDashboardData(true)
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [loadDashboardData])

  // Função para refresh manual
  const handleManualRefresh = () => {
    loadDashboardData(true)
  }

  const axisColor = useMemo(
    () => (resolvedTheme === 'dark' ? '#a1a1aa' : '#71717a'),
    [resolvedTheme],
  )

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Alert variant="destructive" className="mt-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar dashboard</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{error}</p>
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <p className="text-muted-foreground">Nenhum dado disponível</p>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Data preparation
  // ---------------------------------------------------------------------------

  // Calculate success rate
  const totalAlunos = data.alunos?.length || 0
  const alunosAcimaDaMeta = (data.alunos ?? []).filter((a) => a.aproveitamento >= 60).length
  const successRate = totalAlunos > 0 ? Math.round((alunosAcimaDaMeta / totalAlunos) * 100) : 0

  // Format next appointment
  const formatNextAppointment = () => {
    if (!data.summary.proximoAgendamento) return 'Nenhum'
    try {
      return formatDistanceToNow(new Date(data.summary.proximoAgendamento), {
        addSuffix: true,
        locale: ptBR,
      })
    } catch {
      return 'Em breve'
    }
  }
  const formattedNextAppointment = formatNextAppointment()

  // Quick stats completion rate
  const totalAgendamentos = (data.summary.agendamentosPendentes || 0) + (data.summary.agendamentosRealizadosMes || 0)
  const completionRate = totalAgendamentos > 0
    ? Math.round((data.summary.agendamentosRealizadosMes / totalAgendamentos) * 100)
    : 0

  // Chart data from performanceAlunos
  const chartDisciplines = (data.performanceAlunos ?? []).map((d) => ({
    name: d.name,
    performance: d.aproveitamentoMedio,
    students: d.totalAlunos,
  }))

  // Top alunos sorted by aproveitamento
  const topAlunos = [...(data.alunos ?? [])].sort((a, b) => b.aproveitamento - a.aproveitamento).slice(0, 8)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-4 md:space-y-6">
      {/* Error alert (if data exists but error too) */}
      {error && data && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Aviso</AlertTitle>
          <AlertDescription>
            {error}. Dados podem estar desatualizados.
          </AlertDescription>
        </Alert>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* 1. HEADER                                                         */}
      {/* ----------------------------------------------------------------- */}
      <header className="rounded-2xl border border-border/40 bg-card/50 p-4 md:p-5 dark:bg-card/40 dark:backdrop-blur-sm dark:border-white/5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {getGreeting()}, {data.professorNome.split(' ')[0]}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Aqui está um resumo da sua atividade.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Button className="bg-foreground text-background hover:bg-foreground/90 shrink-0">
              <Calendar className="mr-2 h-4 w-4" />
              Ver Agenda
            </Button>
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              size="icon"
              className="shrink-0 h-9 w-9"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------------- */}
      {/* 2. QUICK STATS BAR                                                */}
      {/* ----------------------------------------------------------------- */}
      <Card className="overflow-hidden border-0 bg-linear-to-r from-blue-600 to-indigo-500 shadow-lg shadow-blue-600/20">
        <CardContent className="p-4 md:p-5">
          <div className="flex items-center gap-4 md:gap-5">
            {/* Left metric */}
            <div className="flex items-center gap-3 text-white shrink-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl md:text-3xl font-bold tabular-nums leading-none">
                  {data.summary.alunosAtendidos}
                </p>
                <p className="text-xs text-white/70 mt-0.5">alunos ativos</p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-px self-stretch bg-white/20 shrink-0" />

            {/* Right: schedule progress */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-white">Agendamentos do Mês</p>
                <p className="text-lg font-bold text-white tabular-nums">
                  {data.summary.agendamentosRealizadosMes}/{totalAgendamentos}
                </p>
              </div>
              <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${completionRate}%` }}
                />
              </div>
              <p className="text-xs text-white/60 mt-1">
                {data.summary.agendamentosPendentes} pendente{data.summary.agendamentosPendentes !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ----------------------------------------------------------------- */}
      {/* 3. KPI CARDS                                                      */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        <MetricCard
          label="Alunos Atendidos"
          value={data.summary.alunosAtendidos}
          icon={Users}
          variant="accuracy"
        />
        <MetricCard
          label="Agendamentos Pendentes"
          value={data.summary.agendamentosPendentes}
          icon={Calendar}
          variant="classTime"
        />
        <MetricCard
          label="Realizados no Mês"
          value={data.summary.agendamentosRealizadosMes}
          icon={CheckCircle2}
          variant="exerciseTime"
        />
        <MetricCard
          label="Taxa de Sucesso"
          value={`${successRate}%`}
          icon={Target}
          variant="questions"
          showProgressCircle
          progressValue={successRate}
        />
        <MetricCard
          label="Próximo Agendamento"
          value={formattedNextAppointment}
          icon={Clock}
          variant="time"
        />
        <MetricCard
          label="Disciplinas"
          value={data.performanceAlunos.length}
          icon={BookOpen}
          variant="flashcards"
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 4. TWO-COLUMN: Performance + Top Alunos                           */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Performance por Disciplina */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
            <div className="h-0.5 bg-linear-to-r from-amber-400 to-orange-500" />
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-500">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="widget-title">Performance por Disciplina</h3>
                  <p className="text-xs text-muted-foreground">
                    Desempenho médio dos alunos
                  </p>
                </div>
              </div>

              {chartDisciplines.length > 0 ? (
                <div className="h-72 md:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartDisciplines}
                      layout="vertical"
                      margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                      barSize={20}
                    >
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tick={{ fontSize: 12, fill: axisColor }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 12, fill: axisColor }}
                        tickLine={false}
                        axisLine={false}
                        width={90}
                      />
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: resolvedTheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
                      />
                      <Bar dataKey="performance" radius={[0, 6, 6, 0]}>
                        {chartDisciplines.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={performanceBarColor(entry.performance)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/70 mb-3" />
                  <p className="text-sm text-muted-foreground">Sem dados de performance</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Top Alunos */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
            <div className="h-0.5 bg-linear-to-r from-violet-400 to-fuchsia-500" />
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="widget-title">Top Alunos</h3>
                  <p className="text-xs text-muted-foreground">Ranking por aproveitamento</p>
                </div>
              </div>

              {topAlunos.length > 0 ? (
                <ScrollArea className="h-80">
                  <div className="space-y-1.5 pr-3">
                    {topAlunos.map((student, index) => {
                      const rank = index + 1
                      return (
                        <div
                          key={student.id}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                            rankBg(rank),
                          )}
                        >
                          {/* Rank */}
                          <span
                            className={cn(
                              'text-sm font-bold tabular-nums w-5 text-center shrink-0',
                              rankTextColor(rank),
                            )}
                          >
                            {rank}
                          </span>

                          {/* Avatar */}
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs font-semibold bg-muted">
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{student.name}</p>
                          </div>

                          {/* Points Badge */}
                          <Badge
                            variant="secondary"
                            className="shrink-0 tabular-nums text-xs font-semibold"
                          >
                            {Math.round(student.aproveitamento)}%
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <Trophy className="h-12 w-12 text-muted-foreground/70 mb-3" />
                  <p className="text-sm text-muted-foreground">Sem dados de alunos</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* 5. TWO-COLUMN: Appointments + Students                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Próximos Agendamentos */}
        <Card className="overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
          <div className="h-0.5 bg-linear-to-r from-teal-400 to-cyan-500" />
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-cyan-500">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="widget-title">Próximos Agendamentos</h3>
                <p className="text-xs text-muted-foreground">
                  Seus atendimentos agendados
                </p>
              </div>
            </div>
            <UpcomingAppointments appointments={data.agendamentos} />
          </CardContent>
        </Card>

        {/* Alunos Sob Responsabilidade */}
        <Card className="overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
          <div className="h-0.5 bg-linear-to-r from-blue-400 to-indigo-500" />
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-500">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="widget-title">Alunos Sob Responsabilidade</h3>
                <p className="text-xs text-muted-foreground">
                  Desempenho individual dos seus alunos
                </p>
              </div>
            </div>
            <StudentsUnderCareList students={data.alunos} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
