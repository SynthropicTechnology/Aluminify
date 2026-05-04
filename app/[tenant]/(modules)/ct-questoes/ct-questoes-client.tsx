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
  Users,
  Search,
} from "lucide-react"
import { Input } from "@/components/forms/input"
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
  frentes: Array<{ id: string; nome: string }>
  modulos: Array<{ id: string; nome: string; frenteId: string | null }>
  createdAt: string
}

type Progresso = {
  listaId: string
  tentativaAtual: number
  totalQuestoes: number
  totalRespondidas: number
  finalizada: boolean
}

type ResultadoItem = {
  questaoId: string
  alternativaEscolhida: string
  correta: boolean
  gabarito: string
  tempoRespostaSegundos: number | null
  percentualAcertoGeral: number | null
}

type ResultadoQuestao = {
  id: string
  codigo: string | null
  numeroOriginal: number | null
  disciplina: string | null
  tags: string[]
  alternativas: Array<{ letra: string; ordem: number }>
}

type Resultado = {
  listaId: string
  tentativa: number
  itens: ResultadoItem[]
  resumo: {
    total: number
    acertos: number
    percentual: number
  }
}

function formatQuestionTime(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

function AlternativasGrid({
  gabarito,
  escolhida,
  alternativas,
}: {
  gabarito: string
  escolhida: string
  alternativas: Array<{ letra: string; ordem: number }>
}) {
  const sorted = [...alternativas].sort((a, b) => a.ordem - b.ordem)
  return (
    <div className="flex gap-1">
      {sorted.map((alt) => {
        const letraUp = alt.letra.toUpperCase()
        const isCorrect = letraUp === gabarito.toUpperCase()
        const isChosen = letraUp === escolhida.toUpperCase()
        let colorClass = "bg-muted text-muted-foreground"
        if (isCorrect) colorClass = "bg-green-600 text-white"
        else if (isChosen) colorClass = "bg-rose-500 text-white"
        return (
          <span
            key={alt.letra}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold",
              colorClass,
            )}
          >
            {letraUp}
          </span>
        )
      })}
    </div>
  )
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
  const [resultadoQuestoes, setResultadoQuestoes] = React.useState<ResultadoQuestao[]>([])
  const [isLoadingResultado, setIsLoadingResultado] = React.useState(false)

  const [filtroDisciplina, setFiltroDisciplina] = React.useState<string>("todas")
  const [filtroFrente, setFiltroFrente] = React.useState<string>("todas")
  const [filtroModulo, setFiltroModulo] = React.useState<string>("todas")
  const [filtroStatus, setFiltroStatus] = React.useState<string>("todas")
  const [filtroTipo, setFiltroTipo] = React.useState<string>("todos")
  const [busca, setBusca] = React.useState("")

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
    setResultadoDialog(null)
    setResultadoQuestoes([])
    try {
      const [resRes, listaRes] = await Promise.all([
        fetch(`/api/listas/${listaId}/resultado`, {
          headers: { "x-tenant-slug": tenantSlug },
        }),
        fetch(`/api/listas/${listaId}?available=true`, {
          headers: { "x-tenant-slug": tenantSlug },
        }),
      ])
      if (!resRes.ok) throw new Error("Erro ao buscar resultado")
      const resJson = await resRes.json()
      setResultadoDialog(resJson.data)

      if (listaRes.ok) {
        const listaJson = await listaRes.json()
        const questoes = (listaJson.data?.questoes ?? []) as ResultadoQuestao[]
        setResultadoQuestoes(questoes)
      }
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

  const frentesUnicas = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const lista of listas) {
      for (const f of lista.frentes ?? []) map.set(f.id, f.nome)
    }
    return Array.from(map.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [listas])

  const modulosUnicos = React.useMemo(() => {
    const map = new Map<string, { nome: string; frenteId: string | null }>()
    for (const lista of listas) {
      for (const m of lista.modulos ?? []) map.set(m.id, { nome: m.nome, frenteId: m.frenteId })
    }
    return Array.from(map.entries())
      .map(([id, info]) => ({ id, nome: info.nome, frenteId: info.frenteId }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [listas])

  const modulosFiltrados = React.useMemo(() => {
    if (filtroFrente === "todas") return modulosUnicos
    return modulosUnicos.filter((m) => m.frenteId === filtroFrente)
  }, [modulosUnicos, filtroFrente])

  React.useEffect(() => {
    if (filtroFrente !== "todas" && filtroModulo !== "todas") {
      const mod = modulosUnicos.find((m) => m.id === filtroModulo)
      if (mod && mod.frenteId !== filtroFrente) setFiltroModulo("todas")
    }
  }, [filtroFrente, filtroModulo, modulosUnicos])

  const buscaNorm = busca.trim().toLowerCase()

  const listasFiltradas = React.useMemo(() => {
    return listas.filter((lista) => {
      if (buscaNorm && !lista.titulo.toLowerCase().includes(buscaNorm) &&
          !(lista.descricao ?? "").toLowerCase().includes(buscaNorm)) {
        return false
      }
      if (filtroDisciplina !== "todas" && !lista.disciplinas.includes(filtroDisciplina)) {
        return false
      }
      if (filtroFrente !== "todas" && !(lista.frentes ?? []).some((f) => f.id === filtroFrente)) {
        return false
      }
      if (filtroModulo !== "todas" && !(lista.modulos ?? []).some((m) => m.id === filtroModulo)) {
        return false
      }
      if (filtroTipo !== "todos") {
        if (filtroTipo === "simulado" && lista.tipo !== "simulado") return false
        if (filtroTipo === "exercicio" && lista.tipo !== "exercicio") return false
      }
      if (filtroStatus !== "todas") {
        const status = getListaStatus(lista)
        if (filtroStatus === "nao_feitas" && status === "finalizada") return false
        if (filtroStatus === "feitas" && status !== "finalizada") return false
      }
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas, progressos, filtroDisciplina, filtroFrente, filtroModulo, filtroStatus, filtroTipo, buscaNorm])

  const hasActiveFilters = filtroDisciplina !== "todas" || filtroFrente !== "todas" || filtroModulo !== "todas" || filtroStatus !== "todas" || filtroTipo !== "todos" || buscaNorm !== ""

  function clearFilters() {
    setFiltroDisciplina("todas")
    setFiltroFrente("todas")
    setFiltroModulo("todas")
    setFiltroStatus("todas")
    setFiltroTipo("todos")
    setBusca("")
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
        <div className="rounded-xl bg-muted/30 p-3 dark:bg-muted/10 space-y-3">
          {/* Search + actions row */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
              <Filter className="h-4 w-4" />
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar lista..."
                className="h-9 text-sm bg-background rounded-lg pl-8"
              />
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-xs cursor-pointer rounded-lg shrink-0">
                <X className="h-3.5 w-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Filter selects — stretch to match search bar width */}
          <div className="flex flex-wrap gap-2">
            {disciplinasUnicas.length > 1 && (
              <div className="flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0">
                <Select value={filtroDisciplina} onValueChange={setFiltroDisciplina}>
                  <SelectTrigger className="w-full h-9 text-sm bg-background rounded-lg truncate">
                    <SelectValue placeholder="Disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas disciplinas</SelectItem>
                    {disciplinasUnicas.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {frentesUnicas.length > 0 && (
              <div className="flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0">
                <Select value={filtroFrente} onValueChange={setFiltroFrente}>
                  <SelectTrigger className="w-full h-9 text-sm bg-background rounded-lg truncate">
                    <SelectValue placeholder="Frente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas frentes</SelectItem>
                    {frentesUnicas.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {modulosFiltrados.length > 0 && (
              <div className="flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0">
                <Select value={filtroModulo} onValueChange={setFiltroModulo}>
                  <SelectTrigger className="w-full h-9 text-sm bg-background rounded-lg truncate">
                    <SelectValue placeholder="Módulo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todos módulos</SelectItem>
                    {modulosFiltrados.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0">
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-full h-9 text-sm bg-background rounded-lg truncate">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos tipos</SelectItem>
                  <SelectItem value="exercicio">Exercício</SelectItem>
                  <SelectItem value="simulado">Simulado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[calc(50%-0.25rem)] sm:min-w-0">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-full h-9 text-sm bg-background rounded-lg truncate">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos status</SelectItem>
                  <SelectItem value="nao_feitas">Não feitas</SelectItem>
                  <SelectItem value="feitas">Já feitas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active filter count */}
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground px-0.5">
              {listasFiltradas.length} de {listas.length} listas
            </p>
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
      <Dialog open={!!resultadoDialog || isLoadingResultado} onOpenChange={(open) => { if (!open) { setResultadoDialog(null); setResultadoQuestoes([]) } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Resultado da Lista</DialogTitle>
            <DialogDescription>
              Tentativa #{resultadoDialog?.tentativa ?? 1}
            </DialogDescription>
          </DialogHeader>

          {isLoadingResultado ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : resultadoDialog ? (() => {
            const scoreColor = resultadoDialog.resumo.percentual >= 70
              ? { gradient: "from-emerald-400 to-green-500", iconBg: "from-emerald-500/20 to-green-500/20", text: "text-emerald-600 dark:text-emerald-400" }
              : resultadoDialog.resumo.percentual >= 50
                ? { gradient: "from-amber-400 to-orange-500", iconBg: "from-amber-500/20 to-orange-500/20", text: "text-amber-600 dark:text-amber-400" }
                : { gradient: "from-rose-400 to-red-500", iconBg: "from-rose-500/20 to-red-500/20", text: "text-rose-600 dark:text-rose-400" }

            return (
              <div className="flex-1 overflow-y-auto min-h-0 space-y-6 py-2">
                {/* Score Hero */}
                <div className="relative overflow-hidden rounded-2xl border p-5">
                  <div className={cn("absolute inset-x-0 top-0 h-1 bg-linear-to-r", scoreColor.gradient)} />
                  <div className="flex flex-col items-center gap-4">
                    <div className={cn("flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br", scoreColor.iconBg)}>
                      <Trophy className={cn("h-8 w-8", scoreColor.text)} />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-4xl font-bold tabular-nums">
                        {resultadoDialog.resumo.percentual.toFixed(0)}
                        <span className="text-xl text-muted-foreground">%</span>
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {resultadoDialog.resumo.acertos} de{" "}
                        {resultadoDialog.resumo.total} acertos
                      </p>
                    </div>
                    <div className="w-full max-w-xs">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all duration-700 bg-linear-to-r", scoreColor.gradient)}
                          style={{ width: `${resultadoDialog.resumo.percentual}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid w-full max-w-xs grid-cols-3 gap-2 text-center">
                      <div className="rounded-xl bg-muted p-2.5">
                        <p className="text-lg font-bold tabular-nums">{resultadoDialog.resumo.total}</p>
                        <p className="text-[10px] text-muted-foreground">Total</p>
                      </div>
                      <div className="rounded-xl bg-emerald-500/10 p-2.5">
                        <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{resultadoDialog.resumo.acertos}</p>
                        <p className="text-[10px] text-muted-foreground">Acertos</p>
                      </div>
                      <div className="rounded-xl bg-rose-500/10 p-2.5">
                        <p className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{resultadoDialog.resumo.total - resultadoDialog.resumo.acertos}</p>
                        <p className="text-[10px] text-muted-foreground">Erros</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detail Table */}
                {resultadoDialog.itens.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider px-1">
                      Detalhes por questão
                    </h3>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-hidden rounded-xl border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">Disciplina</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground">Resultado</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground">Alternativas</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                              <span className="flex items-center justify-center gap-1">
                                <Users className="h-3.5 w-3.5" /> Acerto
                              </span>
                            </th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground">
                              <span className="flex items-center justify-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> Tempo
                              </span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadoDialog.itens.map((item, idx) => {
                            const q = resultadoQuestoes.find((qq) => qq.id === item.questaoId)
                            return (
                              <tr
                                key={item.questaoId}
                                className={cn(
                                  "border-b last:border-b-0",
                                  item.correta
                                    ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                                    : "bg-rose-50/30 dark:bg-rose-950/10",
                                )}
                              >
                                <td className="px-3 py-2 font-medium tabular-nums">
                                  {q?.codigo ? (
                                    <span className="font-mono text-xs">{q.codigo}</span>
                                  ) : (
                                    q?.numeroOriginal ?? idx + 1
                                  )}
                                </td>
                                <td className="px-3 py-2 text-muted-foreground max-w-[140px]">
                                  <span className="truncate block text-xs">{q?.disciplina ?? "—"}</span>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <Badge variant={item.correta ? "success" : "destructive"} className="text-xs">
                                    {item.correta ? "Certa" : "Errada"}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex justify-center">
                                    <AlternativasGrid
                                      gabarito={item.gabarito}
                                      escolhida={item.alternativaEscolhida}
                                      alternativas={q?.alternativas ?? []}
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {item.percentualAcertoGeral != null ? (
                                    <span className="text-xs font-medium tabular-nums">{item.percentualAcertoGeral}%</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className="text-xs tabular-nums text-muted-foreground">
                                    {formatQuestionTime(item.tempoRespostaSegundos)}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="sm:hidden space-y-2">
                      {resultadoDialog.itens.map((item, idx) => {
                        const q = resultadoQuestoes.find((qq) => qq.id === item.questaoId)
                        return (
                          <div
                            key={item.questaoId}
                            className={cn(
                              "relative overflow-hidden rounded-xl border p-3 space-y-2",
                              item.correta
                                ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                                : "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/20",
                            )}
                          >
                            <div className={cn(
                              "absolute inset-x-0 top-0 h-0.5 bg-linear-to-r",
                              item.correta ? "from-emerald-400 to-green-500" : "from-rose-400 to-red-500",
                            )} />
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium tabular-nums shrink-0">
                                  #{q?.numeroOriginal ?? idx + 1}
                                </span>
                                <Badge variant={item.correta ? "success" : "destructive"} className="text-xs shrink-0">
                                  {item.correta ? "Certa" : "Errada"}
                                </Badge>
                                {q?.disciplina && (
                                  <span className="text-xs text-muted-foreground truncate">{q.disciplina}</span>
                                )}
                              </div>
                              <span className="text-xs tabular-nums text-muted-foreground shrink-0 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatQuestionTime(item.tempoRespostaSegundos)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <AlternativasGrid
                                gabarito={item.gabarito}
                                escolhida={item.alternativaEscolhida}
                                alternativas={q?.alternativas ?? []}
                              />
                              {item.percentualAcertoGeral != null && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                  <Users className="h-3 w-3" />
                                  {item.percentualAcertoGeral}%
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })() : null}

          <DialogFooter className="shrink-0">
            <Button
              onClick={() => { setResultadoDialog(null); setResultadoQuestoes([]) }}
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
