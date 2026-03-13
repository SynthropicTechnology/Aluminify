/**
 * Composicoes de pagina para o PDF do cronograma.
 * CoverPage, WeekPage, SummaryPage.
 */

import React from 'react'
import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { PDF_COLORS, PDF_FONTS, PDF_SPACING } from './pdf-theme'
import type { CronogramaExport } from './pdf-types'
import { formatTempo, formatDateBR } from './pdf-types'
import {
  ProgressBar,
  LogoBlock,
  CompactInfoGrid,
  DisciplinePill,
  StatCard,
  PdfFooter,
  MiniHeader,
  DayHeader,
  DisciplinaHeader,
  FrenteLabel,
  ModuloHeader,
  AulaRow,
  WeekTimeBar,
  MotivationalMessage,
  Watermark,
} from './pdf-components'
import type { OverallStats, WeekGroup } from './pdf-data'
import { buildInfoGridItems, getWeekDisciplineTime } from './pdf-data'

// ---------------------------------------------------------------------------
// Estilos compartilhados entre paginas
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  page: {
    paddingTop: PDF_SPACING.pagePaddingTop,
    paddingBottom: PDF_SPACING.pagePaddingBottom,
    paddingHorizontal: PDF_SPACING.pagePaddingHorizontal,
    fontFamily: PDF_FONTS.body,
    fontSize: PDF_FONTS.bodySize,
    color: PDF_COLORS.textMain,
  },
  row: { flexDirection: 'row' },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
  mb4: { marginBottom: 4 },
  flex1: { flex: 1 },
})

// Coluna de tempo na tabela de aulas
const COL_TEMPO = 70

// ---------------------------------------------------------------------------
// CoverPage - pagina de capa com logo, progresso, pills, info
// ---------------------------------------------------------------------------

export function CoverPage({
  cronograma,
  stats,
  logoUrl,
}: {
  cronograma: CronogramaExport
  stats: OverallStats
  logoUrl: string | null
}) {
  const periodo = `${formatDateBR(cronograma.data_inicio)} — ${formatDateBR(cronograma.data_fim)}`
  const geradoEm = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date())

  const infoItems = buildInfoGridItems(cronograma)

  return (
    <Page size="A4" style={s.page}>
      <Watermark logoUrl={logoUrl} />
      {/* Header: Logo + marca */}
      <View style={[s.row, { justifyContent: 'space-between', alignItems: 'flex-start' }]}>
        <LogoBlock logoUrl={logoUrl} />
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.footerSize,
            color: PDF_COLORS.textLight,
          }}
        >
          Gerado em {geradoEm}
        </Text>
      </View>

      {/* Nome do Aluno */}
      {cronograma.aluno_nome && (
        <View style={{ marginTop: 16 }}>
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.bodySize,
              color: PDF_COLORS.textLight,
              marginBottom: 2,
            }}
          >
            Aluno
          </Text>
          <Text
            style={{
              fontFamily: PDF_FONTS.display,
              fontSize: PDF_FONTS.sectionTitleSize,
              fontWeight: 600,
              color: PDF_COLORS.textMain,
            }}
          >
            {cronograma.aluno_nome}
          </Text>
        </View>
      )}

      {/* Titulo */}
      <View style={s.mt12}>
        <Text
          style={{
            fontFamily: PDF_FONTS.display,
            fontSize: PDF_FONTS.titleSize,
            fontWeight: 700,
            color: PDF_COLORS.primary,
          }}
        >
          {cronograma.nome}
        </Text>
        <View style={[s.row, s.gap8, s.mt4]}>
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.frenteSize,
              color: PDF_COLORS.textSecondary,
            }}
          >
            <Text style={{ fontWeight: 600 }}>Curso:</Text>{' '}
            {cronograma.curso_nome || 'Não informado'}
          </Text>
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.frenteSize,
              color: PDF_COLORS.textMuted,
            }}
          >
            |
          </Text>
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.frenteSize,
              color: PDF_COLORS.textSecondary,
            }}
          >
            <Text style={{ fontWeight: 600 }}>Período:</Text> {periodo}
          </Text>
        </View>
      </View>

      {/* Progresso geral + stats */}
      <View style={[s.row, s.gap8, s.mt12]}>
        {/* Card de progresso */}
        <View
          style={{
            flex: 1,
            backgroundColor: PDF_COLORS.surface,
            borderWidth: 1,
            borderColor: PDF_COLORS.border,
            borderRadius: PDF_SPACING.cardRadius,
            padding: 12,
          }}
        >
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.labelSize,
              fontWeight: 600,
              color: PDF_COLORS.textMuted,
              marginBottom: 6,
            }}
          >
            Progresso Geral
          </Text>
          <ProgressBar
            value={stats.percent}
            height={PDF_SPACING.progressBarHeightLarge}
            showLabel
            fillColor={
              stats.percent >= 75
                ? PDF_COLORS.success
                : stats.percent >= 40
                  ? PDF_COLORS.info
                  : PDF_COLORS.warning
            }
          />
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.labelSize,
              color: PDF_COLORS.textMuted,
              marginTop: 4,
            }}
          >
            {stats.completedItems} de {stats.totalItems} aulas concluídas
          </Text>
        </View>

        {/* Stats resumidas */}
        <View style={[{ flex: 1 }, s.gap8]}>
          <View style={[s.row, s.gap8]}>
            <StatCard
              label="Aulas"
              value={String(stats.totalItems)}
              sublabel="total"
            />
            <StatCard
              label="Tempo"
              value={formatTempo(stats.totalMinutes)}
              sublabel="aula + estudo"
            />
          </View>
          <View style={[s.row, s.gap8]}>
            <StatCard
              label="Semanas"
              value={String(stats.totalWeeks)}
            />
            <StatCard
              label="Concluídas"
              value={String(stats.completedItems)}
              sublabel="aulas"
            />
          </View>
        </View>
      </View>

      {/* Disciplinas pills */}
      {stats.disciplineStats.length > 0 && (
        <View style={s.mt12}>
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.labelSize,
              fontWeight: 600,
              color: PDF_COLORS.textMuted,
              marginBottom: 6,
            }}
          >
            Disciplinas
          </Text>
          <View style={[s.row, { flexWrap: 'wrap', gap: 6 }]}>
            {stats.disciplineStats.map((ds) => (
              <DisciplinePill
                key={ds.disciplinaId}
                nome={ds.disciplinaNome}
                percent={ds.percent}
                color={ds.color}
              />
            ))}
          </View>
        </View>
      )}

      {/* Info grid compacta */}
      <View style={s.mt12}>
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.labelSize,
            fontWeight: 600,
            color: PDF_COLORS.textMuted,
            marginBottom: 6,
          }}
        >
          Informações do cronograma
        </Text>
        <CompactInfoGrid items={infoItems} />
      </View>

      {/* Disciplinas lista (se houver nomes extras) */}
      {cronograma.disciplinas_nomes && cronograma.disciplinas_nomes.length > 0 && (
        <View style={s.mt8}>
          <Text
            style={{
              fontFamily: PDF_FONTS.body,
              fontSize: PDF_FONTS.labelSize,
              color: PDF_COLORS.textMuted,
            }}
          >
            <Text style={{ fontWeight: 600 }}>Disciplinas selecionadas: </Text>
            {cronograma.disciplinas_nomes.join(', ')}
          </Text>
        </View>
      )}

      <PdfFooter cronogramaNome={cronograma.nome} alunoNome={cronograma.aluno_nome} cursoNome={cronograma.curso_nome} />
    </Page>
  )
}

// ---------------------------------------------------------------------------
// WeekPage - pagina de uma semana com agrupamento diario
// ---------------------------------------------------------------------------

export function WeekPage({
  week,
  cronogramaNome,
  alunoNome,
  cursoNome,
  colorMap,
  velocidade,
  logoUrl,
}: {
  week: WeekGroup
  cronogramaNome: string
  alunoNome?: string
  cursoNome?: string
  colorMap: Map<string, import('./pdf-theme').DisciplineColor>
  velocidade: number
  logoUrl?: string | null
}) {
  const timeData = getWeekDisciplineTime(week.itens, colorMap, velocidade)

  return (
    <Page size="A4" style={s.page} wrap>
      <Watermark logoUrl={logoUrl ?? null} />
      <MiniHeader
        cronogramaNome={cronogramaNome}
        rightText={`Semana ${week.semanaNumero}`}
      />

      {/* Titulo da semana + progresso */}
      <View
        style={{
          backgroundColor: PDF_COLORS.background,
          borderWidth: 1,
          borderColor: PDF_COLORS.border,
          borderRadius: PDF_SPACING.cardRadius,
          padding: PDF_SPACING.cardPadding,
        }}
      >
        <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
          <View>
            <Text
              style={{
                fontFamily: PDF_FONTS.display,
                fontSize: PDF_FONTS.weekTitleSize,
                fontWeight: 700,
                color: PDF_COLORS.primary,
              }}
            >
              Semana {week.semanaNumero}
            </Text>
            {week.dateRange && (
              <Text
                style={{
                  fontFamily: PDF_FONTS.body,
                  fontSize: PDF_FONTS.labelSize,
                  color: PDF_COLORS.textMuted,
                  marginTop: 2,
                }}
              >
                {week.dateRange}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                fontFamily: PDF_FONTS.body,
                fontSize: PDF_FONTS.progressSize,
                fontWeight: 600,
                color: PDF_COLORS.textSecondary,
              }}
            >
              {week.stats.completed}/{week.stats.total} aulas
            </Text>
            <Text
              style={{
                fontFamily: PDF_FONTS.body,
                fontSize: PDF_FONTS.timeSize,
                color: PDF_COLORS.textMuted,
              }}
            >
              {formatTempo(week.stats.totalMinutes)} total
            </Text>
          </View>
        </View>
        <View style={s.mt4}>
          <ProgressBar
            value={week.stats.percent}
            height={6}
            fillColor={
              week.stats.percent >= 100
                ? PDF_COLORS.success
                : week.stats.percent > 0
                  ? PDF_COLORS.info
                  : PDF_COLORS.border
            }
          />
        </View>
      </View>

      {/* Barra de distribuição de tempo (logo após o header da semana) */}
      {timeData.length > 1 && (
        <View
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTopWidth: 1,
            borderTopColor: PDF_COLORS.border,
          }}
        >
          <WeekTimeBar disciplines={timeData} />
        </View>
      )}

      {/* Dias da semana */}
      {week.days.map((day) => (
        <View key={day.date}>
          {/* Separador de dia - so mostra se tiver data */}
          {day.dayName && day.dayName !== 'Sem data' && (
            <DayHeader dayName={day.dayName} date={day.dateFormatted} />
          )}

          {/* Disciplinas do dia */}
          {day.disciplinas.map((disc) => (
            <View key={`${day.date}-${disc.disciplinaId}`} wrap={false}>
              <DisciplinaHeader nome={disc.disciplinaNome} color={disc.color} />

              {disc.frentes.map((frente) => (
                <View key={`${day.date}-${disc.disciplinaId}-${frente.frenteId}`}>
                  <FrenteLabel nome={frente.frenteNome} />

                  {frente.modulos.map((modulo) => {
                    const moduloCompleted = modulo.itens.filter((it) => it.concluido).length
                    return (
                      <View
                        key={`${day.date}-${disc.disciplinaId}-${frente.frenteId}-${modulo.moduloId}`}
                        style={{
                          marginLeft: 4,
                          marginTop: 4,
                          borderWidth: 1,
                          borderColor: PDF_COLORS.border,
                          borderRadius: PDF_SPACING.smallRadius,
                          overflow: 'hidden',
                        }}
                        wrap={false}
                      >
                        <ModuloHeader
                          label={modulo.moduloLabel}
                          completed={moduloCompleted}
                          total={modulo.itens.length}
                        />

                        {/* Aulas */}
                        {modulo.itens.map((it, idx) => {
                          const tempoAdj =
                            it.tipo === 'questoes_revisao'
                              ? (it.duracao_sugerida_minutos || 0)
                              : ((it.aulas?.tempo_estimado_minutos || 0) > 0
                                ? (it.aulas!.tempo_estimado_minutos! / velocidade)
                                : 0)
                          return (
                            <AulaRow
                              key={it.id}
                              nome={it.tipo === 'questoes_revisao'
                                ? (it.mensagem || 'Tempo para questões e revisão')
                                : (it.aulas?.nome || 'Sem nome')}
                              tempo={tempoAdj}
                              checked={it.tipo === 'aula' ? it.concluido : false}
                              showCheckbox={it.tipo === 'aula'}
                              isAlt={idx % 2 === 1}
                              colTempo={COL_TEMPO}
                              _colCheck={0}
                            />
                          )
                        })}
                      </View>
                    )
                  })}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}

      <PdfFooter cronogramaNome={cronogramaNome} alunoNome={alunoNome} cursoNome={cursoNome} />
    </Page>
  )
}

// ---------------------------------------------------------------------------
// SummaryPage - pagina final com tabela de disciplinas e motivacao
// ---------------------------------------------------------------------------

export function SummaryPage({
  cronogramaNome,
  alunoNome,
  cursoNome,
  stats,
  logoUrl,
}: {
  cronogramaNome: string
  alunoNome?: string
  cursoNome?: string
  stats: OverallStats
  logoUrl?: string | null
}) {
  return (
    <Page size="A4" style={s.page}>
      <Watermark logoUrl={logoUrl ?? null} />
      <MiniHeader cronogramaNome={cronogramaNome} rightText="Resumo" />

      <Text
        style={{
          fontFamily: PDF_FONTS.display,
          fontSize: PDF_FONTS.weekTitleSize,
          fontWeight: 700,
          color: PDF_COLORS.primary,
          marginBottom: 12,
        }}
      >
        Resumo por Disciplina
      </Text>

      {/* Tabela de disciplinas */}
      <View
        style={{
          borderWidth: 1,
          borderColor: PDF_COLORS.border,
          borderRadius: PDF_SPACING.cardRadius,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <View
          style={[
            s.row,
            {
              backgroundColor: PDF_COLORS.surfaceAlt,
              paddingVertical: 6,
              paddingHorizontal: 8,
              borderBottomWidth: 1,
              borderColor: PDF_COLORS.border,
            },
          ]}
        >
          <Text style={[s.flex1, { fontWeight: 600, fontSize: PDF_FONTS.tableHeaderSize, color: PDF_COLORS.textSecondary }]}>
            Disciplina
          </Text>
          <Text style={{ width: 50, fontWeight: 600, fontSize: PDF_FONTS.tableHeaderSize, color: PDF_COLORS.textSecondary, textAlign: 'center' }}>
            Aulas
          </Text>
          <Text style={{ width: 60, fontWeight: 600, fontSize: PDF_FONTS.tableHeaderSize, color: PDF_COLORS.textSecondary, textAlign: 'center' }}>
            Concluídas
          </Text>
          <Text style={{ width: 55, fontWeight: 600, fontSize: PDF_FONTS.tableHeaderSize, color: PDF_COLORS.textSecondary, textAlign: 'center' }}>
            Tempo
          </Text>
          <Text style={{ width: 100, fontWeight: 600, fontSize: PDF_FONTS.tableHeaderSize, color: PDF_COLORS.textSecondary, textAlign: 'center' }}>
            Progresso
          </Text>
        </View>

        {/* Rows */}
        {stats.disciplineStats.map((ds, idx) => (
          <View
            key={ds.disciplinaId}
            style={[
              s.row,
              {
                backgroundColor: idx % 2 === 0 ? PDF_COLORS.surface : PDF_COLORS.background,
                paddingVertical: 6,
                paddingHorizontal: 8,
                borderBottomWidth: idx < stats.disciplineStats.length - 1 ? 1 : 0,
                borderColor: PDF_COLORS.borderLight,
                alignItems: 'center',
              },
            ]}
          >
            <View style={[s.flex1, s.row, { gap: 4, alignItems: 'center' }]}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: ds.color.accent,
                }}
              />
              <Text
                style={{
                  fontSize: PDF_FONTS.bodySize,
                  fontWeight: 500,
                  color: PDF_COLORS.textMain,
                }}
              >
                {ds.disciplinaNome}
              </Text>
            </View>
            <Text style={{ width: 50, fontSize: PDF_FONTS.bodySize, color: PDF_COLORS.textSecondary, textAlign: 'center' }}>
              {ds.total}
            </Text>
            <Text style={{ width: 60, fontSize: PDF_FONTS.bodySize, color: PDF_COLORS.textSecondary, textAlign: 'center' }}>
              {ds.completed}
            </Text>
            <Text style={{ width: 55, fontSize: PDF_FONTS.timeSize, color: PDF_COLORS.textMuted, textAlign: 'center' }}>
              {formatTempo(ds.totalMinutes)}
            </Text>
            <View style={{ width: 100 }}>
              <ProgressBar
                value={ds.percent}
                height={6}
                showLabel
                fillColor={ds.color.accent}
              />
            </View>
          </View>
        ))}
      </View>

      {/* Progresso geral final */}
      <View style={s.mt12}>
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.labelSize,
            fontWeight: 600,
            color: PDF_COLORS.textMuted,
            marginBottom: 6,
          }}
        >
          Progresso Geral
        </Text>
        <ProgressBar
          value={stats.percent}
          height={PDF_SPACING.progressBarHeightLarge}
          showLabel
          fillColor={
            stats.percent >= 75
              ? PDF_COLORS.success
              : stats.percent >= 40
                ? PDF_COLORS.info
                : PDF_COLORS.warning
          }
        />
        <View style={[s.row, s.gap8, s.mt4]}>
          <Text style={{ fontSize: PDF_FONTS.labelSize, color: PDF_COLORS.textMuted }}>
            {stats.completedItems} de {stats.totalItems} aulas concluídas
          </Text>
          <Text style={{ fontSize: PDF_FONTS.labelSize, color: PDF_COLORS.textMuted }}>
            |
          </Text>
          <Text style={{ fontSize: PDF_FONTS.labelSize, color: PDF_COLORS.textMuted }}>
            Tempo total: {formatTempo(stats.totalMinutes)}
          </Text>
        </View>
      </View>

      {/* Mensagem motivacional */}
      <MotivationalMessage percent={stats.percent} />

      <PdfFooter cronogramaNome={cronogramaNome} alunoNome={alunoNome} cursoNome={cursoNome} />
    </Page>
  )
}
