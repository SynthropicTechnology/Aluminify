/**
 * Transformações de dados para o PDF do cronograma.
 * Agrupamentos por semana, dia, disciplina. Cálculos de progresso e estatísticas.
 */

import type { CronogramaExport, ItemExport } from './pdf-types'
import {
  formatDateBR,
  formatDayOfWeek,
  formatDateShort,
  formatModuloLabel,
  asNumberSafe,
  MODALIDADES_LABEL,
  formatTipoEstudo,
} from './pdf-types'
import { buildDisciplineColorMap, DISCIPLINE_PALETTE, type DisciplineColor } from './pdf-theme'

// ---------------------------------------------------------------------------
// Tipos de agrupamento
// ---------------------------------------------------------------------------

export interface ModuloGroup {
  moduloId: string
  moduloLabel: string
  itens: ItemExport[]
}

export interface FrenteGroup {
  frenteId: string
  frenteNome: string
  modulos: ModuloGroup[]
}

export interface DisciplinaGroup {
  disciplinaId: string
  disciplinaNome: string
  color: DisciplineColor
  frentes: FrenteGroup[]
}

export interface DayGroup {
  date: string
  dateFormatted: string
  dayName: string
  disciplinas: DisciplinaGroup[]
}

export interface WeekGroup {
  semanaNumero: number
  dateRange: string
  itens: ItemExport[]
  days: DayGroup[]
  stats: WeekStats
}

export interface WeekStats {
  total: number
  completed: number
  percent: number
  totalMinutes: number
  completedMinutes: number
}

export interface DisciplineStats {
  disciplinaId: string
  disciplinaNome: string
  color: DisciplineColor
  total: number
  completed: number
  percent: number
  totalMinutes: number
}

export interface OverallStats {
  totalItems: number
  completedItems: number
  percent: number
  totalAulaMinutes: number
  totalNotesMinutes: number
  totalMinutes: number
  totalWeeks: number
  disciplineStats: DisciplineStats[]
  disciplineColorMap: Map<string, DisciplineColor>
}

// ---------------------------------------------------------------------------
// Calculos principais
// ---------------------------------------------------------------------------

export function calculateOverallStats(
  cronograma: CronogramaExport,
  itens: ItemExport[],
): OverallStats {
  const velocidade = Math.max(1, asNumberSafe(cronograma.velocidade_reproducao, 1))
  const fator = 1.5

  const totalItems = itens.length
  const completedItems = itens.filter((it) => it.concluido).length
  const percent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0

  let totalAulaMinutes = 0
  itens.forEach((it) => {
    if (it.tipo === 'questoes_revisao') {
      const t = it.duracao_sugerida_minutos
      if (t && t > 0) totalAulaMinutes += t
      return
    }
    const t = it.aulas?.tempo_estimado_minutos
    if (t && t > 0) totalAulaMinutes += t / velocidade
  })
  const totalNotesMinutes = totalAulaMinutes * (fator - 1)
  const totalMinutes = totalAulaMinutes + totalNotesMinutes

  // Semanas unicas
  const weekSet = new Set(itens.map((it) => it.semana_numero))
  const totalWeeks = weekSet.size

  // Extrair disciplinas unicas
  const discMap = new Map<string, { nome: string; total: number; completed: number; minutes: number }>()
  itens.forEach((it) => {
    const dId = it.tipo === 'questoes_revisao'
      ? `questoes-${it.frente_id || 'sem-frente'}`
      : (it.aulas?.modulos?.frentes?.disciplinas?.id || 'sem-disciplina')
    const dNome = it.tipo === 'questoes_revisao'
      ? `Questões/Revisão${it.frente_nome_snapshot ? ` (${it.frente_nome_snapshot})` : ''}`
      : (it.aulas?.modulos?.frentes?.disciplinas?.nome || 'Sem Disciplina')
    if (!discMap.has(dId)) {
      discMap.set(dId, { nome: dNome, total: 0, completed: 0, minutes: 0 })
    }
    const d = discMap.get(dId)!
    d.total++
    if (it.concluido) d.completed++
    if (it.tipo === 'questoes_revisao') {
      const t = it.duracao_sugerida_minutos
      if (t && t > 0) d.minutes += t
    } else {
      const t = it.aulas?.tempo_estimado_minutos
      if (t && t > 0) d.minutes += t / velocidade
    }
  })

  // Criar mapa de cores
  const disciplineColorMap = buildDisciplineColorMap(Array.from(discMap.keys()))

  const disciplineStats: DisciplineStats[] = Array.from(discMap.entries()).map(
    ([id, d]) => ({
      disciplinaId: id,
      disciplinaNome: d.nome,
      color: disciplineColorMap.get(id)!,
      total: d.total,
      completed: d.completed,
      percent: d.total > 0 ? (d.completed / d.total) * 100 : 0,
      totalMinutes: d.minutes,
    }),
  )

  return {
    totalItems,
    completedItems,
    percent,
    totalAulaMinutes,
    totalNotesMinutes,
    totalMinutes,
    totalWeeks,
    disciplineStats,
    disciplineColorMap,
  }
}

// ---------------------------------------------------------------------------
// Agrupamento hierarquico: Semana > Dia > Disciplina > Frente > Modulo
// ---------------------------------------------------------------------------

export function groupItemsByWeeks(
  itens: ItemExport[],
  colorMap: Map<string, DisciplineColor>,
  velocidade: number,
): WeekGroup[] {
  // Agrupar por semana
  const weekMap = new Map<number, ItemExport[]>()
  itens.forEach((it) => {
    const sem = it.semana_numero || 0
    if (!weekMap.has(sem)) weekMap.set(sem, [])
    weekMap.get(sem)!.push(it)
  })

  const weeks: WeekGroup[] = []

  for (const [semanaNumero, weekItens] of Array.from(weekMap.entries()).sort(
    (a, b) => a[0] - b[0],
  )) {
    const sorted = [...weekItens].sort(
      (a, b) => (a.ordem_na_semana || 0) - (b.ordem_na_semana || 0),
    )

    // Date range da semana
    const dates = sorted
      .map((it) => it.data_prevista)
      .filter(Boolean) as string[]
    const dateRange =
      dates.length > 0
        ? `${formatDateShort(dates[0])} a ${formatDateShort(dates[dates.length - 1])}`
        : ''

    // Stats da semana
    const completed = sorted.filter((it) => it.concluido).length
    let totalMin = 0
    let completedMin = 0
    sorted.forEach((it) => {
      if (it.tipo === 'questoes_revisao') {
        const t = it.duracao_sugerida_minutos
        if (t && t > 0) {
          totalMin += t
          if (it.concluido) completedMin += t
        }
      } else {
        const t = it.aulas?.tempo_estimado_minutos
        if (t && t > 0) {
          totalMin += t / velocidade
          if (it.concluido) completedMin += t / velocidade
        }
      }
    })

    const stats: WeekStats = {
      total: sorted.length,
      completed,
      percent: sorted.length > 0 ? (completed / sorted.length) * 100 : 0,
      totalMinutes: totalMin,
      completedMinutes: completedMin,
    }

    // Agrupar por dia (data_prevista)
    const dayMap = new Map<string, ItemExport[]>()
    sorted.forEach((it) => {
      const dateKey = it.data_prevista || 'sem-data'
      if (!dayMap.has(dateKey)) dayMap.set(dateKey, [])
      dayMap.get(dateKey)!.push(it)
    })

    const days: DayGroup[] = Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dateKey, dayItens]) => ({
        date: dateKey,
        dateFormatted:
          dateKey === 'sem-data' ? '' : formatDateBR(dateKey),
        dayName:
          dateKey === 'sem-data'
            ? 'Sem data'
            : capitalizeFirst(formatDayOfWeek(dateKey)),
        disciplinas: groupByDisciplina(dayItens, colorMap),
      }))

    weeks.push({
      semanaNumero,
      dateRange,
      itens: sorted,
      days,
      stats,
    })
  }

  return weeks
}

// ---------------------------------------------------------------------------
// Agrupamento interno: Disciplina > Frente > Modulo
// ---------------------------------------------------------------------------

function groupByDisciplina(
  itens: ItemExport[],
  colorMap: Map<string, DisciplineColor>,
): DisciplinaGroup[] {
  const discMap = new Map<
    string,
    { nome: string; frentesMap: Map<string, { nome: string; modulosMap: Map<string, { label: string; itens: ItemExport[] }> }> }
  >()

  itens.forEach((it) => {
    const isQuestoes = it.tipo === 'questoes_revisao'
    const dId = isQuestoes
      ? `questoes-${it.frente_id || 'sem-frente'}`
      : (it.aulas?.modulos?.frentes?.disciplinas?.id || 'sem-disciplina')
    const dNome = isQuestoes
      ? 'Questões e Revisão'
      : (it.aulas?.modulos?.frentes?.disciplinas?.nome || 'Sem Disciplina')
    const fId = isQuestoes
      ? (it.frente_id || 'frente-concluida')
      : (it.aulas?.modulos?.frentes?.id || 'sem-frente')
    const fNome = isQuestoes
      ? (it.frente_nome_snapshot || 'Frente concluída')
      : (it.aulas?.modulos?.frentes?.nome || 'Sem Frente')
    const mId = isQuestoes ? 'questoes-revisao' : (it.aulas?.modulos?.id || 'sem-modulo')
    const mNome = isQuestoes ? 'Questões e Revisão' : (it.aulas?.modulos?.nome || '')
    const mNumero = isQuestoes ? null : (it.aulas?.modulos?.numero_modulo ?? null)
    const mLabel = isQuestoes ? 'Questões e Revisão' : formatModuloLabel(mNumero, mNome)

    if (!discMap.has(dId)) {
      discMap.set(dId, { nome: dNome, frentesMap: new Map() })
    }
    const disc = discMap.get(dId)!

    if (!disc.frentesMap.has(fId)) {
      disc.frentesMap.set(fId, { nome: fNome, modulosMap: new Map() })
    }
    const frente = disc.frentesMap.get(fId)!

    if (!frente.modulosMap.has(mId)) {
      frente.modulosMap.set(mId, { label: mLabel, itens: [] })
    }
    frente.modulosMap.get(mId)!.itens.push(it)
  })

  // Fallback color - use first color from palette
  const defaultColor = DISCIPLINE_PALETTE[0]

  return Array.from(discMap.entries()).map(([dId, d]) => ({
    disciplinaId: dId,
    disciplinaNome: d.nome,
    color: colorMap.get(dId) || defaultColor,
    frentes: Array.from(d.frentesMap.entries()).map(([fId, f]) => ({
      frenteId: fId,
      frenteNome: f.nome,
      modulos: Array.from(f.modulosMap.entries()).map(([mId, m]) => ({
        moduloId: mId,
        moduloLabel: m.label,
        itens: m.itens,
      })),
    })),
  }))
}

// ---------------------------------------------------------------------------
// Info grid items para a capa
// ---------------------------------------------------------------------------

export function buildInfoGridItems(cronograma: CronogramaExport): Array<{ label: string; value: string }> {
  const velocidade = Math.max(1, asNumberSafe(cronograma.velocidade_reproducao, 1))
  const modalidadeLabel =
    MODALIDADES_LABEL[
      Math.max(1, Math.min(5, asNumberSafe(cronograma.prioridade_minima, 2)))
    ] || 'Não definida'

  const items: Array<{ label: string; value: string }> = [
    { label: 'Modalidade', value: modalidadeLabel },
    { label: 'Tipo de estudo', value: formatTipoEstudo(cronograma.modalidade_estudo) },
    { label: 'Dias/semana', value: String(cronograma.dias_estudo_semana || 5) },
    { label: 'Horas/dia', value: `${cronograma.horas_estudo_dia || 2}h` },
    { label: 'Velocidade', value: `${velocidade.toFixed(2)}x` },
  ]

  const periodos = cronograma.periodos_ferias || []
  if (periodos.length > 0) {
    items.push({
      label: 'Pausas',
      value: periodos
        .map((p) => `${formatDateBR(p.inicio)} - ${formatDateBR(p.fim)}`)
        .join(', '),
    })
  }

  return items
}

// ---------------------------------------------------------------------------
// Dados de tempo por disciplina para WeekTimeBar
// ---------------------------------------------------------------------------

export function getWeekDisciplineTime(
  itens: ItemExport[],
  colorMap: Map<string, DisciplineColor>,
  velocidade: number,
): Array<{ nome: string; minutes: number; color: string }> {
  const map = new Map<string, { nome: string; minutes: number; color: string }>()

  itens.forEach((it) => {
    const dId = it.tipo === 'questoes_revisao'
      ? `questoes-${it.frente_id || 'sem-frente'}`
      : (it.aulas?.modulos?.frentes?.disciplinas?.id || 'sem-disciplina')
    const dNome = it.tipo === 'questoes_revisao'
      ? `Questões/Revisão${it.frente_nome_snapshot ? ` (${it.frente_nome_snapshot})` : ''}`
      : (it.aulas?.modulos?.frentes?.disciplinas?.nome || 'Sem Disciplina')
    if (!map.has(dId)) {
      const dColor = colorMap.get(dId)
      map.set(dId, { nome: dNome, minutes: 0, color: dColor?.accent || '#6B7280' })
    }
    if (it.tipo === 'questoes_revisao') {
      const t = it.duracao_sugerida_minutos
      if (t && t > 0) {
        map.get(dId)!.minutes += t
      }
    } else {
      const t = it.aulas?.tempo_estimado_minutos
      if (t && t > 0) {
        map.get(dId)!.minutes += t / velocidade
      }
    }
  })

  return Array.from(map.values()).filter((d) => d.minutes > 0)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalizeFirst(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * Calcula o tempo total de aulas de um array de itens, ajustado pela velocidade.
 */
export function calcTempoItems(itens: ItemExport[], velocidade: number) {
  let aulaMin = 0
  itens.forEach((it) => {
    if (it.tipo === 'questoes_revisao') {
      const t = it.duracao_sugerida_minutos
      if (t && t > 0) aulaMin += t
      return
    }
    const t = it.aulas?.tempo_estimado_minutos
    if (t && t > 0) aulaMin += t / velocidade
  })
  const anotMin = aulaMin * 0.5 // fator 1.5 -> notas = 0.5x aula
  return { aulaMin, anotMin, totalMin: aulaMin + anotMin }
}
