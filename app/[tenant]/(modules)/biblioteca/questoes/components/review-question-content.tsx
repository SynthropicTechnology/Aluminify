"use client"

import * as React from "react"
import { AlertTriangle, FileText } from "lucide-react"
import { Input } from "@/app/shared/components/forms/input"
import { VideoPlayer } from "@/app/shared/components/media/video-player"
import { ReviewSectionField } from "./review-section-field"
import { ReviewAlternativas } from "./review-alternativas"
import { FieldLabel } from "./field-label"

interface ParseWarning {
  code: string
  message: string
  questao?: number
}

interface Alternativa {
  letra: string
  texto: string
  imagemPath?: string | null
}

interface QuestaoData {
  numero: number
  textoBase: Array<Record<string, unknown>>
  fonte?: Array<Record<string, unknown>> | null
  enunciado: Array<Record<string, unknown>>
  alternativas: Alternativa[]
  gabarito: string
  resolucao: Array<Record<string, unknown>>
  resolucaoVideoUrl?: string | null
}

interface ReviewQuestionContentProps {
  questao: QuestaoData | null
  questionIndex: number
  jobId: string
  warnings: ParseWarning[]
  onUpdateBlocks: (idx: number, field: string, blocks: Array<Record<string, unknown>>) => void
  onUpdateAlternativaTexto: (qIdx: number, altIdx: number, texto: string) => void
  onAddAlternativa: (qIdx: number) => void
  onRemoveAlternativa: (qIdx: number, altIdx: number) => void
  onUpdateField: (qIdx: number, field: string, value: unknown) => void
  resolveImageSrc: (storagePath: string) => string
}

export function ReviewQuestionContent({
  questao,
  questionIndex,
  warnings,
  onUpdateBlocks,
  onUpdateAlternativaTexto,
  onAddAlternativa,
  onRemoveAlternativa,
  onUpdateField,
  resolveImageSrc,
}: ReviewQuestionContentProps) {
  if (!questao) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="h-8 w-8 mb-2" />
        <p className="text-sm">Nenhuma questão para revisar.</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-4 space-y-4">
      {warnings.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3">
          {warnings.map((w, wi) => (
            <div key={wi} className="flex items-start gap-2 text-xs">
              <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-amber-700 dark:text-amber-300">
                <span className="font-mono text-amber-500">{w.code}</span>
                {" — "}{w.message}
              </span>
            </div>
          ))}
        </div>
      )}

      <ReviewSectionField
        label="Texto de Apoio"
        tooltipKey="textoBase"
        blocks={questao.textoBase ?? []}
        onBlocksChange={(blocks) => onUpdateBlocks(questionIndex, "textoBase", blocks)}
        resolveImageSrc={resolveImageSrc}
        placeholder="Texto de apoio (opcional)..."
        minEditorHeight="min-h-[60px]"
      />

      <ReviewSectionField
        label="Fonte"
        tooltipKey="fonte"
        blocks={questao.fonte ?? []}
        onBlocksChange={(blocks) => onUpdateBlocks(questionIndex, "fonte", blocks)}
        resolveImageSrc={resolveImageSrc}
        placeholder="Fonte/citação da questão (opcional)..."
        textClassName="text-xs"
        minEditorHeight="min-h-[52px]"
      />

      <ReviewSectionField
        label="Enunciado"
        tooltipKey="enunciado"
        blocks={questao.enunciado ?? []}
        onBlocksChange={(blocks) => onUpdateBlocks(questionIndex, "enunciado", blocks)}
        resolveImageSrc={resolveImageSrc}
        placeholder="Texto do enunciado..."
        minEditorHeight="min-h-[80px]"
      />

      <ReviewAlternativas
        alternativas={questao.alternativas}
        gabarito={questao.gabarito}
        questionIndex={questionIndex}
        resolveImageSrc={resolveImageSrc}
        onUpdateTexto={onUpdateAlternativaTexto}
        onAddAlternativa={onAddAlternativa}
        onRemoveAlternativa={onRemoveAlternativa}
      />

      <ReviewSectionField
        label="Resolução"
        tooltipKey="resolucao"
        blocks={questao.resolucao ?? []}
        onBlocksChange={(blocks) => onUpdateBlocks(questionIndex, "resolucao", blocks)}
        resolveImageSrc={resolveImageSrc}
        placeholder="Resolução da questão (opcional)..."
        minEditorHeight="min-h-[60px]"
      />

      <div className="space-y-2">
        <FieldLabel label="Vídeo de Resolução (URL)" tooltipKey="videoResolucao" />
        <Input
          value={questao.resolucaoVideoUrl ?? ""}
          onChange={(e) => onUpdateField(questionIndex, "resolucaoVideoUrl", e.target.value || null)}
          className="h-8 text-sm"
          placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
        />
        {questao.resolucaoVideoUrl && (
          <div className="mt-1">
            <VideoPlayer url={questao.resolucaoVideoUrl} light className="max-w-sm" />
          </div>
        )}
      </div>
    </div>
  )
}
