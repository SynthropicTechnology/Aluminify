'use client'

import { GraduationCap, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
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
    <Card className="group overflow-hidden rounded-2xl pt-0 dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5 hover:shadow-lg">
      <div className="h-0.5 bg-linear-to-r from-teal-400 to-cyan-500" />
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-cyan-500">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <h3 className="widget-title">Performance por Disciplina</h3>
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
                    Performance por Disciplina
                  </p>
                  <div className="space-y-2 text-muted-foreground">
                    <p className="leading-relaxed">
                      Lista de todas as disciplinas com pelo menos um
                      aluno ativo no período. Para cada uma, mostra
                      quantos alunos estudaram e quantas questões foram
                      respondidas.
                    </p>
                    <p className="leading-relaxed">
                      <strong>Atenção:</strong> &quot;alunos&quot; e
                      &quot;questões&quot; vêm de fontes diferentes —
                      alunos é contagem de sessões de estudo na
                      disciplina; questões vem do progresso de listas
                      de exercícios. Pode haver alunos sem questões
                      respondidas se estiverem estudando só por aulas
                      ou flashcards.
                    </p>
                    <p className="leading-relaxed">
                      Disciplinas sem questões respondidas aparecem
                      como &quot;—&quot; (não como 0%) para não serem
                      confundidas com baixo desempenho.
                    </p>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
              {disciplinas.map((disciplina) => {
                const alunosLabel = `${disciplina.alunosAtivos} ${disciplina.alunosAtivos === 1 ? 'aluno' : 'alunos'}`
                const subtitle = disciplina.temDadosAproveitamento
                  ? `${disciplina.totalQuestoes} questões · ${alunosLabel}`
                  : `${alunosLabel} · sem questões respondidas`
                return (
                  <div key={disciplina.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{disciplina.name}</p>
                        {disciplina.temDadosAproveitamento ? (
                          <p className="text-xs text-muted-foreground">{subtitle}</p>
                        ) : (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-xs text-muted-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-2">
                                  {subtitle}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                align="start"
                                className="max-w-80 p-4 text-sm"
                                sideOffset={4}
                              >
                                <div className="space-y-3">
                                  <p className="font-semibold border-b border-border pb-2">
                                    Por que &quot;sem questões respondidas&quot;?
                                  </p>
                                  <div className="space-y-2 text-muted-foreground">
                                    <p className="leading-relaxed">
                                      Os {disciplina.alunosAtivos === 1 ? 'aluno estudou' : `${disciplina.alunosAtivos} alunos estudaram`}
                                      {' '}essa disciplina no período (sessões cronometradas), mas ninguém abriu uma lista de exercícios atrelada a ela.
                                    </p>
                                    <p className="leading-relaxed font-medium text-foreground">
                                      Causas mais prováveis:
                                    </p>
                                    <ul className="list-disc pl-4 space-y-1 text-xs leading-relaxed">
                                      <li>
                                        <strong>A disciplina ainda não tem listas de exercícios cadastradas.</strong>
                                        {' '}Os alunos estão estudando só por aulas, flashcards ou modo foco.
                                      </li>
                                      <li>
                                        <strong>As listas existem mas ninguém abriu no período.</strong>
                                        {' '}Tente alternar para um período mais longo (anual) para confirmar.
                                      </li>
                                      <li>
                                        <strong>Atividades órfãs no cadastro.</strong>
                                        {' '}As listas existem mas estão soltas do encadeamento atividade → módulo → frente → disciplina, então o sistema não consegue atribuí-las à disciplina certa.
                                      </li>
                                    </ul>
                                  </div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {disciplina.temDadosAproveitamento ? (
                        <span className={cn('text-sm font-bold tabular-nums ml-3', getPerformanceTextColor(disciplina.aproveitamento))}>
                          {disciplina.aproveitamento}%
                        </span>
                      ) : (
                        <span className="text-sm font-bold tabular-nums ml-3 text-muted-foreground">
                          —
                        </span>
                      )}
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                      {disciplina.temDadosAproveitamento ? (
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
                            getPerformanceColor(disciplina.aproveitamento)
                          )}
                          style={{ width: `${disciplina.aproveitamento}%` }}
                        />
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
