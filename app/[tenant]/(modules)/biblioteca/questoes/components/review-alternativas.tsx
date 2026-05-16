"use client"

import * as React from "react"
import { Pencil, Check, Plus, X, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/app/shared/components/forms/input"
import { renderTextWithInlineMath, hasPreviewFormatting } from "./content-block-preview"
import { FieldLabel } from "./field-label"

interface Alternativa {
  letra: string
  texto: string
  imagemPath?: string | null
}

interface ReviewAlternativasProps {
  alternativas: Alternativa[]
  gabarito: string
  questionIndex: number
  resolveImageSrc: (storagePath: string) => string
  onUpdateTexto: (qIdx: number, altIdx: number, texto: string) => void
  onAddAlternativa: (qIdx: number) => void
  onRemoveAlternativa: (qIdx: number, altIdx: number) => void
}

export function ReviewAlternativas({
  alternativas,
  gabarito,
  questionIndex,
  resolveImageSrc,
  onUpdateTexto,
  onAddAlternativa,
  onRemoveAlternativa,
}: ReviewAlternativasProps) {
  const [isEditing, setIsEditing] = React.useState(false)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <FieldLabel label="Alternativas" tooltipKey="alternativas" />
        {isEditing ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs cursor-pointer text-primary hover:text-primary"
            onClick={() => setIsEditing(false)}
          >
            <Check className="h-3.5 w-3.5" />
            Concluir
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3 w-3" />
            Editar
          </Button>
        )}
      </div>

      <div
        className={`rounded-lg border p-3 transition-colors duration-200 ${
          isEditing
            ? "border-primary/30 bg-background"
            : "border-border/50 bg-muted/10 dark:bg-muted/5"
        }`}
      >
        <div className="space-y-1">
          {alternativas.map((alt, altIdx) => (
            <div key={alt.letra} className="flex flex-col gap-1">
              {isEditing ? (
                <>
                  <div className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-muted/30 transition-colors">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                        alt.letra.toUpperCase() === gabarito
                          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 ring-2 ring-green-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {alt.letra.toUpperCase()}
                    </span>
                    <Input
                      value={alt.texto}
                      onChange={(e) => onUpdateTexto(questionIndex, altIdx, e.target.value)}
                      className="flex-1 h-8 text-sm"
                      placeholder={`Alternativa ${alt.letra.toUpperCase()}...`}
                      spellCheck={false}
                    />
                    {alternativas.length > 2 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 cursor-pointer text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveAlternativa(questionIndex, altIdx)}
                        title="Remover alternativa"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {hasPreviewFormatting(alt.texto) && (
                    <div className="ml-10 whitespace-pre-wrap rounded-md border bg-muted/20 px-3 py-2 text-sm">
                      {renderTextWithInlineMath(alt.texto)}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2 p-1.5">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                      alt.letra.toUpperCase() === gabarito
                        ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 ring-2 ring-green-500"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {alt.letra.toUpperCase()}
                  </span>
                  <p className="flex-1 text-sm leading-relaxed whitespace-pre-wrap pt-0.5">
                    {hasPreviewFormatting(alt.texto)
                      ? renderTextWithInlineMath(alt.texto)
                      : alt.texto || <span className="text-muted-foreground/60 italic">Sem texto</span>}
                  </p>
                </div>
              )}
              {alt.imagemPath && renderAlternativaImage(alt, resolveImageSrc)}
            </div>
          ))}
        </div>

        {isEditing && alternativas.length < 5 && (
          <Button
            variant="outline"
            size="sm"
            className="w-fit cursor-pointer text-xs mt-2"
            onClick={() => onAddAlternativa(questionIndex)}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            Adicionar alternativa
          </Button>
        )}
      </div>
    </div>
  )
}

function renderAlternativaImage(
  alt: Alternativa,
  resolveImageSrc: (storagePath: string) => string,
) {
  if (!alt.imagemPath) return null
  const ext = alt.imagemPath.split(".").pop()?.toLowerCase()
  if (ext === "emf" || ext === "wmf") {
    return (
      <div className="ml-9 flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2 my-1">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs text-muted-foreground">
          Imagem em formato {ext.toUpperCase()} (não suportado)
        </span>
      </div>
    )
  }
  return (
    <div className="ml-9">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={resolveImageSrc(alt.imagemPath)}
        alt={`Imagem alternativa ${alt.letra.toUpperCase()}`}
        className="max-w-full h-auto rounded-md border object-contain"
      />
    </div>
  )
}
