'use client'

import { GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { DisciplinaPerformance } from '@/app/[tenant]/(modules)/dashboard/types'
import { cn } from '@/lib/utils'

interface DisciplinaPerformanceListProps {
  disciplinas: DisciplinaPerformance[]
}

function getPerformanceColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

function getPerformanceTextColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-yellow-600 dark:text-yellow-400'
  if (score >= 40) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

export function DisciplinaPerformanceList({ disciplinas }: DisciplinaPerformanceListProps) {
  return (
    <Card className="overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
      <div className="h-0.5 bg-linear-to-r from-teal-400 to-cyan-500" />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-cyan-500">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <h3 className="widget-title">Performance por Disciplina</h3>
        </div>

        {disciplinas.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-25 gap-3 py-8">
            <GraduationCap className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Nenhuma disciplina com dados de performance</p>
              <p className="text-xs text-muted-foreground/70">Dados de performance aparecem conforme alunos respondem questões.</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-52 pr-3">
            <div className="space-y-4">
              {disciplinas.map((disciplina) => (
                <div key={disciplina.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{disciplina.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {disciplina.totalQuestoes} questões · {disciplina.alunosAtivos} alunos
                      </p>
                    </div>
                    <span className={cn('text-sm font-bold tabular-nums ml-3', getPerformanceTextColor(disciplina.aproveitamento))}>
                      {disciplina.aproveitamento}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
                        getPerformanceColor(disciplina.aproveitamento)
                      )}
                      style={{ width: `${disciplina.aproveitamento}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
