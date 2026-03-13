import { CronogramaService } from '@/app/[tenant]/(modules)/cronograma/services/cronograma.service'

type AulaComCusto = {
  id: string
  disciplina_id: string
  disciplina_nome: string
  frente_id: string
  frente_nome: string
  modulo_id: string
  modulo_nome: string
  numero_modulo: number | null
  numero_aula: number | null
  nome: string
  tempo_estimado_minutos: number | null
  prioridade: number | null
  custo: number
}

type SemanaInfo = {
  numero: number
  data_inicio: Date
  data_fim: Date
  is_ferias: boolean
  capacidade_minutos: number
}

function mkSemana(numero: number, capacidade_minutos = 1000): SemanaInfo {
  const base = new Date('2026-01-01T00:00:00.000Z')
  const start = new Date(base)
  start.setUTCDate(start.getUTCDate() + (numero - 1) * 7)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  return {
    numero,
    data_inicio: start,
    data_fim: end,
    is_ferias: false,
    capacidade_minutos,
  }
}

function mkAula(
  id: string,
  disciplina: { id: string; nome: string },
  frente: { id: string; nome: string },
  custo: number,
): AulaComCusto {
  return {
    id,
    disciplina_id: disciplina.id,
    disciplina_nome: disciplina.nome,
    frente_id: frente.id,
    frente_nome: frente.nome,
    modulo_id: 'm',
    modulo_nome: 'M',
    numero_modulo: 1,
    numero_aula: 1,
    nome: `Aula ${id}`,
    tempo_estimado_minutos: 30,
    prioridade: 2,
    custo,
  }
}

describe('CronogramaService - distribuição (novas invariantes)', () => {
  test('paralelo: toda semana útil tem pelo menos 1 item por frente', () => {
    const service = new CronogramaService()
    const semanas = [mkSemana(1), mkSemana(2), mkSemana(3), mkSemana(4)]

    const geo = { id: 'd_geo', nome: 'Geografia' }
    const hist = { id: 'd_hist', nome: 'História' }
    const soc = { id: 'd_soc', nome: 'Sociologia' }
    const fil = { id: 'd_fil', nome: 'Filosofia' }

    const frentes = {
      geoA: { id: 'f_geoA', nome: 'Geo A' },
      geoB: { id: 'f_geoB', nome: 'Geo B' },
      geoC: { id: 'f_geoC', nome: 'Geo C' },
      geoD: { id: 'f_geoD', nome: 'Geo D' },
      histA: { id: 'f_histA', nome: 'Hist A' },
      histB: { id: 'f_histB', nome: 'Hist B' },
      histC: { id: 'f_histC', nome: 'Hist C' },
      socA: { id: 'f_socA', nome: 'Soc' },
      filA: { id: 'f_filA', nome: 'Fil' },
    }

    // Cada frente tem 2 aulas (custo pequeno para sempre caber)
    const aulas: AulaComCusto[] = [
      mkAula('1', geo, frentes.geoA, 20),
      mkAula('2', geo, frentes.geoA, 20),
      mkAula('3', geo, frentes.geoB, 15),
      mkAula('4', geo, frentes.geoB, 15),
      mkAula('5', geo, frentes.geoC, 15),
      mkAula('6', geo, frentes.geoC, 15),
      mkAula('7', geo, frentes.geoD, 15),
      mkAula('8', geo, frentes.geoD, 15),
      mkAula('9', hist, frentes.histA, 20),
      mkAula('10', hist, frentes.histA, 20),
      mkAula('11', hist, frentes.histB, 20),
      mkAula('12', hist, frentes.histB, 20),
      mkAula('13', hist, frentes.histC, 20),
      mkAula('14', hist, frentes.histC, 20),
      mkAula('15', soc, frentes.socA, 10),
      mkAula('16', soc, frentes.socA, 10),
      mkAula('17', fil, frentes.filA, 10),
      mkAula('18', fil, frentes.filA, 10),
    ]

    const itens = (service as unknown as any).distribuirAulas(aulas, semanas, 'paralelo')
    const requiredFrentes = new Set(aulas.map((a) => a.frente_id))
    const frentePorAulaId = new Map(aulas.map((a) => [a.id, a.frente_id]))

    for (const s of semanas) {
      const itensSemana = itens.filter((i: any) => i.semana_numero === s.numero)
      const frentesSemana = new Set(
        itensSemana.map((i: any) => {
          if (i.tipo === 'questoes_revisao') return i.frente_id
          return frentePorAulaId.get(i.aula_id) || null
        }).filter(Boolean),
      )
      requiredFrentes.forEach((frenteId) => {
        expect(frentesSemana.has(frenteId)).toBe(true)
      })
    }
  })

  test('paralelo: não repete aula e cria questões/revisão quando frente encerra', () => {
    const service = new CronogramaService()
    const semanas = [mkSemana(1), mkSemana(2), mkSemana(3), mkSemana(4)]

    const hist = { id: 'd_hist', nome: 'História' }
    const frenteA = { id: 'f_histA', nome: 'Hist A' }
    const frenteB = { id: 'f_histB', nome: 'Hist B' }

    const aulas: AulaComCusto[] = [
      mkAula('1', hist, frenteA, 20),
      mkAula('2', hist, frenteA, 20),
      mkAula('3', hist, frenteB, 20),
      mkAula('4', hist, frenteB, 20),
    ]

    const itens = (service as unknown as any).distribuirAulas(aulas, semanas, 'paralelo')
    const itensAula = itens.filter((i: any) => i.tipo === 'aula')
    const itensQuestoes = itens.filter((i: any) => i.tipo === 'questoes_revisao')

    const aulaIds = itensAula.map((i: any) => i.aula_id)
    expect(new Set(aulaIds).size).toBe(aulaIds.length)

    expect(itensQuestoes.length).toBeGreaterThan(0)
    itensQuestoes.forEach((i: any) => {
      expect(i.aula_id).toBeNull()
      expect(i.frente_id).toBeTruthy()
      expect(i.duracao_sugerida_minutos).toBeGreaterThan(0)
      expect(typeof i.mensagem).toBe('string')
      expect(i.mensagem.length).toBeGreaterThan(0)
    })
  })

  test('sequencial: toda semana útil tem 1 item por disciplina e no máximo 1 frente por disciplina', () => {
    const service = new CronogramaService()
    const semanas = [mkSemana(1), mkSemana(2), mkSemana(3), mkSemana(4)]

    const geo = { id: 'd_geo', nome: 'Geografia' }
    const hist = { id: 'd_hist', nome: 'História' }
    const soc = { id: 'd_soc', nome: 'Sociologia' }
    const fil = { id: 'd_fil', nome: 'Filosofia' }

    // Geo tem 2 frentes; Hist 2; Soc 1; Fil 1
    const frentes = {
      geoA: { id: 'f_geoA', nome: 'Geo A' },
      geoB: { id: 'f_geoB', nome: 'Geo B' },
      histA: { id: 'f_histA', nome: 'Hist A' },
      histB: { id: 'f_histB', nome: 'Hist B' },
      socA: { id: 'f_socA', nome: 'Soc' },
      filA: { id: 'f_filA', nome: 'Fil' },
    }

    const aulas: AulaComCusto[] = [
      mkAula('1', geo, frentes.geoA, 30),
      mkAula('2', geo, frentes.geoA, 30),
      mkAula('3', geo, frentes.geoB, 30),
      mkAula('4', geo, frentes.geoB, 30),
      mkAula('5', hist, frentes.histA, 30),
      mkAula('6', hist, frentes.histA, 30),
      mkAula('7', hist, frentes.histB, 30),
      mkAula('8', hist, frentes.histB, 30),
      mkAula('9', soc, frentes.socA, 20),
      mkAula('10', soc, frentes.socA, 20),
      mkAula('11', fil, frentes.filA, 20),
      mkAula('12', fil, frentes.filA, 20),
    ]

    const itens = (service as unknown as any).distribuirAulas(aulas, semanas, 'sequencial')
    const requiredDisciplinas = new Set(aulas.map((a) => a.disciplina_id))

    for (const s of semanas) {
      const itensSemana = itens.filter((i: any) => i.semana_numero === s.numero)

      const porDisciplina = new Map<string, Set<string>>() // disciplina_id -> set(frente_id)
      itensSemana.forEach((i: any) => {
        const aula = aulas.find((a) => a.id === i.aula_id)!
        if (!porDisciplina.has(aula.disciplina_id)) {
          porDisciplina.set(aula.disciplina_id, new Set())
        }
        porDisciplina.get(aula.disciplina_id)!.add(aula.frente_id)
      })

      // 1 item por disciplina (pelo menos)
      requiredDisciplinas.forEach((discId) => {
        expect(porDisciplina.has(discId)).toBe(true)
      })

      // no máximo 1 frente por disciplina na semana
      porDisciplina.forEach((frentesSet) => {
        expect(frentesSet.size).toBeLessThanOrEqual(1)
      })
    }
  })
})

