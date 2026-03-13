'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/app/shared/core/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/app/shared/components/feedback/progress'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/app/shared/components/feedback/skeleton'
import { ScheduleList } from './schedule-list'
import { Clock, BookOpen, Target, CalendarDays, FileText, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addDays } from 'date-fns'
import { ptBR } from 'date-fns/locale/pt-BR'

const formatHorasFromMinutes = (minutos?: number | null) => {
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

const formatDateSafe = (dateString: string | null | undefined): string => {
  if (!dateString) {
    return 'Data inválida'
  }

  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Data inválida'
    }
    return format(date, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return 'Data inválida'
  }
}

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
        } | null
      } | null
    } | null
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
  prioridade_minima?: number
  disciplinas_selecionadas?: string[]
  velocidade_reproducao?: number
}

export function ScheduleDashboard({ cronogramaId }: { cronogramaId: string }) {
  const router = useRouter()
  const params = useParams()
  const tenant = params?.tenant as string
  const [loading, setLoading] = useState(true)
  const [cronograma, setCronograma] = useState<Cronograma | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [curso, setCurso] = useState<{ id: string; nome: string } | null>(null)
  const [disciplinas, setDisciplinas] = useState<Array<{ id: string; nome: string }>>([])

  useEffect(() => {
    async function loadCronograma() {
      if (!cronogramaId) {
        console.error('cronogramaId não fornecido')
        setLoading(false)
        return
      }

      try {
        const supabase = createClient()

        const { data: userResponse } = await supabase.auth.getUser()
        setUserId(userResponse?.user?.id ?? null)

        // Try to load cronograma first, then items separately to avoid nested query issues
        // Type assertion needed because database types are currently out of sync with actual schema
        const { data: cronogramaData, error: cronogramaError } = (await supabase
          .from('cronogramas')
          .select('*')
          .eq('id', cronogramaId)
          .single()) as { data: Omit<Cronograma, 'cronograma_itens'> | null; error: { message?: string; details?: string; hint?: string; code?: string } | null }

        if (cronogramaError) {
          console.error('Erro ao carregar cronograma base:', {
            message: cronogramaError.message ?? 'Sem mensagem',
            details: cronogramaError.details ?? null,
            hint: cronogramaError.hint ?? null,
            code: cronogramaError.code ?? null,
            cronogramaId,
            error: cronogramaError,
            errorString: String(cronogramaError),
            errorJSON: JSON.stringify(cronogramaError, Object.getOwnPropertyNames(cronogramaError)),
          })
          setLoading(false)
          return
        }

        if (!cronogramaData) {
          console.error('Cronograma não encontrado para o ID:', cronogramaId)
          setLoading(false)
          return
        }

        // Now load the items first without nested relationships
        console.log('[ScheduleDashboard] Buscando itens do cronograma:', cronogramaId)
        // Type assertion needed because database types are currently out of sync with actual schema
        type CronogramaItemRaw = {
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
        }
        const { data: itensData, error: itensError } = (await supabase
          .from('cronograma_itens')
          .select('id, tipo, aula_id, frente_id, frente_nome_snapshot, mensagem, duracao_sugerida_minutos, semana_numero, ordem_na_semana, concluido, data_conclusao')
          .eq('cronograma_id', cronogramaId)
          .order('semana_numero', { ascending: true })
          .order('ordem_na_semana', { ascending: true })) as { data: CronogramaItemRaw[] | null; error: { message?: string; details?: string; code?: string } | null }

        if (itensError) {
          const error = itensError as Record<string, unknown>;
          console.error('[ScheduleDashboard] Erro ao carregar itens do cronograma:', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
            cronogramaId,
          })
          // Continue anyway with empty items
        } else {
          console.log('[ScheduleDashboard] Itens carregados:', {
            total: itensData?.length || 0,
            primeirosItens: itensData?.slice(0, 3).map(i => ({
              id: i.id,
              tipo: i.tipo,
              aula_id: i.aula_id,
              semana_numero: i.semana_numero,
              ordem_na_semana: i.ordem_na_semana,
            })),
          })
        }

        // Load aulas separately and map them to items
        let itensCompletos: CronogramaItem[] = []
        if (itensData && itensData.length > 0) {
          const aulaIds = [...new Set(itensData.map(item => item.aula_id).filter((id): id is string => Boolean(id)))]

          if (aulaIds.length > 0) {
            console.log('[ScheduleDashboard] Buscando aulas:', aulaIds.length, 'aulas')

            // Load aulas with their relationships - usando joins mais simples
            // Primeiro buscar aulas básicas - garantir que temos pelo menos os dados básicos
            console.log('[ScheduleDashboard] Buscando', aulaIds.length, 'aulas com IDs:', aulaIds.slice(0, 3), '...')

            // Dividir em lotes de 100 IDs para evitar problemas com queries muito grandes
            const LOTE_SIZE = 100
            const lotes = []
            for (let i = 0; i < aulaIds.length; i += LOTE_SIZE) {
              lotes.push(aulaIds.slice(i, i + LOTE_SIZE))
            }

            console.log('[ScheduleDashboard] Dividindo em', lotes.length, 'lotes de até', LOTE_SIZE, 'IDs cada')

            // Buscar aulas em lotes
            const todasAulas: AulaData[] = []
            let aulasBasicasError: { message: string; details?: string; hint?: string; code?: string } | null = null

            for (let i = 0; i < lotes.length; i++) {
              const lote = lotes[i]
              console.log(`[ScheduleDashboard] Buscando lote ${i + 1}/${lotes.length} com ${lote.length} IDs...`)

              const { data: loteData, error: loteError } = await supabase
                .from('aulas')
                .select('id, nome, numero_aula, tempo_estimado_minutos, curso_id, modulo_id')
                .in('id', lote)

              if (loteError) {
                console.error(`[ScheduleDashboard] Erro no lote ${i + 1}/${lotes.length}:`, {
                  message: loteError.message,
                  details: loteError.details,
                  hint: loteError.hint,
                  code: loteError.code,
                  loteSize: lote.length,
                  firstIdInLote: lote[0],
                })
                // Não parar completamente, apenas marcar o erro
                if (!aulasBasicasError) {
                  aulasBasicasError = loteError
                }
              } else if (loteData) {
                todasAulas.push(...loteData)
                console.log(`[ScheduleDashboard] ✓ Lote ${i + 1}/${lotes.length} retornou ${loteData.length} aulas`)
              } else {
                console.warn(`[ScheduleDashboard] ⚠️ Lote ${i + 1}/${lotes.length} retornou null/undefined`)
              }
            }

            const aulasBasicas = todasAulas.length > 0 ? todasAulas : null

            if (aulasBasicasError) {
              console.error('[ScheduleDashboard] Erro ao carregar aulas básicas:', {
                message: aulasBasicasError.message,
                details: aulasBasicasError.details,
                hint: aulasBasicasError.hint,
                code: aulasBasicasError.code,
                aulaIdsCount: aulaIds.length,
                firstIds: aulaIds.slice(0, 3),
              })
              // Se houver erro, ainda assim tentar continuar com array vazio para não quebrar
            }

            if (!aulasBasicas || aulasBasicas.length === 0) {
              console.error('[ScheduleDashboard] ⚠️ Nenhuma aula encontrada após buscar em lotes!')
              console.error('[ScheduleDashboard] IDs buscados:', aulaIds.length, 'IDs:', aulaIds.slice(0, 10))
              console.error('[ScheduleDashboard] Erro da query:', aulasBasicasError)

              // Tentar buscar uma por uma para debug
              if (aulaIds.length > 0) {
                console.log('[ScheduleDashboard] Tentando buscar primeira aula individualmente para debug...')
                const { data: testAula, error: testError } = await supabase
                  .from('aulas')
                  .select('id, nome, modulo_id')
                  .eq('id', aulaIds[0])
                  .single()

                console.log('[ScheduleDashboard] Teste individual - aula:', testAula)
                console.log('[ScheduleDashboard] Teste individual - erro:', testError)
                if (testError) {
                  console.error('[ScheduleDashboard] Detalhes do erro individual:', {
                    message: testError.message,
                    details: testError.details,
                    hint: testError.hint,
                    code: testError.code,
                  })
                }
              }
            } else {
              console.log('[ScheduleDashboard] ✓ Aulas básicas encontradas:', aulasBasicas.length, 'de', aulaIds.length, 'IDs buscados')
              if (aulasBasicas.length > 0) {
                console.log('[ScheduleDashboard] Primeira aula:', aulasBasicas[0])
              }
              if (aulasBasicas.length < aulaIds.length) {
                const foundIds = new Set(aulasBasicas.map(a => a.id))
                const missingIds = aulaIds.filter(id => !foundIds.has(id))
                console.warn('[ScheduleDashboard] ⚠️ Algumas aulas não foram encontradas:', missingIds.length, 'faltando. Primeiros:', missingIds.slice(0, 5))
              }
              const moduloIdsUnicos = [...new Set(aulasBasicas.map(a => a.modulo_id).filter(Boolean))]
              console.log('[ScheduleDashboard] Módulos IDs das aulas:', moduloIdsUnicos.length, 'módulos únicos')
            }

            // Buscar módulos das aulas
            const moduloIds = [...new Set((aulasBasicas || []).map(a => a.modulo_id).filter((id): id is string => !!id))]
            let modulosMap = new Map()

            if (moduloIds.length > 0) {
              // Type assertion needed because database types are currently out of sync with actual schema
              const { data: modulosData, error: modulosError } = (await supabase
                .from('modulos')
                .select('id, nome, numero_modulo, frente_id')
                .in('id', moduloIds)) as { data: ModuloMapValue[] | null; error: unknown }

              if (modulosError) {
                console.error('Erro ao carregar módulos:', modulosError)
              } else if (modulosData) {
                modulosMap = new Map(modulosData.map(m => [m.id, m]))
              }
            }

            // Buscar frentes dos módulos
            const frenteIds = [...new Set(Array.from(modulosMap.values()).map((m: ModuloMapValue) => m.frente_id).filter(Boolean))]
            let frentesMap = new Map()

            if (frenteIds.length > 0) {
              // Type assertion needed because database types are currently out of sync with actual schema
              const { data: frentesData, error: frentesError } = (await supabase
                .from('frentes')
                .select('id, nome, disciplina_id')
                .in('id', frenteIds)) as { data: FrenteMapValue[] | null; error: unknown }

              if (frentesError) {
                console.error('Erro ao carregar frentes:', frentesError)
              } else if (frentesData) {
                frentesMap = new Map(frentesData.map(f => [f.id, f]))
              }
            }

            // Buscar disciplinas das frentes
            const disciplinaIds = [...new Set(Array.from(frentesMap.values()).map((f: FrenteMapValue) => f.disciplina_id).filter(Boolean))]
            let disciplinasMap = new Map()

            if (disciplinaIds.length > 0) {
              // Type assertion needed because database types are currently out of sync with actual schema
              const { data: disciplinasData, error: disciplinasError } = (await supabase
                .from('disciplinas')
                .select('id, nome')
                .in('id', disciplinaIds)) as { data: DisciplinaMapValue[] | null; error: unknown }

              if (disciplinasError) {
                console.error('Erro ao carregar disciplinas:', disciplinasError)
              } else if (disciplinasData) {
                disciplinasMap = new Map(disciplinasData.map(d => [d.id, d]))
              }
            }

            // Montar estrutura completa das aulas
            const aulasCompletas = (aulasBasicas || []).map(aula => {
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

            console.log('[ScheduleDashboard] Aulas completas montadas:', aulasCompletas.length, 'de', aulasBasicas?.length || 0, 'aulas básicas')
            if (aulasCompletas.length > 0) {
              console.log('[ScheduleDashboard] Exemplo de aula completa:', JSON.stringify(aulasCompletas[0], null, 2))
            }

            // Create a lookup map for aulas
            const aulasMap = new Map(aulasCompletas.map(aula => [aula.id, aula]))

            // Map items with their aula data
            itensCompletos = itensData.map(item => {
              const aula = item.aula_id ? aulasMap.get(item.aula_id) : null
              if (item.tipo === 'aula' && !aula) {
                console.warn('[ScheduleDashboard] Aula não encontrada para item:', item.id, 'aula_id:', item.aula_id)
              }
              return {
                ...item,
                concluido: item.concluido ?? false,
                aulas: aula || null,
              }
            })

            console.log('[ScheduleDashboard] Itens completos montados:', itensCompletos.length)
            console.log('[ScheduleDashboard] Itens com aulas:', itensCompletos.filter(item => item.aulas !== null).length)
            console.log('[ScheduleDashboard] Itens sem aulas:', itensCompletos.filter(item => item.aulas === null).length)
          } else {
            // No aula_ids, just use items as-is
            itensCompletos = itensData.map(item => ({
              ...item,
              concluido: item.concluido ?? false,
              aulas: null,
            }))
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

        // Combine the data
        const data = {
          ...cronogramaData,
          nome: cronogramaData.nome || '',
          modalidade_estudo: (cronogramaData.modalidade_estudo === 'paralelo' || cronogramaData.modalidade_estudo === 'sequencial')
            ? cronogramaData.modalidade_estudo
            : 'paralelo' as 'paralelo' | 'sequencial',
          cronograma_itens: itensCompletos,
          periodos_ferias: periodosFeriasConvertidos,
        } as Cronograma

        // Note: We continue even if there's an error loading items,
        // as the cronograma itself loaded successfully and items might load separately

        // Ordenar itens por semana e ordem
        if (data.cronograma_itens) {
          data.cronograma_itens.sort((a, b) => {
            if (a.semana_numero !== b.semana_numero) {
              return a.semana_numero - b.semana_numero
            }
            return a.ordem_na_semana - b.ordem_na_semana
          })
        }

        setCronograma(data)

        // Buscar informações do curso e disciplinas
        if (data.curso_alvo_id) {
          const { data: cursoData } = await supabase
            .from('cursos')
            .select('id, nome')
            .eq('id', data.curso_alvo_id)
            .single()

          if (cursoData) {
            setCurso(cursoData)
          }
        }

        if (data.disciplinas_selecionadas && data.disciplinas_selecionadas.length > 0) {
          const { data: disciplinasData } = await supabase
            .from('disciplinas')
            .select('id, nome')
            .in('id', data.disciplinas_selecionadas)
            .order('nome', { ascending: true })

          if (disciplinasData) {
            setDisciplinas(disciplinasData)
          }
        }
      } catch (err) {
        console.error('Erro inesperado ao carregar cronograma:', {
          error: err,
          errorString: String(err),
          errorJSON: JSON.stringify(err, Object.getOwnPropertyNames(err)),
          cronogramaId,
        })
      } finally {
        setLoading(false)
      }
    }

    loadCronograma()

    // Subscription Realtime para sincronizar mudanças em cronograma_itens
    const supabase = createClient()
    const channel = supabase
      .channel(`cronograma-itens-dashboard-${cronogramaId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cronograma_itens',
          filter: `cronograma_id=eq.${cronogramaId}`,
        },
        (payload) => {
          console.log('[Realtime Dashboard] Mudança detectada em cronograma_itens:', payload)

          interface CronogramaItemUpdate {
            id: string;
            concluido: boolean;
            data_conclusao: string | null;
            [key: string]: unknown;
          }
          // Recarregar o item específico que mudou - usando setCronograma com callback para evitar dependência de cronograma
          if (payload.new) {
            const updatedItem = payload.new as CronogramaItemUpdate
            setCronograma((prev) => {
              if (!prev) return prev
              const updatedItems = prev.cronograma_itens.map((item) =>
                item.id === updatedItem.id
                  ? { ...item, concluido: updatedItem.concluido, data_conclusao: updatedItem.data_conclusao }
                  : item
              )
              return { ...prev, cronograma_itens: updatedItems }
            })
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Remover item deletado
            const deletedItem = payload.old as { id: string;[key: string]: unknown }
            const deletedId = deletedItem.id
            setCronograma((prev) => {
              if (!prev) return prev
              const updatedItems = prev.cronograma_itens.filter((item) => item.id !== deletedId)
              return { ...prev, cronograma_itens: updatedItems }
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [cronogramaId])

  // Hooks relocated to top-level to avoid conditional hook call errors
  // Função para calcular semanas disponibilizadas (período entre data início e fim, descontando férias)
  const semanasDisponibilizadas = useMemo(() => {
    if (!cronograma) return 0
    const dataInicio = cronograma.data_inicio
    const dataFim = cronograma.data_fim
    const ferias = cronograma.periodos_ferias || []

    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    let semanas = 0
    let dataAtual = new Date(inicio)

    while (dataAtual <= fim) {
      const fimSemana = addDays(dataAtual, 6) // 7 dias (0-6)

      // Verificar se a semana cai em período de férias
      let isFerias = false
      for (const periodo of ferias || []) {
        if (!periodo.inicio || !periodo.fim) continue

        const inicioFerias = new Date(periodo.inicio)
        const fimFerias = new Date(periodo.fim)

        // Validar se as datas são válidas
        if (isNaN(inicioFerias.getTime()) || isNaN(fimFerias.getTime())) {
          continue
        }

        if (
          (dataAtual >= inicioFerias && dataAtual <= fimFerias) ||
          (fimSemana >= inicioFerias && fimSemana <= fimFerias) ||
          (dataAtual <= inicioFerias && fimSemana >= fimFerias)
        ) {
          isFerias = true
          break
        }
      }

      if (!isFerias) {
        semanas++
      }

      dataAtual = addDays(dataAtual, 7)
    }

    return semanas
  }, [cronograma])

  // Calcular semanas com aulas (semanas que têm pelo menos um item)
  const semanasComAulas = useMemo(() =>
    cronograma ? new Set(cronograma.cronograma_itens.map(item => item.semana_numero)).size : 0
  , [cronograma])

  // Calcular todas as semanas do cronograma (incluindo férias)
  const todasSemanas = useMemo(() => {
    if (!cronograma) return []
    const dataInicio = new Date(cronograma.data_inicio)
    const dataFim = new Date(cronograma.data_fim)
    const semanas: number[] = []
    let semanaNumero = 1
    const dataAtual = new Date(dataInicio)

    while (dataAtual <= dataFim) {
      semanas.push(semanaNumero)
      dataAtual.setDate(dataAtual.getDate() + 7)
      semanaNumero = semanaNumero + 1
    }
    return semanas
  }, [cronograma])

  // Agrupar itens por semana
  const itensPorSemana = useMemo(() => {
    if (!cronograma || !todasSemanas) return {}
    const agrupado = cronograma.cronograma_itens.reduce((acc, item) => {
      if (!acc[item.semana_numero]) {
        acc[item.semana_numero] = []
      }
      acc[item.semana_numero].push(item)
      return acc
    }, {} as Record<number, CronogramaItem[]>)

    // Garantir que todas as semanas tenham uma entrada (mesmo que vazia)
    todasSemanas.forEach((semana) => {
      if (!agrupado[semana]) {
        agrupado[semana] = []
      }
    })

    // Ordenar itens dentro de cada semana
    Object.keys(agrupado).forEach((semana) => {
      agrupado[Number(semana)].sort((a, b) => a.ordem_na_semana - b.ordem_na_semana)
    })

    return agrupado
  }, [cronograma, todasSemanas])

  // Calcular total de semanas e semana atual (depois de itensPorSemana estar definido)
  const { totalSemanas, semanaAtual } = useMemo(() => {
    if (!cronograma || !itensPorSemana || !todasSemanas) return { totalSemanas: 0, semanaAtual: 0 }
    const hoje = new Date()
    const dataInicioCalc = new Date(cronograma.data_inicio)
    const diffTime = hoje.getTime() - dataInicioCalc.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    const total = Math.max(1, Object.keys(itensPorSemana).length || todasSemanas.length || 1)
    const atual = Math.min(total, Math.max(1, Math.floor(diffDays / 7) + 1))

    return { totalSemanas: total, semanaAtual: atual }
  }, [cronograma, itensPorSemana, todasSemanas])

  const horasPorDisciplina = useMemo(() => {
    const horas: Record<string, number> = {}
    if (cronograma?.cronograma_itens) {
      cronograma.cronograma_itens.forEach((item) => {
        const disciplinaId = item.aulas?.modulos?.frentes?.disciplinas?.id
        if (disciplinaId && item.aulas?.tempo_estimado_minutos) {
          horas[disciplinaId] = (horas[disciplinaId] || 0) + item.aulas.tempo_estimado_minutos
        }
      })
    }
    return horas
  }, [cronograma?.cronograma_itens])

  const toggleConcluido = async (itemId: string, concluido: boolean) => {
    const itemAlvo = cronograma?.cronograma_itens.find((item) => item.id === itemId)
    if (!itemAlvo || itemAlvo.tipo !== 'aula') {
      return
    }

    const supabase = createClient()

    const updateData: { concluido: boolean; data_conclusao: string | null } = { concluido, data_conclusao: null }
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
        const { error: aulaError } = await supabase
          .from('aulas_concluidas')
          .upsert(
            {
              usuario_id: alunoAtual,
              aula_id: itemAlvo.aula_id,
              curso_id: cursoDaAula,
            },
            { onConflict: 'usuario_id,aula_id' },
          )
        if (aulaError) {
          console.error('Erro ao registrar aula concluída:', {
            message: aulaError.message,
            details: aulaError.details,
            hint: aulaError.hint,
            code: aulaError.code,
            aluno_id: alunoAtual,
            aula_id: itemAlvo.aula_id,
            curso_id: cursoDaAula,
          })
        } else {
          console.log('✓ Aula concluída registrada com sucesso:', {
            aluno_id: alunoAtual,
            aula_id: itemAlvo.aula_id,
            curso_id: cursoDaAula,
          })
        }
      } else {
        const { error: deleteError } = await supabase
          .from('aulas_concluidas')
          .delete()
          .eq('usuario_id', alunoAtual)
          .eq('aula_id', itemAlvo.aula_id)
        if (deleteError) {
          console.error('Erro ao remover aula concluída:', {
            message: deleteError.message,
            details: deleteError.details,
            hint: deleteError.hint,
            code: deleteError.code,
            aluno_id: alunoAtual,
            aula_id: itemAlvo.aula_id,
          })
        } else {
          console.log('✓ Aula concluída removida com sucesso:', {
            aluno_id: alunoAtual,
            aula_id: itemAlvo.aula_id,
          })
        }
      }
    } else {
      console.warn('⚠️ Não foi possível registrar aula concluída - dados faltando:', {
        temAulaId: !!itemAlvo?.aula_id,
        temAlunoAtual: !!alunoAtual,
        temCursoDaAula: !!cursoDaAula,
        aulaId: itemAlvo?.aula_id,
        alunoAtual,
        cursoDaAula,
      })
    }

    // Atualizar estado local
    if (cronograma) {
      const updatedItems = cronograma.cronograma_itens.map((item) =>
        item.id === itemId
          ? { ...item, concluido, data_conclusao: updateData.data_conclusao }
          : item
      )
      setCronograma({ ...cronograma, cronograma_itens: updatedItems })
    }
  }

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
          <CardContent>
            <Button onClick={() => router.push(tenant ? `/${tenant}/cronograma` : '/cronograma')}>
              Voltar para cronogramas
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const itensAula = cronograma.cronograma_itens.filter((item) => item.tipo === 'aula')
  const totalItens = itensAula.length
  const itensConcluidos = itensAula.filter((item) => item.concluido).length
  const progressoPercentual = totalItens > 0 ? (itensConcluidos / totalItens) * 100 : 0

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-6 space-y-4 md:space-y-6">
      {/* Header com Resumo */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-lg md:text-xl">{cronograma.nome || 'Meu Cronograma'}</CardTitle>
              <CardDescription className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                <Badge variant="secondary" className="text-xs">
                  Semana {semanaAtual} de {totalSemanas}
                </Badge>
                <span>
                  {format(new Date(cronograma.data_inicio), "dd 'de' MMMM", { locale: ptBR })} -{' '}
                  {format(new Date(cronograma.data_fim), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </CardDescription>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
                onClick={async () => {
                  try {
                    const supabase = createClient()
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session?.access_token) {
                      alert('Sessão expirada. Faça login novamente.')
                      return
                    }
                    const res = await fetch(`/api/cronograma/${cronogramaId}/export/pdf`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ error: 'Erro ao exportar PDF' }))
                      alert(err.error || 'Erro ao exportar PDF')
                      return
                    }
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `cronograma_${cronogramaId}.pdf`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                  } catch (e) {
                    console.error('Erro ao exportar PDF:', e)
                    alert('Erro ao exportar PDF')
                  }
                }}
              >
                <FileText className="mr-1.5 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-initial"
                onClick={async () => {
                  try {
                    const supabase = createClient()
                    const { data: { session } } = await supabase.auth.getSession()
                    if (!session?.access_token) {
                      alert('Sessão expirada. Faça login novamente.')
                      return
                    }
                    const res = await fetch(`/api/cronograma/${cronogramaId}/export/xlsx`, {
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({ error: 'Erro ao exportar XLSX' }))
                      alert(err.error || 'Erro ao exportar XLSX')
                      return
                    }
                    const blob = await res.blob()
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `cronograma_${cronogramaId}.xlsx`
                    document.body.appendChild(a)
                    a.click()
                    a.remove()
                    URL.revokeObjectURL(url)
                  } catch (e) {
                    console.error('Erro ao exportar XLSX:', e)
                    alert('Erro ao exportar XLSX')
                  }
                }}
              >
                <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                XLSX
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="metric-value text-primary">{semanaAtual}</div>
              <div className="text-[11px] text-muted-foreground">Semana atual</div>
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-center">
              <div className="metric-value">
                {itensConcluidos}
                <span className="text-base font-normal text-muted-foreground">/{totalItens}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">Aulas concluídas</div>
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

      {/* Card de Resumo das Configurações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo da Configuração</CardTitle>
          <CardDescription>Detalhes do seu cronograma de estudos</CardDescription>
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
                  {format(new Date(cronograma.data_inicio), "dd/MM/yyyy", { locale: ptBR })} - {' '}
                  {format(new Date(cronograma.data_fim), "dd/MM/yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Dias por semana</span>
                <span className="font-medium">{cronograma.dias_estudo_semana}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horas por dia</span>
                <span className="font-medium">{cronograma.horas_estudo_dia}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Semanas disponíveis</span>
                <span className="font-medium">
                  {semanasDisponibilizadas}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Semanas do cronograma</span>
                <span className="font-medium text-primary">{semanasComAulas}</span>
              </div>
            </div>
          </div>

          {/* Curso e Disciplinas */}
          {(curso || disciplinas.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>Curso e Disciplinas</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                {curso && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Curso</span>
                    <span className="font-medium">{curso.nome}</span>
                  </div>
                )}
                {disciplinas.length > 0 && (
                  <>
                    {curso && <Separator />}
                    {disciplinas.map((disciplina) => {
                      const horasTotais = horasPorDisciplina[disciplina.id] || 0
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
          )}

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
                  }[cronograma.prioridade_minima || 2] || 'Não definida'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo de Estudo</span>
                <Badge variant="secondary" className="text-xs font-medium">
                  {cronograma.modalidade_estudo === 'paralelo' ? 'Frentes em Paralelo' : 'Estudo Sequencial'}
                </Badge>
              </div>
              {cronograma.velocidade_reproducao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Velocidade</span>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {cronograma.velocidade_reproducao.toFixed(2)}x
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Pausas e Recessos */}
          {cronograma.periodos_ferias && cronograma.periodos_ferias.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span>Pausas e Recessos</span>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                {cronograma.periodos_ferias.map((periodo, index) => (
                  <div key={index} className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>
                      {formatDateSafe(periodo.inicio)} - {formatDateSafe(periodo.fim)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Itens */}
      <ScheduleList
        itensPorSemana={itensPorSemana}
        dataInicio={cronograma.data_inicio}
        dataFim={cronograma.data_fim}
        periodosFerias={cronograma.periodos_ferias || []}
        modalidade={cronograma.modalidade_estudo}
        cronogramaId={cronogramaId}
        onToggleConcluido={toggleConcluido}
        onUpdate={(updater) => {
          if (cronograma) {
            const updatedItensPorSemana = updater(itensPorSemana)
            // Converter itensPorSemana de volta para cronograma_itens
            const updatedItens: CronogramaItem[] = []
            Object.values(updatedItensPorSemana).forEach(itens => {
              updatedItens.push(...itens)
            })
            setCronograma({
              ...cronograma,
              cronograma_itens: updatedItens
            })
          }
        }}
      />
    </div>
  )
}

