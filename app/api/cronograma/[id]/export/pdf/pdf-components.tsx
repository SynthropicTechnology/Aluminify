/**
 * Componentes visuais reutilizaveis para o PDF do cronograma.
 * Todos construidos com @react-pdf/renderer (View, Text, Image).
 */

import React from 'react'
import { View, Text, Image } from '@react-pdf/renderer'
import { PDF_COLORS, PDF_FONTS, PDF_SPACING, type DisciplineColor } from './pdf-theme'
import { formatTempo, truncateText } from './pdf-types'

// ---------------------------------------------------------------------------
// ProgressBar - barra de progresso nativa em PDF
// ---------------------------------------------------------------------------

export function ProgressBar({
  value,
  height = PDF_SPACING.progressBarHeight,
  bgColor = PDF_COLORS.border,
  fillColor = PDF_COLORS.success,
  radius = 4,
  showLabel = false,
}: {
  value: number
  height?: number
  bgColor?: string
  fillColor?: string
  radius?: number
  showLabel?: boolean
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View
        style={{
          flex: 1,
          height,
          backgroundColor: bgColor,
          borderRadius: radius,
          overflow: 'hidden',
        }}
      >
        {clamped > 0 && (
          <View
            style={{
              width: `${clamped}%`,
              height: '100%',
              backgroundColor: fillColor,
              borderRadius: radius,
            }}
          />
        )}
      </View>
      {showLabel && (
        <Text
          style={{
            fontSize: PDF_FONTS.progressSize,
            fontFamily: PDF_FONTS.body,
            fontWeight: 600,
            color: PDF_COLORS.textSecondary,
            width: 32,
            textAlign: 'right',
          }}
        >
          {Math.round(clamped)}%
        </Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// CheckboxNew - checkbox maior (16x16) com feedback visual
// ---------------------------------------------------------------------------

export function CheckboxNew({ checked }: { checked: boolean }) {
  const size = PDF_SPACING.checkboxSize
  return (
    <View
      style={{
        width: size,
        height: size,
        borderWidth: 1.5,
        borderColor: checked ? PDF_COLORS.success : '#D1D5DB',
        borderRadius: 3,
        backgroundColor: checked ? PDF_COLORS.successLight : PDF_COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked && (
        <Text
          style={{
            fontSize: 11,
            color: PDF_COLORS.successDark,
            fontWeight: 700,
            lineHeight: 1,
          }}
        >
          ✓
        </Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// DisciplinaHeader - header colorido com borda accent lateral
// ---------------------------------------------------------------------------

export function DisciplinaHeader({
  nome,
  color,
}: {
  nome: string
  color: DisciplineColor
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: color.bg,
        borderLeftWidth: PDF_SPACING.accentBorderWidth,
        borderLeftColor: color.accent,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: PDF_SPACING.smallRadius,
        marginTop: 10,
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONTS.display,
          fontSize: PDF_FONTS.disciplineSize,
          fontWeight: 700,
          color: color.text,
        }}
      >
        {truncateText(nome, 60)}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// FrenteLabel - subtitulo da frente com seta visual
// ---------------------------------------------------------------------------

export function FrenteLabel({ nome }: { nome: string }) {
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 10,
        marginTop: 6,
        marginLeft: 4,
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.frenteSize,
          fontWeight: 600,
          color: PDF_COLORS.textSecondary,
        }}
      >
        {truncateText(nome, 55)}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// ModuloHeader - header do modulo com contagem opcional
// ---------------------------------------------------------------------------

export function ModuloHeader({
  label,
  completed,
  total,
}: {
  label: string
  completed?: number
  total?: number
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: PDF_COLORS.surfaceAlt,
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderBottomWidth: 1,
        borderColor: PDF_COLORS.border,
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.moduleSize,
          fontWeight: 600,
          color: PDF_COLORS.textMain,
        }}
      >
        {truncateText(label, 70)}
      </Text>
      {total !== undefined && total > 0 && (
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.pillSize,
            fontWeight: 600,
            color: PDF_COLORS.textMuted,
          }}
        >
          {completed ?? 0}/{total}
        </Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// DayHeader - separador de dia com badge e data
// ---------------------------------------------------------------------------

export function DayHeader({ dayName, date }: { dayName: string; date: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        marginBottom: 4,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: PDF_COLORS.border,
      }}
    >
      <View
        style={{
          backgroundColor: PDF_COLORS.primary,
          borderRadius: 3,
          paddingVertical: 2,
          paddingHorizontal: 6,
        }}
      >
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.labelSize,
            fontWeight: 600,
            color: PDF_COLORS.surface,
          }}
        >
          {dayName}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.labelSize,
          color: PDF_COLORS.textMuted,
        }}
      >
        {date}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// AulaRow - linha de aula na tabela
// ---------------------------------------------------------------------------

export function AulaRow({
  nome,
  tempo,
  checked,
  showCheckbox,
  isAlt,
  colTempo,
  _colCheck,
}: {
  nome: string
  tempo: number
  checked: boolean
  showCheckbox?: boolean
  isAlt: boolean
  colTempo: number
  _colCheck: number
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: isAlt ? PDF_COLORS.background : PDF_COLORS.surface,
        borderBottomWidth: 1,
        borderColor: PDF_COLORS.borderLight,
        paddingVertical: 5,
      }}
    >
      <View style={{ paddingHorizontal: 8, flexGrow: 1, flexShrink: 1, flexBasis: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {showCheckbox !== false && <CheckboxNew checked={checked} />}
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.bodySize,
            color: checked ? PDF_COLORS.textMuted : PDF_COLORS.textMain,
            textDecoration: checked ? 'line-through' : 'none',
            flex: 1,
          }}
        >
          {truncateText(nome, 80)}
        </Text>
      </View>
      <Text
        style={{
          width: colTempo,
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.timeSize,
          fontWeight: 500,
          color: PDF_COLORS.textMuted,
          textAlign: 'center',
          paddingHorizontal: 4,
        }}
      >
        {formatTempo(tempo)}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// CompactInfoGrid - grid 2 colunas para metadata do cronograma
// ---------------------------------------------------------------------------

export function CompactInfoGrid({
  items,
}: {
  items: Array<{ label: string; value: string }>
}) {
  const mid = Math.ceil(items.length / 2)
  const col1 = items.slice(0, mid)
  const col2 = items.slice(mid)

  const renderCol = (col: typeof items) =>
    col.map((item, idx) => (
      <View
        key={idx}
        style={{
          flexDirection: 'row',
          paddingVertical: 3,
          borderBottomWidth: idx < col.length - 1 ? 1 : 0,
          borderBottomColor: PDF_COLORS.borderLight,
        }}
      >
        <Text
          style={{
            width: 90,
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.labelSize,
            color: PDF_COLORS.textMuted,
          }}
        >
          {item.label}
        </Text>
        <Text
          style={{
            flex: 1,
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.labelSize,
            fontWeight: 500,
            color: PDF_COLORS.textMain,
          }}
        >
          {item.value}
        </Text>
      </View>
    ))

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 16,
        backgroundColor: PDF_COLORS.background,
        borderWidth: 1,
        borderColor: PDF_COLORS.border,
        borderRadius: PDF_SPACING.cardRadius,
        padding: PDF_SPACING.cardPadding,
      }}
    >
      <View style={{ flex: 1 }}>{renderCol(col1)}</View>
      <View style={{ flex: 1 }}>{renderCol(col2)}</View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// DisciplinePill - badge arredondado com cor e progresso
// ---------------------------------------------------------------------------

export function DisciplinePill({
  nome,
  percent,
  color,
}: {
  nome: string
  percent: number
  color: DisciplineColor
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: color.bg,
        borderRadius: 10,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: color.accent,
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.pillSize,
          fontWeight: 600,
          color: color.text,
        }}
      >
        {truncateText(nome, 18)}
      </Text>
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.pillSize,
          fontWeight: 700,
          color: color.accent,
        }}
      >
        {Math.round(percent)}%
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// WeekTimeBar - barra empilhada de tempo por disciplina na semana
// ---------------------------------------------------------------------------

export function WeekTimeBar({
  disciplines,
}: {
  disciplines: Array<{ nome: string; minutes: number; color: string }>
}) {
  const total = disciplines.reduce((sum, d) => sum + d.minutes, 0)
  if (total === 0) return null

  return (
    <View style={{ marginTop: 8 }}>
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.labelSize,
          fontWeight: 600,
          color: PDF_COLORS.textSecondary,
          marginBottom: 4,
        }}
      >
        Tempo por disciplina
      </Text>
      <View
        style={{
          flexDirection: 'row',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        {disciplines.map((d, i) => (
          <View
            key={i}
            style={{
              width: `${(d.minutes / total) * 100}%`,
              backgroundColor: d.color,
              height: '100%',
            }}
          />
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 4,
        }}
      >
        {disciplines.map((d, i) => (
          <View
            key={i}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: d.color,
              }}
            />
            <Text
              style={{
                fontFamily: PDF_FONTS.body,
                fontSize: 6,
                color: PDF_COLORS.textMuted,
              }}
            >
              {truncateText(d.nome, 15)}: {formatTempo(d.minutes)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// LogoBlock - logo do tenant ou fallback texto
// ---------------------------------------------------------------------------

export function LogoBlock({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line jsx-a11y/alt-text
      <Image
        src={logoUrl}
        style={{ width: 100, height: 40, objectFit: 'contain' }}
      />
    )
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View
        style={{
          width: 24,
          height: 24,
          backgroundColor: PDF_COLORS.primary,
          borderRadius: 5,
        }}
      />
      <Text
        style={{
          fontFamily: PDF_FONTS.display,
          fontSize: 14,
          fontWeight: 700,
          color: PDF_COLORS.primary,
        }}
      >
        Aluminify
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Footer - rodape com branding, nome e paginacao
// ---------------------------------------------------------------------------

export function PdfFooter({ cronogramaNome, alunoNome, cursoNome }: { cronogramaNome: string; alunoNome?: string; cursoNome?: string }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: PDF_SPACING.pagePaddingHorizontal,
        right: PDF_SPACING.pagePaddingHorizontal,
        bottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: PDF_COLORS.border,
        paddingTop: 5,
      }}
      fixed
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View
          style={{
            width: 10,
            height: 10,
            backgroundColor: PDF_COLORS.primary,
            borderRadius: 2,
          }}
        />
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.footerSize,
            color: PDF_COLORS.textMuted,
          }}
        >
          Aluminify
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {alunoNome && (
          <>
            <Text
              style={{
                fontFamily: PDF_FONTS.body,
                fontSize: PDF_FONTS.footerSize,
                color: PDF_COLORS.textSecondary,
                fontWeight: 600,
              }}
            >
              {truncateText(alunoNome, 22)}
            </Text>
            {cursoNome && (
              <>
                <Text
                  style={{
                    fontFamily: PDF_FONTS.body,
                    fontSize: PDF_FONTS.footerSize,
                    color: PDF_COLORS.textMuted,
                  }}
                >
                  •
                </Text>
                <Text
                  style={{
                    fontFamily: PDF_FONTS.body,
                    fontSize: PDF_FONTS.footerSize,
                    color: PDF_COLORS.textLight,
                  }}
                >
                  {truncateText(cursoNome, 20)}
                </Text>
              </>
            )}
          </>
        )}
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.footerSize,
            color: PDF_COLORS.textMuted,
          }}
        >
          •
        </Text>
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.footerSize,
            color: PDF_COLORS.textLight,
          }}
        >
          {truncateText(cronogramaNome, 25)}
        </Text>
      </View>
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.footerSize,
          color: PDF_COLORS.textMuted,
        }}
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  )
}

// ---------------------------------------------------------------------------
// MotivationalMessage - mensagem contextual baseada no progresso
// ---------------------------------------------------------------------------

export function MotivationalMessage({ percent }: { percent: number }) {
  let message: string
  if (percent >= 100) {
    message = 'Parabéns! Você completou todo o seu cronograma de estudos!'
  } else if (percent >= 75) {
    message = `Quase lá! Você já completou ${Math.round(percent)}% do cronograma. A reta final é sua!`
  } else if (percent >= 50) {
    message = `Mais da metade concluída! Você está no caminho certo com ${Math.round(percent)}%.`
  } else if (percent >= 25) {
    message = `Bom progresso! Já passou dos ${Math.round(percent)}%. Mantenha o ritmo!`
  } else {
    message = 'Cada aula assistida é um passo à frente. Continue, o começo é o mais importante!'
  }

  return (
    <View
      style={{
        backgroundColor: percent >= 100 ? PDF_COLORS.successLight : PDF_COLORS.background,
        borderWidth: 1,
        borderColor: percent >= 100 ? PDF_COLORS.success : PDF_COLORS.border,
        borderRadius: PDF_SPACING.cardRadius,
        padding: 12,
        marginTop: 12,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONTS.display,
          fontSize: PDF_FONTS.motivationalSize,
          fontWeight: 600,
          color: percent >= 100 ? PDF_COLORS.successDark : PDF_COLORS.primary,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// StatCard - card de estatística para a capa
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string
  value: string
  sublabel?: string
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: PDF_COLORS.surface,
        borderWidth: 1,
        borderColor: PDF_COLORS.border,
        borderRadius: PDF_SPACING.cardRadius,
        padding: 10,
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.labelSize,
          fontWeight: 600,
          color: PDF_COLORS.textMuted,
          marginBottom: 2,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: PDF_FONTS.display,
          fontSize: 18,
          fontWeight: 700,
          color: PDF_COLORS.primary,
        }}
      >
        {value}
      </Text>
      {sublabel && (
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: 7,
            color: PDF_COLORS.textMuted,
            marginTop: 1,
          }}
        >
          {sublabel}
        </Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// MiniHeader - header compacto para paginas internas
// ---------------------------------------------------------------------------

export function MiniHeader({
  cronogramaNome,
  rightText,
}: {
  cronogramaNome: string
  rightText?: string
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: PDF_COLORS.border,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          fontFamily: PDF_FONTS.body,
          fontSize: PDF_FONTS.labelSize,
          fontWeight: 600,
          color: PDF_COLORS.textMuted,
        }}
      >
        {truncateText(cronogramaNome, 45)}
      </Text>
      {rightText && (
        <Text
          style={{
            fontFamily: PDF_FONTS.body,
            fontSize: PDF_FONTS.labelSize,
            fontWeight: 600,
            color: PDF_COLORS.textSecondary,
          }}
        >
          {rightText}
        </Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Watermark - marca d'agua com logo do tenant em todas as paginas
// ---------------------------------------------------------------------------

export function Watermark({ logoUrl }: { logoUrl: string | null }) {
  if (!logoUrl) return null

  return (
    <View
      fixed
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image
        src={logoUrl}
        style={{
          width: 300,
          height: 300,
          opacity: 0.06,
          objectFit: 'contain',
        }}
      />
    </View>
  )
}
