'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Clock, CheckCircle2, Brain, RefreshCw, AlertCircle, Target, MonitorPlay, Timer } from 'lucide-react'
import type {
    DashboardPeriod,
    UserInfo,
    Metrics,
    HeatmapDay,
    SubjectPerformance,
    FocusEfficiencyDay,
    StrategicDomain,
    SubjectDistributionItem
} from '../../types'
import {
    fetchDashboardUser,
    fetchDashboardMetrics,
    fetchDashboardHeatmap,
    fetchDashboardSubjects,
    fetchDashboardEfficiency,
    fetchDashboardStrategic,
    fetchDashboardDistribution,
    fetchLeaderboard,
    type DashboardServiceError,
} from '../../services/aluno/dashboard.service'
import { useStudentOrganizations } from '@/components/providers/student-organizations-provider'
import { useOptionalTenantContext } from '@/app/[tenant]/tenant-context'
import { ScheduleProgress } from './schedule-progress'
import { MetricCard } from './metric-card'
import {
    ConsistencyHeatmap,
    type HeatmapPeriod,
} from './consistency-heatmap'
import { SubjectPerformanceList } from './subject-performance-list'
import { FocusEfficiencyChart } from './focus-efficiency-chart'
import { SubjectDistribution } from './subject-distribution'
import { StrategicDomain as StrategicDomainComponent } from './strategic-domain'
import { QuestionBankSection } from './question-bank-section'
import { DashboardSkeleton } from './dashboard-skeleton'
import { DashboardHeader } from './dashboard-header'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/app/shared/components/feedback/alert'
import {
    type LeaderboardItem,
} from '../cards'

/**
 * Converte HeatmapPeriod para DashboardPeriod
 * A API só aceita 'semanal', 'mensal' ou 'anual'
 * Mapeia: semestral -> anual
 */
function mapHeatmapPeriodToDashboardPeriod(
    period: HeatmapPeriod
): DashboardPeriod {
    switch (period) {
        case 'mensal':
            return 'mensal'
        case 'semestral':
            return 'anual' // Mapeia semestral para anual (mais próximo)
        case 'anual':
            return 'anual'
        default:
            return 'anual' // Fallback
    }
}

// Intervalo de refresh automático (5 minutos)
const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

export default function StudentDashboardClientPage() {
    // Individual states for granular data
    const [user, setUser] = useState<UserInfo | null>(null)
    const userRef = useRef<UserInfo | null>(null)
    const [metrics, setMetrics] = useState<Metrics | null>(null)
    const [heatmap, setHeatmap] = useState<HeatmapDay[]>([])
    const [subjects, setSubjects] = useState<SubjectPerformance[]>([])
    const [efficiency, setEfficiency] = useState<FocusEfficiencyDay[]>([])
    const [strategic, setStrategic] = useState<StrategicDomain | null>(null)
    const [distribution, setDistribution] = useState<SubjectDistributionItem[]>([])

    const [_leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([])

    // Sincroniza o ref com o estado para uso em callbacks sem causar loops de dependência
    useEffect(() => {
        userRef.current = user
    }, [user])

    const [isLoadingUser, setIsLoadingUser] = useState(true)
    const [isLoadingMetrics, setIsLoadingMetrics] = useState(true)
    const hasLoadedOnce = useRef(false)

    // Derived loading state - only shows skeleton on true initial load
    const isInitialLoading = !hasLoadedOnce.current && (isLoadingUser || isLoadingMetrics)

    const [error, setError] = useState<string | null>(null)
    const [isAuthError, setIsAuthError] = useState(false)
    const [, setIsRefreshing] = useState(false)
    const [, setLastRefresh] = useState<Date | null>(null)
    const [heatmapPeriod, setHeatmapPeriod] = useState<HeatmapPeriod>('anual')
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const router = useRouter()
    const params = useParams<{ tenant?: string | string[] }>()
    const tenant =
        typeof params?.tenant === 'string'
            ? params.tenant
            : Array.isArray(params?.tenant)
                ? params?.tenant[0]
                : undefined
    const loginUrl = tenant ? `/${tenant}/auth/login` : '/auth/login'

    // Get active organization for filtering (multi-org students)
    const tenantContext = useOptionalTenantContext()
    const { activeOrganization } = useStudentOrganizations()
    const activeOrgId =
        tenantContext?.empresaId ?? activeOrganization?.id ?? undefined

    // Helper to handle errors uniformly
    const handleError = (err: unknown, context: string) => {
        const serviceErr = err as DashboardServiceError
        if (serviceErr?.isAuthError || serviceErr?.isNetworkError) {
            console.warn(`Erro esperado ao carregar ${context}:`, err)
        } else {
            console.error(`Erro ao carregar ${context}:`, err)
        }

        let errorMessage = `Erro ao carregar ${context}`
        if (err instanceof Error) {
            errorMessage = err.message
            if ((err as DashboardServiceError).isAuthError) {
                setIsAuthError(true)
                return 'Sua sessão expirou. Por favor, faça login novamente.'
            } else if ((err as DashboardServiceError).isNetworkError) {
                setIsAuthError(false)
                return 'Erro de conexão. Verifique sua internet e tente novamente.'
            } else {
                setIsAuthError(false)
            }
        } else {
            setIsAuthError(false)
        }
        return errorMessage
    }

    const loadData = useCallback(
        async (showRefreshing = false, period?: HeatmapPeriod) => {
            const periodToUse = period ?? heatmapPeriod
            // Convert to dashboard period for methods that need it
            const dashboardPeriod = mapHeatmapPeriodToDashboardPeriod(periodToUse)

            if (showRefreshing) setIsRefreshing(true)
            setError(null)
            setIsAuthError(false)

            try {
                const promises = []

                // 1. User Info (only on initial load or full refresh)
                // Usamos userRef para evitar loop de dependência no useCallback
                if (!userRef.current || showRefreshing) {
                    setIsLoadingUser(true)
                    promises.push(
                        fetchDashboardUser(activeOrgId)
                            .then(setUser)
                            .catch(e => {
                                const msg = handleError(e, 'usuário')
                                if (typeof msg === 'string' && msg.includes('sessão')) setError(msg)
                            })
                            .finally(() => setIsLoadingUser(false))
                    )
                }

                // 2. Metrics
                setIsLoadingMetrics(true)
                promises.push(
                    fetchDashboardMetrics(dashboardPeriod, activeOrgId)
                        .then(setMetrics)
                        .catch(e => setError(handleError(e, 'métricas')))
                        .finally(() => setIsLoadingMetrics(false))
                )

                // 3. Heatmap (uses heatmap period directly)
                promises.push(
                    fetchDashboardHeatmap(periodToUse, activeOrgId)
                        .then(setHeatmap)
                        .catch(e => console.warn(handleError(e, 'heatmap')))
                )

                // 4. Subjects
                promises.push(
                    fetchDashboardSubjects(dashboardPeriod, activeOrgId)
                        .then(setSubjects)
                        .catch(e => console.warn(handleError(e, 'disciplinas')))
                )

                // 5. Efficiency
                promises.push(
                    fetchDashboardEfficiency(dashboardPeriod, activeOrgId)
                        .then(setEfficiency)
                        .catch(e => console.warn(handleError(e, 'eficiência')))
                )

                // 6. Strategic
                promises.push(
                    fetchDashboardStrategic(dashboardPeriod, activeOrgId)
                        .then(setStrategic)
                        .catch(e => console.warn(handleError(e, 'domínio estratégico')))
                )

                // 7. Distribution
                promises.push(
                    fetchDashboardDistribution(dashboardPeriod, activeOrgId)
                        .then(setDistribution)
                        .catch(e => console.warn(handleError(e, 'distribuição')))
                )

                // 8. Leaderboard
                if (activeOrgId) {
                    promises.push(
                        fetchLeaderboard(activeOrgId)
                            .then(setLeaderboard)
                            .catch(e => console.warn(handleError(e, 'ranking')))
                    )
                }

                await Promise.all(promises)
                hasLoadedOnce.current = true
                setLastRefresh(new Date())

            } catch (err) {
                const msg = handleError(err, 'dados')
                setError(msg)
            } finally {
                setIsRefreshing(false)
            }
        },
        [heatmapPeriod, activeOrgId]
    )

    // Efeito para carregar dados - centraliza o gatilho de carregamento inicial e mudanças de período/org
    useEffect(() => {
        loadData()
    }, [loadData])

    // Handler para mudança de período do heatmap
    const handleHeatmapPeriodChange = useCallback(
        (period: HeatmapPeriod) => {
            setHeatmapPeriod(period)
            // Não chamamos loadData aqui diretamente para evitar chamadas duplicadas, 
            // já que a mudança no heatmapPeriod recriará o loadData e disparará o useEffect
        },
        []
    )

    // Refresh automático
    useEffect(() => {
        if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = setInterval(() => {
            loadData(true)
        }, AUTO_REFRESH_INTERVAL)
        return () => {
            if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
        }
    }, [loadData])

    // Subscription Realtime
    useEffect(() => {
        let channel: ReturnType<ReturnType<typeof import('@/app/shared/core/client').createClient>['channel']> | null = null
        let supabaseInstance: ReturnType<typeof import('@/app/shared/core/client').createClient> | null = null

        async function setupRealtimeSubscription() {
            const { createClient } = await import('@/app/shared/core/client')
            supabaseInstance = createClient()
            const { data: { user } } = await supabaseInstance.auth.getUser()
            if (!user) return

            const { data: cronograma } = await supabaseInstance
                .from('cronogramas')
                .select('id')
                .eq('usuario_id', user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle<{ id: string }>()

            if (!cronograma) return

            channel = supabaseInstance
                .channel(`dashboard-cronograma-itens-${cronograma.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'cronograma_itens',
                        filter: `cronograma_id=eq.${cronograma.id}`,
                    },
                    () => loadData(true)
                )
                .subscribe()
        }

        setupRealtimeSubscription()

        return () => {
            if (channel && supabaseInstance) {
                supabaseInstance.removeChannel(channel)
            }
        }
    }, [loadData])

    const handleManualRefresh = () => {
        loadData(true)
    }

    if (isInitialLoading) {
        return <DashboardSkeleton />
    }

    if (error && !user) {
        return (
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <Alert variant="destructive" className="mt-8">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro ao carregar dashboard</AlertTitle>
                    <AlertDescription className="mt-2">
                        <p>{error}</p>
                        {isAuthError && (
                            <Button
                                onClick={() => router.push(loginUrl)}
                                variant="default"
                                size="sm"
                                className="mt-4 mr-2"
                            >
                                Ir para login
                            </Button>
                        )}
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

    if (!user || !metrics) {
        return (
            <div className="flex items-center justify-center min-h-100">
                <p className="text-muted-foreground">Nenhum dado disponível</p>
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-4 md:space-y-6">
            {/* Mensagem de erro (se houver dados mas também erro) */}
            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Aviso</AlertTitle>
                    <AlertDescription>{error}. Dados podem estar desatualizados.</AlertDescription>
                </Alert>
            )}

            {/* Header: Saudação + Modo Foco */}
            <DashboardHeader user={user} />

            {/* 1. Progresso do Cronograma */}
            <ScheduleProgress value={metrics.scheduleProgress} streakDays={user.streakDays} />

            {/* 2. KPIs principais */}
            <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
                <MetricCard
                    label="Tempo Total de Estudo"
                    value={metrics.focusTime}
                    icon={Clock}
                    variant="time"
                    trend={{
                        value: metrics.focusTimeDelta,
                        isPositive: metrics.focusTimeDelta.startsWith('+'),
                    }}
                    tooltip={[
                        'Tempo total de estudo no período, somando aulas assistidas e sessões de exercícios.',
                        'O valor mostra a diferença em relação ao período anterior.',
                    ]}
                />
                <MetricCard
                    label="Tempo de Aulas"
                    value={metrics.classTime}
                    icon={MonitorPlay}
                    variant="classTime"
                    tooltip={[
                        'Tempo de aulas assistidas no período.',
                        'Baseado no tempo estimado de cada aula concluída no cronograma.',
                    ]}
                />
                <MetricCard
                    label="Tempo de Exercícios"
                    value={metrics.exerciseTime}
                    icon={Timer}
                    variant="exerciseTime"
                    tooltip={[
                        'Tempo líquido resolvendo exercícios no modo foco.',
                        'Contabiliza apenas o tempo efetivo das sessões concluídas.',
                    ]}
                />
                <MetricCard
                    label="Questões Feitas"
                    value={metrics.questionsAnswered}
                    subtext={metrics.questionsAnsweredPeriod}
                    icon={CheckCircle2}
                    variant="questions"
                    tooltip={[
                        'Total de questões resolvidas no período.',
                        'Resolver questões é fundamental para fixar o conteúdo!',
                    ]}
                />
                <MetricCard
                    label="Aproveitamento"
                    value={`${metrics.accuracy}%`}
                    icon={Target}
                    variant="accuracy"
                    showProgressCircle={true}
                    progressValue={metrics.accuracy}
                    tooltip={[
                        'Porcentagem de acertos nas questões resolvidas.',
                        'Quanto maior, melhor você está dominando o conteúdo.',
                    ]}
                />
                <MetricCard
                    label="Flashcards"
                    value={metrics.flashcardsReviewed}
                    subtext="Cartas revisadas"
                    icon={Brain}
                    variant="flashcards"
                    tooltip={[
                        'Cartas de flashcards revisadas.',
                        'Técnica eficaz para memorização e revisão rápida!',
                    ]}
                />
            </div>

            {/* 3. Consistência de Estudo */}
            <ConsistencyHeatmap
                data={heatmap}
                period={heatmapPeriod}
                onPeriodChange={handleHeatmapPeriodChange}
            />

            {/* 5. Desempenho por Disciplina */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6 items-stretch">
                <div className="lg:col-span-3 h-112.5">
                    <SubjectPerformanceList subjects={subjects} period={mapHeatmapPeriodToDashboardPeriod(heatmapPeriod)} />
                </div>
                <div className="lg:col-span-2">
                    <SubjectDistribution data={distribution} period={mapHeatmapPeriodToDashboardPeriod(heatmapPeriod)} />
                </div>
            </div>

            {/* 6. Análises detalhadas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <FocusEfficiencyChart data={efficiency} />
                {strategic && <StrategicDomainComponent data={strategic} />}
            </div>

            {/* 7. Banco de Questões */}
            <QuestionBankSection
                period={mapHeatmapPeriodToDashboardPeriod(heatmapPeriod)}
                empresaId={activeOrgId}
            />
        </div>
    )
}
