'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { RefreshCw, AlertCircle, Users, GraduationCap, BookOpen, Clock, CheckCircle2, Target, Building2, Trophy, CalendarCheck, Info, LogIn, UserCheck, UserX, AlertTriangle, CalendarX } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import { cn } from '@/lib/utils'
import type { InstitutionDashboardData, StudentEngagementFilter } from '@/app/[tenant]/(modules)/dashboard/types'
import {
  fetchInstitutionDashboardData,
  type InstitutionDashboardServiceError,
} from '@/app/shared/core/services/institutionDashboardService'
import { MetricCard } from '../aluno/metric-card'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/app/shared/components/ui/badge'
import { Avatar, AvatarFallback } from '@/app/shared/components/ui/avatar'
import { ConsistencyHeatmap, type HeatmapPeriod } from '@/app/[tenant]/(modules)/dashboard/components/consistency-heatmap'
import { DisciplineChart } from './discipline-chart'
import { ProfessorRankingList } from './professor-ranking-list'
import { DisciplinaPerformanceList } from './disciplina-performance'
import { DailyActiveUsersChart } from './daily-active-users-chart'
import { ServiceAdoptionChart } from './service-adoption-chart'
import { EngagementRiskPanel } from './engagement-risk-panel'
import { DashboardSkeleton } from '@/app/[tenant]/(modules)/dashboard/components/dashboard-skeleton'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/app/shared/components/feedback/alert'

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
  const _tenant = params?.tenant as string | undefined
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [data, setData] = useState<InstitutionDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [period, setPeriod] = useState<DashboardPeriod>('mensal')
  const [activeEngagementFilter, setActiveEngagementFilter] =
    useState<StudentEngagementFilter>('todos')
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
            errorMessage = 'Sua sessão expirou. Por favor, faça login novamente.'
          } else if ((err as InstitutionDashboardServiceError).isForbidden) {
            errorMessage = 'Você não tem permissão de administrador da instituição para acessar este dashboard.'
          } else if ((err as InstitutionDashboardServiceError).isNetworkError) {
            errorMessage =
              'Erro de conexão. Verifique sua internet e tente novamente.'
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

  const engagementRates = useMemo(() => {
    const total = data?.engagementSummary.totalStudents ?? 0
    const pct = (value: number) => total > 0 ? Math.round((value / total) * 100) : 0
    return {
      accessed: pct(data?.engagementSummary.accessedApp ?? 0),
      studied: pct(data?.engagementSummary.studied ?? 0),
      withoutAccess: pct(data?.engagementSummary.withoutAccess ?? 0),
      withoutSchedule: pct(data?.engagementSummary.withoutSchedule ?? 0),
      lowEngagement: pct(data?.engagementSummary.lowEngagement ?? 0),
    }
  }, [data])

  const interacoesBreakdownText = useMemo(() => {
    if (!data?.engagement.atividadesConcluidasBreakdown) {
      return undefined
    }
    const { aulas, atividades, flashcards } = data.engagement.atividadesConcluidasBreakdown
    return `Aulas ${aulas} · Atividades ${atividades} · Flashcards ${flashcards}`
  }, [data])

  // Sort student ranking by study hours descending, take top 8
  const sortedStudentRanking = useMemo(() => {
    if (!data) return []
    return [...data.rankingAlunos]
      .sort((a, b) => b.horasEstudoMinutos - a.horasEstudoMinutos)
      .slice(0, 8)
  }, [data])

  const handleEngagementFilter = useCallback((filter: StudentEngagementFilter) => {
    setActiveEngagementFilter(filter)
    requestAnimationFrame(() => {
      document.getElementById('alunos-atencao')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [])

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
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-4 px-4 pb-6 sm:px-6 md:space-y-6 lg:px-8">
      {/* ----------------------------------------------------------------- */}
      {/* 1. HEADER                                                         */}
      {/* ----------------------------------------------------------------- */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="wrap-break-word text-2xl font-bold tracking-tight md:text-3xl">
              {getGreeting()}, {data.userName ?? 'Administrador'}!
            </h1>
            <span className="text-2xl md:text-3xl" role="img" aria-label="Acenando">
              👋
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Acompanhe o desempenho geral da sua instituição
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          <div className="inline-flex w-full items-center rounded-lg border border-border/50 bg-muted/50 p-0.5 sm:w-auto">
            {(['semanal', 'mensal', 'anual'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => handlePeriodChange(opt)}
                className={cn(
                  'flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-all sm:flex-none',
                  period === opt
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
          <Button
            onClick={handleManualRefresh}
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
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
            <div className="flex flex-col items-start gap-3 md:gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
              {/* Institution name + logo */}
              <div className="flex min-w-0 w-full items-center gap-3 text-white sm:w-auto">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 overflow-hidden">
                  {data.empresaLogoUrl ? (
                    <Image
                      src={data.empresaLogoUrl}
                      alt={data.empresaNome}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-white" />
                  )}
                </div>
                <p className="truncate text-base font-bold">{data.empresaNome}</p>
              </div>

              {/* Divider */}
              <div className="w-px self-stretch bg-white/20 shrink-0 hidden sm:block" />

              {/* Mini stat pills */}
              <div className="flex w-full items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1 text-white text-sm">
                  <Users className="h-3.5 w-3.5" />
                  <span className="font-medium tabular-nums">{data.summary.totalAlunos}</span>
                  <span className="text-white/70">alunos matriculados</span>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          <MetricCard
            label="Alunos Matriculados"
            value={data.engagementSummary.totalStudents}
            subtext="base oficial da dashboard"
            icon={Users}
            variant="accuracy"
            tooltip={[
              'Total de alunos com matrícula ativa em pelo menos um curso da instituição.',
              'É a mesma base usada na aba Alunos e serve como denominador dos indicadores de engajamento.',
            ]}
          />
          <MetricCard
            label="Acessaram o App"
            value={data.engagementSummary.accessedApp}
            subtext={`${engagementRates.accessed}% da base · ${data.engagementSummary.withoutAccess} sem acesso`}
            icon={LogIn}
            variant="default"
            onClick={() => handleEngagementFilter('todos')}
            actionLabel="Ver alunos"
            tooltip={[
              'Quantidade de alunos matriculados que fizeram login no app no período selecionado.',
              'Importante: "alunos logados" mede acesso. Não garante que o aluno estudou no período.',
              !data.loginSummary.hasAnyData
                ? 'Ainda não há histórico de login suficiente para comparação. Os dados começam a aparecer após os primeiros acessos monitorados.'
                : data.loginSummary.isPartialData && data.loginSummary.coverageStartDate
                ? `Cobertura parcial: telemetria iniciada em ${new Date(data.loginSummary.coverageStartDate).toLocaleDateString('pt-BR')}.`
                : 'Cobertura completa dentro do período selecionado.',
            ]}
          />
          <MetricCard
            label="Estudaram no Período"
            value={data.engagementSummary.studied}
            subtext={`${engagementRates.studied}% da base · ${data.summary.totalAlunos} matriculados`}
            icon={UserCheck}
            variant="accuracy"
            onClick={() => handleEngagementFilter('todos')}
            actionLabel="Ver engajamento"
            tooltip={[
              'Quantidade de alunos que iniciaram pelo menos uma sessão de estudo no período.',
              'Mede engajamento real, diferente de apenas acessar o app.',
            ]}
          />
          <MetricCard
            label="Logaram, Mas Não Estudaram"
            value={data.engagementSummary.loggedWithoutStudy}
            subtext={`${data.loginSummary.taxaLogin}% acessaram · ação recomendada`}
            icon={AlertTriangle}
            variant="classTime"
            onClick={() => handleEngagementFilter('acessou_sem_estudo')}
            actionLabel="Contatar alunos"
            tooltip={[
              'Alunos que fizeram login no período, mas não iniciaram sessão de estudo.',
              'Esse grupo demonstrou interesse, mas pode estar travado no primeiro passo.',
            ]}
          />
          <MetricCard
            label="Sem Acesso no Período"
            value={data.engagementSummary.withoutAccess}
            subtext={`${engagementRates.withoutAccess}% da base`}
            icon={UserX}
            variant="time"
            onClick={() => handleEngagementFilter('sem_acesso')}
            actionLabel="Ver lista"
            tooltip={[
              'Alunos matriculados que não fizeram login no período selecionado.',
              'Use este card para ações de ativação e lembretes de acesso.',
            ]}
          />
          <MetricCard
            label="Sem Cronograma"
            value={data.engagementSummary.withoutSchedule}
            subtext={`${engagementRates.withoutSchedule}% da base`}
            icon={CalendarX}
            variant="flashcards"
            onClick={() => handleEngagementFilter('sem_cronograma')}
            actionLabel="Orientar alunos"
            tooltip={[
              'Alunos matriculados que ainda não têm cronograma personalizado.',
              'O cronograma é um indicador de onboarding e organização de estudo.',
            ]}
          />
          <MetricCard
            label="Baixo Engajamento"
            value={data.engagementSummary.lowEngagement}
            subtext={`${engagementRates.lowEngagement}% da base`}
            icon={AlertCircle}
            variant="questions"
            onClick={() => handleEngagementFilter('baixo_engajamento')}
            actionLabel="Ver alunos"
            tooltip={[
              'Alunos que estudaram, mas abaixo do limite mínimo esperado para o período.',
              'Critério inicial: 10 min semanal, 30 min mensal ou 180 min anual.',
            ]}
          />
          <MetricCard
            label="Alunos Contatados"
            value={data.engagementSummary.contacted}
            subtext={`${data.engagementSummary.recovered} recuperado(s)`}
            icon={CheckCircle2}
            variant="exerciseTime"
            onClick={() => handleEngagementFilter('todos')}
            actionLabel="Ver histórico"
            tooltip={[
              'Quantidade de alunos da lista de atenção que já tiveram contato registrado.',
              'O histórico é alimentado pelas ações de WhatsApp, e-mail ou marcação manual.',
            ]}
          />
          <MetricCard
            label="Taxa de Recuperação"
            value={`${data.engagementSummary.recoveryRate}%`}
            subtext="voltaram após contato"
            icon={Target}
            variant="classTime"
            showProgressCircle
            progressValue={data.engagementSummary.recoveryRate}
            tooltip={[
              'Percentual de alunos contatados que voltaram a acessar ou estudar depois do contato.',
              'A recuperação é medida comparando o último contato com eventos posteriores de login ou estudo.',
            ]}
          />
          <MetricCard
            label="Horas de Estudo"
            value={data.engagement.totalHorasEstudo}
            icon={Clock}
            variant="time"
            trend={horasEstudoDelta}
            tooltip={[
              'Soma do tempo líquido (descontando pausas) de todas as sessões de estudo dos alunos no período selecionado.',
              'O indicador de variação compara o período atual com o período imediatamente anterior de mesma duração.',
            ]}
          />
          <MetricCard
            label="Interações Concluídas"
            value={data.engagement.atividadesConcluidas}
            subtext={interacoesBreakdownText ?? 'no período'}
            icon={CheckCircle2}
            variant="questions"
            tooltip={[
              'Soma de três fontes de "atividade concluída" no período: aulas marcadas como assistidas no cronograma, atividades de questões finalizadas, e flashcards revisados.',
              'Mede o volume total de interações de aprendizado no período. O breakdown no card separa cada fonte.',
              !data.engagementSummary.flashcardsAvailable
                ? 'Nenhum flashcard está cadastrado nesta instituição; por isso revisões de flashcards ficam zeradas.'
                : 'Flashcards só contam quando pertencem ao tenant atual.',
            ]}
          />
          <MetricCard
            label="Taxa de Conclusão"
            value={data.engagement.taxaConclusao + '%'}
            subtext={`${data.engagement.taxaConclusao}% dos itens previstos no período foram concluídos`}
            icon={Target}
            variant="classTime"
            showProgressCircle
            progressValue={data.engagement.taxaConclusao}
            tooltip={[
              'Percentual de itens do cronograma cuja data prevista cai dentro do período e que foram efetivamente concluídos.',
              'Leitura operacional: "do que era pra ser feito neste período, quanto foi feito?". Não considera itens fora da janela.',
            ]}
          />
          <MetricCard
            label="Alunos com Cronograma"
            value={data.alunosComCronograma}
            subtext={`de ${data.summary.totalAlunos} total`}
            icon={CalendarCheck}
            variant="default"
            tooltip={[
              'Quantidade cumulativa de alunos distintos que já geraram pelo menos um cronograma personalizado na plataforma.',
              'Métrica de adoção da funcionalidade de cronogramas — não filtra por período, conta todo o histórico da instituição.',
            ]}
          />
        </div>

        <EngagementRiskPanel
          summary={data.engagementSummary}
          students={data.engagementStudents}
          period={period}
          activeFilter={activeEngagementFilter}
          onFilterChange={setActiveEngagementFilter}
        />

        {/* ----------------------------------------------------------------- */}
        {/* 4. ENGAJAMENTO DIÁRIO                                             */}
        {/* ----------------------------------------------------------------- */}
        <div>
          <DailyActiveUsersChart
            data={data.dailyActiveUsers}
            loginsData={data.dailyLogins}
            loginSummary={data.loginSummary}
            period={period}
          />
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* 5. HEATMAP                                                        */}
        {/* ----------------------------------------------------------------- */}
        <ConsistencyHeatmap
          data={data.heatmap}
          period={period as HeatmapPeriod}
          onPeriodChange={(p) => handlePeriodChange(p as DashboardPeriod)}
          showPeriodButtons={false}
          tooltipParagraphs={[
            'Mostra a constância de estudo da instituição como um todo, agregando todas as sessões de todos os alunos por dia.',
            'A intensidade de cor é normalizada por aluno-ativo do dia (tempo total ÷ número de alunos que estudaram), usando percentis dinâmicos sobre o período. Quanto mais escuro, maior o tempo médio de estudo por aluno naquele dia.',
          ]}
        />

        {/* ----------------------------------------------------------------- */}
        {/* 6. PERFORMANCE + DISTRIBUTION                                     */}
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
        {/* 7. ADOÇÃO DE SERVIÇOS                                             */}
        {/* ----------------------------------------------------------------- */}
        <ServiceAdoptionChart items={data.serviceAdoption} />

        {/* ----------------------------------------------------------------- */}
        {/* 8. RANKINGS                                                       */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {/* Student Ranking (inline) */}
          <Card className="group overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg flex flex-col">
            <div className="h-0.5 bg-linear-to-r from-blue-400 to-indigo-500 shrink-0" />
            <CardContent className="p-4 md:p-5 flex flex-col flex-1 min-h-0">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4 shrink-0">
                <div className="flex items-center gap-3">
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
                          Ranking de Alunos
                        </p>
                        <div className="space-y-2 text-muted-foreground">
                          <p className="leading-relaxed">
                            Top 8 alunos da instituição ordenados pelo
                            tempo total de estudo no período selecionado.
                          </p>
                          <p className="leading-relaxed">
                            O badge mostra a taxa de acerto do aluno em
                            questões respondidas no mesmo período
                            (acertos ÷ total). Categorias: Excelente
                            (≥90%), Ótimo (≥80%), Bom (≥70%), Regular
                            (&lt;70%).
                          </p>
                          <p className="leading-relaxed">
                            Alunos que não responderam nenhuma questão
                            no período aparecem como &quot;Sem dados&quot;.
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* List */}
              {sortedStudentRanking.length === 0 ? (
                <div className="flex items-center justify-center min-h-25 flex-1">
                  <p className="text-sm text-muted-foreground">Nenhum aluno com dados de estudo</p>
                </div>
              ) : (
                <div className="w-full flex-1 min-h-0 overflow-x-hidden overflow-y-auto pr-1">
                  <div className="w-full space-y-1">
                    {sortedStudentRanking.map((student, index) => {
                      const rank = index + 1
                      const badge = student.temDadosAproveitamento
                        ? getPerformanceBadge(student.aproveitamento)
                        : {
                            label: 'Sem dados',
                            className:
                              'bg-muted text-muted-foreground border-muted-foreground/20',
                          }
                      return (
                        <div
                          key={student.id}
                          className={cn(
                            'grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors sm:gap-3',
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
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{student.name}</p>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              {student.horasEstudo} estudo
                            </p>
                          </div>

                          {/* Performance Badge */}
                          <Badge
                            variant="outline"
                            className={cn('max-w-20 shrink-0 truncate text-xs sm:max-w-28', badge.className)}
                          >
                            {student.temDadosAproveitamento ? (
                              <>
                                <span className="sm:hidden">{student.aproveitamento}%</span>
                                <span className="hidden sm:inline">
                                  {student.aproveitamento}% &middot; {badge.label}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="sm:hidden">—</span>
                                <span className="hidden sm:inline">{badge.label}</span>
                              </>
                            )}
                          </Badge>
                        </div>
                      )
                    })}
                  </div>
                </div>
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
