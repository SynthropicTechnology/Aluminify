/**
 * Tipos e utilitarios compartilhados para exportacao PDF do cronograma.
 */

export interface CronogramaExport {
  nome: string
  aluno_nome?: string
  data_inicio: string
  data_fim: string
  dias_estudo_semana: number
  horas_estudo_dia: number
  modalidade_estudo: string
  velocidade_reproducao?: number
  prioridade_minima?: number
  curso_nome?: string
  disciplinas_nomes?: string[]
  periodos_ferias?: Array<{ inicio: string; fim: string }>
  [key: string]: unknown
}

export interface ItemExport {
  id: string
  tipo: 'aula' | 'questoes_revisao'
  aula_id: string | null
  frente_id?: string | null
  frente_nome_snapshot?: string | null
  mensagem?: string | null
  duracao_sugerida_minutos?: number | null
  semana_numero: number
  ordem_na_semana: number
  data_prevista?: string | null
  concluido: boolean
  data_conclusao?: string | null
  aulas?: {
    id?: string
    nome?: string
    numero_aula?: number | null
    tempo_estimado_minutos?: number | null
    curso_id?: string | null
    modulos?: {
      id?: string
      nome?: string
      numero_modulo?: number | null
      frentes?: {
        id?: string
        nome?: string
        disciplinas?: {
          id?: string
          nome?: string
        } | null
      } | null
    } | null
  } | null
}

export const MODALIDADES_LABEL: Record<number, string> = {
  1: 'Super Extensivo',
  2: 'Extensivo',
  3: 'Semi Extensivo',
  4: 'Intensivo',
  5: 'Superintensivo',
}

export function formatTempo(minutos?: number | null) {
  if (!minutos || minutos <= 0) return '--'
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h > 0 && m > 0) return `${h}h ${m}min`
  if (h > 0) return `${h}h`
  return `${m}min`
}

export function formatDateBR(dateString?: string | null) {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return String(dateString)
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch {
    return String(dateString)
  }
}

export function formatDayOfWeek(dateString: string) {
  try {
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(d)
  } catch {
    return ''
  }
}

export function formatDateShort(dateString?: string | null) {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d)
  } catch {
    return ''
  }
}

export function formatTipoEstudo(modalidade_estudo?: string) {
  if (modalidade_estudo === 'paralelo') return 'Frentes em Paralelo'
  if (modalidade_estudo === 'sequencial') return 'Estudo Sequencial'
  return String(modalidade_estudo || 'Não informado')
}

export function asNumberSafe(value: unknown, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function normalizePeriodosFerias(raw: unknown): Array<{ inicio: string; fim: string }> {
  if (!raw || !Array.isArray(raw)) return []
  return raw
    .map((p) => {
      if (!p || typeof p !== 'object') return null
      const inicio = 'inicio' in p ? String((p as { inicio?: unknown }).inicio ?? '') : ''
      const fim = 'fim' in p ? String((p as { fim?: unknown }).fim ?? '') : ''
      if (!inicio || !fim) return null
      return { inicio, fim }
    })
    .filter((p): p is { inicio: string; fim: string } => Boolean(p))
}

export function truncateText(text: string, maxChars: number) {
  const t = (text ?? '').trim()
  if (!t) return ''
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

export function formatModuloLabel(numero: number | null | undefined, nome: string) {
  const n = (nome ?? '').trim()
  if (numero && Number.isFinite(numero)) {
    return `Módulo ${numero} - ${n || 'Sem nome'}`
  }
  return n || 'Módulo sem nome'
}
