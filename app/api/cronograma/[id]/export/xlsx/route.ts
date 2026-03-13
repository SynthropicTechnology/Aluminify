import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, type AuthenticatedRequest } from '@/app/[tenant]/auth/middleware'
import { getDatabaseClientAsUser } from '@/app/shared/core/database/database'
import ExcelJS from 'exceljs'
import { fetchCronogramaCompleto } from '@/app/[tenant]/(modules)/cronograma/lib/cronograma-export-utils'

export const runtime = 'nodejs'

interface CronogramaExport {
  nome: string;
  data_inicio: string;
  data_fim: string;
  dias_estudo_semana: number;
  horas_estudo_dia: number;
  modalidade_estudo: string;
  velocidade_reproducao?: number;
  [key: string]: unknown;
}

interface ItemExport {
  id: string;
  tipo: 'aula' | 'questoes_revisao';
  aula_id: string | null;
  frente_id?: string | null;
  frente_nome_snapshot?: string | null;
  mensagem?: string | null;
  duracao_sugerida_minutos?: number | null;
  semana_numero: number;
  ordem_na_semana: number;
  data_prevista?: string | null;
  concluido: boolean;
  data_conclusao?: string | null;
  aulas?: {
    id?: string;
    nome?: string;
    numero_aula?: number | null;
    tempo_estimado_minutos?: number | null;
    curso_id?: string | null;
    modulos?: {
      id?: string;
      nome?: string;
      numero_modulo?: number | null;
      frentes?: {
        id?: string;
        nome?: string;
        disciplinas?: {
          id?: string;
          nome?: string;
        } | null;
      } | null;
    } | null;
  } | null;
}

function formatTempo(minutos?: number | null) {
  if (!minutos || minutos <= 0) return '--'
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h > 0 && m > 0) return `${h}h ${m} min`
  if (h > 0) return `${h}h`
  return `${m} min`
}

/**
 * Retorna cor de fundo da linha baseada no número da semana e na frente.
 * Cada semana tem uma família de cores (azul, verde, amarelo) e cada frente
 * tem uma intensidade diferente dentro dessa família.
 */
function corSemanaFrente(semanaNumero: number, frenteNome: string): string {
  // Famílias de cores por semana (3 tons cada: claro, médio, intenso)
  const familias = [
    // Azul (semanas 1, 4, 7...)
    ['E8F4FD', 'D1E9FB', 'B8DCF8'],
    // Verde (semanas 2, 5, 8...)
    ['E8F8F0', 'D1F1E0', 'B8E8D0'],
    // Amarelo (semanas 3, 6, 9...)
    ['FFF8E8', 'FFF1D1', 'FFE8B8'],
  ]
  
  // Determinar índice da frente (A=0, B=1, C=2, outras=0)
  const frenteUpper = (frenteNome || '').toUpperCase().trim()
  let frenteIndex = 0
  if (frenteUpper.startsWith('FRENTE B') || frenteUpper === 'B') {
    frenteIndex = 1
  } else if (frenteUpper.startsWith('FRENTE C') || frenteUpper === 'C') {
    frenteIndex = 2
  }
  
  const familiaIndex = (semanaNumero - 1) % familias.length
  return familias[familiaIndex][frenteIndex]
}

/**
 * Reordena os itens do cronograma para agrupar por frente dentro de cada semana.
 * Ordem: Semana → Frente (A, B, C) → Módulo → Aula
 */
function sortByFrenteWithinWeek(itens: ItemExport[]): ItemExport[] {
  return [...itens].sort((a, b) => {
    // 1. Ordenar por semana
    if (a.semana_numero !== b.semana_numero) {
      return a.semana_numero - b.semana_numero;
    }
    // 2. Ordenar por nome da frente (A, B, C)
    const frenteA = a.aulas?.modulos?.frentes?.nome || a.frente_nome_snapshot || '';
    const frenteB = b.aulas?.modulos?.frentes?.nome || b.frente_nome_snapshot || '';
    if (frenteA !== frenteB) {
      return frenteA.localeCompare(frenteB, 'pt-BR');
    }
    // 3. Ordenar por número do módulo
    const moduloA = a.aulas?.modulos?.numero_modulo ?? 0;
    const moduloB = b.aulas?.modulos?.numero_modulo ?? 0;
    if (moduloA !== moduloB) {
      return moduloA - moduloB;
    }
    // 4. Ordenar por número da aula
    const aulaA = a.aulas?.numero_aula ?? 0;
    const aulaB = b.aulas?.numero_aula ?? 0;
    return aulaA - aulaB;
  });
}

async function buildWorkbook(cronograma: CronogramaExport, itens: ItemExport[]) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Aluminify'
  wb.created = new Date()

  const resumo = wb.addWorksheet('Resumo')
  resumo.properties.defaultRowHeight = 18
  resumo.columns = [
    { header: 'Campo', key: 'campo', width: 28 },
    { header: 'Valor', key: 'valor', width: 60 },
  ]

  resumo.mergeCells('A1:B1')
  const titulo = resumo.getCell('A1')
  titulo.value = cronograma.nome
  titulo.font = { size: 16, bold: true }
  titulo.alignment = { vertical: 'middle', horizontal: 'center' }

  resumo.addRow({ campo: 'Período', valor: `${cronograma.data_inicio} a ${cronograma.data_fim}` })
  resumo.addRow({ campo: 'Dias por semana', valor: cronograma.dias_estudo_semana })
  resumo.addRow({ campo: 'Horas por dia', valor: cronograma.horas_estudo_dia })
  resumo.addRow({ campo: 'Modalidade', valor: cronograma.modalidade_estudo })
  if (cronograma.velocidade_reproducao) {
    resumo.addRow({ campo: 'Velocidade de reprodução', valor: `${Number(cronograma.velocidade_reproducao).toFixed(2)}x` })
  }

  const porDisciplina = new Map<string, { nome: string; minutos: number }>()
  itens.forEach((it) => {
    const disc = it.aulas?.modulos?.frentes?.disciplinas
    const min = it.aulas?.tempo_estimado_minutos || 0
    if (disc && disc.id && disc.nome && min) {
      const agg = porDisciplina.get(disc.id) || { nome: disc.nome, minutos: 0 }
      agg.minutos += min
      porDisciplina.set(disc.id, agg)
    }
  })
  if (porDisciplina.size) {
    resumo.addRow({ campo: '', valor: '' })
    const header = resumo.addRow({ campo: 'Horas por disciplina', valor: '' })
    header.font = { bold: true }
    porDisciplina.forEach((v) => {
      resumo.addRow({ campo: v.nome, valor: formatTempo(v.minutos) })
    })
  }

  const folha = wb.addWorksheet('Cronograma')
  folha.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
  folha.columns = [
    { header: 'Data', key: 'data', width: 14 },
    { header: 'Semana', key: 'semana', width: 10 },
    { header: 'Disciplina', key: 'disciplina', width: 26 },
    { header: 'Frente', key: 'frente', width: 26 },
    { header: 'Nº Módulo', key: 'numero_modulo', width: 12 },
    { header: 'Módulo', key: 'modulo', width: 18 },
    { header: 'Nº Aula', key: 'numero_aula', width: 10 },
    { header: 'Aula', key: 'aula', width: 40 },
    { header: 'Tempo Est.', key: 'tempo', width: 12 },
    { header: 'Concluída', key: 'concluida', width: 12 },
    { header: 'Conclusão', key: 'conclusao', width: 14 },
  ]

  folha.getRow(1).font = { bold: true }
  folha.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

  itens.forEach((it) => {
    const d = it.data_prevista || ''
    const disc = it.aulas?.modulos?.frentes?.disciplinas
    const frente = it.aulas?.modulos?.frentes
    const modulo = it.aulas?.modulos
    const aula = it.aulas
    const isQuestoes = it.tipo === 'questoes_revisao'
    const frenteNome = frente?.nome || it.frente_nome_snapshot || ''
    const row = folha.addRow({
      data: d,
      semana: it.semana_numero,
      disciplina: isQuestoes ? 'Questões e revisão' : (disc?.nome || ''),
      frente: frenteNome,
      numero_modulo: modulo?.numero_modulo ?? '',
      modulo: isQuestoes ? 'Questões e revisão' : (modulo?.nome || ''),
      numero_aula: aula?.numero_aula ?? '',
      aula: isQuestoes ? (it.mensagem || 'Tempo para questões e revisão') : (aula?.nome || ''),
      tempo: formatTempo(isQuestoes ? (it.duracao_sugerida_minutos || null) : (aula?.tempo_estimado_minutos || null)),
      concluida: it.concluido ? 'Sim' : 'Não',
      conclusao: it.data_conclusao || '',
    })
    const fillColor = corSemanaFrente(it.semana_numero, frenteNome)
    row.eachCell((cell, colNumber) => {
      if (colNumber >= 1 && colNumber <= 11) {
        cell.border = {
          top: { style: 'thin', color: { argb: 'DDDDDD' } },
          left: { style: 'thin', color: { argb: 'EEEEEE' } },
          bottom: { style: 'thin', color: { argb: 'DDDDDD' } },
          right: { style: 'thin', color: { argb: 'EEEEEE' } },
        }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillColor } }
      }
    })
  })

  return wb
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function getHandler(
  request: AuthenticatedRequest,
  params: { id: string },
) {
  if (!request.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cronogramaId = String(params.id)
  if (!cronogramaId) return NextResponse.json({ error: 'cronograma_id é obrigatório' }, { status: 400 })

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const client = getDatabaseClientAsUser(token)
  const { data: owner } = await client
    .from('cronogramas')
    .select('usuario_id')
    .eq('id', cronogramaId)
    .single()
  
  // Type assertion: Query result properly typed (cronogramas table exists in schema)
  const typedOwner = owner as { usuario_id: string } | null;
  
  if (!typedOwner || typedOwner.usuario_id !== request.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { cronograma, itens } = await fetchCronogramaCompleto(cronogramaId, client)
  type CronogramaCompleto = {
    nome?: string | null
    data_inicio: string
    data_fim: string
    dias_estudo_semana?: number
    horas_estudo_dia?: number
    modalidade_estudo?: string
    [key: string]: unknown
  }
  const cronogramaTyped = cronograma as CronogramaCompleto
  
  // After migration, nome is guaranteed to be non-null
  const cronogramaExport: CronogramaExport = {
    ...cronograma,
    nome: cronograma.nome as string,
    dias_estudo_semana: cronogramaTyped.dias_estudo_semana || 5,
    horas_estudo_dia: cronogramaTyped.horas_estudo_dia || 2,
    modalidade_estudo: cronogramaTyped.modalidade_estudo || 'hibrido',
  }
  
  // Reordenar itens para agrupar por frente dentro de cada semana (A, B, C)
  const itensOrdenados = sortByFrenteWithinWeek(itens)
  const wb = await buildWorkbook(cronogramaExport, itensOrdenados)
  const buffer = await wb.xlsx.writeBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="cronograma_${cronogramaId}.xlsx"`,
    },
  })
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => getHandler(req, params))(request);
}
