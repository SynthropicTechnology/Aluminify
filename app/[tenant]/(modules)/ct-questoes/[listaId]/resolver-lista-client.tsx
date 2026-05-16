"use client"

import * as React from "react"
import Image from "next/image"
import katex from "katex"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Trophy,
  Send,
  RotateCcw,
  Scissors,
  Grid3X3,
  X,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  Flag,
  Minus,
  Pause,
  Play,
  Plus,
  Type,
  Users,
} from "lucide-react"
import { cn } from "@/app/shared/library/utils"
import { VideoPlayer } from "@/app/shared/components/media/video-player"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/app/shared/components/overlay/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/app/shared/components/overlay/dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/app/shared/components/overlay/tooltip"

// ─── Types ──────────────────────────────────────────────────

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "image"; storagePath: string; alt?: string; width?: number; height?: number }
  | { type: "math"; latex: string }

type Alternativa = {
  id: string
  letra: string
  texto: string
  imagemPath: string | null
  ordem: number
}

type Questao = {
  id: string
  codigo: string | null
  numeroOriginal: number | null
  instituicao: string | null
  ano: number | null
  disciplina: string | null
  dificuldade: string | null
  tags: string[]
  enunciado: ContentBlock[]
  textoBase: ContentBlock[] | null
  fonte: ContentBlock[] | null
  alternativas: Alternativa[]
  gabarito?: string
  resolucaoTexto?: ContentBlock[] | null
  resolucaoVideoUrl?: string | null
}

type RespostaAnterior = {
  questaoId: string
  alternativaEscolhida: string
  correta: boolean
  alternativasRiscadas: string[]
}

type Lista = {
  id: string
  titulo: string
  descricao: string | null
  tipo: "exercicio" | "simulado" | "outro"
  modosCorrecaoPermitidos: "por_questao" | "ao_final" | "ambos"
  modoCorrecaoEfetivo: "por_questao" | "ao_final"
  questoes: Questao[]
  tentativaAtual: number
  finalizada: boolean
  respostasAnteriores: RespostaAnterior[]
}

type RespostaPorQuestao = {
  correta: boolean
  gabarito: string
  resolucaoTexto: ContentBlock[] | null
  resolucaoVideoUrl: string | null
}

type RespostaAoFinal = {
  registrada: true
  totalRespondidasNaTentativa: number
  totalQuestoesNaLista: number
}

type ResultadoItem = {
  questaoId: string
  alternativaEscolhida: string
  correta: boolean
  gabarito: string
  resolucaoTexto: ContentBlock[] | null
  resolucaoVideoUrl: string | null
  tempoRespostaSegundos: number | null
  percentualAcertoGeral: number | null
}

type Resultado = {
  tentativa: number
  itens: ResultadoItem[]
  resumo: { total: number; acertos: number; percentual: number }
}

// ─── Helpers ────────────────────────────────────────────────

function renderInlineMath(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$]+\$)/g)
  return parts.map((part, i) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      const latex = part.slice(1, -1)
      try {
        const html = katex.renderToString(latex, { throwOnError: false, displayMode: false })
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      } catch {
        return <span key={i}>{latex}</span>
      }
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

function renderContentBlocks(blocks: ContentBlock[], listaId: string) {
  return blocks.map((block, i) => {
    if (block.type === "paragraph") {
      const text = block.text
      return (
        <p key={i} className="leading-relaxed whitespace-pre-wrap">
          {text.includes("$") ? renderInlineMath(text) : text}
        </p>
      )
    }
    if (block.type === "image") {
      const src = block.storagePath.startsWith("pending:")
        ? `/api/importacao/${listaId}/imagem?key=${block.storagePath.replace("pending:", "")}`
        : block.storagePath.startsWith("importacoes/")
          ? `/api/questoes/imagem?path=${encodeURIComponent(block.storagePath)}`
          : block.storagePath
      const w = block.width ?? 0
      const h = block.height ?? 0
      return (
        <div key={i} className="flex justify-center my-3">
          <Image
            src={src}
            alt={block.alt ?? `Imagem ${i + 1}`}
            width={w || 600}
            height={h || 400}
            sizes="(max-width: 768px) 100vw, 50vw"
            className="rounded-md border object-contain"
            style={{
              maxWidth: "100%",
              width: w ? `${w}px` : undefined,
              height: w ? "auto" : undefined,
            }}
            unoptimized
          />
        </div>
      )
    }
    if (block.type === "math") {
      let html: string
      try {
        html = katex.renderToString(block.latex, {
          throwOnError: false,
          displayMode: true,
        })
      } catch {
        html = block.latex
      }
      return (
        <span
          key={i}
          className="block my-2 overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )
    }
    return null
  })
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

function formatQuestionTime(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—"
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m${s}s` : `${m}m`
}

const FONT_SCALE_MIN = -2
const FONT_SCALE_MAX = 2

const FONT_SCALE_CLASSES: Record<number, string> = {
  [-2]: "text-xs sm:text-sm",
  [-1]: "text-sm",
  [0]: "text-sm sm:text-base",
  [1]: "text-base sm:text-lg",
  [2]: "text-lg sm:text-xl",
}

function getFontClass(scale: number): string {
  return FONT_SCALE_CLASSES[scale] ?? FONT_SCALE_CLASSES[0]
}

// ─── Question Navigator Grid ────────────────────────────────

function QuestionGrid({
  questoes,
  currentIndex,
  answers,
  feedback,
  marcadas,
  onSelect,
  cols,
}: {
  questoes: Questao[]
  currentIndex: number
  answers: Map<string, string>
  feedback: Map<string, RespostaPorQuestao>
  marcadas: Set<string>
  onSelect: (idx: number) => void
  cols?: string
}) {
  return (
    <div className={cn("grid gap-1.5", cols ?? "grid-cols-6")}>
      {questoes.map((q, idx) => {
        const answered = answers.has(q.id)
        const fb = feedback.get(q.id)
        const isCurrent = idx === currentIndex
        const isMarcada = marcadas.has(q.id)

        let dotClass = "bg-muted text-muted-foreground hover:bg-muted/80"
        if (fb) {
          dotClass = fb.correta
            ? "bg-green-500 text-white"
            : "bg-red-500 text-white"
        } else if (answered) {
          dotClass = "bg-primary text-primary-foreground"
        } else if (isMarcada) {
          dotClass = "bg-amber-500 text-white dark:bg-amber-600"
        }

        return (
          <button
            key={q.id}
            onClick={() => onSelect(idx)}
            className={cn(
              "relative aspect-square rounded-lg text-xs font-semibold transition-all flex items-center justify-center cursor-pointer",
              dotClass,
              isCurrent && "ring-2 ring-ring ring-offset-1 ring-offset-background"
            )}
          >
            {String(idx + 1).padStart(2, "0")}
            {isMarcada && (answered || fb) && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 border border-background" />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Desktop Sidebar Panel ──────────────────────────────────

function SidebarPanel({
  questoes,
  currentIndex,
  answers,
  feedback,
  marcadas,
  isPorQuestao,
  todasRespondidas: _todasRespondidas,
  elapsedSeconds,
  timerVisible,
  fontScale,
  isPaused,
  onToggleTimer,
  onPause,
  onResume,
  onSelect,
  onFinalizar,
  onFontChange,
  isLoadingResultado,
}: {
  questoes: Questao[]
  currentIndex: number
  answers: Map<string, string>
  feedback: Map<string, RespostaPorQuestao>
  marcadas: Set<string>
  isPorQuestao: boolean
  todasRespondidas: boolean
  elapsedSeconds: number
  timerVisible: boolean
  fontScale: number
  isPaused: boolean
  onToggleTimer: () => void
  onPause: () => void
  onResume: () => void
  onSelect: (idx: number) => void
  onFinalizar: () => void
  onFontChange: (delta: number) => void
  isLoadingResultado: boolean
}) {
  return (
    <aside className="w-[240px] shrink-0 border-l bg-muted/20 dark:bg-muted/5 dark:border-white/5 flex flex-col overflow-y-auto">
      {/* Grid header */}
      <div className="px-3 pt-4 pb-2">
        <p className="text-xs text-muted-foreground font-medium mb-2">
          {answers.size} / {questoes.length} questões
        </p>
        <QuestionGrid
          questoes={questoes}
          currentIndex={currentIndex}
          answers={answers}
          feedback={feedback}
          marcadas={marcadas}
          onSelect={onSelect}
          cols="grid-cols-6"
        />
      </div>

      {/* Timer */}
      <div className="px-3 py-3 border-t mt-2">
        <button
          onClick={onToggleTimer}
          className="flex items-center justify-between w-full text-sm cursor-pointer group hover:bg-muted/50 -mx-1 px-1 py-1 rounded-md transition-colors"
          title={timerVisible ? "Clique para ocultar o tempo" : "Clique para mostrar o tempo"}
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {timerVisible ? (
              <Eye className="h-3.5 w-3.5 group-hover:text-foreground transition-colors" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 group-hover:text-foreground transition-colors" />
            )}
            Tempo de Prova
          </span>
          <span className={cn(
            "font-mono tabular-nums font-semibold transition-all",
            timerVisible ? "opacity-100" : "opacity-0 select-none"
          )}>
            {formatTime(elapsedSeconds)}
          </span>
        </button>
        <button
          onClick={isPaused ? onResume : onPause}
          className={cn(
            "flex items-center gap-2 w-full mt-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
            isPaused
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {isPaused ? "Continuar" : "Pausar"}
        </button>
      </div>

      {/* Legend */}
      <div className="px-3 py-3 border-t mt-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-muted inline-block shrink-0" />
          Pendente
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-amber-500 dark:bg-amber-600 inline-block shrink-0" />
          Voltar depois
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block shrink-0" />
          Respondida
        </div>
        {isPorQuestao && (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-green-500 inline-block shrink-0" />
              Correta
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="w-3 h-3 rounded-sm bg-red-500 inline-block shrink-0" />
              Incorreta
            </div>
          </>
        )}
      </div>

      {/* Font size control */}
      <div className="px-3 py-3 border-t">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Type className="h-3.5 w-3.5" />
            Fonte
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onFontChange(-1)}
              disabled={fontScale <= FONT_SCALE_MIN}
              className="flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Diminuir fonte"
            >
              A<Minus className="h-2.5 w-2.5" />
            </button>
            <button
              onClick={() => onFontChange(1)}
              disabled={fontScale >= FONT_SCALE_MAX}
              className="flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold transition-colors hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Aumentar fonte"
            >
              A<Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Finalizar */}
      <div className="px-3 py-3 border-t mt-auto">
        <Button
          onClick={onFinalizar}
          disabled={isLoadingResultado}
          className="w-full min-h-[44px]"
        >
          {isLoadingResultado ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trophy className="mr-2 h-4 w-4" />
          )}
          Finalizar Lista
        </Button>
      </div>
    </aside>
  )
}

// ─── Alternativas Grid (Result) ─────────────────────────────

function AlternativasGrid({
  gabarito,
  escolhida,
  alternativas,
}: {
  gabarito: string
  escolhida: string
  alternativas: Alternativa[]
}) {
  const letras = alternativas.map((a) => a.letra)
  return (
    <div className="flex gap-1">
      {letras.map((letra) => {
        const isGabarito = letra === gabarito.toLowerCase()
        const isEscolhida = letra === escolhida.toLowerCase()
        const isErro = isEscolhida && !isGabarito
        return (
          <span
            key={letra}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded text-xs font-bold",
              isGabarito
                ? "bg-green-500 text-white dark:bg-green-600"
                : isErro
                  ? "bg-red-500 text-white dark:bg-red-600"
                  : "bg-muted text-muted-foreground"
            )}
          >
            {letra.toUpperCase()}
          </span>
        )
      })}
    </div>
  )
}

// ─── Result View (Fullscreen) ───────────────────────────────

function ResultView({
  lista,
  resultado,
  questoes,
  listaId,
  elapsedSeconds,
  onVoltar,
  onRefazer,
}: {
  lista: Lista
  resultado: Resultado
  questoes: Questao[]
  listaId: string
  elapsedSeconds: number
  onVoltar: () => void
  onRefazer: () => void
}) {
  const [viewingQuestao, setViewingQuestao] = React.useState<{
    questao: Questao
    item: ResultadoItem
  } | null>(null)

  const scoreColor = resultado.resumo.percentual >= 70
    ? { gradient: "from-emerald-400 to-green-500", iconBg: "from-emerald-500/20 to-green-500/20", text: "text-emerald-600 dark:text-emerald-400", statBg: "bg-emerald-500/10" }
    : resultado.resumo.percentual >= 50
      ? { gradient: "from-amber-400 to-orange-500", iconBg: "from-amber-500/20 to-orange-500/20", text: "text-amber-600 dark:text-amber-400", statBg: "bg-amber-500/10" }
      : { gradient: "from-rose-400 to-red-500", iconBg: "from-rose-500/20 to-red-500/20", text: "text-rose-600 dark:text-rose-400", statBg: "bg-rose-500/10" }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <header className="shrink-0 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-3 max-w-5xl mx-auto w-full">
          <Button variant="ghost" size="sm" onClick={onVoltar} className="shrink-0 -ml-2">
            <ChevronLeft className="mr-1 h-4 w-4" />
            <span className="hidden sm:inline">Voltar às listas</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
          <p className="text-sm font-medium truncate">{lista.titulo}</p>
          <div className="w-16 shrink-0" />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 md:py-10 space-y-8">
          {/* Score hero card */}
          <div className={cn(
            "relative overflow-hidden rounded-2xl border p-6 sm:p-8",
            "dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/5",
          )}>
            <div className={cn("absolute inset-x-0 top-0 h-1 bg-linear-to-r", scoreColor.gradient)} />

            <div className="flex flex-col items-center gap-5">
              <div className={cn("flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full bg-linear-to-br", scoreColor.iconBg)}>
                <Trophy className={cn("h-10 w-10 sm:h-12 sm:w-12", scoreColor.text)} />
              </div>

              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Tentativa #{resultado.tentativa}
                </p>
                <p className="text-5xl sm:text-6xl font-bold tabular-nums">
                  {resultado.resumo.percentual.toFixed(0)}
                  <span className="text-2xl sm:text-3xl text-muted-foreground">%</span>
                </p>
              </div>

              <div className="w-full max-w-xs">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-1000 ease-out bg-linear-to-r",
                      scoreColor.gradient,
                    )}
                    style={{ width: `${resultado.resumo.percentual}%` }}
                  />
                </div>
              </div>

              <div className="grid w-full max-w-sm grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-muted p-3 sm:p-4">
                  <p className="text-xl sm:text-2xl font-bold tabular-nums">{resultado.resumo.total}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Total</p>
                </div>
                <div className="rounded-xl bg-emerald-500/10 p-3 sm:p-4">
                  <p className="text-xl sm:text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{resultado.resumo.acertos}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Acertos</p>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3 sm:p-4">
                  <p className="text-xl sm:text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                    {resultado.resumo.total - resultado.resumo.acertos}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Erros</p>
                </div>
              </div>

              {elapsedSeconds > 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Tempo total: {formatTime(elapsedSeconds)}
                </p>
              )}
            </div>
          </div>

          {/* Details table */}
          <div className="space-y-3">
            <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider px-1">
              Detalhes por questão
            </h3>

            {/* Desktop table (sm+) */}
            <div className={cn(
              "hidden sm:block overflow-hidden rounded-2xl border",
              "dark:border-white/5",
            )}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 dark:bg-muted/20">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Disciplina / Tags</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Resultado</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Alternativas</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center justify-center gap-1 cursor-help">
                              <Users className="h-3.5 w-3.5" /> Acerto
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-60 text-sm">
                            Percentual de acerto geral desta questão entre todos os alunos da plataforma, não apenas o seu resultado.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> Tempo
                      </span>
                    </th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.itens.map((item, idx) => {
                    const q = questoes.find((qq) => qq.id === item.questaoId)
                    return (
                      <tr
                        key={item.questaoId}
                        className={cn(
                          "border-b last:border-b-0 transition-colors",
                          item.correta
                            ? "bg-emerald-50/30 dark:bg-emerald-950/10"
                            : "bg-rose-50/30 dark:bg-rose-950/10",
                        )}
                      >
                        <td className="px-3 py-2.5 font-medium tabular-nums">
                          {q?.codigo ? (
                            <span className="font-mono text-xs">{q.codigo}</span>
                          ) : (
                            q?.numeroOriginal ?? idx + 1
                          )}
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px]">
                          <div className="flex flex-col gap-1">
                            <span className="text-muted-foreground truncate">
                              {q?.disciplina ?? "—"}
                            </span>
                            {q?.tags && q.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {q.tags.map((tag) => (
                                  <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge
                            variant={item.correta ? "success" : "destructive"}
                            className="text-xs"
                          >
                            {item.correta ? "Certa" : "Errada"}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-center">
                            <AlternativasGrid
                              gabarito={item.gabarito}
                              escolhida={item.alternativaEscolhida}
                              alternativas={q?.alternativas ?? []}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {item.percentualAcertoGeral != null ? (
                            <span className="text-xs font-medium tabular-nums">
                              {item.percentualAcertoGeral}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatQuestionTime(item.tempoRespostaSegundos)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 cursor-pointer"
                            onClick={() => q && setViewingQuestao({ questao: q, item })}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            <span className="text-xs">Ver</span>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {resultado.itens.map((item, idx) => {
                const q = questoes.find((qq) => qq.id === item.questaoId)
                return (
                  <div
                    key={item.questaoId}
                    className={cn(
                      "relative overflow-hidden rounded-2xl border p-3 space-y-2.5",
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
                          {q?.codigo ? (
                            <span className="font-mono text-xs">{q.codigo}</span>
                          ) : (
                            `#${q?.numeroOriginal ?? idx + 1}`
                          )}
                        </span>
                        <Badge
                          variant={item.correta ? "success" : "destructive"}
                          className="text-xs shrink-0"
                        >
                          {item.correta ? "Certa" : "Errada"}
                        </Badge>
                        {q?.disciplina && (
                          <span className="text-xs text-muted-foreground truncate">
                            {q.disciplina}
                          </span>
                        )}
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatQuestionTime(item.tempoRespostaSegundos)}
                      </span>
                    </div>

                    {q?.tags && q.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {q.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

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

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full min-h-[36px] cursor-pointer"
                      onClick={() => q && setViewingQuestao({ questao: q, item })}
                    >
                      <Eye className="h-4 w-4 mr-1.5" />
                      Visualizar
                    </Button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex gap-3 px-4 py-3 max-w-3xl mx-auto w-full">
          <Button variant="outline" onClick={onRefazer} className="flex-1 min-h-[44px] cursor-pointer">
            <RotateCcw className="mr-2 h-4 w-4" /> Refazer
          </Button>
          <Button onClick={onVoltar} className="flex-1 min-h-[44px] cursor-pointer">
            <X className="mr-2 h-4 w-4" /> Fechar
          </Button>
        </div>
      </footer>

      {/* Visualizar Questão Dialog */}
      <Dialog
        open={!!viewingQuestao}
        onOpenChange={(open) => !open && setViewingQuestao(null)}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl">
          {viewingQuestao && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-base">
                    {viewingQuestao.questao.codigo ? (
                      <span className="font-mono">{viewingQuestao.questao.codigo}</span>
                    ) : (
                      `Questão ${viewingQuestao.questao.numeroOriginal ?? ""}`
                    )}
                  </DialogTitle>
                  <Badge
                    variant={viewingQuestao.item.correta ? "success" : "destructive"}
                    className="text-xs"
                  >
                    {viewingQuestao.item.correta ? "Certa" : "Errada"}
                  </Badge>
                  {viewingQuestao.questao.disciplina && (
                    <Badge variant="secondary" className="text-xs">
                      {viewingQuestao.questao.disciplina}
                    </Badge>
                  )}
                  {viewingQuestao.questao.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Texto base */}
                {viewingQuestao.questao.textoBase && viewingQuestao.questao.textoBase.length > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-2 text-sm border">
                    {renderContentBlocks(viewingQuestao.questao.textoBase, listaId)}
                  </div>
                )}

                {viewingQuestao.questao.fonte && viewingQuestao.questao.fonte.length > 0 && (
                  <div className="text-xs leading-relaxed text-muted-foreground">
                    {renderContentBlocks(viewingQuestao.questao.fonte, listaId)}
                  </div>
                )}

                {/* Enunciado */}
                <div className="text-sm space-y-2">
                  {renderContentBlocks(viewingQuestao.questao.enunciado, listaId)}
                </div>

                {/* Alternativas com marcação visual */}
                <div className="space-y-1.5">
                  {viewingQuestao.questao.alternativas.map((alt) => {
                    const isGabarito = alt.letra === viewingQuestao.item.gabarito.toLowerCase()
                    const isEscolhida = alt.letra === viewingQuestao.item.alternativaEscolhida.toLowerCase()
                    const isErro = isEscolhida && !isGabarito
                    return (
                      <div
                        key={alt.id}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
                          isGabarito
                            ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                            : isErro
                              ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                              : "border-transparent bg-muted/30"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                            isGabarito
                              ? "bg-green-500 text-white dark:bg-green-600"
                              : isErro
                                ? "bg-red-500 text-white dark:bg-red-600"
                                : "bg-muted text-muted-foreground"
                          )}
                        >
                          {alt.letra.toUpperCase()}
                        </span>
                        <span className="flex-1 min-w-0">{alt.texto}</span>
                        {isGabarito && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                        )}
                        {isErro && (
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Resolução */}
                {viewingQuestao.item.resolucaoTexto && viewingQuestao.item.resolucaoTexto.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Resolução
                    </p>
                    <div className="text-sm space-y-2">
                      {renderContentBlocks(viewingQuestao.item.resolucaoTexto, listaId)}
                    </div>
                  </div>
                )}

                {/* Vídeo */}
                {viewingQuestao.item.resolucaoVideoUrl && (
                  <div className="space-y-2 pt-2 border-t">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Vídeo de Resolução
                    </p>
                    <VideoPlayer url={viewingQuestao.item.resolucaoVideoUrl} />
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────

export default function ResolverListaClient() {
  const params = useParams()
  const router = useRouter()
  const tenantSlug = params?.tenant as string
  const listaId = params?.listaId as string

  const [lista, setLista] = React.useState<Lista | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [needsModeChoice, setNeedsModeChoice] = React.useState(false)
  const [_modoEscolhido, setModoEscolhido] = React.useState<"por_questao" | "ao_final" | null>(null)

  const [currentIndex, setCurrentIndex] = React.useState(0)
  const [selectedAlternativa, setSelectedAlternativa] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [feedback, setFeedback] = React.useState<Map<string, RespostaPorQuestao>>(new Map())
  const [answers, setAnswers] = React.useState<Map<string, string>>(new Map())
  const [eliminadas, setEliminadas] = React.useState<Map<string, Set<string>>>(new Map())

  const [_respondidas, setRespondidas] = React.useState(0)
  const [resultado, setResultado] = React.useState<Resultado | null>(null)
  const [isLoadingResultado, setIsLoadingResultado] = React.useState(false)

  const [marcadas, setMarcadas] = React.useState<Set<string>>(new Set())
  const [fontScale, setFontScale] = React.useState(0)

  const [showNavigator, setShowNavigator] = React.useState(false)
  const [timerVisible, setTimerVisible] = React.useState(true)
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0)
  const [isPaused, setIsPaused] = React.useState(false)

  const mainRef = React.useRef<HTMLElement>(null)
  const questionStartRef = React.useRef<number>(Date.now())

  // Session tracking
  const sessaoIdRef = React.useRef<string | null>(null)
  const sessaoInicioRef = React.useRef<string | null>(null)
  const pausasRef = React.useRef<Array<{ inicio: string; fim?: string; tipo: string }>>([])
  const heartbeatRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // ─── Hydrate from API ────────────────────────────────────

  function hydrateFromLista(data: Lista) {
    setLista(data)
    const prevAnswers = new Map<string, string>()
    const prevFeedback = new Map<string, RespostaPorQuestao>()
    const prevElim = new Map<string, Set<string>>()

    for (const r of data.respostasAnteriores) {
      prevAnswers.set(r.questaoId, r.alternativaEscolhida)
      if (r.alternativasRiscadas.length > 0) {
        prevElim.set(r.questaoId, new Set(r.alternativasRiscadas))
      }
      if (data.modoCorrecaoEfetivo === "por_questao") {
        const q = data.questoes.find((qq) => qq.id === r.questaoId)
        if (q?.gabarito) {
          prevFeedback.set(r.questaoId, {
            correta: r.correta,
            gabarito: q.gabarito,
            resolucaoTexto: (q.resolucaoTexto as ContentBlock[] | null) ?? null,
            resolucaoVideoUrl: q.resolucaoVideoUrl ?? null,
          })
        }
      }
    }

    setAnswers(prevAnswers)
    setFeedback(prevFeedback)
    setEliminadas(prevElim)
    setRespondidas(data.respostasAnteriores.length)
  }

  const fetchLista = React.useCallback(async (modo?: "por_questao" | "ao_final") => {
    setIsLoading(true)
    try {
      const modoParam = modo ? `&modo=${modo}` : ""
      const res = await fetch(`/api/listas/${listaId}?available=true${modoParam}`, {
        headers: { "x-tenant-slug": tenantSlug },
      })
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Lista não encontrada" : "Erro ao carregar lista")
      }
      const json = await res.json()
      const data = json.data as Lista

      if (
        data.modosCorrecaoPermitidos === "ambos" &&
        !modo &&
        data.respostasAnteriores.length === 0
      ) {
        setLista(data)
        setNeedsModeChoice(true)
        return
      }

      setNeedsModeChoice(false)
      hydrateFromLista(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido")
    } finally {
      setIsLoading(false)
    }
  }, [listaId, tenantSlug])

  React.useEffect(() => {
    fetchLista()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaId, tenantSlug])

  function handleModeChoice(modo: "por_questao" | "ao_final") {
    setModoEscolhido(modo)
    setNeedsModeChoice(false)
    fetchLista(modo)
  }

  // Block body scroll
  React.useEffect(() => {
    if (!isLoading && lista) {
      document.body.style.overflow = "hidden"
      return () => { document.body.style.overflow = "" }
    }
  }, [isLoading, lista])

  // Timer (pauses when isPaused)
  React.useEffect(() => {
    if (!lista || resultado || isPaused) return
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000)
    return () => clearInterval(interval)
  }, [lista, resultado, isPaused])

  // Session: init + heartbeat + cleanup
  React.useEffect(() => {
    if (!lista || resultado) return
    const tentativa = 1 // tentativa is managed server-side via getProgresso

    async function initSession() {
      try {
        const res = await fetch(`/api/listas/${listaId}/sessao?tentativa=${tentativa}`, {
          headers: { "x-tenant-slug": tenantSlug },
        })
        if (!res.ok) return
        const json = await res.json()
        const { sessaoId, tempoAcumulado, inicio } = json.data
        sessaoIdRef.current = sessaoId
        sessaoInicioRef.current = inicio
        if (tempoAcumulado > 0) {
          setElapsedSeconds(tempoAcumulado)
        }
      } catch (_e) {
        // Session tracking is non-blocking
      }
    }
    initSession()

    // Heartbeat every 30s
    heartbeatRef.current = setInterval(async () => {
      if (!sessaoIdRef.current) return
      try {
        await fetch(`/api/listas/${listaId}/sessao`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-tenant-slug": tenantSlug },
          body: JSON.stringify({ sessaoId: sessaoIdRef.current, action: "heartbeat" }),
        })
      } catch (_e) { /* non-blocking */ }
    }, 30_000)

    // Capture ref value for cleanup
    const currentPausas = pausasRef.current

    // Cleanup: finalize session on unload
    function handleBeforeUnload() {
      if (!sessaoIdRef.current) return
      const payload = JSON.stringify({
        sessaoId: sessaoIdRef.current,
        action: "finalizar",
        logPausas: currentPausas.filter((p) => p.fim),
      })
      navigator.sendBeacon(
        `/api/listas/${listaId}/sessao`,
        new Blob([payload], { type: "application/json" }),
      )
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      // Finalize on unmount (navigation away)
      if (sessaoIdRef.current) {
        const payload = JSON.stringify({
          sessaoId: sessaoIdRef.current,
          action: "finalizar",
          logPausas: currentPausas.filter((p) => p.fim),
        })
        fetch(`/api/listas/${listaId}/sessao`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-tenant-slug": tenantSlug },
          body: payload,
          keepalive: true,
        }).catch(() => {})
      }
    }
  }, [lista, resultado, listaId, tenantSlug])

  // Pause/Resume handlers
  function handlePause() {
    setIsPaused(true)
    pausasRef.current.push({ inicio: new Date().toISOString(), tipo: "manual" })
  }

  function handleResume() {
    const lastPause = pausasRef.current[pausasRef.current.length - 1]
    if (lastPause && !lastPause.fim) {
      lastPause.fim = new Date().toISOString()
    }
    setIsPaused(false)
    questionStartRef.current = Date.now()
  }

  // ─── Derived state ──────────────────────────────────────

  const questoes = lista?.questoes ?? []
  const questaoAtual = questoes[currentIndex] ?? null
  const totalQuestoes = questoes.length
  const isPorQuestao = lista?.modoCorrecaoEfetivo === "por_questao"

  const questaoFeedback = questaoAtual ? feedback.get(questaoAtual.id) : null
  const questaoRespondida = questaoAtual ? answers.has(questaoAtual.id) : false
  const todasRespondidas = answers.size >= totalQuestoes

  React.useEffect(() => {
    if (questaoAtual) {
      setSelectedAlternativa(answers.get(questaoAtual.id) ?? null)
    }
  }, [currentIndex, questaoAtual, answers])

  React.useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" })
    questionStartRef.current = Date.now()
  }, [currentIndex])

  // Keyboard navigation
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === "ArrowLeft") { e.preventDefault(); if (currentIndex > 0) setCurrentIndex((i) => i - 1) }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (currentIndex < totalQuestoes - 1) setCurrentIndex((i) => i + 1) }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [currentIndex, totalQuestoes])

  // ─── Handlers ───────────────────────────────────────────

  async function handleResponder() {
    if (!questaoAtual || !selectedAlternativa || !lista) return
    setIsSubmitting(true)
    try {
      const tempoSegundos = Math.max(1, Math.round((Date.now() - questionStartRef.current) / 1000))
      const res = await fetch(`/api/listas/${listaId}/responder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-tenant-slug": tenantSlug },
        body: JSON.stringify({
          questaoId: questaoAtual.id,
          alternativaEscolhida: selectedAlternativa,
          tempoRespostaSegundos: tempoSegundos,
          modo: lista.modoCorrecaoEfetivo,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: "Erro ao responder" }))
        throw new Error(json.error)
      }
      const json = await res.json()
      setAnswers((prev) => new Map(prev).set(questaoAtual.id, selectedAlternativa))
      if (isPorQuestao) {
        const data = json.data as RespostaPorQuestao
        setFeedback((prev) => new Map(prev).set(questaoAtual.id, data))
      } else {
        const data = json.data as RespostaAoFinal
        setRespondidas(data.totalRespondidasNaTentativa)
      }

      if (currentIndex < totalQuestoes - 1) {
        const delay = isPorQuestao ? 1500 : 400
        setTimeout(() => setCurrentIndex((i) => i + 1), delay)
      }
    } catch (err) {
      console.error("[Resolver] Erro ao responder:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleFinalizarLista() {
    setIsLoadingResultado(true)
    try {
      const res = await fetch(`/api/listas/${listaId}/resultado`, { headers: { "x-tenant-slug": tenantSlug } })
      if (!res.ok) throw new Error("Erro ao buscar resultado")
      const json = await res.json()
      setResultado(json.data)
    } catch (err) {
      console.error("[Resolver] Resultado error:", err)
    } finally {
      setIsLoadingResultado(false)
    }
  }

  function handleVoltar() { router.push(`/${tenantSlug}/ct-questoes`) }

  function handleRefazer() {
    setResultado(null)
    setCurrentIndex(0)
    setSelectedAlternativa(null)
    setElapsedSeconds(0)
    setMarcadas(new Set())
    setIsLoading(true)
    fetch(`/api/listas/${listaId}?available=true`, { headers: { "x-tenant-slug": tenantSlug } })
      .then((r) => r.json())
      .then((json) => hydrateFromLista(json.data))
      .finally(() => setIsLoading(false))
  }

  function handleProxima() { if (currentIndex < totalQuestoes - 1) setCurrentIndex((i) => i + 1) }
  function handleAnterior() { if (currentIndex > 0) setCurrentIndex((i) => i - 1) }

  function toggleEliminar(questaoId: string, letra: string) {
    setEliminadas((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(questaoId) ?? [])
      if (set.has(letra)) set.delete(letra)
      else set.add(letra)
      next.set(questaoId, set)
      return next
    })
  }

  function handleSelectAlternativa(letra: string) {
    if (!questaoAtual || (isPorQuestao && questaoRespondida)) return
    if (eliminadas.get(questaoAtual.id)?.has(letra)) toggleEliminar(questaoAtual.id, letra)
    setSelectedAlternativa(letra)
  }

  function handleFontChange(delta: number) {
    setFontScale((s) => Math.max(FONT_SCALE_MIN, Math.min(FONT_SCALE_MAX, s + delta)))
  }

  function toggleMarcada(questaoId: string) {
    setMarcadas((prev) => {
      const next = new Set(prev)
      if (next.has(questaoId)) next.delete(questaoId)
      else next.add(questaoId)
      return next
    })
  }

  function navigateToQuestion(idx: number) { setCurrentIndex(idx); setShowNavigator(false) }

  // ─── Loading / Error ─────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !lista) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">{error ?? "Lista não encontrada"}</p>
        <Button variant="outline" onClick={handleVoltar}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    )
  }

  if (needsModeChoice && lista) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
          <Button variant="ghost" className="self-start cursor-pointer min-h-[44px]" onClick={handleVoltar}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl font-semibold">{lista.titulo}</h2>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
              Antes de começar, escolha como deseja receber o feedback das suas respostas:
            </p>
          </div>
          <div className="grid gap-4 w-full max-w-md" role="group" aria-label="Escolha o modo de correção">
            <button
              onClick={() => handleModeChoice("por_questao")}
              className={cn(
                "relative flex flex-col gap-2 overflow-hidden rounded-2xl border-2 border-muted bg-card p-5 text-left",
                "transition-all duration-200 motion-reduce:transition-none",
                "hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/8",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/10 dark:hover:border-emerald-500",
                "cursor-pointer",
              )}
            >
              <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-emerald-400 to-green-500")} />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-emerald-500 to-green-500">
                  <CheckCircle2 className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="font-semibold">Feedback imediato</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-12">
                Veja o gabarito e a resolução logo após responder cada questão.
                Ideal para estudo e revisão.
              </p>
            </button>
            <button
              onClick={() => handleModeChoice("ao_final")}
              className={cn(
                "relative flex flex-col gap-2 overflow-hidden rounded-2xl border-2 border-muted bg-card p-5 text-left",
                "transition-all duration-200 motion-reduce:transition-none",
                "hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/8",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "dark:bg-card/80 dark:backdrop-blur-sm dark:border-white/10 dark:hover:border-amber-500",
                "cursor-pointer",
              )}
            >
              <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-linear-to-r from-amber-400 to-orange-500")} />
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-500">
                  <Trophy className="h-4.5 w-4.5 text-white" />
                </div>
                <span className="font-semibold">Feedback ao final</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed pl-12">
                Responda todas as questões primeiro e veja o resultado completo
                ao finalizar. Ideal para simular uma prova real.
              </p>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (resultado) {
    return (
      <ResultView
        lista={lista} resultado={resultado} questoes={questoes} listaId={listaId}
        elapsedSeconds={elapsedSeconds} onVoltar={handleVoltar} onRefazer={handleRefazer}
      />
    )
  }

  if (!questaoAtual) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Nenhuma questão nesta lista</p>
        <Button variant="outline" onClick={handleVoltar}>
          <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    )
  }

  const progressPercent = Math.round((answers.size / totalQuestoes) * 100)

  // ─── Quiz view ────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ── Header ── */}
      <header className="shrink-0 border-b bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3">
          <Button variant="ghost" size="sm" onClick={handleVoltar} className="shrink-0 -ml-1 h-9 px-2 sm:px-3">
            <X className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline text-sm">Sair</span>
          </Button>

          <div className="flex-1 min-w-0 text-center">
            <p className="text-sm font-medium truncate">{lista.titulo}</p>
            <p className="text-xs text-muted-foreground">
              Questão {currentIndex + 1} de {totalQuestoes}
            </p>
          </div>

          {/* Timer (mobile) + Font + Navigator toggle (mobile) */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setTimerVisible((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer lg:hidden h-9 px-1.5"
              title={timerVisible ? "Ocultar tempo" : "Mostrar tempo"}
            >
              {timerVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span className={cn("font-mono tabular-nums transition-all", timerVisible ? "opacity-100" : "opacity-0 select-none")}>
                {formatTime(elapsedSeconds)}
              </span>
            </button>
            <button
              onClick={isPaused ? handleResume : handlePause}
              className={cn(
                "flex items-center justify-center h-8 w-8 rounded-md transition-colors cursor-pointer lg:hidden",
                isPaused
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
              title={isPaused ? "Continuar" : "Pausar"}
            >
              {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            </button>
            <div className="flex items-center border rounded-md lg:hidden">
              <button
                onClick={() => handleFontChange(-1)}
                disabled={fontScale <= FONT_SCALE_MIN}
                className="flex h-8 w-7 items-center justify-center text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Diminuir fonte"
              >
                A<Minus className="h-2 w-2" />
              </button>
              <span className="w-px h-4 bg-border" />
              <button
                onClick={() => handleFontChange(1)}
                disabled={fontScale >= FONT_SCALE_MAX}
                className="flex h-8 w-7 items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title="Aumentar fonte"
              >
                A<Plus className="h-2 w-2" />
              </button>
            </div>
            <Sheet open={showNavigator} onOpenChange={setShowNavigator}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 lg:hidden">
                  <Grid3X3 className="h-4 w-4" />
                  <span className="sr-only">Navegador de questões</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[60vh]">
                <SheetHeader>
                  <SheetTitle>Navegador de Questões</SheetTitle>
                </SheetHeader>
                <div className="px-4 pb-6 pt-2">
                  <QuestionGrid
                    questoes={questoes} currentIndex={currentIndex}
                    answers={answers} feedback={feedback} marcadas={marcadas}
                    onSelect={navigateToQuestion} cols="grid-cols-6 sm:grid-cols-8"
                  />
                  <div className="flex items-center gap-3 flex-wrap justify-center mt-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-muted inline-block" /> Pendente
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-amber-500 dark:bg-amber-600 inline-block" /> Voltar depois
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-primary inline-block" /> Respondida
                    </span>
                    {isPorQuestao && (
                      <>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Correta
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Incorreta
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-muted">
          <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
        </div>
      </header>

      {/* ── Pause overlay ── */}
      {isPaused && (
        <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <Pause className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-semibold">Lista pausada</p>
          <p className="text-sm text-muted-foreground">
            {formatTime(elapsedSeconds)} de estudo efetivo
          </p>
          <Button onClick={handleResume} size="lg" className="gap-2 mt-2">
            <Play className="h-4 w-4" /> Continuar
          </Button>
        </div>
      )}

      {/* ── Body: content + sidebar ── */}
      <div className="flex-1 flex min-h-0">
        {/* Main scrollable content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div className="max-w-3xl mx-auto px-4 py-5 sm:px-6 md:px-8 md:py-8 lg:pr-4 space-y-5">
            {/* Question metadata */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">Questão {currentIndex + 1}</span>
              {questaoAtual.instituicao && (
                <span className="text-xs text-muted-foreground">
                  {questaoAtual.instituicao}{questaoAtual.ano ? ` ${questaoAtual.ano}` : ""}
                </span>
              )}
              <div className="flex items-center gap-1.5 ml-auto">
                <button
                  onClick={() => toggleMarcada(questaoAtual.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white min-h-[36px]",
                    "transition-all duration-200 motion-reduce:transition-none cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    marcadas.has(questaoAtual.id)
                      ? "bg-amber-600 shadow-md shadow-amber-500/20 dark:bg-amber-500"
                      : "bg-amber-500 hover:bg-amber-600 hover:shadow-sm dark:bg-amber-600 dark:hover:bg-amber-500",
                  )}
                  title={marcadas.has(questaoAtual.id) ? "Remover marcação" : "Marcar para voltar depois"}
                >
                  <Flag className={cn("h-4 w-4 shrink-0", marcadas.has(questaoAtual.id) && "fill-current")} />
                  {marcadas.has(questaoAtual.id) ? "Marcada" : "Voltar depois"}
                </button>
              </div>
              {questaoAtual.codigo && (
                <span className="text-xs font-mono text-muted-foreground">
                  #{questaoAtual.codigo}
                </span>
              )}
            </div>

            {/* Texto base */}
            {questaoAtual.textoBase && questaoAtual.textoBase.length > 0 && (
              <div className={cn("rounded-xl bg-muted/40 p-4 sm:p-5 border-l-4 border-primary/20 space-y-2", getFontClass(fontScale))}>
                {renderContentBlocks(questaoAtual.textoBase, listaId)}
              </div>
            )}

            {questaoAtual.fonte && questaoAtual.fonte.length > 0 && (
              <div className="text-xs leading-relaxed text-muted-foreground">
                {renderContentBlocks(questaoAtual.fonte, listaId)}
              </div>
            )}

            {/* Enunciado */}
            <div className={cn("space-y-2 leading-relaxed", getFontClass(fontScale))}>
              {renderContentBlocks(questaoAtual.enunciado, listaId)}
            </div>

            {/* ── Alternativas ── */}
            <div className="space-y-1.5">
              {questaoAtual.alternativas
                .sort((a, b) => a.ordem - b.ordem)
                .map((alt) => {
                  const isSelected = selectedAlternativa === alt.letra
                  const isAnswered = questaoRespondida
                  const isElim = eliminadas.get(questaoAtual.id)?.has(alt.letra) ?? false
                  const hasImage = !!alt.imagemPath

                  let altStyle = "border-border hover:border-primary/40 hover:bg-accent/30 active:bg-accent/50"
                  if (questaoFeedback && isAnswered) {
                    const isCorrect = alt.letra.toUpperCase() === questaoFeedback.gabarito
                    if (isSelected && questaoFeedback.correta) altStyle = "border-green-500 bg-green-50 dark:bg-green-950/30"
                    else if (isSelected && !questaoFeedback.correta) altStyle = "border-red-500 bg-red-50 dark:bg-red-950/30"
                    else if (isCorrect) altStyle = "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                  } else if (isSelected) {
                    altStyle = "border-primary bg-primary/5 shadow-sm"
                  }

                  const disabled = isPorQuestao && isAnswered

                  return (
                    <div key={alt.letra} className="flex items-stretch gap-1">
                      <button
                        onClick={() => handleSelectAlternativa(alt.letra)}
                        disabled={disabled}
                        className={cn(
                          "flex-1 flex gap-2.5 rounded-lg border px-3 py-2 text-left transition-all",
                          hasImage ? "items-start" : "items-center",
                          altStyle,
                          disabled ? "cursor-default" : "cursor-pointer",
                          isElim && !isSelected && "opacity-45"
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                            isSelected ? "border-primary bg-primary text-primary-foreground scale-105"
                              : isElim ? "border-dashed border-muted-foreground/30 text-muted-foreground"
                                : "border-muted-foreground/25 text-muted-foreground"
                          )}
                        >
                          {alt.letra.toUpperCase()}
                        </span>
                        <span className={cn(
                          "flex-1 min-w-0",
                          getFontClass(fontScale),
                          isElim && !isSelected && "line-through text-muted-foreground"
                        )}>
                          {alt.texto.includes("$") ? renderInlineMath(alt.texto) : alt.texto}
                          {alt.imagemPath && (
                            <Image
                              src={
                                alt.imagemPath.startsWith("importacoes/")
                                  ? `/api/questoes/imagem?path=${encodeURIComponent(alt.imagemPath)}`
                                  : `/api/importacao/${listaId}/imagem?key=${alt.imagemPath}`
                              }
                              alt={`Alternativa ${alt.letra.toUpperCase()}`}
                              width={0} height={0}
                              sizes="(max-width: 768px) 100vw, 40vw"
                              className={cn("w-auto max-w-full max-h-[150px] rounded-md border mt-1.5", isElim && !isSelected && "opacity-50")}
                              unoptimized
                            />
                          )}
                        </span>
                      </button>

                      {!disabled && (
                        <button
                          onClick={() => toggleEliminar(questaoAtual.id, alt.letra)}
                          className={cn(
                            "flex items-center justify-center w-9 rounded-lg border transition-all shrink-0 cursor-pointer",
                            isElim
                              ? "border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                              : "border-transparent text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50"
                          )}
                          title={isElim ? "Restaurar alternativa" : "Eliminar alternativa"}
                        >
                          <Scissors className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>

            {/* ── Feedback ── */}
            {questaoFeedback && (
              <div className={cn(
                "rounded-xl border-2 p-4 sm:p-5 space-y-4",
                questaoFeedback.correta
                  ? "border-green-300 bg-green-50/80 dark:border-green-800 dark:bg-green-950/30"
                  : "border-red-300 bg-red-50/80 dark:border-red-800 dark:bg-red-950/30"
              )}>
                <div className="flex items-center gap-2.5">
                  {questaoFeedback.correta ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
                      <span className="font-semibold text-green-700 dark:text-green-400">Resposta correta!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-red-500 dark:text-red-400 shrink-0" />
                      <span className="font-semibold text-red-700 dark:text-red-400">
                        Incorreta. Gabarito: <span className="font-bold">{questaoFeedback.gabarito}</span>
                      </span>
                    </>
                  )}
                </div>
                {questaoFeedback.resolucaoTexto && questaoFeedback.resolucaoTexto.length > 0 && (
                  <Collapsible className="pt-2 border-t border-current/10">
                    <CollapsibleTrigger className="flex items-center gap-1.5 w-full cursor-pointer group">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Resolução</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="text-sm space-y-2 pt-2">
                      {renderContentBlocks(questaoFeedback.resolucaoTexto, listaId)}
                    </CollapsibleContent>
                  </Collapsible>
                )}
                {questaoFeedback.resolucaoVideoUrl && (
                  <Collapsible className="pt-2 border-t border-current/10">
                    <CollapsibleTrigger className="flex items-center gap-1.5 w-full cursor-pointer group">
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vídeo de Resolução</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <VideoPlayer url={questaoFeedback.resolucaoVideoUrl} />
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            )}

            <div className="h-2" />
          </div>
        </main>

        {/* ── Desktop sidebar ── */}
        <div className="hidden lg:block">
          <SidebarPanel
            questoes={questoes} currentIndex={currentIndex}
            answers={answers} feedback={feedback} marcadas={marcadas}
            isPorQuestao={isPorQuestao} todasRespondidas={todasRespondidas}
            elapsedSeconds={elapsedSeconds} timerVisible={timerVisible}
            fontScale={fontScale} isPaused={isPaused}
            onToggleTimer={() => setTimerVisible((v) => !v)}
            onPause={handlePause} onResume={handleResume}
            onSelect={(idx) => setCurrentIndex(idx)}
            onFinalizar={handleFinalizarLista}
            onFontChange={handleFontChange}
            isLoadingResultado={isLoadingResultado}
          />
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="shrink-0 border-t bg-background/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 max-w-3xl mx-auto w-full lg:max-w-none lg:pr-[252px]">
          <Button variant="outline" onClick={handleAnterior} disabled={currentIndex === 0} className="min-h-[44px] min-w-[44px] px-3 sm:px-4">
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          <div className="flex-1 flex justify-center">
            {!questaoRespondida ? (
              <Button onClick={handleResponder} disabled={!selectedAlternativa || isSubmitting} className="min-h-[44px] w-full max-w-[280px]">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Responder
              </Button>
            ) : currentIndex >= totalQuestoes - 1 ? (
              <Button onClick={handleFinalizarLista} disabled={isLoadingResultado} className="min-h-[44px] w-full max-w-[280px]">
                {isLoadingResultado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trophy className="mr-2 h-4 w-4" />}
                Finalizar Lista
              </Button>
            ) : (
              <Button onClick={handleProxima} className="min-h-[44px] w-full max-w-[280px]">
                Próxima <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>

          <Button variant="outline" onClick={handleProxima} disabled={currentIndex >= totalQuestoes - 1} className="min-h-[44px] min-w-[44px] px-3 sm:px-4">
            <span className="hidden sm:inline">Próxima</span>
            <ArrowRight className="h-4 w-4 sm:ml-2" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
