'use client'

import {
  RefreshCw,
  Users,
  GraduationCap,
  BookOpen,
  Building2,
  TrendingUp,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useState } from 'react'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

// ---------------------------------------------------------------------------
// Dados fictícios para o mockup
// ---------------------------------------------------------------------------

const MOCK_DATA = {
  userName: 'Suelen',
  empresaNome: 'Jana Rabelo',
  summary: {
    totalAlunos: 566,
    alunosAtivos: 482,
    totalProfessores: 24,
    totalCursos: 10,
  },
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatItem({
  icon: Icon,
  value,
  label,
  trend,
  className,
}: {
  icon: typeof Users
  value: number
  label: string
  trend?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl bg-card border border-border/50 px-4 py-3 shadow-sm transition-all hover:shadow-md hover:border-border', className)}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5">
        <Icon className="h-5 w-5 text-primary/70" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-bold tabular-nums tracking-tight">{value.toLocaleString('pt-BR')}</span>
          {trend && (
            <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function PeriodSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = [
    { value: 'semanal', label: 'Semanal' },
    { value: 'mensal', label: 'Mensal' },
    { value: 'anual', label: 'Anual' },
  ]

  return (
    <div className="inline-flex items-center rounded-lg bg-muted/50 p-0.5 border border-border/50">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium rounded-md transition-all cursor-pointer',
            value === opt.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Mockup Page
// ---------------------------------------------------------------------------

export default function DashboardMockupPage() {
  const [period, setPeriod] = useState('mensal')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 1500)
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-6">
      {/* Banner de mockup */}
      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">
        Mockup — Visualizacao do novo design do header do dashboard
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* HEADER — Saudacao + Controles                                     */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Saudacao — sem card, solto */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {getGreeting()}, {MOCK_DATA.userName}!
            </h1>
            <span className="text-2xl md:text-3xl" role="img" aria-label="Acenando">
              👋
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Acompanhe o desempenho geral da sua instituicao
          </p>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-2 shrink-0">
          <PeriodSelector value={period} onChange={setPeriod} />
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="icon"
            className="shrink-0 h-9 w-9"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* INSTITUICAO — Info + Stats                                        */}
      {/* ----------------------------------------------------------------- */}
      <div className="space-y-4">
        {/* Instituicao nome */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-md shadow-violet-500/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Instituicao</p>
              <p className="text-lg font-semibold">{MOCK_DATA.empresaNome}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5 hidden sm:inline-flex">
            Gerenciar Alunos
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatItem
            icon={Users}
            value={MOCK_DATA.summary.totalAlunos}
            label="Alunos matriculados"
            trend="+12%"
          />
          <StatItem
            icon={Users}
            value={MOCK_DATA.summary.alunosAtivos}
            label="Alunos ativos"
          />
          <StatItem
            icon={GraduationCap}
            value={MOCK_DATA.summary.totalProfessores}
            label="Professores"
          />
          <StatItem
            icon={BookOpen}
            value={MOCK_DATA.summary.totalCursos}
            label="Cursos"
          />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Placeholder para o restante do dashboard                          */}
      {/* ----------------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-28 rounded-2xl border border-dashed border-border/60 bg-muted/20 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">KPI Card {i}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
