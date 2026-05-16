"use client"

import * as React from "react"
import Image from "next/image"
import katex from "katex"
import { useCurrentUser } from "@/components/providers/user-provider"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/app/shared/components/forms/input"
import { Label } from "@/app/shared/components/forms/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/shared/components/forms/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/shared/components/dataviz/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/shared/components/overlay/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/shared/components/ui/alert-dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/shared/components/overlay/popover"
import { ScrollArea } from "@/app/shared/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Textarea } from "@/app/shared/components/forms/textarea"
import { Checkbox } from "@/app/shared/components/forms/checkbox"
import {
  Search,
  Upload,
  Download,
  Trash2,
  Loader2,
  FileText,
  X,
  ChevronRight,
  Eye,
  AlertTriangle,
  Pencil,
  Save,
  CheckCircle2,
  Plus,
  HelpCircle,
  Tag,
} from "lucide-react"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/app/shared/components/overlay/tooltip"
import { VideoPlayer } from "@/app/shared/components/media/video-player"
import { apiClient } from "@/app/shared/library/api-client"
import {
  AREAS_CONHECIMENTO,
  getCompetenciasPorArea,
  getHabilidadesPorCompetencia,
  findCompetencia,
  findHabilidade,
  type AreaConhecimento,
} from "@/app/shared/types/enem-matrix"
import { ReviewQuestionContent } from "./components/review-question-content"

type ApiDisciplina = { id: string; name: string }
const DIFICULDADES = [
  { value: "facil", label: "Fácil", color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 ring-green-500" },
  { value: "medio", label: "Médio", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 ring-amber-500" },
  { value: "dificil", label: "Difícil", color: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 ring-red-500" },
] as const

function buildDefaultListaTitle(disciplina: string | null | undefined): string {
  return `${disciplina || "Questões"} - ${new Date().toLocaleDateString("pt-BR")}`
}

type QuestaoResumo = {
  id: string
  codigo: string | null
  numeroOriginal: number | null
  instituicao: string | null
  ano: number | null
  disciplina: string | null
  disciplinaId: string | null
  frenteId: string | null
  moduloId: string | null
  dificuldade: string | null
  fonte: Array<Record<string, unknown>> | null
  tags: string[]
  createdAt: string
}

type ParseWarning = {
  questao?: number
  code: string
  message: string
}

type ImportacaoJob = {
  id: string
  originalFilename: string
  status: string
  questoesExtraidas: number
  disciplina: string | null
  disciplinaId: string | null
  frenteId: string | null
  moduloId: string | null
  instituicaoPadrao: string | null
  anoPadrao: number | null
  dificuldadePadrao: string | null
  tagsPadrao: string[]
  createdAt: string
  warnings: ParseWarning[]
}

type QuestaoParseada = {
  numero: number
  instituicao: string | null
  ano: number | null
  dificuldade: "facil" | "medio" | "dificil" | null
  textoBase: Array<Record<string, unknown>>
  fonte?: Array<Record<string, unknown>> | null
  enunciado: Array<Record<string, unknown>>
  alternativas: Array<{
    letra: "a" | "b" | "c" | "d" | "e"
    texto: string
    imagemPath?: string | null
  }>
  gabarito: "A" | "B" | "C" | "D" | "E"
  resolucao: Array<Record<string, unknown>>
  disciplina?: string | null
  moduloConteudo?: string | null
  tags?: string[]
  resolucaoVideoUrl?: string | null
  areaConhecimento?: string | null
  competenciasEnem?: string[]
  habilidadesEnem?: string[]
}

type ViewQuestaoData = {
  id: string
  codigo: string | null
  numeroOriginal: number | null
  instituicao: string | null
  ano: number | null
  disciplina: string | null
  disciplinaId: string | null
  frenteId: string | null
  moduloId: string | null
  dificuldade: string | null
  textoBase: Array<Record<string, unknown>> | null
  fonte: Array<Record<string, unknown>> | null
  enunciado: Array<Record<string, unknown>>
  alternativas: Array<{
    letra: string
    texto: string
    imagemPath: string | null
    correta: boolean
    ordem: number
  }>
  gabarito: string
  resolucaoTexto: Array<Record<string, unknown>> | null
  resolucaoVideoUrl: string | null
  tags: string[]
  areaConhecimento: string | null
  competenciasEnem: string[]
  habilidadesEnem: string[]
  importacaoJobId: string | null
  createdAt: string
}

type ImportacaoJobFull = ImportacaoJob & {
  questoesJson: QuestaoParseada[] | null
}

function extractFullText(blocks: Array<Record<string, unknown>>): string {
  return blocks
    .filter((b) => b.type === "paragraph")
    .map((b) => b.text as string)
    .join("\n")
}

function replaceParagraphBlocks(
  blocks: Array<Record<string, unknown>> | null,
  text: string,
): Array<Record<string, unknown>> {
  const nonText = (blocks ?? []).filter((b) => b.type !== "paragraph")
  return text ? [{ type: "paragraph", text }, ...nonText] : nonText
}

function isValidOptionalUrl(value: string | null): boolean {
  if (!value) return true
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function renderTextWithInlineMath(text: string): React.ReactNode[] {
  const parts = text.split(/(\$[^$]+\$)/g)
  return parts.map((part, i) => {
    if (part.startsWith("$") && part.endsWith("$")) {
      const latex = part.slice(1, -1)
      try {
        const html = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: false,
        })
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
      } catch {
        return <span key={i}>{latex}</span>
      }
    }
    return <React.Fragment key={i}>{renderInlineTextFormatting(part)}</React.Fragment>
  })
}

function renderInlineTextFormatting(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <React.Fragment key={i}>{part}</React.Fragment>
  })
}

function hasPreviewFormatting(text: string): boolean {
  return text.includes("$") || text.includes("**");
}

function hasRichTextPreview(blocks: Array<Record<string, unknown>> | null | undefined): boolean {
  return (blocks ?? []).some((block) => {
    if (block.type !== "paragraph") return block.type === "image" || block.type === "math"
    const text = block.text as string
    return hasPreviewFormatting(text)
  })
}

const GABARITO_LETRAS = ["A", "B", "C", "D", "E"] as const

const FIELD_TOOLTIPS: Record<string, string> = {
  textoBase: "Texto de apoio ou texto motivador que contextualiza a questão. Pode conter trechos de artigos, leis, poemas, etc.",
  fonte: "Referência bibliográfica ou citação da questão. Ex: Disponível em, Acesso em, adaptado de.",
  enunciado: "A pergunta ou comando da questão. É o texto principal que o aluno deve responder.",
  alternativas: "As opções de resposta da questão (A a E). A alternativa correta é marcada em verde.",
  gabarito: "A letra da alternativa correta. Clique para alterar.",
  dificuldade: "Nível de dificuldade da questão: Fácil, Médio ou Difícil.",
  resolucao: "Explicação detalhada da resolução da questão (opcional). Ajuda o aluno a entender o raciocínio.",
  videoResolucao: "Link para um vídeo explicativo da resolução (YouTube, Vimeo, etc.).",
  disciplina: "A disciplina à qual esta questão pertence. Se não definida, herda da configuração da importação.",
  moduloConteudo: "O módulo de conteúdo (tópico) ao qual a questão está associada dentro da disciplina.",
  tags: "Palavras-chave para facilitar a busca e organização das questões.",
}

function FieldLabel({ label, tooltipKey }: { label: string; tooltipKey: string }) {
  const tip = FIELD_TOOLTIPS[tooltipKey]
  return (
    <div className="flex items-center gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {tip && (
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[260px]">
            <p>{tip}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

export default function BancoQuestoesClient() {
  const _user = useCurrentUser()
  const params = useParams()
  const tenantSlug = params?.tenant as string

  const [activeTab, setActiveTab] = React.useState("banco")
  const [questoes, setQuestoes] = React.useState<QuestaoResumo[]>([])
  const [importacoes, setImportacoes] = React.useState<ImportacaoJob[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isLoadingImportacoes, setIsLoadingImportacoes] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [filterDisciplina, setFilterDisciplina] = React.useState("")
  const [filterDisciplinaId, setFilterDisciplinaId] = React.useState("")
  const [filterFrenteId, setFilterFrenteId] = React.useState("")
  const [filterModuloId, setFilterModuloId] = React.useState("")
  const [filterFrentes, setFilterFrentes] = React.useState<Array<{ id: string; nome: string }>>([])
  const [filterModulos, setFilterModulos] = React.useState<Array<{ id: string; nome: string; numeroModulo?: number | null }>>([])
  const [filterDificuldade, setFilterDificuldade] = React.useState("")
  const [filterAreaConhecimento, setFilterAreaConhecimento] = React.useState("")
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [hasMore, setHasMore] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false)
  const [uploadDisciplina, setUploadDisciplina] = React.useState("")
  const [uploadInstituicao, setUploadInstituicao] = React.useState("")
  const [uploadAno, setUploadAno] = React.useState("")
  const [uploadDificuldade, setUploadDificuldade] = React.useState("")
  const [uploadTags, setUploadTags] = React.useState<string[]>([])
  const [uploadTagInput, setUploadTagInput] = React.useState("")
  const [uploadDisciplinaId, setUploadDisciplinaId] = React.useState("")
  const [uploadFrenteId, setUploadFrenteId] = React.useState("")
  const [uploadModuloId, setUploadModuloId] = React.useState("")
  const [uploadFrentes, setUploadFrentes] = React.useState<Array<{ id: string; nome: string }>>([])
  const [uploadModulos, setUploadModulos] = React.useState<Array<{ id: string; nome: string; numeroModulo?: number | null }>>([])
  const [deleteId, setDeleteId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [deleteImportacaoId, setDeleteImportacaoId] = React.useState<string | null>(null)
  const [isDeletingImportacao, setIsDeletingImportacao] = React.useState(false)

  const [viewQuestao, setViewQuestao] = React.useState<ViewQuestaoData | null>(null)
  const [isLoadingView, setIsLoadingView] = React.useState(false)

  const [editQuestao, setEditQuestao] = React.useState<ViewQuestaoData | null>(null)
  const [isLoadingEdit, setIsLoadingEdit] = React.useState(false)
  const [isSavingEdit, setIsSavingEdit] = React.useState(false)
  const [editSaved, setEditSaved] = React.useState(false)
  const [editError, setEditError] = React.useState<string | null>(null)
  const [editFrentes, setEditFrentes] = React.useState<Array<{ id: string; nome: string }>>([])
  const [editModulos, setEditModulos] = React.useState<Array<{ id: string; nome: string; numeroModulo?: number | null }>>([])
  const [editTagInput, setEditTagInput] = React.useState("")

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [isDeletingBulk, setIsDeletingBulk] = React.useState(false)

  const [bulkTagsOpen, setBulkTagsOpen] = React.useState(false)
  const [bulkTagsAction, setBulkTagsAction] = React.useState<"add" | "remove">("add")
  const [bulkTagsInput, setBulkTagsInput] = React.useState("")
  const [bulkTagsList, setBulkTagsList] = React.useState<string[]>([])
  const [isApplyingBulkTags, setIsApplyingBulkTags] = React.useState(false)

  // Catalog data (disciplinas and modulos from API)
  const [apiDisciplinas, setApiDisciplinas] = React.useState<ApiDisciplina[]>([])
  // Review state
  const [reviewJob, setReviewJob] = React.useState<ImportacaoJobFull | null>(null)
  const [isLoadingReview, setIsLoadingReview] = React.useState(false)
  const [reviewDisciplina, setReviewDisciplina] = React.useState("")
  const [reviewDisciplinaId, setReviewDisciplinaId] = React.useState("")
  const [reviewFrenteId, setReviewFrenteId] = React.useState("")
  const [reviewModuloId, setReviewModuloId] = React.useState("")
  const [reviewFrentes, setReviewFrentes] = React.useState<Array<{ id: string; nome: string }>>([])
  const [reviewModulos, setReviewModulos] = React.useState<Array<{ id: string; nome: string; numeroModulo?: number | null }>>([])
  const [reviewTags, setReviewTags] = React.useState<string[]>([])
  const [reviewTagInput, setReviewTagInput] = React.useState("")
  const [questionTagInput, setQuestionTagInput] = React.useState("")
  const [reviewQuestoes, setReviewQuestoes] = React.useState<QuestaoParseada[]>([])
  const [isSavingReview, setIsSavingReview] = React.useState(false)
  const [isPublishing, setIsPublishing] = React.useState(false)
  const [reviewSaved, setReviewSaved] = React.useState(false)
  const [reviewPage, setReviewPage] = React.useState(0)
  const [reviewCriarLista, setReviewCriarLista] = React.useState(true)
  const [reviewTituloLista, setReviewTituloLista] = React.useState("")

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const fetchQuestoes = React.useCallback(async (newCursor?: string | null) => {
    setIsLoading(true)
    try {
      const searchParams = new URLSearchParams()
      if (search) searchParams.set("search", search)
      if (filterDisciplinaId) searchParams.set("disciplinaId", filterDisciplinaId)
      else if (filterDisciplina) searchParams.set("disciplina", filterDisciplina)
      if (filterFrenteId) searchParams.set("frenteId", filterFrenteId)
      if (filterModuloId) searchParams.set("moduloId", filterModuloId)
      if (filterDificuldade) searchParams.set("dificuldade", filterDificuldade)
      if (filterAreaConhecimento) searchParams.set("areaConhecimento", filterAreaConhecimento)
      if (newCursor) searchParams.set("cursor", newCursor)
      searchParams.set("limit", "20")

      const json = await apiClient.get<{ data: typeof questoes; nextCursor?: string | null }>(`/api/questoes?${searchParams}`)
      setQuestoes(json.data ?? [])
      setSelectedIds(new Set())
      setHasMore(!!json.nextCursor)
      setCursor(json.nextCursor ?? null)
    } catch {
      setQuestoes([])
    } finally {
      setIsLoading(false)
    }
  }, [search, filterDisciplina, filterDisciplinaId, filterFrenteId, filterModuloId, filterDificuldade, filterAreaConhecimento])

  const fetchImportacoes = React.useCallback(async () => {
    setIsLoadingImportacoes(true)
    try {
      const json = await apiClient.get<{ data: typeof importacoes }>("/api/importacao")
      setImportacoes(json.data ?? [])
    } catch {
      setImportacoes([])
    } finally {
      setIsLoadingImportacoes(false)
    }
  }, [])

  React.useEffect(() => {
    fetchQuestoes()
  }, [fetchQuestoes])

  React.useEffect(() => {
    apiClient.get<{ data: ApiDisciplina[] }>("/api/curso/disciplinas")
      .then((json) => setApiDisciplinas(json.data ?? []))
      .catch((err) => console.warn("[BancoQuestoes] Erro ao carregar disciplinas:", err))
  }, [])

  React.useEffect(() => {
    if (!uploadDisciplinaId) {
      setUploadFrentes([])
      setUploadFrenteId("")
      setUploadModulos([])
      setUploadModuloId("")
      return
    }
    apiClient.get<{ data: Array<{ frenteId: string; frenteNome: string }> }>(`/api/curso/estrutura?disciplinaId=${uploadDisciplinaId}`)
      .then((json) => setUploadFrentes((json.data ?? []).map((f) => ({ id: f.frenteId, nome: f.frenteNome }))))
      .catch(() => setUploadFrentes([]))
  }, [uploadDisciplinaId])

  React.useEffect(() => {
    if (!uploadFrenteId) {
      setUploadModulos([])
      setUploadModuloId("")
      return
    }
    apiClient.get<{ data: Array<{ moduloId: string; moduloNome: string; numeroModulo: number | null }> }>(`/api/curso/estrutura?frenteId=${uploadFrenteId}`)
      .then((json) => setUploadModulos((json.data ?? []).map((m) => ({ id: m.moduloId, nome: m.moduloNome, numeroModulo: m.numeroModulo }))))
      .catch(() => setUploadModulos([]))
  }, [uploadFrenteId])

  React.useEffect(() => {
    if (!filterDisciplinaId) {
      setFilterFrentes([])
      setFilterFrenteId("")
      setFilterModulos([])
      setFilterModuloId("")
      return
    }
    apiClient.get<{ data: Array<{ frenteId: string; frenteNome: string }> }>(`/api/curso/estrutura?disciplinaId=${filterDisciplinaId}`)
      .then((json) => setFilterFrentes((json.data ?? []).map((f) => ({ id: f.frenteId, nome: f.frenteNome }))))
      .catch(() => setFilterFrentes([]))
  }, [filterDisciplinaId])

  React.useEffect(() => {
    if (!filterFrenteId) {
      setFilterModulos([])
      setFilterModuloId("")
      return
    }
    apiClient.get<{ data: Array<{ moduloId: string; moduloNome: string; numeroModulo: number | null }> }>(`/api/curso/estrutura?frenteId=${filterFrenteId}`)
      .then((json) => setFilterModulos((json.data ?? []).map((m) => ({ id: m.moduloId, nome: m.moduloNome, numeroModulo: m.numeroModulo }))))
      .catch(() => setFilterModulos([]))
  }, [filterFrenteId])

  React.useEffect(() => {
    const disciplinaId = editQuestao?.disciplinaId
    if (!disciplinaId) {
      setEditFrentes([])
      setEditModulos([])
      return
    }
    apiClient.get<{ data: Array<{ frenteId: string; frenteNome: string }> }>(`/api/curso/estrutura?disciplinaId=${disciplinaId}`)
      .then((json) => setEditFrentes((json.data ?? []).map((f) => ({ id: f.frenteId, nome: f.frenteNome }))))
      .catch(() => setEditFrentes([]))
  }, [editQuestao?.disciplinaId])

  React.useEffect(() => {
    const frenteId = editQuestao?.frenteId
    if (!frenteId) {
      setEditModulos([])
      return
    }
    apiClient.get<{ data: Array<{ moduloId: string; moduloNome: string; numeroModulo: number | null }> }>(`/api/curso/estrutura?frenteId=${frenteId}`)
      .then((json) => setEditModulos((json.data ?? []).map((m) => ({ id: m.moduloId, nome: m.moduloNome, numeroModulo: m.numeroModulo }))))
      .catch(() => setEditModulos([]))
  }, [editQuestao?.frenteId])

  const reviewDisciplinaIdRef = React.useRef(reviewDisciplinaId)
  React.useEffect(() => {
    const isUserChange = reviewDisciplinaIdRef.current !== reviewDisciplinaId
    reviewDisciplinaIdRef.current = reviewDisciplinaId
    if (!reviewDisciplinaId) {
      setReviewFrentes([])
      if (isUserChange) { setReviewFrenteId(""); setReviewModulos([]); setReviewModuloId("") }
      return
    }
    if (!isUserChange) return
    apiClient.get<{ data: Array<{ frenteId: string; frenteNome: string }> }>(`/api/curso/estrutura?disciplinaId=${reviewDisciplinaId}`)
      .then((json) => setReviewFrentes((json.data ?? []).map((f) => ({ id: f.frenteId, nome: f.frenteNome }))))
      .catch(() => setReviewFrentes([]))
    setReviewFrenteId("")
    setReviewModulos([])
    setReviewModuloId("")
  }, [reviewDisciplinaId])

  const reviewFrenteIdRef = React.useRef(reviewFrenteId)
  React.useEffect(() => {
    const isUserChange = reviewFrenteIdRef.current !== reviewFrenteId
    reviewFrenteIdRef.current = reviewFrenteId
    if (!reviewFrenteId) {
      setReviewModulos([])
      if (isUserChange) setReviewModuloId("")
      return
    }
    if (!isUserChange) return
    apiClient.get<{ data: Array<{ moduloId: string; moduloNome: string; numeroModulo: number | null }> }>(`/api/curso/estrutura?frenteId=${reviewFrenteId}`)
      .then((json) => setReviewModulos((json.data ?? []).map((m) => ({ id: m.moduloId, nome: m.moduloNome, numeroModulo: m.numeroModulo }))))
      .catch(() => setReviewModulos([]))
    setReviewModuloId("")
  }, [reviewFrenteId])

  React.useEffect(() => {
    if (activeTab === "importar") {
      fetchImportacoes()
    }
  }, [activeTab, fetchImportacoes])

  async function handleUpload(file: File) {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/importacao", {
        method: "POST",
        headers: { "x-tenant-slug": tenantSlug },
        body: formData,
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || "Erro ao importar")
      }

      const json = await res.json()
      const jobId = json.data?.id

      const hasMetadata = uploadDisciplina || uploadDisciplinaId || uploadInstituicao || uploadAno || uploadDificuldade || uploadTags.length > 0
      if (jobId && hasMetadata) {
        const patchBody: Record<string, unknown> = {}
        if (uploadDisciplina) patchBody.disciplina = uploadDisciplina
        if (uploadDisciplinaId) patchBody.disciplinaId = uploadDisciplinaId
        if (uploadFrenteId) patchBody.frenteId = uploadFrenteId
        if (uploadModuloId) patchBody.moduloId = uploadModuloId
        if (uploadInstituicao) patchBody.instituicaoPadrao = uploadInstituicao
        if (uploadAno) patchBody.anoPadrao = Number(uploadAno)
        if (uploadDificuldade && uploadDificuldade !== "all") patchBody.dificuldadePadrao = uploadDificuldade
        if (uploadTags.length > 0) patchBody.tagsPadrao = uploadTags

        await apiClient.patch(`/api/importacao/${jobId}`, patchBody)
      }

      setUploadDialogOpen(false)
      setUploadDisciplina("")
      setUploadDisciplinaId("")
      setUploadFrenteId("")
      setUploadModuloId("")
      setUploadInstituicao("")
      setUploadAno("")
      setUploadDificuldade("")
      setUploadTags([])
      setUploadTagInput("")
      if (fileInputRef.current) fileInputRef.current.value = ""
      fetchImportacoes()
    } catch (err) {
      console.error("[BancoQuestoes] Upload error:", err)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setIsDeleting(true)
    try {
      await apiClient.delete(`/api/questoes/${deleteId}`)
      setDeleteId(null)
      fetchQuestoes()
    } catch (err) {
      console.error("[BancoQuestoes] Delete error:", err)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleDeleteImportacao() {
    if (!deleteImportacaoId) return
    setIsDeletingImportacao(true)
    try {
      await apiClient.delete(`/api/importacao/${deleteImportacaoId}`)
      setDeleteImportacaoId(null)
      fetchImportacoes()
    } catch (err) {
      console.error("[BancoQuestoes] Delete importacao error:", err)
    } finally {
      setIsDeletingImportacao(false)
    }
  }

  function resolveViewImageUrl(storagePath: string, importacaoJobId: string | null): string {
    if (storagePath.startsWith("pending:") && importacaoJobId) {
      const key = storagePath.replace("pending:", "")
      return `/api/importacao/${importacaoJobId}/imagem?key=${encodeURIComponent(key)}`
    }
    if (storagePath.startsWith("importacoes/")) {
      return `/api/questoes/imagem?path=${encodeURIComponent(storagePath)}`
    }
    return storagePath
  }

  function toggleSelectAll() {
    if (selectedIds.size === questoes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(questoes.map((q) => q.id)))
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    setIsDeletingBulk(true)
    try {
      const promises = Array.from(selectedIds).map((id) =>
        apiClient.delete(`/api/questoes/${id}`),
      )
      await Promise.all(promises)
      setSelectedIds(new Set())
      setDeleteId(null)
      fetchQuestoes()
    } catch (err) {
      console.error("[BancoQuestoes] Bulk delete error:", err)
    } finally {
      setIsDeletingBulk(false)
    }
  }

  async function handleBulkTags() {
    if (selectedIds.size === 0 || bulkTagsList.length === 0) return
    setIsApplyingBulkTags(true)
    try {
      await apiClient.post("/api/questoes/bulk-tags", {
        ids: Array.from(selectedIds),
        action: bulkTagsAction,
        tags: bulkTagsList,
      })
      setBulkTagsOpen(false)
      setBulkTagsList([])
      setBulkTagsInput("")
      setSelectedIds(new Set())
      fetchQuestoes()
    } catch (err) {
      console.error("[BancoQuestoes] Bulk tags error:", err)
    } finally {
      setIsApplyingBulkTags(false)
    }
  }

  async function handleViewQuestao(id: string) {
    setIsLoadingView(true)
    try {
      const json = await apiClient.get<{ data: typeof viewQuestao }>(`/api/questoes/${id}`)
      setViewQuestao(json.data)
    } catch (err) {
      console.error("[BancoQuestoes] View error:", err)
    } finally {
      setIsLoadingView(false)
    }
  }

  async function handleEditQuestao(id: string) {
    setIsLoadingEdit(true)
    setEditError(null)
    setEditSaved(false)
    try {
      const json = await apiClient.get<{ data: ViewQuestaoData }>(`/api/questoes/${id}`)
      setEditQuestao(json.data)
      setEditTagInput("")
    } catch (err) {
      console.error("[BancoQuestoes] Edit load error:", err)
      setEditError("Não foi possível carregar a questão para edição.")
    } finally {
      setIsLoadingEdit(false)
    }
  }

  function closeEditQuestao() {
    setEditQuestao(null)
    setEditFrentes([])
    setEditModulos([])
    setEditTagInput("")
    setEditError(null)
    setEditSaved(false)
  }

  function updateEditField<K extends keyof ViewQuestaoData>(
    field: K,
    value: ViewQuestaoData[K],
  ) {
    setEditQuestao((prev) => prev ? { ...prev, [field]: value } : prev)
    setEditSaved(false)
    setEditError(null)
  }

  function updateEditTextBlocks(
    field: "textoBase" | "fonte" | "enunciado" | "resolucaoTexto",
    text: string,
  ) {
    setEditQuestao((prev) => {
      if (!prev) return prev
      const blocks = replaceParagraphBlocks(prev[field], text)
      return {
        ...prev,
        [field]: field === "enunciado" ? blocks : blocks.length > 0 ? blocks : null,
      }
    })
    setEditSaved(false)
    setEditError(null)
  }

  function updateEditAlternativaText(idx: number, texto: string) {
    setEditQuestao((prev) => {
      if (!prev) return prev
      const alternativas = [...prev.alternativas].sort((a, b) => a.ordem - b.ordem)
      alternativas[idx] = { ...alternativas[idx], texto }
      return { ...prev, alternativas }
    })
    setEditSaved(false)
    setEditError(null)
  }

  function addEditAlternativa() {
    setEditQuestao((prev) => {
      if (!prev) return prev
      const usedLetras = new Set(prev.alternativas.map((a) => a.letra.toLowerCase()))
      const nextLetra = (["a", "b", "c", "d", "e"] as const).find((l) => !usedLetras.has(l))
      if (!nextLetra) return prev
      return {
        ...prev,
        alternativas: [
          ...prev.alternativas,
          {
            letra: nextLetra,
            texto: "",
            imagemPath: null,
            correta: false,
            ordem: prev.alternativas.length,
          },
        ],
      }
    })
    setEditSaved(false)
    setEditError(null)
  }

  function removeEditAlternativa(idx: number) {
    setEditQuestao((prev) => {
      if (!prev || prev.alternativas.length <= 2) return prev
      const alternativas = [...prev.alternativas]
        .sort((a, b) => a.ordem - b.ordem)
        .filter((_, i) => i !== idx)
        .map((alt, ordem) => ({ ...alt, ordem }))
      const hasGabarito = alternativas.some(
        (alt) => alt.letra.toUpperCase() === prev.gabarito,
      )
      return {
        ...prev,
        alternativas,
        gabarito: hasGabarito ? prev.gabarito : alternativas[0].letra.toUpperCase(),
      }
    })
    setEditSaved(false)
    setEditError(null)
  }

  function addEditTag() {
    const trimmed = editTagInput.trim()
    if (!trimmed || editQuestao?.tags.includes(trimmed)) {
      setEditTagInput("")
      return
    }
    updateEditField("tags", [...(editQuestao?.tags ?? []), trimmed])
    setEditTagInput("")
  }

  function validateEditQuestao(questao: ViewQuestaoData): string | null {
    if (!questao.enunciado || questao.enunciado.length === 0) {
      return "Informe o enunciado da questão."
    }
    if (questao.alternativas.length < 2) {
      return "A questão precisa ter pelo menos 2 alternativas."
    }
    if (!questao.alternativas.some((alt) => alt.letra.toUpperCase() === questao.gabarito)) {
      return "O gabarito precisa corresponder a uma alternativa existente."
    }
    if (!isValidOptionalUrl(questao.resolucaoVideoUrl)) {
      return "Informe uma URL válida para o vídeo de resolução ou deixe o campo vazio."
    }
    return null
  }

  async function handleSaveEditQuestao() {
    if (!editQuestao) return

    const validationError = validateEditQuestao(editQuestao)
    if (validationError) {
      setEditError(validationError)
      return
    }

    setIsSavingEdit(true)
    setEditError(null)
    try {
      const json = await apiClient.patch<{ data: ViewQuestaoData }>(`/api/questoes/${editQuestao.id}`, {
        numeroOriginal: editQuestao.numeroOriginal,
        instituicao: editQuestao.instituicao,
        ano: editQuestao.ano,
        disciplina: editQuestao.disciplina,
        disciplinaId: editQuestao.disciplinaId,
        frenteId: editQuestao.frenteId,
        moduloId: editQuestao.moduloId,
        dificuldade: editQuestao.dificuldade,
        textoBase: editQuestao.textoBase,
        fonte: editQuestao.fonte,
        enunciado: editQuestao.enunciado,
        gabarito: editQuestao.gabarito,
        resolucaoTexto: editQuestao.resolucaoTexto,
        resolucaoVideoUrl: editQuestao.resolucaoVideoUrl,
        tags: editQuestao.tags,
        areaConhecimento: editQuestao.areaConhecimento,
        competenciasEnem: editQuestao.competenciasEnem,
        habilidadesEnem: editQuestao.habilidadesEnem,
        alternativas: [...editQuestao.alternativas]
          .sort((a, b) => a.ordem - b.ordem)
          .map((alt) => ({
            letra: alt.letra.toLowerCase(),
            texto: alt.texto,
            imagemPath: alt.imagemPath,
          })),
      })
      setEditQuestao(json.data)
      setEditSaved(true)
      fetchQuestoes()
      if (viewQuestao?.id === editQuestao.id) {
        setViewQuestao(json.data)
      }
    } catch (err) {
      console.error("[BancoQuestoes] Save edit error:", err)
      setEditError("Não foi possível salvar a questão. Verifique os campos e tente novamente.")
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function openReview(jobId: string) {
    setIsLoadingReview(true)
    try {
      const json = await apiClient.get<{ data: ImportacaoJobFull }>(`/api/importacao/${jobId}`)
      const job = json.data
      setReviewJob(job)
      setReviewDisciplina(job.disciplina ?? "")
      setReviewCriarLista(true)
      setReviewTituloLista(buildDefaultListaTitle(job.disciplina))

      if (job.disciplinaId) {
        setReviewDisciplinaId(job.disciplinaId)
        try {
          const fRes = await apiClient.get<{ data: Array<{ frenteId: string; frenteNome: string }> }>(`/api/curso/estrutura?disciplinaId=${job.disciplinaId}`)
          setReviewFrentes((fRes.data ?? []).map((f) => ({ id: f.frenteId, nome: f.frenteNome })))
        } catch { setReviewFrentes([]) }

        if (job.frenteId) {
          setReviewFrenteId(job.frenteId)
          try {
            const mRes = await apiClient.get<{ data: Array<{ moduloId: string; moduloNome: string; numeroModulo: number | null }> }>(`/api/curso/estrutura?frenteId=${job.frenteId}`)
            setReviewModulos((mRes.data ?? []).map((m) => ({ id: m.moduloId, nome: m.moduloNome, numeroModulo: m.numeroModulo })))
          } catch { setReviewModulos([]) }
        }
        if (job.moduloId) setReviewModuloId(job.moduloId)
      }
      const questoes = (job.questoesJson ?? []).map((q) => ({
        ...q,
        disciplina: q.disciplina || job.disciplina || null,
        instituicao: q.instituicao ?? job.instituicaoPadrao ?? null,
        ano: q.ano ?? job.anoPadrao ?? null,
        dificuldade: q.dificuldade ?? (job.dificuldadePadrao as QuestaoParseada["dificuldade"]) ?? null,
        tags: (q.tags && q.tags.length > 0) ? q.tags : (job.tagsPadrao ?? []),
      }))
      const commonTags = questoes.length > 0
        ? questoes.reduce<string[]>((acc, q) => acc.filter((t) => (q.tags ?? []).includes(t)), questoes[0].tags ?? [])
        : (job.tagsPadrao ?? [])
      setReviewTags(commonTags)
      setReviewQuestoes(questoes)
      setReviewSaved(false)
      setReviewPage(0)
    } catch (err) {
      console.error("[BancoQuestoes] Review error:", err)
    } finally {
      setIsLoadingReview(false)
    }
  }

  function closeReview() {
    setReviewJob(null)
    setReviewQuestoes([])
    setReviewDisciplina("")
    setReviewDisciplinaId("")
    setReviewFrenteId("")
    setReviewModuloId("")
    setReviewFrentes([])
    setReviewModulos([])
    setReviewTags([])
    setReviewTagInput("")
    setQuestionTagInput("")
    setReviewSaved(false)
    setReviewPage(0)
    setReviewCriarLista(true)
    setReviewTituloLista("")
  }

  function resolveImageUrl(storagePath: string, jobId: string): string {
    if (storagePath.startsWith("pending:")) {
      const key = storagePath.replace("pending:", "")
      return `/api/importacao/${jobId}/imagem?key=${encodeURIComponent(key)}`
    }
    return storagePath
  }

  function updateQuestaoGabarito(idx: number, gabarito: string) {
    setReviewQuestoes((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], gabarito: gabarito as QuestaoParseada["gabarito"] }
      return next
    })
    setReviewSaved(false)
  }

  function updateQuestaoDificuldade(idx: number, dificuldade: string) {
    setReviewQuestoes((prev) => {
      const next = [...prev]
      next[idx] = {
        ...next[idx],
        dificuldade: dificuldade === "none" ? null : dificuldade as QuestaoParseada["dificuldade"],
      }
      return next
    })
    setReviewSaved(false)
  }

  function removeQuestao(idx: number) {
    setReviewQuestoes((prev) => prev.filter((_, i) => i !== idx))
    setReviewSaved(false)
  }


  function updateAlternativaTexto(qIdx: number, altIdx: number, texto: string) {
    setReviewQuestoes((prev) => {
      const next = [...prev]
      const alts = [...next[qIdx].alternativas]
      alts[altIdx] = { ...alts[altIdx], texto }
      next[qIdx] = { ...next[qIdx], alternativas: alts }
      return next
    })
    setReviewSaved(false)
  }

  function removeAlternativa(qIdx: number, altIdx: number) {
    setReviewQuestoes((prev) => {
      const next = [...prev]
      next[qIdx] = {
        ...next[qIdx],
        alternativas: next[qIdx].alternativas.filter((_, i) => i !== altIdx),
      }
      return next
    })
    setReviewSaved(false)
  }

  function addAlternativa(qIdx: number) {
    setReviewQuestoes((prev) => {
      const next = [...prev]
      const existing = next[qIdx].alternativas
      const usedLetras = new Set(existing.map((a) => a.letra))
      const nextLetra = (["a", "b", "c", "d", "e"] as const).find((l) => !usedLetras.has(l))
      if (!nextLetra) return prev
      next[qIdx] = {
        ...next[qIdx],
        alternativas: [...existing, { letra: nextLetra, texto: "" }],
      }
      return next
    })
    setReviewSaved(false)
  }

  function updateQuestaoField<K extends keyof QuestaoParseada>(
    idx: number,
    field: K,
    value: QuestaoParseada[K],
  ) {
    setReviewQuestoes((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
    setReviewSaved(false)
  }

  function updateQuestaoBlocks(idx: number, field: string, blocks: Array<Record<string, unknown>>) {
    setReviewQuestoes((prev) => {
      const next = [...prev]
      const hasContent = blocks.length > 0
      if (field === "enunciado") {
        next[idx] = { ...next[idx], [field]: blocks }
      } else if (field === "fonte") {
        next[idx] = { ...next[idx], [field]: hasContent ? blocks : null }
      } else {
        next[idx] = { ...next[idx], [field]: hasContent ? blocks : [] }
      }
      return next
    })
    setReviewSaved(false)
  }

  function buildReviewPatchBody() {
    return {
      disciplina: reviewDisciplina || null,
      disciplinaId: reviewDisciplinaId || null,
      frenteId: reviewFrenteId || null,
      moduloId: reviewModuloId || null,
      questoesJson: reviewQuestoes,
    }
  }

  async function handleSaveReview() {
    if (!reviewJob) return
    setIsSavingReview(true)
    try {
      await apiClient.patch(`/api/importacao/${reviewJob.id}`, buildReviewPatchBody())
      setReviewSaved(true)
      fetchImportacoes()
    } catch (err) {
      console.error("[BancoQuestoes] Save review error:", err)
    } finally {
      setIsSavingReview(false)
    }
  }

  async function handlePublicar() {
    if (!reviewJob) return
    setIsPublishing(true)
    try {
      if (!reviewSaved) {
        await apiClient.patch(`/api/importacao/${reviewJob.id}`, buildReviewPatchBody())
      }

      await apiClient.post(`/api/importacao/${reviewJob.id}/publicar`, {
        criarLista: reviewCriarLista,
        tituloLista: reviewCriarLista
          ? reviewTituloLista.trim() || buildDefaultListaTitle(reviewDisciplina)
          : undefined,
      })
      closeReview()
      fetchImportacoes()
      fetchQuestoes()
    } catch (err) {
      console.error("[BancoQuestoes] Publicar error:", err)
    } finally {
      setIsPublishing(false)
    }
  }

  function getWarningsForQuestao(numero: number): ParseWarning[] {
    if (!reviewJob) return []
    return reviewJob.warnings.filter((w) => w.questao === numero)
  }

  const dificuldadeColor = (d: string | null) => {
    switch (d) {
      case "facil": return "success"
      case "medio": return "warning"
      case "dificil": return "destructive"
      default: return "secondary"
    }
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "processando": return "warning"
      case "revisao": return "info"
      case "publicado": return "success"
      case "erro": return "destructive"
      default: return "secondary"
    }
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case "processando": return "Processando"
      case "revisao": return "Em Revisão"
      case "publicado": return "Publicado"
      case "erro": return "Erro"
      default: return s
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Banco de Questões
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie suas questões e importe novos conteúdos via Word
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="banco" className="flex-1 sm:flex-none">
            <FileText className="mr-2 h-4 w-4" />
            Questões
          </TabsTrigger>
          <TabsTrigger value="importar" className="flex-1 sm:flex-none">
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Banco ── */}
        <TabsContent value="banco">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Questões Cadastradas</CardTitle>
                  <CardDescription>
                    {questoes.length} questão(ões) encontrada(s)
                  </CardDescription>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por enunciado, instituição..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Select
                  value={filterDisciplinaId || "all"}
                  onValueChange={(val) => {
                    if (val === "all") {
                      setFilterDisciplinaId("")
                      setFilterDisciplina("")
                    } else {
                      setFilterDisciplinaId(val)
                      const disc = apiDisciplinas.find((d) => d.id === val)
                      setFilterDisciplina(disc?.name ?? "")
                    }
                    setFilterFrenteId("")
                    setFilterModuloId("")
                  }}
                >
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="Disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {apiDisciplinas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filterDisciplinaId && filterFrentes.length > 0 && (
                  <Select
                    value={filterFrenteId || "all"}
                    onValueChange={(val) => {
                      setFilterFrenteId(val === "all" ? "" : val)
                      setFilterModuloId("")
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Frente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {filterFrentes.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filterFrenteId && filterModulos.length > 0 && (
                  <Select
                    value={filterModuloId || "all"}
                    onValueChange={(val) => setFilterModuloId(val === "all" ? "" : val)}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Módulo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {filterModulos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.numeroModulo != null ? `${m.numeroModulo}. ` : ""}{m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={filterDificuldade} onValueChange={setFilterDificuldade}>
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue placeholder="Dificuldade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="facil">Fácil</SelectItem>
                    <SelectItem value="medio">Médio</SelectItem>
                    <SelectItem value="dificil">Difícil</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={filterAreaConhecimento || "all"}
                  onValueChange={(val) => setFilterAreaConhecimento(val === "all" ? "" : val)}
                >
                  <SelectTrigger className="w-full sm:w-52">
                    <SelectValue placeholder="Área ENEM" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Áreas</SelectItem>
                    {AREAS_CONHECIMENTO.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : questoes.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <FileText className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>Nenhuma questão encontrada</EmptyTitle>
                    <EmptyDescription>
                      Importe questões via Word ou crie manualmente.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5 mb-4">
                      <span className="text-sm font-medium">
                        {selectedIds.size} questão(ões) selecionada(s)
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer text-muted-foreground"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          Limpar seleção
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => setBulkTagsOpen(true)}
                        >
                          <Tag className="mr-2 h-3.5 w-3.5" />
                          Gerenciar Tags
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => setDeleteId("__bulk__")}
                          disabled={isDeletingBulk}
                        >
                          {isDeletingBulk ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                          )}
                          Excluir selecionadas
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto -mx-6">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10 pl-6">
                            <Checkbox
                              checked={questoes.length > 0 && selectedIds.size === questoes.length}
                              onCheckedChange={toggleSelectAll}
                              aria-label="Selecionar todas"
                              className="cursor-pointer"
                            />
                          </TableHead>
                          <TableHead className="w-28">Código</TableHead>
                          <TableHead>Disciplina</TableHead>
                          <TableHead className="hidden md:table-cell">Instituição</TableHead>
                          <TableHead className="hidden md:table-cell">Ano</TableHead>
                          <TableHead>Dificuldade</TableHead>
                          <TableHead className="w-24 pr-6">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {questoes.map((q) => (
                          <TableRow key={q.id} data-state={selectedIds.has(q.id) ? "selected" : undefined}>
                            <TableCell className="pl-6">
                              <Checkbox
                                checked={selectedIds.has(q.id)}
                                onCheckedChange={() => toggleSelect(q.id)}
                                aria-label={`Selecionar questão ${q.numeroOriginal ?? q.id}`}
                                className="cursor-pointer"
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm font-medium">
                              {q.codigo ?? "—"}
                            </TableCell>
                            <TableCell>{q.disciplina ?? "—"}</TableCell>
                            <TableCell className="hidden md:table-cell">
                              {q.instituicao ?? "—"}
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {q.ano ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={dificuldadeColor(q.dificuldade) as "success" | "warning" | "destructive" | "secondary"}>
                                {q.dificuldade ?? "N/D"}
                              </Badge>
                            </TableCell>
                            <TableCell className="pr-6">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer"
                                  title="Visualizar"
                                  onClick={() => handleViewQuestao(q.id)}
                                  disabled={isLoadingView}
                                >
                                  {isLoadingView ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer"
                                  title="Editar"
                                  onClick={() => handleEditQuestao(q.id)}
                                  disabled={isLoadingEdit}
                                >
                                  {isLoadingEdit ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Pencil className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 cursor-pointer"
                                  onClick={() => setDeleteId(q.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {hasMore && (
                    <div className="flex justify-center pt-4">
                      <Button
                        variant="outline"
                        onClick={() => fetchQuestoes(cursor)}
                        className="cursor-pointer"
                      >
                        Carregar mais
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Importar ── */}
        <TabsContent value="importar">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Importar Questões</CardTitle>
                  <CardDescription>
                    Envie um arquivo Word (.docx) com questões formatadas
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    asChild
                    className="cursor-pointer"
                  >
                    <a href="/api/importacao/template" download="modelo-importacao-questoes.docx">
                      <Download className="mr-2 h-4 w-4" />
                      Baixar Modelo
                    </a>
                  </Button>
                  <Button
                    onClick={() => setUploadDialogOpen(true)}
                    className="cursor-pointer"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Enviar Arquivo
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {isLoadingImportacoes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : importacoes.length === 0 ? (
                <Empty>
                  <EmptyMedia variant="icon">
                    <Upload className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyHeader>
                    <EmptyTitle>Nenhuma importação</EmptyTitle>
                    <EmptyDescription>
                      Envie seu primeiro arquivo Word para começar.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="space-y-3">
                  {importacoes.map((job) => (
                    <div
                      key={job.id}
                      className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium text-sm">
                            {job.originalFilename}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{job.questoesExtraidas} questões</span>
                          {job.disciplina && <span>· {job.disciplina}</span>}
                          <span>
                            · {new Date(job.createdAt).toLocaleDateString("pt-BR")}
                          </span>
                        </div>

                        {/* Warning popover */}
                        {job.warnings.length > 0 && (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 cursor-pointer w-fit transition-colors">
                                <AlertTriangle className="h-3 w-3" />
                                {job.warnings.length} aviso(s)
                              </button>
                            </PopoverTrigger>
                            <PopoverContent
                              align="start"
                              className="w-80 p-0 sm:w-96"
                            >
                              <div className="border-b px-4 py-3">
                                <p className="text-sm font-medium">
                                  Avisos da Importação
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Problemas encontrados ao extrair questões
                                </p>
                              </div>
                              <ScrollArea className="max-h-60">
                                <div className="divide-y">
                                  {job.warnings.map((w, i) => (
                                    <div
                                      key={i}
                                      className="flex flex-col gap-0.5 px-4 py-2.5"
                                    >
                                      <div className="flex items-center gap-2">
                                        {w.questao != null && (
                                          <Badge
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0"
                                          >
                                            Q{w.questao}
                                          </Badge>
                                        )}
                                        <span className="text-xs font-mono text-muted-foreground">
                                          {w.code}
                                        </span>
                                      </div>
                                      <p className="text-xs text-foreground">
                                        {w.message}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusColor(job.status) as "warning" | "info" | "success" | "destructive" | "secondary"}>
                          {statusLabel(job.status)}
                        </Badge>
                        {job.status === "revisao" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReview(job.id)}
                            disabled={isLoadingReview}
                            className="cursor-pointer"
                          >
                            {isLoadingReview ? (
                              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            ) : (
                              <Pencil className="mr-1 h-3 w-3" />
                            )}
                            Revisar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteImportacaoId(job.id)}
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                          title="Excluir importação"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Importar Questões</DialogTitle>
            <DialogDescription>
              Selecione um arquivo Word (.docx) com questões formatadas. Se os campos abaixo não forem preenchidos, o sistema tentará extrair essas informações automaticamente do próprio documento.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] px-6 pb-4">
            <div className="flex flex-col gap-4 pt-2">
              {/* Disciplina */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="upload-disciplina" className="text-sm">Disciplina <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Select
                  value={uploadDisciplinaId || "__none__"}
                  onValueChange={(val) => {
                    if (val === "__none__") {
                      setUploadDisciplinaId("")
                      setUploadDisciplina("")
                    } else {
                      setUploadDisciplinaId(val)
                      const disc = apiDisciplinas.find((d) => d.id === val)
                      setUploadDisciplina(disc?.name ?? "")
                    }
                    setUploadFrenteId("")
                    setUploadModuloId("")
                  }}
                >
                  <SelectTrigger id="upload-disciplina">
                    <SelectValue placeholder="Selecione a disciplina..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhuma</SelectItem>
                    {apiDisciplinas.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frente (cascaded from disciplina) */}
              {uploadDisciplinaId && uploadFrentes.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="upload-frente" className="text-sm">Frente <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Select
                    value={uploadFrenteId || "__none__"}
                    onValueChange={(val) => {
                      setUploadFrenteId(val === "__none__" ? "" : val)
                      setUploadModuloId("")
                    }}
                  >
                    <SelectTrigger id="upload-frente">
                      <SelectValue placeholder="Selecione a frente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhuma</SelectItem>
                      {uploadFrentes.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Módulo (cascaded from frente) */}
              {uploadFrenteId && uploadModulos.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="upload-modulo" className="text-sm">Módulo <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Select
                    value={uploadModuloId || "__none__"}
                    onValueChange={(val) => setUploadModuloId(val === "__none__" ? "" : val)}
                  >
                    <SelectTrigger id="upload-modulo">
                      <SelectValue placeholder="Selecione o módulo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {uploadModulos.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.numeroModulo != null ? `${m.numeroModulo}. ` : ""}{m.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Instituição + Ano (side by side) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="upload-instituicao" className="text-sm">Instituição / Banca <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="upload-instituicao"
                    value={uploadInstituicao}
                    onChange={(e) => setUploadInstituicao(e.target.value)}
                    placeholder="Ex: ENEM, FUVEST..."
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="upload-ano" className="text-sm">Ano <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <Input
                    id="upload-ano"
                    type="number"
                    min={1990}
                    max={2099}
                    value={uploadAno}
                    onChange={(e) => setUploadAno(e.target.value)}
                    placeholder="Ex: 2024"
                  />
                </div>
              </div>

              {/* Dificuldade */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Dificuldade <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <div className="flex gap-2">
                  {DIFICULDADES.map((d) => {
                    const isSelected = uploadDificuldade === d.value
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setUploadDificuldade(isSelected ? "" : d.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                          isSelected
                            ? `${d.color} ring-2`
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-sm">Tags <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <p className="text-xs text-muted-foreground -mt-0.5">Tags são palavras-chave livres para classificar e filtrar as questões (ex: &quot;Cinemática&quot;, &quot;Termodinâmica&quot;, &quot;Prova Final&quot;). Use-as para organizar o banco de questões da forma que preferir.</p>
                {uploadTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {uploadTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setUploadTags((prev) => prev.filter((t) => t !== tag))}
                          className="cursor-pointer hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={uploadTagInput}
                    onChange={(e) => setUploadTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        const trimmed = uploadTagInput.trim()
                        if (trimmed && !uploadTags.includes(trimmed)) {
                          setUploadTags((prev) => [...prev, trimmed])
                          setUploadTagInput("")
                        }
                      }
                    }}
                    placeholder="Digitar tag e Enter..."
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 cursor-pointer"
                    onClick={() => {
                      const trimmed = uploadTagInput.trim()
                      if (trimmed && !uploadTags.includes(trimmed)) {
                        setUploadTags((prev) => [...prev, trimmed])
                        setUploadTagInput("")
                      }
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground/70">Como funciona?</p>
                <p>Campos deixados em branco serão preenchidos automaticamente com as informações encontradas no documento (ex: banca e ano entre parênteses no enunciado).</p>
                <p>Campos preenchidos aqui serão aplicados a <strong>todas</strong> as questões da importação, sobrescrevendo o que o sistema detectar.</p>
              </div>

              {/* File drop zone */}
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors hover:border-primary hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    Clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Apenas arquivos .docx (máx. 50MB)
                  </p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(file)
                }}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => setUploadDialogOpen(false)}
              disabled={isUploading}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            {isUploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Enviando...
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Review Dialog ── */}
      <Dialog open={!!reviewJob} onOpenChange={(open) => { if (!open) closeReview() }}>
        <DialogContent
          fullScreenMobile
          showCloseIcon={false}
          className="md:inset-0 md:w-full md:h-full md:max-w-none md:max-h-full md:translate-x-0 md:translate-y-0 md:rounded-none md:flex! md:flex-col md:gap-0 md:overflow-hidden p-0 gap-0"
        >
          <DialogTitle className="sr-only">Revisar Importação</DialogTitle>
          {/* Top bar */}
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b shrink-0 bg-background">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 cursor-pointer" onClick={closeReview}>
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold truncate">Revisar Importação</h2>
                <p className="text-xs text-muted-foreground truncate">{reviewJob?.originalFilename} — {reviewQuestoes.length} questão(ões)</p>
              </div>
            </div>
            {reviewQuestoes.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Button variant="outline" size="icon" className="h-8 w-8 cursor-pointer" disabled={reviewPage === 0} onClick={() => { setReviewPage((p) => p - 1); setQuestionTagInput("") }}>
                  <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
                <span className="text-sm font-medium tabular-nums whitespace-nowrap px-1">
                  {reviewPage + 1}/{reviewQuestoes.length}
                </span>
                {reviewQuestoes[reviewPage] && (
                  <Badge variant="outline" className="text-xs hidden sm:inline-flex">Nº {reviewQuestoes[reviewPage].numero}</Badge>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive" onClick={() => { removeQuestao(reviewPage); if (reviewPage >= reviewQuestoes.length - 1 && reviewPage > 0) setReviewPage((p) => p - 1) }} title="Remover questão">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 cursor-pointer" disabled={reviewPage >= reviewQuestoes.length - 1} onClick={() => { setReviewPage((p) => p + 1); setQuestionTagInput("") }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Split layout: main + sidebar */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
            {/* Main content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {reviewQuestoes.length > 0 && reviewQuestoes[reviewPage] ? (
                <ReviewQuestionContent
                  key={reviewPage}
                  questao={reviewQuestoes[reviewPage]}
                  questionIndex={reviewPage}
                  jobId={reviewJob?.id ?? ""}
                  warnings={getWarningsForQuestao(reviewQuestoes[reviewPage].numero)}
                  onUpdateBlocks={updateQuestaoBlocks}
                  onUpdateAlternativaTexto={updateAlternativaTexto}
                  onAddAlternativa={addAlternativa}
                  onRemoveAlternativa={removeAlternativa}
                  onUpdateField={updateQuestaoField as (qIdx: number, field: string, value: unknown) => void}
                  resolveImageSrc={(path) => resolveImageUrl(path, reviewJob?.id ?? "")}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-8 w-8 mb-2" />
                  <p className="text-sm">Nenhuma questão para revisar.</p>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="w-full shrink-0 border-t lg:border-t-0 lg:border-l lg:w-80 xl:w-96 overflow-y-auto bg-muted/5 dark:bg-muted/5">
              <div className="p-4 space-y-5">
                {/* Classificação */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Classificação</span>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="review-disciplina" className="text-xs">Disciplina *</Label>
                      <Select
                        value={reviewDisciplinaId}
                        onValueChange={(v) => {
                          const disc = apiDisciplinas.find((d) => d.id === v)
                          const nextDisciplina = disc?.name ?? ""
                          const currentDefaultTitle = buildDefaultListaTitle(reviewDisciplina)
                          setReviewDisciplinaId(v)
                          setReviewDisciplina(nextDisciplina)
                          if (!reviewTituloLista || reviewTituloLista === currentDefaultTitle) {
                            setReviewTituloLista(buildDefaultListaTitle(nextDisciplina))
                          }
                          setReviewFrenteId("")
                          setReviewModuloId("")
                          setReviewSaved(false)
                        }}
                      >
                        <SelectTrigger id="review-disciplina" className="w-full">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {apiDisciplinas.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {reviewFrentes.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="review-frente" className="text-xs">Frente</Label>
                        <Select
                          value={reviewFrenteId}
                          onValueChange={(v) => {
                            setReviewFrenteId(v)
                            setReviewModuloId("")
                            setReviewSaved(false)
                          }}
                        >
                          <SelectTrigger id="review-frente" className="w-full">
                            <SelectValue placeholder="Todas" />
                          </SelectTrigger>
                          <SelectContent>
                            {reviewFrentes.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {reviewModulos.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="review-modulo" className="text-xs">Módulo</Label>
                        <Select
                          value={reviewModuloId}
                          onValueChange={(v) => {
                            setReviewModuloId(v)
                            setReviewSaved(false)
                          }}
                        >
                          <SelectTrigger id="review-modulo" className="w-full">
                            <SelectValue placeholder="Todos" />
                          </SelectTrigger>
                          <SelectContent>
                            {reviewModulos.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.numeroModulo ? `${m.numeroModulo}. ` : ""}{m.nome}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>

                {/* Per-question sidebar items */}
                {reviewQuestoes.length > 0 && (() => {
                  const idx = reviewPage
                  const q = reviewQuestoes[idx]
                  if (!q) return null
                  return (
                    <>
                      {/* Gabarito */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gabarito</span>
                        <div className="flex gap-1.5">
                          {GABARITO_LETRAS.map((letra) => {
                            const isSelected = q.gabarito === letra
                            const hasAlt = q.alternativas.some(
                              (a) => a.letra.toUpperCase() === letra,
                            )
                            return (
                              <button
                                key={letra}
                                type="button"
                                disabled={!hasAlt}
                                onClick={() => updateQuestaoGabarito(idx, letra)}
                                className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                                  isSelected
                                    ? "bg-green-600 text-white shadow-sm"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {letra}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Dificuldade */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Dificuldade</span>
                        <div className="flex gap-2">
                          {DIFICULDADES.map((d) => {
                            const isSelected = q.dificuldade === d.value
                            return (
                              <button
                                key={d.value}
                                type="button"
                                onClick={() =>
                                  updateQuestaoDificuldade(idx, isSelected ? "none" : d.value)
                                }
                                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                                  isSelected
                                    ? `${d.color} ring-2`
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                              >
                                {d.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tags</span>

                        {/* Tags (lista) */}
                        <div className="space-y-1.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-medium text-muted-foreground cursor-help border-b border-dashed border-muted-foreground/40">Tags (lista)</span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-xs text-xs">
                              Tags adicionadas aqui são aplicadas a <strong>todas</strong> as questões desta lista. Para tags específicas de uma questão, use o campo &quot;Tags (questão)&quot; abaixo.
                            </TooltipContent>
                          </Tooltip>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {reviewTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewTags((prev) => prev.filter((t) => t !== tag))
                                    setReviewQuestoes((prev) => prev.map((qq) => ({
                                      ...qq,
                                      tags: (qq.tags ?? []).filter((t) => t !== tag),
                                    })))
                                    setReviewSaved(false)
                                  }}
                                  className="cursor-pointer hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <div className="flex gap-1.5 items-center w-full">
                              <Input
                                value={reviewTagInput}
                                onChange={(e) => setReviewTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault()
                                    const trimmed = reviewTagInput.trim()
                                    if (trimmed && !reviewTags.includes(trimmed)) {
                                      setReviewTags((prev) => [...prev, trimmed])
                                      setReviewQuestoes((prev) => prev.map((qq) => ({
                                        ...qq,
                                        tags: [...new Set([...(qq.tags ?? []), trimmed])],
                                      })))
                                      setReviewSaved(false)
                                    }
                                    setReviewTagInput("")
                                  }
                                }}
                                className="h-7 text-xs flex-1"
                                placeholder="Adicionar tag a todas..."
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 cursor-pointer"
                                onClick={() => {
                                  const trimmed = reviewTagInput.trim()
                                  if (trimmed && !reviewTags.includes(trimmed)) {
                                    setReviewTags((prev) => [...prev, trimmed])
                                    setReviewQuestoes((prev) => prev.map((qq) => ({
                                      ...qq,
                                      tags: [...new Set([...(qq.tags ?? []), trimmed])],
                                    })))
                                    setReviewSaved(false)
                                  }
                                  setReviewTagInput("")
                                }}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Tags (questão) */}
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-medium text-muted-foreground">Tags (questão)</span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {reviewTags.filter((t) => (q.tags ?? []).includes(t)).map((tag) => (
                              <span
                                key={`global-${tag}`}
                                className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-0.5 text-xs font-medium"
                                title="Tag aplicada a todas as questões (remover nas tags da lista)"
                              >
                                {tag}
                              </span>
                            ))}
                            {(q.tags ?? []).filter((t) => !reviewTags.includes(t)).map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                              >
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewQuestoes((prev) => {
                                      const next = [...prev]
                                      next[idx] = { ...next[idx], tags: (next[idx].tags ?? []).filter((t) => t !== tag) }
                                      return next
                                    })
                                    setReviewSaved(false)
                                  }}
                                  className="cursor-pointer hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                            <Input
                              value={questionTagInput}
                              onChange={(e) => setQuestionTagInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  const trimmed = questionTagInput.trim()
                                  if (trimmed && !(q.tags ?? []).includes(trimmed)) {
                                    setReviewQuestoes((prev) => {
                                      const next = [...prev]
                                      next[idx] = { ...next[idx], tags: [...(next[idx].tags ?? []), trimmed] }
                                      return next
                                    })
                                    setReviewSaved(false)
                                  }
                                  setQuestionTagInput("")
                                }
                              }}
                              className="h-7 text-xs w-full"
                              placeholder="Tag desta questão..."
                            />
                          </div>
                        </div>
                      </div>

                      {/* Classificação ENEM */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ENEM</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[260px]">
                              <p>Classifique a questão de acordo com a Matriz de Referência do ENEM. Selecione a área primeiro, depois competências e habilidades.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                          <Select
                            value={q.areaConhecimento ?? "__none__"}
                            onValueChange={(val) => {
                              const area = val === "__none__" ? null : val
                              updateQuestaoField(idx, "areaConhecimento", area)
                              updateQuestaoField(idx, "competenciasEnem", [])
                              updateQuestaoField(idx, "habilidadesEnem", [])
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Área de Conhecimento..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhuma</SelectItem>
                              {AREAS_CONHECIMENTO.map((a) => (
                                <SelectItem key={a} value={a}>{a}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {q.areaConhecimento && (() => {
                            const area = q.areaConhecimento as AreaConhecimento
                            const competencias = getCompetenciasPorArea(area)
                            const selectedComps = q.competenciasEnem ?? []
                            return (
                              <>
                                <div>
                                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Competências</span>
                                  <div className="flex flex-wrap gap-1.5 mt-1">
                                    {competencias.map((c) => {
                                      const isSelected = selectedComps.includes(c.codigo)
                                      return (
                                        <Tooltip key={c.codigo}>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                const next = isSelected
                                                  ? selectedComps.filter((x) => x !== c.codigo)
                                                  : [...selectedComps, c.codigo]
                                                updateQuestaoField(idx, "competenciasEnem", next)
                                                if (!isSelected) return
                                                const habsForComp = getHabilidadesPorCompetencia(area, c.codigo)
                                                const habCodes = new Set(habsForComp.map((hh) => hh.codigo))
                                                const filteredHabs = (q.habilidadesEnem ?? []).filter((hh) => !habCodes.has(hh))
                                                updateQuestaoField(idx, "habilidadesEnem", filteredHabs)
                                              }}
                                              className={`px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                                isSelected
                                                  ? "bg-violet-600 text-white ring-2 ring-violet-400"
                                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                                              }`}
                                            >
                                              {c.codigo}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="max-w-sm">
                                            <p className="text-xs"><strong>{c.codigo}:</strong> {c.descricao}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      )
                                    })}
                                  </div>
                                </div>

                                {selectedComps.length > 0 && (
                                  <div>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Habilidades</span>
                                    <div className="space-y-1.5 mt-1">
                                      {selectedComps.map((compCodigo) => {
                                        const habs = getHabilidadesPorCompetencia(area, compCodigo)
                                        if (habs.length === 0) return null
                                        const selectedHabs = q.habilidadesEnem ?? []
                                        return (
                                          <div key={compCodigo}>
                                            <span className="text-[10px] text-muted-foreground">{compCodigo}:</span>
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                              {habs.map((hh) => {
                                                const isHabSelected = selectedHabs.includes(hh.codigo)
                                                return (
                                                  <Tooltip key={hh.codigo}>
                                                    <TooltipTrigger asChild>
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          const next = isHabSelected
                                                            ? selectedHabs.filter((x) => x !== hh.codigo)
                                                            : [...selectedHabs, hh.codigo]
                                                          updateQuestaoField(idx, "habilidadesEnem", next)
                                                        }}
                                                        className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                                                          isHabSelected
                                                            ? "bg-violet-500 text-white ring-1 ring-violet-300"
                                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                        }`}
                                                      >
                                                        {hh.codigo}
                                                      </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-sm">
                                                      <p className="text-xs"><strong>{hh.codigo}:</strong> {hh.descricao}</p>
                                                    </TooltipContent>
                                                  </Tooltip>
                                                )
                                              })}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    </>
                  )
                })()}

                {/* Lista */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lista</span>
                  <div className="rounded-lg border bg-muted/10 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="review-criar-lista"
                        checked={reviewCriarLista}
                        onCheckedChange={(checked) => setReviewCriarLista(checked === true)}
                        className="cursor-pointer"
                      />
                      <Label htmlFor="review-criar-lista" className="cursor-pointer text-xs font-medium">
                        Criar lista de exercícios
                      </Label>
                    </div>
                    {reviewCriarLista && (
                      <Input
                        id="review-titulo-lista"
                        value={reviewTituloLista}
                        onChange={(e) => setReviewTituloLista(e.target.value)}
                        placeholder={buildDefaultListaTitle(reviewDisciplina)}
                        className="h-8 text-xs"
                      />
                    )}
                  </div>
                </div>

                {/* Global warnings */}
                {reviewJob && reviewJob.warnings.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avisos</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2 text-sm text-amber-600 cursor-default">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{reviewJob.warnings.length} aviso(s) global(is)</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-[400px] space-y-1 text-left">
                        {reviewJob.warnings.map((w, wi) => (
                          <div key={wi} className="text-xs">
                            <span className="font-mono opacity-75">{w.questao ? `Q${w.questao}` : "—"}</span>
                            {" "}
                            <span className="font-semibold">{w.code}</span>
                            {" — "}
                            {w.message}
                          </div>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}

                {/* Actions (desktop) */}
                <div className="space-y-2 hidden lg:block">
                  <Button
                    className="w-full cursor-pointer"
                    onClick={handlePublicar}
                    disabled={
                      isPublishing ||
                      reviewQuestoes.length === 0 ||
                      !reviewDisciplina ||
                      (reviewCriarLista && !reviewTituloLista.trim())
                    }
                  >
                    {isPublishing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Publicar
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 cursor-pointer"
                      onClick={handleSaveReview}
                      disabled={isSavingReview || reviewQuestoes.length === 0}
                    >
                      {isSavingReview ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Salvar
                    </Button>
                    <Button
                      variant="ghost"
                      className="flex-1 cursor-pointer"
                      onClick={closeReview}
                    >
                      Fechar
                    </Button>
                  </div>
                  {reviewSaved && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      <span>Alterações salvas</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile bottom bar */}
          <div className="shrink-0 border-t p-3 flex items-center justify-between gap-2 lg:hidden bg-background">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {reviewSaved && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span>Salvo</span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveReview} disabled={isSavingReview || reviewQuestoes.length === 0} className="cursor-pointer">
                {isSavingReview ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                Salvar
              </Button>
              <Button size="sm" onClick={handlePublicar} disabled={isPublishing || reviewQuestoes.length === 0 || !reviewDisciplina || (reviewCriarLista && !reviewTituloLista.trim())} className="cursor-pointer">
                {isPublishing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                Publicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Questão Dialog ── */}
      <Dialog open={!!editQuestao} onOpenChange={(open) => { if (!open) closeEditQuestao() }}>
        <DialogContent className="sm:max-w-4xl h-[90vh] flex! flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <Pencil className="h-5 w-5" />
              <span>Editar Questão</span>
              {editQuestao?.codigo && (
                <Badge variant="outline" className="font-mono">
                  {editQuestao.codigo}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Edite a questão cadastrada usando o mesmo modelo da revisão antes da publicação.
            </DialogDescription>
          </DialogHeader>

          {editQuestao && (() => {
            const textoBaseText = extractFullText(editQuestao.textoBase ?? [])
            const fonteText = extractFullText(editQuestao.fonte ?? [])
            const enunciadoText = extractFullText(editQuestao.enunciado)
            const resolucaoText = extractFullText(editQuestao.resolucaoTexto ?? [])
            const alternativas = [...editQuestao.alternativas].sort((a, b) => a.ordem - b.ordem)
            const jobId = editQuestao.importacaoJobId

            const renderEditBlocks = (blocks: Array<Record<string, unknown>> | null) =>
              (blocks ?? [])
                .filter((block) => block.type !== "paragraph")
                .map((block, bi) => {
                  if (block.type === "image") {
                    return (
                      <Image
                        key={bi}
                        src={resolveViewImageUrl(block.storagePath as string, jobId)}
                        alt={(block.alt as string) ?? `Imagem ${bi + 1}`}
                        width={(block.width as number | undefined) ?? 600}
                        height={(block.height as number | undefined) ?? 400}
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="max-w-full h-auto rounded-md border mt-2 object-contain"
                        unoptimized
                      />
                    )
                  }
                  if (block.type === "math") {
                    return (
                      <div key={bi} className="rounded bg-muted p-2 font-mono text-xs">
                        {(block.latex as string) ?? ""}
                      </div>
                    )
                  }
                  return null
                })

            return (
              <>
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-5">
                  {editError && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {editError}
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <FieldLabel label="Disciplina" tooltipKey="disciplina" />
                      <Select
                        value={editQuestao.disciplinaId ?? "__none__"}
                        onValueChange={(val) => {
                          if (val === "__none__") {
                            setEditQuestao((prev) => prev ? {
                              ...prev,
                              disciplina: null,
                              disciplinaId: null,
                              frenteId: null,
                              moduloId: null,
                            } : prev)
                            setEditSaved(false)
                            return
                          }
                          const disc = apiDisciplinas.find((d) => d.id === val)
                          setEditQuestao((prev) => prev ? {
                            ...prev,
                            disciplina: disc?.name ?? null,
                            disciplinaId: val,
                            frenteId: null,
                            moduloId: null,
                          } : prev)
                          setEditSaved(false)
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {apiDisciplinas.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Frente</Label>
                      <Select
                        value={editQuestao.frenteId ?? "__none__"}
                        onValueChange={(val) => {
                          setEditQuestao((prev) => prev ? {
                            ...prev,
                            frenteId: val === "__none__" ? null : val,
                            moduloId: null,
                          } : prev)
                          setEditSaved(false)
                        }}
                        disabled={!editQuestao.disciplinaId || editFrentes.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {editFrentes.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <FieldLabel label="Módulo" tooltipKey="moduloConteudo" />
                      <Select
                        value={editQuestao.moduloId ?? "__none__"}
                        onValueChange={(val) => {
                          updateEditField("moduloId", val === "__none__" ? null : val)
                        }}
                        disabled={!editQuestao.frenteId || editModulos.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhum</SelectItem>
                          {editModulos.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.numeroModulo != null ? `${m.numeroModulo}. ` : ""}{m.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="flex flex-col gap-1.5 md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Fonte / Instituição</Label>
                      <Input
                        value={editQuestao.instituicao ?? ""}
                        onChange={(e) => updateEditField("instituicao", e.target.value || null)}
                        placeholder="Ex: ENEM, FUVEST..."
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Ano</Label>
                      <Input
                        type="number"
                        value={editQuestao.ano ?? ""}
                        onChange={(e) => updateEditField("ano", e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ex: 2024"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">Número original</Label>
                      <Input
                        type="number"
                        value={editQuestao.numeroOriginal ?? ""}
                        onChange={(e) => updateEditField("numeroOriginal", e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ex: 12"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel label="Dificuldade" tooltipKey="dificuldade" />
                    <div className="flex flex-wrap gap-2">
                      {DIFICULDADES.map((d) => {
                        const isSelected = editQuestao.dificuldade === d.value
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => updateEditField("dificuldade", isSelected ? null : d.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                              isSelected
                                ? `${d.color} ring-2`
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {d.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel label="Texto de apoio" tooltipKey="textoBase" />
                    <Textarea
                      value={textoBaseText}
                      onChange={(e) => updateEditTextBlocks("textoBase", e.target.value)}
                      className="min-h-[80px] resize-y text-sm"
                      placeholder="Texto de apoio da questão (opcional)..."
                      spellCheck={false}
                    />
                    {renderEditBlocks(editQuestao.textoBase)}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel label="Fonte" tooltipKey="fonte" />
                    <Textarea
                      value={fonteText}
                      onChange={(e) => updateEditTextBlocks("fonte", e.target.value)}
                      className="min-h-[64px] resize-y text-xs"
                      placeholder="Fonte/citação da questão (opcional)..."
                      spellCheck={false}
                    />
                    {hasRichTextPreview(editQuestao.fonte) && (
                      <div className="whitespace-pre-wrap rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        {renderTextWithInlineMath(fonteText)}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel label="Enunciado" tooltipKey="enunciado" />
                    <Textarea
                      value={enunciadoText}
                      onChange={(e) => updateEditTextBlocks("enunciado", e.target.value)}
                      className="min-h-[100px] resize-y text-sm"
                      placeholder="Enunciado da questão..."
                      spellCheck={false}
                    />
                    {renderEditBlocks(editQuestao.enunciado)}
                  </div>

                  <div className="flex flex-col gap-2">
                    <FieldLabel label="Alternativas" tooltipKey="alternativas" />
                    <div className="space-y-2">
                      {alternativas.map((alt, idx) => {
                        const isCorrect = alt.letra.toUpperCase() === editQuestao.gabarito
                        return (
                          <div
                            key={alt.letra}
                            className={`rounded-lg border p-3 ${
                              isCorrect
                                ? "border-green-300 bg-green-50/70 dark:border-green-800 dark:bg-green-950/30"
                                : "bg-muted/10"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => updateEditField("gabarito", alt.letra.toUpperCase())}
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold transition-colors cursor-pointer ${
                                  isCorrect
                                    ? "bg-green-600 text-white"
                                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                                }`}
                                title="Marcar como gabarito"
                              >
                                {alt.letra.toUpperCase()}
                              </button>
                              <div className="flex-1 space-y-2">
                                <Textarea
                                  value={alt.texto}
                                  onChange={(e) => updateEditAlternativaText(idx, e.target.value)}
                                  className="min-h-[52px] resize-y text-sm"
                                  placeholder={`Texto da alternativa ${alt.letra.toUpperCase()}`}
                                  spellCheck={false}
                                />
                                {hasPreviewFormatting(alt.texto) && (
                                  <div className="whitespace-pre-wrap rounded-md border bg-muted/20 px-3 py-2 text-sm">
                                    {renderTextWithInlineMath(alt.texto)}
                                  </div>
                                )}
                                {alt.imagemPath && (
                                  <Image
                                    src={resolveViewImageUrl(alt.imagemPath, jobId)}
                                    alt={`Imagem alternativa ${alt.letra.toUpperCase()}`}
                                    width={0}
                                    height={0}
                                    sizes="(max-width: 768px) 80vw, 40vw"
                                    className="max-w-full h-auto rounded-md border object-contain"
                                    unoptimized
                                  />
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive"
                                onClick={() => removeEditAlternativa(idx)}
                                disabled={alternativas.length <= 2}
                                title="Remover alternativa"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addEditAlternativa}
                      disabled={alternativas.length >= 5}
                      className="w-fit cursor-pointer"
                    >
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Adicionar alternativa
                    </Button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel label="Tags" tooltipKey="tags" />
                    <div className="flex flex-wrap items-center gap-1.5">
                      {editQuestao.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => updateEditField("tags", editQuestao.tags.filter((t) => t !== tag))}
                            className="ml-0.5 cursor-pointer hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input
                        value={editTagInput}
                        onChange={(e) => setEditTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addEditTag()
                          }
                        }}
                        className="h-8 w-52 text-xs"
                        placeholder="Digite uma tag e Enter..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs text-muted-foreground">Classificação ENEM</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px]">
                          <p>Selecione a área primeiro; depois escolha competências e habilidades.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={editQuestao.areaConhecimento ?? "__none__"}
                      onValueChange={(val) => {
                        updateEditField("areaConhecimento", val === "__none__" ? null : val)
                        updateEditField("competenciasEnem", [])
                        updateEditField("habilidadesEnem", [])
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Área de Conhecimento..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {AREAS_CONHECIMENTO.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {editQuestao.areaConhecimento && (() => {
                      const area = editQuestao.areaConhecimento as AreaConhecimento
                      const competencias = getCompetenciasPorArea(area)
                      const selectedComps = editQuestao.competenciasEnem
                      return (
                        <>
                          <div>
                            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Competências</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {competencias.map((c) => {
                                const isSelected = selectedComps.includes(c.codigo)
                                return (
                                  <Tooltip key={c.codigo}>
                                    <TooltipTrigger asChild>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const next = isSelected
                                            ? selectedComps.filter((x) => x !== c.codigo)
                                            : [...selectedComps, c.codigo]
                                          updateEditField("competenciasEnem", next)
                                          if (isSelected) {
                                            const habCodes = new Set(getHabilidadesPorCompetencia(area, c.codigo).map((h) => h.codigo))
                                            updateEditField("habilidadesEnem", editQuestao.habilidadesEnem.filter((h) => !habCodes.has(h)))
                                          }
                                        }}
                                        className={`px-2 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                                          isSelected
                                            ? "bg-violet-600 text-white ring-2 ring-violet-400"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        }`}
                                      >
                                        {c.codigo}
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="max-w-sm">
                                      <p className="text-xs"><strong>{c.codigo}:</strong> {c.descricao}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )
                              })}
                            </div>
                          </div>

                          {selectedComps.length > 0 && (
                            <div>
                              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Habilidades</span>
                              <div className="space-y-1.5 mt-1">
                                {selectedComps.map((compCodigo) => {
                                  const habs = getHabilidadesPorCompetencia(area, compCodigo)
                                  const selectedHabs = editQuestao.habilidadesEnem
                                  return (
                                    <div key={compCodigo}>
                                      <span className="text-[10px] text-muted-foreground">{compCodigo}:</span>
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {habs.map((h) => {
                                          const isHabSelected = selectedHabs.includes(h.codigo)
                                          return (
                                            <Tooltip key={h.codigo}>
                                              <TooltipTrigger asChild>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    const next = isHabSelected
                                                      ? selectedHabs.filter((x) => x !== h.codigo)
                                                      : [...selectedHabs, h.codigo]
                                                    updateEditField("habilidadesEnem", next)
                                                  }}
                                                  className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                                                    isHabSelected
                                                      ? "bg-violet-500 text-white ring-1 ring-violet-300"
                                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                                  }`}
                                                >
                                                  {h.codigo}
                                                </button>
                                              </TooltipTrigger>
                                              <TooltipContent side="top" className="max-w-sm">
                                                <p className="text-xs"><strong>{h.codigo}:</strong> {h.descricao}</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel label="Resolução" tooltipKey="resolucao" />
                    <Textarea
                      value={resolucaoText}
                      onChange={(e) => updateEditTextBlocks("resolucaoTexto", e.target.value)}
                      className="min-h-[80px] resize-y text-sm"
                      placeholder="Resolução da questão (opcional)..."
                      spellCheck={false}
                    />
                    {renderEditBlocks(editQuestao.resolucaoTexto)}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel label="Vídeo de Resolução (URL)" tooltipKey="videoResolucao" />
                    <Input
                      value={editQuestao.resolucaoVideoUrl ?? ""}
                      onChange={(e) => updateEditField("resolucaoVideoUrl", e.target.value || null)}
                      placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
                    />
                    {editQuestao.resolucaoVideoUrl && isValidOptionalUrl(editQuestao.resolucaoVideoUrl) && (
                      <div className="mt-2">
                        <VideoPlayer url={editQuestao.resolucaoVideoUrl} light className="max-w-sm" />
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t shrink-0">
                  <div className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
                    {editSaved && (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        <span>Alterações salvas</span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={closeEditQuestao}
                    className="cursor-pointer"
                  >
                    Fechar
                  </Button>
                  <Button
                    onClick={handleSaveEditQuestao}
                    disabled={isSavingEdit}
                    className="cursor-pointer"
                  >
                    {isSavingEdit ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar alterações
                  </Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ── View Questão Dialog ── */}
      <Dialog open={!!viewQuestao} onOpenChange={(open) => { if (!open) setViewQuestao(null) }}>
        <DialogContent className="sm:max-w-3xl h-[90vh] flex! flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3">
              <span className="font-mono">{viewQuestao?.codigo ?? "—"}</span>
              {viewQuestao?.dificuldade && (
                <Badge variant={dificuldadeColor(viewQuestao.dificuldade) as "success" | "warning" | "destructive" | "secondary"}>
                  {viewQuestao.dificuldade === "facil" ? "Fácil" : viewQuestao.dificuldade === "medio" ? "Médio" : viewQuestao.dificuldade === "dificil" ? "Difícil" : viewQuestao.dificuldade}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="flex flex-wrap gap-2">
              {viewQuestao?.numeroOriginal != null && <span>Nº {viewQuestao.numeroOriginal}</span>}
              {viewQuestao?.disciplina && <span>· {viewQuestao.disciplina}</span>}
              {viewQuestao?.instituicao && <span>· {viewQuestao.instituicao}</span>}
              {viewQuestao?.ano && <span>· {viewQuestao.ano}</span>}
            </DialogDescription>
          </DialogHeader>

          {viewQuestao && (() => {
            const jobId = viewQuestao.importacaoJobId

            const renderViewBlocks = (blocks: Array<Record<string, unknown>>) =>
              blocks.map((block, bi) => {
                if (block.type === "paragraph") {
                  const text = block.text as string
                  return <p key={bi} className="whitespace-pre-wrap">{renderTextWithInlineMath(text)}</p>
                }
                if (block.type === "image") {
                  const src = resolveViewImageUrl(block.storagePath as string, jobId)
                  const w = (block.width as number | undefined) ?? 0
                  const h = (block.height as number | undefined) ?? 0
                  return (
                    <Image
                      key={bi}
                      src={src}
                      alt={(block.alt as string) ?? `Imagem ${bi + 1}`}
                      width={w || 600}
                      height={h || 400}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="rounded-md border my-2 object-contain"
                      style={{
                        maxWidth: "100%",
                        width: w ? `${w}px` : undefined,
                        height: w ? "auto" : undefined,
                      }}
                      unoptimized
                    />
                  )
                }
                if (block.type === "math") {
                  let html: string
                  try {
                    html = katex.renderToString(block.latex as string, { throwOnError: false, displayMode: true })
                  } catch {
                    html = block.latex as string
                  }
                  return <span key={bi} className="block my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
                }
                return null
              })

            return (
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
                {/* Texto Base */}
                {viewQuestao.textoBase && viewQuestao.textoBase.length > 0 && (
                  <div className="rounded-lg bg-muted/30 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Texto de Apoio
                    </p>
                    <div className="text-sm leading-relaxed space-y-1">
                      {renderViewBlocks(viewQuestao.textoBase)}
                    </div>
                  </div>
                )}

                {/* Fonte */}
                {viewQuestao.fonte && viewQuestao.fonte.length > 0 && (
                  <div className="text-xs leading-relaxed text-muted-foreground">
                    {renderViewBlocks(viewQuestao.fonte)}
                  </div>
                )}

                {/* Enunciado */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Enunciado
                  </p>
                  <div className="text-sm leading-relaxed space-y-1">
                    {renderViewBlocks(viewQuestao.enunciado)}
                  </div>
                </div>

                {/* Alternativas */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Alternativas
                  </p>
                  <div className="space-y-2">
                    {viewQuestao.alternativas
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((alt) => {
                        const isCorrect = alt.letra.toUpperCase() === viewQuestao.gabarito
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
                              <p className="whitespace-pre-wrap text-sm">
                                {hasPreviewFormatting(alt.texto)
                                  ? renderTextWithInlineMath(alt.texto)
                                  : alt.texto}
                              </p>
                              {alt.imagemPath && (
                                <Image
                                  src={resolveViewImageUrl(alt.imagemPath, jobId)}
                                  alt={`Imagem alternativa ${alt.letra.toUpperCase()}`}
                                  width={0}
                                  height={0}
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
                <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Resolução
                  </p>
                  {viewQuestao.resolucaoTexto && viewQuestao.resolucaoTexto.length > 0 ? (
                    <div className="text-sm leading-relaxed space-y-1">
                      {renderViewBlocks(viewQuestao.resolucaoTexto)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Sem resolução cadastrada.
                    </p>
                  )}
                </div>

                {/* Video */}
                {viewQuestao.resolucaoVideoUrl && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Vídeo de Resolução
                    </p>
                    <VideoPlayer url={viewQuestao.resolucaoVideoUrl} />
                  </div>
                )}

                {/* Tags */}
                {viewQuestao.tags.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewQuestao.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Classificação ENEM */}
                {(viewQuestao.areaConhecimento || viewQuestao.competenciasEnem.length > 0 || viewQuestao.habilidadesEnem.length > 0) && (
                  <div className="rounded-lg border bg-violet-50/50 dark:bg-violet-950/20 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Classificação ENEM
                    </p>
                    {viewQuestao.areaConhecimento && (
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground">Área: </span>
                        <Badge variant="outline" className="text-xs">
                          {viewQuestao.areaConhecimento}
                        </Badge>
                      </div>
                    )}
                    {viewQuestao.competenciasEnem.length > 0 && (
                      <div className="mb-2">
                        <span className="text-xs text-muted-foreground">Competências: </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {viewQuestao.competenciasEnem.map((c) => {
                            const area = viewQuestao.areaConhecimento as AreaConhecimento | null
                            const comp = area ? findCompetencia(area, c) : undefined
                            return (
                              <Tooltip key={c}>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Badge variant="secondary" className="text-xs cursor-help">
                                      {c}
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                {comp && (
                                  <TooltipContent side="top" className="max-w-sm">
                                    <p className="text-xs">{comp.descricao}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            )
                          })}
                        </div>
                      </div>
                    )}
                    {viewQuestao.habilidadesEnem.length > 0 && (
                      <div>
                        <span className="text-xs text-muted-foreground">Habilidades: </span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {viewQuestao.habilidadesEnem.map((h) => {
                            const area = viewQuestao.areaConhecimento as AreaConhecimento | null
                            const hab = area ? findHabilidade(area, h) : undefined
                            return (
                              <Tooltip key={h}>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Badge variant="secondary" className="text-xs cursor-help">
                                      {h}
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                {hab && (
                                  <TooltipContent side="top" className="max-w-sm">
                                    <p className="text-xs">{hab.descricao}</p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })()}

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button
              variant="outline"
              onClick={() => setViewQuestao(null)}
              className="cursor-pointer"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation (single + bulk) ── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteId === "__bulk__"
                ? `Excluir ${selectedIds.size} questão(ões)?`
                : "Excluir questão?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteId === "__bulk__"
                ? `Esta ação não pode ser desfeita. ${selectedIds.size} questão(ões) selecionada(s) serão removidas permanentemente do banco.`
                : "Esta ação não pode ser desfeita. A questão será removida permanentemente do banco."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteId === "__bulk__" ? handleBulkDelete : handleDelete}
              disabled={isDeleting || isDeletingBulk}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {(isDeleting || isDeletingBulk) ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Importação Confirmation ── */}
      <AlertDialog open={!!deleteImportacaoId} onOpenChange={(open) => !open && setDeleteImportacaoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir importação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados da importação
              (questões extraídas, imagens e configurações) serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteImportacao}
              disabled={isDeletingImportacao}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
            >
              {isDeletingImportacao ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Tags Dialog */}
      <Dialog open={bulkTagsOpen} onOpenChange={setBulkTagsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerenciar Tags em Lote</DialogTitle>
            <DialogDescription>
              {selectedIds.size} questão(ões) selecionada(s)
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Ação</Label>
              <Select value={bulkTagsAction} onValueChange={(v) => setBulkTagsAction(v as "add" | "remove")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="add">Adicionar tags</SelectItem>
                  <SelectItem value="remove">Remover tags</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {bulkTagsList.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      onClick={() => setBulkTagsList((prev) => prev.filter((t) => t !== tag))}
                      className="ml-0.5 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                placeholder="Digite uma tag e pressione Enter"
                value={bulkTagsInput}
                onChange={(e) => setBulkTagsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    const trimmed = bulkTagsInput.trim()
                    if (trimmed && !bulkTagsList.includes(trimmed)) {
                      setBulkTagsList((prev) => [...prev, trimmed])
                      setBulkTagsInput("")
                    }
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkTagsOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={handleBulkTags}
              disabled={bulkTagsList.length === 0 || isApplyingBulkTags}
              className="cursor-pointer"
            >
              {isApplyingBulkTags && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              {bulkTagsAction === "add" ? "Adicionar" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
