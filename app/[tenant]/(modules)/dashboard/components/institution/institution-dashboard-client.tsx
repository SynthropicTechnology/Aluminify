'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, AlertCircle, Users, GraduationCap, BookOpen, Clock, CheckCircle2, Target, Building2, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { InstitutionDashboardData } from '@/app/[tenant]/(modules)/dashboard/types'
import {
  fetchInstitutionDashboardData,
  type InstitutionDashboardServiceError,
} from '@/app/shared/core/services/institutionDashboardService'
import { MetricCard } from '../aluno/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/app/shared/components/ui/badge'
import { ScrollArea } from '@/app/shared/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/app/shared/components/ui/avatar'
import { ConsistencyHeatmap, type HeatmapPeriod } from '@/app/[tenant]/(modules)/dashboard/components/consistency-heatmap'
import { DisciplineChart } from './discipline-chart'
import { ProfessorRankingList } from './professor-ranking-list'
import { DisciplinaPerformanceList } from './disciplina-performance'
import { DashboardSkeleton } from '@/app/[tenant]/(modules)/dashboard/components/dashboard-skeleton'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/app/shared/components/feedback/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/shared/components/forms/select'

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

type DashboardPeriod = 'semanal' | 'mensal' | 'anual'

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
  const parts = name.replace(/^Prof\.\s*/, '').trim().split(' ')
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : ''
  return (first + last).toUpperCase()
}

function getRankHighlight(rank: number): string {
  if (rank === 1) return 'bg-amber-500/5 dark:bg-amber-500/10'
  if (rank === 2) return 'bg-slate-400/5 dark:bg-slate-400/10'
  if (rank === 3) return 'bg-orange-400/5 dark:bg-orange-400/10'
  return ''
}

function getRankColor(rank: number): string {
  if (rank === 1) return 'text-amber-500'
  if (rank === 2) return 'text-slate-400'
  if (rank === 3) return 'text-orange-400'
  return 'text-muted-foreground'
}

function getPerformanceBadge(performance: number): { label: string; className: string } {
  if (performance >= 90)
    return { label: 'Excelente', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' }
  if (performance >= 80)
    return { label: 'Otimo', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' }
  if (performance >= 70)
    return { label: 'Bom', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' }
  return { label: 'Regular', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' }
}

export default function InstitutionDashboardClient() {
  const router = useRouter()
  const params = useParams()
  const tenant = params?.tenant as string | undefined
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [data, setData] = useState<InstitutionDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [period, setPeriod] = useState<DashboardPeriod>('mensal')
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)

  const periodRef = useRef(period)
  periodRef.current = period
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname
  const routerRef = useRef(router)
  routerRef.current = router
  const searchParamsRef = useRef(searchParams)
  searchParamsRef.current = searchParams

  const loadDashboardData = useCallback(
    async (showRefreshing = false, newPeriod?: DashboardPeriod) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      const controller = new AbortController()
      abortControllerRef.current = controller

      const periodToUse = newPeriod ?? periodRef.current
      try {
        if (showRefreshing) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }
        setError(null)

        const dashboardData = await fetchInstitutionDashboardData(periodToUse, controller.signal)

        if (controller.signal.aborted) return

        setData(dashboardData)
      } catch (err) {
        if (controller.signal.aborted) return

        const typed = err as InstitutionDashboardServiceError
        const isExpectedAuthError = !!typed?.isAuthError || !!typed?.isForbidden
          ; (isExpectedAuthError ? console.warn : console.error)(
            'Erro ao carregar dados do dashboard:',
            err
          )

        let errorMessage = 'Erro ao carregar dados do dashboard'
        if (err instanceof Error) {
          errorMessage = err.message

          if ((err as InstitutionDashboardServiceError).isAuthError) {
            errorMessage = 'Sua sessao expirou. Por favor, faca login novamente.'
          } else if ((err as InstitutionDashboardServiceError).isForbidden) {
            errorMessage = 'Voce nao tem permissao de administrador da instituicao para acessar este dashboard.'
          } else if ((err as InstitutionDashboardServiceError).isNetworkError) {
            errorMessage =
              'Erro de conexao. Verifique sua internet e tente novamente.'
          }
        }

        setError(errorMessage)

        if ((err as InstitutionDashboardServiceError).isAuthError) {
          setData(null)
          const currentPathname = pathnameRef.current
          const currentSearchParams = searchParamsRef.current
          const qs = currentSearchParams?.toString()
          const returnUrl = `${currentPathname}${qs ? `?${qs}` : ''}`
          const firstSegment = currentPathname.split('/').filter(Boolean)[0]
          const loginBase =
            firstSegment && firstSegment !== 'auth' ? `/${firstSegment}/auth/login` : '/auth/login'
          routerRef.current.replace(`${loginBase}?next=${encodeURIComponent(returnUrl)}`)
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
          setIsRefreshing(false)
          abortControllerRef.current = null
        }
      }
    },
    []
  )

  useEffect(() => {
    loadDashboardData()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [loadDashboardData])

  const handlePeriodChange = useCallback(
    (newPeriod: DashboardPeriod) => {
      setPeriod(newPeriod)
      loadDashboardData(true, newPeriod)
    },
    [loadDashboardData]
  )

  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      loadDashboardData(true)
    }, AUTO_REFRESH_INTERVAL)

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [loadDashboardData])

  const handleManualRefresh = () => {
    loadDashboardData(true)
  }

  // Derive trend for study hours
  const horasEstudoDelta = useMemo(() => {
    if (!data) return undefined
    const delta = data.engagement.horasEstudoDelta
    if (!delta) return undefined
    return {
      value: delta,
      isPositive: delta.startsWith('+'),
    }
  }, [data])

  // Sort student ranking by study hours descending, take top 8
  const sortedStudentRanking = useMemo(() => {
    if (!data) return []
    return [...data.rankingAlunos]
      .sort((a, b) => b.horasEstudoMinutos - a.horasEstudoMinutos)
      .slice(0, 8)
  }, [data])

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
        <p className="text-muted-foreground">Nenhum dado disponivel</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-4 md:space-y-6">
      {/* ----------------------------------------------------------------- */}
      {/* 1. HEADER                                                         */}
      {/* ----------------------------------------------------------------- */}
      <header className="rounded-2xl border border-border/40 bg-card/50 p-4 md:p-5 dark:bg-card/40 dark:backdrop-blur-sm dark:border-white/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              {getGreeting()}, {data.userName ?? 'Administrador'}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acompanhe o desempenho geral da sua instituicao
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select value={period} onValueChange={(v) => handlePeriodChange(v as DashboardPeriod)}>
              <SelectTrigger className="w-30 h-9 text-sm">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild variant="outline" className="hidden sm:inline-flex">
              <Link href={tenant ? `/${tenant}/usuario/alunos` : '/usuario/alunos'}>
                Gerenciar Alunos
              </Link>
            </Button>
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              size="icon"
              className="shrink-0 h-9 w-9"
              aria-label="Atualizar dados"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </header>

      {/* Error banner (stale data warning) */}
      {error && data && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Aviso</AlertTitle>
          <AlertDescription>
            {error}. Dados podem estar desatualizados.
          </AlertDescription>
        </Alert>
      )}

      {/* Main content with refresh opacity indicator */}
      <div className={cn('space-y-4 md:space-y-6 transition-opacity duration-200', isRefreshing && 'opacity-50 pointer-events-none')}>

        {/* ----------------------------------------------------------------- */}
        {/* 2. QUICK STATS BAR                                                */}
        {/* ----------------------------------------------------------------- */}
        <Card className="overflow-hidden border-0 bg-linear-to-r from-violet-600 to-purple-500 shadow-lg shadow-violet-500/20">
          <CardContent className="p-4 md:p-5">
            <div className="flex items-center gap-4 md:gap-5 flex-wrap sm:flex-nowrap">
              {/* Institution name */}
              <div className="flex items-center gap-3 text-white">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/70">Instituicao</p>
                  <p className="text-base font-bold">{data.empresaNome}</p>
                </div>
              </div>

              {/* Divider */}
              <div className="w-px self-stretch bg-white/20 shrink-0 hidden sm:block" />

              {/* Mini stat pills */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-white text-sm">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-medium tabular-nums">{data.summary.totalAlunos}</span>
                  <span className="text-white/70">alunos</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-white text-sm">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span className="font-medium tabular-nums">{data.summary.totalProfessores}</span>
                  <span className="text-white/70">professores</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-white text-sm">
                  <BookOpen className="h-3.5 w-3.5" />
                  <span className="font-medium tabular-nums">{data.summary.totalCursos}</span>
                  <span className="text-white/70">cursos</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* 3. KPI CARDS                                                      */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
          <MetricCard
            label="Alunos Ativos"
            value={data.summary.alunosAtivos}
            subtext={`de ${data.summary.totalAlunos} total`}
            icon={Users}
            variant="accuracy"
          />
          <MetricCard
            label="Professores"
            value={data.summary.totalProfessores}
            subtext="ativos"
            icon={GraduationCap}
            variant="flashcards"
          />
          <MetricCard
            label="Cursos Ativos"
            value={data.summary.totalCursos}
            icon={BookOpen}
            variant="exerciseTime"
          />
          <MetricCard
            label="Horas de Estudo"
            value={data.engagement.totalHorasEstudo}
            icon={Clock}
            variant="time"
            trend={horasEstudoDelta}
          />
          <MetricCard
            label="Atividades Concluidas"
            value={data.engagement.atividadesConcluidas}
            subtext="no periodo"
            icon={CheckCircle2}
            variant="questions"
          />
          <MetricCard
            label="Taxa de Conclusao"
            value={data.engagement.taxaConclusao + '%'}
            icon={Target}
            variant="classTime"
            showProgressCircle
            progressValue={data.engagement.taxaConclusao}
          />
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* 4. HEATMAP                                                        */}
        {/* ----------------------------------------------------------------- */}
        <ConsistencyHeatmap
          data={data.heatmap}
          period={period as HeatmapPeriod}
          onPeriodChange={(p) => handlePeriodChange(p as DashboardPeriod)}
          showPeriodButtons={false}
        />

        {/* ----------------------------------------------------------------- */}
        {/* 5. PERFORMANCE + DISTRIBUTION                                     */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
          <div className="lg:col-span-3">
            <DisciplineChart disciplinas={data.performanceByDisciplina} />
          </div>
          <div className="lg:col-span-2">
            <DisciplinaPerformanceList disciplinas={data.performanceByDisciplina} />
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* 6. RANKINGS                                                       */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Student Ranking (inline) */}
          <Card className="overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
            <div className="h-0.5 bg-linear-to-r from-blue-400 to-indigo-500" />
            <CardContent className="p-4 md:p-5">
              {/* Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-indigo-500">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="widget-title">Ranking de Alunos</h3>
                  <p className="text-xs text-muted-foreground">
                    Por horas de estudo e desempenho
                  </p>
                </div>
              </div>

              {/* List */}
              {sortedStudentRanking.length === 0 ? (
                <div className="flex items-center justify-center min-h-25">
                  <p className="text-sm text-muted-foreground">Nenhum aluno com dados de estudo</p>
                </div>
              ) : (
                <ScrollArea className="h-80">
                  <div className="space-y-1">
                    {sortedStudentRanking.map((student, index) => {
                      const rank = index + 1
                      const badge = getPerformanceBadge(student.aproveitamento)
                      return (
                        <div
                          key={student.id}
                          className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
                            getRankHighlight(rank),
                            'hover:bg-muted/40'
                          )}
                        >
                          {/* Rank */}
                          <span
                            className={cn(
                              'text-sm font-bold w-5 text-center tabular-nums shrink-0',
                              getRankColor(rank)
                            )}
                          >
                            {rank}
                          </span>

                          {/* Avatar */}
                          <Avatar className="size-8">
                            <AvatarFallback className="text-xs font-medium bg-muted">
                              {getInitials(student.name)}
                            </AvatarFallback>
                          </Avatar>

                          {/* Name + Hours */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{student.name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {student.horasEstudo} estudo
                            </p>
                          </div>

                          {/* Performance Badge */}
                          <Badge
                            variant="outline"
                            className={cn('text-xs shrink-0', badge.className)}
                          >
                            {student.aproveitamento}% &middot; {badge.label}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Professor Ranking */}
          <ProfessorRankingList professors={data.rankingProfessores} />
        </div>
      </div>
    </div>
  )
}
