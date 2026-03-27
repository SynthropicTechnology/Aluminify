'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { createClient } from '@/app/shared/core/client'
import { useOptionalTenantContext } from '@/app/[tenant]/tenant-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/app/shared/components/forms/input'
import { Label } from '@/app/shared/components/forms/label'
import { Slider } from '@/components/ui/slider'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/shared/components/forms/select'
import { Checkbox } from '@/app/shared/components/forms/checkbox'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDownIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/app/shared/components/feedback/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/shared/components/ui/alert-dialog'
import { Loader2, X, AlertCircle, Info, Check, BookOpen, Star, Target, Zap, Rocket, Clock, LayoutGrid, ListOrdered, CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/shared/components/overlay/tooltip'
import { FrenteOrderDragDrop, type FrenteOrderItem } from './frente-order-drag-drop'

/** Mapeia status HTTP para mensagens amigáveis quando a resposta não é JSON */
function getHttpErrorMessage(status: number): string {
  switch (status) {
    case 502:
    case 504:
      return 'O servidor demorou demais para gerar o cronograma. Tente reduzir a quantidade de disciplinas/módulos ou tente novamente em alguns minutos.'
    case 503:
      return 'O servidor está temporariamente indisponível. Tente novamente em alguns minutos.'
    case 413:
      return 'A requisição é grande demais. Tente reduzir a quantidade de disciplinas selecionadas.'
    case 429:
      return 'Muitas requisições em pouco tempo. Aguarde um momento e tente novamente.'
    default:
      return `Erro inesperado do servidor (${status}). Tente novamente ou entre em contato com o suporte.`
  }
}

const wizardSchema = z.object({
  data_inicio: z.date({ message: 'Data de início é obrigatória' }),
  data_fim: z.date({ message: 'Data de término é obrigatória' }),
  dias_semana: z.number().min(1).max(7),
  horas_dia: z.number().min(1),
  ferias: z.array(z.object({
    inicio: z.date().optional(),
    fim: z.date().optional(),
  })),
  curso_alvo_id: z.string().min(1, 'Selecione um curso'),
  disciplinas_ids: z.array(z.string()).min(1, 'Selecione pelo menos uma disciplina'),
  prioridade_minima: z.number().min(1).max(5),
  modalidade: z.enum(['paralelo', 'sequencial']),
  ordem_frentes_preferencia: z.array(z.string()).optional(),
  modulos_ids: z.array(z.string()).optional(),
  excluir_aulas_concluidas: z.boolean().optional(),
  nome: z.string().min(1, 'Nome do cronograma é obrigatório'),
  velocidade_reproducao: z.number().min(1.0).max(2.0),
}).refine((data) => data.data_fim > data.data_inicio, {
  message: 'Data de término deve ser posterior à data de início',
  path: ['data_fim'],
})

type WizardFormData = z.infer<typeof wizardSchema>

const STEPS = [
  { id: 1, title: 'Definições de Tempo' },
  { id: 2, title: 'Disciplinas e Módulos' },
  { id: 3, title: 'Modalidade' },
  { id: 4, title: 'Estratégia de Estudo' },
  { id: 5, title: 'Revisão e Geração' },
]

const MODALIDADES = [
  {
    nivel: 1,
    label: 'Super Extensivo',
    descricao: 'Aprofundamento Total',
    texto: 'Domine o conteúdo de ponta a ponta. Do zero ao nível mais avançado, com todos os aprofundamentos possíveis. Perfeito para cursos de alta concorrência e provas específicas que exigem o máximo de detalhe.',
    tempo: '⏱️ Recomendado para: 10 ou mais meses de estudo.'
  },
  {
    nivel: 2,
    label: 'Extensivo',
    descricao: 'O Mais Popular',
    texto: 'A preparação completa para 99% dos vestibulares. Cobre todo o edital do ENEM, FUVEST, UNICAMP e UERJ, filtrando apenas excessos desnecessários. É a rota segura para a aprovação.',
    tempo: '⏱️ Recomendado para: entre 10 e 8 meses de estudo.'
  },
  {
    nivel: 3,
    label: 'Semi Extensivo',
    descricao: 'Otimizado',
    texto: 'Todo o conteúdo, sem enrolação. Mantemos a jornada do básico ao avançado, mas focamos nos aprofundamentos e exercícios que realmente fazem a diferença na nota. Eficiência máxima.',
    tempo: '⏱️ Recomendado para: entre 8 e 6 meses de estudo.'
  },
  {
    nivel: 4,
    label: 'Intensivo',
    descricao: 'Foco no que Cai',
    texto: 'Não perca tempo. Priorizamos os assuntos com maior recorrência histórica nas provas. Você verá do básico ao avançado apenas no que tem alta probabilidade de cair.',
    tempo: '⏱️ Recomendado para: entre 6 e 3 meses de estudo.'
  },
  {
    nivel: 5,
    label: 'Superintensivo',
    descricao: 'Reta Final',
    texto: 'A base sólida para salvar seu ano. O mínimo conteúdo viável (MCV) e essencial condensado para dar segurança nas questões fáceis e médias. É o "kit de sobrevivência" para quem tem pouco tempo.',
    tempo: '⏱️ Tiro rápido é o conteúdo mínimo viável para a prova.'
  },
]

const MODALIDADE_ICONS: Record<number, React.ElementType> = {
  1: BookOpen,
  2: Star,
  3: Target,
  4: Zap,
  5: Rocket,
}

const TEMPO_PADRAO_MINUTOS = 10
const FATOR_MULTIPLICADOR = 1.5

type ModalidadeStats = {
  tempoAulaMinutos: number
  tempoEstudoMinutos: number
  totalAulas: number
}

type ModuloResumo = {
  id: string
  nome: string
  numero_modulo: number | null
  totalAulas: number
  tempoTotal: number
  concluidas: number
  importancia?: 'Alta' | 'Media' | 'Baixa' | 'Base' | null
}

type FrenteResumo = {
  id: string
  nome: string
  modulos: ModuloResumo[]
}

// Types for state data
interface CursoData {
  id: string
  nome: string
  [key: string]: unknown
}

interface DisciplinaData {
  id: string
  nome: string
  [key: string]: unknown
}

interface FrenteData {
  id: string
  nome: string
  disciplina_id: string | null
  [key: string]: unknown
}

const formatHorasFromMinutes = (minutos?: number) => {
  if (!minutos || minutos <= 0) {
    return '--'
  }

  const horas = minutos / 60
  const isInt = Number.isInteger(horas)

  return `${horas.toLocaleString('pt-BR', {
    minimumFractionDigits: isInt ? 0 : 1,
    maximumFractionDigits: 1,
  })}h`
}

// Função para calcular semanas disponibilizadas (período entre data início e fim, descontando férias)
const calcularSemanasDisponibilizadas = (
  dataInicio: Date | undefined,
  dataFim: Date | undefined,
  ferias: Array<{ inicio?: Date; fim?: Date }>,
): number => {
  if (!dataInicio || !dataFim) return 0

  const inicio = new Date(dataInicio)
  let semanas = 0

  while (inicio <= dataFim) {
    const fimSemana = new Date(inicio)
    fimSemana.setDate(fimSemana.getDate() + 6) // 7 dias (0-6)

    // Verificar se a semana cai em período de férias
    let isFerias = false
    for (const periodo of ferias || []) {
      if (!periodo.inicio || !periodo.fim) continue
      const inicioFerias = new Date(periodo.inicio)
      const fimFerias = new Date(periodo.fim)
      if (
        (inicio >= inicioFerias && inicio <= fimFerias) ||
        (fimSemana >= inicioFerias && fimSemana <= fimFerias) ||
        (inicio <= inicioFerias && fimSemana >= fimFerias)
      ) {
        isFerias = true
        break
      }
    }

    if (!isFerias) {
      semanas++
    }

    inicio.setDate(inicio.getDate() + 7)
  }

  return semanas
}

// Função para calcular semanas necessárias do cronograma (baseado no conteúdo selecionado e tempo necessário)
const calcularSemanasCronograma = (
  modalidadeStats: Record<number, ModalidadeStats>,
  prioridadeMinima: number,
  velocidadeReproducao: number,
  horasDia: number,
  diasSemana: number,
): number => {
  const stats = modalidadeStats[prioridadeMinima]
  if (!stats) return 0

  // Tempo de aula ajustado pela velocidade
  const tempoAulaAjustadoMinutos = stats.tempoAulaMinutos / velocidadeReproducao
  // Tempo de estudo = tempo de aula ajustado * (FATOR_MULTIPLICADOR - 1)
  const tempoEstudoAjustadoMinutos = tempoAulaAjustadoMinutos * (FATOR_MULTIPLICADOR - 1)
  // Tempo total necessário em minutos
  const tempoTotalMinutos = tempoAulaAjustadoMinutos + tempoEstudoAjustadoMinutos

  // Capacidade por semana em minutos
  const capacidadeSemanaMinutos = horasDia * diasSemana * 60

  if (capacidadeSemanaMinutos <= 0) return 0

  // Calcular semanas necessárias (arredondar para cima)
  const semanasNecessarias = Math.ceil(tempoTotalMinutos / capacidadeSemanaMinutos)

  return semanasNecessarias
}

export function ScheduleWizard() {
  const router = useRouter()
  const params = useParams()
  const tenant = params?.tenant as string
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursos, setCursos] = useState<CursoData[]>([])
  const [disciplinasDoCurso, setDisciplinasDoCurso] = useState<DisciplinaData[]>([]) // Disciplinas do curso selecionado
  const [_frentes, setFrentes] = useState<FrenteData[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showTempoInsuficienteDialog, setShowTempoInsuficienteDialog] = useState(false)
  const [tempoInsuficienteDetalhes, setTempoInsuficienteDetalhes] = useState<{
    horasNecessarias: number
    horasDisponiveis: number
    horasDiaNecessarias: number
  } | null>(null)
  const [modalidadeStats, setModalidadeStats] = useState<Record<number, ModalidadeStats>>({})
  const [modalidadeStatsLoading, setModalidadeStatsLoading] = useState(false)
  const [modalidadeStatsError, setModalidadeStatsError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [modulosCurso, setModulosCurso] = useState<FrenteResumo[]>([])
  const [modulosCursoAgrupadosPorDisciplina, setModulosCursoAgrupadosPorDisciplina] = useState<Record<string, { disciplinaNome: string; frentes: FrenteResumo[] }>>({})
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>([])
  const [modulosLoading, setModulosLoading] = useState(false)
  const [completedLessonsCount, setCompletedLessonsCount] = useState(0)

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: {
      dias_semana: 3,
      horas_dia: 2,
      prioridade_minima: 2, // Extensivo
      modalidade: 'paralelo',
      curso_alvo_id: '',
      disciplinas_ids: [],
      ferias: [],
      modulos_ids: [],
      excluir_aulas_concluidas: true,
      velocidade_reproducao: 1.0,
    },
  })

  const cursoSelecionado = form.watch('curso_alvo_id')
  const cursoAtual = React.useMemo(
    () => cursos.find((curso) => curso.id === cursoSelecionado) ?? null,
    [cursos, cursoSelecionado],
  )

  const tenantContext = useOptionalTenantContext()
  const empresaId = tenantContext?.empresaId ?? null

  // Dados computados para o drag-and-drop de frentes (modo sequencial)
  const frenteOrderItems = React.useMemo<FrenteOrderItem[]>(() => {
    const items: FrenteOrderItem[] = []
    Object.entries(modulosCursoAgrupadosPorDisciplina).forEach(([discId, grupo]) => {
      grupo.frentes.forEach((frente) => {
        items.push({
          id: frente.id,
          nome: frente.nome,
          disciplinaId: discId,
          disciplinaNome: grupo.disciplinaNome,
          totalModulos: frente.modulos.length,
          totalAulas: frente.modulos.reduce((acc, m) => acc + m.totalAulas, 0),
          tempoEstimadoMinutos: frente.modulos.reduce((acc, m) => acc + m.tempoTotal, 0),
        })
      })
    })
    return items
  }, [modulosCursoAgrupadosPorDisciplina])

  const isMultiDisciplina = Object.keys(modulosCursoAgrupadosPorDisciplina).length > 1

  // Carregar cursos e disciplinas (filtrados pelo tenant ativo)
  React.useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push(tenant ? `/${tenant}/auth/login` : '/auth/login')
        return
      }
      setUserId(user.id)

      // Verificar se o usuário é professor via usuarios_empresas
      const { data: professorData, error: professorError } = await supabase
        .from('usuarios_empresas')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('papel_base', 'professor')
        .eq('ativo', true)
        .is('deleted_at', null)
        .limit(1)
        .maybeSingle()

      if (professorError) {
        console.error('Erro ao verificar se é professor:', professorError)
      }

      const isProfessor = !!professorData
      console.log(`Usuário ${user.id} é professor: ${isProfessor}`)

      // Buscar cursos: se for professor, buscar cursos que ele criou; se for aluno, buscar através de matrículas
      let cursosData: CursoData[] = []

      if (isProfessor) {
        // Professor vê cursos da empresa ativa (multi-tenant)
        let cursosDoProfessorQ = supabase
          .from('cursos')
          .select('*')
          .eq('created_by', user.id)
          .order('nome', { ascending: true })
        if (empresaId) cursosDoProfessorQ = cursosDoProfessorQ.eq('empresa_id', empresaId)
        let cursosSemCriadorQ = supabase
          .from('cursos')
          .select('*')
          .is('created_by', null)
          .order('nome', { ascending: true })
        if (empresaId) cursosSemCriadorQ = cursosSemCriadorQ.eq('empresa_id', empresaId)

        const [cursosDoProfessor, cursosSemCriador] = await Promise.all([
          cursosDoProfessorQ as unknown as Promise<{ data: CursoData[] | null; error: unknown }>,
          cursosSemCriadorQ as unknown as Promise<{ data: CursoData[] | null; error: unknown }>,
        ])

        if (cursosDoProfessor.error) {
          console.error('Erro ao carregar cursos do professor:', cursosDoProfessor.error)
        }
        if (cursosSemCriador.error) {
          console.error('Erro ao carregar cursos sem criador:', cursosSemCriador.error)
        }

        // Combinar resultados e remover duplicatas
        const todosCursos = [
          ...(cursosDoProfessor.data || []),
          ...(cursosSemCriador.data || []),
        ]

        // Remover duplicatas por ID
        const cursosUnicos = Array.from(
          new Map(todosCursos.map((curso) => [curso.id, curso])).values()
        ).sort((a, b) => (a.nome as string).localeCompare(b.nome as string)) as CursoData[]

        cursosData = cursosUnicos
        console.log(`Professor ${user.id} encontrou ${cursosUnicos.length} curso(s):`, cursosUnicos.map((c) => c.nome))
      } else {
        // Aluno vê cursos através da tabela alunos_cursos (filtrado pelo tenant)
        const { data: matriculas, error: matriculasError } = await supabase
          .from('alunos_cursos')
          .select('curso_id')
          .eq('usuario_id', user.id)

        if (matriculasError) {
          console.error('Erro ao carregar cursos do aluno:', matriculasError)
        }

        if (matriculas && matriculas.length > 0) {
          const cursoIds = [...new Set(matriculas.map((m) => m.curso_id).filter(Boolean))]
          const { data: cursosDoAluno, error: cursosError } = await supabase
            .from('cursos')
            .select('*')
            .in('id', cursoIds)
            .order('nome', { ascending: true })

          if (cursosError) {
            console.error('Erro ao carregar dados dos cursos:', cursosError)
          }

          let list = (cursosDoAluno || []) as (CursoData & { empresa_id?: string })[]
          if (empresaId) {
            list = list.filter((c) => c.empresa_id === empresaId)
          }
          cursosData = list as CursoData[]
          console.log(`Aluno ${user.id} encontrou ${cursosData.length} curso(s):`, cursosData.map((c) => c?.nome))
        }
      }

      setCursos(cursosData)

      // Auto-selecionar curso quando o aluno tem exatamente 1 curso
      if (cursosData.length === 1 && !form.getValues('curso_alvo_id')) {
        form.setValue('curso_alvo_id', cursosData[0].id)
      }

      // Buscar disciplinas (filtradas pelo tenant)
      let discQuery = supabase.from('disciplinas').select('*').order('nome')
      if (empresaId) discQuery = discQuery.eq('empresa_id', empresaId)
      const { data: disciplinasData } = await discQuery

      if (disciplinasData) {
        setDisciplinasDoCurso(disciplinasData)
      }

      setLoadingData(false)
    }

    loadData()
  }, [router, tenant, empresaId, form])

  // Carregar disciplinas do curso selecionado
  React.useEffect(() => {
    async function loadDisciplinasDoCurso() {
      if (!cursoSelecionado) {
        setDisciplinasDoCurso([])
        form.setValue('disciplinas_ids', [])
        return
      }

      const supabase = createClient()
      try {
        // Buscar disciplinas do curso através da tabela cursos_disciplinas
        // Type assertion needed because database types are currently out of sync with actual schema
        const { data: cursosDisciplinas, error: cdError } = (await supabase
          .from('cursos_disciplinas')
          .select('disciplina_id')
          .eq('curso_id', cursoSelecionado)) as { data: Array<{ disciplina_id: string }> | null; error: unknown }

        if (cdError) {
          console.error('Erro ao carregar disciplinas do curso:', cdError)
          setDisciplinasDoCurso([])
          form.setValue('disciplinas_ids', [])
          return
        }

        if (!cursosDisciplinas || cursosDisciplinas.length === 0) {
          setDisciplinasDoCurso([])
          form.setValue('disciplinas_ids', [])
          return
        }

        // Buscar detalhes das disciplinas (filtrado por tenant quando aplicável)
        const disciplinaIds = cursosDisciplinas.map((cd) => cd.disciplina_id)
        let discQuery = supabase
          .from('disciplinas')
          .select('id, nome')
          .in('id', disciplinaIds)
          .order('nome', { ascending: true })
        if (empresaId) discQuery = discQuery.eq('empresa_id', empresaId)
        const { data: disciplinasData, error: discError } = (await discQuery) as {
          data: DisciplinaData[] | null
          error: unknown
        }

        if (discError) {
          console.error('Erro ao carregar detalhes das disciplinas:', discError)
          setDisciplinasDoCurso([])
          form.setValue('disciplinas_ids', [])
          return
        }

        setDisciplinasDoCurso(disciplinasData || [])

        // Se houver apenas uma disciplina, selecionar automaticamente
        if (disciplinasData && disciplinasData.length === 1) {
          form.setValue('disciplinas_ids', [disciplinasData[0].id])
        } else {
          // Se houver múltiplas, deixar o usuário escolher
          form.setValue('disciplinas_ids', [])
        }
      } catch (err) {
        console.error('Erro ao carregar disciplinas do curso:', err)
        setDisciplinasDoCurso([])
        form.setValue('disciplinas_ids', [])
      }
    }

    loadDisciplinasDoCurso()
  }, [cursoSelecionado, form, empresaId])

  // Carregar frentes quando disciplinas são selecionadas (filtradas pelo curso também)
  const disciplinasIds = form.watch('disciplinas_ids');
  React.useEffect(() => {
    async function loadFrentes() {
      if (!disciplinasIds || disciplinasIds.length === 0 || !cursoSelecionado) {
        setFrentes([])
        return
      }

      const supabase = createClient()
      // Type assertion needed because database types are currently out of sync with actual schema
      const { data } = (await supabase
        .from('frentes')
        .select('*')
        .eq('curso_id', cursoSelecionado)
        .in('disciplina_id', disciplinasIds)
        .order('nome')) as { data: FrenteData[] | null }

      if (data) {
        setFrentes(data.filter((f): f is typeof f & { disciplina_id: string } => !!f.disciplina_id))
      }
    }

    loadFrentes()
  }, [disciplinasIds, cursoSelecionado])

  const disciplinasIdsModulos = form.watch('disciplinas_ids');
  useEffect(() => {
    if (!cursoSelecionado || !userId) {
      setModulosCurso([])
      setModulosSelecionados([])
      setCompletedLessonsCount(0)
      return
    }

    if (!disciplinasIdsModulos || disciplinasIdsModulos.length === 0) {
      setModulosCurso([])
      setModulosSelecionados([])
      setCompletedLessonsCount(0)
      return
    }

    let cancelled = false

    const loadModulosDoCurso = async () => {
      setModulosLoading(true)
      const supabase = createClient()

      try {
        // Buscar frentes com informações da disciplina
        // Type assertion needed because database types are currently out of sync with actual schema
        const { data: frentesData, error: frentesError } = (await supabase
          .from('frentes')
          .select('id, nome, disciplina_id, disciplinas(nome)')
          .eq('curso_id', cursoSelecionado)
          .in('disciplina_id', disciplinasIds)
          .order('nome', { ascending: true })) as { data: Array<FrenteData & { disciplinas?: { nome?: string } }> | null; error: { message?: string; details?: string; hint?: string; code?: string } | null }

        if (frentesError) {
          console.error('Erro ao buscar frentes:', {
            message: frentesError.message ?? 'Sem mensagem',
            details: frentesError.details ?? null,
            hint: frentesError.hint ?? null,
            code: frentesError.code ?? null,
            cursoSelecionado,
            disciplinasIds,
          })
          throw frentesError
        }

        if (!frentesData || frentesData.length === 0) {
          console.log('Nenhuma frente encontrada para o curso e disciplinas selecionadas')
          setModulosCurso([])
          setModulosCursoAgrupadosPorDisciplina({})
          setModulosSelecionados([])
          setCompletedLessonsCount(0)
          setError(null)
          return
        }

        const frenteIds = frentesData.map((f) => f.id)

        // Buscar módulos das frentes
        // Type assertion needed because database types are currently out of sync with actual schema
        const { data: modulosData, error: modulosError } = (await supabase
          .from('modulos')
          .select('id, nome, numero_modulo, frente_id, importancia')
          .in('frente_id', frenteIds)
          .order('numero_modulo', { ascending: true })) as { data: Array<{ id: string; nome: string; numero_modulo: number; frente_id: string; importancia: string }> | null; error: { message?: string; details?: string; code?: string } | null }

        if (modulosError) {
          console.error('Erro ao buscar módulos:', {
            message: modulosError.message ?? 'Sem mensagem',
            details: modulosError.details ?? null,
            code: modulosError.code ?? null,
          })
          throw modulosError
        }

        if (!modulosData || modulosData.length === 0) {
          console.log('Nenhum módulo encontrado para as frentes')
          // Criar estrutura vazia com as frentes
          const arvore = frentesData.map((frente: FrenteData) => ({
            id: frente.id,
            nome: frente.nome,
            modulos: [],
          }))
          if (cancelled) {
            return
          }
          setModulosCurso(arvore)
          setModulosCursoAgrupadosPorDisciplina({})
          setModulosSelecionados([])
          setCompletedLessonsCount(0)
          setError(null)
          setModulosLoading(false)
          return
        }

        interface ModuloData {
          id: string;
          nome: string;
          numero_modulo: number | null;
          frente_id: string | null;
          importancia?: string | null;
          [key: string]: unknown;
        }
        const moduloIds = modulosData.map((m: ModuloData) => m.id)

        if (moduloIds.length === 0) {
          console.log('Nenhum ID de módulo válido encontrado')
          if (cancelled) {
            return
          }
          setModulosCurso([])
          setModulosCursoAgrupadosPorDisciplina({})
          setModulosSelecionados([])
          setCompletedLessonsCount(0)
          setError(null)
          setModulosLoading(false)
          return
        }

        // Buscar aulas dos módulos
        // Type assertion needed because database types are currently out of sync with actual schema
        const { data: aulasData, error: aulasError } = (await supabase
          .from('aulas')
          .select('id, modulo_id, tempo_estimado_minutos')
          .in('modulo_id', moduloIds)) as { data: Array<{ id: string; modulo_id: string | null; tempo_estimado_minutos: number | null }> | null; error: { message?: string; details?: string; code?: string } | null }

        if (aulasError) {
          console.error('Erro ao buscar aulas:', {
            message: aulasError.message ?? 'Sem mensagem',
            details: aulasError.details ?? null,
            code: aulasError.code ?? null,
          })
          // Não falhar se não conseguir buscar aulas, apenas logar
          console.warn('Continuando sem dados de aulas')
        }

        // Buscar aulas concluídas (pode não existir a tabela, então tratar erro separadamente)
        let concluidasSet = new Set<string>()
        try {
          // Type assertion needed because database types are currently out of sync with actual schema
          const { data: concluidasData, error: concluidasError } = (await supabase
            .from('aulas_concluidas')
            .select('aula_id')
            .eq('usuario_id', userId)
            .eq('curso_id', cursoSelecionado)) as { data: Array<{ aula_id: string }> | null; error: { message?: string; details?: string; code?: string } | null }

          if (concluidasError) {
            // Se a tabela não existir ou houver erro, apenas logar e continuar
            console.warn('Aviso ao buscar aulas concluídas (pode não existir a tabela):', {
              message: concluidasError.message ?? 'Sem mensagem',
              details: concluidasError.details ?? null,
              code: concluidasError.code ?? null,
            })
          } else if (concluidasData) {
            concluidasSet = new Set(concluidasData.map((row) => row.aula_id as string))
          }
        } catch (concluidasErr: unknown) {
          // Se houver erro na tabela aulas_concluidas, apenas logar e continuar
          const error = concluidasErr as { message?: string; details?: string; code?: string };
          console.warn('Aviso: não foi possível buscar aulas concluídas:', {
            message: error?.message,
            details: error?.details,
            code: error?.code,
          })
        }

        // Agrupar módulos por frente
        const modulosPorFrente = new Map<string, ModuloData[]>()
        modulosData.forEach((modulo: ModuloData) => {
          if (modulo.frente_id) {
            if (!modulosPorFrente.has(modulo.frente_id)) {
              modulosPorFrente.set(modulo.frente_id, [])
            }
            modulosPorFrente.get(modulo.frente_id)!.push(modulo)
          }
        })

        interface AulaData {
          id: string;
          modulo_id: string | null;
          tempo_estimado_minutos: number | null;
          [key: string]: unknown;
        }
        // Agrupar aulas por módulo
        const aulasPorModulo = new Map<string, AulaData[]>()
        const aulasRows = ((aulasData || []) as unknown as AulaData[])
        if (aulasRows.length > 0) {
          aulasRows.forEach((aula) => {
            if (aula.modulo_id) {
              if (!aulasPorModulo.has(aula.modulo_id)) {
                aulasPorModulo.set(aula.modulo_id, [])
              }
              aulasPorModulo.get(aula.modulo_id)!.push(aula)
            }
          })
        }

        // Construir árvore de frentes > módulos > aulas
        const arvore = frentesData.map((frente: FrenteData) => {
          const modulos = (modulosPorFrente.get(frente.id) || []).map((modulo: ModuloData) => {
            const aulas = aulasPorModulo.get(modulo.id) || []
            const totalAulas = aulas.length
            const tempoTotal = aulas.reduce(
              (acc: number, aula: AulaData) => acc + (aula.tempo_estimado_minutos ?? TEMPO_PADRAO_MINUTOS),
              0,
            )
            const concluidas = aulas.filter((aula: AulaData) => concluidasSet.has(aula.id)).length

            const importanciaValida: ModuloResumo['importancia'] =
              modulo.importancia === 'Alta' || modulo.importancia === 'Media' ||
                modulo.importancia === 'Baixa' || modulo.importancia === 'Base'
                ? modulo.importancia
                : null;

            return {
              id: modulo.id,
              nome: modulo.nome,
              numero_modulo: modulo.numero_modulo,
              totalAulas,
              tempoTotal,
              concluidas,
              importancia: importanciaValida,
            }
          })

          return {
            id: frente.id,
            nome: frente.nome,
            modulos,
          }
        })

        if (cancelled) {
          return
        }

        // Log detalhado antes de filtrar
        console.log('[ScheduleWizard] Frentes ANTES do filtro de módulos:', arvore.map(f => ({
          frente_id: f.id,
          frente_nome: f.nome,
          total_modulos: f.modulos.length,
          modulo_ids: f.modulos.map((m) => m.id)
        })))

        // Filtrar frentes que têm pelo menos um módulo
        const arvoreComModulos = arvore.filter((frente) => frente.modulos.length > 0)

        // Log de frentes excluídas
        const frentesExcluidas = arvore.filter((frente) => frente.modulos.length === 0)
        if (frentesExcluidas.length > 0) {
          console.warn('[ScheduleWizard] ⚠️⚠️⚠️ Frentes EXCLUÍDAS por não terem módulos:', frentesExcluidas.map(f => ({
            frente_id: f.id,
            frente_nome: f.nome
          })))
        }

        console.log('[ScheduleWizard] Frentes DEPOIS do filtro de módulos:', arvoreComModulos.map(f => ({
          frente_id: f.id,
          frente_nome: f.nome,
          total_modulos: f.modulos.length
        })))

        // Agrupar por disciplina
        const agrupadosPorDisciplina: Record<string, { disciplinaNome: string; frentes: FrenteResumo[] }> = {}
        arvoreComModulos.forEach((frente) => {
          const frenteData = frentesData.find((f: FrenteData) => f.id === frente.id)
          const disciplinaId = frenteData?.disciplina_id
          const disciplinaNome = (frenteData as { disciplinas?: { nome?: string } })?.disciplinas?.nome || 'Sem disciplina'

          if (!agrupadosPorDisciplina[disciplinaId || 'sem-id']) {
            agrupadosPorDisciplina[disciplinaId || 'sem-id'] = {
              disciplinaNome,
              frentes: [],
            }
          }
          agrupadosPorDisciplina[disciplinaId || 'sem-id'].frentes.push(frente)
        })

        setModulosCurso(arvoreComModulos)
        setModulosCursoAgrupadosPorDisciplina(agrupadosPorDisciplina)
        const todosModulos = arvoreComModulos.flatMap((frente) => frente.modulos.map((modulo) => modulo.id))

        console.log('[ScheduleWizard] Total de módulos selecionados:', todosModulos.length)
        console.log('[ScheduleWizard] Módulos selecionados por frente:',
          arvoreComModulos.map(f => ({
            frente_id: f.id,
            frente_nome: f.nome,
            total_modulos: f.modulos.length,
            modulo_ids: f.modulos.map((m) => m.id)
          }))
        )

        setModulosSelecionados(todosModulos)
        setCompletedLessonsCount(concluidasSet.size)
        setError(null)
      } catch (err: unknown) {
        const error = err as { message?: string; details?: string; hint?: string; code?: string };
        console.error('Erro ao carregar módulos do curso:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          error: err,
          cursoSelecionado,
          disciplinasIds,
          userId,
          errorString: String(err),
          errorJSON: JSON.stringify(err, Object.getOwnPropertyNames(err)),
          errorType: typeof err,
          errorKeys: err && typeof err === 'object' ? Object.keys(err) : [],
        })
        if (!cancelled) {
          setError(`Não foi possível carregar os módulos deste curso. ${error?.message || 'Erro desconhecido'}`)
        }
      } finally {
        if (!cancelled) {
          setModulosLoading(false)
        }
      }
    }

    loadModulosDoCurso()

    return () => {
      cancelled = true
    }
  }, [cursoSelecionado, userId, disciplinasIds, disciplinasIdsModulos])

  useEffect(() => {
    form.setValue('modulos_ids', modulosSelecionados)
  }, [modulosSelecionados, form])

  React.useEffect(() => {
    const disciplinasSelecionadas = disciplinasIds

    if (!disciplinasSelecionadas || disciplinasSelecionadas.length === 0) {
      setModalidadeStats({})
      setModalidadeStatsError(null)
      setModalidadeStatsLoading(false)
      return
    }

    let cancelled = false

    const calcularEstimativas = async () => {
      setModalidadeStatsLoading(true)
      setModalidadeStatsError(null)

      try {
        const supabase = createClient()
        // Type assertion needed because database types are currently out of sync with actual schema
        let query = supabase
          .from('aulas')
          .select(`
            id,
            tempo_estimado_minutos,
            prioridade,
            modulos!inner(
              id,
              frentes!inner(
                disciplina_id,
                curso_id
              )
            )
          `)
          .in('modulos.frentes.disciplina_id', disciplinasSelecionadas)

        // Filtrar por curso selecionado para evitar contar aulas de outros cursos
        // que compartilham a mesma disciplina
        if (cursoSelecionado) {
          query = query.eq('modulos.frentes.curso_id', cursoSelecionado)
        }

        const { data, error } = (await query) as {
            data: Array<{
              id: string;
              tempo_estimado_minutos: number | null;
              prioridade: number | null;
              modulos: { id: string; frentes: { disciplina_id: string; curso_id: string | null } }
            }> | null;
            error: unknown
          }

        if (error) {
          throw error
        }

        const stats = MODALIDADES.reduce<Record<number, ModalidadeStats>>((acc, modalidade) => {
          acc[modalidade.nivel] = {
            tempoAulaMinutos: 0,
            tempoEstudoMinutos: 0,
            totalAulas: 0,
          }
          return acc
        }, {})

        data?.forEach((aula) => {
          const tempoAula = Math.max(aula.tempo_estimado_minutos ?? TEMPO_PADRAO_MINUTOS, 0)
          const prioridade = Number(aula.prioridade ?? 0)

          MODALIDADES.forEach(({ nivel }) => {
            if (prioridade >= nivel) {
              stats[nivel].tempoAulaMinutos += tempoAula
              stats[nivel].tempoEstudoMinutos += tempoAula * FATOR_MULTIPLICADOR
              stats[nivel].totalAulas += 1
            }
          })
        })

        if (!cancelled) {
          setModalidadeStats(stats)
        }
      } catch (err) {
        console.error('Erro ao calcular estimativas por modalidade:', err)
        if (!cancelled) {
          setModalidadeStats({})
          setModalidadeStatsError('Não foi possível calcular as estimativas no momento.')
        }
      } finally {
        if (!cancelled) {
          setModalidadeStatsLoading(false)
        }
      }
    }

    calcularEstimativas()

    return () => {
      cancelled = true
    }
  }, [disciplinasIds, cursoSelecionado])

  const onSubmit = async (data: WizardFormData) => {
    // Validar que estamos no último step
    if (currentStep !== STEPS.length) {
      return
    }

    // Validar que o nome foi preenchido
    if (!data.nome || data.nome.trim().length === 0) {
      setError('Por favor, informe um nome para o cronograma')
      return
    }

    if (cursos.length > 0 && !data.curso_alvo_id) {
      setError('Selecione um curso antes de gerar o cronograma.')
      setCurrentStep(2)
      return
    }

    if (data.curso_alvo_id && modulosCurso.length > 0 && modulosSelecionados.length === 0) {
      setError('Selecione pelo menos um módulo do curso escolhido.')
      setCurrentStep(2)
      return
    }

    if (data.disciplinas_ids.length === 0) {
      setError('Selecione pelo menos uma disciplina antes de gerar o cronograma.')
      setCurrentStep(2)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Usuário não autenticado')
      }

      const requestBody = {
        aluno_id: user.id,
        data_inicio: format(data.data_inicio, 'yyyy-MM-dd'),
        data_fim: format(data.data_fim, 'yyyy-MM-dd'),
        ferias: data.ferias.map((periodo) => ({
          inicio: periodo.inicio ? format(periodo.inicio, 'yyyy-MM-dd') : '',
          fim: periodo.fim ? format(periodo.fim, 'yyyy-MM-dd') : '',
        })),
        horas_dia: data.horas_dia,
        dias_semana: data.dias_semana,
        prioridade_minima: data.prioridade_minima,
        disciplinas_ids: data.disciplinas_ids,
        modalidade: data.modalidade,
        curso_alvo_id: data.curso_alvo_id,
        nome: data.nome.trim(), // Garantir que não há espaços extras
        ordem_frentes_preferencia: data.ordem_frentes_preferencia,
        modulos_ids: data.modulos_ids && data.modulos_ids.length > 0 ? data.modulos_ids : undefined,
        excluir_aulas_concluidas: data.excluir_aulas_concluidas ?? true,
        velocidade_reproducao: data.velocidade_reproducao ?? 1.0,
      }

      // Log detalhado dos módulos sendo enviados
      console.log('[ScheduleWizard] ========== ENVIANDO PARA API ==========')
      console.log('[ScheduleWizard] Disciplinas selecionadas:', data.disciplinas_ids)
      console.log('[ScheduleWizard] Total de módulos selecionados:', data.modulos_ids?.length || 0)
      console.log('[ScheduleWizard] Módulos selecionados (primeiros 20):', data.modulos_ids?.slice(0, 20))

      // Verificar módulos por frente
      if (modulosCurso.length > 0 && data.modulos_ids) {
        const modulosPorFrenteEnvio = modulosCurso.map(frente => ({
          frente_id: frente.id,
          frente_nome: frente.nome,
          total_modulos_frente: frente.modulos.length,
          modulos_selecionados: frente.modulos.filter((m) => data.modulos_ids?.includes(m.id)).length,
          todos_selecionados: frente.modulos.every((m) => data.modulos_ids?.includes(m.id))
        }))
        console.log('[ScheduleWizard] Status de módulos por frente:', modulosPorFrenteEnvio)

        const frentesIncompletas = modulosPorFrenteEnvio.filter(f => !f.todos_selecionados || f.modulos_selecionados === 0)
        if (frentesIncompletas.length > 0) {
          console.warn('[ScheduleWizard] ⚠️⚠️⚠️ Frentes com módulos NÃO selecionados:', frentesIncompletas)
        }
      }
      console.log('[ScheduleWizard] =======================================')

      // Obter token de autenticação
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Sessão não encontrada')
      }

      // Chamar API local
      console.log('Invocando API local com body:', requestBody)

      let response: Response
      try {
        response = await fetch('/api/cronograma', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        })
      } catch (fetchError) {
        console.error('Erro ao fazer fetch:', fetchError)
        setError('Erro de conexão. Verifique sua internet e tente novamente.')
        setLoading(false)
        return
      }

      console.log('Status da resposta:', response.status, response.statusText)
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()))

      interface ApiResponse {
        id?: string;
        success?: boolean;
        error?: string;
        message?: string;
        details?: unknown;
        detalhes?: Record<string, unknown> | null;
        cronograma?: { id?: string };
        [key: string]: unknown;
      }
      let result: ApiResponse = {}
      const contentType = response.headers.get('content-type')

      try {
        const responseText = await response.text()
        console.log('Texto bruto da resposta:', responseText)

        if (contentType?.includes('application/json') && responseText) {
          try {
            result = JSON.parse(responseText)
            console.log('JSON parseado:', result)
          } catch (jsonError) {
            console.error('Erro ao fazer parse do JSON:', jsonError)
            result = { error: `Resposta inválida do servidor (${response.status})` }
          }
        } else if (responseText) {
          // Resposta não-JSON (ex: HTML de timeout do nginx) — mapear para mensagem amigável
          console.error('Resposta não é JSON:', responseText.substring(0, 200))
          result = { error: getHttpErrorMessage(response.status) }
        } else {
          result = { error: getHttpErrorMessage(response.status) }
        }
      } catch (parseError) {
        console.error('Erro ao processar resposta:', parseError)
        result = { error: `Erro ao processar resposta do servidor (${response.status})` }
      }

      console.log('Resultado final da API:', { result, status: response.status, ok: response.ok })

      if (!response.ok) {
        // Log apenas em desenvolvimento para reduzir ruído no console
        if (process.env.NODE_ENV === 'development') {
          console.error('Erro na API - Status:', response.status)
          console.error('Erro na API - Result:', result)
          console.error('Erro na API - Keys:', result ? Object.keys(result) : 'result é null/undefined')
        }

        // Verificar se é erro de tempo insuficiente (comparação mais flexível)
        const errorText = result?.error ? String(result.error).toLowerCase() : ''
        const isTempoInsuficiente = errorText.includes('tempo insuficiente') && result?.detalhes

        // Se o erro contém detalhes, mostrar mensagem mais específica
        if (isTempoInsuficiente) {
          const detalhes = (result?.detalhes || {}) as Record<string, unknown>
          const horasNecessarias = Number(detalhes.horas_necessarias) || 0
          const horasDisponiveis = Number(detalhes.horas_disponiveis) || 0
          const horasDiaNecessarias = Number(detalhes.horas_dia_necessarias) || 0

          console.log('Erro de tempo insuficiente detectado:', {
            horasNecessarias,
            horasDisponiveis,
            horasDiaNecessarias,
            detalhesCompletos: detalhes,
          })

          // Só mostrar o diálogo se tivermos detalhes válidos
          if (horasNecessarias > 0 || horasDisponiveis > 0) {
            setTempoInsuficienteDetalhes({
              horasNecessarias,
              horasDisponiveis,
              horasDiaNecessarias,
            })
            setShowTempoInsuficienteDialog(true)
            setError(
              `Tempo insuficiente! Necessário ${horasNecessarias}h, disponível ${horasDisponiveis}h. ` +
              (horasDiaNecessarias > 0 ? `Sugestão: ${horasDiaNecessarias}h por dia.` : '')
            )
          } else {
            // Se não temos detalhes, mostrar apenas a mensagem de erro
            const errorMessage = result?.error || 'Tempo insuficiente para gerar o cronograma'
            console.warn('Erro de tempo insuficiente sem detalhes completos')
            setError(String(errorMessage))
          }
        } else {
          // Extrair mensagem de erro de forma mais robusta
          const errorMessage =
            result?.error ||
            result?.message ||
            result?.details ||
            (typeof result === 'string' ? result : null) ||
            `Erro ${response.status}: ${response.statusText || 'Erro ao gerar cronograma'}`

          // Log apenas em desenvolvimento
          if (process.env.NODE_ENV === 'development') {
            console.error('Mensagem de erro final:', errorMessage)
            console.error('Result completo para debug:', JSON.stringify(result, null, 2))
          }
          setError(String(errorMessage))
        }
        setLoading(false)
        return
      }

      if (result?.success) {
        const newId = result.cronograma?.id
        const dest = newId ? `/cronograma/${newId}` : '/cronograma'
        router.push(tenant ? `/${tenant}${dest}` : dest)
      } else {
        setError('Erro desconhecido ao gerar cronograma')
        setLoading(false)
      }
    } catch (err: unknown) {
      console.error('Erro na requisição:', err)
      const error = err as { message?: string; name?: string };
      if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        setError('Erro de conexão. Verifique sua internet e tente novamente. Se o problema persistir, verifique se a Edge Function está configurada corretamente.')
      } else {
        setError(error.message || 'Erro ao gerar cronograma')
      }
      setLoading(false)
    }
  }

  const nextStep = async () => {
    // Step 2: validações manuais ANTES do Zod (pois campos podem estar ocultos)
    if (currentStep === 2) {
      if (cursos.length > 0 && !form.getValues('curso_alvo_id')) {
        setError('Selecione um curso antes de continuar.')
        return
      }
      if (cursoSelecionado && modulosCurso.length > 0 && modulosSelecionados.length === 0) {
        setError('Selecione pelo menos um módulo do curso escolhido.')
        return
      }
    }

    const fieldsToValidate = getFieldsForStep(currentStep)
    const isValid = await form.trigger(fieldsToValidate)

    if (isValid) {
      if (currentStep === 3) {
        if (form.getValues('disciplinas_ids').length === 0) {
          setError('Selecione pelo menos uma disciplina antes de continuar.')
          return
        }
      }
      setError(null)
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const getFieldsForStep = (step: number): (keyof WizardFormData)[] => {
    switch (step) {
      case 1:
        return ['data_inicio', 'data_fim', 'dias_semana', 'horas_dia']
      case 2:
        return ['disciplinas_ids']
      case 3:
        return ['prioridade_minima']
      case 4:
        return ['modalidade']
      default:
        return []
    }
  }

  const addFerias = () => {
    const ferias = form.getValues('ferias')
    form.setValue('ferias', [
      ...ferias,
      { inicio: undefined, fim: undefined },
    ])
  }

  const removeFerias = (index: number) => {
    const ferias = form.getValues('ferias')
    form.setValue('ferias', ferias.filter((_, i) => i !== index))
  }

  const handleToggleModulo = (moduloId: string, checked: boolean) => {
    setModulosSelecionados((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, moduloId]))
      }
      return prev.filter((id) => id !== moduloId)
    })
  }

  const handleToggleFrente = (frenteId: string, checked: boolean) => {
    const frente = modulosCurso.find((item) => item.id === frenteId)
    if (!frente) return
    const moduloIds = frente.modulos.map((modulo) => modulo.id)
    setModulosSelecionados((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...moduloIds]))
      }
      return prev.filter((id) => !moduloIds.includes(id))
    })
  }

  const selecionarTodosModulos = (checked: boolean) => {
    if (checked) {
      setModulosSelecionados(modulosCurso.flatMap((frente) => frente.modulos.map((modulo) => modulo.id)))
    } else {
      setModulosSelecionados([])
    }
  }

  const resetAfterSuggestion = (step: number) => {
    setShowTempoInsuficienteDialog(false)
    setCurrentStep(step)
    setError(null)
  }

  const handleAjustarDiasSemana = () => {
    if (!tempoInsuficienteDetalhes) return
    const horasDiaAtual = form.getValues('horas_dia') || 1
    const diasSemanaAtual = form.getValues('dias_semana') || 1
    const fator = horasDiaAtual > 0 ? tempoInsuficienteDetalhes.horasDiaNecessarias / horasDiaAtual : 1
    const novaQuantidade = Math.min(7, Math.max(diasSemanaAtual + 1, Math.ceil(diasSemanaAtual * fator)))
    form.setValue('dias_semana', Math.max(1, Math.min(7, novaQuantidade)))
    resetAfterSuggestion(1)
  }

  const handleAjustarHorasDia = () => {
    if (!tempoInsuficienteDetalhes) return
    const sugestao = Math.max(tempoInsuficienteDetalhes.horasDiaNecessarias, form.getValues('horas_dia'))
    form.setValue('horas_dia', Math.ceil(Math.max(1, sugestao)))
    resetAfterSuggestion(1)
  }

  const handleAjustarPrioridade = () => {
    const prioridadeAtual = form.getValues('prioridade_minima')
    if (prioridadeAtual > 1) {
      form.setValue('prioridade_minima', prioridadeAtual - 1)
    }
    resetAfterSuggestion(3)
  }

  const diasSemanaAtual = form.watch('dias_semana')
  const horasDiaAtual = form.watch('horas_dia')
  const prioridadeAtual = form.watch('prioridade_minima')
  const sugestaoDiasSemana = tempoInsuficienteDetalhes
    ? Math.min(
      7,
      Math.max(
        diasSemanaAtual + 1,
        Math.ceil(
          (tempoInsuficienteDetalhes.horasDiaNecessarias / Math.max(1, horasDiaAtual)) * Math.max(1, diasSemanaAtual),
        ),
      ),
    )
    : diasSemanaAtual
  const sugestaoHorasDia = tempoInsuficienteDetalhes
    ? Math.ceil(Math.max(horasDiaAtual, tempoInsuficienteDetalhes.horasDiaNecessarias))
    : horasDiaAtual
  const prioridadeSugerida = Math.max(1, prioridadeAtual - 1)

  if (loadingData) {
    return <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 pb-6">Carregando...</div>
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 pb-6">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-6">
          <div className="space-y-1">
            <CardTitle className="text-xl">Criar Cronograma de Estudos</CardTitle>
            <CardDescription>
              Passo {currentStep} de {STEPS.length} &mdash; {STEPS[currentStep - 1].title}
            </CardDescription>
          </div>
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const completed = currentStep > step.id
              const active = currentStep === step.id
              return (
                <React.Fragment key={step.id}>
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-colors duration-200 motion-reduce:transition-none',
                        completed
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : active
                            ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-sm'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {completed ? <Check className="h-4 w-4" /> : step.id}
                    </div>
                    <span
                      className={cn(
                        'text-xs text-center max-w-20 leading-tight hidden sm:block',
                        active ? 'font-semibold text-foreground' : completed ? 'font-medium text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 mx-1 sm:mx-2 rounded-full transition-colors duration-300 motion-reduce:transition-none',
                        currentStep > step.id + 1
                          ? 'bg-primary'
                          : currentStep > step.id
                                ? 'bg-linear-to-r from-primary to-muted'
                            : 'bg-muted',
                      )}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              // Só submete se estiver no último step e o nome estiver preenchido
              if (currentStep === STEPS.length && form.watch('nome')?.trim()) {
                form.handleSubmit(onSubmit)(e)
              }
            }}
            className="space-y-6"
          >
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Algo deu errado</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {/* Step 1: Definições de Tempo */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de Início</Label>
                    <DatePicker
                      value={form.watch('data_inicio') || null}
                      onChange={(date) => {
                        if (date) {
                          form.setValue('data_inicio', date)
                        }
                      }}
                      placeholder="dd/mm/yyyy"
                      error={form.formState.errors.data_inicio?.message}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Data de Término</Label>
                    <DatePicker
                      value={form.watch('data_fim') || null}
                      onChange={(date) => {
                        if (date) {
                          form.setValue('data_fim', date)
                        }
                      }}
                      placeholder="dd/mm/yyyy"
                      error={form.formState.errors.data_fim?.message}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Dias de estudo por semana: {form.watch('dias_semana')}</Label>
                  <Slider
                    value={[form.watch('dias_semana')]}
                    onValueChange={([value]) => form.setValue('dias_semana', value)}
                    min={1}
                    max={7}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Horas de estudo por dia</Label>
                  <Input
                    type="number"
                    min={1}
                    {...form.register('horas_dia', { valueAsNumber: true })}
                  />
                  {form.formState.errors.horas_dia && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.horas_dia.message}
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Períodos de Férias/Folgas</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addFerias}>
                      Adicionar Período
                    </Button>
                  </div>
                  {form.watch('ferias').map((periodo, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs">Início</Label>
                        <DatePicker
                          value={periodo.inicio || null}
                          onChange={(date) => {
                            const ferias = form.getValues('ferias')
                            ferias[index].inicio = date || undefined
                            form.setValue('ferias', ferias)
                          }}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">Fim</Label>
                        <DatePicker
                          value={periodo.fim || null}
                          onChange={(date) => {
                            const ferias = form.getValues('ferias')
                            ferias[index].fim = date || undefined
                            form.setValue('ferias', ferias)
                          }}
                          placeholder="dd/mm/yyyy"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFerias(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Disciplinas e Módulos */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Seleção de Curso */}
                <div className="space-y-2">
                  <Label>Curso *</Label>
                  {cursos.length === 0 ? (
                    <div className="p-4 border rounded-md bg-muted/50">
                      <p className="text-sm text-muted-foreground">
                        Você não possui cursos cadastrados. Entre em contato com o administrador.
                      </p>
                    </div>
                  ) : (
                    <Select
                      value={cursoSelecionado || undefined}
                      onValueChange={(value) => form.setValue('curso_alvo_id', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um curso" />
                      </SelectTrigger>
                      <SelectContent>
                        {cursos.map((curso) => (
                          <SelectItem key={curso.id} value={curso.id}>
                            {curso.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {!cursoSelecionado && cursos.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Escolha o curso para carregar as disciplinas e módulos disponíveis.
                    </p>
                  )}
                </div>

                {/* Seleção de Disciplinas - DEVE VIR ANTES DOS MÓDULOS */}
                {cursoSelecionado && (
                  <div className="space-y-2">
                    <Label>Disciplinas do Curso *</Label>
                    {disciplinasDoCurso.length === 0 ? (
                      <div className="p-4 border rounded-md bg-muted/50">
                        <p className="text-xs text-muted-foreground">
                          Este curso não possui disciplinas cadastradas.
                        </p>
                      </div>
                    ) : disciplinasDoCurso.length === 1 ? (
                      <div className="p-4 border rounded-md bg-muted">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={disciplinasDoCurso[0].id}
                            checked={form.watch('disciplinas_ids').includes(disciplinasDoCurso[0].id)}
                            disabled={true}
                          />
                          <Label htmlFor={disciplinasDoCurso[0].id} className="font-normal">
                            {disciplinasDoCurso[0].nome}
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Este curso possui apenas uma disciplina e será incluída automaticamente.
                        </p>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground mb-2">
                          Selecione quais disciplinas deste curso você deseja incluir no cronograma:
                        </p>
                        <div className="grid grid-cols-2 gap-4 max-h-64 overflow-y-auto p-4 border rounded-md">
                          {disciplinasDoCurso.map((disciplina) => (
                            <div key={disciplina.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={disciplina.id}
                                checked={form.watch('disciplinas_ids').includes(disciplina.id)}
                                onCheckedChange={(checked) => {
                                  const ids = form.getValues('disciplinas_ids')
                                  if (checked) {
                                    form.setValue('disciplinas_ids', [...ids, disciplina.id])
                                  } else {
                                    form.setValue('disciplinas_ids', ids.filter((id) => id !== disciplina.id))
                                  }
                                }}
                              />
                              <Label htmlFor={disciplina.id} className="font-normal cursor-pointer">
                                {disciplina.nome}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {form.formState.errors.disciplinas_ids && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.disciplinas_ids.message}
                      </p>
                    )}
                  </div>
                )}

                {/* Seleção de Módulos - APÓS AS DISCIPLINAS */}
                {cursoSelecionado && form.watch('disciplinas_ids').length > 0 && (
                  <div className="space-y-3 rounded-md border p-4">
                    {cursoAtual?.nome && (
                      <p className="text-xs text-muted-foreground">
                        Conteúdos vinculados ao curso <span className="font-semibold">{cursoAtual.nome}</span>
                      </p>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <Label className="text-sm font-medium">Módulos deste curso</Label>
                        {modulosCurso.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {modulosSelecionados.length} módulo(s) selecionados de{' '}
                            {modulosCurso.reduce((acc, frente) => acc + frente.modulos.length, 0)} disponíveis.
                          </p>
                        )}
                        {modulosCurso.length === 0 && !modulosLoading && (
                          <p className="text-xs text-muted-foreground">
                            Ainda não há módulos vinculados a este curso para as disciplinas selecionadas.
                          </p>
                        )}
                      </div>
                      {modulosCurso.length > 0 && (
                        <div className="flex items-center gap-2 text-xs">
                          <Button size="sm" variant="outline" onClick={() => selecionarTodosModulos(true)}>
                            Selecionar todos
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => selecionarTodosModulos(false)}>
                            Limpar seleção
                          </Button>
                        </div>
                      )}
                    </div>
                    {modulosLoading ? (
                      <p className="text-sm text-muted-foreground">Carregando módulos...</p>
                    ) : modulosCurso.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Não encontramos módulos vinculados a este curso para as disciplinas selecionadas.
                      </p>
                    ) : Object.keys(modulosCursoAgrupadosPorDisciplina).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(modulosCursoAgrupadosPorDisciplina).map(([disciplinaId, grupo]) => (
                          <div key={disciplinaId} className="rounded-md border p-4 space-y-3">
                            <div className="flex items-center justify-between border-b pb-2">
                              <h4 className="font-semibold text-sm">{grupo.disciplinaNome}</h4>
                              <span className="text-xs text-muted-foreground">
                                {grupo.frentes.length} frente(s)
                              </span>
                            </div>
                            <Accordion type="multiple" className="space-y-2">
                              {grupo.frentes.map((frente) => {
                                const selecionadosNaFrente = frente.modulos.filter((modulo) =>
                                  modulosSelecionados.includes(modulo.id),
                                ).length
                                const frenteChecked =
                                  frente.modulos.length > 0 && selecionadosNaFrente === frente.modulos.length
                                    ? true
                                    : selecionadosNaFrente > 0
                                      ? 'indeterminate'
                                      : false
                                return (
                                  <AccordionItem key={frente.id} value={frente.id} className="rounded-md border">
                                    <div className="flex items-center gap-3 px-4">
                                      <Checkbox
                                        id={`frente-${frente.id}`}
                                        checked={frenteChecked}
                                        onCheckedChange={(checked) =>
                                          handleToggleFrente(frente.id, Boolean(checked))
                                        }
                                      />
                                      <AccordionPrimitive.Header className="flex flex-1">
                                        <AccordionPrimitive.Trigger
                                          className={cn(
                                            'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-center justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-colors outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180',
                                          )}
                                        >
                                          <div className="text-left">
                                            <p className="font-medium">{frente.nome}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {frente.modulos.length} módulo(s)
                                            </p>
                                          </div>
                                          <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
                                        </AccordionPrimitive.Trigger>
                                      </AccordionPrimitive.Header>
                                    </div>
                                    <AccordionContent>
                                      <div className="space-y-2 border-t px-4 py-3">
                                        {frente.modulos.map((modulo) => (
                                          <div
                                            key={modulo.id}
                                            className="flex flex-col gap-1 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                                          >
                                            <div className="flex items-center gap-2">
                                              <Checkbox
                                                id={`modulo-${modulo.id}`}
                                                checked={modulosSelecionados.includes(modulo.id)}
                                                onCheckedChange={(checked) =>
                                                  handleToggleModulo(modulo.id, Boolean(checked))
                                                }
                                                onClick={(event) => event.stopPropagation()}
                                              />
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <p className="font-medium">{modulo.nome}</p>
                                                  {modulo.importancia && (
                                                    <div className="flex items-center gap-1">
                                                      <Badge
                                                        variant={
                                                          modulo.importancia === 'Alta'
                                                            ? 'destructive'
                                                            : modulo.importancia === 'Media'
                                                              ? 'default'
                                                              : modulo.importancia === 'Baixa'
                                                                ? 'secondary'
                                                                : 'outline'
                                                        }
                                                        className="text-xs"
                                                      >
                                                        {modulo.importancia === 'Alta'
                                                          ? 'Alta'
                                                          : modulo.importancia === 'Media'
                                                            ? 'Média'
                                                            : modulo.importancia === 'Baixa'
                                                              ? 'Baixa'
                                                              : 'Base'}
                                                      </Badge>
                                                      <TooltipProvider>
                                                        <Tooltip>
                                                          <TooltipTrigger asChild>
                                                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                                                          </TooltipTrigger>
                                                          <TooltipContent side="right" className="max-w-xs">
                                                            <div className="space-y-2">
                                                              <p className="font-semibold">Importância do Módulo</p>
                                                              <p className="text-xs leading-relaxed">
                                                                Este indicador mostra a <strong>importância e recorrência</strong> deste módulo nas provas mais tradicionais do país (ENEM, FUVEST, UNICAMP, UERJ, entre outras).
                                                              </p>
                                                              <p className="text-xs leading-relaxed">
                                                                A classificação foi definida pelo seu professor com base na análise histórica de questões e na relevância dos conteúdos.
                                                              </p>
                                                              <div className="pt-1 border-t border-background/20">
                                                                <p className="text-xs font-semibold mb-1">O que significa cada nível?</p>
                                                                <ul className="text-xs space-y-1 list-disc list-inside">
                                                                  <li><strong>Alta:</strong> Aparece frequentemente e é essencial para a aprovação</li>
                                                                  <li><strong>Média:</strong> Importante, mas com recorrência moderada</li>
                                                                  <li><strong>Baixa:</strong> Menos frequente, mas ainda relevante</li>
                                                                  <li><strong>Base:</strong> Conhecimento fundamental que serve de alicerce para outros conteúdos</li>
                                                                </ul>
                                                              </div>
                                                            </div>
                                                          </TooltipContent>
                                                        </Tooltip>
                                                      </TooltipProvider>
                                                    </div>
                                                  )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                  {modulo.totalAulas} aula(s) • {formatHorasFromMinutes(modulo.tempoTotal)}
                                                </p>
                                              </div>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {modulo.concluidas > 0 ? (
                                                <span className="text-green-600 dark:text-green-400">
                                                  {modulo.concluidas} aula(s) já concluídas
                                                </span>
                                              ) : (
                                                <span>Nenhuma aula concluída</span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </AccordionContent>
                                  </AccordionItem>
                                )
                              })}
                            </Accordion>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Não há módulos agrupados por disciplina.
                      </p>
                    )}

                    {cursoSelecionado && modulosCurso.length > 0 && modulosSelecionados.length === 0 && (
                      <p className="text-xs text-destructive">
                        Selecione pelo menos um módulo para gerar o cronograma.
                      </p>
                    )}
                  </div>
                )}

                {/* Box separado para Excluir aulas já concluídas */}
                {cursoSelecionado && modulosCurso.length > 0 && (
                  <div className="space-y-3 rounded-md border p-4">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="excluir-concluidas"
                        checked={form.watch('excluir_aulas_concluidas') ?? true}
                        onCheckedChange={(checked) =>
                          form.setValue('excluir_aulas_concluidas', Boolean(checked))
                        }
                      />
                      <div className="space-y-1">
                        <Label htmlFor="excluir-concluidas" className="text-sm font-medium">
                          Excluir aulas já concluídas
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Detectamos {completedLessonsCount} aula(s) concluídas neste curso.
                          Ao manter essa opção marcada, elas serão removidas do novo cronograma.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Modalidade */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label>Modalidade</Label>
                  <div className="flex flex-wrap justify-center gap-4">
                    {MODALIDADES.map(({ nivel, label, descricao, texto, tempo }) => {
                      const Icon = MODALIDADE_ICONS[nivel]
                      const selected = form.watch('prioridade_minima') === nivel
                      const abrangencia = 6 - nivel
                      return (
                        <Card
                          key={nivel}
                          className={cn(
                            'cursor-pointer transition-colors duration-200 motion-reduce:transition-none relative group flex flex-col',
                            'w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)]',
                            selected
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                              : 'hover:bg-muted/50 hover:shadow-sm',
                          )}
                          onClick={() => form.setValue('prioridade_minima', nivel)}
                        >
                          {selected && (
                            <div className="absolute top-3 right-3">
                              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                          <CardContent className="p-5 space-y-4 flex flex-col flex-1">
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                                  selected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="space-y-0.5 min-w-0">
                                <div className="font-bold text-base text-foreground leading-tight">{label}</div>
                                <div className="text-xs font-medium text-primary">{descricao}</div>
                              </div>
                              {nivel === 2 && (
                                <Badge variant="secondary" className="ml-auto shrink-0 text-[10px] px-1.5 py-0">
                                  Popular
                                </Badge>
                              )}
                            </div>

                            {/* Abrangência meter */}
                            <div className="space-y-1">
                              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                                Abrangência
                              </span>
                              <div className="flex gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      'h-1.5 flex-1 rounded-full transition-colors',
                                      i < abrangencia ? 'bg-primary' : 'bg-muted',
                                    )}
                                  />
                                ))}
                              </div>
                            </div>

                            <p className="text-sm text-muted-foreground leading-relaxed flex-1">{texto}</p>

                            <div className="flex items-center gap-1.5 text-xs font-medium text-primary pt-1">
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                              <span>{tempo.replace('⏱️ ', '')}</span>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Estratégia de Estudo */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <Label>Tipo de Estudo</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {([
                      {
                        value: 'paralelo' as const,
                        label: 'Frentes em Paralelo',
                        icon: LayoutGrid,
                        description: 'Toda semana você estuda todas as disciplinas e todas as frentes, com uma distribuição equilibrada para concluir tudo próximo do fim do período.',
                        badge: 'Recomendado',
                      },
                      {
                        value: 'sequencial' as const,
                        label: 'Estudo Sequencial',
                        icon: ListOrdered,
                        description: 'Toda semana você estuda 1 frente de cada disciplina. Quando a frente de uma disciplina terminar, na semana seguinte você passa para a próxima frente daquela disciplina.',
                        badge: 'Tradicional',
                      },
                    ] as const).map(({ value, label, icon: Icon, description, badge }) => {
                      const selected = form.watch('modalidade') === value
                      return (
                        <Card
                          key={value}
                          className={cn(
                            'cursor-pointer transition-colors duration-200 motion-reduce:transition-none relative group',
                            selected
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                              : 'hover:bg-muted/50 hover:shadow-sm',
                          )}
                          onClick={() => form.setValue('modalidade', value)}
                        >
                          {selected && (
                            <div className="absolute top-3 right-3">
                              <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                                <Check className="h-3 w-3 text-primary-foreground" />
                              </div>
                            </div>
                          )}
                          <CardContent className="p-5 space-y-3">
                            <div className="flex items-start gap-3">
                              <div
                                className={cn(
                                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
                                  selected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="space-y-0.5">
                                <div className="font-bold text-base text-foreground leading-tight">{label}</div>
                                <Badge
                                  variant={value === 'paralelo' ? 'default' : 'secondary'}
                                  className={cn(
                                    'text-[10px] px-1.5 py-0',
                                    value === 'paralelo' && 'bg-primary text-primary-foreground',
                                  )}
                                >
                                  {badge}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Em qual velocidade você assiste as aulas?</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {([
                      { value: '1.00', display: '1,00x', subtitle: 'Ideal' },
                      { value: '1.25', display: '1,25x', subtitle: 'Até que vai...' },
                      { value: '1.50', display: '1,50x', subtitle: 'Não recomendo...' },
                      { value: '2.00', display: '2,00x', subtitle: 'Você pirou?' },
                    ]).map(({ value, display, subtitle }) => {
                      const selected = (form.watch('velocidade_reproducao') ?? 1.0).toFixed(2) === value
                      return (
                        <button
                          key={value}
                          type="button"
                          className={cn(
                            'rounded-xl border p-4 text-center transition-colors duration-200 motion-reduce:transition-none relative',
                            selected
                              ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                              : 'hover:bg-muted/50 hover:shadow-sm',
                          )}
                          onClick={() => form.setValue('velocidade_reproducao', Number(value))}
                        >
                          {value === '1.00' && (
                            <Badge variant="secondary" className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0">
                              Ideal
                            </Badge>
                          )}
                          <div className={cn(
                            'text-xl font-bold transition-colors',
                            selected ? 'text-primary' : 'text-foreground',
                          )}>
                            {display}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1">{subtitle}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <Separator />

                {/* Exibir tempos recalculados baseados na velocidade */}
                {form.watch('disciplinas_ids').length > 0 && (
                  <Card className="overflow-hidden">
                    <CardHeader>
                      <CardTitle className="text-base">Tempos Recalculados</CardTitle>
                      <CardDescription className="text-xs">
                        Valores ajustados considerando a velocidade de reprodução selecionada e o tempo de estudo
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {modalidadeStatsLoading ? (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Calculando...
                        </div>
                      ) : modalidadeStatsError ? (
                        <p className="text-destructive text-sm py-4">{modalidadeStatsError}</p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          {MODALIDADES.map(({ nivel, label }) => {
                            const stats = modalidadeStats[nivel]
                            if (!stats) return null

                            const velocidade = form.watch('velocidade_reproducao') || 1.0
                            // Tempo de aula ajustado pela velocidade
                            const tempoAulaAjustado = stats.tempoAulaMinutos / velocidade
                            // Tempo de estudo = tempo de aula ajustado * (FATOR_MULTIPLICADOR - 1)
                            const tempoEstudoAjustado = tempoAulaAjustado * (FATOR_MULTIPLICADOR - 1)
                            const isSelected = form.watch('prioridade_minima') === nivel
                            const Icon = MODALIDADE_ICONS[nivel]

                            return (
                              <Card
                                key={nivel}
                                className={cn(
                                  'p-3 transition-colors duration-200 motion-reduce:transition-none',
                                  isSelected && 'border-primary bg-primary/5 ring-1 ring-primary/20',
                                )}
                              >
                                <div className="text-center space-y-2">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Icon className={cn(
                                      'h-3.5 w-3.5',
                                      isSelected ? 'text-primary' : 'text-muted-foreground',
                                    )} />
                                    <div className={cn(
                                      'font-bold text-xs',
                                      isSelected && 'text-primary',
                                    )}>
                                      {label}
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                      Selecionada
                                    </Badge>
                                  )}
                                  <div className="space-y-1 text-xs">
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        Tempo de aula
                                      </p>
                                      <p className={cn(
                                        'text-sm font-semibold',
                                        isSelected && 'text-primary',
                                      )}>
                                        {formatHorasFromMinutes(tempoAulaAjustado)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                        Tempo de estudo
                                      </p>
                                      <p className={cn(
                                        'text-sm font-semibold',
                                        isSelected && 'text-primary',
                                      )}>
                                        {formatHorasFromMinutes(Math.round(tempoEstudoAjustado))}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </Card>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {form.watch('modalidade') === 'sequencial' && frenteOrderItems.length > 1 && (
                  <div className="space-y-2">
                    <Label>Ordem de Estudo das Frentes</Label>
                    <p className="text-sm text-muted-foreground">
                      {isMultiDisciplina
                        ? 'Arraste para definir a ordem de estudo das frentes dentro de cada disciplina.'
                        : 'Arraste para definir a ordem em que as frentes serão estudadas.'}
                    </p>
                    <FrenteOrderDragDrop
                      frentes={frenteOrderItems}
                      onOrderChange={(orderedNames) => {
                        form.setValue('ordem_frentes_preferencia', orderedNames)
                      }}
                      isMultiDisciplina={isMultiDisciplina}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Revisão e Geração */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Nome do Cronograma *</Label>
                  <Input
                    placeholder="Ex: Meu Cronograma de Estudos 2024"
                    {...form.register('nome')}
                  />
                  {form.formState.errors.nome && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.nome.message}
                    </p>
                  )}
                </div>

                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-base">Resumo da Configuração</CardTitle>
                    <CardDescription>Confira os dados antes de gerar seu cronograma</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5 text-sm">
                    {/* Período e Rotina */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>Período e Rotina</span>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Período</span>
                          <span className="font-medium">
                            {form.watch('data_inicio') ? format(form.watch('data_inicio')!, "dd/MM/yyyy", { locale: ptBR }) : '--'} - {' '}
                            {form.watch('data_fim') ? format(form.watch('data_fim')!, "dd/MM/yyyy", { locale: ptBR }) : '--'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Dias por semana</span>
                          <span className="font-medium">{form.watch('dias_semana')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Horas por dia</span>
                          <span className="font-medium">{form.watch('horas_dia')}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Semanas disponíveis</span>
                          <span className="font-medium">
                            {calcularSemanasDisponibilizadas(
                              form.watch('data_inicio'),
                              form.watch('data_fim'),
                              form.watch('ferias')
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Semanas do cronograma</span>
                          <span className="font-medium text-primary">
                            {calcularSemanasCronograma(
                              modalidadeStats,
                              form.watch('prioridade_minima'),
                              form.watch('velocidade_reproducao') ?? 1.0,
                              form.watch('horas_dia'),
                              form.watch('dias_semana')
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Curso e Disciplinas */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <BookOpen className="h-4 w-4 text-primary" />
                        <span>Curso e Disciplinas</span>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                        {cursoAtual?.nome && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Curso</span>
                            <span className="font-medium">{cursoAtual.nome}</span>
                          </div>
                        )}
                        {form.watch('disciplinas_ids').length === 0 ? (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Disciplinas</span>
                            <span className="text-muted-foreground">Nenhuma selecionada</span>
                          </div>
                        ) : (
                          <>
                            {cursoAtual?.nome && <Separator />}
                            {disciplinasDoCurso
                              .filter((d) => form.watch('disciplinas_ids').includes(d.id))
                              .map((disciplina) => {
                                const grupoDisciplina = modulosCursoAgrupadosPorDisciplina[disciplina.id]
                                let horasTotais = 0
                                if (grupoDisciplina) {
                                  grupoDisciplina.frentes.forEach((frente) => {
                                    frente.modulos.forEach((modulo) => {
                                      if (modulosSelecionados.includes(modulo.id)) {
                                        horasTotais += modulo.tempoTotal || 0
                                      }
                                    })
                                  })
                                }
                                return (
                                  <div key={disciplina.id} className="flex justify-between">
                                    <span className="text-muted-foreground">{disciplina.nome}</span>
                                    <span className="font-medium">{horasTotais > 0 ? formatHorasFromMinutes(horasTotais) : '--'}</span>
                                  </div>
                                )
                              })}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Estratégia */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-foreground">
                        <Target className="h-4 w-4 text-primary" />
                        <span>Estratégia</span>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Modalidade</span>
                          <Badge variant="secondary" className="text-xs font-medium">
                            {{
                              1: 'Super Extensivo',
                              2: 'Extensivo',
                              3: 'Semi Extensivo',
                              4: 'Intensivo',
                              5: 'Superintensivo',
                            }[form.watch('prioridade_minima')] || 'Não definida'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tipo de Estudo</span>
                          <Badge variant="secondary" className="text-xs font-medium capitalize">
                            {form.watch('modalidade')}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Pausas e Recessos */}
                    {form.watch('ferias').length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <span>Pausas e Recessos</span>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                          {form.watch('ferias').map((periodo, index) => {
                            if (!periodo.inicio || !periodo.fim) return null
                            return (
                              <div key={index} className="flex items-center gap-2 text-muted-foreground">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                                <span>
                                  {format(periodo.inicio, "dd/MM/yyyy", { locale: ptBR })} -{' '}
                                  {format(periodo.fim, "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

              </div>
            )}

            <Separator />
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={prevStep}
                disabled={currentStep === 1}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground hidden sm:block">
                {currentStep} de {STEPS.length}
              </span>
              {currentStep < STEPS.length ? (
                <Button type="button" size="lg" onClick={nextStep}>
                  Próximo
                </Button>
              ) : (
                <div className="flex flex-col items-end gap-1">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={loading || !form.watch('nome') || form.watch('nome')?.trim().length === 0}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Gerando Cronograma...
                      </>
                    ) : (
                      'Gerar Cronograma Inteligente'
                    )}
                  </Button>
                  {!loading && (!form.watch('nome') || form.watch('nome')?.trim().length === 0) && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Preencha o nome do cronograma para continuar
                    </p>
                  )}
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
      <AlertDialog
        open={showTempoInsuficienteDialog}
        onOpenChange={(open) => {
          setShowTempoInsuficienteDialog(open)
          if (!open) {
            setCurrentStep(1)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vamos ajustar seu cronograma</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 *:block">
              <span>
                Detectamos tempo insuficiente para cobrir todo o conteúdo ({tempoInsuficienteDetalhes?.horasDisponiveis ?? 0}h
                disponíveis contra {tempoInsuficienteDetalhes?.horasNecessarias ?? 0}h necessárias).
              </span>
              <span>Escolha uma das sugestões abaixo para voltar e ajustar suas preferências:</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div className="border rounded-md p-4 space-y-2">
              <p className="font-medium">1. Aumentar dias de estudo na semana</p>
              <p className="text-muted-foreground">
                Mantenha as {horasDiaAtual}h/dia e tente estudar cerca de {sugestaoDiasSemana} dias por semana (máximo 7).
              </p>
              <Button variant="outline" onClick={handleAjustarDiasSemana}>
                Ajustar dias e voltar para o passo 1
              </Button>
            </div>
            <div className="border rounded-md p-4 space-y-2">
              <p className="font-medium">2. Aumentar horas por dia</p>
              <p className="text-muted-foreground">
                Considere elevar sua carga diária para aproximadamente {sugestaoHorasDia}h/dia mantendo {diasSemanaAtual} dias.
              </p>
              <Button variant="outline" onClick={handleAjustarHorasDia}>
                Ajustar horas e voltar para o passo 1
              </Button>
            </div>
            <div className="border rounded-md p-4 space-y-2">
              <p className="font-medium">3. Reduzir prioridade mínima</p>
              <p className="text-muted-foreground">
                Ao diminuir a prioridade para {prioridadeSugerida}, menos conteúdos obrigatórios serão incluídos.
              </p>
              <Button variant="outline" onClick={handleAjustarPrioridade}>
                Ajustar prioridade e voltar para o passo 3
              </Button>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowTempoInsuficienteDialog(false)
                setCurrentStep(1)
              }}
            >
              Ajustarei manualmente
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowTempoInsuficienteDialog(false)
                setCurrentStep(1)
              }}
            >
              Voltar para configurações
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

