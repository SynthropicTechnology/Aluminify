'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { BookOpen, TrendingUp, AlertTriangle, Clock, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/app/shared/library/utils'
import type {
  DashboardPeriod,
  QuestionBankMetrics,
  QuestionPerformanceBySubject,
} from '../../types'
import { fetchQuestionBankMetrics } from '../../services/aluno/dashboard.service'

interface QuestionBankSectionProps {
  period: DashboardPeriod
  empresaId?: string
}

function formatTime(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

function PerformanceBar({ item }: { item: QuestionPerformanceBySubject }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium">{item.disciplinaNome}</span>
        <span className="shrink-0 ml-2 tabular-nums text-muted-foreground">
          {item.acertos}/{item.total} ({item.percentual}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            item.percentual >= 70
              ? "bg-green-500 dark:bg-green-600"
              : item.percentual >= 40
                ? "bg-yellow-500 dark:bg-yellow-600"
                : "bg-red-500 dark:bg-red-600"
          )}
          style={{ width: `${item.percentual}%` }}
        />
      </div>
    </div>
  )
}

export function QuestionBankSection({ period, empresaId }: QuestionBankSectionProps) {
  const [metrics, setMetrics] = useState<QuestionBankMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExpanded, setIsExpanded] = useState(true)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const loadMetrics = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await fetchQuestionBankMetrics(period, empresaId)
      setMetrics(data)
    } catch (err) {
      console.warn('[QuestionBankSection] Erro ao carregar métricas:', err)
    } finally {
      setIsLoading(false)
    }
  }, [period, empresaId])

  useEffect(() => {
    loadMetrics()
  }, [loadMetrics])

  if (isLoading) {
    return (
      <Card className="rounded-2xl dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5">
        <CardContent className="p-4 md:p-5">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!metrics || metrics.totalRespondidas === 0) return null

  const axisColor = isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.7)'
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  const percentualGeral = metrics.totalRespondidas > 0
    ? Math.round((metrics.acertos / metrics.totalRespondidas) * 100)
    : 0

  return (
    <Card className="overflow-hidden transition-colors duration-200 motion-reduce:transition-none rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5">
      <div className="h-0.5 bg-linear-to-r from-indigo-400 to-violet-500" />
      <CardContent className="p-4 md:p-5 space-y-4">
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 to-violet-500">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <h3 className="widget-title">Banco de Questões</h3>
          </div>
          {isExpanded
            ? <ChevronUp className="h-5 w-5 text-muted-foreground" />
            : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="space-y-5">
            {/* Mini KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <CheckCircle2 className="mx-auto h-5 w-5 text-green-500 mb-1" />
                <p className="text-lg font-bold tabular-nums">{metrics.acertos}</p>
                <p className="text-xs text-muted-foreground">Acertos</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <XCircle className="mx-auto h-5 w-5 text-red-500 mb-1" />
                <p className="text-lg font-bold tabular-nums">{metrics.erros}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <TrendingUp className="mx-auto h-5 w-5 text-indigo-500 mb-1" />
                <p className="text-lg font-bold tabular-nums">{percentualGeral}%</p>
                <p className="text-xs text-muted-foreground">Aproveitamento</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <Clock className="mx-auto h-5 w-5 text-amber-500 mb-1" />
                <p className="text-lg font-bold tabular-nums">{formatTime(metrics.tempoMedio)}</p>
                <p className="text-xs text-muted-foreground">Tempo médio</p>
              </div>
            </div>

            {/* Performance por Disciplina */}
            {metrics.performancePorDisciplina.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Desempenho por Disciplina</h4>
                <div className="space-y-2.5">
                  {metrics.performancePorDisciplina.map((item) => (
                    <PerformanceBar key={item.disciplinaId} item={item} />
                  ))}
                </div>
              </div>
            )}

            {/* Evolução Temporal */}
            {metrics.evolucaoTemporal.length > 1 && (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Evolução no Período</h4>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.evolucaoTemporal}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis
                        dataKey="data"
                        tick={{ fontSize: 11, fill: axisColor }}
                        tickFormatter={(v: string) => {
                          const d = new Date(v + 'T00:00:00')
                          return `${d.getDate()}/${d.getMonth() + 1}`
                        }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: axisColor }}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, 'Aproveitamento']}
                        labelFormatter={(label) => {
                          const d = new Date(String(label) + 'T00:00:00')
                          return d.toLocaleDateString('pt-BR')
                        }}
                        contentStyle={{
                          backgroundColor: isDark ? '#1e1e2e' : '#fff',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e5e7eb',
                          borderRadius: 8,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="percentual"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ fill: '#6366f1', r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tópicos Mais Errados */}
            {metrics.topicosMaisErrados.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <h4 className="text-sm font-medium text-muted-foreground">Tópicos para Revisar</h4>
                </div>
                <div className="space-y-2">
                  {metrics.topicosMaisErrados.map((topic, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{topic.disciplinaNome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[topic.frenteNome, topic.moduloNome].filter(Boolean).join(' · ') || 'Geral'}
                        </p>
                      </div>
                      <div className="ml-3 shrink-0">
                        <span className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          topic.percentualErro >= 70
                            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            : topic.percentualErro >= 50
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        )}>
                          {topic.totalErros}/{topic.totalRespondidas} erros
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
