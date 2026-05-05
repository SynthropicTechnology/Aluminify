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
  Download,
  History,
  Timer,
  FileText,
} from "lucide-react"
import { cn } from "@/app/shared/library/utils"
import Link from "next/link"

interface RespostaDetalhe {
  alunoId: string
  alunoNome: string
  questaoId: string
  listaId: string
  correta: boolean
  disciplina: string | null
  frenteId: string | null
  moduloId: string | null
  tempoSegundos: number | null
  tentativa: number
  respondidaEm: string
}

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
    disciplinas: string[]
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
  respostasDetalhe: RespostaDetalhe[]
  referencia: {
    frentes: Array<{ id: string; nome: string }>
    modulos: Array<{ id: string; nome: string; frenteId: string | null; numeroModulo: number | null }>
    cursos: Array<{ id: string; nome: string }>
    matriculasPorAluno: Record<string, string[]>
  }
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

  // Period filter
  const [periodo, setPeriodo] = React.useState<"todos" | "semanal" | "mensal" | "anual">("todos")

  // Filters for "Desempenho por lista"
  const [filtroListaDisc, setFiltroListaDisc] = React.useState("todas")
  const [filtroListaFrente, setFiltroListaFrente] = React.useState("todas")
  const [filtroListaModulo, setFiltroListaModulo] = React.useState("todas")

  // Filters for "Ranking de alunos"
  const [filtroRankCurso, setFiltroRankCurso] = React.useState("todas")
  const [filtroRankLista, setFiltroRankLista] = React.useState("todas")
  const [filtroRankDisc, setFiltroRankDisc] = React.useState("todas")
  const [filtroRankFrente, setFiltroRankFrente] = React.useState("todas")
  const [filtroRankModulo, setFiltroRankModulo] = React.useState("todas")

  // Filter for "Questões mais erradas"
  const [filtroErradasLista, setFiltroErradasLista] = React.useState("todas")

  // Student history modal
  const [historicoAluno, setHistoricoAluno] = React.useState<string | null>(null)
  const [isExportingPdf, setIsExportingPdf] = React.useState(false)

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

  // Filter respostas by period
  const respostasFiltradas = React.useMemo(() => {
    if (!data) return []
    if (periodo === "todos") return data.respostasDetalhe
    const now = new Date()
    const dias = periodo === "semanal" ? 7 : periodo === "mensal" ? 31 : 365
    const limite = new Date(now.getTime() - dias * 24 * 60 * 60 * 1000).toISOString()
    return data.respostasDetalhe.filter((r) => r.respondidaEm >= limite)
  }, [data, periodo])

  // Derive available filter options
  const disciplinasDisponiveis = React.useMemo(() => {
    const set = new Set<string>()
    for (const r of respostasFiltradas) {
      if (r.disciplina) set.add(r.disciplina)
    }
    return Array.from(set).sort()
  }, [respostasFiltradas])

  const frentesDisponiveis = React.useMemo(() => {
    if (!data) return []
    return data.referencia.frentes.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [data])

  const modulosDisponiveis = React.useMemo(() => {
    if (!data) return []
    return [...data.referencia.modulos].sort((a, b) => (a.numeroModulo ?? Infinity) - (b.numeroModulo ?? Infinity))
  }, [data])

  const modulosFiltradosLista = React.useMemo(() => {
    if (filtroListaFrente === "todas") return modulosDisponiveis
    return modulosDisponiveis.filter((m) => m.frenteId === filtroListaFrente)
  }, [modulosDisponiveis, filtroListaFrente])

  const modulosFiltradosRank = React.useMemo(() => {
    if (filtroRankFrente === "todas") return modulosDisponiveis
    return modulosDisponiveis.filter((m) => m.frenteId === filtroRankFrente)
  }, [modulosDisponiveis, filtroRankFrente])

  const cursosDisponiveis = React.useMemo(() => {
    if (!data) return []
    return data.referencia.cursos.sort((a, b) => a.nome.localeCompare(b.nome))
  }, [data])

  // Filtered "porLista" rows
  const listasFiltradas = React.useMemo(() => {
    if (!data) return []
    return data.porLista.filter((lista) => {
      if (filtroListaDisc !== "todas" && !lista.disciplinas.includes(filtroListaDisc)) return false
      if (filtroListaFrente !== "todas") {
        const respsLista = respostasFiltradas.filter((r) => r.listaId === lista.listaId)
        if (!respsLista.some((r) => r.frenteId === filtroListaFrente)) return false
      }
      if (filtroListaModulo !== "todas") {
        const respsLista = respostasFiltradas.filter((r) => r.listaId === lista.listaId)
        if (!respsLista.some((r) => r.moduloId === filtroListaModulo)) return false
      }
      return true
    })
  }, [data, respostasFiltradas, filtroListaDisc, filtroListaFrente, filtroListaModulo])

  // Re-aggregated ranking based on filters
  const rankingFiltrado = React.useMemo(() => {
    if (!data) return []
    let resps = respostasFiltradas

    if (filtroRankCurso !== "todas") {
      const alunosNoCurso = new Set(
        Object.entries(data.referencia.matriculasPorAluno)
          .filter(([, cursos]) => cursos.includes(filtroRankCurso))
          .map(([alunoId]) => alunoId),
      )
      resps = resps.filter((r) => alunosNoCurso.has(r.alunoId))
    }
    if (filtroRankLista !== "todas") {
      resps = resps.filter((r) => r.listaId === filtroRankLista)
    }
    if (filtroRankDisc !== "todas") {
      resps = resps.filter((r) => r.disciplina === filtroRankDisc)
    }
    if (filtroRankFrente !== "todas") {
      resps = resps.filter((r) => r.frenteId === filtroRankFrente)
    }
    if (filtroRankModulo !== "todas") {
      resps = resps.filter((r) => r.moduloId === filtroRankModulo)
    }

    const porAluno = new Map<string, { nome: string; total: number; acertos: number }>()
    for (const r of resps) {
      const cur = porAluno.get(r.alunoId) ?? { nome: r.alunoNome, total: 0, acertos: 0 }
      cur.total++
      if (r.correta) cur.acertos++
      porAluno.set(r.alunoId, cur)
    }

    return Array.from(porAluno.entries())
      .map(([id, d]) => ({
        alunoId: id,
        nome: d.nome,
        total: d.total,
        acertos: d.acertos,
        percentual: d.total > 0 ? Math.round((d.acertos / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.percentual - a.percentual)
  }, [data, respostasFiltradas, filtroRankCurso, filtroRankLista, filtroRankDisc, filtroRankFrente, filtroRankModulo])

  // Time statistics per question
  const temposPorQuestao = React.useMemo(() => {
    if (!data) return []
    const stats = new Map<string, { tempos: number[]; codigo: string | null; disciplina: string | null }>()
    for (const r of respostasFiltradas) {
      if (r.tempoSegundos == null) continue
      const cur = stats.get(r.questaoId) ?? { tempos: [], codigo: null, disciplina: r.disciplina }
      cur.tempos.push(r.tempoSegundos)
      stats.set(r.questaoId, cur)
    }
    for (const q of data.maisErradas) {
      const s = stats.get(q.questaoId)
      if (s) s.codigo = q.codigo
    }
    return Array.from(stats.entries())
      .filter(([, s]) => s.tempos.length >= 2)
      .map(([id, s]) => {
        const sorted = [...s.tempos].sort((a, b) => a - b)
        return {
          questaoId: id,
          codigo: s.codigo,
          disciplina: s.disciplina,
          mediana: sorted[Math.floor(sorted.length / 2)],
          media: Math.round(s.tempos.reduce((a, b) => a + b, 0) / s.tempos.length),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          respostas: s.tempos.length,
        }
      })
      .sort((a, b) => b.mediana - a.mediana)
      .slice(0, 15)
  }, [data, respostasFiltradas])

  // Student history
  const historicoDoAluno = React.useMemo(() => {
    if (!data || !historicoAluno) return null
    const resps = respostasFiltradas.filter((r) => r.alunoId === historicoAluno)
    const nome = resps[0]?.alunoNome ?? "Aluno"
    const porLista = new Map<string, { titulo: string; tentativas: Map<number, { total: number; acertos: number; tempo: number[] }> }>()
    for (const r of resps) {
      const listaInfo = data.porLista.find((l) => l.listaId === r.listaId)
      if (!porLista.has(r.listaId)) {
        porLista.set(r.listaId, { titulo: listaInfo?.titulo ?? "Lista", tentativas: new Map() })
      }
      const lista = porLista.get(r.listaId)!
      if (!lista.tentativas.has(r.tentativa)) {
        lista.tentativas.set(r.tentativa, { total: 0, acertos: 0, tempo: [] })
      }
      const tent = lista.tentativas.get(r.tentativa)!
      tent.total++
      if (r.correta) tent.acertos++
      if (r.tempoSegundos != null) tent.tempo.push(r.tempoSegundos)
    }
    return { nome, porLista }
  }, [data, respostasFiltradas, historicoAluno])

  // Re-aggregated "mais erradas" by lista filter
  const maisErradasFiltradas = React.useMemo(() => {
    if (!data) return []
    if (filtroErradasLista === "todas") return data.maisErradas

    const resps = respostasFiltradas.filter((r) => r.listaId === filtroErradasLista)
    const porQuestao = new Map<string, { total: number; acertos: number }>()
    for (const r of resps) {
      const cur = porQuestao.get(r.questaoId) ?? { total: 0, acertos: 0 }
      cur.total++
      if (r.correta) cur.acertos++
      porQuestao.set(r.questaoId, cur)
    }

    return Array.from(porQuestao.entries())
      .filter(([, d]) => d.total >= 2)
      .map(([id, d]) => {
        const original = data.maisErradas.find((q) => q.questaoId === id)
        const found = respostasFiltradas.find((r) => r.questaoId === id)
        return {
          questaoId: id,
          codigo: original?.codigo ?? null,
          numeroOriginal: original?.numeroOriginal ?? null,
          disciplina: found?.disciplina ?? original?.disciplina ?? null,
          total: d.total,
          acertos: d.acertos,
          percentualAcerto: Math.round((d.acertos / d.total) * 100),
        }
      })
      .sort((a, b) => a.percentualAcerto - b.percentualAcerto)
      .slice(0, 10)
  }, [data, respostasFiltradas, filtroErradasLista])

  // Reset cascading filters
  React.useEffect(() => {
    if (filtroListaFrente !== "todas" && filtroListaModulo !== "todas") {
      const mod = modulosDisponiveis.find((m) => m.id === filtroListaModulo)
      if (mod && mod.frenteId !== filtroListaFrente) setFiltroListaModulo("todas")
    }
  }, [filtroListaFrente, filtroListaModulo, modulosDisponiveis])

  React.useEffect(() => {
    if (filtroRankFrente !== "todas" && filtroRankModulo !== "todas") {
      const mod = modulosDisponiveis.find((m) => m.id === filtroRankModulo)
      if (mod && mod.frenteId !== filtroRankFrente) setFiltroRankModulo("todas")
    }
  }, [filtroRankFrente, filtroRankModulo, modulosDisponiveis])

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

  const hasRankFilters = filtroRankCurso !== "todas" || filtroRankLista !== "todas" || filtroRankDisc !== "todas" || filtroRankFrente !== "todas" || filtroRankModulo !== "todas"

  function exportToExcel() {
    if (!data) return
    const rows = [
      ["RELATÓRIO DE LISTAS - QUESTÕES"],
      [],
      ["Resumo"],
      ["Total de listas", data.resumo.totalListas],
      ["Total de alunos", data.resumo.totalAlunos],
      ["Aproveitamento médio", data.resumo.aproveitamentoMedio != null ? `${data.resumo.aproveitamentoMedio}%` : "—"],
      [],
      ["DESEMPENHO POR LISTA"],
      ["Lista", "Tipo", "Questões", "Iniciaram", "Finalizaram", "Aproveitamento", "Tempo médio"],
      ...data.porLista.map((l) => [l.titulo, l.tipo, l.totalQuestoes, l.totalAlunosIniciaram, l.totalAlunosFinalizaram, l.aproveitamento != null ? `${l.aproveitamento}%` : "—", l.tempoMedio != null ? `${l.tempoMedio}s` : "—"]),
      [],
      ["RANKING DE ALUNOS"],
      ["Aluno", "Total", "Acertos", "Percentual"],
      ...data.ranking.map((a) => [a.nome, a.total, a.acertos, `${a.percentual}%`]),
      [],
      ["QUESTÕES MAIS ERRADAS"],
      ["Questão", "Disciplina", "Respostas", "Acerto"],
      ...data.maisErradas.map((q) => [q.codigo ?? `#${q.numeroOriginal ?? "?"}`, q.disciplina ?? "—", q.total, `${q.percentualAcerto}%`]),
    ]
    const csvContent = rows.map((row) => (row as (string | number | null)[]).map((cell) => `"${cell ?? ""}"`).join(",")).join("\n")
    const bom = "﻿"
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "relatorio-listas.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  async function exportToPdf() {
    setIsExportingPdf(true)
    try {
      const res = await fetch("/api/listas/relatorio/pdf", {
        headers: { "x-tenant-slug": tenantSlug },
      })
      if (!res.ok) throw new Error("Erro ao gerar PDF")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = "relatorio-listas.pdf"
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("[Relatorio] PDF export error:", err)
    } finally {
      setIsExportingPdf(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-6">
      <div className="flex items-center justify-between gap-3 pt-4 md:pt-6">
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-2">
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as typeof periodo)}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-background rounded-lg">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todo período</SelectItem>
              <SelectItem value="semanal">Última semana</SelectItem>
              <SelectItem value="mensal">Último mês</SelectItem>
              <SelectItem value="anual">Último ano</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" onClick={exportToPdf} disabled={isExportingPdf}>
            {isExportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="cursor-pointer gap-1.5" onClick={exportToExcel}>
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </Button>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Desempenho por lista</h2>
          <div className="flex flex-wrap gap-2">
            {disciplinasDisponiveis.length > 1 && (
              <Select value={filtroListaDisc} onValueChange={setFiltroListaDisc}>
                <SelectTrigger className="w-[150px] h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas disciplinas</SelectItem>
                  {disciplinasDisponiveis.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {frentesDisponiveis.length > 0 && (
              <Select value={filtroListaFrente} onValueChange={(v) => { setFiltroListaFrente(v); if (v === "todas") setFiltroListaModulo("todas") }}>
                <SelectTrigger className="w-[140px] h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Frente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas frentes</SelectItem>
                  {frentesDisponiveis.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {modulosFiltradosLista.length > 0 && (
              <Select value={filtroListaModulo} onValueChange={setFiltroListaModulo}>
                <SelectTrigger className="w-[140px] h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos módulos</SelectItem>
                  {modulosFiltradosLista.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
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
                {listasFiltradas.map((lista) => (
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
                {listasFiltradas.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhuma lista com questões</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Performance by disciplina */}
      {data.porDisciplina.length > 0 && (
        <div className="flex flex-col rounded-xl border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 shrink-0">Desempenho por disciplina</h2>
          <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[300px]">
            {data.porDisciplina.map((d) => (
              <div key={d.disciplina} className="flex items-center gap-3 rounded-lg border p-3 flex-1 min-w-[220px]">
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

      {/* Student ranking */}
      {(data.ranking.length > 0 || hasRankFilters) && (
        <div className="flex flex-col rounded-xl border p-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 shrink-0">Ranking de alunos</h2>
          <div className="flex flex-wrap gap-2 mb-3 shrink-0 *:flex-1 *:min-w-[120px]">
            {cursosDisponiveis.length > 1 && (
              <Select value={filtroRankCurso} onValueChange={setFiltroRankCurso}>
                <SelectTrigger className="h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Curso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos cursos</SelectItem>
                  {cursosDisponiveis.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {data.porLista.length > 1 && (
              <Select value={filtroRankLista} onValueChange={setFiltroRankLista}>
                <SelectTrigger className="h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Lista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas listas</SelectItem>
                  {data.porLista.map((l) => (
                    <SelectItem key={l.listaId} value={l.listaId}>
                      <span className="truncate">{l.titulo}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {disciplinasDisponiveis.length > 1 && (
              <Select value={filtroRankDisc} onValueChange={setFiltroRankDisc}>
                <SelectTrigger className="h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Disciplina" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas disciplinas</SelectItem>
                  {disciplinasDisponiveis.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {frentesDisponiveis.length > 0 && (
              <Select value={filtroRankFrente} onValueChange={(v) => { setFiltroRankFrente(v); if (v === "todas") setFiltroRankModulo("todas") }}>
                <SelectTrigger className="h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Frente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas frentes</SelectItem>
                  {frentesDisponiveis.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {modulosFiltradosRank.length > 0 && (
              <Select value={filtroRankModulo} onValueChange={setFiltroRankModulo}>
                <SelectTrigger className="h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Módulo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todos módulos</SelectItem>
                  {modulosFiltradosRank.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {rankingFiltrado.length > 0 ? (
            <div className="overflow-y-auto max-h-[300px] rounded-lg border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground w-8">#</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Aluno</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Acertos</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">%</th>
                    <th className="px-3 py-2 w-8"></th>
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
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setHistoricoAluno(aluno.alunoId)}
                          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          title="Ver histórico de tentativas"
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados para os filtros selecionados</p>
          )}
        </div>
      )}

      {/* Student history panel */}
      {historicoDoAluno && (
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Histórico — {historicoDoAluno.nome}
            </h2>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs cursor-pointer" onClick={() => setHistoricoAluno(null)}>
              Fechar
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Lista</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Tentativa</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Acertos</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">%</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(historicoDoAluno.porLista.entries()).map(([listaId, info]) =>
                  Array.from(info.tentativas.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([tent, stats]) => (
                      <tr key={`${listaId}-${tent}`} className="border-b last:border-b-0">
                        <td className="px-3 py-2 font-medium truncate max-w-[200px]">{info.titulo}</td>
                        <td className="px-3 py-2 text-center tabular-nums">{tent}ª</td>
                        <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{stats.acertos}/{stats.total}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn(
                            "font-bold tabular-nums",
                            stats.total > 0 && Math.round((stats.acertos / stats.total) * 100) >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                            stats.total > 0 && Math.round((stats.acertos / stats.total) * 100) >= 50 ? "text-amber-600 dark:text-amber-400" :
                            "text-rose-600 dark:text-rose-400",
                          )}>{stats.total > 0 ? Math.round((stats.acertos / stats.total) * 100) : 0}%</span>
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">
                          {stats.tempo.length > 0 ? formatTempo(Math.round(stats.tempo.reduce((a, b) => a + b, 0) / stats.tempo.length)) : "—"}
                        </td>
                      </tr>
                    )),
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Most missed questions */}
      {(data.maisErradas.length > 0 || filtroErradasLista !== "todas") && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Questões mais erradas
            </h2>
            {data.porLista.length > 1 && (
              <Select value={filtroErradasLista} onValueChange={setFiltroErradasLista}>
                <SelectTrigger className="w-[150px] h-7 text-xs bg-background rounded-lg">
                  <SelectValue placeholder="Lista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas listas</SelectItem>
                  {data.porLista.map((l) => (
                    <SelectItem key={l.listaId} value={l.listaId}>
                      <span className="truncate">{l.titulo}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {maisErradasFiltradas.length > 0 ? (
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
                  {maisErradasFiltradas.map((q) => (
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
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">Sem dados para a lista selecionada</p>
          )}
        </div>
      )}

      {/* Time statistics per question */}
      {temposPorQuestao.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" /> Tempo por questão
          </h2>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Questão</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Disciplina</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Respostas</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Mediana</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Média</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Min</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Máx</th>
                </tr>
              </thead>
              <tbody>
                {temposPorQuestao.map((q) => (
                  <tr key={q.questaoId} className="border-b last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs">{q.codigo ?? `#${q.questaoId.slice(0, 6)}`}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{q.disciplina ?? "—"}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{q.respostas}</td>
                    <td className="px-3 py-2 text-center tabular-nums font-medium">{formatTempo(q.mediana)}</td>
                    <td className="px-3 py-2 text-center tabular-nums">{formatTempo(q.media)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{formatTempo(q.min)}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-muted-foreground">{formatTempo(q.max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
