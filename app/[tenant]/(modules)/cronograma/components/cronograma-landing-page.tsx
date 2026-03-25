'use client'

import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { Plus, CalendarCheck, AlertTriangle, BookOpen, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/app/shared/components/feedback/alert'
import { Progress } from '@/app/shared/components/feedback/progress'
import { Badge } from '@/components/ui/badge'
import { PageShell } from '@/app/shared/components/layout/page-shell'
import { cn } from '@/lib/utils'

interface CronogramaSummary {
  id: string
  nome: string | null
  data_inicio: string
  data_fim: string
  modalidade_estudo: string
  created_at: string | null
  curso_alvo_id: string | null
  curso_nome: string | null
  total_itens: number
  itens_concluidos: number
}

interface CronogramaLandingPageProps {
  cronogramas: CronogramaSummary[]
  hasBaseContent: boolean
}

export function CronogramaLandingPage({ cronogramas, hasBaseContent }: CronogramaLandingPageProps) {
  const router = useRouter()
  const params = useParams()
  const tenant = params?.tenant as string

  const navigateTo = (path: string) => {
    router.push(tenant ? `/${tenant}${path}` : path)
  }

  return (
    <PageShell
      title="Cronograma de Estudo"
      subtitle="Organize sua rotina de estudos com cronogramas personalizados"
      actions={
        hasBaseContent ? (
          <Button onClick={() => navigateTo('/cronograma/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Gerar novo cronograma
          </Button>
        ) : undefined
      }
    >
      {!hasBaseContent && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-300">Conteúdo ainda não disponível</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-400">
            Sua instituição ainda não disponibilizou o conteúdo programático.
            Assim que o conteúdo for publicado, você poderá gerar seu cronograma de estudo.
          </AlertDescription>
        </Alert>
      )}

      {cronogramas.length === 0 && hasBaseContent && (
        <Card className="border-dashed border-2 rounded-2xl dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted/60 p-4 mb-4">
              <CalendarCheck className="h-8 w-8 text-foreground/70" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum cronograma criado</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Crie seu primeiro cronograma de estudo personalizado.
              O sistema distribui as aulas de forma inteligente de acordo com suas preferências.
            </p>
            <Button onClick={() => navigateTo('/cronograma/novo')}>
              <Plus className="mr-2 h-4 w-4" />
              Gerar meu primeiro cronograma
            </Button>
          </CardContent>
        </Card>
      )}

      {cronogramas.length > 0 && (
        <div className="grid gap-3">
          {cronogramas.map((cronograma) => {
            const progress = cronograma.total_itens > 0
              ? Math.round((cronograma.itens_concluidos / cronograma.total_itens) * 100)
              : 0

            const modalidadeLabel = cronograma.modalidade_estudo === 'paralelo'
              ? 'Frentes em Paralelo'
              : 'Sequencial'

            return (
              <Card
                key={cronograma.id}
                className={cn(
                  'cursor-pointer transition-colors duration-200 motion-reduce:transition-none group overflow-hidden rounded-2xl pt-0',
                  'hover:shadow-lg hover:shadow-foreground/5 hover:border-foreground/20',
                  'dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5',
                  'dark:hover:shadow-white/5 dark:hover:border-white/15'
                )}
                onClick={() => navigateTo(`/cronograma/${cronograma.id}`)}
              >
                <div className="h-0.5 bg-linear-to-r from-foreground/40 to-foreground/10 dark:from-white/30 dark:to-white/5" />
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="hidden sm:flex shrink-0 rounded-xl p-3 bg-foreground dark:bg-white/90">
                    <BookOpen className="h-5 w-5 text-background dark:text-slate-900" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">
                        {cronograma.nome || 'Meu Cronograma'}
                      </h3>
                      {cronograma.curso_nome && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {cronograma.curso_nome}
                        </Badge>
                      )}
                      <Badge variant="outline" className="shrink-0 text-xs bg-foreground/5 text-foreground/70 border-foreground/15 dark:bg-white/10 dark:text-white/70 dark:border-white/15">
                        {modalidadeLabel}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {format(new Date(cronograma.data_inicio), "dd MMM yyyy", { locale: ptBR })} — {format(new Date(cronograma.data_fim), "dd MMM yyyy", { locale: ptBR })}
                      </span>
                      <span>
                        {cronograma.itens_concluidos}/{cronograma.total_itens} aulas
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Progress value={progress} className="h-1.5 flex-1 [&>div]:bg-foreground/70 dark:[&>div]:bg-white/70" />
                      <span className="text-xs font-medium tabular-nums w-8 text-right">{progress}%</span>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 transition-colors group-hover:text-foreground" />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}
