"use client"

import * as React from "react"
import Image from "next/image"
import katex from "katex"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/app/shared/components/forms/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/shared/components/forms/select"
import { Checkbox } from "@/app/shared/components/forms/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/app/shared/components/ui/scroll-area"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/app/shared/components/ui/resizable"
import { VideoPlayer } from "@/app/shared/components/media/video-player"
import { apiClient } from "@/app/shared/library/api-client"
import {
  Search,
  Loader2,
  FileText,
  X,
  ArrowLeft,
  CheckCircle2,
  Filter,
  Eye,
  Plus,
  ChevronDown,
} from "lucide-react"

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "image"; storagePath: string; alt?: string; width?: number; height?: number }
  | { type: "math"; latex: string }

type Alternativa = {
  id: string
  letra: string
  texto: string
  imagemPath: string | null
  correta: boolean
  ordem: number
}

type QuestaoResumo = {
  id: string
  numeroOriginal: number | null
  disciplina: string | null
  disciplinaId: string | null
  instituicao: string | null
  ano: number | null
  dificuldade: string | null
  enunciado: ContentBlock[]
  gabarito: string
  tags: string[]
  importacaoJobId: string | null
}

type QuestaoCompleta = QuestaoResumo & {
  textoBase: ContentBlock[] | null
  resolucaoTexto: ContentBlock[] | null
  resolucaoVideoUrl: string | null
  alternativas: Alternativa[]
}

type ApiDisciplina = { id: string; name: string }

function renderTextWithInlineMath(text: string): React.ReactNode[] {
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

function resolveImageUrl(storagePath: string, importacaoJobId: string | null): string {
  if (storagePath.startsWith("pending:") && importacaoJobId) {
    const key = storagePath.replace("pending:", "")
    return `/api/importacao/${importacaoJobId}/imagem?key=${encodeURIComponent(key)}`
  }
  if (storagePath.startsWith("importacoes/")) {
    return `/api/questoes/imagem?path=${encodeURIComponent(storagePath)}`
  }
  return storagePath
}

function renderBlocks(blocks: ContentBlock[], jobId: string | null) {
  return blocks.map((block, i) => {
    if (block.type === "paragraph") {
      const text = block.text
      return (
        <p key={i} className="leading-relaxed whitespace-pre-wrap">
          {text.includes("$") ? renderTextWithInlineMath(text) : text}
        </p>
      )
    }
    if (block.type === "image") {
      const src = resolveImageUrl(block.storagePath, jobId)
      const w = block.width ?? 0
      const h = block.height ?? 0
      return (
        <div key={i} className="flex justify-center my-3">
          <Image
            src={src}
            alt={block.alt ?? `Imagem ${i + 1}`}
            width={w || 600}
            height={h || 400}
            sizes="(max-width: 768px) 100vw, 40vw"
            className="rounded-md border object-contain"
            style={{ maxWidth: "100%", width: w ? `${w}px` : undefined, height: w ? "auto" : undefined }}
            unoptimized
          />
        </div>
      )
    }
    if (block.type === "math") {
      let html: string
      try {
        html = katex.renderToString(block.latex, { throwOnError: false, displayMode: true })
      } catch {
        html = block.latex
      }
      return <span key={i} className="block my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
    }
    return null
  })
}

function extractPlainText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b) => b.type === "paragraph")
    .map((b) => (b as { type: "paragraph"; text: string }).text)
    .join(" ")
}

const DIFICULDADE_LABEL: Record<string, string> = {
  facil: "Fácil",
  medio: "Médio",
  dificil: "Difícil",
}

const DIFICULDADE_COLOR: Record<string, string> = {
  facil: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  medio: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300",
  dificil: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
}

interface Props {
  listaId: string
}

export default function AdicionarQuestoesClient({ listaId }: Props) {
  const params = useParams()
  const tenantSlug = params?.tenant as string
  const router = useRouter()

  // Lista info
  const [listaTitulo, setListaTitulo] = React.useState("")

  // Filters
  const [search, setSearch] = React.useState("")
  const [debouncedSearch, setDebouncedSearch] = React.useState("")
  const [filterDisciplinaId, setFilterDisciplinaId] = React.useState("")
  const [filterFrenteId, setFilterFrenteId] = React.useState("")
  const [filterModuloId, setFilterModuloId] = React.useState("")
  const [filterInstituicao, setFilterInstituicao] = React.useState("")
  const [filterAno, setFilterAno] = React.useState("")
  const [filterDificuldade, setFilterDificuldade] = React.useState("")
  const [showFilters, setShowFilters] = React.useState(false)

  // Catalog data
  const [disciplinas, setDisciplinas] = React.useState<ApiDisciplina[]>([])
  const [frentes, setFrentes] = React.useState<Array<{ id: string; nome: string }>>([])
  const [modulos, setModulos] = React.useState<Array<{ id: string; nome: string }>>([])
  const [instituicoes, setInstituicoes] = React.useState<string[]>([])
  const [anos, setAnos] = React.useState<number[]>([])

  // Questions
  const [questoes, setQuestoes] = React.useState<QuestaoResumo[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [hasMore, setHasMore] = React.useState(false)
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)

  // Selection
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = React.useState(false)

  // Preview
  const [previewId, setPreviewId] = React.useState<string | null>(null)
  const [previewData, setPreviewData] = React.useState<QuestaoCompleta | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Fetch lista title
  React.useEffect(() => {
    apiClient.get<{ data: { titulo: string } }>(`/api/listas/${listaId}`)
      .then((json) => setListaTitulo(json.data?.titulo ?? ""))
      .catch(() => {})
  }, [listaId])

  // Fetch disciplinas
  React.useEffect(() => {
    apiClient.get<{ data: ApiDisciplina[] }>("/api/curso/disciplinas")
      .then((json) => setDisciplinas(json.data ?? []))
      .catch(() => {})
  }, [])

  // Fetch filter values (instituicoes, anos)
  React.useEffect(() => {
    apiClient.get<{ data: { instituicoes: string[]; anos: number[] } }>("/api/questoes/filtros")
      .then((json) => {
        setInstituicoes(json.data?.instituicoes ?? [])
        setAnos(json.data?.anos ?? [])
      })
      .catch(() => {})
  }, [])

  // Fetch frentes when disciplina changes
  React.useEffect(() => {
    if (!filterDisciplinaId) {
      setFrentes([])
      setFilterFrenteId("")
      setModulos([])
      setFilterModuloId("")
      return
    }
    apiClient.get<{ data: Array<{ frenteId: string; frenteNome: string }> }>(
      `/api/curso/estrutura?disciplinaId=${filterDisciplinaId}`,
    )
      .then((json) => setFrentes((json.data ?? []).map((f) => ({ id: f.frenteId, nome: f.frenteNome }))))
      .catch(() => setFrentes([]))
  }, [filterDisciplinaId])

  // Fetch modulos when frente changes
  React.useEffect(() => {
    if (!filterFrenteId) {
      setModulos([])
      setFilterModuloId("")
      return
    }
    apiClient.get<{ data: Array<{ moduloId: string; moduloNome: string }> }>(
      `/api/curso/estrutura?frenteId=${filterFrenteId}`,
    )
      .then((json) => setModulos((json.data ?? []).map((m) => ({ id: m.moduloId, nome: m.moduloNome }))))
      .catch(() => setModulos([]))
  }, [filterFrenteId])

  // Fetch questions
  const fetchQuestoes = React.useCallback(async (newCursor?: string | null) => {
    if (newCursor) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    try {
      const sp = new URLSearchParams()
      if (debouncedSearch) sp.set("search", debouncedSearch)
      if (filterDisciplinaId) sp.set("disciplinaId", filterDisciplinaId)
      if (filterFrenteId) sp.set("frenteId", filterFrenteId)
      if (filterModuloId) sp.set("moduloId", filterModuloId)
      if (filterInstituicao) sp.set("instituicao", filterInstituicao)
      if (filterAno) sp.set("ano", filterAno)
      if (filterDificuldade) sp.set("dificuldade", filterDificuldade)
      if (newCursor) sp.set("cursor", newCursor)
      sp.set("limit", "30")

      const json = await apiClient.get<{ data: QuestaoResumo[]; nextCursor?: string | null }>(
        `/api/questoes?${sp}`,
      )
      if (newCursor) {
        setQuestoes((prev) => [...prev, ...(json.data ?? [])])
      } else {
        setQuestoes(json.data ?? [])
      }
      setHasMore(!!json.nextCursor)
      setCursor(json.nextCursor ?? null)
    } catch {
      if (!newCursor) setQuestoes([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [debouncedSearch, filterDisciplinaId, filterFrenteId, filterModuloId, filterInstituicao, filterAno, filterDificuldade])

  React.useEffect(() => {
    fetchQuestoes()
  }, [fetchQuestoes])

  // Load preview
  React.useEffect(() => {
    if (!previewId) {
      setPreviewData(null)
      return
    }
    let cancelled = false
    setIsLoadingPreview(true)
    apiClient.get<{ data: QuestaoCompleta }>(`/api/questoes/${previewId}`)
      .then((json) => {
        if (!cancelled) setPreviewData(json.data ?? null)
      })
      .catch(() => {
        if (!cancelled) setPreviewData(null)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPreview(false)
      })
    return () => { cancelled = true }
  }, [previewId])

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleAdd() {
    if (selectedIds.size === 0) return
    setIsAdding(true)
    try {
      await apiClient.post(`/api/listas/${listaId}/questoes`, {
        questaoIds: Array.from(selectedIds),
      })
      router.push(`/${tenantSlug}/biblioteca/listas`)
    } catch (err) {
      console.error("[AdicionarQuestoes] Error:", err)
    } finally {
      setIsAdding(false)
    }
  }

  function clearFilters() {
    setFilterDisciplinaId("")
    setFilterFrenteId("")
    setFilterModuloId("")
    setFilterInstituicao("")
    setFilterAno("")
    setFilterDificuldade("")
  }

  const hasActiveFilters = filterDisciplinaId || filterFrenteId || filterModuloId ||
    filterInstituicao || filterAno || filterDificuldade

  const activeFilterCount = [
    filterDisciplinaId, filterFrenteId, filterModuloId,
    filterInstituicao, filterAno, filterDificuldade,
  ].filter(Boolean).length

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 cursor-pointer"
            onClick={() => router.push(`/${tenantSlug}/biblioteca/listas`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Adicionar Questões</h1>
            {listaTitulo && (
              <p className="text-sm text-muted-foreground">{listaTitulo}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} selecionada(s)
          </span>
          <Button
            variant="outline"
            className="cursor-pointer"
            onClick={() => router.push(`/${tenantSlug}/biblioteca/listas`)}
          >
            Cancelar
          </Button>
          <Button
            className="cursor-pointer"
            disabled={isAdding || selectedIds.size === 0}
            onClick={handleAdd}
          >
            {isAdding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Plus className="mr-1 h-4 w-4" />
            Adicionar ({selectedIds.size})
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal">
          {/* Left Panel: Filters + Question List */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="flex flex-col h-full">
              {/* Search Bar */}
              <div className="p-3 border-b space-y-2 shrink-0">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar no enunciado..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 pr-8"
                    />
                    {search && (
                      <button
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Button
                    variant={showFilters ? "secondary" : "outline"}
                    size="icon"
                    className="shrink-0 cursor-pointer relative"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Filter className="h-4 w-4" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </div>

                {/* Expandable Filters */}
                {showFilters && (
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <Select value={filterDisciplinaId} onValueChange={(v) => { setFilterDisciplinaId(v === "__all__" ? "" : v); setFilterFrenteId(""); setFilterModuloId("") }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Disciplina" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas disciplinas</SelectItem>
                        {disciplinas.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filterFrenteId}
                      onValueChange={(v) => { setFilterFrenteId(v === "__all__" ? "" : v); setFilterModuloId("") }}
                      disabled={!filterDisciplinaId || frentes.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Frente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas frentes</SelectItem>
                        {frentes.map((f) => (
                          <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={filterModuloId}
                      onValueChange={(v) => setFilterModuloId(v === "__all__" ? "" : v)}
                      disabled={!filterFrenteId || modulos.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Módulo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos módulos</SelectItem>
                        {modulos.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterInstituicao} onValueChange={(v) => setFilterInstituicao(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Fonte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas fontes</SelectItem>
                        {instituicoes.map((inst) => (
                          <SelectItem key={inst} value={inst}>{inst}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterAno} onValueChange={(v) => setFilterAno(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Ano" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos anos</SelectItem>
                        {anos.map((a) => (
                          <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={filterDificuldade} onValueChange={(v) => setFilterDificuldade(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Dificuldade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas</SelectItem>
                        <SelectItem value="facil">Fácil</SelectItem>
                        <SelectItem value="medio">Médio</SelectItem>
                        <SelectItem value="dificil">Difícil</SelectItem>
                      </SelectContent>
                    </Select>

                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="col-span-2 h-7 text-xs cursor-pointer"
                        onClick={clearFilters}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Limpar filtros
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Question List */}
              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : questoes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-4">
                    <FileText className="h-10 w-10 mb-3 opacity-50" />
                    <p className="text-sm font-medium">Nenhuma questão encontrada</p>
                    <p className="text-xs mt-1 text-center">
                      Ajuste os filtros ou busque por outro termo.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {questoes.map((q) => {
                      const isSelected = selectedIds.has(q.id)
                      const isActive = previewId === q.id
                      const preview = extractPlainText(q.enunciado).substring(0, 120)
                      return (
                        <div
                          key={q.id}
                          className={`flex items-start gap-3 px-3 py-3 transition-colors cursor-pointer ${
                            isActive
                              ? "bg-accent"
                              : isSelected
                                ? "bg-accent/50"
                                : "hover:bg-muted/50"
                          }`}
                          onClick={() => setPreviewId(q.id)}
                        >
                          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelection(q.id)}
                              className="cursor-pointer"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-muted-foreground">
                                #{q.numeroOriginal ?? "—"}
                              </span>
                              {q.disciplina && (
                                <span className="text-xs text-muted-foreground truncate">
                                  {q.disciplina}
                                </span>
                              )}
                            </div>
                            <p className="text-sm leading-snug line-clamp-2">
                              {preview || "Sem texto"}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {q.instituicao && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {q.instituicao}
                                </Badge>
                              )}
                              {q.ano && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  {q.ano}
                                </Badge>
                              )}
                              {q.dificuldade && (
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${DIFICULDADE_COLOR[q.dificuldade] ?? ""}`}>
                                  {DIFICULDADE_LABEL[q.dificuldade] ?? q.dificuldade}
                                </span>
                              )}
                              {q.tags.length > 0 && q.tags.slice(0, 2).map((t) => (
                                <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-primary mt-1" />
                          )}
                        </div>
                      )
                    })}
                    {hasMore && (
                      <div className="flex justify-center py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer"
                          disabled={isLoadingMore}
                          onClick={() => fetchQuestoes(cursor)}
                        >
                          {isLoadingMore ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ChevronDown className="mr-2 h-4 w-4" />
                          )}
                          Carregar mais
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              {/* Footer count */}
              <div className="border-t px-3 py-2 text-xs text-muted-foreground shrink-0">
                {questoes.length} questão(ões) listada(s)
                {hasMore && " · mais disponíveis"}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right Panel: Preview */}
          <ResizablePanel defaultSize={55} minSize={30}>
            {previewId === null ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground px-8">
                <Eye className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-base font-medium">Selecione uma questão</p>
                <p className="text-sm mt-1 text-center">
                  Clique em uma questão na lista ao lado para visualizá-la completa aqui.
                </p>
              </div>
            ) : isLoadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : previewData ? (
              <ScrollArea className="h-full">
                <div className="p-6 space-y-6 max-w-3xl">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-semibold">
                          Questão {previewData.numeroOriginal ?? "—"}
                        </h2>
                        {previewData.dificuldade && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${DIFICULDADE_COLOR[previewData.dificuldade] ?? ""}`}>
                            {DIFICULDADE_LABEL[previewData.dificuldade] ?? previewData.dificuldade}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
                        {previewData.disciplina && <span>{previewData.disciplina}</span>}
                        {previewData.instituicao && <span>· {previewData.instituicao}</span>}
                        {previewData.ano && <span>· {previewData.ano}</span>}
                        {previewData.gabarito && <span>· Gabarito: {previewData.gabarito}</span>}
                      </div>
                      {previewData.tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {previewData.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={selectedIds.has(previewData.id) ? "secondary" : "default"}
                      className="shrink-0 cursor-pointer"
                      onClick={() => toggleSelection(previewData.id)}
                    >
                      {selectedIds.has(previewData.id) ? (
                        <>
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                          Selecionada
                        </>
                      ) : (
                        <>
                          <Plus className="mr-1.5 h-4 w-4" />
                          Selecionar
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Texto Base */}
                  {previewData.textoBase && previewData.textoBase.length > 0 && (
                    <div className="rounded-lg bg-muted/30 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Texto de Apoio
                      </p>
                      <div className="text-sm leading-relaxed space-y-1">
                        {renderBlocks(previewData.textoBase, previewData.importacaoJobId)}
                      </div>
                    </div>
                  )}

                  {/* Enunciado */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Enunciado
                    </p>
                    <div className="text-sm leading-relaxed space-y-1">
                      {renderBlocks(previewData.enunciado, previewData.importacaoJobId)}
                    </div>
                  </div>

                  {/* Alternativas */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Alternativas
                    </p>
                    <div className="space-y-2">
                      {previewData.alternativas
                        .sort((a, b) => a.ordem - b.ordem)
                        .map((alt) => {
                          const isCorrect = alt.letra.toUpperCase() === previewData.gabarito
                          return (
                            <div
                              key={alt.letra}
                              className={`flex items-start gap-3 rounded-lg border p-3 ${
                                isCorrect
                                  ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                                  : ""
                              }`}
                            >
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                                  isCorrect
                                    ? "bg-green-600 text-white"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {alt.letra.toUpperCase()}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm">
                                  {alt.texto.includes("$") ? renderTextWithInlineMath(alt.texto) : alt.texto}
                                </p>
                                {alt.imagemPath && (
                                  <Image
                                    src={resolveImageUrl(alt.imagemPath, previewData.importacaoJobId)}
                                    alt={`Imagem alternativa ${alt.letra.toUpperCase()}`}
                                    width={400}
                                    height={300}
                                    sizes="(max-width: 768px) 80vw, 40vw"
                                    className="max-w-full h-auto rounded-md border mt-2 object-contain"
                                    unoptimized
                                  />
                                )}
                              </div>
                              {isCorrect && (
                                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                              )}
                            </div>
                          )
                        })}
                    </div>
                  </div>

                  {/* Resolução */}
                  {(previewData.resolucaoTexto && previewData.resolucaoTexto.length > 0) && (
                    <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Resolução
                      </p>
                      <div className="text-sm leading-relaxed space-y-1">
                        {renderBlocks(previewData.resolucaoTexto, previewData.importacaoJobId)}
                      </div>
                    </div>
                  )}

                  {/* Video */}
                  {previewData.resolucaoVideoUrl && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Vídeo de Resolução
                      </p>
                      <VideoPlayer url={previewData.resolucaoVideoUrl} />
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <p className="text-sm">Erro ao carregar questão.</p>
              </div>
            )}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
