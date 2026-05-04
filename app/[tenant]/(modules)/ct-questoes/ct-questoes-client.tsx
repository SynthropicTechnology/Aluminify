"use client"

import * as React from "react"
import { useCurrentUser } from "@/components/providers/user-provider"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/shared/components/overlay/dialog"
import {
  Loader2,
  ClipboardList,
  Play,
  RotateCcw,
  Trophy,
  CheckCircle2,
  Clock,
  ChevronRight,
  BookOpen,
  Target,
  Filter,
  X,
} from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/forms/select"
import { cn } from "@/app/shared/library/utils"

type ListaParaAluno = {
  id: string
  titulo: string
  descricao: string | null
  tipo: "exercicio" | "simulado" | "outro"
  modosCorrecaoPermitidos: "por_questao" | "ao_final" | "ambos"
  totalQuestoes: number
  disciplinas: string[]
  createdAt: string
}

type Progresso = {
  listaId: string
  tentativaAtual: number
  totalQuestoes: number
  totalRespondidas: number
  finalizada: boolean
}

type Resultado = {
  listaId: string
  tentativa: number
  resumo: {
    total: number
    acertos: number
    percentual: number
  }
}

export default function CtQuestoesClient() {
  const _user = useCurrentUser()
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string

  const [listas, setListas] = React.useState<ListaParaAluno[]>([])
  const [progressos, setProgressos] = React.useState<Map<string, Progresso>>(new Map())
  const [isLoading, setIsLoading] = React.useState(true)

  const [resultadoDialog, setResultadoDialog] = React.useState<Resultado | null>(null)
  const [isLoadingResultado, setIsLoadingResultado] = React.useState(false)

  const [filtroDisciplina, setFiltroDisciplina] = React.useState<string>("todas")
  const [filtroStatus, setFiltroStatus] = React.useState<string>("todas")

  const fetchListas = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/listas?available=true", {
        headers: { "x-tenant-slug": tenantSlug },
      })
      if (!res.ok) throw new Error("Erro ao buscar listas")
      const json = await res.json()
      const data: ListaParaAluno[] = json.data ?? []
      setListas(data)

      const progressoMap = new Map<string, Progresso>()
      const results = await Promise.allSettled(
        data.map(async (lista) => {
          const pRes = await fetch(`/api/listas/${lista.id}/progresso`, {
            headers: { "x-tenant-slug": tenantSlug },
          })
          if (!pRes.ok) return null
          const pJson = await pRes.json()
          return pJson.data as Progresso
        })
      )
      results.forEach((r) => {
        if (r.status === "fulfilled" && r.value) {
          progressoMap.set(r.value.listaId, r.value)
        }
      })
      setProgressos(progressoMap)
    } catch {
      setListas([])
    } finally {
      setIsLoading(false)
    }
  }, [tenantSlug])

  React.useEffect(() => {
    fetchListas()
  }, [fetchListas])

  async function handleVerResultado(listaId: string) {
    setIsLoadingResultado(true)
    try {
      const res = await fetch(`/api/listas/${listaId}/resultado`, {
        headers: { "x-tenant-slug": tenantSlug },
      })
      if (!res.ok) throw new Error("Erro ao buscar resultado")
      const json = await res.json()
      setResultadoDialog(json.data)
    } catch (err) {
      console.error("[CtQuestoes] Resultado error:", err)
    } finally {
      setIsLoadingResultado(false)
    }
  }

  function getListaStatus(lista: ListaParaAluno): "nao_iniciada" | "em_andamento" | "finalizada" {
    const progresso = progressos.get(lista.id)
    if (!progresso || progresso.totalRespondidas === 0) return "nao_iniciada"
    if (progresso.finalizada) return "finalizada"
    return "em_andamento"
  }

  function getProgressPercent(listaId: string): number {
    const p = progressos.get(listaId)
    if (!p || p.totalQuestoes === 0) return 0
    return Math.round((p.totalRespondidas / p.totalQuestoes) * 100)
  }

  function handleIniciar(listaId: string) {
    router.push(`/${tenantSlug}/ct-questoes/${listaId}`)
  }

  const statusConfig = {
    nao_iniciada: {
      label: "Não iniciada",
      variant: "secondary" as const,
      icon: Clock,
    },
    em_andamento: {
      label: "Em andamento",
      variant: "warning" as const,
      icon: Play,
    },
    finalizada: {
      label: "Finalizada",
      variant: "success" as const,
      icon: CheckCircle2,
    },
  }

  const disciplinasUnicas = React.useMemo(() => {
    const set = new Set<string>()
    for (const lista of listas) {
      for (const d of lista.disciplinas) set.add(d)
    }
    return Array.from(set).sort()
  }, [listas])

  const listasFiltradas = React.useMemo(() => {
    return listas.filter((lista) => {
      if (filtroDisciplina !== "todas" && !lista.disciplinas.includes(filtroDisciplina)) {
        return false
      }
      if (filtroStatus !== "todas") {
        const status = getListaStatus(lista)
        if (filtroStatus === "nao_feitas" && status === "finalizada") return false
        if (filtroStatus === "feitas" && status !== "finalizada") return false
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas, progressos, filtroDisciplina, filtroStatus])

  const hasActiveFilters = filtroDisciplina !== "todas" || filtroStatus !== "todas"

  function clearFilters() {
    setFiltroDisciplina("todas")
    setFiltroStatus("todas")
  }

  const concluidas = Array.from(progressos.values()).filter((p) => p.finalizada).length
  const emAndamento = Array.from(progressos.values()).filter(
    (p) => !p.finalizada && p.totalRespondidas > 0,
  ).length
  const totalQuestoes = listas.reduce((sum, l) => sum + l.totalQuestoes, 0)

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-1 pt-4 md:pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          CT de Questões
        </h1>
        <p className="text-sm text-muted-foreground">
          Pratique com listas de exercícios e acompanhe seu desempenho
        </p>
      </div>

      {/* Stats summary */}
      {!isLoading && listas.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
          {([
            {
              label: "Listas",
              value: listas.length,
              icon: BookOpen,
              accentFrom: "from-teal-400",
              accentTo: "to-cyan-500",
              iconBg: "bg-linear-to-br from-teal-500 to-cyan-500",
              hoverShadow: "hover:shadow-teal-500/8",
            },
            {
              label: "Concluídas",
              value: concluidas,
              icon: CheckCircle2,
              accentFrom: "from-emerald-400",
              accentTo: "to-green-500",
              iconBg: "bg-linear-to-br from-emerald-500 to-green-500",
              hoverShadow: "hover:shadow-emerald-500/8",
            },
            {
              label: "Em andamento",
              value: emAndamento,
              icon: Play,
              accentFrom: "from-amber-400",
              accentTo: "to-orange-500",
              iconBg: "bg-linear-to-br from-amber-500 to-orange-500",
              hoverShadow: "hover:shadow-amber-500/8",
            },
            {
              label: "Questões",
              value: totalQuestoes,
              icon: Target,
              accentFrom: "from-blue-400",
              accentTo: "to-indigo-500",
              iconBg: "bg-linear-to-br from-blue-500 to-indigo-500",
              hoverShadow: "hover:shadow-blue-500/8",
            },
          ] as const).map((stat) => {
            const StatIcon = stat.icon
            return (
              <Card
                key={stat.label}
                className={cn(
                  "group overflow-hidden transition-colors duration-200 motion-reduce:transition-none py-0 gap-0 rounded-2xl",
                  "dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5",
                  "hover:shadow-lg",
                  stat.hoverShadow,
                )}
              >
                <div className={cn("h-0.5 bg-linear-to-r", stat.accentFrom, stat.accentTo)} />
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium leading-tight">{stat.label}</span>
                    <div className={cn(
                      "flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-xl transition-colors duration-200 motion-reduce:transition-none",
                      stat.iconBg,
                    )}>
                      <StatIcon className="h-4 w-4 md:h-4.5 md:w-4.5 text-white" />
                    </div>
                  </div>
                  <span className="text-2xl md:text-3xl font-bold tabular-nums">{stat.value}</span>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Filters */}
      {!isLoading && listas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/30 p-2.5 dark:bg-muted/10">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0 pl-1">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
          </div>

          {disciplinasUnicas.length > 1 && (
            <Select value={filtroDisciplina} onValueChange={setFiltroDisciplina}>
              <SelectTrigger className="w-[180px] h-9 text-sm bg-background rounded-lg">
                <SelectValue placeholder="Disciplina" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as disciplinas</SelectItem>
                {disciplinasUnicas.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[160px] h-9 text-sm bg-background rounded-lg">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              <SelectItem value="nao_feitas">Não feitas</SelectItem>
              <SelectItem value="feitas">Já feitas</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-xs cursor-pointer rounded-lg">
              <X className="h-3.5 w-3.5 mr-1" />
              Limpar
            </Button>
          )}

          {hasActiveFilters && (
            <span className="text-xs text-muted-foreground ml-auto pr-1">
              {listasFiltradas.length} de {listas.length} listas
            </span>
          )}
        </div>
      )}

      {/* Lists */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : listas.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <ClipboardList className="h-8 w-8" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nenhuma lista disponível</EmptyTitle>
            <EmptyDescription>
              Quando seu professor criar listas de exercícios, elas aparecerão aqui.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : listasFiltradas.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Filter className="h-8 w-8" />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>Nenhuma lista encontrada</EmptyTitle>
            <EmptyDescription>
              Nenhuma lista corresponde aos filtros selecionados.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={clearFilters} className="mt-2 cursor-pointer">
            Limpar filtros
          </Button>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listasFiltradas.map((lista) => {
            const status = getListaStatus(lista)
            const config = statusConfig[status]
            const percent = getProgressPercent(lista.id)
            const progresso = progressos.get(lista.id)
            const StatusIcon = config.icon

            const accentColors = {
              nao_iniciada: { from: "from-slate-300", to: "to-slate-400" },
              em_andamento: { from: "from-amber-400", to: "to-orange-500" },
              finalizada: { from: "from-emerald-400", to: "to-green-500" },
            }
            const accent = accentColors[status]

            return (
              <Card
                key={lista.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl py-0 gap-0",
                  "transition-all duration-200 motion-reduce:transition-none",
                  "hover:shadow-lg",
                  "dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5",
                )}
              >
                <div className={cn("h-0.5 bg-linear-to-r", accent.from, accent.to)} />

                <div className="flex flex-1 flex-col p-4 md:p-5 gap-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 basis-32 text-base font-semibold leading-tight line-clamp-2">
                      {lista.titulo}
                    </h3>
                    <Badge
                      variant={config.variant}
                      className="max-w-full shrink-0 text-xs"
                    >
                      <StatusIcon className="mr-1 h-3 w-3 shrink-0" />
                      {config.label}
                    </Badge>
                  </div>

                  {lista.descricao && (
                    <p className="text-xs text-muted-foreground line-clamp-2 -mt-2">
                      {lista.descricao}
                    </p>
                  )}

                  <div className="mt-auto flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {progresso
                            ? `${progresso.totalRespondidas}/${progresso.totalQuestoes} questões`
                            : `${lista.totalQuestoes} questões`}
                        </span>
                        <span className="tabular-nums">{percent}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            status === "finalizada"
                              ? "bg-emerald-500"
                              : status === "em_andamento"
                                ? "bg-amber-500"
                                : "bg-muted-foreground/20",
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 shrink-0">
                          {lista.tipo === "simulado" ? "Simulado" : lista.tipo === "outro" ? "Outro" : "Exercício"}
                        </Badge>
                        <span>
                          {lista.modosCorrecaoPermitidos === "ambos"
                            ? "Aluno escolhe modo"
                            : lista.modosCorrecaoPermitidos === "por_questao"
                              ? "Feedback imediato"
                              : "Correção ao final"}
                        </span>
                      </div>
                      <span className="tabular-nums">
                        {new Date(lista.createdAt).toLocaleDateString("pt-BR")}
                      </span>
                    </div>

                    {status === "nao_iniciada" && (
                      <Button
                        onClick={() => handleIniciar(lista.id)}
                        className="w-full cursor-pointer min-h-[44px]"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        Iniciar
                      </Button>
                    )}

                    {status === "em_andamento" && (
                      <Button
                        onClick={() => handleIniciar(lista.id)}
                        className="w-full cursor-pointer min-h-[44px]"
                      >
                        <ChevronRight className="mr-2 h-4 w-4" />
                        Continuar
                      </Button>
                    )}

                    {status === "finalizada" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleVerResultado(lista.id)}
                          className="flex-1 cursor-pointer min-h-[44px]"
                        >
                          <Trophy className="mr-2 h-4 w-4" />
                          Resultado
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => handleIniciar(lista.id)}
                          className="cursor-pointer min-h-[44px]"
                          title="Refazer lista"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Resultado Dialog */}
      <Dialog open={!!resultadoDialog} onOpenChange={(open) => !open && setResultadoDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Resultado da Lista</DialogTitle>
            <DialogDescription>
              Tentativa #{resultadoDialog?.tentativa ?? 1}
            </DialogDescription>
          </DialogHeader>

          {isLoadingResultado ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : resultadoDialog ? (
            <div className="flex flex-col items-center gap-6 py-6">
              <div className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full",
                resultadoDialog.resumo.percentual >= 70
                  ? "bg-linear-to-br from-emerald-500/20 to-green-500/20"
                  : resultadoDialog.resumo.percentual >= 50
                    ? "bg-linear-to-br from-amber-500/20 to-orange-500/20"
                    : "bg-linear-to-br from-rose-500/20 to-red-500/20",
              )}>
                <Trophy className={cn(
                  "h-12 w-12",
                  resultadoDialog.resumo.percentual >= 70
                    ? "text-emerald-600 dark:text-emerald-400"
                    : resultadoDialog.resumo.percentual >= 50
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400",
                )} />
              </div>

              <div className="text-center">
                <p className="text-4xl font-bold tabular-nums">
                  {resultadoDialog.resumo.percentual.toFixed(0)}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {resultadoDialog.resumo.acertos} de{" "}
                  {resultadoDialog.resumo.total} acertos
                </p>
              </div>

              <div className="w-full">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      resultadoDialog.resumo.percentual >= 70
                        ? "bg-linear-to-r from-emerald-400 to-green-500"
                        : resultadoDialog.resumo.percentual >= 50
                          ? "bg-linear-to-r from-amber-400 to-orange-500"
                          : "bg-linear-to-r from-rose-400 to-red-500",
                    )}
                    style={{ width: `${resultadoDialog.resumo.percentual}%` }}
                  />
                </div>
              </div>

              <div className="grid w-full grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-muted p-3">
                  <p className="text-lg font-bold tabular-nums">
                    {resultadoDialog.resumo.total}
                  </p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3">
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {resultadoDialog.resumo.acertos}
                  </p>
                  <p className="text-xs text-muted-foreground">Acertos</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3">
                  <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {resultadoDialog.resumo.total - resultadoDialog.resumo.acertos}
                  </p>
                  <p className="text-xs text-muted-foreground">Erros</p>
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              onClick={() => setResultadoDialog(null)}
              className="w-full cursor-pointer min-h-[44px]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
