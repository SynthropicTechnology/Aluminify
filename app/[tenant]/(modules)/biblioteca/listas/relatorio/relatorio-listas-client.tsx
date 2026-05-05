"use client"

import * as React from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/forms/select"
import {
  Loader2,
  Users,
  TrendingUp,
  ArrowLeft,
  Trophy,
  Clock,
  AlertTriangle,
  BarChart3,
} from "lucide-react"
import { cn } from "@/app/shared/library/utils"
import Link from "next/link"

interface RelatorioData {
  resumo: {
    totalListas: number
    totalAlunos: number
    aproveitamentoMedio: number | null
  }
  porLista: Array<{
    listaId: string
    titulo: string
    tipo: string
    totalQuestoes: number
    totalAlunosIniciaram: number
    totalAlunosFinalizaram: number
    aproveitamento: number | null
    tempoMedio: number | null
  }>
  porDisciplina: Array<{
    disciplina: string
    total: number
    acertos: number
    percentual: number
  }>
  ranking: Array<{
    alunoId: string
    nome: string
    total: number
    acertos: number
    percentual: number
  }>
  maisErradas: Array<{
    questaoId: string
    codigo: string | null
    numeroOriginal: number | null
    disciplina: string | null
    total: number
    acertos: number
    percentualAcerto: number
  }>
}

function formatTempo(seconds: number | null): string {
  if (seconds == null) return "—"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

export default function RelatorioListasClient() {
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [data, setData] = React.useState<RelatorioData | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtroLista, setFiltroLista] = React.useState<string>("todas")

  React.useEffect(() => {
    async function load() {
      setIsLoading(true)
      try {
        const res = await fetch("/api/listas/relatorio", {
          headers: { "x-tenant-slug": tenantSlug },
        })
        if (!res.ok) throw new Error("Erro ao buscar relatório")
        const json = await res.json()
        setData(json.data)
      } catch {
        setData(null)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [tenantSlug])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-muted-foreground">Erro ao carregar relatório.</p>
      </div>
    )
  }

  const rankingFiltrado = filtroLista === "todas"
    ? data.ranking
    : data.ranking

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-6">
      <div className="flex items-center gap-3 pt-4 md:pt-6">
        <Button variant="ghost" size="icon" asChild className="shrink-0 cursor-pointer">
          <Link href={`/${tenantSlug}/biblioteca/listas`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatório de Listas</h1>
          <p className="text-sm text-muted-foreground">Visão agregada do desempenho dos alunos</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {([
          {
            label: "Listas",
            value: data.resumo.totalListas,
            icon: BarChart3,
            gradient: "from-blue-500 to-indigo-500",
          },
          {
            label: "Alunos participantes",
            value: data.resumo.totalAlunos,
            icon: Users,
            gradient: "from-teal-500 to-cyan-500",
          },
          {
            label: "Aproveitamento médio",
            value: data.resumo.aproveitamentoMedio != null ? `${data.resumo.aproveitamentoMedio}%` : "—",
            icon: TrendingUp,
            gradient: "from-emerald-500 to-green-500",
          },
        ] as const).map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="py-0 gap-0 rounded-2xl overflow-hidden">
              <div className={cn("h-0.5 bg-linear-to-r", stat.gradient)} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-br text-white", stat.gradient)}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <span className="text-2xl font-bold tabular-nums">{stat.value}</span>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Performance by lista */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Desempenho por lista</h2>
        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Lista</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Questões</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Iniciaram</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Finalizaram</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Aproveitamento</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    <span className="flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5" /> Tempo</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.porLista.map((lista) => (
                  <tr key={lista.listaId} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium max-w-[200px]">
                      <span className="truncate block">{lista.titulo}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary" className="text-xs">
                        {lista.tipo === "simulado" ? "Simulado" : "Exercício"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums">{lista.totalQuestoes}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{lista.totalAlunosIniciaram}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{lista.totalAlunosFinalizaram}</td>
                    <td className="px-4 py-3 text-center">
                      {lista.aproveitamento != null ? (
                        <span className={cn(
                          "font-medium tabular-nums",
                          lista.aproveitamento >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                          lista.aproveitamento >= 50 ? "text-amber-600 dark:text-amber-400" :
                          "text-rose-600 dark:text-rose-400",
                        )}>{lista.aproveitamento}%</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center tabular-nums text-muted-foreground">
                      {formatTempo(lista.tempoMedio)}
                    </td>
                  </tr>
                ))}
                {data.porLista.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma lista com questões</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance by disciplina */}
      {data.porDisciplina.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Desempenho por disciplina</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.porDisciplina.map((d) => (
              <div key={d.disciplina} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.disciplina}</p>
                  <p className="text-xs text-muted-foreground">{d.acertos}/{d.total} acertos</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        d.percentual >= 70 ? "bg-emerald-500" : d.percentual >= 50 ? "bg-amber-500" : "bg-rose-500",
                      )}
                      style={{ width: `${d.percentual}%` }}
                    />
                  </div>
                  <span className={cn(
                    "text-sm font-bold tabular-nums w-10 text-right",
                    d.percentual >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                    d.percentual >= 50 ? "text-amber-600 dark:text-amber-400" :
                    "text-rose-600 dark:text-rose-400",
                  )}>{d.percentual}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Student ranking */}
        {data.ranking.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ranking de alunos</h2>
              {data.porLista.length > 1 && (
                <Select value={filtroLista} onValueChange={setFiltroLista}>
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-background rounded-lg">
                    <SelectValue placeholder="Filtrar lista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as listas</SelectItem>
                    {data.porLista.map((l) => (
                      <SelectItem key={l.listaId} value={l.listaId}>
                        <span className="truncate">{l.titulo}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Aluno</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Acertos</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody>
                  {rankingFiltrado.slice(0, 20).map((aluno, idx) => (
                    <tr key={aluno.alunoId} className="border-b last:border-b-0">
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {idx < 3 ? (
                          <Trophy className={cn("h-4 w-4", idx === 0 ? "text-amber-500" : idx === 1 ? "text-slate-400" : "text-amber-700")} />
                        ) : idx + 1}
                      </td>
                      <td className="px-3 py-2 font-medium truncate max-w-[180px]">{aluno.nome}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{aluno.acertos}/{aluno.total}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn(
                          "font-bold tabular-nums",
                          aluno.percentual >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                          aluno.percentual >= 50 ? "text-amber-600 dark:text-amber-400" :
                          "text-rose-600 dark:text-rose-400",
                        )}>{aluno.percentual}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Most missed questions */}
        {data.maisErradas.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Questões mais erradas
            </h2>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Questão</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Disciplina</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Respostas</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Acerto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.maisErradas.map((q) => (
                    <tr key={q.questaoId} className="border-b last:border-b-0">
                      <td className="px-3 py-2">
                        <span className="font-mono text-xs">
                          {q.codigo ?? `#${q.numeroOriginal ?? "?"}`}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">
                        {q.disciplina ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-center tabular-nums">{q.total}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge variant={q.percentualAcerto >= 50 ? "warning" : "destructive"} className="text-xs tabular-nums">
                          {q.percentualAcerto}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
