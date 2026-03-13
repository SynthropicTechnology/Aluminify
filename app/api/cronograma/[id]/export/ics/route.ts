import { NextRequest, NextResponse } from 'next/server'
import { requireUserAuth, type AuthenticatedRequest } from '@/app/[tenant]/auth/middleware'
import { getDatabaseClientAsUser } from '@/app/shared/core/database/database'
import { fetchCronogramaCompleto } from '@/app/[tenant]/(modules)/cronograma/lib/cronograma-export-utils'
import ical from 'ical-generator'

export const runtime = 'nodejs'

/**
 * Converte string "YYYY-MM-DD" em Date à meia-noite LOCAL.
 * `new Date("2026-02-12")` cria UTC midnight → no Brasil (UTC-3) vira dia anterior.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

interface CronogramaExport {
  nome: string;
  data_inicio: string;
  data_fim: string;
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

function formatTempo(minutos?: number | null): string {
  if (!minutos || minutos <= 0) return '--'
  const h = Math.floor(minutos / 60)
  const m = Math.round(minutos % 60)
  if (h > 0 && m > 0) return `${h}h ${m} min`
  if (h > 0) return `${h}h`
  return `${m} min`
}

function buildIcs(cronograma: CronogramaExport, itens: ItemExport[]): string {
  const calendar = ical({
    prodId: {
      company: 'Aluminify',
      product: 'Cronograma de Estudos',
      language: 'PT',
    },
    name: cronograma.nome,
    timezone: 'America/Sao_Paulo',
    description: `Cronograma de estudos de ${cronograma.data_inicio} a ${cronograma.data_fim}`,
  })

  // Horário padrão para início dos eventos (08:00)
  const HORA_PADRAO = 8
  const MINUTO_PADRAO = 0

  // Processar cada item do cronograma
  itens.forEach((item) => {
    // Pular itens sem data_prevista
    if (!item.data_prevista) {
      return
    }

    try {
      // Parsear data_prevista (formato YYYY-MM-DD) como data local
      const dataPrevista = parseLocalDate(item.data_prevista)
      if (isNaN(dataPrevista.getTime())) {
        console.warn(`Data inválida para item ${item.id}: ${item.data_prevista}`)
        return
      }

      // Definir data/hora de início
      const startDate = new Date(dataPrevista)
      startDate.setHours(HORA_PADRAO, MINUTO_PADRAO, 0, 0)

      // Calcular duração (usar tempo_estimado_minutos ou padrão de 60 minutos)
      const duracaoMinutos = item.tipo === 'questoes_revisao'
        ? (item.duracao_sugerida_minutos || 60)
        : (item.aulas?.tempo_estimado_minutos || 60)
      const endDate = new Date(startDate.getTime() + duracaoMinutos * 60 * 1000)

      // Montar informações do evento
      const disciplina = item.tipo === 'questoes_revisao'
        ? 'Questões e revisão'
        : (item.aulas?.modulos?.frentes?.disciplinas?.nome || 'Aula')
      const frente = item.aulas?.modulos?.frentes?.nome || item.frente_nome_snapshot || ''
      const modulo = item.aulas?.modulos?.nome || ''
      const aula = item.tipo === 'questoes_revisao'
        ? (item.mensagem || 'Tempo para questões e revisão')
        : (item.aulas?.nome || 'Sem nome')

      // Título do evento
      const summary = `${disciplina}${frente ? ` - ${frente}` : ''}${aula ? ` - ${aula}` : ''}`

      // Descrição detalhada
      const descricaoLinhas: string[] = []
      if (disciplina) descricaoLinhas.push(`Disciplina: ${disciplina}`)
      if (frente) descricaoLinhas.push(`Frente: ${frente}`)
      if (modulo) descricaoLinhas.push(`Módulo: ${modulo}`)
      if (aula) descricaoLinhas.push(`Aula: ${aula}`)
      if (duracaoMinutos) descricaoLinhas.push(`Tempo estimado: ${formatTempo(duracaoMinutos)}`)
      descricaoLinhas.push(`Status: ${item.concluido ? 'Concluída' : 'Pendente'}`)
      if (item.data_conclusao) {
        descricaoLinhas.push(`Data de conclusão: ${new Date(item.data_conclusao).toLocaleDateString('pt-BR')}`)
      }

      const description = descricaoLinhas.join('\\n')

      // Criar evento no calendário
      calendar.createEvent({
        start: startDate,
        end: endDate,
        summary: summary,
        description: description,
        categories: [{ name: 'Estudos' }],
        location: 'Aluminify',
      })
    } catch (error) {
      console.error(`Erro ao processar item ${item.id}:`, error)
      // Continuar processando outros itens mesmo se um falhar
    }
  })

  return calendar.toString()
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

  try {
    const { cronograma, itens } = await fetchCronogramaCompleto(cronogramaId, client)
    
    // After migration, nome is guaranteed to be non-null
    const cronogramaExport: CronogramaExport = {
      ...cronograma,
      nome: cronograma.nome as string,
    };
    
    const icsContent = buildIcs(cronogramaExport, itens)

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="cronograma_${cronogramaId}.ics"`,
      },
    })
  } catch (error) {
    console.error('Erro ao gerar arquivo ICS:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao gerar arquivo ICS' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return requireUserAuth((req) => getHandler(req, params))(request);
}


