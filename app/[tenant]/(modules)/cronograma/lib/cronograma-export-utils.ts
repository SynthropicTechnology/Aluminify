import { getDatabaseClient } from '@/app/shared/core/database/database'
import type { SupabaseClient } from '@supabase/supabase-js'

interface CronogramaData {
  id: string;
  nome: string | null;
  data_inicio: string;
  data_fim: string;
  [key: string]: unknown;
}

export interface CronogramaCompleto {
  cronograma: CronogramaData
  itens: Array<{
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
          } | null
        } | null
      } | null
    } | null
  }>
}

export async function fetchCronogramaCompleto(
  cronogramaId: string,
  clientOverride?: SupabaseClient,
): Promise<CronogramaCompleto> {
  const client = clientOverride ?? getDatabaseClient()
  const { data: cronograma, error: cronogramaError } = await client
    .from('cronogramas')
    .select('*')
    .eq('id', cronogramaId)
    .single()
  if (cronogramaError || !cronograma) throw new Error('Cronograma não encontrado')

  const { data: itens } = await client
    .from('cronograma_itens')
    .select('id, tipo, aula_id, frente_id, frente_nome_snapshot, mensagem, duracao_sugerida_minutos, semana_numero, ordem_na_semana, concluido, data_conclusao, data_prevista')
    .eq('cronograma_id', cronogramaId)
    .order('semana_numero', { ascending: true })
    .order('ordem_na_semana', { ascending: true })

  interface AulaData {
    id: string;
    nome: string;
    numero_aula: number | null;
    tempo_estimado_minutos: number | null;
    curso_id: string | null;
    modulo_id: string | null;
  }

  interface ModuloData {
    id: string;
    nome: string;
    numero_modulo: number | null;
    frente_id: string | null;
  }

  interface FrenteData {
    id: string;
    nome: string;
    disciplina_id: string | null;
  }

  interface DisciplinaData {
    id: string;
    nome: string;
  }

  const aulaIds = [...new Set((itens || []).map((i) => i.aula_id).filter((id): id is string => Boolean(id)))]
  type AulaDetalhe = CronogramaCompleto['itens'][number]['aulas']
  let aulasMap = new Map<string, AulaDetalhe>()
  if (aulaIds.length) {
    const LOTE = 100
    const todasAulas: AulaData[] = []
    for (let i = 0; i < aulaIds.length; i += LOTE) {
      const { data: lote } = await client
        .from('aulas')
        .select('id, nome, numero_aula, tempo_estimado_minutos, curso_id, modulo_id')
        .in('id', aulaIds.slice(i, i + LOTE))
      if (lote) todasAulas.push(...lote)
    }

    const moduloIds = [...new Set(todasAulas.map((a) => a.modulo_id).filter((id): id is string => Boolean(id)))]
    let modulosMap = new Map<string, ModuloData>()
    if (moduloIds.length) {
      const { data: modulos } = await client
        .from('modulos')
        .select('id, nome, numero_modulo, frente_id')
        .in('id', moduloIds)
      if (modulos) modulosMap = new Map(modulos.map((m) => [m.id, m as ModuloData]))
    }

    const frenteIds = [...new Set(Array.from(modulosMap.values()).map((m) => m.frente_id).filter((id): id is string => Boolean(id)))]
    let frentesMap = new Map<string, FrenteData>()
    if (frenteIds.length) {
      const { data: frentes } = await client
        .from('frentes')
        .select('id, nome, disciplina_id')
        .in('id', frenteIds)
      if (frentes) frentesMap = new Map(frentes.map((f) => [f.id, f as FrenteData]))
    }

    const disciplinaIds = [...new Set(Array.from(frentesMap.values()).map((f) => f.disciplina_id).filter((id): id is string => Boolean(id)))]
    let disciplinasMap = new Map<string, DisciplinaData>()
    if (disciplinaIds.length) {
      const { data: disciplinas } = await client
        .from('disciplinas')
        .select('id, nome')
        .in('id', disciplinaIds)
      if (disciplinas) disciplinasMap = new Map(disciplinas.map((d: DisciplinaData) => [d.id, d]))
    }

    aulasMap = new Map(
      todasAulas.map((a) => {
        const modulo = a.modulo_id ? modulosMap.get(a.modulo_id) : undefined
        const frente = modulo?.frente_id ? frentesMap.get(modulo.frente_id) : null
        const disciplina = frente?.disciplina_id ? disciplinasMap.get(frente.disciplina_id) : null
        return [
          a.id,
          {
            id: a.id,
            nome: a.nome,
            numero_aula: a.numero_aula,
            tempo_estimado_minutos: a.tempo_estimado_minutos,
            curso_id: a.curso_id,
            modulos: modulo
              ? {
                  id: modulo.id,
                  nome: modulo.nome,
                  numero_modulo: modulo.numero_modulo,
                  frentes: frente
                    ? {
                        id: frente.id,
                        nome: frente.nome,
                        disciplinas: disciplina ? { id: disciplina.id, nome: disciplina.nome } : null,
                      }
                    : null,
                }
              : null,
          },
        ]
      }),
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itensCompletos: CronogramaCompleto['itens'] = (itens || []).map((item: any) => ({
    id: String(item.id),
    tipo: item.tipo === 'questoes_revisao' ? 'questoes_revisao' : 'aula',
    aula_id: item.aula_id ? String(item.aula_id) : null,
    frente_id: item.frente_id ? String(item.frente_id) : null,
    frente_nome_snapshot: item.frente_nome_snapshot ?? null,
    mensagem: item.mensagem ?? null,
    duracao_sugerida_minutos: item.duracao_sugerida_minutos ?? null,
    semana_numero: Number(item.semana_numero),
    ordem_na_semana: Number(item.ordem_na_semana),
    concluido: Boolean(item.concluido),
    data_conclusao: item.data_conclusao ?? null,
    data_prevista: item.data_prevista ?? null,
    aulas: item.aula_id ? aulasMap.get(String(item.aula_id)) || null : null,
  }))

  return { cronograma, itens: itensCompletos }
}




