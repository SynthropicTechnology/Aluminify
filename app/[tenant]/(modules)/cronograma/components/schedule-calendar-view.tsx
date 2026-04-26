'use client'

import React from 'react'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/app/shared/core/client'
import { CalendarDatePicker } from '@/components/shared/calendar-date-picker'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/app/shared/components/forms/checkbox'
import { Progress } from '@/app/shared/components/feedback/progress'
import { Skeleton } from '@/app/shared/components/feedback/skeleton'
import { Button } from '@/components/ui/button'
import { Label } from '@/app/shared/components/forms/label'
import { format, addDays, startOfWeek, addMonths, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'
import { DateRange } from 'react-day-picker'
import { cn } from '@/shared/library/utils'
import { Calendar } from '@/app/shared/components/forms/calendar'
import { Loader2, Save, ChevronDown, ChevronUp, CheckSquare2, ChevronLeft, ChevronRight, CalendarCheck, Info } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/app/shared/components/overlay/tooltip'
import { useSwipe } from '@/hooks/use-swipe'
import { useIsMobile } from '@/hooks/use-mobile'

// Types for Map values in data loading
interface ModuloMapValue {
  id: string
  nome: string
  numero_modulo: number | null
  frente_id: string
}

interface FrenteMapValue {
  id: string
  nome: string
  disciplina_id: string
}

interface DisciplinaMapValue {
  id: string
  nome: string
}

// Type for Aula data from Supabase queries
interface AulaData {
  id: string
  nome: string
  numero_aula: number | null
  tempo_estimado_minutos: number | null
  curso_id: string | null
  modulo_id: string | null
}

interface CronogramaItem {
  id: string
  tipo: 'aula' | 'questoes_revisao'
  aula_id: string | null
  frente_id: string | null
  frente_nome_snapshot: string | null
  mensagem: string | null
  duracao_sugerida_minutos: number | null
  semana_numero: number
  ordem_na_semana: number
  concluido: boolean
  data_conclusao: string | null
  data_prevista: string | null
  aulas: {
    id: string
    nome: string
    numero_aula: number | null
    tempo_estimado_minutos: number | null
    curso_id: string | null
    modulos: {
      id: string
      nome: string
      numero_modulo: number | null
      frentes: {
        id: string
        nome: string
        disciplinas: {
          id: string
          nome: string
        }
      }
    }
  } | null
}

interface Cronograma {
  id: string
  nome: string
  data_inicio: string
  data_fim: string
  dias_estudo_semana: number
  horas_estudo_dia: number
  modalidade_estudo: 'paralelo' | 'sequencial'
  cronograma_itens: CronogramaItem[]
  curso_alvo_id?: string | null
  periodos_ferias?: Array<{ inicio: string; fim: string }>
  velocidade_reproducao?: number
}

interface ScheduleCalendarViewProps {
  cronogramaId?: string
  cronogramaIds?: string[]
  mode?: 'single' | 'consolidated'
}

interface ItemComData extends CronogramaItem {
  data: Date
}

interface SemanaEstatisticas {
  semana_numero: number
  data_inicio: string
  data_fim: string
  capacidade_minutos: number
  tempo_usado_minutos: number
  tempo_disponivel_minutos: number
  percentual_usado: number
  is_ferias: boolean
  total_aulas: number
  aulas_concluidas: number
  aulas_pendentes: number
}

interface EstatisticasSemanasResult {
  success: true
  semanas: SemanaEstatisticas[]
  resumo: {
    total_semanas: number
    semanas_uteis: number
    semanas_ferias: number
    capacidade_total_minutos: number
    tempo_total_usado_minutos: number
    tempo_total_disponivel_minutos: number
    percentual_medio_usado: number
    total_aulas: number
    total_aulas_concluidas: number
    semanas_sobrecarregadas: number
  }
}

const DIAS_SEMANA = [
  { valor: 0, nome: 'Domingo', abreviacao: 'Dom' },
  { valor: 1, nome: 'Segunda-feira', abreviacao: 'Seg' },
  { valor: 2, nome: 'Terça-feira', abreviacao: 'Ter' },
  { valor: 3, nome: 'Quarta-feira', abreviacao: 'Qua' },
  { valor: 4, nome: 'Quinta-feira', abreviacao: 'Qui' },
  { valor: 5, nome: 'Sexta-feira', abreviacao: 'Sex' },
  { valor: 6, nome: 'Sábado', abreviacao: 'Sáb' },
]

// Helper para normalizar data para dataKey (yyyy-MM-dd) sempre no horário local
const normalizarDataParaKey = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper para obter o número da semana de uma data baseado na data_inicio do cronograma
const getSemanaNumero = (date: Date, dataInicio?: string | null): number | null => {
  if (!dataInicio) return null

  const inicio = new Date(dataInicio)
  const data = new Date(date)

  // Normalizar para meia-noite para comparação
  inicio.setHours(0, 0, 0, 0)
  data.setHours(0, 0, 0, 0)

  // Calcular diferença em dias
  const diffTime = data.getTime() - inicio.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Calcular número da semana (semana 1 começa na data_inicio)
  const semanaNumero = Math.floor(diffDays / 7) + 1

  return semanaNumero
}

// Helper para formatar minutos em horas e minutos
const formatarMinutos = (minutos: number): string => {
  const horas = Math.floor(minutos / 60)
  const mins = Math.round(minutos % 60)
  if (horas === 0) {
    return `${mins}min`
  }
  if (mins === 0) {
    return `${horas}h`
  }
  return `${horas}h ${mins}min`
}

export function ScheduleCalendarView({ cronogramaId, cronogramaIds, mode = 'single' }: ScheduleCalendarViewProps) {
  const isConsolidated = mode === 'consolidated' && cronogramaIds && cronogramaIds.length > 0
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [cronograma, setCronograma] = useState<Cronograma | null>(null)
  const [itensPorData, setItensPorData] = useState<Map<string, ItemComData[]>>(new Map())
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  // Handler customizado para permitir seleção livre do range
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    // Se já temos um range completo (from e to) e o usuário clicou em uma nova data,
    // resetar o range e começar um novo com a data clicada como from
    if (dateRange?.from && dateRange?.to && range?.from) {
      const clickedDate = range.from
      const currentFrom = dateRange.from
      const currentTo = dateRange.to

      // Normalizar datas para comparar apenas dia/mês/ano (sem hora)
      const normalizeDate = (d: Date) => {
        const normalized = new Date(d)
        normalized.setHours(0, 0, 0, 0)
        return normalized
      }

      const clickedNormalized = normalizeDate(clickedDate)
      const fromNormalized = normalizeDate(currentFrom)
      const toNormalized = normalizeDate(currentTo)

      // Se a data clicada é diferente de ambas as datas do range atual, resetar
      if (
        clickedNormalized.getTime() !== fromNormalized.getTime() &&
        clickedNormalized.getTime() !== toNormalized.getTime()
      ) {
        // Resetar e começar um novo range com a data clicada
        const newRange: DateRange = {
          from: clickedDate,
          to: undefined,
        }
        setDateRange(newRange)
        console.log('[DateRange] Range resetado - nova data inicial:', clickedDate.toISOString().split('T')[0])
        return
      }
    }

    // Comportamento normal
    setDateRange(range)
    console.log('[DateRange] Range atualizado:', {
      from: range?.from?.toISOString().split('T')[0],
      to: range?.to?.toISOString().split('T')[0],
    })
  }
  const [userId, setUserId] = useState<string | null>(null)
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([1, 2, 3, 4, 5]) // Padrão: segunda a sexta
  const [diasSalvos, setDiasSalvos] = useState<number[]>([1, 2, 3, 4, 5]) // Dias salvos no banco
  const [manterDiasAtuais, setManterDiasAtuais] = useState(true) // Checkbox "Manter dias atuais"
  const [cardsExpandidos, setCardsExpandidos] = useState<Set<string>>(new Set()) // Cards expandidos (padrão: nenhum)
  const [salvandoDistribuicao, setSalvandoDistribuicao] = useState(false)
  const [itensCompletosCache, setItensCompletosCache] = useState<CronogramaItem[]>([])
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [, setCalendarForceUpdate] = useState(0)
  const [estatisticasSemanas, setEstatisticasSemanas] = useState<EstatisticasSemanasResult | null>(null)
  const [, setLoadingEstatisticas] = useState(false)
  const [tempoEstudosConcluidos, setTempoEstudosConcluidos] = useState<Map<string, boolean>>(new Map()) // Key: "data|disciplina_id|frente_id"

  // Gestos swipe para navegar entre meses
  const handleSwipeLeft = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1))
  }, [])

  const handleSwipeRight = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1))
  }, [])

  const { handlers: swipeHandlers } = useSwipe({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
  })

  useEffect(() => {
    async function loadCronograma() {
      const idsToLoad = isConsolidated ? cronogramaIds! : (cronogramaId ? [cronogramaId] : [])
      if (idsToLoad.length === 0) {
        console.error('cronogramaId não fornecido')
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()

        const { data: userResponse } = await supabase.auth.getUser()
        setUserId(userResponse?.user?.id ?? null)

        // Carregar cronograma(s)
        // Type assertion needed because database types are currently out of sync with actual schema
        type CronogramaRaw = Omit<Cronograma, 'cronograma_itens'>

        let cronogramaData: CronogramaRaw | null = null

        if (isConsolidated) {
          // Modo consolidado: carregar todos os cronogramas e mergear
          const { data: allCronogramas, error: allError } = (await supabase
            .from('cronogramas')
            .select('*')
            .in('id', idsToLoad)) as { data: CronogramaRaw[] | null; error: unknown }

          if (allError || !allCronogramas || allCronogramas.length === 0) {
            console.error('Erro ao carregar cronogramas consolidados:', allError)
            setLoading(false)
            return
          }

          // Construir cronograma virtual com range consolidado
          const allInicios = allCronogramas.map(c => new Date(c.data_inicio).getTime())
          const allFins = allCronogramas.map(c => new Date(c.data_fim).getTime())
          const minInicio = new Date(Math.min(...allInicios))
          const maxFim = new Date(Math.max(...allFins))

          cronogramaData = {
            ...allCronogramas[0],
            id: 'consolidated',
            nome: 'Todos os cursos',
            data_inicio: normalizarDataParaKey(minInicio),
            data_fim: normalizarDataParaKey(maxFim),
            dias_estudo_semana: Math.max(...allCronogramas.map(c => c.dias_estudo_semana)),
            horas_estudo_dia: allCronogramas.reduce((sum, c) => sum + c.horas_estudo_dia, 0),
          }
        } else {
          const { data: singleData, error: singleError } = (await supabase
            .from('cronogramas')
            .select('*')
            .eq('id', idsToLoad[0])
            .single()) as { data: CronogramaRaw | null; error: unknown }

          if (singleError || !singleData) {
            console.error('Erro ao carregar cronograma:', singleError)
            setLoading(false)
            return
          }
          cronogramaData = singleData
        }

        if (!cronogramaData) {
          setLoading(false)
          return
        }

        // Carregar itens (incluindo data_prevista)
        // Type assertion needed because database types are currently out of sync with actual schema
        type CronogramaItemRaw = Omit<CronogramaItem, 'aulas'>
        const { data: itensData, error: itensError } = (await supabase
          .from('cronograma_itens')
          .select('id, tipo, aula_id, frente_id, frente_nome_snapshot, mensagem, duracao_sugerida_minutos, semana_numero, ordem_na_semana, concluido, data_conclusao, data_prevista')
          .in('cronograma_id', idsToLoad)
          .order('semana_numero', { ascending: true })
          .order('ordem_na_semana', { ascending: true })) as { data: CronogramaItemRaw[] | null; error: unknown }

        if (itensError) {
          console.error('Erro ao carregar itens:', itensError)
        }

        // Carregar aulas
        let itensCompletos: CronogramaItem[] = []
        if (itensData && itensData.length > 0) {
          const aulaIds = [...new Set(itensData.map(item => item.aula_id).filter((id): id is string => Boolean(id)))]

          if (aulaIds.length > 0) {
            // Buscar aulas em lotes
            const LOTE_SIZE = 100
            const lotes = []
            for (let i = 0; i < aulaIds.length; i += LOTE_SIZE) {
              lotes.push(aulaIds.slice(i, i + LOTE_SIZE))
            }

            const todasAulas: AulaData[] = []
            for (const lote of lotes) {
              // Type assertion needed because database types are currently out of sync with actual schema
              const { data: loteData, error: loteError } = await supabase
                .from('aulas')
                .select('id, nome, numero_aula, tempo_estimado_minutos, curso_id, modulo_id')
                .in('id', lote) as unknown as { data: AulaData[] | null; error: unknown }

              if (!loteError && loteData) {
                todasAulas.push(...loteData)
              }
            }

            // Buscar módulos
            const moduloIds = [...new Set(todasAulas.map(a => a.modulo_id).filter((id): id is string => id !== null && id !== undefined))]
            let modulosMap = new Map()

            if (moduloIds.length > 0) {
              // Type assertion needed because database types are currently out of sync with actual schema
              const { data: modulosData } = await supabase
                .from('modulos')
                .select('id, nome, numero_modulo, frente_id')
                .in('id', moduloIds) as unknown as { data: ModuloMapValue[] | null }

              if (modulosData) {
                modulosMap = new Map(modulosData.map(m => [m.id, m]))
              }
            }

            // Buscar frentes
            const frenteIds = [...new Set(Array.from(modulosMap.values()).map((m) => (m as ModuloMapValue).frente_id).filter(Boolean))]
            let frentesMap = new Map()

            if (frenteIds.length > 0) {
              // Type assertion needed because database types are currently out of sync with actual schema
              const { data: frentesData } = await supabase
                .from('frentes')
                .select('id, nome, disciplina_id')
                .in('id', frenteIds) as unknown as { data: FrenteMapValue[] | null }

              if (frentesData) {
                frentesMap = new Map(frentesData.map(f => [f.id, f]))
              }
            }

            // Buscar disciplinas
            const disciplinaIds = [...new Set(Array.from(frentesMap.values()).map((f) => (f as FrenteMapValue).disciplina_id).filter(Boolean))]
            let disciplinasMap = new Map()

            if (disciplinaIds.length > 0) {
              // Type assertion needed because database types are currently out of sync with actual schema
              const { data: disciplinasData } = await supabase
                .from('disciplinas')
                .select('id, nome')
                .in('id', disciplinaIds) as unknown as { data: DisciplinaMapValue[] | null }

              if (disciplinasData) {
                disciplinasMap = new Map(disciplinasData.map(d => [d.id, d]))
              }
            }

            // Montar estrutura completa
            const aulasCompletas = todasAulas.map(aula => {
              const modulo = modulosMap.get(aula.modulo_id) as ModuloMapValue | undefined
              const frente = modulo ? frentesMap.get(modulo.frente_id) as FrenteMapValue | undefined : null
              const disciplina = frente ? disciplinasMap.get(frente.disciplina_id) as DisciplinaMapValue | undefined : null

              return {
                id: aula.id,
                nome: aula.nome,
                numero_aula: aula.numero_aula,
                tempo_estimado_minutos: aula.tempo_estimado_minutos,
                curso_id: aula.curso_id,
                modulos: modulo ? {
                  id: modulo.id,
                  nome: modulo.nome,
                  numero_modulo: modulo.numero_modulo,
                  frentes: frente ? {
                    id: frente.id,
                    nome: frente.nome,
                    disciplinas: disciplina ? {
                      id: disciplina.id,
                      nome: disciplina.nome,
                    } : null,
                  } : null,
                } : null,
              }
            })

            const aulasMap = new Map(aulasCompletas.map(aula => [aula.id, aula]))

            itensCompletos = itensData.map(item => ({
              ...item,
              concluido: item.concluido ?? false,
              aulas: item.aula_id ? aulasMap.get(item.aula_id) || null : null,
            })) as typeof itensCompletos
          }
        }

        // Converter periodos_ferias de Json para o tipo esperado
        const periodosFeriasConvertidos = cronogramaData.periodos_ferias
          ? (Array.isArray(cronogramaData.periodos_ferias)
              ? (cronogramaData.periodos_ferias as unknown[])
                  .map((p: unknown): { inicio: string; fim: string } | null => {
                    if (typeof p === 'object' && p !== null && 'inicio' in p && 'fim' in p) {
                      const obj = p as { inicio: unknown; fim: unknown }
                      return { inicio: String(obj.inicio), fim: String(obj.fim) }
                    }
                    return null
                  })
                  .filter((p): p is { inicio: string; fim: string } => p !== null)
              : [])
          : undefined

        const data = {
          ...cronogramaData,
          nome: cronogramaData.nome || '',
          modalidade_estudo: (cronogramaData.modalidade_estudo === 'paralelo' || cronogramaData.modalidade_estudo === 'sequencial')
            ? cronogramaData.modalidade_estudo
            : 'paralelo' as 'paralelo' | 'sequencial',
          cronograma_itens: itensCompletos,
          periodos_ferias: periodosFeriasConvertidos,
        } as Cronograma

        setCronograma(data)
        setItensCompletosCache(itensCompletos)

        // Calcular datas dos itens (usar data_prevista se disponível, senão calcular)
        console.log('[Load] Total de itens carregados:', itensCompletos.length)
        console.log('[Load] Itens com data_prevista:', itensCompletos.filter((i) => i.data_prevista).length)
        console.log('[Load] Itens sem data_prevista:', itensCompletos.filter((i) => !i.data_prevista).length)

        const itensComData = calcularDatasItens(data as unknown as Cronograma, itensCompletos)
        const mapaPorData = new Map<string, ItemComData[]>()

        // Contador por dia da semana para debug
        const contadorInicialPorDia: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

        itensComData.forEach(item => {
          // Usar função helper para normalizar data
          const dataKey = normalizarDataParaKey(item.data)
          const diaSemana = item.data.getDay()
          contadorInicialPorDia[diaSemana] += 1

          if (!mapaPorData.has(dataKey)) {
            mapaPorData.set(dataKey, [])
          }
          mapaPorData.get(dataKey)!.push(item)
        })

        console.log('[Load] Contador inicial de itens por dia da semana:', contadorInicialPorDia)
        console.log('[Load] Mapa por data criado com', mapaPorData.size, 'datas únicas')
        setItensPorData(mapaPorData)

        // Definir range inicial como sugestão, mas permitir que o usuário altere livremente
        // O usuário pode clicar em qualquer data para iniciar um novo range
        if (data.data_inicio && data.data_fim) {
          const inicio = new Date(data.data_inicio)
          // Definir range inicial apenas se não houver um range já selecionado pelo usuário
          if (!dateRange) {
            setDateRange({
              from: inicio,
              to: new Date(data.data_fim),
            })
          }
          // Sempre definir o mês inicial do calendário para mostrar o período do cronograma
          setCurrentMonth(inicio)
        }

        // No modo consolidado, pular distribuição de dias e estatísticas
        // (cada cronograma tem sua própria configuração)
        if (!isConsolidated) {
          // Buscar distribuição de dias da semana
          // Type assertion needed because database types are currently out of sync with actual schema
          const { data: distribuicaoData, error: distError } = (await supabase
            .from('cronograma_semanas_dias')
            .select('dias_semana')
            .eq('cronograma_id', idsToLoad[0])
            .maybeSingle()) as { data: { dias_semana: number[] } | null; error: unknown }

          if (!distError && distribuicaoData?.dias_semana) {
            setDiasSelecionados(distribuicaoData.dias_semana)
            setDiasSalvos(distribuicaoData.dias_semana) // Salvar também os dias salvos
          }

          // Carregar estatísticas por semana - só depois de confirmar que o cronograma existe e tem itens
          // As estatísticas só fazem sentido se houver itens no cronograma
          if (cronogramaData && cronogramaData.id && itensCompletos.length > 0) {
            await carregarEstatisticasSemanas(cronogramaData.id)
            await carregarTempoEstudosConcluidos(cronogramaData.id)
          } else if (cronogramaData && cronogramaData.id && itensCompletos.length === 0) {
            console.log('[Estatísticas] Cronograma existe mas não tem itens ainda, pulando carregamento de estatísticas')
          }
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar cronograma:', err)
      } finally {
        setLoading(false)
      }
    }

    async function carregarEstatisticasSemanas(id: string) {
      if (!id) {
        console.warn('[Estatísticas] ID do cronograma não fornecido')
        return
      }

      try {
        setLoadingEstatisticas(true)
        const supabase = createClient()
        const { data: session } = await supabase.auth.getSession()

        if (!session?.session?.access_token) {
          console.warn('[Estatísticas] Sessão não encontrada')
          return
        }

        console.log('[Estatísticas] Buscando estatísticas para cronograma:', id)
        const response = await fetch(`/api/cronograma/${id}/estatisticas-semanas`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
          const errorMessage = errorData.error || 'Erro desconhecido'

          // Se o cronograma não foi encontrado, pode ser que ainda esteja sendo criado
          // Nesse caso, apenas logar como warning em vez de error
          if (errorMessage.includes('não encontrado') || errorMessage.includes('não existe')) {
            console.warn('[Estatísticas] Cronograma ainda não disponível para estatísticas:', errorMessage)
          } else {
            console.error('[Estatísticas] Erro ao buscar estatísticas:', errorMessage)
          }
          // Não lançar erro, apenas logar - as estatísticas são opcionais
          return
        }

        const data: EstatisticasSemanasResult = await response.json()
        setEstatisticasSemanas(data)
        console.log('[Estatísticas] Estatísticas carregadas:', data.resumo)
      } catch (error) {
        console.error('[Estatísticas] Erro ao carregar estatísticas:', error)
        // Não lançar erro, apenas logar - as estatísticas são opcionais
      } finally {
        setLoadingEstatisticas(false)
      }
    }

    async function carregarTempoEstudosConcluidos(id: string) {
      if (!id) return

      try {
        const supabase = createClient()
        const { data: session } = await supabase.auth.getSession()

        if (!session?.session?.access_token) {
          console.warn('[Tempo Estudos] Sessão não encontrada')
          return
        }

        const response = await fetch(`/api/cronograma/${id}/tempo-estudos`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.session.access_token}`,
          },
        })

        if (!response.ok) {
          console.warn('[Tempo Estudos] Erro ao buscar tempo de estudos concluídos')
          return
        }

        const data: { success: true; tempo_estudos: { data: string; disciplina_id: string; frente_id: string; tempo_estudos_concluido: boolean }[] } = await response.json()

        // Criar mapa: "data|disciplina_id|frente_id" -> boolean
        const mapa = new Map<string, boolean>()
        data.tempo_estudos.forEach((item) => {
          const key = `${item.data}|${item.disciplina_id}|${item.frente_id}`
          mapa.set(key, item.tempo_estudos_concluido)
        })

        setTempoEstudosConcluidos(mapa)
        console.log('[Tempo Estudos] Tempo de estudos carregado:', mapa.size, 'registros')
      } catch (error) {
        console.error('[Tempo Estudos] Erro ao carregar tempo de estudos:', error)
      }
    }

    loadCronograma()

    // Subscription Realtime para sincronizar mudanças em cronograma_itens
    // No modo consolidado, não subscrever (é read-only)
    if (!isConsolidated && cronogramaId) {
      const supabase = createClient()
      const channel = supabase
        .channel(`cronograma-itens-${cronogramaId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cronograma_itens',
            filter: `cronograma_id=eq.${cronogramaId}`,
          },
          (payload) => {
            console.log('[Realtime] Mudança detectada em cronograma_itens:', payload)
            // Recarregar cronograma completo quando houver mudanças
            loadCronograma()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cronogramaId, isConsolidated, cronogramaIds?.join(',')])

  const calcularDatasItens = (cronograma: Cronograma, itensCompletos: CronogramaItem[]): ItemComData[] => {
    const itensComData: ItemComData[] = []

    // Contador por dia da semana para debug
    const contadorPorDia: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    const contadorComDataPrevista: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    const contadorSemDataPrevista: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

    itensCompletos.forEach((item) => {
      let dataItem: Date

      // Se tiver data_prevista, usar ela
      if (item.data_prevista) {
        // Parsear data_prevista corretamente (pode vir como string YYYY-MM-DD ou ISO)
        const dataPrevistaStr = item.data_prevista
        // Se for apenas data (YYYY-MM-DD), criar Date no horário local para evitar problemas de timezone
        if (typeof dataPrevistaStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dataPrevistaStr)) {
          const [year, month, day] = dataPrevistaStr.split('-').map(Number)
          dataItem = new Date(year, month - 1, day) // month é 0-indexed
        } else {
          dataItem = new Date(dataPrevistaStr)
        }

        const diaSemana = dataItem.getDay()
        contadorPorDia[diaSemana] += 1
        contadorComDataPrevista[diaSemana] += 1

        // Debug para quinta, sexta, sábado e domingo
        if (diaSemana >= 4 || diaSemana === 0) {
          const nomeDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][diaSemana]
          const dataKey = normalizarDataParaKey(dataItem)
          console.log(`[CalcularDatas] Item ${item.id} (semana ${item.semana_numero}, ordem ${item.ordem_na_semana}) tem data_prevista: ${item.data_prevista} -> ${dataKey} (${nomeDia})`)
        }
      } else {
        // Fallback: calcular baseado na semana e ordem (lógica antiga)
        const dataInicio = new Date(cronograma.data_inicio)
        const diasEstudoSemana = cronograma.dias_estudo_semana || 7
        const inicioSemana = addDays(dataInicio, (item.semana_numero - 1) * 7)
        const inicioSemanaUtil = startOfWeek(inicioSemana, { weekStartsOn: 1 }) // Segunda-feira
        const diaNaSemana = (item.ordem_na_semana - 1) % diasEstudoSemana
        dataItem = addDays(inicioSemanaUtil, diaNaSemana)

        const diaSemana = dataItem.getDay()
        contadorPorDia[diaSemana] += 1
        contadorSemDataPrevista[diaSemana] += 1

        // Debug para quinta, sexta, sábado e domingo
        if (diaSemana >= 4 || diaSemana === 0) {
          const nomeDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][diaSemana]
          console.log(`[CalcularDatas] Item ${item.id} (semana ${item.semana_numero}, ordem ${item.ordem_na_semana}) SEM data_prevista, calculado: ${normalizarDataParaKey(dataItem)} (${nomeDia})`)
        }
      }

      itensComData.push({
        ...item,
        data: dataItem,
        data_prevista: item.data_prevista || null,
      })
    })

    console.log('[CalcularDatas] Contador total por dia da semana:', contadorPorDia)
    console.log('[CalcularDatas] Contador com data_prevista por dia:', contadorComDataPrevista)
    console.log('[CalcularDatas] Contador sem data_prevista (fallback) por dia:', contadorSemDataPrevista)

    return itensComData
  }

  const toggleConcluido = async (itemId: string, concluido: boolean) => {
    const itemAlvo = cronograma?.cronograma_itens.find((item) => item.id === itemId)
    if (!itemAlvo || itemAlvo.tipo !== 'aula') {
      return
    }

    const supabase = createClient()

    const updateData: { concluido: boolean; data_conclusao?: string | null } = { concluido }
    if (concluido) {
      updateData.data_conclusao = new Date().toISOString()
    } else {
      updateData.data_conclusao = null
    }

    // Type assertion needed because database types are currently out of sync with actual schema
    const { error } = await supabase
      .from('cronograma_itens')
      .update(updateData)
      .eq('id', itemId)

    if (error) {
      console.error('Erro ao atualizar item:', error)
      return
    }

    const alunoAtual = userId || (await supabase.auth.getUser()).data?.user?.id || null
    const cursoDaAula = itemAlvo?.aulas?.curso_id || cronograma?.curso_alvo_id || null

    if (itemAlvo?.aula_id && alunoAtual && cursoDaAula) {
      if (concluido) {
        // Type assertion needed because database types are currently out of sync with actual schema
        await supabase
          .from('aulas_concluidas')
          .upsert(
            {
              usuario_id: alunoAtual,
              aula_id: itemAlvo.aula_id,
              curso_id: cursoDaAula,
            },
            { onConflict: 'usuario_id,aula_id' },
          )
      } else {
        // Type assertion needed because database types are currently out of sync with actual schema
        await supabase
          .from('aulas_concluidas')
          .delete()
          .eq('usuario_id', alunoAtual)
          .eq('aula_id', itemAlvo.aula_id)
      }
    }

    // Atualizar estado local
    if (cronograma) {
      const updatedItems = itensCompletosCache.map((item) =>
        item.id === itemId
          ? { ...item, concluido, data_conclusao: updateData.data_conclusao ?? null }
          : item
      )
      setItensCompletosCache(updatedItems)
      setCronograma({ ...cronograma, cronograma_itens: updatedItems })

      // Atualizar mapa de itens por data
      const itensComData = calcularDatasItens(cronograma, updatedItems)
      const mapaPorData = new Map<string, ItemComData[]>()

      itensComData.forEach(item => {
        // Usar função helper para normalizar data
        const dataKey = normalizarDataParaKey(item.data)
        if (!mapaPorData.has(dataKey)) {
          mapaPorData.set(dataKey, [])
        }
        mapaPorData.get(dataKey)!.push(item)
      })

      setItensPorData(mapaPorData)
    }
  }

  const formatTempo = (minutes: number | null) => {
    if (!minutes) return '--'
    const rounded = Math.max(0, Math.round(minutes))
    const hours = Math.floor(rounded / 60)
    const mins = rounded % 60
    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (mins > 0) parts.push(`${mins} min`)
    return parts.length === 0 ? '0 min' : parts.join(' ')
  }

  const toggleTempoEstudosConcluido = async (
    data: string,
    disciplinaId: string,
    frenteId: string,
    concluido: boolean
  ) => {
    if (!cronogramaId) return

    try {
      const supabase = createClient()
      const { data: session } = await supabase.auth.getSession()

      if (!session?.session?.access_token) {
        console.warn('[Tempo Estudos] Sessão não encontrada')
        return
      }

      const response = await fetch(`/api/cronograma/${cronogramaId}/tempo-estudos`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({
          data,
          disciplina_id: disciplinaId,
          frente_id: frenteId,
          tempo_estudos_concluido: concluido,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        console.error('[Tempo Estudos] Erro ao atualizar:', errorData.error)
        return
      }

      // Atualizar estado local
      const key = `${data}|${disciplinaId}|${frenteId}`
      setTempoEstudosConcluidos(prev => {
        const novo = new Map(prev)
        novo.set(key, concluido)
        return novo
      })

      // Forçar atualização do calendário para refletir mudanças nos modificadores
      setCalendarForceUpdate(v => v + 1)

      console.log('[Tempo Estudos] Tempo de estudos atualizado:', { data, disciplinaId, frenteId, concluido })
    } catch (error) {
      console.error('[Tempo Estudos] Erro ao atualizar tempo de estudos:', error)
    }
  }

  const toggleTodasAulasDoDia = async (itensDoDia: ItemComData[]) => {
    const itensAula = itensDoDia.filter((item) => item.tipo === 'aula')
    console.log('[toggleTodasAulasDoDia] Iniciando, itens de aula recebidos:', itensAula.length)

    if (!cronograma) {
      console.error('[toggleTodasAulasDoDia] Cronograma não encontrado')
      return
    }

    if (itensAula.length === 0) {
      console.warn('[toggleTodasAulasDoDia] Nenhum item recebido')
      return
    }

    const supabase = createClient()

    // Verificar se todas já estão concluídas
    const todasConcluidas = itensAula.every(item => item.concluido)

    // Se todas estão concluídas, desmarcar todas; senão, marcar todas como concluídas
    const novoEstado = !todasConcluidas
    const dataConclusao = novoEstado ? new Date().toISOString() : null

    console.log('[toggleTodasAulasDoDia] Estado atual:', { todasConcluidas, novoEstado, totalItens: itensAula.length })

    // Obter IDs dos itens
    const itemIds = itensAula.map(item => item.id)
    console.log('[toggleTodasAulasDoDia] IDs dos itens:', itemIds)

    // Atualizar todos os itens no banco de uma vez
    // Type assertion needed because database types are currently out of sync with actual schema
    const { error: updateError, data: updateData } = await supabase
      .from('cronograma_itens')
      .update({
        concluido: novoEstado,
        data_conclusao: dataConclusao
      })
      .in('id', itemIds)
      .select()

    if (updateError) {
      console.error('[toggleTodasAulasDoDia] Erro ao atualizar itens:', updateError)
      alert('Erro ao marcar aulas. Tente novamente.')
      return
    }

    console.log('[toggleTodasAulasDoDia] Itens atualizados no banco:', updateData?.length || 0)

    // Obter aluno atual
    const alunoAtual = userId || (await supabase.auth.getUser()).data?.user?.id || null

    // Atualizar tabela aulas_concluidas para cada item
    if (alunoAtual) {
      const operacoes = itensAula.map(async (item) => {
        const itemAlvo = cronograma.cronograma_itens.find((i) => i.id === item.id)
        const cursoDaAula = itemAlvo?.aulas?.curso_id || cronograma.curso_alvo_id || null

        if (itemAlvo?.aula_id && cursoDaAula) {
          if (novoEstado) {
            // Type assertion needed because database types are currently out of sync with actual schema
            await supabase
              .from('aulas_concluidas')
              .upsert(
                {
                  usuario_id: alunoAtual,
                  aula_id: itemAlvo.aula_id,
                  curso_id: cursoDaAula,
                },
                { onConflict: 'usuario_id,aula_id' },
              )
          } else {
            // Type assertion needed because database types are currently out of sync with actual schema
            await supabase
              .from('aulas_concluidas')
              .delete()
              .eq('usuario_id', alunoAtual)
              .eq('aula_id', itemAlvo.aula_id)
          }
        }
      })

      await Promise.all(operacoes)
    }

    // Se estiver marcando todas as aulas, também marcar os tempos de estudos
    if (novoEstado && cronogramaId) {
      // Agrupar itens por data/curso/disciplinas/frente para marcar tempos de estudos
      const gruposPorDataDisciplinaFrente = new Map<string, typeof itensDoDia>()

      itensDoDia.forEach((item) => {
        const dataKey = normalizarDataParaKey(item.data)
        const disciplinaId = item.aulas?.modulos?.frentes?.disciplinas?.id || ''
        const frenteId = item.aulas?.modulos?.frentes?.id || ''

        if (disciplinaId && frenteId) {
          const chave = `${dataKey}|${disciplinaId}|${frenteId}`
          if (!gruposPorDataDisciplinaFrente.has(chave)) {
            gruposPorDataDisciplinaFrente.set(chave, [])
          }
          gruposPorDataDisciplinaFrente.get(chave)!.push(item)
        }
      })

      // Marcar tempos de estudos para cada grupo que tem tempo estimado > 0
      const tempoEstudosOperacoes = Array.from(gruposPorDataDisciplinaFrente.entries()).map(async ([chave, itensGrupo]) => {
        const [dataKey, disciplinaId, frenteId] = chave.split('|')

        // Verificar se o grupo tem tempo de estudos (tempo estimado > 0)
        const velocidadeReproducao = cronograma?.velocidade_reproducao ?? 1.0
        const tempoAulasOriginal = itensGrupo.reduce((acc, item) => {
          return acc + (item.aulas?.tempo_estimado_minutos || 0)
        }, 0)
        const tempoAulasAjustado = tempoAulasOriginal / velocidadeReproducao
        const tempoEstudosExercicios = tempoAulasAjustado * 0.5

        // Só marcar se houver tempo de estudos
        if (tempoEstudosExercicios > 0) {
          await toggleTempoEstudosConcluido(dataKey, disciplinaId, frenteId, true)
        }
      })

      await Promise.all(tempoEstudosOperacoes)
    } else if (!novoEstado && cronogramaId) {
      // Se estiver desmarcando todas as aulas, também desmarcar os tempos de estudos
      const gruposPorDataDisciplinaFrente = new Map<string, typeof itensDoDia>()

      itensDoDia.forEach((item) => {
        const dataKey = normalizarDataParaKey(item.data)
        const disciplinaId = item.aulas?.modulos?.frentes?.disciplinas?.id || ''
        const frenteId = item.aulas?.modulos?.frentes?.id || ''

        if (disciplinaId && frenteId) {
          const chave = `${dataKey}|${disciplinaId}|${frenteId}`
          if (!gruposPorDataDisciplinaFrente.has(chave)) {
            gruposPorDataDisciplinaFrente.set(chave, [])
          }
          gruposPorDataDisciplinaFrente.get(chave)!.push(item)
        }
      })

      // Desmarcar tempos de estudos para cada grupo
      const tempoEstudosOperacoes = Array.from(gruposPorDataDisciplinaFrente.entries()).map(async ([chave]) => {
        const [dataKey, disciplinaId, frenteId] = chave.split('|')
        await toggleTempoEstudosConcluido(dataKey, disciplinaId, frenteId, false)
      })

      await Promise.all(tempoEstudosOperacoes)
    }

    // Atualizar estado local de uma vez
    const updatedItems = itensCompletosCache.map((item) => {
      if (itemIds.includes(item.id)) {
        return { ...item, concluido: novoEstado, data_conclusao: dataConclusao }
      }
      return item
    })

    // Criar cronograma atualizado ANTES de usar no calcularDatasItens
    const cronogramaAtualizado = { ...cronograma, cronograma_itens: updatedItems }

    setItensCompletosCache(updatedItems)
    setCronograma(cronogramaAtualizado)

    // Atualizar mapa de itens por data usando o cronograma atualizado
    const itensComData = calcularDatasItens(cronogramaAtualizado, updatedItems)
    const mapaPorData = new Map<string, ItemComData[]>()

    itensComData.forEach(item => {
      const dataKey = normalizarDataParaKey(item.data)
      if (!mapaPorData.has(dataKey)) {
        mapaPorData.set(dataKey, [])
      }
      mapaPorData.get(dataKey)!.push(item)
    })

    // Verificar se os itens foram atualizados corretamente
    const itensAtualizadosNoMapa = Array.from(mapaPorData.values()).flat()
    const concluidasNoMapa = itensAtualizadosNoMapa.filter(item => itemIds.includes(item.id) && item.concluido === novoEstado).length
    console.log('[toggleTodasAulasDoDia] Verificação:', {
      totalItensAtualizados: concluidasNoMapa,
      esperado: itemIds.length,
      novoEstado
    })

    setItensPorData(mapaPorData)

    console.log('[toggleTodasAulasDoDia] Concluído com sucesso')
  }

  const toggleTodasAulasDaFrente = async (itensDaFrente: ItemComData[]) => {
    const itensAulaFrente = itensDaFrente.filter((item) => item.tipo === 'aula')
    if (!cronograma || itensAulaFrente.length === 0) return

    const supabase = createClient()

    // Verificar se todas já estão concluídas
    const todasConcluidas = itensAulaFrente.every(item => item.concluido)

    // Se todas estão concluídas, desmarcar todas; senão, marcar todas como concluídas
    const novoEstado = !todasConcluidas
    const dataConclusao = novoEstado ? new Date().toISOString() : null

    // Obter IDs dos itens
    const itemIds = itensAulaFrente.map(item => item.id)

    // Atualizar todos os itens no banco de uma vez
    // Type assertion needed because database types are currently out of sync with actual schema
    const { error: updateError } = await supabase
      .from('cronograma_itens')
      .update({
        concluido: novoEstado,
        data_conclusao: dataConclusao
      })
      .in('id', itemIds)

    if (updateError) {
      console.error('Erro ao atualizar itens:', updateError)
      return
    }

    // Obter aluno atual
    const alunoAtual = userId || (await supabase.auth.getUser()).data?.user?.id || null

    // Atualizar tabela aulas_concluidas para cada item
    if (alunoAtual) {
      const operacoes = itensAulaFrente.map(async (item) => {
        const itemAlvo = cronograma.cronograma_itens.find((i) => i.id === item.id)
        const cursoDaAula = itemAlvo?.aulas?.curso_id || cronograma.curso_alvo_id || null

        if (itemAlvo?.aula_id && cursoDaAula) {
          if (novoEstado) {
            // Type assertion needed because database types are currently out of sync with actual schema
            await supabase
              .from('aulas_concluidas')
              .upsert(
                {
                  usuario_id: alunoAtual,
                  aula_id: itemAlvo.aula_id,
                  curso_id: cursoDaAula,
                },
                { onConflict: 'usuario_id,aula_id' },
              )
          } else {
            // Type assertion needed because database types are currently out of sync with actual schema
            await supabase
              .from('aulas_concluidas')
              .delete()
              .eq('usuario_id', alunoAtual)
              .eq('aula_id', itemAlvo.aula_id)
          }
        }
      })

      await Promise.all(operacoes)
    }

    // Se estiver marcando todas as aulas da frente, também marcar os tempos de estudos
    if (novoEstado && cronogramaId) {
      // Agrupar itens por data/curso/disciplinas/frente para marcar tempos de estudos
      const gruposPorDataDisciplinaFrente = new Map<string, typeof itensAulaFrente>()

      itensAulaFrente.forEach((item) => {
        const dataKey = normalizarDataParaKey(item.data)
        const disciplinaId = item.aulas?.modulos?.frentes?.disciplinas?.id || ''
        const frenteId = item.aulas?.modulos?.frentes?.id || ''

        if (disciplinaId && frenteId) {
          const chave = `${dataKey}|${disciplinaId}|${frenteId}`
          if (!gruposPorDataDisciplinaFrente.has(chave)) {
            gruposPorDataDisciplinaFrente.set(chave, [])
          }
          gruposPorDataDisciplinaFrente.get(chave)!.push(item)
        }
      })

      // Marcar tempos de estudos para cada grupo que tem tempo estimado > 0
      const tempoEstudosOperacoes = Array.from(gruposPorDataDisciplinaFrente.entries()).map(async ([chave, itensGrupo]) => {
        const [dataKey, disciplinaId, frenteId] = chave.split('|')

        // Verificar se o grupo tem tempo de estudos (tempo estimado > 0)
        const velocidadeReproducao = cronograma?.velocidade_reproducao ?? 1.0
        const tempoAulasOriginal = itensGrupo.reduce((acc, item) => {
          return acc + (item.aulas?.tempo_estimado_minutos || 0)
        }, 0)
        const tempoAulasAjustado = tempoAulasOriginal / velocidadeReproducao
        const tempoEstudosExercicios = tempoAulasAjustado * 0.5

        // Só marcar se houver tempo de estudos
        if (tempoEstudosExercicios > 0) {
          await toggleTempoEstudosConcluido(dataKey, disciplinaId, frenteId, true)
        }
      })

      await Promise.all(tempoEstudosOperacoes)
    } else if (!novoEstado && cronogramaId) {
      // Se estiver desmarcando todas as aulas da frente, também desmarcar os tempos de estudos
      const gruposPorDataDisciplinaFrente = new Map<string, typeof itensDaFrente>()

      itensDaFrente.forEach((item) => {
        const dataKey = normalizarDataParaKey(item.data)
        const disciplinaId = item.aulas?.modulos?.frentes?.disciplinas?.id || ''
        const frenteId = item.aulas?.modulos?.frentes?.id || ''

        if (disciplinaId && frenteId) {
          const chave = `${dataKey}|${disciplinaId}|${frenteId}`
          if (!gruposPorDataDisciplinaFrente.has(chave)) {
            gruposPorDataDisciplinaFrente.set(chave, [])
          }
          gruposPorDataDisciplinaFrente.get(chave)!.push(item)
        }
      })

      // Desmarcar tempos de estudos para cada grupo
      const tempoEstudosOperacoes = Array.from(gruposPorDataDisciplinaFrente.entries()).map(async ([chave]) => {
        const [dataKey, disciplinaId, frenteId] = chave.split('|')
        await toggleTempoEstudosConcluido(dataKey, disciplinaId, frenteId, false)
      })

      await Promise.all(tempoEstudosOperacoes)
    }

    // Atualizar estado local de uma vez
    const updatedItems = itensCompletosCache.map((item) => {
      if (itemIds.includes(item.id)) {
        return { ...item, concluido: novoEstado, data_conclusao: dataConclusao }
      }
      return item
    })

    // Criar cronograma atualizado ANTES de usar no calcularDatasItens
    const cronogramaAtualizado = { ...cronograma, cronograma_itens: updatedItems }

    setItensCompletosCache(updatedItems)
    setCronograma(cronogramaAtualizado)

    // Atualizar mapa de itens por data usando o cronograma atualizado
    const itensComData = calcularDatasItens(cronogramaAtualizado, updatedItems)
    const mapaPorData = new Map<string, ItemComData[]>()

    itensComData.forEach(item => {
      const dataKey = normalizarDataParaKey(item.data)
      if (!mapaPorData.has(dataKey)) {
        mapaPorData.set(dataKey, [])
      }
      mapaPorData.get(dataKey)!.push(item)
    })

    setItensPorData(mapaPorData)
  }

  const handleToggleDia = (dia: number) => {
    // Se "manter dias atuais" estiver marcado, desmarcar automaticamente ao editar
    if (manterDiasAtuais) {
      setManterDiasAtuais(false)
    }

    setDiasSelecionados((prev) => {
      if (prev.includes(dia)) {
        // Remover dia (permitir remover todos se necessário)
        const novo = prev.filter((d) => d !== dia)
        console.log(`[ToggleDia] Removendo dia ${dia}, novos dias:`, novo)
        // Forçar atualização imediata do calendário
        setCalendarForceUpdate(v => v + 1)
        return novo
      } else {
        // Adicionar dia
        const novo = [...prev, dia].sort((a, b) => a - b)
        console.log(`[ToggleDia] Adicionando dia ${dia}, novos dias:`, novo)
        // Forçar atualização imediata do calendário
        setCalendarForceUpdate(v => v + 1)
        return novo
      }
    })
  }

  const handleToggleManterDiasAtuais = (checked: boolean) => {
    setManterDiasAtuais(checked)
    if (checked) {
      // Se marcar "manter dias atuais", restaurar os dias salvos
      setDiasSelecionados(diasSalvos)
      setCalendarForceUpdate(v => v + 1)
    }
  }


  const recarregarCronograma = async () => {
    if (!cronogramaId) return

    try {
      const supabase = createClient()

      const { data: userResponse } = await supabase.auth.getUser()
      setUserId(userResponse?.user?.id ?? null)

      // Carregar cronograma
      // Type assertion needed because database types are currently out of sync with actual schema
      const { data: cronogramaData, error: cronogramaError } = (await supabase
        .from('cronogramas')
        .select('*')
        .eq('id', cronogramaId)
        .single()) as { data: Omit<Cronograma, 'cronograma_itens'> | null; error: unknown }

      if (cronogramaError || !cronogramaData) {
        console.error('Erro ao carregar cronograma:', cronogramaError)
        return
      }

      // Aguardar um pouco antes de buscar para garantir que o backend terminou
      await new Promise(resolve => setTimeout(resolve, 500))

      // Carregar itens (incluindo data_prevista atualizada)
      // Forçar busca sem cache usando uma query única
      // Type assertion needed because database types are currently out of sync with actual schema
      type CronogramaItemRaw = Omit<CronogramaItem, 'aulas'>
      const { data: itensData, error: itensError } = (await supabase
        .from('cronograma_itens')
        .select('id, tipo, aula_id, frente_id, frente_nome_snapshot, mensagem, duracao_sugerida_minutos, semana_numero, ordem_na_semana, concluido, data_conclusao, data_prevista')
        .eq('cronograma_id', cronogramaId)
        .order('semana_numero', { ascending: true })
        .order('ordem_na_semana', { ascending: true })
        // Forçar busca sem cache usando um filtro que sempre retorna true mas força nova query
        .gte('semana_numero', 0) // Sempre verdadeiro, mas força nova query
        .limit(999999)) as { data: CronogramaItemRaw[] | null; error: unknown } // Limite alto para garantir que busca todos

      console.log('[RecarregarCronograma] Itens carregados do banco:', itensData?.length || 0)

      // Verificar distribuição de data_prevista por dia da semana ANTES de processar
      if (itensData && itensData.length > 0) {
        const distribuicaoDataPrevistaAntes: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
        const exemplosDataPrevista = itensData
          .filter((i): i is typeof i & { data_prevista: string } => !!i.data_prevista)
          .slice(0, 20)
          .map(i => {
            const [year, month, day] = i.data_prevista.split('-').map(Number)
            const data = new Date(year, month - 1, day)
            const diaSemana = data.getDay()
            distribuicaoDataPrevistaAntes[diaSemana] += 1
            return { id: i.id, data_prevista: i.data_prevista, diaSemana, nomeDia: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][diaSemana] }
          })
        console.log('[RecarregarCronograma] Distribuição de data_prevista ANTES de processar (primeiros 20):', {
          distribuicao: distribuicaoDataPrevistaAntes,
          exemplos: exemplosDataPrevista,
          totalComDataPrevista: itensData.filter(i => i.data_prevista).length,
          totalSemDataPrevista: itensData.filter(i => !i.data_prevista).length,
        })
      }

      if (itensError) {
        console.error('Erro ao carregar itens:', itensError)
        return
      }

      // Carregar aulas
      let itensCompletos: CronogramaItem[] = []
      if (itensData && itensData.length > 0) {
        const aulaIds = [...new Set(itensData.map(item => item.aula_id).filter((id): id is string => Boolean(id)))]

        if (aulaIds.length > 0) {
          // Buscar aulas em lotes
          const LOTE_SIZE = 100
          const lotes = []
          for (let i = 0; i < aulaIds.length; i += LOTE_SIZE) {
            lotes.push(aulaIds.slice(i, i + LOTE_SIZE))
          }

          const todasAulas: AulaData[] = []
          for (const lote of lotes) {
            // Type assertion needed because database types are currently out of sync with actual schema
            const { data: loteData, error: loteError } = await supabase
              .from('aulas')
              .select('id, nome, numero_aula, tempo_estimado_minutos, curso_id, modulo_id')
              .in('id', lote) as unknown as { data: AulaData[] | null; error: unknown }

            if (!loteError && loteData) {
              todasAulas.push(...loteData)
            }
          }

          // Buscar módulos
          const moduloIds = [...new Set(todasAulas.map(a => a.modulo_id).filter((id): id is string => id !== null && id !== undefined))]
          let modulosMap = new Map()

          if (moduloIds.length > 0) {
            // Type assertion needed because database types are currently out of sync with actual schema
            const { data: modulosData } = await supabase
              .from('modulos')
              .select('id, nome, numero_modulo, frente_id')
              .in('id', moduloIds) as unknown as { data: ModuloMapValue[] | null }

            if (modulosData) {
              modulosMap = new Map(modulosData.map(m => [m.id, m]))
            }
          }

          // Buscar frentes
          const frenteIds = [...new Set(Array.from(modulosMap.values()).map((m: ModuloMapValue) => m.frente_id).filter(Boolean))]
          let frentesMap = new Map()

          if (frenteIds.length > 0) {
            // Type assertion needed because database types are currently out of sync with actual schema
            const { data: frentesData } = await supabase
              .from('frentes')
              .select('id, nome, disciplina_id')
              .in('id', frenteIds) as unknown as { data: FrenteMapValue[] | null }

            if (frentesData) {
              frentesMap = new Map(frentesData.map(f => [f.id, f]))
            }
          }

          // Buscar disciplinas
          const disciplinaIds = [...new Set(Array.from(frentesMap.values()).map((f: FrenteMapValue) => f.disciplina_id).filter(Boolean))]
          let disciplinasMap = new Map()

          if (disciplinaIds.length > 0) {
            // Type assertion needed because database types are currently out of sync with actual schema
            const { data: disciplinasData } = await supabase
              .from('disciplinas')
              .select('id, nome')
              .in('id', disciplinaIds) as unknown as { data: DisciplinaMapValue[] | null }

            if (disciplinasData) {
              disciplinasMap = new Map(disciplinasData.map(d => [d.id, d]))
            }
          }

          // Montar estrutura completa
          const aulasCompletas = todasAulas.map(aula => {
            const modulo = modulosMap.get(aula.modulo_id) as ModuloMapValue | undefined
            const frente = modulo ? frentesMap.get(modulo.frente_id) as FrenteMapValue | undefined : null
            const disciplina = frente ? disciplinasMap.get(frente.disciplina_id) as DisciplinaMapValue | undefined : null

            return {
              id: aula.id,
              nome: aula.nome,
              numero_aula: aula.numero_aula,
              tempo_estimado_minutos: aula.tempo_estimado_minutos,
              curso_id: aula.curso_id,
              modulos: modulo ? {
                id: modulo.id,
                nome: modulo.nome,
                numero_modulo: modulo.numero_modulo,
                frentes: frente ? {
                  id: frente.id,
                  nome: frente.nome,
                  disciplinas: disciplina ? {
                    id: disciplina.id,
                    nome: disciplina.nome,
                  } : null,
                } : null,
              } : null,
            }
          })

          const aulasMap = new Map(aulasCompletas.map(aula => [aula.id, aula]))

          itensCompletos = itensData.map(item => ({
            ...item,
            concluido: item.concluido ?? false,
            aulas: item.aula_id ? aulasMap.get(item.aula_id) || null : null,
          })) as typeof itensCompletos
        }
      }

      // Converter periodos_ferias de Json para o tipo esperado
      const periodosFeriasConvertidos = cronogramaData.periodos_ferias
        ? (Array.isArray(cronogramaData.periodos_ferias)
            ? (cronogramaData.periodos_ferias as unknown[])
                .map((p: unknown): { inicio: string; fim: string } | null => {
                  if (typeof p === 'object' && p !== null && 'inicio' in p && 'fim' in p) {
                    const obj = p as { inicio: unknown; fim: unknown }
                    return { inicio: String(obj.inicio), fim: String(obj.fim) }
                  }
                  return null
                })
                .filter((p): p is { inicio: string; fim: string } => p !== null)
            : [])
        : undefined

      const data = {
        ...cronogramaData,
        nome: cronogramaData.nome || '',
        modalidade_estudo: (cronogramaData.modalidade_estudo === 'paralelo' || cronogramaData.modalidade_estudo === 'sequencial')
          ? cronogramaData.modalidade_estudo
          : 'paralelo' as 'paralelo' | 'sequencial',
        cronograma_itens: itensCompletos,
        periodos_ferias: periodosFeriasConvertidos,
      } as Cronograma

      setCronograma(data)
      setItensCompletosCache(itensCompletos)

      // Calcular datas dos itens (usar data_prevista atualizada)
      console.log('[RecarregarCronograma] Recalculando datas dos itens...')
      console.log('[RecarregarCronograma] Total de itens:', itensCompletos.length)
      console.log('[RecarregarCronograma] Itens com data_prevista:', itensCompletos.filter(i => i.data_prevista).length)
      console.log('[RecarregarCronograma] Itens sem data_prevista:', itensCompletos.filter(i => !i.data_prevista).length)

      // Verificar distribuição de data_prevista por dia da semana ANTES de calcular
      const distribuicaoDataPrevista: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      const exemplosPorDia: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
      itensCompletos.forEach(item => {
        if (item.data_prevista) {
          const dataPrevista = item.data_prevista
          const [year, month, day] = dataPrevista.split('-').map(Number)
          const data = new Date(year, month - 1, day)
          const diaSemana = data.getDay()
          distribuicaoDataPrevista[diaSemana] += 1
          if (exemplosPorDia[diaSemana].length < 3) {
            exemplosPorDia[diaSemana].push(dataPrevista)
          }
        }
      })
      console.log('[RecarregarCronograma] Distribuição de data_prevista por dia da semana (do banco):', {
        distribuicao: distribuicaoDataPrevista,
        exemplos: exemplosPorDia,
        diasSelecionados: diasSelecionados,
      })

      // Verificar se há itens com data_prevista nos dias selecionados
      const itensNosDiasSelecionados = itensCompletos.filter(item => {
        if (!item.data_prevista) return false
        const dataPrevista = item.data_prevista
        const [year, month, day] = dataPrevista.split('-').map(Number)
        const data = new Date(year, month - 1, day)
        const diaSemana = data.getDay()
        return diasSelecionados.includes(diaSemana)
      })
      console.log('[RecarregarCronograma] Itens com data_prevista nos dias selecionados:', {
        total: itensNosDiasSelecionados.length,
        esperado: itensCompletos.length,
        percentual: itensCompletos.length > 0 ? ((itensNosDiasSelecionados.length / itensCompletos.length) * 100).toFixed(1) + '%' : '0%',
      })

      const itensComData = calcularDatasItens(data as Cronograma, itensCompletos)
      const mapaPorData = new Map<string, ItemComData[]>()

      itensComData.forEach(item => {
        // Usar função helper para normalizar data
        const dataKey = normalizarDataParaKey(item.data)
        if (!mapaPorData.has(dataKey)) {
          mapaPorData.set(dataKey, [])
        }
        mapaPorData.get(dataKey)!.push(item)
      })

      // Log detalhado do mapa por data
      console.log('[RecarregarCronograma] Mapa por data criado com', mapaPorData.size, 'datas únicas')
      const contadorPorDia: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      const datasPorDia: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
      mapaPorData.forEach((itens, dataKey) => {
        const [year, month, day] = dataKey.split('-').map(Number)
        const data = new Date(year, month - 1, day)
        const diaSemana = data.getDay()
        contadorPorDia[diaSemana] += itens.length
        datasPorDia[diaSemana] += 1
      })
      console.log('[RecarregarCronograma] Contador final por dia da semana:', contadorPorDia)
      console.log('[RecarregarCronograma] Datas únicas por dia da semana:', {
        domingo: `${contadorPorDia[0]} itens em ${datasPorDia[0]} datas`,
        segunda: `${contadorPorDia[1]} itens em ${datasPorDia[1]} datas`,
        terca: `${contadorPorDia[2]} itens em ${datasPorDia[2]} datas`,
        quarta: `${contadorPorDia[3]} itens em ${datasPorDia[3]} datas`,
        quinta: `${contadorPorDia[4]} itens em ${datasPorDia[4]} datas`,
        sexta: `${contadorPorDia[5]} itens em ${datasPorDia[5]} datas`,
        sabado: `${contadorPorDia[6]} itens em ${datasPorDia[6]} datas`,
      })

      setItensPorData(mapaPorData)

      // Recarregar distribuição de dias da semana para garantir sincronização
      // Type assertion needed because database types are currently out of sync with actual schema
      const { data: distribuicaoData, error: distError } = (await supabase
        .from('cronograma_semanas_dias')
        .select('dias_semana')
        .eq('cronograma_id', cronogramaId)
        .maybeSingle()) as { data: { dias_semana: number[] } | null; error: unknown }

      if (!distError && distribuicaoData?.dias_semana) {
        setDiasSelecionados(distribuicaoData.dias_semana)
        setDiasSalvos(distribuicaoData.dias_semana) // Atualizar dias salvos
        console.log('[RecarregarCronograma] Dias selecionados recarregados:', distribuicaoData.dias_semana)
      }
    } catch (err) {
      console.error('Erro ao recarregar cronograma:', err)
    }
  }

  const handleSalvarDistribuicao = async () => {
    if (!cronogramaId || cronogramaId.trim() === '' || diasSelecionados.length === 0) {
      console.error('cronogramaId inválido:', cronogramaId)
      alert('Erro: ID do cronograma não encontrado. Por favor, recarregue a página.')
      return
    }

    setSalvandoDistribuicao(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Sessão não encontrada')
      }

      const response = await fetch(`/api/cronograma/${cronogramaId}/distribuicao-dias`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          dias_semana: diasSelecionados,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao salvar distribuição')
      }

      const responseData = await response.json()

      // Atualizar dias selecionados e dias salvos com o que foi salvo no banco
      if (responseData.distribuicao?.dias_semana) {
        setDiasSelecionados(responseData.distribuicao.dias_semana)
        setDiasSalvos(responseData.distribuicao.dias_semana) // Atualizar dias salvos
        setManterDiasAtuais(true) // Voltar para "manter dias atuais" após salvar
        console.log('[SalvarDistribuicao] Dias selecionados atualizados:', responseData.distribuicao.dias_semana)
      }

      // Verificar atualização usando polling
      console.log('[SalvarDistribuicao] Iniciando verificação de atualização...')

      const verificarAtualizacaoCompleta = async (): Promise<boolean> => {
        const supabaseCheck = createClient()

        // Buscar amostra representativa de itens (aumentar para 200 para melhor verificação)
        // Type assertion needed because database types are currently out of sync with actual schema
        const { data: amostraItens, error: amostraError } = (await supabaseCheck
          .from('cronograma_itens')
          .select('data_prevista')
          .eq('cronograma_id', cronogramaId)
          .limit(200)) as { data: Array<{ data_prevista: string | null }> | null; error: unknown }

        if (amostraError) {
          console.error('[SalvarDistribuicao] Erro ao verificar atualização:', amostraError)
          return false
        }

        if (!amostraItens || amostraItens.length === 0) {
          return false
        }

        // Verificar distribuição de dias na amostra
        const amostraDias = amostraItens
          .filter((i): i is typeof i & { data_prevista: string } => !!i.data_prevista)
          .map(i => {
            const [year, month, day] = i.data_prevista.split('-').map(Number)
            return new Date(year, month - 1, day).getDay()
          })
        const amostraDiasUnicos = [...new Set(amostraDias)]

        // Verificar se todos os dias selecionados aparecem na amostra
        const todosDiasPresentes = diasSelecionados.every(d => amostraDiasUnicos.includes(d))
        const percentualComDataPrevista = (amostraItens.filter(i => i.data_prevista).length / amostraItens.length) * 100

        // Considerar atualizado se:
        // 1. Todos os dias selecionados aparecem na amostra
        // 2. Pelo menos 90% dos itens têm data_prevista
        // 3. A amostra tem pelo menos os dias selecionados
        const atualizado = todosDiasPresentes &&
          percentualComDataPrevista >= 90 &&
          amostraDiasUnicos.length >= diasSelecionados.length

        return atualizado
      }

      // Polling: verificar a cada 500ms, máximo 20 tentativas (10 segundos)
      const POLLING_INTERVAL = 500
      const MAX_TENTATIVAS = 20
      let tentativas = 0
      let datasAtualizadas = false

      while (tentativas < MAX_TENTATIVAS && !datasAtualizadas) {
        tentativas++
        datasAtualizadas = await verificarAtualizacaoCompleta()

        if (!datasAtualizadas) {
          console.log(`[SalvarDistribuicao] Tentativa ${tentativas}/${MAX_TENTATIVAS} - Aguardando atualização...`)
          await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL))
        } else {
          console.log('[SalvarDistribuicao] ✅ Datas atualizadas confirmadas!')
        }
      }

      if (!datasAtualizadas) {
        console.warn('[SalvarDistribuicao] ⚠️ Não foi possível confirmar atualização das datas após', MAX_TENTATIVAS, 'tentativas. Continuando mesmo assim...')
      }

      // Recarregar cronograma com cache desabilitado
      await recarregarCronograma()

      // Pequeno delay adicional para garantir que o estado foi atualizado
      await new Promise(resolve => setTimeout(resolve, 500))

      // Forçar atualização do calendário após recarregar
      setCalendarForceUpdate(v => v + 1)
      setCurrentMonth(prev => {
        const newMonth = new Date(prev)
        newMonth.setMilliseconds(newMonth.getMilliseconds() + 1)
        return newMonth
      })

      console.log('[SalvarDistribuicao] Atualização completa')
    } catch (error) {
      console.error('Erro ao salvar distribuição:', error)

      // Tratamento de erro mais robusto
      let errorMessage = 'Erro ao salvar distribuição de dias. Tente novamente.'

      if (error instanceof Error) {
        errorMessage = error.message

        // Mensagens de erro mais amigáveis
        if (error.message.includes('Sessão não encontrada')) {
          errorMessage = 'Sua sessão expirou. Por favor, faça login novamente.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.'
        } else if (error.message.includes('timeout')) {
          errorMessage = 'A operação demorou muito. Tente novamente.'
        }
      } else if (typeof error === 'string') {
        errorMessage = error
      }

      // Usar alert por enquanto, mas pode ser substituído por toast/notificação
      alert(errorMessage)
    } finally {
      setSalvandoDistribuicao(false)
    }
  }

  // Filtrar itens por data baseado nos dias selecionados
  // Usar useMemo para recalcular apenas quando itensPorData ou diasSelecionados mudarem
  // IMPORTANTE: Este hook deve ser chamado ANTES de qualquer return condicional
  const itensPorDataFiltrados = useMemo(() => {
    if (!itensPorData || itensPorData.size === 0) {
      console.log('[Filtro] Nenhum item disponível para filtrar')
      return new Map<string, ItemComData[]>()
    }

    const filtrados = new Map<string, ItemComData[]>()
    console.log('[Filtro] Dias selecionados:', diasSelecionados)
    console.log('[Filtro] Total de itens antes do filtro:', itensPorData.size)

    // Contador por dia da semana para debug
    const contadorPorDia: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    const contadorFiltradoPorDia: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }

    // Primeiro, listar todas as datas que existem no mapa original para debug
    const datasPorDia: Record<number, string[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
    itensPorData.forEach((itens, dataKey) => {
      const [year, month, day] = dataKey.split('-').map(Number)
      const data = new Date(year, month - 1, day)
      const diaSemana = data.getDay()
      datasPorDia[diaSemana].push(dataKey)
    })
    console.log('[Filtro] Datas disponíveis por dia da semana:', {
      domingo: datasPorDia[0].length,
      segunda: datasPorDia[1].length,
      terca: datasPorDia[2].length,
      quarta: datasPorDia[3].length,
      quinta: datasPorDia[4].length,
      sexta: datasPorDia[5].length,
      sabado: datasPorDia[6].length,
      exemplosDomingo: datasPorDia[0].slice(0, 3),
      exemplosSegunda: datasPorDia[1].slice(0, 3),
      exemplosTerca: datasPorDia[2].slice(0, 3),
      exemplosQuarta: datasPorDia[3].slice(0, 3),
      exemplosQuinta: datasPorDia[4].slice(0, 3),
      exemplosSexta: datasPorDia[5].slice(0, 3),
      exemplosSabado: datasPorDia[6].slice(0, 3),
    })

    itensPorData.forEach((itens, dataKey) => {
      // Criar data no horário local para evitar problemas de fuso horário
      // dataKey está no formato 'yyyy-MM-dd'
      const [year, month, day] = dataKey.split('-').map(Number)
      const data = new Date(year, month - 1, day) // month é 0-indexed no Date
      const diaSemana = data.getDay() // 0=domingo, 1=segunda, ..., 6=sábado

      // Contar itens por dia
      contadorPorDia[diaSemana] += itens.length

      // Debug para todos os dias (limitado para não poluir muito o console)
      const nomeDia = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][diaSemana]
      if (contadorPorDia[diaSemana] <= 5 || diaSemana === 1 || diaSemana === 2 || diaSemana === 3) {
        // Logar primeiras 5 ocorrências de cada dia, ou sempre para segunda, terça e quarta
        console.log(`[Filtro] Data: ${dataKey}, Dia da semana: ${diaSemana} (${nomeDia}), Itens: ${itens.length}, Incluído: ${diasSelecionados.includes(diaSemana)}`)
      }

      if (diasSelecionados.includes(diaSemana)) {
        filtrados.set(dataKey, itens)
        contadorFiltradoPorDia[diaSemana] += itens.length
      }
    })

    console.log('[Filtro] Contador por dia (antes do filtro):', contadorPorDia)
    console.log('[Filtro] Contador por dia (após filtro):', contadorFiltradoPorDia)
    console.log('[Filtro] Total de datas após filtro:', filtrados.size)

    // Verificar se todos os dias selecionados têm itens
    const diasSemItens: number[] = []
    diasSelecionados.forEach(dia => {
      if (contadorFiltradoPorDia[dia] === 0) {
        diasSemItens.push(dia)
      }
    })

    if (diasSemItens.length > 0) {
      const nomesDiasSemItens = diasSemItens.map(d => ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d])
      console.warn('[Filtro] ⚠️ Dias selecionados sem itens após filtro:', nomesDiasSemItens.join(', '))
    } else {
      console.log('[Filtro] ✅ Todos os dias selecionados têm itens após filtro')
    }

    // Resumo final
    const totalItensAntes = Object.values(contadorPorDia).reduce((sum, count) => sum + count, 0)
    const totalItensDepois = Object.values(contadorFiltradoPorDia).reduce((sum, count) => sum + count, 0)
    console.log(`[Filtro] Resumo: ${totalItensAntes} itens antes → ${totalItensDepois} itens depois (${filtrados.size} datas únicas)`)

    return filtrados
  }, [itensPorData, diasSelecionados])

  // Criar objeto modifiers diretamente com as funções inline
  // Isso garante que o objeto seja recriado sempre que as dependências mudarem
  // IMPORTANTE: Este hook deve ser chamado ANTES de qualquer return condicional
  const modifiers = useMemo(() => {
    // Usar mapa original (não filtrado) para hasAulas e hasConcluidas
    // Essas marcações devem sempre aparecer, independente da seleção de dias
    const itensPorDataMap = new Map(itensPorData)
    const diasSelecionadosSorted = [...diasSelecionados].sort((a, b) => a - b)
    const tempoEstudosMap = new Map(tempoEstudosConcluidos)

    // Criar mapa de estatísticas por semana para acesso rápido
    const statsPorSemana = new Map<number, SemanaEstatisticas>()
    if (estatisticasSemanas) {
      estatisticasSemanas.semanas.forEach(semana => {
        statsPorSemana.set(semana.semana_numero, semana)
      })
    }

    console.log('[Modifiers] Recriando modifiers com dias selecionados:', diasSelecionadosSorted.join(','))
    console.log('[Modifiers] Total de datas no mapa original:', itensPorDataMap.size)
    console.log('[Modifiers] Manter dias atuais:', manterDiasAtuais)
    console.log('[Modifiers] Estatísticas disponíveis:', statsPorSemana.size, 'semanas')
    console.log('[Modifiers] Tempo de estudos concluídos:', tempoEstudosMap.size, 'registros')

    return {
      hasConcluidas: (date: Date) => {
        // Normalizar data para dataKey usando a função helper
        const dataKey = normalizarDataParaKey(date)

        // Usar mapa ORIGINAL (não filtrado) para garantir que sempre apareça
        const itens = itensPorDataMap.get(dataKey) || []
        const itensAula = itens.filter((item) => item.tipo === 'aula')

        // Verificar se TODAS as aulas do dia estão concluídas
        const todasAulasConcluidas = itensAula.length > 0 && itensAula.every(item => item.concluido)

        if (!todasAulasConcluidas) {
          return false
        }

        // Se todas as aulas estão concluídas, verificar se o tempo de estudos também está concluído
        // Agrupar itens por disciplina/frente para verificar tempo de estudos
        const gruposPorDisciplinaFrente = new Map<string, typeof itens>()
        itensAula.forEach((item) => {
          const disciplinaId = item.aulas?.modulos?.frentes?.disciplinas?.id || ''
          const frenteId = item.aulas?.modulos?.frentes?.id || ''
          const chave = `${disciplinaId}|${frenteId}`

          if (disciplinaId && frenteId) {
            if (!gruposPorDisciplinaFrente.has(chave)) {
              gruposPorDisciplinaFrente.set(chave, [])
            }
            gruposPorDisciplinaFrente.get(chave)!.push(item)
          }
        })

        // Verificar se todos os grupos têm tempo de estudos concluído
        let todosTemposEstudosConcluidos = true
        gruposPorDisciplinaFrente.forEach((itensGrupo, chave) => {
          const [disciplinaId, frenteId] = chave.split('|')
          const key = `${dataKey}|${disciplinaId}|${frenteId}`
          const tempoEstudosConcluido = tempoEstudosMap.get(key) || false

          // Só considerar se o grupo tem aulas com tempo estimado (tempo de estudos > 0)
          const velocidadeReproducao = cronograma?.velocidade_reproducao ?? 1.0
          const tempoAulasOriginal = itensGrupo.reduce((acc, item) => {
            return acc + (item.aulas?.tempo_estimado_minutos || 0)
          }, 0)
          const tempoAulasAjustado = tempoAulasOriginal / velocidadeReproducao
          const tempoEstudosExercicios = tempoAulasAjustado * 0.5

          if (tempoEstudosExercicios > 0 && !tempoEstudosConcluido) {
            todosTemposEstudosConcluidos = false
          }
        })

        return todasAulasConcluidas && todosTemposEstudosConcluidos
      },
      hasPendentes: (date: Date) => {
        // Normalizar data para dataKey usando a função helper
        const dataKey = normalizarDataParaKey(date)

        // Usar mapa ORIGINAL (não filtrado) para garantir que sempre apareça
        const itens = itensPorDataMap.get(dataKey) || []
        const itensAula = itens.filter((item) => item.tipo === 'aula')

        if (itens.length === 0) return false // Sem aulas, não é pendente

        const concluidas = itensAula.filter(item => item.concluido).length
        const temConcluidas = concluidas > 0
        const todasConcluidas = concluidas === itensAula.length

        // Pendente = tem aulas, tem pelo menos uma concluída, mas nem todas
        return temConcluidas && !todasConcluidas
      },
      hasAulas: (date: Date) => {
        // Normalizar data para dataKey usando a função helper
        const dataKey = normalizarDataParaKey(date)

        // Verificar diretamente se há itens nessa data específica no mapa ORIGINAL (não filtrado)
        const itens = itensPorDataMap.get(dataKey) || []
        const itensAula = itens.filter((item) => item.tipo === 'aula')
        const temAulas = itens.length > 0

        if (!temAulas) return false

        // hasAulas só deve ser true quando NÃO há aulas concluídas E NÃO há aulas pendentes
        // Ou seja, quando há aulas mas nenhuma está marcada como concluída
        const concluidas = itensAula.filter(item => item.concluido).length
        const nenhumaAulaMarcada = concluidas === 0

        return nenhumaAulaMarcada
      },
      hasSemanaSobrecarregada: (date: Date) => {
        if (!estatisticasSemanas || !cronograma) return false
        const semanaNum = getSemanaNumero(date, cronograma.data_inicio)
        if (!semanaNum) return false
        const stats = statsPorSemana.get(semanaNum)
        return stats ? stats.percentual_usado > 100 : false
      },
      hasSemanaCompleta: (date: Date) => {
        if (!estatisticasSemanas || !cronograma) return false
        const semanaNum = getSemanaNumero(date, cronograma.data_inicio)
        if (!semanaNum) return false
        const stats = statsPorSemana.get(semanaNum)
        return stats ? stats.percentual_usado >= 95 && stats.percentual_usado <= 100 : false
      },
      hasSemanaParcial: (date: Date) => {
        if (!estatisticasSemanas || !cronograma) return false
        const semanaNum = getSemanaNumero(date, cronograma.data_inicio)
        if (!semanaNum) return false
        const stats = statsPorSemana.get(semanaNum)
        return stats ? stats.percentual_usado > 0 && stats.percentual_usado < 95 : false
      },
      hasDiasSelecionados: (date: Date) => {
        // Se "manter dias atuais" estiver selecionado, não mostrar marcação amarela
        if (manterDiasAtuais) {
          return false
        }

        // Verificar se a data corresponde a um dos dias da semana selecionados
        // Aparece apenas se houver pelo menos um dia selecionado no card
        // E se for um dia selecionado (independente de ter aulas ou não)
        if (diasSelecionadosSorted.length === 0) {
          return false // Se nenhum dia estiver selecionado, não mostrar marcação amarela
        }

        const diaSemana = date.getDay()
        return diasSelecionadosSorted.includes(diaSemana)
      },
      hasFerias: (date: Date) => {
        // Verificar se a data está dentro de algum período de férias
        if (!cronograma?.periodos_ferias || cronograma.periodos_ferias.length === 0) {
          return false
        }

        const dataKey = normalizarDataParaKey(date)

        return cronograma.periodos_ferias.some(periodo => {
          if (!periodo.inicio || !periodo.fim) return false

          const inicioDate = new Date(periodo.inicio)
          const fimDate = new Date(periodo.fim)

          // Validar se as datas são válidas
          if (isNaN(inicioDate.getTime()) || isNaN(fimDate.getTime())) {
            return false
          }

          const inicio = normalizarDataParaKey(inicioDate)
          const fim = normalizarDataParaKey(fimDate)
          return dataKey >= inicio && dataKey <= fim
        })
      },
    }
  }, [itensPorData, diasSelecionados, manterDiasAtuais, cronograma, estatisticasSemanas, tempoEstudosConcluidos])

  // Log quando os dias selecionados mudarem para debug e forçar atualização
  // IMPORTANTE: Este hook deve ser chamado DEPOIS de itensPorDataFiltrados e modifiers
  // Usar apenas itensPorDataFiltrados.size para evitar problemas com Map nas dependências
  const itensPorDataSize = itensPorData.size
  const itensPorDataFiltradosSize = itensPorDataFiltrados.size

  useEffect(() => {
    console.log('[Effect] Dias selecionados mudaram:', diasSelecionados)
    console.log('[Effect] Itens filtrados disponíveis:', itensPorDataFiltradosSize)
    console.log('[Effect] Total de itens no mapa original:', itensPorDataSize)
    console.log('[Effect] Forçando atualização do calendário...')

    // Forçar atualização imediata do calendário quando os dias selecionados mudarem
    // Isso garante que o react-day-picker detecte as mudanças nos modifiers
    // Usar requestAnimationFrame para garantir que o estado foi atualizado antes do re-render
    const frameId = requestAnimationFrame(() => {
      // Forçar re-render do calendário atualizando o mês atual
      // (mas mantendo o mesmo mês para não resetar a visualização)
      setCurrentMonth(prev => {
        const newMonth = new Date(prev)
        // Forçar atualização criando uma nova referência com um pequeno ajuste
        // que não muda o mês visualmente, mas força o re-render
        newMonth.setMilliseconds(newMonth.getMilliseconds() + 1)
        console.log('[Effect] Atualizando mês do calendário para forçar re-render')
        return newMonth
      })
      // Também incrementar o contador de força de atualização
      setCalendarForceUpdate(v => v + 1)
    })

    return () => cancelAnimationFrame(frameId)
  }, [diasSelecionados, itensPorDataFiltradosSize, itensPorDataSize])

  // Returns condicionais DEVEM vir DEPOIS de todos os hooks
  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!cronograma) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6">
        <Card>
          <CardHeader>
            <CardTitle>Cronograma não encontrado</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const totalItens = cronograma.cronograma_itens.length
  const itensConcluidos = cronograma.cronograma_itens.filter((item) => item.concluido).length
  const progressoPercentual = totalItens > 0 ? (itensConcluidos / totalItens) * 100 : 0

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-4 md:space-y-6">
      {/* Header com Resumo */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg md:text-xl">{cronograma.nome || 'Meu Cronograma'}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <Badge variant="secondary" className="text-xs">Calendário</Badge>
                <span>
                  {format(new Date(cronograma.data_inicio), "dd 'de' MMMM", { locale: ptBR })} -{' '}
                  {format(new Date(cronograma.data_fim), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="metric-value text-primary">{itensConcluidos}</div>
              <div className="text-[11px] text-muted-foreground">Concluídas</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="metric-value">
                {totalItens - itensConcluidos}
              </div>
              <div className="text-[11px] text-muted-foreground">Pendentes</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className={cn(
                'metric-value',
                progressoPercentual >= 100 ? 'text-primary' : 'text-foreground',
              )}>
                {progressoPercentual.toFixed(1)}%
              </div>
              <div className="text-[11px] text-muted-foreground">Progresso</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <Progress value={progressoPercentual} />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{itensConcluidos} de {totalItens} aulas</span>
              <span>{progressoPercentual.toFixed(1)}% completo</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendário */}
      <Card className="overflow-hidden">
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <CalendarCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Calendário de Estudos</CardTitle>
                <CardDescription>
                  Selecione datas para ver e gerenciar suas aulas
                </CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={async () => {
                try {
                  const supabase = createClient()
                  const { data: { session } } = await supabase.auth.getSession()
                  if (!session?.access_token) {
                    alert('Sessão expirada. Faça login novamente.')
                    return
                  }
                  const res = await fetch(`/api/cronograma/${cronogramaId}/export/ics`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                  })
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: 'Erro ao exportar calendário' }))
                    alert(err.error || 'Erro ao exportar calendário')
                    return
                  }
                  const blob = await res.blob()
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `cronograma_${cronogramaId}.ics`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                } catch (e) {
                  console.error('Erro ao exportar calendário:', e)
                  alert('Erro ao exportar calendário')
                }
              }}
            >
              <CalendarCheck className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Exportar Calendário</span>
              <span className="sm:hidden">Exportar</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Seletor de Range - Oculto em mobile */}
          <div className="hidden md:flex flex-col gap-3">
            <CalendarDatePicker
              date={dateRange}
              onDateSelect={handleDateRangeSelect}
              numberOfMonths={2}
            />
          </div>

          {/* Calendário com marcações e painel de filtros */}
          <div className="flex flex-col xl:flex-row gap-3 xl:items-stretch w-full min-w-0">
            {/* Calendário */}
            <div
              className="flex flex-col w-full xl:flex-1 min-w-0"
              {...swipeHandlers}
            >
              {/* Navegação de mês em mobile */}
              <div className="md:hidden flex items-center justify-between mb-2 px-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth((prev) => subMonths(prev, 1))}
                  className="h-10 w-10"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1 text-center">
                  <p className="text-sm font-medium">
                    {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Deslize para navegar
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
                  className="h-10 w-10"
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>

              <div className="max-w-full">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={handleDateRangeSelect}
                  month={currentMonth}
                  onMonthChange={setCurrentMonth}
                  modifiers={modifiers}
                  modifiersClassNames={{
                    // hasConcluidas: verde (prioridade máxima - todas as aulas concluídas)
                    hasConcluidas:
                      'bg-[#34D399]/25 dark:bg-[#34D399]/30 border-2 border-[#059669]/70 dark:border-[#34D399]/70 ' +
                      'text-slate-950 dark:text-white [&>button]:text-slate-950 dark:[&>button]:text-white [&>button>span]:text-slate-950 dark:[&>button>span]:text-white',
                    // hasPendentes: laranja (prioridade média - algumas aulas concluídas mas não todas)
                    hasPendentes:
                      'bg-[#FB923C]/25 dark:bg-[#FB923C]/30 border-2 border-[#EA580C]/70 dark:border-[#FB923C]/70 ' +
                      'text-slate-950 dark:text-white [&>button]:text-slate-950 dark:[&>button]:text-white [&>button>span]:text-slate-950 dark:[&>button>span]:text-white',
                    // hasAulas: azul (prioridade baixa - tem aulas mas nenhuma concluída)
                    hasAulas:
                      'bg-[#60A5FA]/25 dark:bg-[#60A5FA]/30 border-2 border-[#2563EB]/70 dark:border-[#60A5FA]/70 ' +
                      'text-slate-950 dark:text-white [&>button]:text-slate-950 dark:[&>button]:text-white [&>button>span]:text-slate-950 dark:[&>button>span]:text-white',
                    // hasDiasSelecionados: amarelo (prioridade baixa - dia selecionado sem aulas ainda)
                    hasDiasSelecionados:
                      'bg-[#FACC15]/25 dark:bg-[#FACC15]/30 border-2 border-[#CA8A04]/75 dark:border-[#FACC15]/75 ' +
                      'text-slate-950 dark:text-white [&>button]:text-slate-950 dark:[&>button]:text-white [&>button>span]:text-slate-950 dark:[&>button>span]:text-white',
                    // hasFerias: rosa (períodos de férias e recesso)
                    hasFerias:
                      'bg-[#F472B6]/25 dark:bg-[#F472B6]/30 border-2 border-[#DB2777]/70 dark:border-[#F472B6]/70 ' +
                      'text-slate-950 dark:text-white [&>button]:text-slate-950 dark:[&>button]:text-white [&>button>span]:text-slate-950 dark:[&>button>span]:text-white',
                  }}
                  rangeMiddleClassName="bg-primary/15 dark:bg-primary/25 !text-slate-950 dark:!text-white/90 [&>button]:bg-transparent [&>button]:!text-slate-950 dark:[&>button]:!text-white/90 [&>button]:hover:bg-transparent [&>button]:hover:!text-slate-950 dark:[&>button]:hover:!text-white/90"
                  selectedClassName="[&>button]:bg-primary [&>button]:!text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:!text-primary-foreground"
                  numberOfMonths={2}
                  className="w-full rounded-md border px-1 py-2 sm:p-3"
                  style={{ width: '100%' }}
                  monthsClassName="relative flex w-full gap-1 sm:gap-3"
                  monthClassName="min-w-0 flex-1"
                  monthCaptionClassName="relative mx-3 flex h-6 items-center justify-center sm:mx-10 sm:h-7"
                  captionLabelClassName="truncate text-[11px] font-medium sm:text-sm"
                  weekdaysClassName="grid grid-cols-7"
                  weekdayClassName="w-auto text-[10px] font-normal text-muted-foreground sm:text-sm"
                  monthGridClassName="mx-auto mt-2 w-full sm:mt-4"
                  weekClassName="mt-1 grid w-full grid-cols-7 items-start sm:mt-2"
                  dayClassName="flex h-7 min-w-0 items-center justify-center p-0 text-xs sm:h-8 sm:text-sm"
                  dayButtonClassName="h-7 w-full min-w-0 rounded-sm p-0 text-xs font-normal transition-none aria-selected:opacity-100 sm:size-8 sm:rounded-md sm:text-sm"
                  buttonPreviousClassName="left-0 h-6 w-6 sm:h-7 sm:w-7"
                  buttonNextClassName="right-0 h-6 w-6 sm:h-7 sm:w-7"
                  locale={ptBR}
                  // Forçar atualização preservando o mês
                  defaultMonth={currentMonth}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 text-left">
                {isMobile
                  ? '💡 Dica: Deslize horizontalmente para navegar entre meses ou toque em uma data para selecionar'
                  : '💡 Dica: Dê um duplo clique em qualquer data para alterar a data inicial a qualquer momento'
                }
              </p>

              {/* Legenda */}
              <div className="mt-3 w-full space-y-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5">
                  <span className="text-xs font-semibold text-foreground">Legendas</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[#FACC15]/20 dark:bg-[#FACC15]/25 border border-[#FACC15]/35 dark:border-[#FACC15]/45 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">Selecionados</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[#60A5FA]/20 dark:bg-[#60A5FA]/25 border border-[#60A5FA]/35 dark:border-[#60A5FA]/45 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">Com aulas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[#34D399]/20 dark:bg-[#34D399]/25 border border-[#34D399]/35 dark:border-[#34D399]/45 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">Concluídas</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[#FB923C]/20 dark:bg-[#FB923C]/25 border border-[#FB923C]/35 dark:border-[#FB923C]/45 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">Pendentes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm bg-[#F472B6]/20 dark:bg-[#F472B6]/25 border border-[#F472B6]/35 dark:border-[#F472B6]/45 shrink-0" />
                    <span className="text-[11px] text-muted-foreground">Férias/Recesso</span>
                  </div>
                </div>

                {/* Instruções - colapsável */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 group">
                      <Info className="h-3.5 w-3.5" />
                      <span>Como usar o calendário</span>
                      <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-1.5 rounded-lg bg-muted/50 px-3 py-2.5">
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-px shrink-0">•</span>
                          <span>Selecione os dias da semana no painel lateral e clique em &quot;Salvar e Atualizar&quot;</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-px shrink-0">•</span>
                          <span>Clique em uma data ou selecione um período para ver as aulas agendadas</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-px shrink-0">•</span>
                          <span>Marque as aulas como concluídas usando os checkboxes na lista</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-px shrink-0">•</span>
                          <span>Dê um duplo clique em qualquer data para alterar o período selecionado</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-primary mt-px shrink-0">•</span>
                          <span>Use &quot;Exportar Calendário&quot; para baixar e importar em outros apps</span>
                        </li>
                      </ul>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </div>

            {!isConsolidated && (
            <div className="w-full xl:w-80 xl:shrink-0 flex flex-col gap-3 min-w-0">
            {/* Painel de Resumo Semanal - Colapsável */}
            {estatisticasSemanas && (
              <Card className="w-full">
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">Resumo por Semana</CardTitle>
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                                  aria-label="Informações sobre resumo por semana"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                align="start"
                                className="max-w-xs p-3 z-50"
                                sideOffset={8}
                              >
                                <div className="space-y-2 text-sm">
                                  <p>
                                    Este painel mostra um resumo detalhado de cada semana do seu cronograma.
                                  </p>
                                  <p>
                                    Para cada semana, você pode ver quanto tempo está disponível, quanto foi usado,
                                    quanto resta e quantas aulas foram concluídas.
                                  </p>
                                  <p>
                                    A barra de progresso indica o percentual de uso da capacidade semanal.
                                    Cores diferentes indicam diferentes níveis de uso: verde (bom), amarelo (moderado),
                                    laranja (alto) e vermelho (sobrecarregado).
                                  </p>
                                  <p>
                                    Semanas sobrecarregadas (acima de 100%) indicam que há mais conteúdo do que tempo disponível,
                                    e você pode precisar ajustar o cronograma.
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                      </div>
                      <CardDescription className="text-xs">
                        {estatisticasSemanas.resumo.semanas_uteis} semanas úteis • {estatisticasSemanas.resumo.semanas_sobrecarregadas > 0 && (
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {estatisticasSemanas.resumo.semanas_sobrecarregadas} sobrecarregada(s)
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="max-h-150 overflow-y-auto space-y-2 pt-0">
                      {estatisticasSemanas.semanas
                        .sort((a, b) => a.semana_numero - b.semana_numero)
                        .map((semana) => (
                          <div key={semana.semana_numero} className="rounded-lg bg-muted/50 p-2.5 space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-sm font-semibold">S{semana.semana_numero}</span>
                                <span className="text-[11px] text-muted-foreground">
                                  {format(new Date(semana.data_inicio), 'dd/MM')} – {format(new Date(semana.data_fim), 'dd/MM')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {semana.is_ferias && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Férias</Badge>
                                )}
                                <span className={cn(
                                  "text-[11px] font-semibold",
                                  semana.percentual_usado > 100 && "text-red-600 dark:text-red-400",
                                  semana.percentual_usado >= 80 && semana.percentual_usado <= 100 && "text-orange-600 dark:text-orange-400",
                                  semana.percentual_usado < 80 && "text-primary"
                                )}>
                                  {semana.percentual_usado.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <Progress
                              value={Math.min(100, semana.percentual_usado)}
                              className={cn(
                                "h-1.5",
                                semana.percentual_usado > 100 && "bg-red-500",
                                semana.percentual_usado >= 95 && semana.percentual_usado <= 100 && "bg-orange-500",
                                semana.percentual_usado >= 80 && semana.percentual_usado < 95 && "bg-yellow-500",
                                semana.percentual_usado < 80 && "bg-green-500"
                              )}
                            />
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Disponível</span>
                                <span className="font-medium">{formatarMinutos(semana.capacidade_minutos)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Usado</span>
                                <span className="font-medium">{formatarMinutos(semana.tempo_usado_minutos)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Restante</span>
                                <span className="font-medium">{formatarMinutos(semana.tempo_disponivel_minutos)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Aulas</span>
                                <span className="font-medium">{semana.aulas_concluidas}/{semana.total_aulas}</span>
                              </div>
                            </div>
                            {semana.percentual_usado > 100 && (
                              <div className="text-[11px] text-red-600 dark:text-red-400 font-medium">
                                Sobrecarregada — excede {(semana.percentual_usado - 100).toFixed(0)}%
                              </div>
                            )}
                          </div>
                        ))}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )}

            {/* Painel de Filtros - Lado Direito */}
            <Card className="w-full flex flex-col py-2">
              <CardHeader className="pb-1 pt-2 px-3">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold leading-tight">Dias de estudo</CardTitle>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                          aria-label="Informações sobre seleção de dias"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="left"
                        align="start"
                        className="max-w-xs p-3 z-50"
                        sideOffset={8}
                      >
                        <div className="space-y-2 text-sm">
                          <p>
                            Selecione os dias da semana em que você deseja estudar.
                          </p>
                          <p>
                            Ao salvar, o sistema recalcula automaticamente as datas de todas as aulas
                            para que sejam distribuídas nos dias selecionados.
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <CardDescription className="text-xs mt-0.5 leading-tight mb-0">
                  Selecione e salve para recalcular o calendário
                </CardDescription>
                {(() => {
                  // Verificar se há dias selecionados sem itens
                  const diasComItens = new Set<number>()
                  itensPorDataFiltrados.forEach((itens, dataKey) => {
                    const [year, month, day] = dataKey.split('-').map(Number)
                    const data = new Date(year, month - 1, day)
                    const diaSemana = data.getDay()
                    if (itens.length > 0) {
                      diasComItens.add(diaSemana)
                    }
                  })
                  const diasSemItens = diasSelecionados.filter(dia => !diasComItens.has(dia))

                  if (diasSemItens.length > 0 && diasSelecionados.length < 7) {
                    const nomesDiasSemItens = diasSemItens.map(d => ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][d])
                    return (
                      <div className="mt-1.5 p-1.5 bg-card border border-red-200 dark:border-red-300 rounded text-xs text-red-700 dark:text-red-700 leading-tight">
                        <p className="font-medium">Atenção:</p>
                        <p className="wrap-break-word">
                          Os dias {nomesDiasSemItens.join(', ')} estão selecionados mas não têm aulas ainda. Clique em &quot;Salvar e Atualizar Calendário&quot; para recalcular as datas.
                        </p>
                      </div>
                    )
                  }
                  return null
                })()}
              </CardHeader>
              <CardContent className="flex flex-col px-3 pb-2 pt-1 gap-2">
                {/* Checkbox "Manter dias atuais" */}
                <div className="rounded-lg bg-muted/50 p-2.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="manter-dias-atuais"
                      checked={manterDiasAtuais}
                      onCheckedChange={handleToggleManterDiasAtuais}
                      className="h-4 w-4"
                    />
                    <Label
                      htmlFor="manter-dias-atuais"
                      className="text-sm font-medium cursor-pointer flex-1 leading-tight"
                    >
                      Manter dias atuais
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground ml-6 mt-1 leading-tight">
                    {manterDiasAtuais
                      ? 'Usando os dias salvos. Desmarque para editar.'
                      : 'Selecione os dias abaixo.'}
                  </p>
                </div>

                {/* Lista de dias da semana */}
                <div className="flex flex-col gap-0.5">
                  {DIAS_SEMANA.map((dia) => (
                    <div key={dia.valor} className={cn(
                      "flex items-center space-x-2 py-1 px-2 rounded-md transition-colors",
                      diasSelecionados.includes(dia.valor) && !manterDiasAtuais && "bg-primary/5"
                    )}>
                      <Checkbox
                        id={`dia-${dia.valor}`}
                        checked={diasSelecionados.includes(dia.valor)}
                        onCheckedChange={() => handleToggleDia(dia.valor)}
                        disabled={manterDiasAtuais}
                        className="h-4 w-4"
                      />
                      <Label
                        htmlFor={`dia-${dia.valor}`}
                        className={cn(
                          "text-sm font-normal flex-1 leading-tight",
                          manterDiasAtuais ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                        )}
                      >
                        {dia.nome}
                      </Label>
                    </div>
                  ))}
                </div>

                {/* Botão de salvar */}
                <Button
                  onClick={handleSalvarDistribuicao}
                  disabled={salvandoDistribuicao || (diasSelecionados.length === 0 && !manterDiasAtuais)}
                  className="w-full"
                  size="sm"
                >
                  {salvandoDistribuicao ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar e Atualizar
                    </>
                  )}
                </Button>
                {salvandoDistribuicao && (
                  <p className="text-[11px] text-muted-foreground text-center animate-pulse leading-tight">
                    Recalculando datas das aulas...
                  </p>
                )}
              </CardContent>
            </Card>
            </div>
            )}
          </div>

          {/* Lista de itens por data (quando uma data é selecionada) */}
          {dateRange?.from && (
            <div className="mt-6 space-y-4" key={`lista-aulas-${itensPorData.size}-${dateRange.from?.getTime()}-${dateRange.to?.getTime()}`}>
              <h3 className="text-lg font-semibold">
                Aulas do período selecionado
              </h3>
              <div className="space-y-2">
                {(() => {
                  // Usar itensPorData (mapa original) em vez de itensPorDataFiltrados
                  // para mostrar TODAS as aulas do período selecionado, independente do filtro de dias
                  // Log detalhado das datas disponíveis
                  const todasDatasOriginais = Array.from(itensPorData.keys()).sort()
                  const primeiraData = todasDatasOriginais[0]
                  const ultimaData = todasDatasOriginais[todasDatasOriginais.length - 1]

                  console.log('[FiltroPeríodo] Iniciando filtro de período:', {
                    dateRangeFrom: dateRange.from ? normalizarDataParaKey(dateRange.from) : null,
                    dateRangeTo: dateRange.to ? normalizarDataParaKey(dateRange.to) : null,
                    dateRangeFromISO: dateRange.from?.toISOString(),
                    dateRangeToISO: dateRange.to?.toISOString(),
                    totalItensOriginais: itensPorData.size,
                    totalItensFiltrados: itensPorDataFiltrados.size,
                    primeiraDataNoMapa: primeiraData,
                    ultimaDataNoMapa: ultimaData,
                    totalDatasNoMapa: todasDatasOriginais.length,
                    exemplosDatasOriginais: todasDatasOriginais.slice(0, 10),
                    exemplosDatasFiltradas: Array.from(itensPorDataFiltrados.keys()).slice(0, 10),
                  })

                  // Verificar se as datas do range estão dentro do intervalo do mapa
                  if (dateRange.from) {
                    const fromKey = normalizarDataParaKey(dateRange.from)
                    const fromInMap = itensPorData.has(fromKey)
                    console.log('[FiltroPeríodo] Verificando data inicial:', {
                      fromKey,
                      fromInMap,
                      primeiraDataNoMapa: primeiraData,
                      ultimaDataNoMapa: ultimaData,
                      fromKeyAntesPrimeira: fromKey < primeiraData,
                      fromKeyDepoisUltima: fromKey > ultimaData,
                    })
                  }

                  if (dateRange.to) {
                    const toKey = normalizarDataParaKey(dateRange.to)
                    const toInMap = itensPorData.has(toKey)
                    console.log('[FiltroPeríodo] Verificando data final:', {
                      toKey,
                      toInMap,
                      primeiraDataNoMapa: primeiraData,
                      ultimaDataNoMapa: ultimaData,
                      toKeyAntesPrimeira: toKey < primeiraData,
                      toKeyDepoisUltima: toKey > ultimaData,
                    })
                  }

                  // Filtrar itens baseado no range selecionado
                  // Usar itensPorData para mostrar todas as aulas do período, não apenas as dos dias filtrados

                  // Normalizar datas do range para comparação
                  const normalizeDate = (d: Date) => {
                    const normalized = new Date(d)
                    normalized.setHours(0, 0, 0, 0)
                    return normalized
                  }

                  const fromNormalizada = dateRange.from ? normalizeDate(dateRange.from) : null
                  const toNormalizada = dateRange.to ? normalizeDate(dateRange.to) : null

                  // Converter para dataKey para comparação direta
                  const fromKey = fromNormalizada ? normalizarDataParaKey(fromNormalizada) : null
                  const toKey = toNormalizada ? normalizarDataParaKey(toNormalizada) : null

                  console.log('[FiltroPeríodo] Range normalizado:', {
                    fromKey,
                    toKey,
                    fromTime: fromNormalizada?.getTime(),
                    toTime: toNormalizada?.getTime(),
                  })

                  const itensFiltrados = Array.from(itensPorData.entries())
                    .filter(([dataKey, itens]) => {
                      if (!fromKey) return false

                      // Se apenas from está selecionado, mostrar apenas esse dia
                      if (!toKey) {
                        const matches = dataKey === fromKey
                        if (matches) {
                          console.log('[FiltroPeríodo] Item encontrado (apenas from):', {
                            dataKey,
                            fromKey,
                            itensCount: itens.length,
                          })
                        }
                        return matches
                      }

                      // Se ambos estão selecionados, mostrar intervalo
                      // Comparar strings diretamente (já estão no formato yyyy-MM-dd)
                      const withinInterval = dataKey >= fromKey && dataKey <= toKey

                      if (withinInterval) {
                        console.log('[FiltroPeríodo] Item encontrado (range):', {
                          dataKey,
                          fromKey,
                          toKey,
                          itensCount: itens.length,
                        })
                      } else {
                        // Log apenas para algumas datas para debug (não todas para não poluir)
                        const [year, month, day] = dataKey.split('-').map(Number)
                        const data = new Date(year, month - 1, day)
                        const diaSemana = data.getDay()
                        // Log apenas para segunda, quarta e sexta (dias que o usuário reportou problemas)
                        if ((diaSemana === 1 || diaSemana === 3 || diaSemana === 5) && itens.length > 0) {
                          console.log('[FiltroPeríodo] Item FORA do range:', {
                            dataKey,
                            fromKey,
                            toKey,
                            itensCount: itens.length,
                            antes: dataKey < fromKey,
                            depois: dataKey > toKey,
                          })
                        }
                      }

                      return withinInterval
                    })
                    .sort(([a], [b]) => a.localeCompare(b))

                  console.log('[FiltroPeríodo] Resultado final:', {
                    totalFiltrados: itensFiltrados.length,
                    datasEncontradas: itensFiltrados.map(([key]) => key),
                    totalItensNoMapa: itensPorDataFiltrados.size,
                    todasDatasNoMapa: Array.from(itensPorDataFiltrados.keys()),
                  })

                  if (itensFiltrados.length === 0) {
                    // Verificar se há itens no mapa original que não estão sendo filtrados
                    const todasDatas = Array.from(itensPorData.keys()).sort()
                    const primeiraData = todasDatas[0]
                    const ultimaData = todasDatas[todasDatas.length - 1]

                    console.warn('[FiltroPeríodo] Nenhum item encontrado. Verificando...', {
                      periodoSelecionado: {
                        from: fromKey,
                        to: toKey || 'apenas from',
                      },
                      periodoSelecionadoISO: {
                        from: dateRange.from?.toISOString().split('T')[0],
                        to: dateRange.to?.toISOString().split('T')[0] || 'apenas from',
                      },
                      totalDatasDisponiveis: todasDatas.length,
                      primeiraDataNoMapa: primeiraData,
                      ultimaDataNoMapa: ultimaData,
                      primeirasDatas: todasDatas.slice(0, 10),
                      ultimasDatas: todasDatas.slice(-10),
                      rangeDentroDoMapa: fromKey && toKey ? (fromKey >= primeiraData && toKey <= ultimaData) : null,
                    })

                    return (
                      <div className="text-sm text-muted-foreground text-center py-4 space-y-2">
                        <p>Nenhuma aula encontrada para o período selecionado.</p>
                        {itensPorData.size === 0 ? (
                          <p className="text-xs">
                            Nenhuma aula foi encontrada no cronograma. Verifique se o cronograma possui itens.
                          </p>
                        ) : (
                          <p className="text-xs">
                            O período selecionado pode estar fora do intervalo do cronograma ({primeiraData} a {ultimaData}).
                          </p>
                        )}
                      </div>
                    )
                  }

                  return itensFiltrados.map(([dataKey, itens]) => {
                    // Criar data no horário local para formatação
                    const [year, month, day] = dataKey.split('-').map(Number)
                    const data = new Date(year, month - 1, day)

                    // Agrupar itens por disciplina e frente
                    const itensAgrupados = new Map<string, typeof itens>()

                    itens.forEach((item) => {
                      const disciplinaNome = item.tipo === 'questoes_revisao'
                        ? 'Questões e revisão'
                        : (item.aulas?.modulos?.frentes?.disciplinas?.nome || 'Sem disciplina')
                      const frenteNome = item.tipo === 'questoes_revisao'
                        ? (item.frente_nome_snapshot || 'Frente concluída')
                        : (item.aulas?.modulos?.frentes?.nome || 'Sem frente')
                      const chave = `${disciplinaNome}|||${frenteNome}`

                      if (!itensAgrupados.has(chave)) {
                        itensAgrupados.set(chave, [])
                      }
                      itensAgrupados.get(chave)!.push(item)
                    })

                    // Ordenar grupos por disciplina e depois por frente
                    const gruposOrdenados = Array.from(itensAgrupados.entries()).sort(([chaveA], [chaveB]) => {
                      return chaveA.localeCompare(chaveB)
                    })

                    // Verificar se todas as aulas do dia estão concluídas
                    const itensAulaDia = itens.filter(item => item.tipo === 'aula')
                    const todasAulasDoDiaConcluidas = itensAulaDia.length > 0 && itensAulaDia.every(item => item.concluido)
                    const peloMenosUmaAulaDoDia = itensAulaDia.length > 0
                    // Criar chave única que inclui o estado de conclusão para forçar re-render
                    const concluidasCount = itensAulaDia.filter(item => item.concluido).length
                    const cardKey = `${dataKey}-${concluidasCount}-${itens.length}`

                    return (
                      <Card key={cardKey} className="overflow-hidden">
                        <CardHeader>
                          <div className="flex items-center justify-between gap-2">
                            <CardTitle className="text-base">
                              {format(data, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </CardTitle>
                            {peloMenosUmaAulaDoDia && !isConsolidated && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  console.log('[Button] Clicado, itens:', itens.length)
                                  await toggleTodasAulasDoDia(itensAulaDia)
                                }}
                                className="flex items-center gap-2"
                              >
                                <CheckSquare2 className="h-4 w-4" />
                                {todasAulasDoDiaConcluidas ? 'Desmarcar todas' : 'Marcar todas'}
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {gruposOrdenados.map(([chave, itensGrupo]) => {
                              const [disciplinaNome, frenteNome] = chave.split('|||')
                              const disciplinaId = itensGrupo[0]?.aulas?.modulos?.frentes?.disciplinas?.id || ''
                              const frenteId = itensGrupo[0]?.aulas?.modulos?.frentes?.id || ''

                              // Cor do grupo (disciplina + frente) baseada na paleta do app
                              const hash = (disciplinaId + frenteId).split('').reduce((acc, char) => {
                                return char.charCodeAt(0) + ((acc << 5) - acc)
                              }, 0)
                              const paleta = [
                                '#60A5FA', // Azul
                                '#22D3EE', // Ciano
                                '#34D399', // Verde
                                '#FACC15', // Amarelo
                                '#FB923C', // Laranja
                                '#A78BFA', // Roxo
                                '#F472B6', // Rosa (opcional)
                                '#F87171', // Vermelho
                              ] as const
                              const borderColor = paleta[Math.abs(hash) % paleta.length]

                              const estaExpandido = cardsExpandidos.has(chave)

                              return (
                                <Collapsible
                                  key={chave}
                                  open={estaExpandido}
                                  onOpenChange={(open) => {
                                    setCardsExpandidos(prev => {
                                      const novo = new Set(prev)
                                      if (open) {
                                        novo.add(chave)
                                      } else {
                                        novo.delete(chave)
                                      }
                                      return novo
                                    })
                                  }}
                                >
                                  <div
                                    className="border rounded-lg p-4 bg-card space-y-2 border-l-4"
                                    style={{ borderLeftColor: borderColor }}
                                  >
                                    {/* Cabeçalho do grupo: Disciplina e Frente */}
                                    <div className="mb-3 pb-2 border-b">
                                      <CollapsibleTrigger asChild>
                                        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                                          <div className="flex-1">
                                            <h4 className="font-semibold text-sm">{disciplinaNome}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">{frenteNome}</p>

                                            {/* Informações agregadas do grupo */}
                                            <div className="mt-2 flex flex-col items-start gap-1.5">
                                              <Badge
                                                variant="secondary"
                                                className="text-xs w-fit max-w-full whitespace-normal leading-tight"
                                              >
                                                Número de aulas: {itensGrupo.length}
                                              </Badge>
                                              {(() => {
                                                const velocidadeReproducao = cronograma?.velocidade_reproducao ?? 1.0

                                                // Calcular tempo de aulas ajustado pela velocidade
                                                const tempoAulasOriginal = itensGrupo.reduce((acc, item) => {
                                                  return acc + (item.aulas?.tempo_estimado_minutos || 0)
                                                }, 0)

                                                // Tempo de aula ajustado pela velocidade (se assistir em 1.5x, o tempo real é reduzido)
                                                const tempoAulasAjustado = tempoAulasOriginal / velocidadeReproducao

                                                // Tempo de estudos = 50% do tempo de aula ajustado (mesma lógica do backend)
                                                const tempoAnotacoesExercicios = tempoAulasAjustado * 0.5

                                                return (
                                                  <>
                                                    {tempoAulasAjustado > 0 && (
                                                      <Badge
                                                        variant="outline"
                                                        className="text-xs w-fit max-w-full whitespace-normal leading-tight text-muted-foreground"
                                                      >
                                                        Tempo estimado de aula: {formatTempo(tempoAulasAjustado)}
                                                      </Badge>
                                                    )}
                                                    {tempoAnotacoesExercicios > 0 && (
                                                      <Badge
                                                        variant="outline"
                                                        className="text-xs w-fit max-w-full whitespace-normal leading-tight text-muted-foreground"
                                                      >
                                                        Tempo estimado de Anotações/Exercícios: {formatTempo(tempoAnotacoesExercicios)}
                                                      </Badge>
                                                    )}
                                                  </>
                                                )
                                              })()}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {/* Estilo dinâmico para badge colorido (cores geradas dinamicamente) */}
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                              style={{
                                                '--badge-border-color': borderColor,
                                                '--badge-text-color': borderColor,
                                                borderColor: 'var(--badge-border-color)',
                                                color: 'var(--badge-text-color)',
                                              } as React.CSSProperties & { '--badge-border-color': string; '--badge-text-color': string }}
                                            >
                                              {itensGrupo.length} {itensGrupo.length === 1 ? 'aula' : 'aulas'}
                                            </Badge>
                                            {estaExpandido ? (
                                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                            ) : (
                                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                            )}
                                          </div>
                                        </div>
                                      </CollapsibleTrigger>
                                      {/* Botão para marcar todas as aulas da frente */}
                                      {!isConsolidated && (
                                      <div className="mt-2 flex justify-end">
                                        {(() => {
                                          const itensAulaGrupo = itensGrupo.filter(item => item.tipo === 'aula')
                                          if (itensAulaGrupo.length === 0) return null
                                          const todasAulasDaFrenteConcluidas = itensAulaGrupo.every(item => item.concluido)
                                          return (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                toggleTodasAulasDaFrente(itensAulaGrupo)
                                              }}
                                              className="flex items-center gap-2 text-xs h-7"
                                            >
                                              <CheckSquare2 className="h-3.5 w-3.5" />
                                              {todasAulasDaFrenteConcluidas ? 'Desmarcar todas' : 'Marcar todas'}
                                            </Button>
                                          )
                                        })()}
                                      </div>
                                      )}
                                    </div>

                                    {/* Lista de aulas do grupo */}
                                    <CollapsibleContent>
                                      <div className="space-y-2">
                                        {itensGrupo.map((item) => (
                                          <div
                                            key={item.id}
                                            className={cn(
                                              "flex items-center gap-3 p-2.5 rounded-md border hover:bg-accent/50 transition-colors",
                                              item.concluido && "opacity-60"
                                            )}
                                          >
                                            {item.tipo === 'aula' && (
                                              <Checkbox
                                                checked={item.concluido}
                                                onCheckedChange={(checked) =>
                                                  toggleConcluido(item.id, checked === true)
                                                }
                                                className="shrink-0"
                                              />
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <div className="flex flex-col gap-1">
                                                {item.tipo === 'questoes_revisao' ? (
                                                  <>
                                                    <Badge variant="secondary" className="text-xs whitespace-nowrap w-fit">
                                                      Questões e revisão
                                                    </Badge>
                                                    <span className="text-sm">
                                                      {item.mensagem || 'Você acabou o conteúdo desta frente. Use este tempo para questões e revisão.'}
                                                    </span>
                                                  </>
                                                ) : (
                                                  <>
                                                    {/* Linha 1: Módulo badge (número + nome) */}
                                                    {(item.aulas?.modulos?.numero_modulo || item.aulas?.modulos?.nome) && (
                                                      <Badge variant="outline" className="text-xs whitespace-nowrap w-fit text-muted-foreground">
                                                        {item.aulas?.modulos?.numero_modulo ? `M${item.aulas.modulos.numero_modulo}` : ''}
                                                        {item.aulas?.modulos?.numero_modulo && item.aulas?.modulos?.nome ? ' · ' : ''}
                                                        {item.aulas?.modulos?.nome || ''}
                                                      </Badge>
                                                    )}
                                                    {/* Linha 2: Número da aula + Nome da aula */}
                                                    <div className="flex items-center gap-1.5">
                                                      <span className="text-xs text-muted-foreground font-medium shrink-0">
                                                        Aula {item.aulas?.numero_aula || 'N/A'}
                                                      </span>
                                                      <span className="text-muted-foreground/40">·</span>
                                                      <span className={cn("text-sm truncate", item.concluido && "line-through")}>
                                                        {item.aulas?.nome || 'Aula sem nome'}
                                                      </span>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                            {/* Tempo + Badge concluída */}
                                            <div className="flex items-center gap-2 shrink-0">
                                              {item.concluido && item.tipo === 'aula' && (
                                                <Badge variant="default" className="text-xs">
                                                  Concluída
                                                </Badge>
                                              )}
                                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                {((item.tipo === 'questoes_revisao'
                                                  ? item.duracao_sugerida_minutos
                                                  : item.aulas?.tempo_estimado_minutos) || 0) > 0
                                                  ? formatTempo(item.tipo === 'questoes_revisao'
                                                    ? item.duracao_sugerida_minutos || 0
                                                    : item.aulas?.tempo_estimado_minutos || 0)
                                                  : '--'}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Checkbox para marcar tempo de estudos e exercícios */}
                                      {(() => {
                                        const velocidadeReproducao = cronograma?.velocidade_reproducao ?? 1.0

                                        // Calcular tempo de aulas ajustado pela velocidade
                                        const tempoAulasOriginal = itensGrupo.reduce((acc, item) => {
                                          return acc + (item.aulas?.tempo_estimado_minutos || 0)
                                        }, 0)

                                        // Tempo de aula ajustado pela velocidade
                                        const tempoAulasAjustado = tempoAulasOriginal / velocidadeReproducao

                                        // Tempo de estudos = 50% do tempo de aula ajustado (mesma lógica do backend)
                                        const tempoEstudosExercicios = tempoAulasAjustado * 0.5

                                        if (tempoEstudosExercicios <= 0) return null

                                        const key = `${dataKey}|${disciplinaId}|${frenteId}`
                                        const tempoEstudosConcluido = tempoEstudosConcluidos.get(key) || false

                                        const checkboxId = `tempo-estudos-${key}`

                                        return (
                                          <div className="mt-3 pt-3 border-t">
                                            <div
                                              className="flex items-center gap-3 p-3 rounded-md bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                                              onClick={() => toggleTempoEstudosConcluido(
                                                dataKey,
                                                disciplinaId,
                                                frenteId,
                                                !tempoEstudosConcluido
                                              )}
                                            >
                                              <Checkbox
                                                id={checkboxId}
                                                checked={tempoEstudosConcluido}
                                                onCheckedChange={(checked) =>
                                                  toggleTempoEstudosConcluido(
                                                    dataKey,
                                                    disciplinaId,
                                                    frenteId,
                                                    checked === true
                                                  )
                                                }
                                                className="mt-0.5"
                                                onClick={(e) => e.stopPropagation()}
                                              />
                                              <div className="flex-1">
                                                <Label htmlFor={checkboxId} className="text-sm font-medium cursor-pointer">
                                                  Tempo de Estudos + Exercícios
                                                </Label>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                  {formatTempo(tempoEstudosExercicios)} de tempo dedicado para anotações e exercícios
                                                </p>
                                              </div>
                                              {tempoEstudosConcluido && (
                                                <Badge variant="default" className="text-xs shrink-0">
                                                  Concluído
                                                </Badge>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })()}
                                    </CollapsibleContent>
                                  </div>
                                </Collapsible>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                })()}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

